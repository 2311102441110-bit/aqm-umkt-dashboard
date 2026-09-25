import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_API_URL || "https://aqm-umkt-dashboard-production.up.railway.app";

const API_URL =
  import.meta.env.VITE_API_URL || "https://aqm-umkt-dashboard-production.up.railway.app";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
});

// =====================================================
// HELPER
// =====================================================

const formatNumber = (value, digits = 1) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
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

const getStatusClass = (status) => {
  const value = String(status || "").toUpperCase();

  if (value === "BAIK") {
    return "status-good";
  }

  if (value === "SEDANG") {
    return "status-moderate";
  }

  if (
    value.includes("TIDAK SEHAT") ||
    value.includes("KURANG BAIK")
  ) {
    return "status-unhealthy";
  }

  if (
    value.includes("BAHAYA") ||
    value.includes("BERBAHAYA")
  ) {
    return "status-danger";
  }

  return "status-unknown";
};

const getNotificationClass = (status) => {
  const value = String(status || "").toUpperCase();

  if (value === "BAIK") {
    return "notification-good";
  }

  if (value === "SEDANG") {
    return "notification-warning";
  }

  if (
    value.includes("TIDAK SEHAT") ||
    value.includes("BAHAYA") ||
    value.includes("BERBAHAYA")
  ) {
    return "notification-danger";
  }

  return "notification-neutral";
};

// =====================================================
// ICON
// =====================================================

const Icon = ({ type, size = 24 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "gas") {
    return (
      <svg {...common}>
        <path d="M12 3c2 3 5 5 5 9a5 5 0 1 1-10 0c0-2.5 1.5-4.5 3.5-6.5" />
        <path d="M12 12c.8 1.1 1.8 2 1.8 3.2a1.8 1.8 0 1 1-3.6 0c0-.9.7-2 1.8-3.2Z" />
      </svg>
    );
  }

  if (type === "activity") {
    return (
      <svg {...common}>
        <polyline points="3 12 7 12 9.5 5 14 19 16.5 12 21 12" />
      </svg>
    );
  }

  if (type === "thermometer") {
    return (
      <svg {...common}>
        <path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0Z" />
        <line x1="12" y1="9" x2="12" y2="16" />
      </svg>
    );
  }

  if (type === "humidity") {
    return (
      <svg {...common}>
        <path d="M12 3.5s6 6.1 6 11a6 6 0 0 1-12 0c0-4.9 6-11 6-11Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
};

// =====================================================
// DASHBOARD
// =====================================================

export default function Dashboard() {
  const [sensorData, setSensorData] = useState(null);

  const [mqttStatus, setMqttStatus] =
    useState("connecting");

  const [lastUpdate, setLastUpdate] =
    useState(null);

  const [activeLocation, setActiveLocation] =
    useState(null);

  const [chartData, setChartData] =
    useState([]);

  // ===================================================
  // NOTIFIKASI
  // ===================================================

  const [notifications, setNotifications] =
    useState(() => {
      try {
        const saved = localStorage.getItem(
          "air_quality_notifications"
        );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch (error) {
        console.error(
          "Gagal membaca notifikasi:",
          error
        );

        return [];
      }
    });

  useEffect(() => {
    localStorage.setItem(
      "air_quality_notifications",
      JSON.stringify(notifications)
    );
  }, [notifications]);

  // ===================================================
  // AMBIL LOKASI AKTIF
  // ===================================================

  useEffect(() => {
    const loadActiveLocation = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/observation-location`
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setActiveLocation(data);
      } catch (error) {
        console.error(
          "Gagal mengambil lokasi aktif:",
          error
        );
      }
    };

    loadActiveLocation();
  }, []);

  // ===================================================
  // SOCKET.IO
  // ===================================================

  useEffect(() => {
    console.log(
      "Menghubungkan Dashboard ke:",
      SOCKET_URL
    );

    const handleConnect = () => {
      console.log(
        "✅ Socket.IO Dashboard terhubung"
      );
    };

    const handleDisconnect = () => {
      console.log(
        "❌ Socket.IO Dashboard terputus"
      );
    };

    const handleMqttStatus = (data) => {
      console.log(
        "Status MQTT:",
        data
      );

      if (
        data?.status === "connected" ||
        data?.status === "online"
      ) {
        setMqttStatus("connected");
      } else {
        setMqttStatus("disconnected");
      }
    };

    // =================================================
    // DATA SENSOR
    // =================================================

    const handleSensorData = (data) => {
      console.log(
        "🔥 DATA SENSOR DASHBOARD:",
        data
      );

      if (!data) {
        return;
      }

      setMqttStatus("connected");

      const deviceId =
        data.deviceId ||
        data.device_id;

      if (!deviceId) {
        console.warn(
          "Data tidak memiliki deviceId:",
          data
        );

        return;
      }

      // -----------------------------------------------
      // SIMPAN DATA SENSOR
      // -----------------------------------------------

      setSensorData({
        ...data,
        deviceId,
        deviceName:
          data.deviceName ||
          data.device_name ||
          "AQM-01",
      });

      // -----------------------------------------------
      // LOKASI DARI BACKEND
      // -----------------------------------------------

      if (
        data.observation_location_name
      ) {
        setActiveLocation({
          location_code:
            data.observation_location_code,

          location_name:
            data.observation_location_name,

          category:
            data.observation_location_category,
        });
      }

      // -----------------------------------------------
      // UPDATE WAKTU
      // -----------------------------------------------

      const timestamp =
        data.timestamp ||
        new Date().toISOString();

      setLastUpdate(timestamp);

      // -----------------------------------------------
      // DATA GRAFIK
      // -----------------------------------------------

      const point = {
        time: formatTime(timestamp),

        gas:
          Number(data.gas) || 0,

        location:
          data.observation_location_name ||
          activeLocation?.location_name ||
          "Lokasi aktif",
      };

      setChartData((prev) => [
        ...prev,
        point,
      ].slice(-30));

      console.log(
        "✅ DATA SENSOR BERHASIL:",
        {
          deviceId,
          lokasi:
            data.observation_location_name,
          gas: data.gas,
          adc: data.adc,
          rsro: data.rsro,
          temperature:
            data.temperature,
          humidity:
            data.humidity,
          status:
            data.air_quality_status,
        }
      );
    };

    // =================================================
    // NOTIFIKASI
    // =================================================

    const handleNotification = (data) => {
      console.log(
        "🔔 NOTIFIKASI:",
        data
      );

      if (!data) {
        return;
      }

      const notification = {
        id:
          data.id ||
          `${Date.now()}-${Math.random()}`,

        title:
          data.title ||
          "Laporan Kualitas Udara",

        session:
          data.session ||
          "Pengamatan Kualitas Udara",

        category:
          data.category ||
          "",

        location:
          data.location ||
          "Tidak diketahui",

        device_name:
          data.device_name ||
          "AQM-01",

        gas:
          data.gas ?? "--",

        adc:
          data.adc ?? "--",

        rsro:
          data.rsro ?? "--",

        temperature:
          data.temperature ?? "--",

        humidity:
          data.humidity ?? "--",

        air_quality_status:
          data.air_quality_status ||
          data.status ||
          "MENUNGGU DATA",

        timestamp:
          data.timestamp ||
          new Date().toISOString(),
      };

      setNotifications((prev) => [
        notification,
        ...prev,
      ].slice(0, 20));
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "mqtt_status",
      handleMqttStatus
    );

    socket.on(
      "sensor_data",
      handleSensorData
    );

    socket.on(
      "notification",
      handleNotification
    );

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "mqtt_status",
        handleMqttStatus
      );

      socket.off(
        "sensor_data",
        handleSensorData
      );

      socket.off(
        "notification",
        handleNotification
      );
    };
  }, []);

  // ===================================================
  // DATA UTAMA
  // ===================================================

  const currentData =
    sensorData;

  const currentStatus =
    currentData?.air_quality_status ||
    "MENUNGGU DATA";

  const deviceName =
    currentData?.deviceName ||
    "AQM-01";

  const locationName =
    currentData?.observation_location_name ||
    activeLocation?.location_name ||
    "Belum ada lokasi";

  const locationCategory =
    currentData?.observation_location_category ||
    activeLocation?.category ||
    "";

  const mqttConnected =
    mqttStatus === "connected" ||
    mqttStatus === "online";

  // ===================================================
  // GRAFIK
  // ===================================================

  const chartWidth = 800;
  const chartHeight = 260;
  const chartPadding = 35;

  const chartMax = Math.max(
    100,
    ...chartData.map(
      (item) =>
        Number(item.gas) || 0
    )
  );

  const getX = (index) => {
    if (chartData.length <= 1) {
      return chartWidth / 2;
    }

    const usableWidth =
      chartWidth -
      chartPadding * 2;

    return (
      chartPadding +
      (index /
        (chartData.length - 1)) *
        usableWidth
    );
  };

  const getY = (value) => {
    const usableHeight =
      chartHeight -
      chartPadding * 2;

    return (
      chartHeight -
      chartPadding -
      ((value) /
        (chartMax || 1)) *
        usableHeight
    );
  };

  const polylinePoints =
    chartData
      .map(
        (item, index) =>
          `${getX(index)},${getY(
            Number(item.gas) || 0
          )}`
      )
      .join(" ");

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="dashboard-page">

      <style>{`

        * {
          box-sizing: border-box;
        }

        .dashboard-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 24px;
          color: #1f2937;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .dashboard-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .dashboard-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }

        .dashboard-subtitle {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .connection-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          background: white;
          border: 1px solid #e5e7eb;
        }

        .connection-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #9ca3af;
        }

        .connection-dot.online {
          background: #22c55e;
        }

        .connection-dot.offline {
          background: #ef4444;
        }

        .device-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 22px;
          box-shadow:
            0 4px 18px rgba(0,0,0,.04);
          margin-bottom: 18px;
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .device-title {
          font-size: 20px;
          font-weight: 700;
        }

        .device-location {
          margin-top: 5px;
          color: #6b7280;
          font-size: 14px;
        }

        .device-category {
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
        }

        .location-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-good {
          background: #ecfdf5;
          color: #166534;
        }

        .status-moderate {
          background: #fffbeb;
          color: #92400e;
        }

        .status-unhealthy {
          background: #fff7ed;
          color: #9a3412;
        }

        .status-danger {
          background: #fef2f2;
          color: #991b1b;
        }

        .status-unknown {
          background: #f3f4f6;
          color: #6b7280;
        }

        .status-circle {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
        }

        .device-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
          gap: 20px;
        }

        .gas-value {
          font-size: 42px;
          font-weight: 800;
          line-height: 1;
        }

        .gas-label {
          margin-top: 8px;
          color: #6b7280;
          font-size: 13px;
        }

        .data-online {
          color: #16a34a;
          font-size: 13px;
          font-weight: 700;
        }

        .data-offline {
          color: #6b7280;
          font-size: 13px;
          font-weight: 700;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns:
            repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 17px;
          min-height: 145px;
          box-shadow:
            0 4px 18px rgba(0,0,0,.03);
        }

        .metric-icon {
          width: 40px;
          height: 40px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          background: #f3f4f6;
          color: #374151;
          margin-bottom: 13px;
        }

        .metric-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 6px;
        }

        .metric-value {
          font-size: 23px;
          font-weight: 750;
        }

        .metric-unit {
          font-size: 12px;
          color: #6b7280;
          margin-left: 3px;
        }

        .main-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 18px;
        }

        .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          box-shadow:
            0 4px 18px rgba(0,0,0,.04);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .panel-title {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }

        .panel-subtitle {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .chart-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .chart-empty {
          height: 260px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #9ca3af;
          font-size: 14px;
        }

        .info-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-row:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .info-label {
          color: #6b7280;
          font-size: 13px;
        }

        .info-value {
          font-weight: 700;
          text-align: right;
        }

        .notification-panel {
          margin-top: 18px;
        }

        .notification-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .notification-item {
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: white;
        }

        .notification-head {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 10px;
        }

        .notification-title {
          font-size: 15px;
          font-weight: 700;
        }

        .notification-time {
          font-size: 11px;
          color: #6b7280;
          white-space: nowrap;
        }

        .notification-session {
          margin-top: 3px;
          font-size: 12px;
          color: #6b7280;
        }

        .notification-message {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.7;
        }

        .notification-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .notification-data {
          padding: 9px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .notification-data-label {
          display: block;
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 3px;
        }

        .notification-data-value {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
        }

        .notification-status {
          display: inline-flex;
          margin-top: 12px;
          padding: 6px 10px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
        }

        .notification-good {
          background: #ecfdf5;
          color: #166534;
        }

        .notification-warning {
          background: #fffbeb;
          color: #92400e;
        }

        .notification-danger {
          background: #fef2f2;
          color: #991b1b;
        }

        .notification-neutral {
          background: #f3f4f6;
          color: #4b5563;
        }

        .notification-empty {
          padding: 45px 20px;
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
        }

        @media (max-width: 1200px) {
          .metrics-grid {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .metrics-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .dashboard-page {
            padding: 14px;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-title {
            font-size: 23px;
          }

          .notification-grid {
            grid-template-columns: 1fr;
          }

          .device-main {
            flex-direction: column;
            align-items: flex-start;
          }
        }

      `}</style>

      <div className="dashboard-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="dashboard-header">

          <div>

            <h1 className="dashboard-title">
              Dashboard Monitoring Kualitas Udara
            </h1>

            <p className="dashboard-subtitle">
              Monitoring real-time kualitas udara
              berdasarkan lokasi pengamatan aktif
            </p>

          </div>

          <div className="connection-box">

            <span
              className={`connection-dot ${
                mqttConnected
                  ? "online"
                  : "offline"
              }`}
            />

            <span>
              MQTT:{" "}
              {mqttConnected
                ? "Terhubung"
                : "Tidak Terhubung"}
            </span>

          </div>

        </div>


        {/* =================================================
            AQM-01
        ================================================= */}

        <div className="device-card">

          <div className="device-header">

            <div>

              <div className="device-title">
                {deviceName}
              </div>

              <div className="device-location">
                📍 {locationName}
              </div>

              {locationCategory && (
                <div className="device-category">
                  Kategori:{" "}
                  {locationCategory}
                </div>
              )}

            </div>


            <div
              className={`location-status ${getStatusClass(
                currentStatus
              )}`}
            >

              <span className="status-circle" />

              {currentStatus}

            </div>

          </div>


          <div className="device-main">

            <div>

              <div className="gas-value">
                {formatNumber(
                  currentData?.gas,
                  0
                )}
              </div>

              <div className="gas-label">
                NILAI GAS MQ-135 / ADC
              </div>

            </div>


            <div>

              {currentData ? (
                <div className="data-online">
                  ● DATA MASUK
                </div>
              ) : (
                <div className="data-offline">
                  ● MENUNGGU DATA
                </div>
              )}

            </div>

          </div>

        </div>


        {/* =================================================
            METRICS
        ================================================= */}

        <div className="metrics-grid">

          {/* GAS */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="gas"
                size={21}
              />
            </div>

            <div className="metric-label">
              GAS MQ-135
            </div>

            <div className="metric-value">

              {formatNumber(
                currentData?.gas,
                0
              )}

             <span className="metric-unit">
                ADC
             </span>

            </div>

          </div>


          {/* ADC */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="activity"
                size={21}
              />
            </div>

            <div className="metric-label">
              ADC
            </div>

            <div className="metric-value">
              {formatNumber(
                currentData?.adc,
                0
              )}
            </div>

          </div>


          {/* RS RO */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="activity"
                size={21}
              />
            </div>

            <div className="metric-label">
              RS / RO
            </div>

            <div className="metric-value">
              {formatNumber(
                currentData?.rsro,
                1
              )}
            </div>

          </div>


          {/* SUHU */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="thermometer"
                size={21}
              />
            </div>

            <div className="metric-label">
              SUHU
            </div>

            <div className="metric-value">

              {formatNumber(
                currentData?.temperature,
                1
              )}

              <span className="metric-unit">
                °C
              </span>

            </div>

          </div>


          {/* KELEMBAPAN */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="humidity"
                size={21}
              />
            </div>

            <div className="metric-label">
              KELEMBAPAN
            </div>

            <div className="metric-value">

              {formatNumber(
                currentData?.humidity,
                1
              )}

              <span className="metric-unit">
                %
              </span>

            </div>

          </div>


          {/* STATUS */}

          <div className="metric-card">

            <div className="metric-icon">
              <Icon
                type="activity"
                size={21}
              />
            </div>

            <div className="metric-label">
              STATUS UDARA
            </div>

            <div className="metric-value">
              {currentStatus}
            </div>

          </div>

        </div>


        {/* =================================================
            CHART + INFO
        ================================================= */}

        <div className="main-grid">

          {/* CHART */}

          <div className="panel">

            <div className="panel-header">

              <div>

                <h2 className="panel-title">
                  Monitoring Gas Real-Time
                </h2>

                <p className="panel-subtitle">
                  {locationName}
                </p>

              </div>

            </div>


            {chartData.length === 0 ? (

              <div className="chart-empty">
                Belum ada data sensor
              </div>

            ) : (

              <div className="chart-wrap">

                <svg
                  width="100%"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                >

                  <line
                    x1={chartPadding}
                    y1={getY(0)}
                    x2={
                      chartWidth -
                      chartPadding
                    }
                    y2={getY(0)}
                    stroke="#e5e7eb"
                  />

                  <line
                    x1={chartPadding}
                    y1={getY(
                      chartMax / 2
                    )}
                    x2={
                      chartWidth -
                      chartPadding
                    }
                    y2={getY(
                      chartMax / 2
                    )}
                    stroke="#e5e7eb"
                  />

                  <line
                    x1={chartPadding}
                    y1={getY(chartMax)}
                    x2={
                      chartWidth -
                      chartPadding
                    }
                    y2={getY(chartMax)}
                    stroke="#e5e7eb"
                  />


                  {chartData.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      points={
                        polylinePoints
                      }
                    />
                  )}


                  {chartData.map(
                    (item, index) => (
                      <circle
                        key={`${item.time}-${index}`}
                        cx={getX(index)}
                        cy={getY(
                          Number(
                            item.gas
                          ) || 0
                        )}
                        r="4"
                        fill="#2563eb"
                      />
                    )
                  )}


                  {chartData.map(
                    (item, index) => {

                      const step =
                        Math.max(
                          1,
                          Math.floor(
                            chartData.length /
                              6
                          )
                        );

                      if (
                        index % step !==
                        0
                      ) {
                        return null;
                      }

                      return (
                        <text
                          key={`time-${index}`}
                          x={getX(index)}
                          y={
                            chartHeight -
                            8
                          }
                          textAnchor="middle"
                          fontSize="11"
                          fill="#6b7280"
                        >
                          {item.time}
                        </text>
                      );
                    }
                  )}

                </svg>

              </div>

            )}

          </div>


          {/* INFO */}

          <div className="panel">

            <div className="panel-header">

              <div>

                <h2 className="panel-title">
                  Informasi Sistem
                </h2>

                <p className="panel-subtitle">
                  Informasi AQM-01
                </p>

              </div>

            </div>


            <div className="info-list">

              <div className="info-row">

                <div className="info-label">
                  Lokasi Aktif
                </div>

                <div className="info-value">
                  {locationName}
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Kategori
                </div>

                <div className="info-value">
                  {locationCategory ||
                    "--"}
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Perangkat
                </div>

                <div className="info-value">
                  {deviceName}
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Gas
                </div>

                <div className="info-value">
                  {formatNumber(
                    currentData?.gas,
                    0
                  )} PPM
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Suhu
                </div>

                <div className="info-value">
                  {formatNumber(
                    currentData?.temperature,
                    1
                  )} °C
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Kelembapan
                </div>

                <div className="info-value">
                  {formatNumber(
                    currentData?.humidity,
                    1
                  )} %
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Status Udara
                </div>

                <div className="info-value">
                  {currentStatus}
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  Update Terakhir
                </div>

                <div className="info-value">
                  {formatTime(
                    lastUpdate
                  )}
                </div>

              </div>


              <div className="info-row">

                <div className="info-label">
                  MQTT
                </div>

                <div className="info-value">
                  {mqttConnected
                    ? "TERHUBUNG"
                    : "TERPUTUS"}
                </div>

              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            NOTIFIKASI
        ================================================= */}

        <div className="panel notification-panel">

          <div className="panel-header">

            <div>

              <h2 className="panel-title">
                Notifikasi & Peringatan
              </h2>

              <p className="panel-subtitle">
                Riwayat laporan kualitas udara
              </p>

            </div>

          </div>


          {notifications.length === 0 ? (

            <div className="notification-empty">
              Belum ada riwayat
              peringatan kualitas udara.
            </div>

          ) : (

            <div className="notification-list">

              {notifications.map(
                (item) => {

                  const status =
                    item.air_quality_status ||
                    "MENUNGGU DATA";

                  return (
                    <div
                      className="notification-item"
                      key={item.id}
                    >

                      <div className="notification-head">

                        <div>

                          <div className="notification-title">
                            🔔{" "}
                            {item.title ||
                              "Laporan Kualitas Udara"}
                          </div>

                          <div className="notification-session">

                            {item.session ||
                              "Pengamatan Kualitas Udara"}

                            {item.category
                              ? ` • ${item.category}`
                              : ""}

                          </div>

                        </div>


                        <div className="notification-time">
                          {formatTime(
                            item.timestamp
                          )}
                        </div>

                      </div>


                      <div className="notification-message">

                        <div>
                          📍{" "}
                          <strong>
                            Lokasi:
                          </strong>{" "}
                          {item.location ||
                            "Tidak diketahui"}
                        </div>

                        <div>
                          🖥️{" "}
                          <strong>
                            Perangkat:
                          </strong>{" "}
                          {item.device_name ||
                            "AQM-01"}
                        </div>


                        <div className="notification-grid">

                          <div className="notification-data">
                            <span className="notification-data-label">
                              GAS
                            </span>

                            <span className="notification-data-value">
                              {item.gas ??
                                "--"}{" "}
                              PPM
                            </span>
                          </div>


                          <div className="notification-data">
                            <span className="notification-data-label">
                              ADC
                            </span>

                            <span className="notification-data-value">
                              {item.adc ??
                                "--"}
                            </span>
                          </div>


                          <div className="notification-data">
                            <span className="notification-data-label">
                              RS / RO
                            </span>

                            <span className="notification-data-value">
                              {item.rsro ??
                                "--"}
                            </span>
                          </div>


                          <div className="notification-data">
                            <span className="notification-data-label">
                              SUHU
                            </span>

                            <span className="notification-data-value">
                              {item.temperature ??
                                "--"}{" "}
                              °C
                            </span>
                          </div>


                          <div className="notification-data">
                            <span className="notification-data-label">
                              KELEMBAPAN
                            </span>

                            <span className="notification-data-value">
                              {item.humidity ??
                                "--"}{" "}
                              %
                            </span>
                          </div>


                          <div className="notification-data">
                            <span className="notification-data-label">
                              STATUS
                            </span>

                            <span className="notification-data-value">
                              {status}
                            </span>
                          </div>

                        </div>


                        <span
                          className={`notification-status ${getNotificationClass(
                            status
                          )}`}
                        >
                          ● Status Udara:{" "}
                          {status}
                        </span>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </div>

      </div>

    </div>
  );
}