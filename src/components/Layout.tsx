import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { LogOut, Home, Settings, Users, FileText, UserCircle } from 'lucide-react';
import '../index.css';

export function Layout() {
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const switchRole = (newRole: 'employee' | 'manager' | 'admin') => {
    localStorage.setItem('demo_role', newRole);
    window.dispatchEvent(new Event('demo_role_change'));
    navigate(`/${newRole}`);
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  let navItems = [];
  if (role === 'admin') {
    navItems = [
      { name: 'Admin Dashboard', path: '/admin', icon: Home },
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
      { name: 'Profile', path: '/employee/profile', icon: UserCircle },
    ];
  }

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand-title">AtomQuest</h1>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
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
          {/* Demo Role Switcher */}
          <div className="demo-switcher">
            <p className="demo-title">Demo: Switch Role</p>
            <div className="demo-buttons">
              <button 
                onClick={() => switchRole('employee')}
                className={`demo-btn ${role === 'employee' ? 'demo-btn-active' : ''}`}
              >
                Employee
              </button>
              <button 
                onClick={() => switchRole('manager')}
                className={`demo-btn ${role === 'manager' ? 'demo-btn-active' : ''}`}
              >
                Manager
              </button>
              <button 
                onClick={() => switchRole('admin')}
                className={`demo-btn ${role === 'admin' ? 'demo-btn-active' : ''}`}
              >
                Admin
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="logout-btn"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
