import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle } from '../../types';
import { FileText, CheckCircle2, AlertCircle, ArrowRight, Target, TrendingUp } from 'lucide-react';
import { Spinner } from '../../components/Spinner';

interface DashboardStats {
  activeCycle: Cycle | null;
  sheetStatus: string | null;
  totalGoals: number;
  completedGoals: number;
  onTrackGoals: number;
  latestScore: number | null;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const statusClass: Record<string, string> = {
  approved:  'badge badge-green',
  submitted: 'badge badge-blue',
  rework:    'badge badge-amber',
  draft:     'badge badge-gray',
};

export function EmployeeHome() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadStats(); }, [user?.id]);

  async function loadStats() {
    try {
      setLoading(true);
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();
      if (!cycle) { setStats({ activeCycle: null, sheetStatus: null, totalGoals: 0, completedGoals: 0, onTrackGoals: 0, latestScore: null }); return; }
      const { data: sheet } = await supabase.from('goal_sheets').select('id,status').eq('employee_id', user!.id).eq('cycle_id', cycle.id).maybeSingle();
      let totalGoals = 0, completedGoals = 0, onTrackGoals = 0, latestScore: number | null = null;
      if (sheet) {
        const { data: goals } = await supabase.from('goals').select('id,status').eq('sheet_id', sheet.id);
        totalGoals = goals?.length || 0;
        completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
        onTrackGoals = goals?.filter(g => g.status === 'on_track').length || 0;
        if (goals && goals.length > 0) {
          const { data: ach } = await supabase.from('achievements').select('score').in('goal_id', goals.map(g => g.id)).eq('cycle_phase', cycle.phase);
          if (ach && ach.length > 0) latestScore = Math.round(ach.reduce((s, a) => s + (a.score || 0), 0) / ach.length);
        }
      }
      setStats({ activeCycle: cycle, sheetStatus: sheet?.status || null, totalGoals, completedGoals, onTrackGoals, latestScore });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  const statCards = [
    { icon: <FileText size={18} style={{ color: 'var(--blue)' }} />,         label: 'Goal Sheet',   val: stats?.sheetStatus ? stats.sheetStatus.replace('_', ' ') : 'Not Started', badge: stats?.sheetStatus ? <span className={statusClass[stats.sheetStatus] || 'badge badge-gray'}>{stats.sheetStatus}</span> : null },
    { icon: <Target size={18} style={{ color: 'var(--text-muted)' }} />,      label: 'Total Goals',  val: String(stats?.totalGoals || 0), badge: null },
    { icon: <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />,     label: 'Completed',    val: String(stats?.completedGoals || 0), badge: null },
    { icon: <TrendingUp size={18} style={{ color: 'var(--purple)' }} />,      label: 'Avg Score',    val: stats?.latestScore !== null && stats?.latestScore !== undefined ? `${stats.latestScore}%` : '—', badge: null },
  ];

  const actions = [
    { to: '/employee/goals',   label: 'My Goals',  sub: 'View & manage your goals',          accent: '#111827' },
    { to: '/employee/checkin', label: 'Check-In',  sub: 'Log your quarterly progress',        accent: 'var(--brand-yellow)' },
    { to: '/employee/profile', label: 'Profile',   sub: 'Update your information',            accent: '#374151' },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
          {greeting()}, {profile?.full_name || 'there'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {stats?.activeCycle ? `Cycle: ${stats.activeCycle.year} — ${stats.activeCycle.phase.replace('_', ' ').toUpperCase()}` : 'No active cycle configured.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {c.icon}
              {c.badge}
            </div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: c.label === 'Goal Sheet' ? 16 : 28 }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {actions.map(a => (
          <Link key={a.to} to={a.to} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', background: a.accent, borderRadius: 'var(--radius-md)',
            textDecoration: 'none', color: a.accent === 'var(--brand-yellow)' ? '#111827' : '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{a.label}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{a.sub}</div>
            </div>
            <ArrowRight size={18} style={{ opacity: 0.6 }} />
          </Link>
        ))}
      </div>

      {!stats?.activeCycle && (
        <div className="alert alert-amber">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div><strong>No Active Cycle</strong><p style={{ marginTop: 2, fontSize: 12 }}>Contact your admin to set up and activate a cycle.</p></div>
        </div>
      )}
    </div>
  );
}
