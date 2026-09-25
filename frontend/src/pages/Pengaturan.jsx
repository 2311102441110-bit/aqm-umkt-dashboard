import React, { useEffect, useState } from "react";
import Header from "../components/Header";

const API_URL =
  import.meta.env.VITE_API_URL || "https://aqm-umkt-dashboard-production.up.railway.app";

const Pengaturan = () => {

  // =====================================================
  // LOKASI PENGAMATAN
  // =====================================================

  const [locations, setLocations] = useState([]);
  const [activeLocation, setActiveLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("");

  const [loadingLocation, setLoadingLocation] =
    useState(true);

  const [savingLocation, setSavingLocation] =
    useState(false);

  const [locationMessage, setLocationMessage] =
    useState("");

  const [locationError, setLocationError] =
    useState("");


  // =====================================================
  // AMBIL DAFTAR LOKASI
  // =====================================================

  const loadLocations = async () => {

    try {

      const response = await fetch(
        `${API_URL}/api/observation-locations`
      );

      if (!response.ok) {
        throw new Error(
          "Gagal mengambil daftar lokasi."
        );
      }

      const data = await response.json();

      setLocations(data);

    } catch (error) {

      console.error(
        "Gagal mengambil lokasi:",
        error
      );

      setLocationError(
        "Gagal mengambil daftar lokasi pengamatan."
      );
    }
  };


  // =====================================================
  // AMBIL LOKASI AKTIF
  // =====================================================

  const loadActiveLocation = async () => {

    try {

      const response = await fetch(
        `${API_URL}/api/observation-location`
      );

      if (!response.ok) {
        throw new Error(
          "Gagal mengambil lokasi aktif."
        );
      }

      const data = await response.json();

      setActiveLocation(data);
      setSelectedLocation(
        data.location_code
      );

    } catch (error) {

      console.error(
        "Gagal mengambil lokasi aktif:",
        error
      );

      setLocationError(
        "Gagal mengambil lokasi aktif."
      );
    }
  };


  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {

    const loadData = async () => {

      setLoadingLocation(true);

      await Promise.all([
        loadLocations(),
        loadActiveLocation()
      ]);

      setLoadingLocation(false);
    };

    loadData();

  }, []);


  // =====================================================
  // SIMPAN LOKASI
  // =====================================================

  const saveLocation = async () => {

    if (!selectedLocation) {
      setLocationError(
        "Silakan pilih lokasi terlebih dahulu."
      );

      return;
    }

    setSavingLocation(true);
    setLocationMessage("");
    setLocationError("");

    try {

      const response = await fetch(
        `${API_URL}/api/observation-location`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            location_code:
              selectedLocation
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(
          data.error ||
          "Gagal menyimpan lokasi."
        );
      }

      setActiveLocation(
        data.location
      );

      setSelectedLocation(
        data.location.location_code
      );

      setLocationMessage(
        "Lokasi pengamatan berhasil disimpan."
      );

    } catch (error) {

      console.error(
        "Gagal menyimpan lokasi:",
        error
      );

      setLocationError(
        error.message ||
        "Gagal menyimpan lokasi pengamatan."
      );

    } finally {

      setSavingLocation(false);
    }
  };


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
      <Header mqttStatus="connected" />

      <div className="space-y-6">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div>

          <h3 className="text-2xl font-bold text-gray-800">
            Pengaturan Sistem
          </h3>

          <p className="text-gray-500 mt-1">
            Konfigurasi perangkat, lokasi pengamatan,
            jadwal, notifikasi, dan koneksi sistem
            monitoring kualitas udara.
          </p>

        </div>


        {/* =====================================================
            PERANGKAT
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              ⚙️
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Pengaturan Perangkat
              </h4>

              <p className="text-sm text-gray-500">
                Informasi perangkat monitoring yang digunakan.
              </p>

            </div>

          </div>


          <div className="border border-gray-200 rounded-xl p-5">

            <div className="flex items-center justify-between mb-4">

              <div>

                <h5 className="font-bold text-gray-800">
                  AQM-01
                </h5>

                <p className="text-sm text-gray-500 mt-1">
                  Air Quality Monitor
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                AKTIF
              </span>

            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

              <div>

                <p className="text-gray-500">
                  Device ID
                </p>

                <p className="font-medium text-gray-800">
                  esp32-kampus
                </p>

              </div>


              <div>

                <p className="text-gray-500">
                  Sensor
                </p>

                <p className="font-medium text-gray-800">
                  MQ-135 + DHT22
                </p>

              </div>


              <div>

                <p className="text-gray-500">
                  MQTT Topic
                </p>

                <p className="font-medium text-gray-800">
                  umkt/air/kampus
                </p>

              </div>

            </div>

          </div>

        </div>


        {/* =====================================================
            LOKASI PENGAMATAN
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700">
              📍
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Lokasi Pengamatan
              </h4>

              <p className="text-sm text-gray-500">
                Pilih lokasi tempat AQM-01 sedang digunakan.
              </p>

            </div>

          </div>


          {/* STATUS LOKASI AKTIF */}

          <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200">

            <p className="text-sm text-green-700">
              Lokasi pengamatan aktif
            </p>

            <p className="text-lg font-bold text-green-800 mt-1">

              {loadingLocation
                ? "Memuat..."
                : activeLocation?.location_name ||
                  "Belum ditentukan"}

            </p>

            {activeLocation && (

              <p className="text-sm text-green-700 mt-1">

                Kategori:{" "}

                {activeLocation.category}

              </p>

            )}

          </div>


          {/* PILIH LOKASI */}

          <div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">

              Pilih lokasi pengamatan

            </label>


            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(
                  e.target.value
                );

                setLocationMessage("");
                setLocationError("");
              }}
              disabled={loadingLocation || savingLocation}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >

              <option value="">
                -- Pilih lokasi --
              </option>

              {locations.map((location) => (

                <option
                  key={location.location_code}
                  value={location.location_code}
                >

                  {location.location_name}

                </option>

              ))}

            </select>

          </div>


          {/* DAFTAR LOKASI */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">

            {locations.map((location) => {

              const isActive =
                activeLocation?.location_code ===
                location.location_code;

              return (

                <div
                  key={location.location_code}
                  className={`border rounded-xl p-4 ${
                    isActive
                      ? "border-green-400 bg-green-50"
                      : "border-gray-200"
                  }`}
                >

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="font-semibold text-gray-800">
                        {location.location_name}
                      </p>

                      <p className="text-sm text-gray-500 mt-1">
                        {location.category}
                      </p>

                    </div>


                    {isActive && (

                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        AKTIF
                      </span>

                    )}

                  </div>

                </div>

              );

            })}

          </div>


          {/* PESAN */}

          {locationMessage && (

            <div className="mt-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">

              ✅ {locationMessage}

            </div>

          )}


          {locationError && (

            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">

              ❌ {locationError}

            </div>

          )}


          {/* TOMBOL */}

          <div className="flex justify-end mt-5">

            <button
              onClick={saveLocation}
              disabled={
                savingLocation ||
                loadingLocation ||
                !selectedLocation
              }
              className={`px-5 py-3 rounded-xl font-semibold text-white ${
                savingLocation ||
                loadingLocation ||
                !selectedLocation
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >

              {savingLocation
                ? "Menyimpan..."
                : "Simpan Lokasi"}

            </button>

          </div>

        </div>


        {/* =====================================================
            JADWAL
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              🕐
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Jadwal Pengamatan
              </h4>

              <p className="text-sm text-gray-500">
                Jadwal pengambilan dan penyimpanan data penelitian.
              </p>

            </div>

          </div>


          <div className="space-y-3">

            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Jam Sibuk Pagi
                </p>

                <p className="text-sm text-gray-500">
                  07:00 – 08:00
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                JAM SIBUK
              </span>

            </div>


            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Jam Normal Pagi
                </p>

                <p className="text-sm text-gray-500">
                  10:00 – 11:00
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                JAM NORMAL
              </span>

            </div>


            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Jam Normal Siang
                </p>

                <p className="text-sm text-gray-500">
                  13:30 – 14:30
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                JAM NORMAL
              </span>

            </div>


            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Jam Sibuk Sore
                </p>

                <p className="text-sm text-gray-500">
                  16:00 – 17:00
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                JAM SIBUK
              </span>

            </div>

          </div>

        </div>


        {/* =====================================================
            NOTIFIKASI
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-700">
              🔔
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Pengaturan Notifikasi
              </h4>

              <p className="text-sm text-gray-500">
                Status layanan pemberitahuan sistem.
              </p>

            </div>

          </div>


          <div className="space-y-4">

            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Notifikasi Dashboard
                </p>

                <p className="text-sm text-gray-500">
                  Menampilkan laporan pengamatan pada halaman Notifikasi.
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                AKTIF
              </span>

            </div>


            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-4">

              <div>

                <p className="font-semibold text-gray-800">
                  Telegram Bot
                </p>

                <p className="text-sm text-gray-500">
                  Mengirim laporan setelah sesi pengamatan selesai.
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                TERHUBUNG
              </span>

            </div>

          </div>

        </div>


        {/* =====================================================
            KONEKSI
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              🌐
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Koneksi Sistem
              </h4>

              <p className="text-sm text-gray-500">
                Informasi koneksi komunikasi dan penyimpanan data.
              </p>

            </div>

          </div>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="border border-gray-200 rounded-xl p-4">

              <p className="text-sm text-gray-500">
                MQTT Broker
              </p>

              <p className="font-semibold text-gray-800 mt-1">
                Terhubung
              </p>

              <p className="text-xs text-gray-400 mt-1">
                localhost:1883
              </p>

            </div>


            <div className="border border-gray-200 rounded-xl p-4">

              <p className="text-sm text-gray-500">
                WebSocket
              </p>

              <p className="font-semibold text-gray-800 mt-1">
                Aktif
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Real-Time Data
              </p>

            </div>


            <div className="border border-gray-200 rounded-xl p-4">

              <p className="text-sm text-gray-500">
                Database
              </p>

              <p className="font-semibold text-gray-800 mt-1">
                SQLite
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Penyimpanan Lokal
              </p>

            </div>

          </div>

        </div>


        {/* =====================================================
            CLOUD
        ===================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">

          <div className="flex items-center gap-3 mb-5">

            <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-700">
              ☁️
            </div>

            <div>

              <h4 className="text-lg font-bold text-gray-800">
                Penyimpanan Cloud
              </h4>

              <p className="text-sm text-gray-500">
                Sinkronisasi data monitoring ke penyimpanan cloud.
              </p>

            </div>

          </div>


          <div className="border border-dashed border-gray-300 rounded-xl p-5 bg-gray-50">

            <div className="flex items-center justify-between">

              <div>

                <p className="font-semibold text-gray-800">
                  Cloud Storage
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  Belum dikonfigurasi.
                </p>

              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">
                OFFLINE
              </span>

            </div>

            <p className="text-xs text-gray-400 mt-4">
              Fitur cloud akan dikonfigurasi pada tahap berikutnya.
            </p>

          </div>

        </div>

      </div>
    </>
  );
};

export default Pengaturan;