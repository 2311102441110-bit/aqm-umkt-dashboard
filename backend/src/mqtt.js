
const mqtt = require('mqtt');
const supabase = require('./supabase');
const { sendAlert } = require('./telegram');

let mqttClient;
let ioInstance;
let mqttStatus = 'connecting';

// ==========================================
// JADWAL PENGAMATAN
// ==========================================
const SESSIONS = [
    { name: 'Jam Sibuk Pagi', category: 'JAM SIBUK', start: '07:00', end: '08:00' },
    { name: 'Jam Normal Pagi', category: 'JAM NORMAL', start: '10:00', end: '11:00' },
    { name: 'Jam Normal Siang', category: 'JAM NORMAL', start: '13:30', end: '14:30' },
    { name: 'Jam Sibuk Sore', category: 'JAM SIBUK', start: '17:00', end: '18:00' }
];

// ==========================================
// IDENTITAS PERANGKAT
// ==========================================
const RESEARCH_DEVICE_ID = 'esp32-kampus';
const RESEARCH_DEVICE_NAME = 'AQM-01';

// ==========================================
// DATA REALTIME
// ==========================================
const latestSensorData = {};
const lastRecordedMinute = {};
const recordingMinute = {};
const lastNotifiedSession = {};
const notifyingSession = new Set();
const activeSession = {};

// ==========================================
// CACHE LOKASI AKTIF
// ==========================================
let activeLocationCache = null;
let locationRefreshPromise = null;

const LOCATION_REFRESH_INTERVAL = 3000;

// ==========================================
// ANTRIAN SENSOR_CURRENT
// Hanya menyimpan pembaruan terbaru
// yang belum diproses.
// ==========================================
let currentWriteInProgress = false;
let pendingCurrentWrite = null;

// ==========================================
// FORMAT WAKTU WITA
// ==========================================
const WITA_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

// ==========================================
// MENGAMBIL KOMPONEN TANGGAL DAN WAKTU WITA
// ==========================================
const getWitaDateParts = (date = new Date()) => {
    const parts = WITA_DATE_FORMATTER.formatToParts(date);

    return parts.reduce((result, part) => {
        if (part.type !== 'literal') {
            result[part.type] = part.value;
        }

        return result;
    }, {});
};

// ==========================================
// WAKTU SEKARANG - ZONA WITA
// ==========================================
const getCurrentTime = () => {
    const now = new Date();

    const {
        year,
        month,
        day,
        hour,
        minute,
        second
    } = getWitaDateParts(now);

    return {
        now,
        hours: hour,
        minutes: minute,
        seconds: second,
        time: `${hour}:${minute}`,
        minuteKey: `${year}-${month}-${day} ${hour}:${minute}`
    };
};

// ==========================================
// MENCARI JADWAL
// ==========================================
const getCurrentSession = () => {
    const { time } = getCurrentTime();

    return SESSIONS.find(
        session => time >= session.start && time < session.end
    ) || null;
};

// ==========================================
// ID SESI - MENGGUNAKAN TANGGAL WITA
// ==========================================
const getSessionKey = (session) => {
    const {
        year,
        month,
        day
    } = getWitaDateParts();

    const date = `${year}-${month}-${day}`;

    return `${date}_${session.start}_${session.end}`;
};

// ==========================================
// VALIDASI DHT22
// ==========================================
const isDhtValid = (temperature, humidity) => {
    return (
        temperature !== null &&
        temperature !== undefined &&
        humidity !== null &&
        humidity !== undefined &&
        Number.isFinite(Number(temperature)) &&
        Number.isFinite(Number(humidity))
    );
};

// ==========================================
// AMBIL LOKASI AKTIF DARI SUPABASE
// ==========================================
const refreshActiveObservationLocation = async () => {
    if (locationRefreshPromise) {
        return locationRefreshPromise;
    }

    locationRefreshPromise = (async () => {
        const { data, error } = await supabase
            .from('observation_locations')
            .select('location_code, location_name, category')
            .eq('is_active', true)
            .limit(1)
            .single();

        if (error) {
            console.error(
                'Gagal mengambil lokasi aktif:',
                error.message
            );

            // Pertahankan cache sebelumnya jika query gagal.
            return activeLocationCache;
        }

        activeLocationCache = data;
        return activeLocationCache;
    })();

    try {
        return await locationRefreshPromise;
    } finally {
        locationRefreshPromise = null;
    }
};

// ==========================================
// AMBIL STATUS SESI
// ==========================================
const getObservationSession = async () => {
    const { data, error } = await supabase
        .from('observation_session')
        .select(
            'id, is_active, started_at, ended_at, location_code, location_name'
        )
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error(
            'Gagal mengambil status sesi:',
            error.message
        );

        return null;
    }

    return data;
};

// ==========================================
// ANTRIAN UPDATE SENSOR_CURRENT
// ==========================================
const queueSensorCurrent = (sensor) => {
    pendingCurrentWrite = {
        device_id: sensor.device_id,
        location: sensor.observation_location_name,
        gas: sensor.gas,
        adc: sensor.adc,
        rsro: sensor.rsro,
        temperature: sensor.temperature,
        humidity: sensor.humidity,
        air_quality_status: sensor.air_quality_status,
        timestamp: sensor.timestamp
    };

    if (!currentWriteInProgress) {
        processSensorCurrentQueue();
    }
};

const processSensorCurrentQueue = async () => {
    if (currentWriteInProgress) return;

    currentWriteInProgress = true;

    try {
        while (pendingCurrentWrite) {
            const payload = pendingCurrentWrite;

            // Ambil data terbaru yang menunggu.
            pendingCurrentWrite = null;

            const { error } = await supabase
                .from('sensor_current')
                .upsert(payload, {
                    onConflict: 'device_id'
                });

            if (error) {
                console.error(
                    'Gagal memperbarui sensor_current:',
                    error.message
                );
            } else {
                console.log(
                    'sensor_current berhasil diperbarui.'
                );
            }
        }
    } catch (error) {
        console.error(
            'Kesalahan antrian sensor_current:',
            error.message
        );
    } finally {
        currentWriteInProgress = false;

        // Periksa kembali jika ada data masuk saat proses berakhir.
        if (pendingCurrentWrite) {
            processSensorCurrentQueue();
        }
    }
};

// ==========================================
// INITIALIZE MQTT
// ==========================================
const initMqtt = (io) => {
    ioInstance = io;

    const brokerUrl =
        process.env.MQTT_BROKER_URL ||
        'mqtt://localhost:1883';

    const options = {
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined
    };

    // Ambil lokasi awal sebelum memproses data.
    refreshActiveObservationLocation();

    // Perbarui cache lokasi setiap 3 detik.
    setInterval(() => {
        refreshActiveObservationLocation();
    }, LOCATION_REFRESH_INTERVAL);

    mqttClient = mqtt.connect(brokerUrl, options);

    mqttClient.on('connect', () => {
        mqttStatus = 'connected';

        console.log('Connected to MQTT Broker:', brokerUrl);

        mqttClient.subscribe('umkt/air/#', (err) => {
            if (err) {
                console.error(
                    'MQTT subscribe error:',
                    err.message
                );
                return;
            }

            console.log('Subscribed to topic: umkt/air/#');
        });

        io.emit('mqtt_status', {
            status: 'connected'
        });
    });

    mqttClient.on('error', (err) => {
        mqttStatus = 'error';

        console.error('MQTT error:', err.message);

        io.emit('mqtt_status', {
            status: 'error',
            message: err.message
        });
    });

    mqttClient.on('offline', () => {
        mqttStatus = 'disconnected';

        console.log('MQTT client offline');

        io.emit('mqtt_status', {
            status: 'disconnected'
        });
    });

    mqttClient.on('reconnect', () => {
        mqttStatus = 'connecting';

        io.emit('mqtt_status', {
            status: 'connecting'
        });
    });

    // ======================================
    // PESAN MQTT MASUK
    // ======================================
    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());

            let location = activeLocationCache;

            // Jika cache belum tersedia, ambil lokasi terlebih dahulu.
            if (!location) {
                location = await refreshActiveObservationLocation();
            }

            if (!location) {
                console.error(
                    'Tidak ada lokasi aktif di Supabase.'
                );
                return;
            }

            await handleSensorData(
                RESEARCH_DEVICE_ID,
                data,
                location
            );

        } catch (error) {
            console.error(
                'Gagal memproses data MQTT:',
                error.message
            );
        }
    });

    // Cek akhir sesi setiap detik.
    setInterval(checkSessionEnd, 1000);
};

// ==========================================
// HANDLE SENSOR DATA
// ==========================================
const handleSensorData = async (deviceId, data, location) => {
    const {
        gas,
        adc,
        rsro,
        temperature,
        humidity,
        air_quality_status
    } = data;

    const { time, minuteKey } = getCurrentTime();

    const session = getCurrentSession();

    if (!location) {
        console.error(
            'Data sensor tidak diproses karena lokasi tidak tersedia.'
        );
        return;
    }

    // ======================================
    // SIMPAN DATA TERBARU DI MEMORI
    // ======================================
    const sensor = {
        device_id: deviceId,
        gas,
        adc,
        rsro,
        temperature,
        humidity,
        air_quality_status,
        observation_location_code: location.location_code,
        observation_location_name: location.location_name,
        observation_location_category: location.category,
        timestamp: new Date().toISOString()
    };

    latestSensorData[deviceId] = sensor;

    // ======================================
    // KIRIM REALTIME KE DASHBOARD
    // Tidak menunggu Supabase.
    // ======================================
    if (ioInstance) {
        ioInstance.emit('sensor_data', sensor);
    }

    // ======================================
    // UPDATE SENSOR_CURRENT
    // Tetap berjalan di luar jadwal.
    // ======================================
    queueSensorCurrent(sensor);

    // ======================================
    // LOG SENSOR
    // ======================================
    console.log('');
    console.log('========================================');
    console.log('DATA SENSOR');
    console.log('========================================');
    console.log('Waktu        :', time, 'WITA');
    console.log('Device       :', deviceId);
    console.log('Nama Device  :', RESEARCH_DEVICE_NAME);
    console.log('Lokasi       :', location.location_name);
    console.log('Kategori     :', location.category);
    console.log('Gas          :', gas);
    console.log('ADC          :', adc);
    console.log('Rs/Ro        :', rsro);
    console.log('Suhu         :', temperature, '°C');
    console.log('Kelembapan   :', humidity, '%');
    console.log('Status Udara :', air_quality_status);

    // ======================================
    // CEK JADWAL PENGAMATAN
    // ======================================
    if (!session) {
        console.log('Di luar jadwal pengamatan.');
        console.log('Data tidak direkam.');
        console.log('========================================');
        return;
    }

    // ======================================
    // CEK STATUS SESI MANUAL
    // ======================================
    const observationSession = await getObservationSession();

    if (!observationSession) {
        console.log(
            'Status sesi pengambilan data tidak tersedia.'
        );
        console.log('Data tidak direkam.');
        console.log('========================================');
        return;
    }

    if (observationSession.is_active !== true) {
        console.log('Sesi pengambilan data tidak aktif.');
        console.log('Sensor tetap membaca data.');
        console.log('Data tidak direkam.');
        console.log('========================================');
        return;
    }

    // ======================================
    // VALIDASI LOKASI SESI
    // ======================================
    if (
        observationSession.location_code &&
        observationSession.location_code !== location.location_code
    ) {
        console.log(
            'Lokasi sesi berbeda dengan lokasi aktif.'
        );
        console.log('Data tidak direkam.');
        console.log('========================================');
        return;
    }

    // ======================================
    // IDENTITAS SESI
    // ======================================
    const sessionKey = getSessionKey(session);

    if (activeSession[deviceId] !== sessionKey) {
        activeSession[deviceId] = sessionKey;

        console.log('');
        console.log('SESI PENGAMATAN DIMULAI');
        console.log('Sesi     :', session.name);
        console.log('Kategori :', session.category);
        console.log('Waktu    :', `${session.start} - ${session.end}`);
        console.log('Lokasi   :', location.location_name);
        console.log('');
    }

    // ======================================
    // REKAM 1 KALI SETIAP MENIT
    // ======================================
    const recordKey =
        `${deviceId}_` +
        `${location.location_code}_` +
        `${minuteKey}`;

    if (
        lastRecordedMinute[deviceId] === recordKey ||
        recordingMinute[deviceId] === recordKey
    ) {
        return;
    }

    // Tandai sebelum insert untuk mencegah insert ganda.
    recordingMinute[deviceId] = recordKey;

    // ======================================
    // SIMPAN RIWAYAT KE SENSOR_DATA
    // ======================================
    const { error: supabaseError } = await supabase
        .from('sensor_data')
        .insert([
            {
                device_id: deviceId,
                location: location.location_name,
                gas,
                adc,
                rsro,
                temperature,
                humidity,
                air_quality_status,
                timestamp: sensor.timestamp
            }
        ]);

    if (supabaseError) {
        console.error(
            'Gagal menyimpan data ke Supabase:',
            supabaseError.message
        );

        delete recordingMinute[deviceId];

        console.log('========================================');
        return;
    }

    lastRecordedMinute[deviceId] = recordKey;
    delete recordingMinute[deviceId];

    console.log('');
    console.log('DATA BERHASIL DIREKAM KE SUPABASE');
    console.log('Waktu      :', time, 'WITA');
    console.log('Sesi       :', session.name);
    console.log('Kategori   :', session.category);
    console.log('Lokasi     :', location.location_name);
    console.log('Gas        :', gas);
    console.log('ADC        :', adc);
    console.log('Rs/Ro      :', rsro);
    console.log('Suhu       :', temperature, '°C');
    console.log('Kelembapan :', humidity, '%');
    console.log('Status     :', air_quality_status);
    console.log('Interval   : 1 menit');
    console.log('========================================');
};

// ==========================================
// CEK AKHIR SESI
// ==========================================
const checkSessionEnd = () => {
    const { time } = getCurrentTime();

    for (const session of SESSIONS) {
        if (time !== session.end) continue;

        const sessionKey = getSessionKey(session);
        const deviceId = RESEARCH_DEVICE_ID;

        if (lastNotifiedSession[deviceId] === sessionKey) {
            continue;
        }

        if (notifyingSession.has(sessionKey)) {
            continue;
        }

        const sensor = latestSensorData[deviceId];

        if (!sensor) continue;

        // Cegah laporan ganda ketika proses Telegram berlangsung.
        notifyingSession.add(sessionKey);

        sendSessionReport(
            deviceId,
            sensor,
            session,
            sessionKey
        );
    }
};

// ==========================================
// KIRIM LAPORAN TELEGRAM DAN DASHBOARD
// ==========================================
const sendSessionReport = async (
    deviceId,
    sensor,
    session,
    sessionKey
) => {
    try {
        const observationSession = await getObservationSession();

        if (
            !observationSession ||
            observationSession.location_code !==
                sensor.observation_location_code
        ) {
            console.log(
                'Laporan tidak dikirim karena lokasi sesi tidak sesuai.'
            );
            return;
        }

        // Validasi DHT22.
        if (!isDhtValid(sensor.temperature, sensor.humidity)) {
            console.log(
                'Laporan Telegram tidak dikirim karena DHT22 tidak valid.'
            );
            return;
        }

        const currentStatus = String(
            sensor.air_quality_status || 'TIDAK DIKETAHUI'
        ).trim().toUpperCase();

        let statusIcon = '🟢';

        if (
            currentStatus.includes('BURUK') ||
            currentStatus.includes('BAHAYA') ||
            currentStatus.includes('TIDAK SEHAT') ||
            currentStatus.includes('BERBAHAYA')
        ) {
            statusIcon = '🔴';
        }

        const categoryIcon =
            session.category === 'JAM SIBUK' ? '🔴' : '🟢';

        const locationName =
            sensor.observation_location_name ||
            'Lokasi tidak diketahui';

        const telegramMessage =
            `${categoryIcon} *LAPORAN SESI PENGAMATAN*\n\n` +
            `📌 *${session.name}*\n` +
            `📊 Kategori: ${session.category}\n` +
            `⏰ Waktu: ${session.start} - ${session.end}\n\n` +
            `${statusIcon} *Kondisi Udara: ${currentStatus}*\n\n` +
            `🌫️ Gas: ${sensor.gas}\n` +
            `📊 ADC: ${sensor.adc}\n` +
            `🔬 Rs/Ro: ${sensor.rsro}\n` +
            `🌡️ Suhu: ${sensor.temperature} °C\n` +
            `💧 Kelembapan: ${sensor.humidity} %\n\n` +
            `📍 Lokasi: ${locationName}\n` +
            `🖥️ Perangkat: ${RESEARCH_DEVICE_NAME}\n\n` +
            `💾 Interval perekaman: 1 menit\n` +
            `📱 Notifikasi: akhir sesi`;

        // ==================================
        // 1. KIRIM LAPORAN KE TELEGRAM
        // ==================================
        await sendAlert(telegramMessage);

        console.log(
            'Telegram laporan sesi berhasil dikirim.'
        );

        // ==================================
        // 2. SIAPKAN NOTIFIKASI DASHBOARD
        // ==================================
        const notificationObject = {
            id: `${Date.now()}-${deviceId}`,
            title: 'Laporan Kualitas Udara',
            message: telegramMessage,
            session: session.name,
            category: session.category,
            location: locationName,
            device_name: RESEARCH_DEVICE_NAME,
            gas: sensor.gas,
            adc: sensor.adc,
            rsro: sensor.rsro,
            temperature: sensor.temperature,
            humidity: sensor.humidity,
            air_quality_status: currentStatus,
            timestamp: new Date().toISOString()
        };

        // ==================================
        // 3. SIMPAN NOTIFIKASI KE SUPABASE
        // ==================================
        const { error: notificationError } = await supabase
            .from('alerts')
            .insert([notificationObject]);

        if (notificationError) {
            console.error(
                'Gagal menyimpan notifikasi ke Supabase:',
                notificationError.message
            );
        } else {
            console.log(
                'Notifikasi berhasil disimpan ke Supabase.'
            );
        }

        // ==================================
        // 4. KIRIM NOTIFIKASI REALTIME
        // ==================================
        if (ioInstance) {
            ioInstance.emit('notification', notificationObject);

            console.log(
                'Notifikasi berhasil dikirim ke dashboard melalui Socket.IO.'
            );
        }

        console.log('');
        console.log('========================================');
        console.log('LAPORAN SESI SELESAI');
        console.log('Sesi   :', session.name);
        console.log('Lokasi :', locationName);
        console.log('Status :', currentStatus);
        console.log('========================================');

        lastNotifiedSession[deviceId] = sessionKey;

    } catch (error) {
        console.error(
            'Gagal memproses laporan sesi:',
            error.message
        );
    } finally {
        notifyingSession.delete(sessionKey);
    }
};

// ==========================================
// EXPORT
// ==========================================
module.exports = {
    initMqtt,
    handleSensorData,
    getMqttStatus: () => mqttStatus
};