const mysql = require('mysql2');

// =====================================================
// KONFIGURASI MYSQL DARI FILE .env
// =====================================================

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'air_quality_umkt',

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// =====================================================
// TEST KONEKSI MYSQL
// =====================================================

pool.getConnection((err, connection) => {

    if (err) {

        console.error(
            '❌ Gagal terhubung ke MySQL:',
            err.message
        );

        return;
    }

    console.log(
        '✅ Connected to MySQL database.'
    );

    console.log(
        '📦 Database:',
        process.env.DB_NAME || 'air_quality_umkt'
    );

    console.log(
        '🖥️ Host:',
        process.env.DB_HOST || 'localhost'
    );

    console.log(
        '🔌 Port:',
        process.env.DB_PORT || 3306
    );

    connection.release();

});


// =====================================================
// FUNGSI db.run()
// DIGUNAKAN UNTUK INSERT / UPDATE / DELETE
// =====================================================

const run = (sql, params, callback) => {

    // Jika parameter kedua adalah callback
    if (typeof params === 'function') {

        callback = params;
        params = [];

    }

    params = params || [];

    pool.query(
        sql,
        params,
        (err, result) => {

            if (typeof callback === 'function') {

                callback(err, result);

            }

        }
    );

};


// =====================================================
// FUNGSI db.get()
// DIGUNAKAN UNTUK MENGAMBIL 1 DATA
// =====================================================

const get = (sql, params, callback) => {

    // Jika parameter kedua adalah callback
    if (typeof params === 'function') {

        callback = params;
        params = [];

    }

    params = params || [];

    pool.query(
        sql,
        params,
        (err, rows) => {

            if (err) {

                if (typeof callback === 'function') {
                    callback(err);
                }

                return;
            }

            const row =
                rows && rows.length > 0
                    ? rows[0]
                    : undefined;

            if (typeof callback === 'function') {

                callback(
                    null,
                    row
                );

            }

        }
    );

};


// =====================================================
// FUNGSI db.all()
// DIGUNAKAN UNTUK MENGAMBIL BANYAK DATA
// =====================================================

const all = (sql, params, callback) => {

    // Jika parameter kedua adalah callback
    if (typeof params === 'function') {

        callback = params;
        params = [];

    }

    params = params || [];

    pool.query(
        sql,
        params,
        (err, rows) => {

            if (typeof callback === 'function') {

                callback(
                    err,
                    rows
                );

            }

        }
    );

};


// =====================================================
// INISIALISASI DATA DASAR
// =====================================================

const initializeDatabase = () => {

    // -------------------------------------------------
    // DEVICE AQM-01
    // -------------------------------------------------

    run(
        `
        INSERT IGNORE INTO devices
        (
            device_id,
            name,
            location,
            sensors,
            status
        )
        VALUES
        (
            'esp32-kampus',
            'AQM-01',
            'Jalan Raya dan Kampus UMKT',
            'MQ-135, DHT22',
            'offline'
        )
        `,
        (err) => {

            if (err) {

                console.error(
                    '❌ Gagal menyiapkan device AQM-01:',
                    err.message
                );

                return;
            }

            console.log(
                '✅ Data perangkat AQM-01 siap.'
            );

        }
    );


    // -------------------------------------------------
    // 4 LOKASI PENELITIAN
    // -------------------------------------------------

    const locations = [

        [
            'tanjakan-ge',
            'Tanjakan Gedung G–E',
            'KAMPUS'
        ],

        [
            'parkiran-d',
            'Parkiran Belakang Gedung D',
            'KAMPUS'
        ],

        [
            'depan-a',
            'Depan Gedung A',
            'KAMPUS'
        ],

        [
            'lembuswana',
            'Simpang 4 Lembuswana',
            'JALAN RAYA'
        ]

    ];


    locations.forEach((location) => {

        run(
            `
            INSERT IGNORE INTO observation_locations
            (
                location_code,
                location_name,
                category,
                status
            )
            VALUES (?, ?, ?, 'active')
            `,
            location,
            (err) => {

                if (err) {

                    console.error(
                        '❌ Gagal menyiapkan lokasi:',
                        location[1],
                        err.message
                    );

                    return;
                }

                console.log(
                    '📍 Lokasi siap:',
                    location[1]
                );

            }
        );

    });


    // -------------------------------------------------
    // LOKASI PENGAMATAN AKTIF
    // -------------------------------------------------

    run(
        `
        INSERT IGNORE INTO settings
        (
            \`key\`,
            \`value\`
        )
        VALUES
        (
            'current_observation_location',
            'tanjakan-ge'
        )
        `,
        (err) => {

            if (err) {

                console.error(
                    '❌ Gagal menyiapkan lokasi aktif:',
                    err.message
                );

                return;
            }

            console.log(
                '📍 Pengaturan lokasi aktif siap.'
            );

        }
    );


    // -------------------------------------------------
    // THRESHOLD AQI
    // -------------------------------------------------

    run(
        `
        INSERT IGNORE INTO settings
        (
            \`key\`,
            \`value\`
        )
        VALUES
        (
            'aqi_threshold_moderate',
            '50'
        )
        `,
        (err) => {

            if (err) {

                console.error(
                    '❌ Gagal menyiapkan threshold moderate:',
                    err.message
                );

            }

        }
    );


    run(
        `
        INSERT IGNORE INTO settings
        (
            \`key\`,
            \`value\`
        )
        VALUES
        (
            'aqi_threshold_unhealthy',
            '100'
        )
        `,
        (err) => {

            if (err) {

                console.error(
                    '❌ Gagal menyiapkan threshold unhealthy:',
                    err.message
                );

            }

        }
    );

};


// Jalankan inisialisasi
initializeDatabase();


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    run,
    get,
    all,
    pool
};