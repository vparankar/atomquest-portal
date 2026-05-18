import { Routes, Route } from 'react-router-dom';
import { ApprovalQueue } from './ApprovalQueue';
import { CheckInReview } from './CheckInReview';
import { ManagerHome } from './ManagerHome';

export function ManagerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<ManagerHome />} />
      <Route path="team" element={<ApprovalQueue />} />
      <Route path="reviews" element={<CheckInReview />} />
    </Routes>
  );
}
