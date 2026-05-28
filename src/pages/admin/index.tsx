import { Routes, Route } from 'react-router-dom';
import { AdminPanel } from './AdminPanel';
import { Reports } from './Reports';
import { Analytics } from './Analytics';
import { ManageUsers } from './ManageUsers';
import { Settings } from './Settings';
import { Escalations } from './Escalations';

export function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<AdminPanel />} />
      <Route path="reports" element={<Reports />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="escalations" element={<Escalations />} />
      <Route path="users" element={<ManageUsers />} />
      <Route path="settings" element={<Settings />} />
    </Routes>
  );
}
