import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Header from "../components/Header";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
});

const Monitoring = () => {
  const [sensorData, setSensorData] = useState({});
  const [mqttStatus, setMqttStatus] = useState("connecting");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    console.log("Monitoring: menghubungkan ke backend", SOCKET_URL);

    const handleConnect = () => {
      console.log("Monitoring: Socket.IO terhubung");
    };

    const handleDisconnect = () => {
      console.log("Monitoring: Socket.IO terputus");
      setMqttStatus("disconnected");
    };

    const handleMqttStatus = (data) => {
      console.log("Monitoring: status MQTT", data);

      if (
        data?.status === "connected" ||
        data?.status === "online"
      ) {
        setMqttStatus("connected");
      } else {
        setMqttStatus("disconnected");
      }
    };

    const handleSensorData = (data) => {
      console.log("📡 Monitoring menerima data:", data);

      const deviceId =
        data?.deviceId || data?.device_id;

      if (!data || !deviceId) {
        console.warn(
          "Data sensor tidak memiliki deviceId:",
          data
        );
        return;
      }

      setMqttStatus("connected");

      setSensorData((prev) => ({
        ...prev,
        [deviceId]: {
          ...prev[deviceId],
          ...data,
          deviceId,
        },
      }));

      setLastUpdate(
        data.timestamp || new Date().toISOString()
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("mqtt_status", handleMqttStatus);
    socket.on("sensor_data", handleSensorData);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("mqtt_status", handleMqttStatus);
      socket.off("sensor_data", handleSensorData);
    };
  }, []);

  const kampus = sensorData["esp32-kampus"];
  const lembuswana = sensorData["esp32-lembuswana"];

  const formatNumber = (value, digits = 1) => {
    if (
      value === null ||
      value === undefined ||
      Number.isNaN(Number(value))
    ) {
      return "--";
    }

    return Number(value).toFixed(digits);
  };

  const formatTime = (value) => {
    if (!value) return "--:--:--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "--:--:--";
    }

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "BAIK":
        return "bg-green-100 text-green-700";

      case "SEDANG":
        return "bg-yellow-100 text-yellow-700";

      case "TIDAK SEHAT":
        return "bg-orange-100 text-orange-700";

      case "BAHAYA":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  const SensorCard = ({
    title,
    location,
    device,
    data,
  }) => {
    const status =
      data?.air_quality_status || "MENUNGGU DATA";

    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold text-gray-800">
              {title}
            </h4>

            <p className="text-sm text-gray-500 mt-1">
              📍 {location}
            </p>

            <p className="text-xs text-gray-400 mt-1">
              Perangkat: {device}
            </p>
          </div>

          <div
            className={`px-3 py-2 rounded-full text-xs font-bold ${getStatusStyle(
              status
            )}`}
          >
            ● {status}
          </div>
        </div>

        {/* STATUS DATA */}
        <div
          className={`mb-5 px-4 py-3 rounded-xl ${
            data
              ? "bg-green-50 border border-green-100"
              : "bg-gray-50 border border-gray-100"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Status perangkat
            </span>

            <span
              className={`text-sm font-bold ${
                data
                  ? "text-green-600"
                  : "text-gray-400"
              }`}
            >
              {data
                ? "● DATA MASUK"
                : "● MENUNGGU DATA"}
            </span>
          </div>
        </div>

        {/* DATA SENSOR */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* GAS */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              GAS MQ-135
            </p>

            <p className="text-2xl font-bold text-gray-800">
              {formatNumber(data?.gas, 0)}
            </p>

            <p className="text-xs text-gray-400 mt-1">
              PPM
            </p>
          </div>

          {/* ADC */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              ADC
            </p>

            <p className="text-2xl font-bold text-gray-800">
              {formatNumber(data?.adc, 0)}
            </p>
          </div>

          {/* RS/RO */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              RS / RO
            </p>

            <p className="text-2xl font-bold text-gray-800">
              {formatNumber(data?.rsro, 1)}
            </p>
          </div>

          {/* SUHU */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              SUHU
            </p>

            <p className="text-2xl font-bold text-gray-800">
              {formatNumber(data?.temperature, 1)}
              {data?.temperature !== null &&
              data?.temperature !== undefined
                ? " °C"
                : ""}
            </p>
          </div>

          {/* KELEMBAPAN */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              KELEMBAPAN
            </p>

            <p className="text-2xl font-bold text-gray-800">
              {formatNumber(data?.humidity, 1)}
              {data?.humidity !== null &&
              data?.humidity !== undefined
                ? " %"
                : ""}
            </p>
          </div>

          {/* STATUS */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">
              STATUS UDARA
            </p>

            <p className="text-lg font-bold text-gray-800">
              {status}
            </p>
          </div>
        </div>

        {/* UPDATE */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
          <span>Update data</span>

          <span>
            {formatTime(data?.timestamp)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header
        mqttStatus={
          mqttStatus === "connected"
            ? "connected"
            : "disconnected"
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">

        {/* TITLE */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-800">
            Monitoring Detail
          </h3>

          <p className="text-gray-500 mt-1">
            Pemantauan data sensor kualitas udara
            secara real-time dari setiap lokasi.
          </p>
        </div>

        {/* CONNECTION STATUS */}
        <div className="mb-6 flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4 border border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Koneksi Sistem
            </p>

            <p className="text-xs text-gray-400 mt-1">
              MQTT → Backend → Socket.IO → Monitoring
            </p>
          </div>

          <div
            className={`px-4 py-2 rounded-full text-sm font-bold ${
              mqttStatus === "connected"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            ●{" "}
            {mqttStatus === "connected"
              ? "Terhubung"
              : "Terputus"}
          </div>
        </div>

        {/* SENSOR KAMPUS */}
        <div className="mb-6">
          <SensorCard
            title="AQM Kampus"
            location="Kampus UMKT"
            device="esp32-kampus"
            data={kampus}
          />
        </div>

        {/* SENSOR LEMBUSWANA */}
        <div className="mb-6">
          <SensorCard
            title="AQM Lembuswana"
            location="Simpang 4 Lembuswana"
            device="esp32-lembuswana"
            data={lembuswana}
          />
        </div>

        {/* INFORMASI UPDATE */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Update Terakhir
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Data sensor terakhir yang diterima
                oleh halaman monitoring
              </p>
            </div>

            <p className="text-sm font-bold text-gray-700">
              {formatTime(lastUpdate)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Monitoring;