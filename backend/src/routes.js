
const express = require('express');
const db = require('./db');
const supabase = require('./supabase');
const { getMqttStatus } = require('./mqtt');

const router = express.Router();

// =====================================================
// GET ALL DEVICES (MYSQL - SEMENTARA DIPERTAHANKAN)
// =====================================================

router.get('/devices', (req, res) => {
    db.all(
        `SELECT id, device_id, name, location, sensors, status, created_at
         FROM devices
         ORDER BY name ASC`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Gagal mengambil devices:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows || []);
        }
    );
});

// =====================================================
// GET SEMUA LOKASI PENGAMATAN (MYSQL)
// =====================================================

router.get('/observation-locations', (req, res) => {
    db.all(
        `SELECT id, location_code, location_name, category, status
         FROM observation_locations
         WHERE status = 'active'
         ORDER BY id ASC`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Gagal mengambil lokasi pengamatan:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows || []);
        }
    );
});

// =====================================================
// GET LOKASI PENGAMATAN AKTIF (MYSQL)
// =====================================================

router.get('/observation-location', (req, res) => {
    db.get(
        `SELECT ol.id, ol.location_code, ol.location_name, ol.category, ol.status
         FROM observation_locations AS ol
         INNER JOIN settings AS s ON s.value = ol.location_code
         WHERE s.\`key\` = 'current_observation_location'
         LIMIT 1`,
        [],
        (err, row) => {
            if (err) {
                console.error('Gagal mengambil lokasi aktif:', err);
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.status(404).json({
                    error: 'Lokasi pengamatan aktif belum tersedia.'
                });
            }

            res.json(row);
        }
    );
});

// =====================================================
// SET LOKASI PENGAMATAN AKTIF (MYSQL)
// =====================================================

router.put('/observation-location', (req, res) => {
    const { location_code } = req.body;

    if (!location_code) {
        return res.status(400).json({
            error: 'location_code wajib diisi.'
        });
    }

    db.get(
        `SELECT location_code, location_name, category
         FROM observation_locations
         WHERE location_code = ? AND status = 'active'
         LIMIT 1`,
        [location_code],
        (err, location) => {
            if (err) {
                console.error('Gagal memeriksa lokasi:', err);
                return res.status(500).json({ error: err.message });
            }

            if (!location) {
                return res.status(404).json({
                    error: 'Lokasi pengamatan tidak ditemukan.'
                });
            }

            db.run(
                `INSERT INTO settings (\`key\`, \`value\`)
                 VALUES ('current_observation_location', ?)
                 ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
                [location_code],
                (updateErr) => {
                    if (updateErr) {
                        console.error('Gagal menyimpan lokasi aktif:', updateErr);
                        return res.status(500).json({
                            error: updateErr.message
                        });
                    }

                    res.json({
                        success: true,
                        message: 'Lokasi pengamatan berhasil disimpan.',
                        location
                    });
                }
            );
        }
    );
});

// =====================================================
// GET LATEST SENSOR DATA (MYSQL)
// =====================================================

router.get('/data/latest', (req, res) => {
    const query = `
        SELECT sd.*, d.name, d.location AS device_location
        FROM sensor_data AS sd
        INNER JOIN devices AS d ON sd.device_id = d.device_id
        WHERE sd.id IN (
            SELECT MAX(id)
            FROM sensor_data
            GROUP BY device_id
        )
        ORDER BY sd.timestamp DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Gagal mengambil data terbaru:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(rows || []);
    });
});

// =====================================================
// GET HISTORICAL DATA (MYSQL)
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
        INNER JOIN devices AS d ON sd.device_id = d.device_id
        WHERE 1 = 1
    `;

    const params = [];

    if (location) {
        query += ' AND sd.observation_location_name = ?';
        params.push(location);
    }

    if (date) {
        query += ' AND DATE(sd.timestamp) = DATE(?)';
        params.push(date);
    }

    let safeLimit = parseInt(limit, 10);

    if (Number.isNaN(safeLimit) || safeLimit <= 0) {
        safeLimit = 100;
    }

    if (safeLimit > 1000) {
        safeLimit = 1000;
    }

    query += ' ORDER BY sd.timestamp DESC LIMIT ?';
    params.push(safeLimit);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Gagal mengambil riwayat:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json((rows || []).reverse());
    });
});

// =====================================================
// GET ALERTS (MYSQL)
// =====================================================

router.get('/alerts', (req, res) => {
    db.all(
        `SELECT id, device_id, message, alert_type, resolved, timestamp
         FROM alerts
         ORDER BY id DESC
         LIMIT 20`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Gagal mengambil alerts:', err);
                return res.status(500).json({ error: err.message });
            }

            res.json(rows || []);
        }
    );
});

// =====================================================
// GET CLOUD SERVER STATUS (SUPABASE)
// =====================================================

router.get('/cloud-status', async (req, res) => {
    const mqttStatus = getMqttStatus();

    try {
        // Periksa koneksi Supabase
        const { error: databaseError } = await supabase
            .from('observation_locations')
            .select('id')
            .limit(1);

        if (databaseError) {
            console.error(
                'Gagal memeriksa Supabase:',
                databaseError.message
            );

            return res.json({
                backend: { status: 'online' },
                database: { status: 'error' },
                mqtt: { status: mqttStatus },
                sensor: { status: 'waiting' }
            });
        }

        // Ambil waktu data sensor terakhir
        const { data, error: sensorError } = await supabase
            .from('sensor_data')
            .select('timestamp')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (sensorError) {
            console.error(
                'Gagal membaca data sensor:',
                sensorError.message
            );
        }

        const lastTimestamp = data?.[0]?.timestamp ?? null;
        const lastTime = lastTimestamp
            ? new Date(lastTimestamp).getTime()
            : 0;

        const isRecent =
            lastTime > 0 &&
            Date.now() >= lastTime &&
            Date.now() - lastTime <= 5 * 60 * 1000;

        return res.json({
            backend: { status: 'online' },
            database: { status: 'connected' },
            mqtt: { status: mqttStatus },
            sensor: {
                status: !sensorError && isRecent ? 'online' : 'waiting',
                lastData: lastTimestamp
            }
        });
    } catch (err) {
        console.error('Cloud status error:', err.message);

        return res.status(500).json({
            backend: { status: 'online' },
            database: { status: 'error' },
            mqtt: { status: mqttStatus },
            sensor: { status: 'waiting' }
        });
    }
});

module.exports = router;