const mqtt = require('mqtt');
const db = require('./db');
const { sendAlert } = require('./telegram');

let mqttClient;
let ioInstance;

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
        start: '16:00',
        end: '17:00'
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
// MENCARI SESI AKTIF
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
// MEMBUAT ID SESI
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

const getActiveObservationLocation = () => {
    return new Promise((resolve) => {

        db.get(
            `
            SELECT
                ol.location_code,
                ol.location_name,
                ol.category
            FROM observation_locations ol
            INNER JOIN settings s
                ON s.value = ol.location_code
            WHERE s.\`key\` = 'current_observation_location'
            LIMIT 1
            `,
            [],
            (err, row) => {

                if (err) {

                    console.error(
                        'Gagal mengambil lokasi pengamatan:',
                        err.message
                    );

                    resolve({
                        location_code: 'tanjakan-ge',
                        location_name: 'Tanjakan Gedung G–E',
                        category: 'KAMPUS'
                    });

                    return;
                }

                if (!row) {

                    resolve({
                        location_code: 'tanjakan-ge',
                        location_name: 'Tanjakan Gedung G–E',
                        category: 'KAMPUS'
                    });

                    return;
                }

                resolve(row);
            }
        );

    });
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
        (topic, message) => {

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

                getActiveObservationLocation()
                    .then(
                        (location) => {

                            handleSensorData(
                                RESEARCH_DEVICE_ID,
                                data,
                                location
                            );

                        }
                    )
                    .catch(
                        (error) => {

                            console.error(
                                'Gagal menentukan lokasi:',
                                error.message
                            );

                        }
                    );

            } catch (error) {

                console.error(
                    'Error parsing MQTT message:',
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

const handleSensorData = (
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

    const session =
        getCurrentSession();

    // =================================================
    // LOKASI PENGAMATAN
    // =================================================

    const observationLocation =
        location || {
            location_code: 'tanjakan-ge',
            location_name: 'Tanjakan Gedung G–E',
            category: 'KAMPUS'
        };

    // =================================================
    // DATA TERBARU
    // =================================================

    latestSensorData[deviceId] = {

        deviceId,

        deviceName:
            RESEARCH_DEVICE_NAME,

        observation_location_code:
            observationLocation.location_code,

        observation_location_name:
            observationLocation.location_name,

        observation_location_category:
            observationLocation.category,

        gas,
        adc,
        rsro,
        temperature,
        humidity,
        air_quality_status,

        timestamp:
            new Date().toISOString()
    };

    // =================================================
    // KIRIM REALTIME KE DASHBOARD
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
    // DI LUAR JADWAL PENELITIAN
    // =================================================

    if (!session) {

        console.log(
            'Di luar jadwal pengamatan. Data tidak direkam.'
        );

        console.log(
            '========================================'
        );

        return;
    }

    // =================================================
    // SESI AKTIF
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

        console.log('');
    }

    // =================================================
    // REKAM DATABASE 1 KALI SETIAP MENIT
    // =================================================

    const recordKey =
        `${deviceId}_` +
        `${observationLocation.location_code}_` +
        `${minuteKey}`;

    if (
        lastRecordedMinute[deviceId] !==
        recordKey
    ) {

        db.run(
            `
            INSERT INTO sensor_data
            (
                device_id,
                gas,
                adc,
                rsro,
                temperature,
                humidity,
                air_quality_status,
                observation_location_code,
                observation_location_name
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                deviceId,
                gas,
                adc,
                rsro,
                temperature,
                humidity,
                air_quality_status,
                observationLocation.location_code,
                observationLocation.location_name
            ],
            function (err) {

                if (err) {

                    console.error(
                        'Gagal menyimpan data sensor:',
                        err.message
                    );

                    return;
                }

                console.log('');
                console.log(
                    '💾 DATA BERHASIL DIREKAM KE MYSQL'
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
                    'Interval   : 1 menit'
                );

                console.log('');
            }
        );

        lastRecordedMinute[deviceId] =
            recordKey;

    } else {

        console.log(
            'Data sudah direkam untuk menit ini.'
        );
    }

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
    handleSensorData
};