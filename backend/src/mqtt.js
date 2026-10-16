const mqtt = require('mqtt');
const supabase = require('./supabase');
const { sendAlert } = require('./telegram');

let mqttClient;
let ioInstance;
let mqttStatus = 'connecting';

// =====================================================
// JADWAL PENGAMATAN
// =====================================================

const SESSIONS = [
    {
        name: 'Jam Sibuk Pagi',
        category: 'JAM SIBUK',
        start: '07:00',
        end: '08:00'
    },
    {
        name: 'Jam Normal Pagi',
        category: 'JAM NORMAL',
        start: '10:00',
        end: '11:00'
    },
    {
        name: 'Jam Normal Siang',
        category: 'JAM NORMAL',
        start: '13:30',
        end: '14:30'
    },
    {
        name: 'Jam Sibuk Sore',
        category: 'JAM SIBUK',
        start: '17:00',
        end: '18:00'
    }
];

// =====================================================
// IDENTITAS PERANGKAT PENELITIAN
// =====================================================

const RESEARCH_DEVICE_ID = 'esp32-kampus';
const RESEARCH_DEVICE_NAME = 'AQM-01';

// =====================================================
// DATA REALTIME
// =====================================================

const latestSensorData = {};
const lastRecordedMinute = {};
const lastNotifiedSession = {};
const activeSession = {};

// =====================================================
// WAKTU SEKARANG
// =====================================================

const getCurrentTime = () => {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return {
        now,
        hours,
        minutes,
        seconds,

        time: `${hours}:${minutes}`,

        minuteKey:
            `${now.getFullYear()}-` +
            `${String(now.getMonth() + 1).padStart(2, '0')}-` +
            `${String(now.getDate()).padStart(2, '0')} ` +
            `${hours}:${minutes}`
    };
};

// =====================================================
// MENCARI JADWAL YANG SEDANG BERJALAN
// =====================================================

const getCurrentSession = () => {
    const { time } = getCurrentTime();

    for (const session of SESSIONS) {
        if (
            time >= session.start &&
            time < session.end
        ) {
            return session;
        }
    }

    return null;
};

// =====================================================
// MEMBUAT ID SESI JADWAL
// =====================================================

const getSessionKey = (session) => {
    const now = new Date();

    const date =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, '0')}-` +
        `${String(now.getDate()).padStart(2, '0')}`;

    return `${date}_${session.start}_${session.end}`;
};

// =====================================================
// VALIDASI DATA DHT22
// =====================================================

const isDhtValid = (temperature, humidity) => {
    return (
        temperature !== null &&
        temperature !== undefined &&
        humidity !== null &&
        humidity !== undefined &&
        !isNaN(Number(temperature)) &&
        !isNaN(Number(humidity))
    );
};

// =====================================================
// MENGAMBIL LOKASI PENGAMATAN AKTIF
// =====================================================

const getActiveObservationLocation = async () => {
    const { data, error } = await supabase
        .from('observation_locations')
        .select(
            'location_code, location_name, category'
        )
        .eq('is_active', true)
        .limit(1)
        .single();

    if (error) {
        console.error(
            '❌ Gagal mengambil lokasi aktif dari Supabase:',
            error.message
        );

        return null;
    }

    return data;
};

// =====================================================
// MENGAMBIL STATUS SESI PENGAMBILAN DATA
// =====================================================

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
            '❌ Gagal mengambil status sesi dari Supabase:',
            error.message
        );

        return null;
    }

    return data;
};

// =====================================================
// INITIALIZE MQTT
// =====================================================

const initMqtt = (io) => {

    ioInstance = io;

    const brokerUrl =
        process.env.MQTT_BROKER_URL ||
        'mqtt://localhost:1883';

    const options = {
        username:
            process.env.MQTT_USERNAME || undefined,

        password:
            process.env.MQTT_PASSWORD || undefined
    };

    mqttClient = mqtt.connect(
        brokerUrl,
        options
    );

    // =================================================
    // MQTT CONNECT
    // =================================================

    mqttClient.on(
        'connect',
        () => {

            mqttStatus = 'connected';

            console.log(
                'Connected to MQTT Broker:',
                brokerUrl
            );

            mqttClient.subscribe(
                'umkt/air/#',
                (err) => {

                    if (err) {
                        console.error(
                            'MQTT subscribe error:',
                            err.message
                        );

                        return;
                    }

                    console.log(
                        'Subscribed to topic: umkt/air/#'
                    );
                }
            );

            io.emit(
                'mqtt_status',
                {
                    status: 'connected'
                }
            );
        }
    );

    // =================================================
    // MQTT ERROR
    // =================================================

    mqttClient.on(
        'error',
        (err) => {

            mqttStatus = 'error';

            console.error(
                'MQTT error:',
                err.message
            );

            io.emit(
                'mqtt_status',
                {
                    status: 'error',
                    message: err.message
                }
            );
        }
    );

    // =================================================
    // MQTT OFFLINE
    // =================================================

    mqttClient.on(
        'offline',
        () => {

            mqttStatus = 'disconnected';

            console.log(
                'MQTT client offline'
            );

            io.emit(
                'mqtt_status',
                {
                    status: 'disconnected'
                }
            );
        }
    );

    // =================================================
    // MQTT MESSAGE
    // =================================================

    mqttClient.on(
        'message',
        async (topic, message) => {

            console.log(
                'MQTT MASUK:',
                topic,
                message.toString()
            );

            try {

                const data =
                    JSON.parse(
                        message.toString()
                    );

                // =====================================
                // SATU ALAT UNTUK SEMUA LOKASI
                // =====================================

                const location =
                    await getActiveObservationLocation();

                if (!location) {

                    console.error(
                        '❌ Tidak ada lokasi aktif di Supabase.'
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
                    '❌ Gagal memproses data MQTT:',
                    error.message
                );
            }
        }
    );

    // =================================================
    // CEK AKHIR SESI SETIAP DETIK
    // =================================================

    setInterval(
        checkSessionEnd,
        1000
    );
};

// =====================================================
// HANDLE SENSOR DATA
// =====================================================

const handleSensorData = async (
    deviceId,
    data,
    location
) => {

    const {
        gas,
        adc,
        rsro,
        temperature,
        humidity,
        air_quality_status
    } = data;

    const {
        time,
        minuteKey
    } = getCurrentTime();

    // =================================================
    // CARI JADWAL
    // =================================================

    const session =
        getCurrentSession();

    // =================================================
    // LOKASI PENGAMATAN
    // =================================================

    const observationLocation = location;

    if (!observationLocation) {

        console.error(
            '❌ Data sensor tidak diproses karena lokasi aktif tidak tersedia.'
        );

        return;
    }

    // =================================================
    // DATA TERBARU
    // =================================================

    latestSensorData[deviceId] = {

        device_id:
            deviceId,

        gas:
            gas,

        adc:
            adc,

        rsro:
            rsro,

        temperature:
            temperature,

        humidity:
            humidity,

        air_quality_status:
            air_quality_status,

        observation_location_code:
            observationLocation.location_code,

        observation_location_name:
            observationLocation.location_name,

        observation_location_category:
            observationLocation.category,

        timestamp:
            new Date().toISOString()
    };

    // =================================================
    // KIRIM DATA REALTIME KE DASHBOARD
    // =================================================

    if (ioInstance) {

        ioInstance.emit(
            'sensor_data',
            latestSensorData[deviceId]
        );
    }

    // =================================================
    // LOG SENSOR
    // =================================================

    console.log('');

    console.log(
        '========================================'
    );

    console.log(
        'DATA SENSOR'
    );

    console.log(
        '========================================'
    );

    console.log(
        'Waktu        :',
        time
    );

    console.log(
        'Device       :',
        deviceId
    );

    console.log(
        'Nama Device  :',
        RESEARCH_DEVICE_NAME
    );

    console.log(
        'Lokasi       :',
        observationLocation.location_name
    );

    console.log(
        'Kategori     :',
        observationLocation.category
    );

    console.log(
        'Gas          :',
        gas
    );

    console.log(
        'ADC          :',
        adc
    );

    console.log(
        'Rs/Ro        :',
        rsro
    );

    console.log(
        'Suhu         :',
        temperature,
        '°C'
    );

    console.log(
        'Kelembapan   :',
        humidity,
        '%'
    );

    console.log(
        'Status Udara :',
        air_quality_status
    );

    // =================================================
    // CEK JADWAL
    // =================================================

    if (!session) {

        console.log(
            'Di luar jadwal pengamatan.'
        );

        console.log(
            'Data tidak direkam.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // CEK TOMBOL SESI PENGAMBILAN DATA
    // =================================================

    const observationSession =
        await getObservationSession();

    if (!observationSession) {

        console.log(
            '⚠️ Status sesi pengambilan data tidak tersedia.'
        );

        console.log(
            'Data tidak direkam.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // SESI TIDAK AKTIF
    // =================================================

    if (observationSession.is_active !== true) {

        console.log(
            '🔴 SESI PENGAMBILAN DATA TIDAK AKTIF.'
        );

        console.log(
            'Sensor tetap membaca data.'
        );

        console.log(
            'Data tidak direkam ke Supabase.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // VALIDASI LOKASI SESI
    // =================================================

    if (
        observationSession.location_code &&
        observationSession.location_code !==
            observationLocation.location_code
    ) {

        console.log(
            '⚠️ Lokasi sesi berbeda dengan lokasi aktif.'
        );

        console.log(
            'Data tidak direkam.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // SESI MANUAL AKTIF
    // =================================================

    const sessionKey =
        getSessionKey(session);

    if (
        activeSession[deviceId] !==
        sessionKey
    ) {

        activeSession[deviceId] =
            sessionKey;

        console.log('');

        console.log(
            '🟢 SESI PENGAMATAN DIMULAI'
        );

        console.log(
            'Sesi       :',
            session.name
        );

        console.log(
            'Kategori   :',
            session.category
        );

        console.log(
            'Waktu      :',
            `${session.start} - ${session.end}`
        );

        console.log(
            'Lokasi     :',
            observationLocation.location_name
        );

        console.log(
            'Status     :',
            'PENGAMBILAN DATA AKTIF'
        );

        console.log('');
    }

    // =================================================
    // REKAM SUPABASE 1 KALI SETIAP MENIT
    // =================================================

    const recordKey =
        `${deviceId}_` +
        `${observationLocation.location_code}_` +
        `${minuteKey}`;

    if (
        lastRecordedMinute[deviceId] ===
        recordKey
    ) {

        console.log(
            'Data sudah direkam untuk menit ini.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // SIMPAN LANGSUNG KE SUPABASE
    // =================================================

    const {
        error: supabaseError
    } = await supabase
        .from('sensor_data')
        .insert([
            {
                device_id:
                    deviceId,

                location:
                    observationLocation.location_name,

                gas:
                    gas,

                adc:
                    adc,

                rsro:
                    rsro,

                temperature:
                    temperature,

                humidity:
                    humidity,

                air_quality_status:
                    air_quality_status,

                timestamp:
                    new Date().toISOString()
            }
        ]);

    if (supabaseError) {

        console.error(
            '❌ Gagal menyimpan data ke Supabase:',
            supabaseError.message
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // DATA BERHASIL DISIMPAN
    // =================================================

    lastRecordedMinute[deviceId] =
        recordKey;

    console.log('');

    console.log(
        '☁️ DATA BERHASIL DIREKAM KE SUPABASE'
    );

    console.log(
        'Waktu      :',
        time
    );

    console.log(
        'Sesi       :',
        session.name
    );

    console.log(
        'Kategori   :',
        session.category
    );

    console.log(
        'Lokasi     :',
        observationLocation.location_name
    );

    console.log(
        'Gas        :',
        gas
    );

    console.log(
        'ADC        :',
        adc
    );

    console.log(
        'Rs/Ro      :',
        rsro
    );

    console.log(
        'Suhu       :',
        temperature,
        '°C'
    );

    console.log(
        'Kelembapan :',
        humidity,
        '%'
    );

    console.log(
        'Status     :',
        air_quality_status
    );

    console.log(
        'Interval   : 1 menit'
    );

    console.log(
        '========================================'
    );
};

// =====================================================
// CEK AKHIR SESI
// =====================================================

const checkSessionEnd = () => {

    const {
        time
    } = getCurrentTime();

    for (
        const session of SESSIONS
    ) {

        if (
            time === session.end
        ) {

            const sessionKey =
                getSessionKey(session);

            const deviceId =
                RESEARCH_DEVICE_ID;

            if (
                lastNotifiedSession[
                    deviceId
                ] === sessionKey
            ) {

                continue;
            }

            const sensor =
                latestSensorData[
                    deviceId
                ];

            if (!sensor) {
                continue;
            }

            sendSessionReport(
                deviceId,
                sensor,
                session,
                sessionKey
            );
        }
    }
};

// =====================================================
// KIRIM LAPORAN SESI TELEGRAM
// =====================================================

const sendSessionReport = async (
    deviceId,
    sensor,
    session,
    sessionKey
) => {

    // =================================================
    // CEK APAKAH SESI MANUAL PERNAH AKTIF
    // =================================================

    const observationSession =
        await getObservationSession();

    if (
        !observationSession ||
        observationSession.location_code !==
            sensor.observation_location_code
    ) {

        return;
    }

    // =================================================
    // VALIDASI DHT22
    // =================================================

    if (
        !isDhtValid(
            sensor.temperature,
            sensor.humidity
        )
    ) {

        console.log(
            '⚠️ Laporan Telegram tidak dikirim karena data DHT22 tidak valid.'
        );

        return;
    }

    // =================================================
    // STATUS UDARA
    // =================================================

    const currentStatus =
        String(
            sensor.air_quality_status ||
            'TIDAK DIKETAHUI'
        )
            .trim()
            .toUpperCase();

    let statusIcon =
        '🟢';

    if (
        currentStatus.includes('BURUK') ||
        currentStatus.includes('BAHAYA') ||
        currentStatus.includes('TIDAK SEHAT') ||
        currentStatus.includes('BERBAHAYA')
    ) {

        statusIcon =
            '🔴';
    }

    // =================================================
    // ICON KATEGORI
    // =================================================

    let categoryIcon =
        '🟢';

    if (
        session.category ===
        'JAM SIBUK'
    ) {

        categoryIcon =
            '🔴';
    }

    // =================================================
    // LOKASI
    // =================================================

    const locationName =
        sensor.observation_location_name ||
        'Lokasi tidak diketahui';

    // =================================================
    // PESAN TELEGRAM
    // =================================================

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

    // =================================================
    // KIRIM TELEGRAM
    // =================================================

    try {

        await sendAlert(
            telegramMessage
        );

        // =================================================
        // KIRIM NOTIFIKASI KE DASHBOARD
        // =================================================

        if (ioInstance) {

            const notificationObject = {

                id:
                    `${Date.now()}-${deviceId}`,

                title:
                    'Laporan Kualitas Udara',

                session:
                    session.name,

                category:
                    session.category,

                location:
                    locationName,

                device_name:
                    RESEARCH_DEVICE_NAME,

                gas:
                    sensor.gas,

                adc:
                    sensor.adc,

                rsro:
                    sensor.rsro,

                temperature:
                    sensor.temperature,

                humidity:
                    sensor.humidity,

                air_quality_status:
                    currentStatus,

                timestamp:
                    new Date().toISOString()
            };

            ioInstance.emit(
                'notification',
                notificationObject
            );
        }

        // =================================================
        // LOG TELEGRAM
        // =================================================

        console.log('');

        console.log(
            '========================================'
        );

        console.log(
            '📱 TELEGRAM LAPORAN SESI TERKIRIM'
        );

        console.log(
            'Sesi:',
            session.name
        );

        console.log(
            'Waktu:',
            `${session.start} - ${session.end}`
        );

        console.log(
            'Lokasi:',
            locationName
        );

        console.log(
            'Status:',
            currentStatus
        );

        console.log(
            '========================================'
        );

        console.log('');

        lastNotifiedSession[
            deviceId
        ] = sessionKey;

    } catch (error) {

        console.error(
            '❌ Gagal mengirim laporan Telegram:',
            error.message
        );
    }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    initMqtt,
    handleSensorData,
    getMqttStatus: () => mqttStatus
};