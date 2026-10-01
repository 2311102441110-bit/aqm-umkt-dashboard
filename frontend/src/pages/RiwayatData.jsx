import React, {
    useEffect,
    useState
} from 'react';

import Header from '../components/Header';
import { supabase } from '../lib/supabase';

const RiwayatData = () => {

    // =====================================================
    // STATE
    // =====================================================

    const [history, setHistory] = useState([]);

    const [locations, setLocations] = useState([]);

    const [selectedLocation, setSelectedLocation] =
        useState('');

    const [selectedDate, setSelectedDate] =
        useState('');

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState('');

    const [limit, setLimit] =
        useState(100);


    // =====================================================
    // AMBIL DAFTAR LOKASI DARI SUPABASE
    // =====================================================

    const fetchLocations = async () => {

        try {

            const {
                data,
                error
            } = await supabase
                .from('observation_locations')
                .select('*')
                .order('id', {
                    ascending: true
                });

            if (error) {
                throw error;
            }

            setLocations(
                Array.isArray(data)
                    ? data
                    : []
            );

        } catch (err) {

            console.error(
                'Error mengambil lokasi dari Supabase:',
                err
            );

            setError(
                err.message ||
                'Gagal mengambil lokasi pengamatan'
            );
        }
    };


    // =====================================================
    // AMBIL DATA RIWAYAT DARI SUPABASE
    // =====================================================

    const fetchHistory = async () => {

        setLoading(true);
        setError('');

        try {

            let query = supabase
                .from('sensor_data')
                .select('*')
                .order('timestamp', {
                    ascending: false
                })
                .limit(limit);


            // =================================================
            // FILTER LOKASI
            // =================================================

            if (selectedLocation) {

                query = query.eq(
                    'location',
                    selectedLocation
                );
            }


            // =================================================
            // FILTER TANGGAL
            // =================================================

            if (selectedDate) {

                const startDate =
                    `${selectedDate}T00:00:00`;

                const nextDate =
                    new Date(
                        `${selectedDate}T00:00:00`
                    );

                nextDate.setDate(
                    nextDate.getDate() + 1
                );

                const endDate =
                    nextDate.toISOString();

                query = query
                    .gte(
                        'timestamp',
                        startDate
                    )
                    .lt(
                        'timestamp',
                        endDate
                    );
            }


            // =================================================
            // JALANKAN QUERY
            // =================================================

            const {
                data,
                error
            } = await query;

            if (error) {
                throw error;
            }


            // =================================================
            // SESUAIKAN DATA SUPABASE
            // DENGAN FORMAT TABEL
            // =================================================

            const formattedData =
                (
                    Array.isArray(data)
                        ? data
                        : []
                ).map((item) => ({

                    ...item,

                    observation_location_name:
                        item.location,

                    observation_location_code:
                        item.location,

                    name:
                        item.device_id
                }));


            setHistory(
                formattedData
            );

        } catch (err) {

            console.error(
                'Error mengambil riwayat dari Supabase:',
                err
            );

            setError(
                err.message ||
                'Gagal mengambil data riwayat dari Supabase'
            );

            setHistory([]);

        } finally {

            setLoading(false);
        }
    };


    // =====================================================
    // DOWNLOAD DATA CSV
    // =====================================================

    const downloadCSV = () => {

        if (
            !history ||
            history.length === 0
        ) {

            alert(
                'Tidak ada data untuk diunduh.'
            );

            return;
        }


        const headers = [
            'No',
            'Waktu',
            'Lokasi',
            'Perangkat',
            'Gas (PPM)',
            'ADC',
            'Rs/Ro',
            'Suhu (°C)',
            'Kelembapan (%)',
            'Status'
        ];


        const rows = history.map(
            (item, index) => [

                index + 1,

                item.timestamp
                    ? new Date(
                        item.timestamp
                    ).toLocaleString('id-ID')
                    : '-',

                item.location || '-',

                item.device_id || '-',

                item.gas ?? '-',

                item.adc ?? '-',

                item.rsro ?? '-',

                item.temperature ?? '-',

                item.humidity ?? '-',

                item.air_quality_status || '-'
            ]
        );


        const csvContent = [

            headers,

            ...rows

        ]
            .map((row) =>

                row
                    .map((value) =>

                        `"${String(value)
                            .replace(/"/g, '""')}"`
                    )
                    .join(',')
            )
            .join('\n');


        // BOM agar CSV terbaca dengan baik
        // oleh Microsoft Excel

        const blob = new Blob(
            [
                '\ufeff',
                csvContent
            ],
            {
                type:
                    'text/csv;charset=utf-8;'
            }
        );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement('a');


        link.href = url;


        link.download =
            `riwayat-kualitas-udara-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;


        document.body.appendChild(link);

        link.click();

        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };


    // =====================================================
    // LOAD AWAL
    // =====================================================

    useEffect(() => {

        fetchLocations();

    }, []);


    // =====================================================
    // LOAD DATA SAAT FILTER BERUBAH
    // =====================================================

    useEffect(() => {

        fetchHistory();

    }, [
        selectedLocation,
        selectedDate,
        limit
    ]);


    // =====================================================
    // FORMAT WAKTU
    // =====================================================

    const formatDateTime = (value) => {

        if (!value) {
            return '--';
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return value;
        }


        return date.toLocaleString(
            'id-ID',
            {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }
        );
    };


    // =====================================================
    // FORMAT ANGKA
    // =====================================================

    const formatNumber = (
        value,
        digits = 1
    ) => {

        if (
            value === null ||
            value === undefined ||
            Number.isNaN(
                Number(value)
            )
        ) {

            return '--';
        }


        return Number(value).toFixed(
            digits
        );
    };


    // =====================================================
    // STATUS UDARA
    // =====================================================

    const getStatusClass = (
        status
    ) => {

        switch (
            String(status || '')
                .trim()
                .toUpperCase()
        ) {

            case 'BAIK':

                return 'bg-green-100 text-green-700';


            case 'SEDANG':

                return 'bg-yellow-100 text-yellow-700';


            case 'TIDAK SEHAT':

                return 'bg-orange-100 text-orange-700';


            case 'BAHAYA':

                return 'bg-red-100 text-red-700';


            default:

                return 'bg-gray-100 text-gray-500';
        }
    };


    // =====================================================
    // RESET FILTER
    // =====================================================

    const resetFilter = () => {

        setSelectedLocation('');

        setSelectedDate('');

        setLimit(100);
    };


    // =====================================================
    // RETURN
    // =====================================================

    return (

        <>

            <Header
                mqttStatus="connected"
            />


            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex-1">


                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="mb-6">

                    <h3 className="text-lg font-bold text-gray-800">
                        Riwayat Data
                    </h3>


                    <p className="text-gray-500 mt-1">
                        Melihat data hasil pengamatan kualitas udara
                        yang telah tersimpan dalam database Supabase.
                    </p>

                </div>


                {/* =================================================
                    FILTER
                ================================================= */}

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">


                        {/* =================================================
                            LOKASI
                        ================================================= */}

                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Lokasi
                            </label>


                            <select
                                value={selectedLocation}
                                onChange={(e) =>
                                    setSelectedLocation(
                                        e.target.value
                                    )
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                            >

                                <option value="">
                                    Semua Lokasi
                                </option>


                                {locations.map(
                                    (location) => (

                                        <option
                                            key={
                                                location.location_code
                                            }
                                            value={
                                                location.location_name
                                            }
                                        >

                                            {
                                                location.location_name
                                            }

                                        </option>

                                    )
                                )}

                            </select>

                        </div>


                        {/* =================================================
                            TANGGAL
                        ================================================= */}

                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Tanggal
                            </label>


                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) =>
                                    setSelectedDate(
                                        e.target.value
                                    )
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                            />

                        </div>


                        {/* =================================================
                            JUMLAH DATA
                        ================================================= */}

                        <div>

                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Jumlah Data
                            </label>


                            <select
                                value={limit}
                                onChange={(e) =>
                                    setLimit(
                                        Number(
                                            e.target.value
                                        )
                                    )
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500"
                            >

                                <option value="50">
                                    50 Data
                                </option>

                                <option value="100">
                                    100 Data
                                </option>

                                <option value="250">
                                    250 Data
                                </option>

                                <option value="500">
                                    500 Data
                                </option>

                            </select>

                        </div>


                        {/* =================================================
                            TOMBOL
                        ================================================= */}

                        <div className="flex items-end gap-2">

                            <button
                                onClick={resetFilter}
                                className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold rounded-lg px-4 py-2.5 text-sm"
                            >
                                Reset Filter
                            </button>


                            <button
                                onClick={downloadCSV}
                                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm"
                            >
                                Download CSV
                            </button>

                        </div>

                    </div>

                </div>


                {/* =================================================
                    STATUS DATA
                ================================================= */}

                <div className="flex items-center justify-between mb-4">

                    <div>

                        <p className="text-sm text-gray-500">

                            Total data:

                            <span className="font-bold text-gray-800 ml-1">
                                {history.length}
                            </span>

                        </p>

                    </div>


                    <button
                        onClick={fetchHistory}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold"
                    >
                        🔄 Refresh
                    </button>

                </div>


                {/* =================================================
                    ERROR
                ================================================= */}

                {error && (

                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">

                        {error}

                    </div>

                )}


                {/* =================================================
                    TABLE
                ================================================= */}

                <div className="border border-gray-100 rounded-xl overflow-hidden">

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-gray-50 border-b border-gray-100">

                                <tr>

                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        No
                                    </th>

                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Waktu
                                    </th>

                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Lokasi
                                    </th>

                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Perangkat
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Gas
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        ADC
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Rs/Ro
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Suhu
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Kelembapan
                                    </th>

                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                        Status
                                    </th>

                                </tr>

                            </thead>


                            <tbody>

                                {loading ? (

                                    <tr>

                                        <td
                                            colSpan="10"
                                            className="text-center py-10 text-gray-400"
                                        >
                                            Memuat data riwayat...
                                        </td>

                                    </tr>

                                ) : history.length === 0 ? (

                                    <tr>

                                        <td
                                            colSpan="10"
                                            className="text-center py-10 text-gray-400"
                                        >
                                            Belum ada data riwayat
                                            yang sesuai dengan filter.
                                        </td>

                                    </tr>

                                ) : (

                                    history.map(
                                        (
                                            item,
                                            index
                                        ) => (

                                            <tr
                                                key={item.id}
                                                className="border-b border-gray-50 hover:bg-gray-50"
                                            >

                                                {/* NO */}

                                                <td className="px-4 py-3 text-gray-500">
                                                    {index + 1}
                                                </td>


                                                {/* WAKTU */}

                                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                                    {formatDateTime(
                                                        item.timestamp
                                                    )}
                                                </td>


                                                {/* LOKASI */}

                                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                                    {
                                                        item.observation_location_name ||
                                                        item.location ||
                                                        '--'
                                                    }
                                                </td>


                                                {/* PERANGKAT */}

                                                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                                                    {
                                                        item.name ||
                                                        item.device_id ||
                                                        '--'
                                                    }
                                                </td>


                                                {/* GAS */}

                                                <td className="px-4 py-3 text-center font-semibold text-gray-800">

                                                    {
                                                        formatNumber(
                                                            item.gas,
                                                            0
                                                        )
                                                    }

                                                    <span className="text-xs text-gray-400 ml-1">
                                                        PPM
                                                    </span>

                                                </td>


                                                {/* ADC */}

                                                <td className="px-4 py-3 text-center text-gray-700">

                                                    {
                                                        formatNumber(
                                                            item.adc,
                                                            0
                                                        )
                                                    }

                                                </td>


                                                {/* RS/RO */}

                                                <td className="px-4 py-3 text-center text-gray-700">

                                                    {
                                                        formatNumber(
                                                            item.rsro,
                                                            1
                                                        )
                                                    }

                                                </td>


                                                {/* SUHU */}

                                                <td className="px-4 py-3 text-center text-gray-700">

                                                    {
                                                        formatNumber(
                                                            item.temperature,
                                                            1
                                                        )
                                                    }

                                                    <span className="text-xs text-gray-400 ml-1">
                                                        °C
                                                    </span>

                                                </td>


                                                {/* KELEMBAPAN */}

                                                <td className="px-4 py-3 text-center text-gray-700">

                                                    {
                                                        formatNumber(
                                                            item.humidity,
                                                            1
                                                        )
                                                    }

                                                    <span className="text-xs text-gray-400 ml-1">
                                                        %
                                                    </span>

                                                </td>


                                                {/* STATUS */}

                                                <td className="px-4 py-3 text-center">

                                                    <span
                                                        className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getStatusClass(
                                                            item.air_quality_status
                                                        )}`}
                                                    >

                                                        {
                                                            item.air_quality_status ||
                                                            'MENUNGGU DATA'
                                                        }

                                                    </span>

                                                </td>

                                            </tr>

                                        )
                                    )

                                )}

                            </tbody>

                        </table>

                    </div>

                </div>


                {/* =================================================
                    KETERANGAN
                ================================================= */}

                <div className="mt-4 text-xs text-gray-400">

                    Data riwayat berasal dari Supabase
                    dan direkam setiap 1 menit
                    selama sesi pengamatan.

                </div>

            </div>

        </>

    );
};

export default RiwayatData;