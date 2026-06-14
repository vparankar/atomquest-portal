import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { EmployeeDashboard } from './pages/employee';
import { ManagerDashboard } from './pages/manager';
import { AdminDashboard } from './pages/admin';
import { Notifications } from './pages/Notifications';
import { ToastProvider } from './components/Toast';
import './index.css';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
      <Router>
        <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route element={<Layout />}>
          <Route path="/employee/*" element={<EmployeeDashboard />} />
          <Route path="/manager/*" element={<ManagerDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </AuthProvider>
    </ToastProvider>
  );
}

export default App;
