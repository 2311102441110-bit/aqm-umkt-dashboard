
import React, { useEffect, useState } from 'react';
import { Bell, User, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const Header = ({
  mqttStatus,
  showNotificationBell = false,
  hasNewNotification = false,
  onNotificationBellClick
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Memperbarui jam setiap detik
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format tanggal dan waktu WITA
  const dateText = format(currentTime, 'EEEE, dd MMMM yyyy', {
    locale: id
  });

  const timeText = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(currentTime);

  const isMqttConnected = mqttStatus === 'connected';

  return (
    <header className="w-full bg-white border-b border-gray-200 px-4 md:px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        {/* Bagian Judul */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            Air Quality Monitoring
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Dashboard Monitoring Kualitas Udara UMKT
          </p>
        </div>

        {/* Bagian Kanan */}
        <div className="flex items-center flex-wrap gap-3 md:gap-5">

          {/* Status MQTT */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              isMqttConnected
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {isMqttConnected ? (
              <Wifi size={17} />
            ) : (
              <WifiOff size={17} />
            )}

            <div className="flex flex-col">
              <span className="text-xs font-medium">
                MQTT
              </span>

              <span className="text-xs font-semibold">
                {isMqttConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <span
              className={`w-2 h-2 rounded-full ${
                isMqttConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
          </div>

          {/* Tanggal dan Jam */}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-700">
              {timeText} WITA
            </p>

            <p className="text-xs text-gray-500 capitalize">
              {dateText}
            </p>
          </div>

          {/* Ikon Notifikasi */}
          {showNotificationBell && (
            <button
              type="button"
              onClick={onNotificationBellClick}
              title={
                hasNewNotification
                  ? 'Ada notifikasi baru'
                  : 'Notifikasi'
              }
              aria-label="Notifikasi"
              className="relative bg-white border border-gray-200 p-2.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
            >
              <Bell size={20} />

              {hasNewNotification && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-pink-500 border-2 border-white rounded-full" />
              )}
            </button>
          )}

          {/* Profil */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
            <User size={20} />
          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;