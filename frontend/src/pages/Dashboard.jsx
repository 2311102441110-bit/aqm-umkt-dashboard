import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { io } from "socket.io-client";

// =====================================================
// HELPER
// =====================================================

const formatNumber = (value, digits = 1) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  return Number(value).toFixed(digits);
};

const formatTime = (value) => {
  if (!value) return "--:--:--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getStatusClass = (status) => {
  const value = String(status || "").toUpperCase();

  if (value === "BAIK") return "status-good";
  if (value === "SEDANG") return "status-moderate";

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

  if (value === "BAIK") return "notification-good";
  if (value === "SEDANG") return "notification-warning";

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
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [supabaseStatus, setSupabaseStatus] = useState("connecting");
  const [socketStatus, setSocketStatus] = useState("connecting");

  const latestTimestampRef = useRef(0);
  const requestInProgressRef = useRef(false);
  const mountedRef = useRef(false);
  const lastPayloadSignatureRef = useRef(null);

  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem("air_quality_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Gagal membaca notifikasi:", error);
      return [];
    }
  });

  // =====================================================
  // SIMPAN NOTIFIKASI
  // =====================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "air_quality_notifications",
        JSON.stringify(notifications)
      );
    } catch (error) {
      console.error("Gagal menyimpan notifikasi:", error);
    }
  }, [notifications]);

  // =====================================================
  // LOKASI AKTIF
  // =====================================================

  useEffect(() => {
    let mounted = true;

    const loadActiveLocation = async () => {
      const { data, error } = await supabase
        .from("observation_locations")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Gagal mengambil lokasi aktif:", error);
        return;
      }

      if (data) setActiveLocation(data);
    };

    loadActiveLocation();

    const locationChannel = supabase
      .channel("observation-location-dashboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "observation_locations",
        },
        loadActiveLocation
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(locationChannel);
    };
  }, []);

  // =====================================================
  // TERIMA DAN NORMALISASI DATA SENSOR
  // =====================================================

  

const handleSensorData = (data, source = "unknown") => {
  if (!data) return;

  const deviceId =
    data.device_id || data.deviceId || "esp32-kampus";

  if (deviceId !== "esp32-kampus") return;

  const parsedTime = data.timestamp
    ? Date.parse(data.timestamp)
    : NaN;

  const timestamp = Number.isFinite(parsedTime)
    ? new Date(parsedTime).toISOString()
    : new Date().toISOString();

  // Data dari Socket.IO adalah jalur realtime utama.
  // Data Supabase yang lebih lama tidak boleh menimpa data baru.
  if (
    source !== "socket" &&
    Number.isFinite(parsedTime) &&
    parsedTime < latestTimestampRef.current
  ) {
    return;
  }

  if (Number.isFinite(parsedTime)) {
    latestTimestampRef.current = Math.max(
      latestTimestampRef.current,
      parsedTime
    );
  }

  const location =
    data.observation_location_name ||
    data.location ||
    activeLocation?.location_name ||
    "Belum ada lokasi";

  const category =
    data.observation_location_category ||
    data.category ||
    activeLocation?.category ||
    "";

  const getValue = (...values) => {
    const value = values.find(
      (item) =>
        item !== null &&
        item !== undefined &&
        item !== "" &&
        Number.isFinite(Number(item))
    );

    return value === undefined ? null : Number(value);
  };

  const incoming = {
    ...data,
    device_id: deviceId,
    deviceId,
    deviceName: data.device_name || data.deviceName || "AQM-01",

    gas: getValue(data.gas, data.gasLevel),
    adc: getValue(data.adc, data.adcValue),
    rsro: getValue(data.rsro, data.rs_ro, data.rsRo),

    temperature: getValue(
      data.temperature,
      data.temp,
      data.suhu
    ),

    humidity: getValue(
      data.humidity,
      data.hum,
      data.kelembapan
    ),

    location,
    observation_location_name: location,
    observation_location_category: category,

    air_quality_status:
      data.air_quality_status ||
      data.airStatus ||
      data.status ||
      "BELUM_KALIBRASI",

    timestamp,
  };

  // Pertahankan pembacaan terakhir yang valid jika pesan
  // berikutnya mengirim null pada salah satu sensor.
  setSensorData((previous) => {
    if (!previous) return incoming;

    return {
      ...previous,
      ...incoming,
      gas: incoming.gas ?? previous.gas ?? null,
      adc: incoming.adc ?? previous.adc ?? null,
      rsro: incoming.rsro ?? previous.rsro ?? null,
      temperature:
        incoming.temperature ?? previous.temperature ?? null,
      humidity:
        incoming.humidity ?? previous.humidity ?? null,
      air_quality_status:
        incoming.air_quality_status === "BELUM_KALIBRASI" &&
        previous.air_quality_status &&
        previous.air_quality_status !== "BELUM_KALIBRASI"
          ? previous.air_quality_status
          : incoming.air_quality_status,
    };
  });

  setLastUpdate(timestamp);

  console.log(`DATA SENSOR DITERIMA (${source}):`, incoming);

  const point = {
    time: formatTime(timestamp),
    gas: incoming.gas ?? 0,
    location,
    timestamp,
  };

  setChartData((previous) => {
    if (previous.some((item) => item.timestamp === timestamp)) {
      return previous;
    }

    return [...previous, point]
      .sort(
        (a, b) =>
          Date.parse(a.timestamp) - Date.parse(b.timestamp)
      )
      .slice(-30);
  });
};


  // =====================================================
  // SOCKET.IO REALTIME
  // =====================================================

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL;

    if (!backendUrl) {
      console.error("VITE_API_URL belum dikonfigurasi.");
      setSocketStatus("disconnected");
      return;
    }

    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      console.log("Socket.IO terhubung:", socket.id);
      setSocketStatus("connected");
    });

    socket.on("sensor_data", (data) => {
      console.log("DATA SENSOR DARI SOCKET.IO:", data);
      handleSensorData(data, "socket");
    });

    socket.on("disconnect", (reason) => {
      console.warn("Socket.IO terputus:", reason);
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO gagal terhubung:", error.message);
      setSocketStatus("disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // =====================================================
  // POLLING DAN SUPABASE REALTIME
  // =====================================================

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    const loadLatestData = async () => {
      if (!mounted || requestInProgressRef.current) return;

      requestInProgressRef.current = true;

      try {
        const { data, error } = await supabase
          .from("sensor_current")
          .select("*")
          .eq("device_id", "esp32-kampus")
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error(
            "Gagal mengambil data sensor_current:",
            error
          );

          setSupabaseStatus("disconnected");
          return;
        }

        setSupabaseStatus("connected");

        if (data) {
          handleSensorData(data, "supabase");
        } else {
          console.warn("Data sensor_current belum tersedia.");
        }
      } catch (error) {
        console.error("Kesalahan mengambil data sensor:", error);
        setSupabaseStatus("disconnected");
      } finally {
        requestInProgressRef.current = false;
      }
    };

    // Ambil data saat dashboard pertama kali dibuka.
    loadLatestData();

    // Polling menjadi jalur cadangan.
    const pollingId = setInterval(loadLatestData, 2000);

    // Dengarkan pembaruan langsung dari Supabase.
    const sensorChannel = supabase
      .channel("sensor-current-dashboard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sensor_current",
          filter: "device_id=eq.esp32-kampus",
        },
        (payload) => {
          if (!mounted || !payload.new) return;

          console.log(
            "Data sensor Realtime diterima:",
            payload.new
          );

          handleSensorData(payload.new, "supabase");
        }
      )
      .subscribe((status) => {
        if (!mounted) return;

        console.log("Status Supabase Realtime:", status);

        if (status === "SUBSCRIBED") {
          setSupabaseStatus("connected");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setSupabaseStatus("disconnected");
        }
      });

    return () => {
      mounted = false;
      mountedRef.current = false;
      clearInterval(pollingId);
      requestInProgressRef.current = false;
      supabase.removeChannel(sensorChannel);
    };
  }, []);

  // =====================================================
  // DATA UNTUK TAMPILAN
  // =====================================================

  const currentData = sensorData;

  const currentStatus =
    currentData?.air_quality_status || "MENUNGGU DATA";

  const deviceName = currentData?.deviceName || "AQM-01";

  const locationName =
    currentData?.observation_location_name ||
    activeLocation?.location_name ||
    "Belum ada lokasi";

  const locationCategory =
    currentData?.observation_location_category ||
    activeLocation?.category ||
    "";

  const supabaseConnected = supabaseStatus === "connected";

  // =====================================================
  // GRAFIK
  // =====================================================

  const chartWidth = 800;
  const chartHeight = 260;
  const chartPadding = 35;

  const chartMax = Math.max(
    100,
    ...chartData.map((item) => Number(item.gas) || 0)
  );

  const getX = (index) => {
    if (chartData.length <= 1) return chartWidth / 2;

    return (
      chartPadding +
      (index / (chartData.length - 1)) *
        (chartWidth - chartPadding * 2)
    );
  };

  const getY = (value) => {
    const usableHeight = chartHeight - chartPadding * 2;

    return (
      chartHeight -
      chartPadding -
      ((Number(value) || 0) / chartMax) * usableHeight
    );
  };

  const polylinePoints = chartData
    .map((item, index) => `${getX(index)},${getY(item.gas)}`)
    .join(" ");

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <div className="dashboard-page">
      <style>{`
        * { box-sizing: border-box; }

        .dashboard-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 24px;
          color: #1f2937;
          font-family: Arial, Helvetica, sans-serif;
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
          padding: 10px 16px;
          border-radius: 999px;
          background: white;
          border: 1px solid #d1d5db;
        }

        .connection-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #9ca3af;
        }

        .connection-dot.online { background: #22c55e; }
        .connection-dot.offline { background: #ef4444; }
        .connection-text { font-size: 13px; font-weight: 700; }

        .device-card, .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 4px 18px rgba(0,0,0,.04);
          margin-bottom: 18px;
        }

        .device-header, .device-main, .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .device-title { font-size: 20px; font-weight: 700; }

        .device-location, .device-category {
          margin-top: 5px;
          color: #6b7280;
          font-size: 14px;
        }

        .device-category { font-size: 12px; }

        .location-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }

        .status-good, .notification-good {
          background: #ecfdf5;
          color: #166534;
        }

        .status-moderate, .notification-warning {
          background: #fffbeb;
          color: #92400e;
        }

        .status-unhealthy {
          background: #fff7ed;
          color: #9a3412;
        }

        .status-danger, .notification-danger {
          background: #fef2f2;
          color: #991b1b;
        }

        .status-unknown, .notification-neutral {
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
          align-items: flex-end;
          margin-top: 24px;
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
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 17px;
          min-height: 145px;
          box-shadow: 0 4px 18px rgba(0,0,0,.03);
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
          overflow-wrap: anywhere;
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

        .panel { margin-bottom: 0; }
        .panel-header { margin-bottom: 18px; }
        .panel-title { margin: 0; font-size: 17px; font-weight: 700; }
        .panel-subtitle { margin: 5px 0 0; color: #6b7280; font-size: 12px; }

        .chart-wrap { width: 100%; overflow-x: auto; }

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

        .info-label { color: #6b7280; font-size: 13px; }

        .info-value {
          font-weight: 700;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .notification-panel { margin-top: 18px; }

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

        .notification-title { font-size: 15px; font-weight: 700; }
        .notification-time { font-size: 11px; color: #6b7280; white-space: nowrap; }
        .notification-session { margin-top: 3px; font-size: 12px; color: #6b7280; }
        .notification-message { font-size: 13px; color: #4b5563; line-height: 1.7; }

        .notification-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        .notification-empty {
          padding: 45px 20px;
          text-align: center;
          color: #9ca3af;
          font-size: 14px;
        }

        @media (max-width: 1200px) {
          .metrics-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        @media (max-width: 900px) {
          .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .main-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 560px) {
          .dashboard-page { padding: 14px; }
          .metrics-grid { grid-template-columns: 1fr; }
          .dashboard-title { font-size: 23px; }
          .notification-grid { grid-template-columns: 1fr; }
          .device-main { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              Dashboard Monitoring Kualitas Udara
            </h1>
            <p className="dashboard-subtitle">
              Pemantauan kualitas udara berdasarkan lokasi pengamatan aktif
            </p>
          </div>

          <div className="connection-box">
            <span
              className={`connection-dot ${
                supabaseConnected ? "online" : "offline"
              }`}
            />
            <span className="connection-text">
              ☁️ Supabase: {supabaseConnected ? "Terhubung" : "Terputus"}
            </span>
          </div>

          <div className="connection-box">
            <span
              className={`connection-dot ${
                socketStatus === "connected" ? "online" : "offline"
              }`}
            />
            <span className="connection-text">
              Socket.IO: {socketStatus === "connected" ? "Terhubung" : "Terputus"}
            </span>
          </div>
        </div>

        <div className="device-card">
          <div className="device-header">
            <div>
              <div className="device-title">{deviceName}</div>
              <div className="device-location">📍 {locationName}</div>
              {locationCategory && (
                <div className="device-category">
                  Kategori: {locationCategory}
                </div>
              )}
            </div>

            <div className={`location-status ${getStatusClass(currentStatus)}`}>
              <span className="status-circle" />
              {currentStatus}
            </div>
          </div>

          <div className="device-main">
            <div>
              <div className="gas-value">
                {formatNumber(currentData?.gas, 0)}
              </div>
              <div className="gas-label">NILAI GAS MQ-135 / ADC</div>
            </div>

            <div>
              {currentData ? (
                <div className="data-online">● DATA MASUK</div>
              ) : (
                <div className="data-offline">● MENUNGGU DATA</div>
              )}
            </div>
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon"><Icon type="gas" size={21} /></div>
            <div className="metric-label">GAS MQ-135</div>
            <div className="metric-value">
              {formatNumber(currentData?.gas, 0)}
              <span className="metric-unit">PPM</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon"><Icon type="activity" size={21} /></div>
            <div className="metric-label">ADC</div>
            <div className="metric-value">
              {formatNumber(currentData?.adc, 0)}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon"><Icon type="activity" size={21} /></div>
            <div className="metric-label">RS / RO</div>
            <div className="metric-value">
              {formatNumber(currentData?.rsro, 1)}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon"><Icon type="thermometer" size={21} /></div>
            <div className="metric-label">SUHU</div>
            <div className="metric-value">
              {formatNumber(currentData?.temperature, 1)}
              <span className="metric-unit">°C</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon"><Icon type="humidity" size={21} /></div>
            <div className="metric-label">KELEMBAPAN</div>
            <div className="metric-value">
              {formatNumber(currentData?.humidity, 1)}
              <span className="metric-unit">%</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon"><Icon type="activity" size={21} /></div>
            <div className="metric-label">STATUS UDARA</div>
            <div className="metric-value">{currentStatus}</div>
          </div>
        </div>

        <div className="main-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Monitoring Gas Real-Time</h2>
                <p className="panel-subtitle">{locationName}</p>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="chart-empty">Belum ada data sensor</div>
            ) : (
              <div className="chart-wrap">
                <svg
                  width="100%"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {[0, chartMax / 2, chartMax].map((value, index) => (
                    <line
                      key={index}
                      x1={chartPadding}
                      y1={getY(value)}
                      x2={chartWidth - chartPadding}
                      y2={getY(value)}
                      stroke="#e5e7eb"
                    />
                  ))}

                  {chartData.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      points={polylinePoints}
                    />
                  )}

                  {chartData.map((item, index) => (
                    <circle
                      key={`${item.timestamp}-${index}`}
                      cx={getX(index)}
                      cy={getY(item.gas)}
                      r="4"
                      fill="#2563eb"
                    />
                  ))}

                  {chartData.map((item, index) => {
                    const step = Math.max(
                      1,
                      Math.floor(chartData.length / 6)
                    );

                    if (index % step !== 0) return null;

                    return (
                      <text
                        key={`time-${index}`}
                        x={getX(index)}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#6b7280"
                      >
                        {item.time}
                      </text>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Informasi Sistem</h2>
                <p className="panel-subtitle">Informasi AQM-01</p>
              </div>
            </div>

            <div className="info-list">
              {[
                ["Lokasi Aktif", locationName],
                ["Kategori", locationCategory || "--"],
                ["Perangkat", deviceName],
                ["Gas", `${formatNumber(currentData?.gas, 0)} PPM`],
                ["ADC", formatNumber(currentData?.adc, 0)],
                ["Rs/Ro", formatNumber(currentData?.rsro, 1)],
                ["Suhu", `${formatNumber(currentData?.temperature, 1)} °C`],
                ["Kelembapan", `${formatNumber(currentData?.humidity, 1)} %`],
                ["Status Udara", currentStatus],
                ["Update Terakhir", formatTime(lastUpdate)],
                ["Supabase", supabaseConnected ? "TERHUBUNG" : "TERPUTUS"],
                ["Socket.IO", socketStatus === "connected" ? "TERHUBUNG" : "TERPUTUS"],
              ].map(([label, value]) => (
                <div className="info-row" key={label}>
                  <div className="info-label">{label}</div>
                  <div className="info-value">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel notification-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Notifikasi &amp; Peringatan</h2>
              <p className="panel-subtitle">Riwayat laporan kualitas udara</p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="notification-empty">
              Belum ada riwayat peringatan kualitas udara.
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((item) => {
                const status =
                  item.air_quality_status ||
                  item.status ||
                  "MENUNGGU DATA";

                return (
                  <div className="notification-item" key={item.id}>
                    <div className="notification-head">
                      <div>
                        <div className="notification-title">
                          🔔 {item.title || "Laporan Kualitas Udara"}
                        </div>
                        <div className="notification-session">
                          {item.session || "Pengamatan Kualitas Udara"}
                          {item.category ? ` • ${item.category}` : ""}
                        </div>
                      </div>

                      <div className="notification-time">
                        {formatTime(item.timestamp)}
                      </div>
                    </div>

                    <div className="notification-message">
                      <div>
                        📍 <strong>Lokasi:</strong>{" "}
                        {item.location || "Tidak diketahui"}
                      </div>

                      <div>
                        🖥️ <strong>Perangkat:</strong>{" "}
                        {item.device_name || item.deviceName || "AQM-01"}
                      </div>

                      <div className="notification-grid">
                        {[
                          ["GAS", `${item.gas ?? "--"} PPM`],
                          ["ADC", item.adc ?? "--"],
                          ["RS / RO", item.rsro ?? "--"],
                          ["SUHU", `${item.temperature ?? "--"} °C`],
                          ["KELEMBAPAN", `${item.humidity ?? "--"} %`],
                          ["STATUS", status],
                        ].map(([label, value]) => (
                          <div className="notification-data" key={label}>
                            <span className="notification-data-label">
                              {label}
                            </span>
                            <span className="notification-data-value">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>

                      <span
                        className={`notification-status ${getNotificationClass(status)}`}
                      >
                        ● Status Udara: {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}