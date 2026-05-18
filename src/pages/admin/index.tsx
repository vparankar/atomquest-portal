import { Routes, Route } from 'react-router-dom';
import { AdminPanel } from './AdminPanel';
import { Reports } from './Reports';

export function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminPanel />} />
      <Route path="reports" element={<Reports />} />
    </Routes>
  );
}
