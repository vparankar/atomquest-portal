import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { LogOut, Home, Settings, Users, FileText, UserCircle, Loader2, BarChart3, PieChart } from 'lucide-react';
import '../index.css';

const DEMO_CREDENTIALS = {
  employee: { email: 'employee@test.com', password: 'employee' },
  manager: { email: 'manager@test.com', password: 'manager' },
  admin: { email: 'admin@test.com', password: 'admin' },
};

const ROLE_HOME = {
  employee: '/employee',
  manager: '/manager',
  admin: '/admin',
};

export function Layout() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // ✅ Actually signs in as the demo user for that role
  const switchRole = async (newRole: 'employee' | 'manager' | 'admin') => {
    if (switching || newRole === role) return;
    setSwitching(true);
    const { error } = await supabase.auth.signInWithPassword(DEMO_CREDENTIALS[newRole]);
    if (error) {
      alert(`Could not switch to ${newRole}: ${error.message}`);
      setSwitching(false);
      return;
    }
    // useAuth() will pick up the new session automatically
    navigate(ROLE_HOME[newRole]);
    setSwitching(false);
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  let navItems: { name: string; path: string; icon: any }[] = [];
  if (role === 'admin') {
    navItems = [
      { name: 'Admin Dashboard', path: '/admin', icon: Home },
      { name: 'Analytics', path: '/admin/analytics', icon: PieChart },
      { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
      { name: 'Manage Users', path: '/admin/users', icon: Users },
      { name: 'Settings', path: '/admin/settings', icon: Settings },
    ];
  } else if (role === 'manager') {
    navItems = [
      { name: 'Manager Dashboard', path: '/manager', icon: Home },
      { name: 'Team Goals', path: '/manager/team', icon: Users },
      { name: 'Reviews', path: '/manager/reviews', icon: FileText },
    ];
  } else {
    navItems = [
      { name: 'My Dashboard', path: '/employee', icon: Home },
      { name: 'My Goals', path: '/employee/goals', icon: FileText },
      { name: 'Check-In', path: '/employee/checkin', icon: FileText },
      { name: 'Profile', path: '/employee/profile', icon: UserCircle },
    ];
  }

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand-title">AtomQuest</h1>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Root paths (e.g., /admin, /employee, /manager) need exact match
            // to avoid staying highlighted on sub-routes
            const isRootPath = item.path === '/admin' || item.path === '/employee' || item.path === '/manager';
            const isActive = isRootPath
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="demo-switcher">
            <p className="demo-title">
              Demo: Switch Role
              {switching && <Loader2 size={12} className="inline ml-2 animate-spin" />}
            </p>
            <div className="demo-buttons">
              {(['employee', 'manager', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  disabled={switching || r === role}
                  className={`demo-btn ${role === r ? 'demo-btn-active' : ''}`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}