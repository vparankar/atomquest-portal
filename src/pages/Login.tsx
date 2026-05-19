import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        navigate(profile ? `/${profile.role}` : '/employee');
      } else {
        navigate('/employee');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Decorative Panel */}
      <div className="login-left">
        <div style={{ marginBottom: 48 }}>
          <div style={{
            width: 40, height: 40,
            background: 'var(--brand-yellow)',
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>AQ</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.3, marginBottom: 6 }}>
            AtomQuest
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            by Atomberg
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#F9FAFB', lineHeight: 1.3, letterSpacing: -0.5, marginBottom: 12 }}>
            Performance<br />Management Portal
          </p>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
            Track goals, manage check-ins, and drive team performance across your organisation.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { role: 'Employee', email: 'employee@test.com', pw: 'employee' },
            { role: 'Manager',  email: 'manager@test.com',  pw: 'manager'  },
            { role: 'Admin',    email: 'admin@test.com',    pw: 'admin'    },
          ].map(acc => (
            <button
              key={acc.role}
              onClick={() => { setEmail(acc.email); setPassword(acc.pw); }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                padding: '8px 12px',
                color: '#9CA3AF',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(253,185,19,0.08)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(253,185,19,0.2)';
                (e.currentTarget as HTMLButtonElement).style.color = '#E5E7EB';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF';
              }}
            >
              <span style={{ color: 'var(--brand-yellow)', fontWeight: 600 }}>{acc.role}</span>
              {'  '}·{'  '}{acc.email}
            </button>
          ))}
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-logo">
            <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>AQ</span>
          </div>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to your AtomQuest account</p>

          <form className="login-form" onSubmit={handleLogin}>
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@atomberg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Use the demo accounts panel to sign in quickly.
          </p>
        </div>
      </div>
    </div>
  );
}
