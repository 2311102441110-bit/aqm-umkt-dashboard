
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const SOCKET_URL =
  import.meta.env.VITE_API_URL ||
  'https://aqm-umkt-dashboard-production-eb4c.up.railway.app';

const Notifikasi = () => {
  const [notifications, setNotifications] = useState([]);
  const [mqttStatus, setMqttStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  // Menyimpan ID notifikasi yang sudah diterima
  const notificationIds = useRef(new Set());

  // =====================================================
  // MEMUAT NOTIFIKASI DARI SUPABASE
  // =====================================================

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        if (isMounted) {
          const loadedNotifications = data || [];

          loadedNotifications.forEach((item) => {
            if (item.id) {
              notificationIds.current.add(item.id);
            }
          });

          // Gabungkan data Supabase dengan notifikasi realtime
          // agar notifikasi baru tidak tertimpa hasil pemuatan.
          setNotifications((previous) => {
            const combined = [...previous, ...loadedNotifications];
            const unique = [];
            const seen = new Set();

            combined.forEach((item) => {
              const key = item.id
                ? String(item.id)
                : `${item.timestamp}-${item.title}`;

              if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
              }
            });

            return unique
              .sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )
              .slice(0, 50);
          });
        }
      } catch (error) {
        console.error(
          'Gagal mengambil notifikasi dari Supabase:',
          error.message
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  // =====================================================
  // SOCKET.IO REALTIME
  // =====================================================

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    // ---------------------------------------------------
    // STATUS MQTT
    // ---------------------------------------------------

    const handleMqttStatus = (data) => {
      if (!data?.status) return;

      setMqttStatus(data.status);
    };

    // ---------------------------------------------------
    // NOTIFIKASI BARU
    // ---------------------------------------------------

    const handleNotification = (notification) => {
      console.log('🔔 NOTIFIKASI BARU:', notification);

      if (!notification) return;

      const notificationId = notification.id
        ? String(notification.id)
        : null;

      // Cegah notifikasi dengan ID yang sama masuk dua kali
      if (
        notificationId &&
        notificationIds.current.has(notificationId)
      ) {
        return;
      }

      if (notificationId) {
        notificationIds.current.add(notificationId);
      }

      setNotifications((previous) => {
        const isDuplicate = previous.some((item) => {
          if (notificationId && item.id) {
            return String(item.id) === notificationId;
          }

          return (
            item.timestamp === notification.timestamp &&
            item.title === notification.title
          );
        });

        if (isDuplicate) {
          return previous;
        }

        return [notification, ...previous].slice(0, 50);
      });

      // Tampilkan titik merah muda pada ikon lonceng
      setHasNewNotification(true);
    };

    // ---------------------------------------------------
    // SOCKET CONNECT
    // ---------------------------------------------------

    const handleConnect = () => {
      console.log('✅ Socket.IO Notifikasi terhubung');

      // Meminta status MQTT terbaru dari backend
      socket.emit('request_mqtt_status');
    };

    // ---------------------------------------------------
    // SOCKET DISCONNECT
    // ---------------------------------------------------

    const handleDisconnect = (reason) => {
      console.warn(
        '⚠️ Socket.IO Notifikasi terputus:',
        reason
      );
    };

    // ---------------------------------------------------
    // SOCKET EVENT LISTENER
    // ---------------------------------------------------

    socket.on('mqtt_status', handleMqttStatus);
    socket.on('notification', handleNotification);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // ---------------------------------------------------
    // CLEANUP SOCKET
    // ---------------------------------------------------

    return () => {
      socket.off('mqtt_status', handleMqttStatus);
      socket.off('notification', handleNotification);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);

      socket.disconnect();
    };
  }, []);

  // =====================================================
  // FORMAT TANGGAL
  // =====================================================

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });
  };

  // =====================================================
  // STATUS MQTT
  // =====================================================

  const mqttConnected = mqttStatus === 'connected';

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <>
      {/* HEADER */}

      <Header
        mqttStatus={
          mqttConnected
            ? 'connected'
            : mqttStatus
        }
        showNotificationBell={true}
        hasNewNotification={hasNewNotification}
        onNotificationBellClick={() => {
          setHasNewNotification(false);
        }}
      />

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">

        {/* HEADER NOTIFIKASI */}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Notifikasi & Peringatan
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Laporan sesi pengamatan kualitas udara
              secara realtime
            </p>
          </div>
        </div>

        {/* STATUS KONEKSI */}

        <div
          className={`mb-5 px-4 py-3 rounded-xl text-sm ${
            mqttConnected
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          <span className="font-semibold">
            {mqttConnected
              ? '● Sistem terhubung'
              : '● Sistem tidak terhubung'}
          </span>

          <span className="ml-2">
            Notifikasi realtime melalui Socket.IO
          </span>
        </div>

        {/* LOADING */}

        {loading ? (

          <div className="py-16 text-center">
            <p className="text-gray-500">
              Memuat riwayat notifikasi...
            </p>
          </div>

        ) : notifications.length === 0 ? (

          /* BELUM ADA NOTIFIKASI */

          <div className="py-16 text-center">
            <div className="text-5xl mb-4">
              🔔
            </div>

            <p className="text-gray-700 font-medium">
              Belum ada notifikasi
            </p>

            <p className="text-gray-500 text-sm mt-1">
              Laporan sesi akan muncul di sini
              setelah sesi pengamatan selesai.
            </p>
          </div>

        ) : (

          /* DAFTAR NOTIFIKASI */

          <div className="space-y-4">
            {notifications.map((item, index) => (

              <div
                key={
                  item.id ||
                  `${item.timestamp}-${index}`
                }
                className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm"
              >

                {/* JUDUL */}

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        🔔
                      </span>

                      <h4 className="font-bold text-gray-800">
                        {item.title ||
                          'Laporan Kualitas Udara'}
                      </h4>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(item.timestamp)}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.category === 'JAM SIBUK'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {item.category || 'JAM NORMAL'}
                  </span>
                </div>

                {/* DETAIL SESI */}

                <div className="mt-4 p-4 rounded-lg bg-gray-50">
                  <p className="font-semibold text-gray-800">
                    📌 {item.session || 'Sesi Pengamatan'}
                  </p>

                  <p className="text-sm text-gray-600 mt-1">
                    ⏰ Laporan akhir sesi
                  </p>

                  <p className="text-sm text-gray-600">
                    📍 {item.location || 'Lokasi tidak diketahui'}
                  </p>

                  <p className="text-sm text-gray-600">
                    🖥️ {item.device_name || 'AQM-01'}
                  </p>
                </div>

                {/* DATA SENSOR */}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Gas
                    </p>

                    <p className="font-bold text-gray-800">
                      {item.gas ?? '-'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      ADC
                    </p>

                    <p className="font-bold text-gray-800">
                      {item.adc ?? '-'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Rs/Ro
                    </p>

                    <p className="font-bold text-gray-800">
                      {item.rsro ?? '-'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Status
                    </p>

                    <p
                      className={`font-bold ${
                        String(
                          item.air_quality_status || ''
                        )
                          .toUpperCase()
                          .includes('BAIK')
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {item.air_quality_status || '-'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Suhu
                    </p>

                    <p className="font-bold text-gray-800">
                      {item.temperature ?? '-'} °C
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-gray-50">
                    <p className="text-xs text-gray-500">
                      Kelembapan
                    </p>

                    <p className="font-bold text-gray-800">
                      {item.humidity ?? '-'} %
                    </p>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Notifikasi;