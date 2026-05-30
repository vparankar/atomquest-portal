import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Cycle } from '../../types';
import { Settings as SettingsIcon, Database, Zap, AlertTriangle, CheckCircle2, Info, MessageSquare, Mail, AlertCircle, Save } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [stats, setStats] = useState({ profiles: 0, goalSheets: 0, goals: 0, achievements: 0, auditLogs: 0 });
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const defaultRules = { goalSubmitDays: 7, managerApproveDays: 5, checkinDays: 10, enabled: true };
  const [escalationRules, setEscalationRules] = useState(defaultRules);
  const initialEscalationRulesRef = useRef(JSON.stringify(defaultRules));
  const [savingSettings, setSavingSettings] = useState(false);

  const { toast } = useToast();

  const saveEscalationRules = async () => {
    setSavingSettings(true);
    try {
      const { error } = await supabase.from('system_settings').upsert({
        id: 1,
        escalation_enabled: escalationRules.enabled,
        goal_submit_days: escalationRules.goalSubmitDays,
        manager_approve_days: escalationRules.managerApproveDays,
        checkin_days: escalationRules.checkinDays,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      initialEscalationRulesRef.current = JSON.stringify(escalationRules);
      toast.success('Escalation rules saved successfully');
    } catch (err: any) {
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateIntegration = async (field: 'teams_enabled' | 'email_enabled', value: boolean) => {
    try {
      if (field === 'teams_enabled') setTeamsEnabled(value);
      if (field === 'email_enabled') setEmailEnabled(value);
      
      const { error } = await supabase.from('system_settings').update({ [field]: value }).eq('id', 1);
      if (error) throw error;
      toast.success(`${field === 'teams_enabled' ? 'Teams' : 'Email'} notifications ${value ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Failed to update integration: ' + err.message);
      // Revert local state on failure
      if (field === 'teams_enabled') setTeamsEnabled(!value);
      if (field === 'email_enabled') setEmailEnabled(!value);
    }
  };

  useEffect(() => { loadSystemInfo(); }, []);

  async function loadSystemInfo() {
    try {
      setLoading(true);
      const [cycleRes, profilesRes, sheetsRes, goalsRes, achRes, logsRes, settingsRes] = await Promise.all([
        supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('goal_sheets').select('id', { count: 'exact', head: true }),
        supabase.from('goals').select('id', { count: 'exact', head: true }),
        supabase.from('achievements').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
        supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      setActiveCycle(cycleRes.data);
      setStats({ profiles: profilesRes.count || 0, goalSheets: sheetsRes.count || 0, goals: goalsRes.count || 0, achievements: achRes.count || 0, auditLogs: logsRes.count || 0 });
      
      if (settingsRes.data) {
        setTeamsEnabled(settingsRes.data.teams_enabled);
        setEmailEnabled(settingsRes.data.email_enabled);
        const rules = {
          enabled: settingsRes.data.escalation_enabled,
          goalSubmitDays: settingsRes.data.goal_submit_days,
          managerApproveDays: settingsRes.data.manager_approve_days,
          checkinDays: settingsRes.data.checkin_days
        };
        setEscalationRules(rules);
        initialEscalationRulesRef.current = JSON.stringify(rules);
      }
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
                { label: 'Year', val: String(activeCycle.year) },
                { label: 'Phase', val: activeCycle.phase.replace('_', ' ').toUpperCase() },
                { label: 'Opens', val: activeCycle.opens_at ? new Date(activeCycle.opens_at).toLocaleDateString() : '—' },
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
            <S label="Users" val={stats.profiles} />
            <S label="Goal Sheets" val={stats.goalSheets} />
            <S label="Goals" val={stats.goals} />
            <S label="Achievements" val={stats.achievements} />
            <S label="Audit Logs" val={stats.auditLogs} />
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
                { role: 'Manager', email: 'manager@test.com', pw: 'manager' },
                { role: 'Admin', email: 'admin@test.com', pw: 'admin' },
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

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={16} style={{ color: 'var(--brand-yellow)' }} />
            <span className="card-title">Integrations</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Teams Integration */}
            <div style={{ padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#E5ECF6', padding: 6, borderRadius: 6 }}><MessageSquare size={16} style={{ color: '#464EB8' }} /></div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>Microsoft Teams</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Send bot notifications on goal updates</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ position: 'relative' }}>
                    <input type="checkbox" className="sr-only" checked={teamsEnabled} onChange={(e) => updateIntegration('teams_enabled', e.target.checked)} />
                    <div style={{ width: 36, height: 20, background: teamsEnabled ? 'var(--green)' : '#E5E7EB', borderRadius: 20, transition: 'background-color 0.2s' }}></div>
                    <div style={{ position: 'absolute', top: 2, left: teamsEnabled ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }}></div>
                  </div>
                </label>
              </div>
              {teamsEnabled && <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Connected via Webhook</div>}
            </div>

            {/* Email Integration */}
            <div style={{ padding: '16px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#FEE2E2', padding: 6, borderRadius: 6 }}><Mail size={16} style={{ color: '#DC2626' }} /></div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>Email Notifications</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automated emails for approvals & reminders</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ position: 'relative' }}>
                    <input type="checkbox" className="sr-only" checked={emailEnabled} onChange={(e) => updateIntegration('email_enabled', e.target.checked)} />
                    <div style={{ width: 36, height: 20, background: emailEnabled ? 'var(--green)' : '#E5E7EB', borderRadius: 20, transition: 'background-color 0.2s' }}></div>
                    <div style={{ position: 'absolute', top: 2, left: emailEnabled ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }}></div>
                  </div>
                </label>
              </div>
              {emailEnabled && <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> SMTP Configured</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Escalation Rules */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} style={{ color: 'var(--red)' }} />
            <span className="card-title">Escalation Rules</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <input type="checkbox" className="sr-only" checked={escalationRules.enabled} onChange={(e) => setEscalationRules({ ...escalationRules, enabled: e.target.checked })} />
              <div style={{ width: 36, height: 20, background: escalationRules.enabled ? 'var(--green)' : '#E5E7EB', borderRadius: 20, transition: 'background-color 0.2s' }}></div>
              <div style={{ position: 'absolute', top: 2, left: escalationRules.enabled ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: '50%', transition: 'left 0.2s' }}></div>
            </div>
          </label>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Configure when escalation notifications are triggered. These rules are evaluated when an admin runs the escalation check from the Escalations page or by an automated cron job.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, opacity: escalationRules.enabled ? 1 : 0.5, pointerEvents: escalationRules.enabled ? 'auto' : 'none' }}>
            <div style={{ padding: 16, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Goal Submission</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Notify employee if goals not submitted within N days of cycle open</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={1} max={30} value={escalationRules.goalSubmitDays} onChange={(e) => setEscalationRules({ ...escalationRules, goalSubmitDays: parseInt(e.target.value) || 7 })} className="form-input" style={{ width: 70, textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
              </div>
            </div>
            <div style={{ padding: 16, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Manager Approval</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Notify manager if goals not approved within N days of submission</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={1} max={30} value={escalationRules.managerApproveDays} onChange={(e) => setEscalationRules({ ...escalationRules, managerApproveDays: parseInt(e.target.value) || 5 })} className="form-input" style={{ width: 70, textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
              </div>
            </div>
            <div style={{ padding: 16, background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Check-In Completion</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Notify employee if check-in not completed within N days of quarter</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={1} max={30} value={escalationRules.checkinDays} onChange={(e) => setEscalationRules({ ...escalationRules, checkinDays: parseInt(e.target.value) || 10 })} className="form-input" style={{ width: 70, textAlign: 'center' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>days</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={saveEscalationRules}
              disabled={savingSettings || JSON.stringify(escalationRules) === initialEscalationRulesRef.current}
              className="btn btn-primary"
            >
              {savingSettings ? 'Saving...' : <><Save size={15} /> Save Rules</>}
            </button>
          </div>
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
              { k: 'Frontend', v: 'React 19 + Vite' },
              { k: 'Backend', v: 'Supabase (PostgreSQL)' },
              { k: 'Styling', v: 'Tailwind CSS v4' },
              { k: 'Charts', v: 'Recharts' },
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
