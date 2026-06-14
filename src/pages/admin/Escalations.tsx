import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, CheckCircle2, Settings, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { useNavigate } from 'react-router-dom';

interface EscalationEntry {
  id: string;
  reason: string;
  assignee: string;
  level: number;
  created_at: string;
}

interface GroupedEscalation {
  entityId: string;
  userName: string;
  latestReason: string;
  highestLevel: number;
  status: 'open' | 'resolved';
  entries: EscalationEntry[];
}

export function Escalations() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ missingSubmissions: 0, pendingApprovals: 0 });
  const [rules, setRules] = useState({ goalSubmitDays: 7, managerApproveDays: 5, checkinDays: 10, enabled: true });
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupedEscalation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).single();
      if (!cycle) return;

      const [employeesRes, submittedRes, pendingRes, settingsRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('id').eq('role', 'employee'),
        supabase.from('goal_sheets').select('employee_id').eq('cycle_id', cycle.id),
        supabase.from('goal_sheets').select('id, employee_id').eq('cycle_id', cycle.id).eq('status', 'submitted'),
        supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('audit_logs').select('*').eq('action', 'ESCALATION_TRIGGERED').order('changed_at', { ascending: false }).limit(50),
      ]);

      const submittedIds = new Set(submittedRes.data?.map(s => s.employee_id) || []);
      const pendingEmployeeIds = new Set(pendingRes.data?.map(s => s.employee_id) || []);

      if (settingsRes.data) {
        setRules({
          enabled: settingsRes.data.escalation_enabled,
          goalSubmitDays: settingsRes.data.goal_submit_days,
          managerApproveDays: settingsRes.data.manager_approve_days,
          checkinDays: settingsRes.data.checkin_days
        });
        setLastTriggered(settingsRes.data.last_run_at || null);
      }

      setStats({
        missingSubmissions: Math.max(0, (employeesRes.data?.length || 0) - submittedIds.size),
        pendingApprovals: pendingRes.data?.length || 0
      });

      // Group audit logs by entity_id (the person being escalated about)
      const groupMap = new Map<string, GroupedEscalation>();
      for (const log of (logsRes.data || [])) {
        const entityId = log.entity_id || log.id;
        const userName = log.new_value?.user || '—';
        const reason = log.new_value?.reason || 'Unknown';
        const level = log.new_value?.level || 1;

        if (!groupMap.has(entityId)) {
          const isMissingSub = reason.includes('Missing') || reason.includes('Submit');
          let isResolved = false;
          if (isMissingSub) {
            isResolved = submittedIds.has(entityId);
          } else {
            isResolved = !pendingEmployeeIds.has(entityId);
          }

          groupMap.set(entityId, {
            entityId,
            userName,
            latestReason: reason,
            highestLevel: level,
            status: isResolved ? 'resolved' : 'open',
            entries: [],
          });
        }

        const group = groupMap.get(entityId)!;
        if (level > group.highestLevel) {
          group.highestLevel = level;
          group.latestReason = reason;
        }
        group.entries.push({ id: log.id, reason, assignee: userName, level, created_at: log.changed_at });
      }

      setGroups(Array.from(groupMap.values()));
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const forceRun = async () => {
    setForcing(true);
    try {
      const { error } = await supabase.rpc('run_daily_escalations');
      if (error) throw error;
      toast.success('Escalation check completed!');
      loadStats();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setForcing(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;

  const openCount = groups.filter(g => g.status === 'open').length;
  const resolvedCount = groups.filter(g => g.status === 'resolved').length;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Escalations</h1>
        <p className="page-subtitle">Monitor and track escalation status across the organization.</p>
      </div>

      {/* Active Rules */}
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
              <span>Escalation rules are currently <strong>disabled</strong>.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Goal Submission', val: `${rules.goalSubmitDays} days` },
                { label: 'Manager Approval', val: `${rules.managerApproveDays} days` },
                { label: 'Check-In Window', val: `${rules.checkinDays} days` },
              ].map(r => (
                <div key={r.label} style={{ padding: '12px 14px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{r.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Missing Submissions', val: stats.missingSubmissions, color: stats.missingSubmissions > 0 ? 'var(--red)' : 'var(--text)' },
          { label: 'Pending Approvals', val: stats.pendingApprovals, color: stats.pendingApprovals > 0 ? 'var(--amber)' : 'var(--text)' },
          { label: 'Open Escalations', val: openCount, color: openCount > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Resolved', val: resolvedCount, color: 'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Automation Status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, background: '#EFF6FF', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
              <CheckCircle2 size={20} style={{ color: 'var(--blue)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Automated Enforcement</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Last checked: {lastTriggered ? new Date(lastTriggered).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
          <button onClick={forceRun} disabled={forcing} className="btn btn-secondary btn-sm" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {forcing ? 'Running...' : <><Play size={12} style={{ marginRight: 4 }} /> Force Check Now</>}
          </button>
        </div>
      </div>

      {/* Escalation Tracker — grouped & expandable */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ fontSize: 14 }}>Escalation Tracker</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{groups.length} issue{groups.length !== 1 ? 's' : ''}</div>
        </div>
        {groups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groups.map(group => {
              const isExpanded = expandedId === group.entityId;
              const levelColor = group.highestLevel >= 3 ? 'var(--red)' : group.highestLevel >= 2 ? 'var(--amber)' : 'var(--blue)';
              const levelBg = group.highestLevel >= 3 ? '#FEF2F2' : group.highestLevel >= 2 ? '#FFFBEB' : '#EFF6FF';

              return (
                <div key={group.entityId} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Group header — clickable */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : group.entityId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s', background: isExpanded ? 'var(--surface-raised)' : 'transparent' }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget.style.background = 'var(--surface-raised)'); }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget.style.background = 'transparent'); }}
                  >
                    {isExpanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}

                    <span className={group.status === 'open' ? 'badge badge-red' : 'badge badge-green'} style={{ fontSize: 11, flexShrink: 0 }}>
                      {group.status === 'open' ? 'Open' : 'Resolved'}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{group.userName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{group.latestReason}</div>
                    </div>

                    <span style={{ fontSize: 11, fontWeight: 700, color: levelColor, background: levelBg, padding: '3px 10px', borderRadius: 4, flexShrink: 0 }}>
                      L{group.highestLevel}
                    </span>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                      {group.entries.length} event{group.entries.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Expanded detail rows */}
                  {isExpanded && (
                    <div style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border)' }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: 44 }}>Level</th>
                            <th>Action</th>
                            <th>Notified</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map(entry => {
                            const eColor = entry.level >= 3 ? 'var(--red)' : entry.level >= 2 ? 'var(--amber)' : 'var(--blue)';
                            const eBg = entry.level >= 3 ? '#FEF2F2' : entry.level >= 2 ? '#FFFBEB' : '#EFF6FF';
                            return (
                              <tr key={entry.id}>
                                <td style={{ paddingLeft: 44 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: eColor, background: eBg, padding: '2px 8px', borderRadius: 4 }}>
                                    L{entry.level}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>{entry.reason}</td>
                                <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{entry.assignee}</td>
                                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                                  {new Date(entry.created_at).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            No escalations yet. Click "Force Check Now" to evaluate rules.
          </div>
        )}
      </div>
    </div>
  );
}
