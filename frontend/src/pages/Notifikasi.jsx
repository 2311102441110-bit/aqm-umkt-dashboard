import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Header from '../components/Header';

const SOCKET_URL =
  import.meta.env.VITE_API_URL || 'http://https://aqm-umkt-dashboard-production.up.railway.app';

const STORAGE_KEY = 'air_quality_notifications';

const Notifikasi = () => {
  const [notifications, setNotifications] = useState([]);
  const [mqttStatus, setMqttStatus] = useState('connected');

  // =====================================================
  // MEMUAT NOTIFIKASI YANG SUDAH TERSIMPAN
  // =====================================================

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch (error) {
      console.error(
        'Gagal membaca notifikasi:',
        error
      );
    }
  }, []);

  // =====================================================
  // SOCKET.IO REALTIME
  // =====================================================

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    // ---------------------------------------------------
    // STATUS MQTT
    // ---------------------------------------------------

    socket.on(
      'mqtt_status',
      (data) => {
        if (data?.status) {
          setMqttStatus(
            data.status
          );
        }
      }
    );

    // ---------------------------------------------------
    // NOTIFIKASI BARU
    // ---------------------------------------------------

    socket.on(
      'notification',
      (notification) => {

        console.log(
          '🔔 NOTIFIKASI BARU:',
          notification
        );

        setNotifications(
          (previous) => {

            // -------------------------------------------
            // CEGAH DUPLIKAT
            // -------------------------------------------

            const notificationId =
              notification?.id;

            if (
              notificationId &&
              previous.some(
                (item) =>
                  item.id ===
                  notificationId
              )
            ) {
              return previous;
            }

            // -------------------------------------------
            // DATA BARU
            // -------------------------------------------

            const updated = [
              notification,
              ...previous,
            ];

            // -------------------------------------------
            // SIMPAN KE LOCAL STORAGE
            // -------------------------------------------

            try {
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                  updated.slice(0, 50)
                )
              );
            } catch (error) {
              console.error(
                'Gagal menyimpan notifikasi:',
                error
              );
            }

            return updated.slice(
              0,
              50
            );
          }
        );
      }
    );

    // ---------------------------------------------------
    // SOCKET CONNECT
    // ---------------------------------------------------

    socket.on(
      'connect',
      () => {
        console.log(
          '✅ Socket.IO Notifikasi terhubung'
        );
      }
    );

    // ---------------------------------------------------
    // SOCKET DISCONNECT
    // ---------------------------------------------------

    socket.on(
      'disconnect',
      () => {
        console.log(
          '⚠️ Socket.IO Notifikasi terputus'
        );
      }
    );

    // ---------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------

    return () => {
      socket.disconnect();
    };

  }, []);

  // =====================================================
  // HAPUS SEMUA NOTIFIKASI
  // =====================================================

  const clearNotifications = () => {

    localStorage.removeItem(
      STORAGE_KEY
    );

    setNotifications([]);
  };

  // =====================================================
  // FORMAT TANGGAL
  // =====================================================

  const formatDate = (timestamp) => {

    if (!timestamp) {
      return '-';
    }

    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '-';
    }

    return date.toLocaleString(
      'id-ID',
      {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }
    );
  };

  // =====================================================
  // STATUS MQTT
  // =====================================================

  const mqttConnected =
    mqttStatus === 'connected';

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <>
      <Header
        mqttStatus={
          mqttConnected
            ? 'connected'
            : mqttStatus
        }
      />

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">

        {/* =================================================
            HEADER NOTIFIKASI
        ================================================= */}

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

          {notifications.length > 0 && (
            <button
              onClick={
                clearNotifications
              }
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              Hapus Riwayat
            </button>
          )}

        </div>

        {/* =================================================
            STATUS KONEKSI
        ================================================= */}

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

        {/* =================================================
            BELUM ADA NOTIFIKASI
        ================================================= */}

        {notifications.length === 0 ? (

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

          /* =================================================
             DAFTAR NOTIFIKASI
          ================================================= */

          <div className="space-y-4">

            {notifications.map(
              (item, index) => (

                <div
                  key={
                    item.id ||
                    `${item.timestamp}-${index}`
                  }
                  className="p-5 rounded-xl border border-gray-200 bg-white shadow-sm"
                >

                  {/* -----------------------------------------
                      JUDUL
                  ------------------------------------------ */}

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
                        {formatDate(
                          item.timestamp
                        )}
                      </p>

                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.category ===
                        'JAM SIBUK'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {item.category ||
                        'JAM NORMAL'}
                    </span>

                  </div>

                  {/* -----------------------------------------
                      DETAIL SESI
                  ------------------------------------------ */}

                  <div className="mt-4 p-4 rounded-lg bg-gray-50">

                    <p className="font-semibold text-gray-800">
                      📌 {item.session ||
                        'Sesi Pengamatan'}
                    </p>

                    <p className="text-sm text-gray-600 mt-1">
                      ⏰ Laporan akhir sesi
                    </p>

                    <p className="text-sm text-gray-600">
                      📍 {item.location ||
                        'Lokasi tidak diketahui'}
                    </p>

                    <p className="text-sm text-gray-600">
                      🖥️ {item.device_name ||
                        'AQM-01'}
                    </p>

                  </div>

                  {/* -----------------------------------------
                      DATA SENSOR
                  ------------------------------------------ */}

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
                            item.air_quality_status ||
                              ''
                          )
                            .toUpperCase()
                            .includes(
                              'BAIK'
                            )
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {item.air_quality_status ||
                          '-'}
                      </p>

                    </div>

                    <div className="p-3 rounded-lg bg-gray-50">

                      <p className="text-xs text-gray-500">
                        Suhu
                      </p>

                      <p className="font-bold text-gray-800">
                        {item.temperature ??
                          '-'}{' '}
                        °C
                      </p>

                    </div>

                    <div className="p-3 rounded-lg bg-gray-50">

                      <p className="text-xs text-gray-500">
                        Kelembapan
                      </p>

                      <p className="font-bold text-gray-800">
                        {item.humidity ??
                          '-'}{' '}
                        %
                      </p>

                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>
    </>
  );
};

export default Notifikasi;