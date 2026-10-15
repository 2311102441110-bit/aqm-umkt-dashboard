
const express = require('express');
const supabase = require('./supabase');
const { getMqttStatus } = require('./mqtt');

const router = express.Router();

const DEVICE_ID = 'esp32-kampus';
const DEVICE_NAME = 'AQM-01';

// =====================================================
// GET DEVICES
// =====================================================

router.get('/devices', (req, res) => {
    return res.json([
        {
            device_id: DEVICE_ID,
            name: DEVICE_NAME,
            location: 'Jalan Raya dan Kampus UMKT',
            sensors: 'MQ-135, DHT22',
            status: 'online'
        }
    ]);
});

// =====================================================
// GET ALL OBSERVATION LOCATIONS
// =====================================================

router.get('/observation-locations', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('observation_locations')
            .select('id, location_code, location_name, category, is_active')
            .order('id', { ascending: true });

        if (error) throw error;

        return res.json(
            (data || []).map((location) => ({
                ...location,
                status: 'active'
            }))
        );
    } catch (err) {
        console.error('Gagal mengambil lokasi:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =====================================================
// GET ACTIVE OBSERVATION LOCATION
// =====================================================

router.get('/observation-location', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('observation_locations')
            .select('id, location_code, location_name, category, is_active')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                error: 'Lokasi pengamatan aktif belum tersedia.'
            });
        }

        return res.json({ ...data, status: 'active' });
    } catch (err) {
        console.error('Gagal mengambil lokasi aktif:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =====================================================
// SET ACTIVE OBSERVATION LOCATION
// =====================================================

router.put('/observation-location', async (req, res) => {
    const { location_code } = req.body;

    if (!location_code) {
        return res.status(400).json({
            error: 'location_code wajib diisi.'
        });
    }

    try {
        const { data: location, error: locationError } = await supabase
            .from('observation_locations')
            .select('id, location_code, location_name, category')
            .eq('location_code', location_code)
            .maybeSingle();

        if (locationError) throw locationError;

        if (!location) {
            return res.status(404).json({
                error: 'Lokasi pengamatan tidak ditemukan.'
            });
        }

        // Nonaktifkan lokasi yang sebelumnya aktif.
        const { error: deactivateError } = await supabase
            .from('observation_locations')
            .update({ is_active: false })
            .not('id', 'is', null);

        if (deactivateError) throw deactivateError;

        // Aktifkan lokasi yang dipilih.
        const { data: updatedLocation, error: activateError } =
            await supabase
                .from('observation_locations')
                .update({ is_active: true })
                .eq('id', location.id)
                .select()
                .single();

        if (activateError) throw activateError;

        console.log(
            'Lokasi pengamatan diubah:',
            updatedLocation.location_name
        );

        return res.json({
            success: true,
            message: 'Lokasi pengamatan berhasil disimpan.',
            location: { ...updatedLocation, status: 'active' }
        });
    } catch (err) {
        console.error('Gagal mengubah lokasi aktif:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =====================================================
// GET LATEST SENSOR DATA
// =====================================================

router.get('/data/latest', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .eq('device_id', DEVICE_ID)
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) throw error;

        const rows = (data || []).map((item) => ({
            ...item,
            name: DEVICE_NAME,
            device_location: item.location
        }));

        return res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil data terbaru:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =====================================================
// GET HISTORICAL SENSOR DATA
// =====================================================

router.get('/data/history', async (req, res) => {
    const {
        limit = 100,
        location = '',
        date = ''
    } = req.query;

    let safeLimit = parseInt(limit, 10);

    if (!Number.isFinite(safeLimit) || safeLimit <= 0) {
        safeLimit = 100;
    }

    safeLimit = Math.min(safeLimit, 1000);

    try {
        let query = supabase
            .from('sensor_data')
            .select('*')
            .eq('device_id', DEVICE_ID)
            .order('timestamp', { ascending: false })
            .limit(safeLimit);

        if (location) {
            query = query.eq('location', location);
        }

        if (date) {
            const startDate = new Date(`${date}T00:00:00`);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);

            query = query
                .gte('timestamp', startDate.toISOString())
                .lt('timestamp', endDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;

        const { data: locations, error: locationsError } = await supabase
            .from('observation_locations')
            .select('location_code, location_name');

        if (locationsError) throw locationsError;

        const locationMap = new Map(
            (locations || []).map((item) => [
                item.location_name,
                item.location_code
            ])
        );

        const rows = (data || []).map((item) => ({
            ...item,
            name: DEVICE_NAME,
            device_location: item.location,
            observation_location_code:
                locationMap.get(item.location) || null,
            observation_location_name: item.location
        }));

        return res.json(rows.reverse());
    } catch (err) {
        console.error('Gagal mengambil riwayat:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// =====================================================
// GET ALERTS
// TABEL alerts BELUM ADA DI SUPABASE
// =====================================================

router.get('/alerts', (req, res) => {
    return res.json([]);
});

// =====================================================
// GET CLOUD STATUS
// =====================================================

router.get('/cloud-status', async (req, res) => {
    const mqttStatus = getMqttStatus();

    try {
        const { error: databaseError } = await supabase
            .from('observation_locations')
            .select('id')
            .limit(1);

        if (databaseError) throw databaseError;

        const { data, error: sensorError } = await supabase
            .from('sensor_data')
            .select('timestamp')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (sensorError) throw sensorError;

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
                status: isRecent ? 'online' : 'waiting',
                lastData: lastTimestamp
            }
        });
    } catch (err) {
        console.error('Cloud status error:', err.message);

        return res.status(200).json({
            backend: { status: 'online' },
            database: { status: 'error' },
            mqtt: { status: mqttStatus },
            sensor: { status: 'waiting' }
        });
    }
});

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;
