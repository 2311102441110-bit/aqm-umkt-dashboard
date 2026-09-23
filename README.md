# AQM UMKT Dashboard

Sistem Monitoring Kualitas Udara Real-Time Berbasis MQTT dan Web Dashboard.

## Fitur Utama
- **Real-Time Data**: Menggunakan MQTT (Mosquitto) dan WebSocket (Socket.io) untuk menampilkan data tanpa perlu me-refresh halaman.
- **Scalable**: Struktur backend dan database disiapkan agar penambahan perangkat (ESP32) baru dapat dilakukan dengan mudah.
- **Telegram Bot**: Otomatis mengirim peringatan ketika kualitas udara memburuk (AQI > 100).
- **Modern UI**: Dibangun menggunakan React + Vite + Tailwind CSS mengikuti desain referensi.
- **Dummy Data**: Mendukung data simulasi (Dummy Data) untuk pengujian sistem tanpa ESP32.

## Struktur Proyek
- `/backend`: Node.js, Express, SQLite, MQTT.js, Socket.io, Telegram Bot API
- `/frontend`: React.js, Vite, Tailwind CSS, Recharts

## Persyaratan Sistem
- Node.js (v16+)
- Mosquitto MQTT Broker (Berjalan di port 1883)

## Cara Menjalankan

### 1. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
```
Sesuaikan konfigurasi pada file `.env` (Telegram Bot Token, dll).

Jalankan backend:
```bash
npm run dev
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
Akses dashboard di `http://localhost:3000`.

## Konfigurasi MQTT
Broker MQTT default berjalan di `localhost:1883`.
Topik MQTT:
- `umkt/air/juanda`
- `umkt/air/kampus`

Contoh payload JSON yang dikirimkan ESP32 dapat dilihat pada file `mqtt_payload_example.json`.
