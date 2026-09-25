import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';

import {
    LayoutDashboard,
    Activity,
    History,
    Bell,
    Settings,
    Wind
} from 'lucide-react';


// =====================================================
// SOCKET.IO
// =====================================================

const SOCKET_URL =
    import.meta.env.VITE_API_URL ||
    'https://aqm-umkt-dashboard-production.up.railway.app';


// =====================================================
// LOCAL STORAGE KEY
// =====================================================

const UNREAD_KEY =
    'air_quality_unread_count';


// =====================================================
// SIDEBAR
// =====================================================

const Sidebar = () => {

    const location =
        useLocation();

    const [unreadCount, setUnreadCount] =
        useState(() => {

            try {

                const saved =
                    localStorage.getItem(
                        UNREAD_KEY
                    );

                return saved
                    ? Number(saved)
                    : 0;

            } catch (error) {

                console.error(
                    'Gagal membaca jumlah notifikasi:',
                    error
                );

                return 0;
            }
        });


    // =================================================
    // SIMPAN JUMLAH NOTIFIKASI
    // =================================================

    const saveUnreadCount = (
        count
    ) => {

        const safeCount =
            Math.max(
                0,
                Number(count) || 0
            );

        setUnreadCount(
            safeCount
        );

        localStorage.setItem(
            UNREAD_KEY,
            String(safeCount)
        );

        // Beri tahu komponen lain
        window.dispatchEvent(
            new Event(
                'notification-count-changed'
            )
        );
    };


    // =================================================
    // JIKA MEMBUKA HALAMAN NOTIFIKASI
    // ANGKA OTOMATIS HILANG
    // =================================================

    useEffect(() => {

        if (
            location.pathname ===
            '/notifikasi'
        ) {

            saveUnreadCount(0);
        }

    }, [
        location.pathname
    ]);


    // =================================================
    // SOCKET.IO UNTUK NOTIFIKASI BARU
    // =================================================

    useEffect(() => {

        const socket =
            io(
                SOCKET_URL,
                {
                    transports: [
                        'websocket',
                        'polling'
                    ]
                }
            );


        // ---------------------------------------------
        // NOTIFIKASI BARU
        // ---------------------------------------------

        socket.on(
            'notification',
            (notification) => {

                console.log(
                    '🔔 Sidebar menerima notifikasi baru:',
                    notification
                );


                // Jika user sedang membuka halaman
                // Notifikasi, tidak perlu menambah badge
                if (
                    window.location.pathname ===
                    '/notifikasi'
                ) {

                    saveUnreadCount(0);

                    return;
                }


                // Tambahkan jumlah unread
                setUnreadCount(
                    (previous) => {

                        const newCount =
                            previous + 1;

                        localStorage.setItem(
                            UNREAD_KEY,
                            String(newCount)
                        );

                        return newCount;
                    }
                );

            }
        );


        // ---------------------------------------------
        // CONNECT
        // ---------------------------------------------

        socket.on(
            'connect',
            () => {

                console.log(
                    '✅ Sidebar Socket.IO terhubung'
                );
            }
        );


        // ---------------------------------------------
        // DISCONNECT
        // ---------------------------------------------

        socket.on(
            'disconnect',
            () => {

                console.log(
                    '⚠️ Sidebar Socket.IO terputus'
                );
            }
        );


        // ---------------------------------------------
        // CLEANUP
        // ---------------------------------------------

        return () => {

            socket.disconnect();

        };

    }, []);


    // =================================================
    // SINKRONISASI LOCAL STORAGE
    // =================================================

    useEffect(() => {

        const handleStorageChange = () => {

            try {

                const saved =
                    localStorage.getItem(
                        UNREAD_KEY
                    );

                setUnreadCount(
                    saved
                        ? Number(saved)
                        : 0
                );

            } catch (error) {

                console.error(
                    'Gagal sinkronisasi notifikasi:',
                    error
                );
            }
        };


        window.addEventListener(
            'storage',
            handleStorageChange
        );


        window.addEventListener(
            'notification-count-changed',
            handleStorageChange
        );


        return () => {

            window.removeEventListener(
                'storage',
                handleStorageChange
            );

            window.removeEventListener(
                'notification-count-changed',
                handleStorageChange
            );

        };

    }, []);


    // =================================================
    // MENU
    // =================================================

    const menuItems = [

        {
            name: 'Dashboard',
            icon: (
                <LayoutDashboard
                    size={20}
                />
            ),
            path: '/'
        },

        {
            name: 'Monitoring',
            icon: (
                <Activity
                    size={20}
                />
            ),
            path: '/monitoring'
        },

        {
            name: 'Riwayat Data',
            icon: (
                <History
                    size={20}
                />
            ),
            path: '/riwayat'
        },

        {
            name: 'Notifikasi',
            icon: (
                <Bell
                    size={20}
                />
            ),
            path: '/notifikasi'
        },

        {
            name: 'Pengaturan',
            icon: (
                <Settings
                    size={20}
                />
            ),
            path: '/pengaturan'
        }

    ];


    // =================================================
    // RETURN
    // =================================================

    return (

        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">

            <div>

                {/* =========================================
                    LOGO
                ========================================== */}

                <div className="p-6 flex items-center gap-3">

                    <div className="bg-brand-teal p-2 rounded-lg text-white">

                        <Wind
                            size={24}
                        />

                    </div>


                    <div>

                        <h1 className="font-bold text-gray-800 text-lg leading-tight">

                            AQM UMKT{' '}

                            <span className="text-brand-teal text-xl leading-none">

                                &bull;

                            </span>

                        </h1>


                        <p className="text-xs text-gray-500">

                            Air Quality Monitoring

                        </p>

                    </div>

                </div>


                {/* =========================================
                    TELEMETRY LABEL
                ========================================== */}

                <div className="px-6 mb-6">

                    <div className="bg-brand-light text-brand-teal text-xs font-semibold py-1.5 px-3 rounded-full inline-flex items-center gap-2 border border-brand-teal/20">

                        <Wind
                            size={12}
                        />

                        IoT Environmental Telemetry

                    </div>

                </div>


                {/* =========================================
                    MENU
                ========================================== */}

                <nav className="px-4 space-y-1">

                    {menuItems.map(
                        (item) => (

                            <NavLink
                                key={
                                    item.name
                                }
                                to={
                                    item.path
                                }

                                onClick={() => {

                                    // Jika membuka halaman
                                    // Notifikasi, tandai
                                    // semua sebagai sudah dibaca

                                    if (
                                        item.path ===
                                        '/notifikasi'
                                    ) {

                                        saveUnreadCount(
                                            0
                                        );
                                    }

                                }}

                                className={({
                                    isActive
                                }) =>

                                    `flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                                        isActive
                                            ? 'bg-brand-teal text-white shadow-md'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                    }`

                                }
                            >

                                {/* ---------------------------------
                                    NAMA MENU
                                ---------------------------------- */}

                                <div className="flex items-center gap-3">

                                    {item.icon}

                                    <span className="font-medium text-sm">

                                        {
                                            item.name
                                        }

                                    </span>

                                </div>


                                {/* ---------------------------------
                                    BADGE NOTIFIKASI
                                ---------------------------------- */}

                                {item.path ===
                                    '/notifikasi' &&
                                    unreadCount >
                                        0 && (

                                    <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">

                                        {
                                            unreadCount
                                        }

                                    </span>

                                )}

                            </NavLink>

                        )
                    )}

                </nav>

            </div>


            {/* =============================================
                FOOTER PROFILE
            ============================================== */}

            <div className="p-4 border-t border-gray-100 m-4 bg-gray-50 rounded-xl flex items-center gap-3">

                <div className="bg-white p-2 rounded-lg shadow-sm">

                    <Wind
                        size={16}
                        className="text-gray-700"
                    />

                </div>


                <div>

                    <h4 className="text-xs font-bold text-gray-800">

                        Lab IoT UMKT

                    </h4>


                    <p className="text-[10px] text-gray-500">

                        Skripsi IoT &bull; Samarinda

                    </p>

                </div>

            </div>

        </aside>

    );
};


export default Sidebar;