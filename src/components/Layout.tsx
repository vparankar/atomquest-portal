import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  LogOut, Home, Settings, Users, FileText,
  UserCircle, Loader2, BarChart3, PieChart, Menu, X
} from 'lucide-react';
import atombergLogo from '../assets/atomberg.png';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const switchRole = async (newRole: 'employee' | 'manager' | 'admin') => {
    if (switching || newRole === role) return;
    setSwitching(true);
    const { error } = await supabase.auth.signInWithPassword(DEMO_CREDENTIALS[newRole]);
    if (error) {
      alert(`Could not switch to ${newRole}: ${error.message}`);
      setSwitching(false);
      return;
    }
    navigate(ROLE_HOME[newRole]);
    setSwitching(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{ marginBottom: 8 }}>
          <img src={atombergLogo} alt="Atomberg" style={{ height: 28, borderRadius: 6, display: 'block' }} />
        </div>
        <span>Loading...</span>
      </div>
    );
  }

  let navItems: { name: string; path: string; icon: any }[] = [];
  if (role === 'admin') {
    navItems = [
      { name: 'Dashboard', path: '/admin', icon: Home },
      { name: 'Analytics', path: '/admin/analytics', icon: PieChart },
      { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
      { name: 'Manage Users', path: '/admin/users', icon: Users },
      { name: 'Settings', path: '/admin/settings', icon: Settings },
    ];
  } else if (role === 'manager') {
    navItems = [
      { name: 'Dashboard', path: '/manager', icon: Home },
      { name: 'Team Goals', path: '/manager/team', icon: Users },
      { name: 'Reviews', path: '/manager/reviews', icon: FileText },
      { name: 'My Goals', path: '/manager/goals', icon: FileText },
      { name: 'Check-In', path: '/manager/checkin', icon: BarChart3 },
      { name: 'Profile', path: '/manager/profile', icon: UserCircle },
    ];
  } else {
    navItems = [
      { name: 'Dashboard', path: '/employee', icon: Home },
      { name: 'My Goals', path: '/employee/goals', icon: FileText },
      { name: 'Check-In', path: '/employee/checkin', icon: BarChart3 },
      { name: 'Profile', path: '/employee/profile', icon: UserCircle },
    ];
  }

  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : '';

  return (
    <div className="layout-container">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={atombergLogo} alt="Atomberg" style={{ height: 28, borderRadius: 6, display: 'block' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">AtomQuest</div>
            <span className="brand-subtitle">by Atomberg</span>
          </div>
          <button 
            className="mobile-close-btn"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isRoot =
              item.path === '/admin' ||
              item.path === '/employee' ||
              item.path === '/manager';
            const isActive = isRoot
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item${isActive ? ' nav-item-active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Role switcher */}
          <div className="demo-switcher">
            <div className="demo-title">
              Demo Role
              {switching && (
                <Loader2 size={10} className="animate-spin" style={{ color: 'var(--brand-yellow)' }} />
              )}
            </div>
            <div className="demo-buttons">
              {(['employee', 'manager', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  disabled={switching || r === role}
                  className={`demo-btn${role === r ? ' demo-btn-active' : ''}`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Current role indicator */}
          <div style={{
            padding: '7px 10px',
            fontSize: 11,
            color: 'var(--sidebar-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--brand-yellow)', flexShrink: 0,
            }} />
            Signed in as <strong style={{ color: 'var(--sidebar-text)' }}>{roleLabel}</strong>
          </div>

          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Mobile Header */}
        <div className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              className="hamburger-btn"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none', width: 24, height: 24 }}>
              <img src={atombergLogo} alt="Atomberg" style={{ height: 24, borderRadius: 6, display: 'block' }} />
            </div>
            <div className="brand-title" style={{ color: 'var(--text)', fontSize: 16 }}>AtomQuest</div>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}