import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useCheckInReview, queryKeys } from '../../hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { Profile, Goal, Achievement } from '../../types';
import { ChevronDown, ChevronUp, Save, MessageSquare, Users } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

interface TeamMemberCheckIn extends Profile {
  goals: (Goal & { achievement?: Achievement })[];
  overallStatus: 'pending' | 'completed';
}

const statusClass: Record<string, string> = {
  completed: 'badge badge-green',
  pending:   'badge badge-amber',
};

export function CheckInReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useCheckInReview(user?.id);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentsInitialized, setCommentsInitialized] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Sync initial comments from the query data (only once)
  if (data?.initialComments && !commentsInitialized) {
    setComments(data.initialComments);
    setCommentsInitialized(true);
  }

  const activeCycle = data?.activeCycle;
  const teamCheckIns = (data?.teamCheckIns || []) as TeamMemberCheckIn[];

  const saveComment = async (achievementId: string) => {
    setSavingId(achievementId);
    try {
      const { error } = await supabase.from('achievements').update({ manager_comment: comments[achievementId] }).eq('id', achievementId);
      if (error) throw error;
      // Invalidate cache so data refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.checkInReview(user!.id) });
      toast.success('Comment saved');
    } catch { toast.error('Failed to save comment'); } finally { setSavingId(null); }
  };

  if (loading) return <div style={{ padding: 32 }}><Spinner /></div>;
  if (!activeCycle) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)', fontSize: 14 }}>No active cycle found.</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Team Check-In Review</h1>
        <p className="page-subtitle">Cycle: {activeCycle.year} — {activeCycle.phase.toUpperCase()}</p>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Goals</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {teamCheckIns.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <Users size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No team members found</div>
                    <div className="empty-state-text">No employees are assigned to you.</div>
                  </div>
                </td></tr>
              )}
              {teamCheckIns.map(member => (
                <React.Fragment key={member.id}>
                  <tr style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{member.full_name || 'Unnamed'}</td>
                    <td>{member.department || '—'}</td>
                    <td>{member.goals.length} goals</td>
                    <td><span className={statusClass[member.overallStatus]}>{member.overallStatus}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => setExpandedRow(expandedRow === member.id ? null : member.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 10px', cursor: 'pointer' }}>
                        {expandedRow === member.id ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Details</>}
                      </button>
                    </td>
                  </tr>

                  {expandedRow === member.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 16px', background: 'var(--surface-raised)' }}>
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginTop: 8 }}>
                          {member.goals.length === 0 ? (
                            <div className="empty-state"><div className="empty-state-title">No approved goals found.</div></div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                                  {['Goal', 'Target', 'Actual', 'Score', 'Manager Comment'].map(h => (
                                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {member.goals.map(goal => (
                                  <tr key={goal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '10px 14px', width: '22%' }}>
                                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                        {goal.title}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{goal.thrust_area}</div>
                                    </td>
                                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                      {goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>({goal.uom_type})</div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      {goal.achievement
                                        ? <><span style={{ fontWeight: 600, color: 'var(--text)' }}>{goal.uom_type === 'timeline' ? goal.achievement.actual_date : goal.achievement.actual_value}</span><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{goal.achievement.status?.replace('_', ' ')}</div></>
                                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No check-in</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      {goal.achievement
                                        ? <span style={{ fontWeight: 700, color: goal.achievement.score! >= 100 ? 'var(--green)' : goal.achievement.score! >= 50 ? 'var(--amber)' : 'var(--text)' }}>{goal.achievement.score}%</span>
                                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px', width: '30%' }}>
                                      {goal.achievement ? (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                          <MessageSquare size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 6 }} />
                                          <div style={{ flex: 1 }}>
                                            <textarea rows={2} value={comments[goal.achievement.id] || ''} onChange={e => setComments(p => ({ ...p, [goal.achievement!.id]: e.target.value }))} placeholder="Add feedback…" className="form-textarea" style={{ fontSize: 12, resize: 'vertical' }} />
                                          </div>
                                          <button onClick={() => saveComment(goal.achievement!.id)} disabled={savingId === goal.achievement.id || comments[goal.achievement.id] === goal.achievement.manager_comment}
                                            className="btn btn-primary btn-sm" style={{ flexShrink: 0, marginTop: 2 }}>
                                            <Save size={13} />
                                          </button>
                                        </div>
                                      ) : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting check-in</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
