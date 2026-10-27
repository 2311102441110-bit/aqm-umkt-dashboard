
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

  if (type === "temperature") {
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
      <polyline points="3 12 7 12 9.5 5 14 19 16.5 12 21 12" />
    </svg>
  );
};

export default function Dashboard() {
  const [sensorData, setSensorData] = useState(null);
  const [activeLocation, setActiveLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [supabaseStatus, setSupabaseStatus] = useState("connecting");
  const [notifications, setNotifications] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("air_quality_notifications") || "[]"
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "air_quality_notifications",
      JSON.stringify(notifications)
    );
  }, [notifications]);

  // Ambil lokasi pengamatan aktif
  useEffect(() => {
    let mounted = true;

    const loadLocation = async () => {
      const { data, error } = await supabase
        .from("observation_locations")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Gagal mengambil lokasi aktif:", error.message);
        return;
      }

      if (mounted && data) {
        setActiveLocation(data);
      }
    };

    loadLocation();

    const channel = supabase
      .channel("dashboard-active-location")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "observation_locations",
        },
        loadLocation
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Tangani pembacaan sensor terbaru
  const handleSensorData = (data) => {
    if (!data) return;

    const timestamp = data.timestamp || new Date().toISOString();

    const normalizedData = {
      ...data,
      deviceId: data.device_id || "esp32-kampus",
      deviceName: data.device_name || "AQM-01",
      location:
        data.location ||
        activeLocation?.location_name ||
        "Belum ada lokasi",
      observation_location_name:
        data.location ||
        activeLocation?.location_name ||
        "Belum ada lokasi",
      observation_location_category:
        data.category ||
        activeLocation?.category ||
        "",
      air_quality_status:
        data.air_quality_status || "MENUNGGU DATA",
      timestamp,
    };

    setSensorData(normalizedData);
    setLastUpdate(timestamp);
    setSupabaseStatus("connected");

    setChartData((previous) => {
      // Hindari titik grafik ganda untuk timestamp yang sama
      if (
        previous.length > 0 &&
        previous[previous.length - 1].timestamp === timestamp
      ) {
        return previous;
      }

      return [
        ...previous,
        {
          timestamp,
          time: formatTime(timestamp),
          gas: Number(data.gas) || 0,
        },
      ].slice(-30);
    });
  };

  // PENTING: Dashboard menggunakan sensor_current,
  // bukan sensor_data, agar tetap diperbarui di luar jadwal.
    // =====================================================
  // AMBIL DATA REAL-TIME DARI SENSOR_CURRENT
  // =====================================================

  useEffect(() => {
    let mounted = true;
    let loading = false;

    const loadLatestData = async () => {
      if (loading) return;
      loading = true;

      try {
        const { data, error } = await supabase
          .from("sensor_current")
          .select("*")
          .eq("device_id", "esp32-kampus")
          .maybeSingle();

        if (error) {
          console.error(
            "Gagal mengambil data real-time dari sensor_current:",
            error
          );

          if (mounted) {
            setSupabaseStatus("disconnected");
          }

          return;
        }

        if (!mounted) return;

        setSupabaseStatus("connected");

        if (data) {
          handleSensorData(data);
        }
      } catch (error) {
        console.error(
          "Kesalahan mengambil data sensor:",
          error
        );

        if (mounted) {
          setSupabaseStatus("disconnected");
        }
      } finally {
        loading = false;
      }
    };

    // Ambil data saat dashboard pertama kali dibuka.
    loadLatestData();

    // Periksa data terbaru setiap 2 detik.
    const polling = setInterval(() => {
      loadLatestData();
    }, 2000);

    // Dengarkan perubahan pada sensor_current.
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
          console.log(
            "Data sensor real-time diperbarui:",
            payload.new
          );

          if (mounted && payload.new) {
            handleSensorData(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log(
          "Status Supabase Realtime:",
          status
        );

        if (!mounted) return;

        if (status === "SUBSCRIBED") {
          setSupabaseStatus("connected");
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setSupabaseStatus("disconnected");
        }
      });

    return () => {
      mounted = false;
      clearInterval(polling);
      supabase.removeChannel(sensorChannel);
    };
  }, []);

  const currentData = sensorData;
  const currentStatus =
    currentData?.air_quality_status || "MENUNGGU DATA";

  const deviceName = currentData?.deviceName || "AQM-01";

  const locationName =
    currentData?.location ||
    activeLocation?.location_name ||
    "Belum ada lokasi";

  const locationCategory =
    currentData?.observation_location_category ||
    activeLocation?.category ||
    "";

  const supabaseConnected = supabaseStatus === "connected";

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

  const getY = (value) =>
    chartHeight -
    chartPadding -
    ((Number(value) || 0) / chartMax) *
      (chartHeight - chartPadding * 2);

  const polylinePoints = chartData
    .map((item, index) => `${getX(index)},${getY(item.gas)}`)
    .join(" ");

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

        .dashboard-container { max-width: 1400px; margin: 0 auto; }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .dashboard-title { margin: 0; font-size: 28px; font-weight: 700; }
        .dashboard-subtitle { margin: 6px 0 0; color: #6b7280; font-size: 14px; }

        .connection-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 999px;
          background: white;
          border: 1px solid #d1d5db;
        }

        .connection-dot { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; }
        .connection-dot.online { background: #22c55e; }
        .connection-dot.offline { background: #ef4444; }
        .connection-text { font-size: 13px; font-weight: 700; }

        .device-card, .panel, .metric-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 4px 18px rgba(0,0,0,.04);
        }

        .device-card { padding: 22px; margin-bottom: 18px; }
        .device-header { display: flex; justify-content: space-between; gap: 15px; }
        .device-title { font-size: 20px; font-weight: 700; }
        .device-location { margin-top: 5px; color: #6b7280; font-size: 14px; }
        .device-category { margin-top: 4px; color: #6b7280; font-size: 12px; }

        .location-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          height: fit-content;
        }

        .status-good { background: #ecfdf5; color: #166534; }
        .status-moderate { background: #fffbeb; color: #92400e; }
        .status-unhealthy { background: #fff7ed; color: #9a3412; }
        .status-danger { background: #fef2f2; color: #991b1b; }
        .status-unknown { background: #f3f4f6; color: #6b7280; }
        .status-circle { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

        .device-main {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 24px;
          gap: 20px;
        }

        .gas-value { font-size: 42px; font-weight: 800; line-height: 1; }
        .gas-label { margin-top: 8px; color: #6b7280; font-size: 13px; }
        .data-online { color: #16a34a; font-size: 13px; font-weight: 700; }
        .data-offline { color: #6b7280; font-size: 13px; font-weight: 700; }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .metric-card { padding: 17px; min-height: 145px; }
        .metric-icon {
          width: 40px; height: 40px;
          display: flex; justify-content: center; align-items: center;
          border-radius: 10px; background: #f3f4f6; color: #374151;
          margin-bottom: 13px;
        }

        .metric-label { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
        .metric-value { font-size: 23px; font-weight: 750; overflow-wrap: anywhere; }
        .metric-unit { font-size: 12px; color: #6b7280; margin-left: 3px; }

        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; }
        .panel { padding: 20px; }
        .panel-header { display: flex; justify-content: space-between; margin-bottom: 18px; }
        .panel-title { margin: 0; font-size: 17px; font-weight: 700; }
        .panel-subtitle { margin: 5px 0 0; color: #6b7280; font-size: 12px; }
        .chart-wrap { width: 100%; overflow-x: auto; }
        .chart-empty { height: 260px; display: flex; justify-content: center; align-items: center; color: #9ca3af; font-size: 14px; }

        .info-list { display: flex; flex-direction: column; gap: 14px; }
        .info-row {
          display: flex; justify-content: space-between; align-items: center;
          gap: 15px; padding-bottom: 14px; border-bottom: 1px solid #f0f0f0;
        }
        .info-row:last-child { padding-bottom: 0; border-bottom: none; }
        .info-label { color: #6b7280; font-size: 13px; }
        .info-value { font-weight: 700; text-align: right; overflow-wrap: anywhere; }

        .notification-panel { margin-top: 18px; }
        .notification-empty { padding: 35px 20px; text-align: center; color: #9ca3af; font-size: 14px; }
        .notification-list { display: flex; flex-direction: column; gap: 12px; }
        .notification-item { padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: white; }
        .notification-head { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 10px; }
        .notification-title { font-size: 15px; font-weight: 700; }
        .notification-time { font-size: 11px; color: #6b7280; white-space: nowrap; }
        .notification-session { margin-top: 3px; font-size: 12px; color: #6b7280; }
        .notification-message { font-size: 13px; color: #4b5563; line-height: 1.7; }
        .notification-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
        .notification-data { padding: 9px; background: #f8fafc; border-radius: 8px; }
        .notification-data-label { display: block; font-size: 10px; color: #6b7280; margin-bottom: 3px; }
        .notification-data-value { font-size: 13px; font-weight: 700; color: #111827; }
        .notification-status { display: inline-flex; margin-top: 12px; padding: 6px 10px; border-radius: 7px; font-size: 11px; font-weight: 700; }
        .notification-good { background: #ecfdf5; color: #166534; }
        .notification-warning { background: #fffbeb; color: #92400e; }
        .notification-danger { background: #fef2f2; color: #991b1b; }
        .notification-neutral { background: #f3f4f6; color: #4b5563; }

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
        <header className="dashboard-header">
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
        </header>

        <section className="device-card">
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

            {currentData ? (
              <div className="data-online">● DATA MASUK</div>
            ) : (
              <div className="data-offline">● MENUNGGU DATA</div>
            )}
          </div>
        </section>

        <section className="metrics-grid">
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
            <div className="metric-icon"><Icon type="temperature" size={21} /></div>
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
        </section>

        <section className="main-grid">
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
                  {[0, chartMax / 2, chartMax].map((value) => (
                    <line
                      key={value}
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
                        key={`time-${item.timestamp}`}
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
              <InfoRow label="Lokasi Aktif" value={locationName} />
              <InfoRow label="Kategori" value={locationCategory || "--"} />
              <InfoRow label="Perangkat" value={deviceName} />
              <InfoRow label="Gas" value={`${formatNumber(currentData?.gas, 0)} PPM`} />
              <InfoRow label="ADC" value={formatNumber(currentData?.adc, 0)} />
              <InfoRow label="Rs/Ro" value={formatNumber(currentData?.rsro, 1)} />
              <InfoRow label="Suhu" value={`${formatNumber(currentData?.temperature, 1)} °C`} />
              <InfoRow label="Kelembapan" value={`${formatNumber(currentData?.humidity, 1)} %`} />
              <InfoRow label="Status Udara" value={currentStatus} />
              <InfoRow label="Update Terakhir" value={formatTime(lastUpdate)} />
              <InfoRow
                label="Supabase"
                value={supabaseConnected ? "TERHUBUNG" : "TERPUTUS"}
              />
            </div>
          </div>
        </section>

        <section className="panel notification-panel">
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
              {notifications.map((item, index) => {
                const status =
                  item.air_quality_status ||
                  item.status ||
                  "MENUNGGU DATA";

                return (
                  <div
                    className="notification-item"
                    key={item.id || `${item.timestamp}-${index}`}
                  >
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
                      <div>📍 <strong>Lokasi:</strong> {item.location || "Tidak diketahui"}</div>
                      <div>🖥️ <strong>Perangkat:</strong> {item.device_name || item.deviceName || "AQM-01"}</div>

                      <div className="notification-grid">
                        <NotificationValue label="GAS" value={`${item.gas ?? "--"} PPM`} />
                        <NotificationValue label="ADC" value={item.adc ?? "--"} />
                        <NotificationValue label="RS / RO" value={item.rsro ?? "--"} />
                        <NotificationValue label="SUHU" value={`${item.temperature ?? "--"} °C`} />
                        <NotificationValue label="KELEMBAPAN" value={`${item.humidity ?? "--"} %`} />
                        <NotificationValue label="STATUS" value={status} />
                      </div>

                      <span
                        className={`notification-status ${
                          status === "BAIK"
                            ? "notification-good"
                            : status === "SEDANG"
                              ? "notification-warning"
                              : status.includes("BAHAYA") ||
                                  status.includes("TIDAK SEHAT")
                                ? "notification-danger"
                                : "notification-neutral"
                        }`}
                      >
                        ● Status Udara: {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

function NotificationValue({ label, value }) {
  return (
    <div className="notification-data">
      <span className="notification-data-label">{label}</span>
      <span className="notification-data-value">{value}</span>
    </div>
  );
}
