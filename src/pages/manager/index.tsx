import { Routes, Route } from 'react-router-dom';
import { ApprovalQueue } from './ApprovalQueue';

function DashboardHome() {
  return (
    <div className="dashboard-container">
      <h1>Manager Dashboard</h1>
      <p>Welcome to the manager portal. Here you can review your team's goals and progress.</p>
    </div>
  );
}

export function ManagerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<DashboardHome />} />
      <Route path="/team" element={<ApprovalQueue />} />
    </Routes>
  );
}
