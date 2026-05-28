import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { notificationService } from '../../lib/notifications';
import { AlertCircle, Clock, CheckCircle2, Play, Settings } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { useNavigate } from 'react-router-dom';

export function Escalations() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ missingSubmissions: 0, pendingApprovals: 0 });
  const { toast } = useToast();
  const navigate = useNavigate();

  const savedRules = localStorage.getItem('atomquest_escalation_rules');
  const rules = savedRules ? JSON.parse(savedRules) : { goalSubmitDays: 7, managerApproveDays: 5, checkinDays: 10, enabled: true };

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).single();
      if (!cycle) return;

      const { data: allEmployees } = await supabase.from('profiles').select('id').eq('role', 'employee');
      const { data: submittedSheets } = await supabase.from('goal_sheets').select('employee_id').eq('cycle_id', cycle.id);
      const submittedIds = new Set(submittedSheets?.map(s => s.employee_id) || []);

      const { data: pendingSheets } = await supabase.from('goal_sheets').select('id').eq('cycle_id', cycle.id).eq('status', 'submitted');

      setStats({
        missingSubmissions: Math.max(0, (allEmployees?.length || 0) - submittedIds.size),
        pendingApprovals: pendingSheets?.length || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runEscalations = async () => {
    if (!rules.enabled) { toast.error('Escalation rules are disabled. Enable them in Settings.'); return; }
    if (!window.confirm('This will send notifications to all employees who have not submitted goals, and managers with pending approvals. Continue?')) return;

    setRunning(true);
    try {
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).single();
      if (!cycle) throw new Error('No active cycle found');

      let notificationsSent = 0;

      const { data: employees } = await supabase.from('profiles').select('id, full_name').eq('role', 'employee');
      const { data: submittedSheets } = await supabase.from('goal_sheets').select('employee_id').eq('cycle_id', cycle.id);
      const submittedIds = new Set(submittedSheets?.map(s => s.employee_id) || []);

      for (const emp of (employees || [])) {
        if (!submittedIds.has(emp.id)) {
          await notificationService.createNotification({
            user_id: emp.id, type: 'escalation',
            title: 'Action Required: Submit Goals',
            message: `Please submit your goals for the current cycle (${cycle.year} ${cycle.phase.toUpperCase()}). Deadline was ${rules.goalSubmitDays} days after cycle open.`,
            action_url: '/employee/goals'
          });
          notificationsSent++;
        }
      }

      const { data: pendingSheetsWithProfiles } = await supabase
        .from('goal_sheets')
        .select('id, employee_id, profiles!goal_sheets_employee_id_fkey(manager_id)')
        .eq('cycle_id', cycle.id).eq('status', 'submitted');

      const managerReminders = new Set<string>();
      for (const sheet of (pendingSheetsWithProfiles || [])) {
        // @ts-ignore
        const managerId = sheet.profiles?.manager_id;
        if (managerId && !managerReminders.has(managerId)) {
          managerReminders.add(managerId);
          await notificationService.createNotification({
            user_id: managerId, type: 'escalation',
            title: 'Action Required: Pending Approvals',
            message: `You have goal sheets waiting for your approval. Expected approval within ${rules.managerApproveDays} days of submission.`,
            action_url: '/manager'
          });
          notificationsSent++;
        }
      }

      toast.success(`Successfully sent ${notificationsSent} escalation notifications.`);
      loadStats();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to run escalations');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Escalations</h1>
        <p className="page-subtitle">Run escalation rules manually to remind users of pending actions.</p>
      </div>

      {/* Active Rules Summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} style={{ color: 'var(--text-muted)' }} />
            <span className="card-title">Active Rules</span>
          </div>
          <button onClick={() => navigate('/admin/settings')} style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Configure →
          </button>
        </div>
        <div className="card-body">
          {!rules.enabled ? (
            <div className="alert alert-amber">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>Escalation rules are currently <strong>disabled</strong>. Enable them in Settings to run escalations.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Goal Submission</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{rules.goalSubmitDays} days</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Manager Approval</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{rules.managerApproveDays} days</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Check-In Window</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{rules.checkinDays} days</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Missing Submissions</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{stats.missingSubmissions}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Employees who haven't submitted goals</div>
            </div>
            <div style={{ padding: 10, background: '#FEF2F2', borderRadius: 'var(--radius-md)' }}>
              <AlertCircle size={22} style={{ color: 'var(--red)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>Pending Approvals</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{stats.pendingApprovals}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Goal sheets waiting for manager approval</div>
            </div>
            <div style={{ padding: 10, background: '#FFFBEB', borderRadius: 'var(--radius-md)' }}>
              <Clock size={22} style={{ color: 'var(--amber)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Run Button */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
            <Play size={22} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Run Escalation Rules</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, maxWidth: 560 }}>
              Evaluate all missing actions for the current cycle and send in-app notifications to employees and managers.
            </p>
            <button
              onClick={runEscalations}
              disabled={running || !rules.enabled || (stats.missingSubmissions === 0 && stats.pendingApprovals === 0)}
              className="btn btn-primary"
            >
              {running ? 'Running…' : <><Play size={15} style={{ marginRight: 6 }} /> Run Escalations Now</>}
            </button>
            {stats.missingSubmissions === 0 && stats.pendingApprovals === 0 && (
              <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={14} /> All caught up! No escalations needed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
