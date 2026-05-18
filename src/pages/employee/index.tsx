import { Routes, Route } from 'react-router-dom';
import { GoalSheet } from './GoalSheet';
import { CheckIn } from './CheckIn';
import { Profile } from './Profile';
import { EmployeeHome } from './EmployeeHome';

export function EmployeeDashboard() {
  return (
    <Routes>
      <Route path="/" element={<EmployeeHome />} />
      <Route path="goals" element={<GoalSheet />} />
      <Route path="checkin" element={<CheckIn />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  );
}
