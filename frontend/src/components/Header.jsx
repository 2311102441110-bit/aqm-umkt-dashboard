import React from 'react';
import { Bell, User } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const Header = ({ mqttStatus }) => {
  return (
    <header className="flex items-center justify-between pb-6 mb-6 border-b border-gray-200">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Monitoring Kualitas Udara</h2>
        <p className="text-sm text-gray-500">Pemantauan Kualitas Udara Real-Time</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Tags */}
        <div className="flex flex-col gap-1">
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200">Riset</span>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded border border-gray-200">Kampus</span>
        </div>

        {/* MQTT Status */}
        <div className="bg-brand-light border border-brand-teal/20 px-4 py-2 rounded-full flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${mqttStatus === 'connected' ? 'bg-brand-teal' : 'bg-red-500'}`}></div>
          <span className="text-brand-teal font-semibold text-sm">MQTT & ESP32<br/><span className="text-xs">{mqttStatus === 'connected' ? 'Terhubung' : 'Terputus'}</span></span>
        </div>

        {/* Clock */}
        <div className="bg-white border border-gray-200 px-4 py-2 rounded-full flex items-center gap-4 shadow-sm">
           <div className="flex flex-col items-center">
             <span className="text-sm font-bold text-gray-700">{format(new Date(), 'HH:mm:ss')}</span>
             <span className="text-[10px] text-gray-500">WITA</span>
           </div>
           <div className="h-6 w-px bg-gray-200"></div>
           <div className="flex flex-col items-center">
             <span className="text-sm font-bold text-gray-700">{format(new Date(), 'dd MMM', { locale: id })}</span>
             <span className="text-[10px] text-gray-500">{format(new Date(), 'yyyy')}</span>
           </div>
        </div>

        {/* Notification Bell */}
        <button className="bg-white border border-gray-200 p-2.5 rounded-full text-gray-500 hover:text-gray-700 shadow-sm relative">
          <Bell size={20} />
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-pink-500 border-2 border-white rounded-full"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
          <div className="bg-brand-teal p-1.5 rounded-full text-white">
            <User size={16} />
          </div>
          <div className="pr-2">
            <p className="text-xs font-bold text-gray-800 leading-tight">Peneliti Lab IoT<br/>UMKT</p>
            <p className="text-[9px] text-gray-500">FST UMKT Samarinda</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
