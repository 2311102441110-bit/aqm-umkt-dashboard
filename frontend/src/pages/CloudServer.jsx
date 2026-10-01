
import React, { useEffect, useState } from 'react';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001';
  
const CloudServer = () => {
  const [cloudStatus, setCloudStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCloudStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cloud-status`);

      if (!response.ok) {
        throw new Error('Gagal mengambil status cloud');
      }

      const data = await response.json();

      setCloudStatus(data);
      setError(false);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Cloud status error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCloudStatus();

    const interval = setInterval(fetchCloudStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatus = (key) => {
    if (loading && !cloudStatus) return 'Memeriksa...';
    if (error && !cloudStatus) return 'Tidak dapat diperiksa';

    const status = cloudStatus?.[key]?.status;

    if (status === 'connected' || status === 'online') {
      return 'Online';
    }

    if (status === 'disconnected' || status === 'offline') {
      return 'Offline';
    }

    if (status === 'error') {
      return 'Error';
    }

    if (status === 'waiting') {
      return 'Menunggu data';
    }

    return 'Belum diketahui';
  };

  const getBadgeStyle = (status) => {
    if (status === 'Online') {
      return {
        background: '#dcfce7',
        color: '#166534',
      };
    }

    if (status === 'Offline' || status === 'Error') {
      return {
        background: '#fee2e2',
        color: '#991b1b',
      };
    }

    return {
      background: '#fef3c7',
      color: '#92400e',
    };
  };

  const services = [
    {
      key: 'backend',
      name: 'Backend Server',
      description: 'Server aplikasi di Railway',
      icon: '🖥️',
    },
    {
      key: 'database',
      name: 'Database MySQL',
      description: 'Penyimpanan data monitoring',
      icon: '🗄️',
    },
    {
      key: 'mqtt',
      name: 'MQTT Broker',
      description: 'Komunikasi perangkat sensor',
      icon: '📡',
    },
    {
      key: 'sensor',
      name: 'Data Sensor',
      description: 'Data kualitas udara dari perangkat',
      icon: '🌫️',
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Cloud Server</h1>
        <p style={styles.subtitle}>
          Monitoring infrastruktur cloud Dashboard Kualitas Udara UMKT
        </p>
      </div>

      <div style={styles.infoBox}>
        <h3>☁️ Informasi Cloud</h3>
        <p>
          Server cloud digunakan untuk menjalankan backend aplikasi,
          menyimpan data monitoring, dan menghubungkan perangkat sensor
          dengan dashboard web.
        </p>
        <p><strong>Platform:</strong> Railway</p>
        <p><strong>Database:</strong> MySQL</p>
        <p><strong>Protokol komunikasi:</strong> MQTT</p>
      </div>

      <h2 style={styles.sectionTitle}>Status Layanan</h2>

      <div style={styles.grid}>
        {services.map((service) => {
          const status = getStatus(service.key);

          return (
            <div key={service.key} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.icon}>{service.icon}</span>
                <span
                  style={{
                    ...styles.badge,
                    ...getBadgeStyle(status),
                  }}
                >
                  {status}
                </span>
              </div>

              <h3 style={styles.cardTitle}>{service.name}</h3>
              <p style={styles.cardDescription}>
                {service.description}
              </p>
            </div>
          );
        })}
      </div>

      <div style={styles.note}>
        <strong>
          {error ? '⚠️ Koneksi gagal: ' : '🔄 Pemeriksaan otomatis: '}
        </strong>
        {error
          ? 'Status layanan belum dapat diambil dari backend. Periksa koneksi dan endpoint API.'
          : 'Status diperbarui setiap 30 detik.'}

        {lastUpdated && (
          <p style={{ marginBottom: 0 }}>
            Terakhir diperbarui:{' '}
            {lastUpdated.toLocaleTimeString('id-ID')}
          </p>
        )}
      </div>

      <button
        onClick={fetchCloudStatus}
        style={styles.refreshButton}
      >
        ↻ Periksa Sekarang
      </button>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    color: 'var(--text-primary, #1f2937)',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary, #6b7280)',
    margin: 0,
  },
  infoBox: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--card-bg, #ffffff)',
    marginBottom: '28px',
    lineHeight: 1.7,
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--card-bg, #ffffff)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '18px',
  },
  icon: {
    fontSize: '28px',
  },
  badge: {
    fontSize: '11px',
    padding: '6px 10px',
    borderRadius: '20px',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  cardDescription: {
    fontSize: '13px',
    color: 'var(--text-secondary, #6b7280)',
    margin: 0,
    lineHeight: 1.6,
  },
  note: {
    marginTop: '24px',
    padding: '16px',
    borderRadius: '10px',
    background: '#eff6ff',
    color: '#1e40af',
    fontSize: '13px',
    lineHeight: 1.7,
  },
  refreshButton: {
    marginTop: '16px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--card-bg, #ffffff)',
    color: 'var(--text-primary, #1f2937)',
    cursor: 'pointer',
    fontWeight: '600',
  },
};

export default CloudServer;