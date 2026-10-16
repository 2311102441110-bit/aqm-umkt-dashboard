require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const routes = require('./routes');
const { initMqtt } = require('./mqtt');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow frontend connection
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());
app.use('/api', routes);

// WebSocket connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Initialize MQTT
initMqtt(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
