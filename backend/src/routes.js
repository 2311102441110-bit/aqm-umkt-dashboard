const express = require('express');
const db = require('./db');

const router = express.Router();


// =====================================================
// GET ALL DEVICES
// =====================================================

router.get('/devices', (req, res) => {

    db.all(
        `
        SELECT
            id,
            device_id,
            name,
            location,
            sensors,
            status,
            created_at
        FROM devices
        ORDER BY name ASC
        `,
        [],
        (err, rows) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil devices:',
                    err
                );

                return res.status(500).json({
                    error: err.message || String(err)
                });
            }

            res.json(rows || []);
        }
    );
});


// =====================================================
// GET SEMUA LOKASI PENGAMATAN
// =====================================================

router.get('/observation-locations', (req, res) => {

    db.all(
        `
        SELECT
            id,
            location_code,
            location_name,
            category,
            status
        FROM observation_locations
        WHERE status = 'active'
        ORDER BY id ASC
        `,
        [],
        (err, rows) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil lokasi pengamatan:',
                    err
                );

                return res.status(500).json({
                    error: err.message || String(err)
                });
            }

            console.log(
                '📍 Daftar lokasi pengamatan:',
                rows
            );

            res.json(rows || []);
        }
    );
});


// =====================================================
// GET LOKASI PENGAMATAN AKTIF
// =====================================================

router.get('/observation-location', (req, res) => {

    db.get(
        `
        SELECT
            ol.id,
            ol.location_code,
            ol.location_name,
            ol.category,
            ol.status
        FROM observation_locations AS ol
        INNER JOIN settings AS s
            ON s.value = ol.location_code
        WHERE s.\`key\` = 'current_observation_location'
        LIMIT 1
        `,
        [],
        (err, row) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil lokasi aktif:',
                    err
                );

                return res.status(500).json({
                    error: err.message || String(err)
                });
            }

            if (!row) {

                console.log(
                    '⚠️ Lokasi aktif belum ditemukan.'
                );

                return res.status(404).json({
                    error:
                        'Lokasi pengamatan aktif belum tersedia.'
                });
            }

            console.log(
                '📍 Lokasi aktif:',
                row
            );

            res.json(row);
        }
    );
});


// =====================================================
// SET LOKASI PENGAMATAN AKTIF
// =====================================================

router.put('/observation-location', (req, res) => {

    const {
        location_code
    } = req.body;


    if (!location_code) {

        return res.status(400).json({
            error:
                'location_code wajib diisi.'
        });
    }


    // ---------------------------------------------
    // Cek apakah lokasi tersedia
    // ---------------------------------------------

    db.get(
        `
        SELECT
            location_code,
            location_name,
            category
        FROM observation_locations
        WHERE location_code = ?
          AND status = 'active'
        LIMIT 1
        `,
        [location_code],
        (err, location) => {

            if (err) {

                console.error(
                    '❌ Gagal memeriksa lokasi:',
                    err
                );

                return res.status(500).json({
                    error:
                        err.message ||
                        String(err)
                });
            }


            if (!location) {

                return res.status(404).json({
                    error:
                        'Lokasi pengamatan tidak ditemukan.'
                });
            }


            // -----------------------------------------
            // MySQL / MariaDB
            // -----------------------------------------

            db.run(
                `
                INSERT INTO settings
                (\`key\`, \`value\`)
                VALUES
                ('current_observation_location', ?)
                ON DUPLICATE KEY UPDATE
                    \`value\` = VALUES(\`value\`)
                `,
                [location_code],
                (updateErr) => {

                    if (updateErr) {

                        console.error(
                            '❌ Gagal menyimpan lokasi aktif:',
                            updateErr
                        );

                        return res.status(500).json({
                            error:
                                updateErr.message ||
                                String(updateErr)
                        });
                    }


                    console.log('');
                    console.log(
                        '📍 LOKASI PENGAMATAN DIUBAH'
                    );
                    console.log(
                        'Kode     :',
                        location.location_code
                    );
                    console.log(
                        'Lokasi   :',
                        location.location_name
                    );
                    console.log(
                        'Kategori :',
                        location.category
                    );
                    console.log('');


                    res.json({

                        success: true,

                        message:
                            'Lokasi pengamatan berhasil disimpan.',

                        location:
                            location

                    });
                }
            );
        }
    );
});


// =====================================================
// GET LATEST SENSOR DATA
// =====================================================

router.get('/data/latest', (req, res) => {

    const query = `
        SELECT
            sd.*,
            d.name,
            d.location AS device_location
        FROM sensor_data AS sd
        INNER JOIN devices AS d
            ON sd.device_id = d.device_id
        WHERE sd.id IN (
            SELECT MAX(id)
            FROM sensor_data
            GROUP BY device_id
        )
        ORDER BY sd.timestamp DESC
    `;


    db.all(
        query,
        [],
        (err, rows) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil data terbaru:',
                    err
                );

                return res.status(500).json({
                    error:
                        err.message ||
                        String(err)
                });
            }

            res.json(rows || []);
        }
    );
});


// =====================================================
// GET HISTORICAL DATA
// =====================================================

router.get('/data/history', (req, res) => {

    const {
        limit = 100,
        location = '',
        date = ''
    } = req.query;


    let query = `
        SELECT
            sd.id,
            sd.device_id,
            d.name,

            sd.observation_location_code,
            sd.observation_location_name,

            d.location AS device_location,

            sd.gas,
            sd.adc,
            sd.rsro,

            sd.temperature,
            sd.humidity,

            sd.air_quality_status,

            sd.timestamp

        FROM sensor_data AS sd

        INNER JOIN devices AS d
            ON sd.device_id = d.device_id

        WHERE 1 = 1
    `;


    const params = [];


    // ---------------------------------------------
    // FILTER LOKASI
    // ---------------------------------------------

    if (location) {

        query += `
            AND sd.observation_location_name = ?
        `;

        params.push(
            location
        );
    }


    // ---------------------------------------------
    // FILTER TANGGAL
    // ---------------------------------------------

    if (date) {

        query += `
            AND DATE(sd.timestamp) = DATE(?)
        `;

        params.push(
            date
        );
    }


    // ---------------------------------------------
    // LIMIT
    // ---------------------------------------------

    query += `
        ORDER BY sd.timestamp DESC
        LIMIT ?
    `;


    let safeLimit =
        parseInt(
            limit,
            10
        );


    if (
        Number.isNaN(safeLimit) ||
        safeLimit <= 0
    ) {

        safeLimit = 100;
    }


    if (safeLimit > 1000) {

        safeLimit = 1000;
    }


    params.push(
        safeLimit
    );


    db.all(
        query,
        params,
        (err, rows) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil riwayat:',
                    err
                );

                return res.status(500).json({
                    error:
                        err.message ||
                        String(err)
                });
            }


            const result =
                rows || [];


            // Data dikembalikan dari lama
            // ke terbaru

            res.json(
                result.reverse()
            );
        }
    );
});


// =====================================================
// GET ALERTS
// =====================================================

router.get('/alerts', (req, res) => {

    db.all(
        `
        SELECT
            id,
            device_id,
            message,
            alert_type,
            resolved,
            timestamp
        FROM alerts
        ORDER BY id DESC
        LIMIT 20
        `,
        [],
        (err, rows) => {

            if (err) {

                console.error(
                    '❌ Gagal mengambil alerts:',
                    err
                );

                return res.status(500).json({
                    error:
                        err.message ||
                        String(err)
                });
            }

            res.json(
                rows || []
            );
        }
    );
});


// =====================================================
// EXPORT
// =====================================================

module.exports = router;