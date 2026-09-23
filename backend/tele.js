require('dotenv').config();
const { sendAlert } = require('./src/telegram'); // Sesuaikan path jika perlu

// Coba kirim pesan uji coba
sendAlert('Halo! Ini adalah uji coba pesan dari sistem AQM Lembuswana.');