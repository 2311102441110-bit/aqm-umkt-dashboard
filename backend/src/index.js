
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Routes API yang sudah digunakan sistem AQM UMKT
const routes = require('./routes');

// Sistem MQTT AQM UMKT
const {
    initMqtt,
    getMqttStatus
} = require('./mqtt');

const app = express();

// Middleware Express
app.use(cors());
app.use(express.json());

// Pertahankan route API lama
app.use('/api', routes);

// HTTP Server
const server = http.createServer(app);

// Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

// Koneksi Socket.IO dan komunikasi status MQTT
io.on('connection', (socket) => {
    console.log('Client Socket.IO terhubung:', socket.id);

    // Kirim status MQTT terkini saat client terhubung
    socket.emit('mqtt_status', {
        status: getMqttStatus()
    });

    // Client meminta status MQTT terbaru
    socket.on('request_mqtt_status', () => {
        console.log('Client meminta status MQTT:', socket.id);

        socket.emit('mqtt_status', {
            status: getMqttStatus()
        });
    });

    // Client terputus
    socket.on('disconnect', (reason) => {
        console.log('Client Socket.IO terputus:', socket.id, reason);
    });
});

// Inisialisasi MQTT menggunakan instance Socket.IO yang sama
initMqtt(io);

// Endpoint pemeriksaan backend
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'AQM UMKT Dashboard',
        mqtt: getMqttStatus()
    });
});

// Jalankan server
const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend AQM UMKT berjalan pada port ${PORT}`);
    console.log('Socket.IO siap menerima koneksi dashboard');
});