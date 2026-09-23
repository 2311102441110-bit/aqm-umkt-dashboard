import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-6 h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
