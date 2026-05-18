import { Routes, Route } from 'react-router-dom';
import { AdminPanel } from './AdminPanel';
import { Reports } from './Reports';
import { Analytics } from './Analytics';

export function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminPanel />} />
      <Route path="reports" element={<Reports />} />
      <Route path="analytics" element={<Analytics />} />
    </Routes>
  );
}
