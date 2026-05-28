import { Routes, Route } from 'react-router-dom';
import { ApprovalQueue } from './ApprovalQueue';
import { CheckInReview } from './CheckInReview';
import { ManagerHome } from './ManagerHome';
import { Profile } from '../employee/Profile';
import { GoalSheet } from '../employee/GoalSheet';
import { CheckIn } from '../employee/CheckIn';

export function ManagerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<ManagerHome />} />
      <Route path="team" element={<ApprovalQueue />} />
      <Route path="reviews" element={<CheckInReview />} />
      <Route path="goals" element={<GoalSheet />} />
      <Route path="checkin" element={<CheckIn />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  );
}
