import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Cycle } from '../../types';
import { Settings as SettingsIcon, Database, Zap, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [stats, setStats] = useState({ profiles: 0, goalSheets: 0, goals: 0, achievements: 0, auditLogs: 0 });
  const { toast } = useToast();

  useEffect(() => { loadSystemInfo(); }, []);

  async function loadSystemInfo() {
    try {
      setLoading(true);
      const [cycleRes, profilesRes, sheetsRes, goalsRes, achRes, logsRes] = await Promise.all([
        supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('goal_sheets').select('id', { count: 'exact', head: true }),
        supabase.from('goals').select('id', { count: 'exact', head: true }),
        supabase.from('achievements').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      ]);
      setActiveCycle(cycleRes.data);
      setStats({ profiles: profilesRes.count || 0, goalSheets: sheetsRes.count || 0, goals: goalsRes.count || 0, achievements: achRes.count || 0, auditLogs: logsRes.count || 0 });
    } catch (err: any) {
      toast.error('Failed to load system info');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  const S = ({ label, val }: { label: string; val: number }) => (
    <div style={{ textAlign: 'center', padding: '16px 12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.5 }}>{val}</div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <SettingsIcon size={20} style={{ color: 'var(--text-muted)' }} />
          <h1 className="page-title">System Settings</h1>
        </div>
        <p className="page-subtitle">System status, database statistics, and configuration.</p>
      </div>

      {/* Active Cycle */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: 'var(--amber)' }} />
            <span className="card-title">Active Cycle</span>
          </div>
        </div>
        <div className="card-body">
          {activeCycle ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Year',   val: String(activeCycle.year)  },
                { label: 'Phase',  val: activeCycle.phase.replace('_', ' ').toUpperCase() },
                { label: 'Opens',  val: activeCycle.opens_at  ? new Date(activeCycle.opens_at).toLocaleDateString()  : '—' },
                { label: 'Closes', val: activeCycle.closes_at ? new Date(activeCycle.closes_at).toLocaleDateString() : '—' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{item.val}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-amber">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>No active cycle</strong>
                <p style={{ marginTop: 2, fontSize: 12 }}>Go to Admin Dashboard → Cycle Management to create and activate a cycle.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DB Stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} style={{ color: 'var(--blue)' }} />
            <span className="card-title">Database Statistics</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            <S label="Users"        val={stats.profiles}    />
            <S label="Goal Sheets"  val={stats.goalSheets}  />
            <S label="Goals"        val={stats.goals}       />
            <S label="Achievements" val={stats.achievements}/>
            <S label="Audit Logs"   val={stats.auditLogs}   />
          </div>
        </div>
      </div>

      {/* Demo Accounts */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} style={{ color: 'var(--text-muted)' }} />
            <span className="card-title">Demo Accounts</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Role</th><th>Email</th><th>Password</th></tr></thead>
            <tbody>
              {[
                { role: 'Employee', email: 'employee@test.com', pw: 'employee' },
                { role: 'Manager',  email: 'manager@test.com',  pw: 'manager'  },
                { role: 'Admin',    email: 'admin@test.com',    pw: 'admin'    },
              ].map(a => (
                <tr key={a.role}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{a.role}</td>
                  <td><code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 3 }}>{a.email}</code></td>
                  <td><code style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: 3 }}>{a.pw}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Info */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
            <span className="card-title">System Info</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { k: 'Frontend',  v: 'React 19 + Vite'        },
              { k: 'Backend',   v: 'Supabase (PostgreSQL)'   },
              { k: 'Styling',   v: 'Tailwind CSS v4'         },
              { k: 'Charts',    v: 'Recharts'                },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.k}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
