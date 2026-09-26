
import React from 'react';

const CloudServer = () => {
  const services = [
    {
      name: 'Backend Server',
      description: 'Server aplikasi di Railway',
      status: 'Perlu verifikasi',
      icon: '🖥️',
    },
    {
      name: 'Database MySQL',
      description: 'Penyimpanan data monitoring',
      status: 'Perlu verifikasi',
      icon: '🗄️',
    },
    {
      name: 'MQTT Broker',
      description: 'Komunikasi perangkat sensor',
      status: 'Perlu verifikasi',
      icon: '📡',
    },
    {
      name: 'Data Sensor',
      description: 'Data kualitas udara dari perangkat',
      status: 'Menunggu data',
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
        <p>
          <strong>Platform:</strong> Railway
        </p>
        <p>
          <strong>Database:</strong> MySQL
        </p>
        <p>
          <strong>Protokol komunikasi:</strong> MQTT
        </p>
      </div>

      <h2 style={styles.sectionTitle}>Status Layanan</h2>

      <div style={styles.grid}>
        {services.map((service, index) => (
          <div key={index} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.icon}>{service.icon}</span>
              <span style={styles.badge}>{service.status}</span>
            </div>

            <h3 style={styles.cardTitle}>{service.name}</h3>
            <p style={styles.cardDescription}>
              {service.description}
            </p>
          </div>
        ))}
      </div>

      <div style={styles.note}>
        <strong>Catatan:</strong> Status layanan di atas belum terhubung
        ke pemeriksaan server secara langsung. Status akan diperbarui
        setelah integrasi backend selesai.
      </div>
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
    background: '#fef3c7',
    color: '#92400e',
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
};

export default CloudServer;