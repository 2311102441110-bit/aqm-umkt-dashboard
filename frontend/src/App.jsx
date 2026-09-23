import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import RiwayatData from './pages/RiwayatData';
import Notifikasi from './pages/Notifikasi';
import Pengaturan from './pages/Pengaturan';

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/riwayat" element={<RiwayatData />} />
          <Route path="/notifikasi" element={<Notifikasi />} />
          <Route path="/pengaturan" element={<Pengaturan />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;