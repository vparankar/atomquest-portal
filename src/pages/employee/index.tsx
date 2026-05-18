import { Routes, Route } from 'react-router-dom';
import { GoalSheet } from './GoalSheet';

export function EmployeeDashboard() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="dashboard-container">
          <h1>Employee Dashboard</h1>
          <p>Welcome to the employee portal. Here you can view your goals and track your progress.</p>
        </div>
      } />
      <Route path="goals" element={<GoalSheet />} />
    </Routes>
  );
}
