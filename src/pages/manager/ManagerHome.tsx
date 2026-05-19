import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle } from '../../types';
import { Users, CheckCircle2, Clock, ArrowRight, AlertCircle, ClipboardCheck } from 'lucide-react';
import { Spinner } from '../../components/Spinner';

interface ManagerStats {
  activeCycle: Cycle | null;
  teamSize: number;
  pendingApprovals: number;
  approvedSheets: number;
  checkInsCompleted: number;
  checkInsPending: number;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function ManagerHome() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadStats(); }, [user?.id]);

  async function loadStats() {
    try {
      setLoading(true);
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();
      const { data: team } = await supabase.from('profiles').select('id').eq('manager_id', user!.id);
      const teamIds = team?.map(t => t.id) || [];
      let pendingApprovals = 0, approvedSheets = 0, checkInsCompleted = 0, checkInsPending = 0;

      if (cycle && teamIds.length > 0) {
        const { count: pc } = await supabase.from('goal_sheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted').in('employee_id', teamIds);
        pendingApprovals = pc || 0;
        const { data: appr } = await supabase.from('goal_sheets').select('id').eq('status', 'approved').eq('cycle_id', cycle.id).in('employee_id', teamIds);
        approvedSheets = appr?.length || 0;
        if (appr && appr.length > 0) {
          const { data: goals } = await supabase.from('goals').select('id').in('sheet_id', appr.map(s => s.id));
          if (goals && goals.length > 0) {
            const { data: ach } = await supabase.from('achievements').select('id,status').eq('cycle_phase', cycle.phase).in('goal_id', goals.map(g => g.id));
            checkInsCompleted = ach?.filter(a => a.status === 'completed' || a.status === 'on_track').length || 0;
            checkInsPending = Math.max(0, goals.length - checkInsCompleted);
          }
        }
      }
      setStats({ activeCycle: cycle, teamSize: teamIds.length, pendingApprovals, approvedSheets, checkInsCompleted, checkInsPending });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  const statCards = [
    { icon: <Users size={18} style={{ color: 'var(--blue)' }} />,         label: 'Team Members',      val: stats?.teamSize || 0,            alert: false },
    { icon: <Clock size={18} style={{ color: 'var(--amber)' }} />,        label: 'Pending Approvals', val: stats?.pendingApprovals || 0,    alert: (stats?.pendingApprovals || 0) > 0 },
    { icon: <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />, label: 'Approved Sheets',   val: stats?.approvedSheets || 0,      alert: false },
    { icon: <ClipboardCheck size={18} style={{ color: 'var(--purple)' }} />, label: 'Check-ins Done', val: stats?.checkInsCompleted || 0,   alert: false },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
          {greeting()}, {profile?.full_name || 'Manager'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {stats?.activeCycle
            ? `Cycle: ${stats.activeCycle.year} — ${stats.activeCycle.phase.replace('_', ' ').toUpperCase()}`
            : 'No active cycle configured.'}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {c.icon}
              {c.alert && <span className="badge badge-amber">Action needed</span>}
            </div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.val}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { to: '/manager/team',    label: 'Team Goal Approvals', sub: (stats?.pendingApprovals || 0) > 0 ? `${stats?.pendingApprovals} sheet(s) waiting` : 'All caught up!', accent: 'var(--brand-yellow)' },
          { to: '/manager/reviews', label: 'Check-In Reviews',    sub: 'Review team progress & add feedback',                                                                  accent: '#111827' },
        ].map(a => (
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

      {/* Alerts */}
      {!stats?.activeCycle && (
        <div className="alert alert-amber">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div><strong>No Active Cycle</strong><p style={{ marginTop: 2, fontSize: 12 }}>Contact your admin to set up and activate a cycle.</p></div>
        </div>
      )}
      {stats?.teamSize === 0 && (
        <div className="alert alert-blue" style={{ marginTop: 12 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div><strong>No Team Members</strong><p style={{ marginTop: 2, fontSize: 12 }}>No employees are assigned to you yet.</p></div>
        </div>
      )}
    </div>
  );
}
