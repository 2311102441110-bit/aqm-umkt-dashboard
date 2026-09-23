const { handleSensorData } = require('./mqtt');

let dummyInterval = null;

const startDummyData = () => {
    if (dummyInterval) return;
    console.log('Starting dummy data generation...');

    dummyInterval = setInterval(() => {
        // Generate for Juanda
        const juandaData = generateRandomData(70, 90, 45, 60);
        handleSensorData('esp32-juanda', juandaData);

        // Generate for Kampus
        setTimeout(() => {
            const kampusData = generateRandomData(20, 45, 10, 30);
            handleSensorData('esp32-kampus', kampusData);
        }, 1000); // offset slightly

    }, 5000); // every 5 seconds
};

const stopDummyData = () => {
    if (dummyInterval) {
        clearInterval(dummyInterval);
        dummyInterval = null;
        console.log('Dummy data generation stopped.');
    }
};

const generateRandomData = (aqiMin, aqiMax, pm25Min, pm25Max) => {
    const aqi = Math.floor(Math.random() * (aqiMax - aqiMin + 1)) + aqiMin;
    let status = 'Baik';
    if (aqi > 50) status = 'Sedang';
    if (aqi > 100) status = 'Tidak Sehat';

    return {
        pm25: (Math.random() * (pm25Max - pm25Min) + pm25Min).toFixed(1),
        pm10: (Math.random() * 20 + pm25Max).toFixed(1),
        co: (Math.random() * 2 + 1).toFixed(1),
        co2: Math.floor(Math.random() * 100 + 400),
        temperature: (Math.random() * 5 + 28).toFixed(1),
        humidity: Math.floor(Math.random() * 20 + 60),
        aqi: aqi,
        air_quality_status: status
    };
};

module.exports = { startDummyData, stopDummyData };
