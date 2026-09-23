-- backend/schema.sql

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    sensors TEXT NOT NULL, -- JSON array of sensors
    status TEXT DEFAULT 'offline',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    pm25 REAL,
    pm10 REAL,
    co REAL,
    co2 REAL,
    temperature REAL,
    humidity REAL,
    aqi INTEGER,
    air_quality_status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices (device_id)
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices (device_id)
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL
);

-- Insert initial locations
-- Insert initial locations
INSERT OR IGNORE INTO devices (device_id, name, location, sensors, status) 
VALUES 
('esp32-lembuswana', 'AQM Lembuswana', 'Kawasan Lembuswana', '["pm2.5","pm10","co","co2","temperature","humidity"]', 'online'),
('esp32-kampus', 'AQM Kampus', 'Kampus UMKT', '["pm2.5","pm10","co","co2","temperature","humidity"]', 'online');

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('aqi_threshold_moderate', '50');
INSERT OR IGNORE INTO settings (key, value) VALUES ('aqi_threshold_unhealthy', '100');
