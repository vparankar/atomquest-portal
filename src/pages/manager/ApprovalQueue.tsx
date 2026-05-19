import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { GoalSheet, Goal, Profile } from '../../types';
import { Check, X, MessageSquare } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

interface GoalSheetWithRelations extends GoalSheet {
  profiles: Profile;
  goals: Goal[];
}

export function ApprovalQueue() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [sheets, setSheets] = useState<GoalSheetWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [reworkSheetId, setReworkSheetId] = useState<string | null>(null);
  const [reworkComment, setReworkComment] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSheets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const statusFilter = activeTab === 'pending' ? 'submitted' : 'approved';
      const { data, error } = await supabase.from('goal_sheets').select('*, profiles!goal_sheets_employee_id_fkey!inner(*), goals(*)').eq('status', statusFilter).eq('profiles.manager_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setSheets((data as any) || []);
    } catch { toast.error('Failed to fetch approval queue.'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchSheets(); }, [user, activeTab]);

  const updateGoal = (sheetId: string, goalId: string, field: keyof Goal, value: any) => {
    setSheets(sheets.map(s => s.id === sheetId ? { ...s, goals: s.goals.map(g => g.id === goalId ? { ...g, [field]: value } : g) } : s));
  };

  const validateSheet = (sheet: GoalSheetWithRelations) => {
    const total = sheet.goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
    if (total !== 100) return 'Total weightage must be exactly 100%';
    for (let i = 0; i < sheet.goals.length; i++) {
      const g = sheet.goals[i];
      if (!g.weightage || g.weightage < 10 || g.weightage > 90) return `Goal ${i + 1}: Weightage must be 10–90%`;
      if (g.uom_type === 'timeline' && !g.target_date) return `Goal ${i + 1}: Target date required`;
      if (g.uom_type !== 'timeline' && (g.target_value === undefined || g.target_value === null || isNaN(Number(g.target_value)))) return `Goal ${i + 1}: Target value required`;
    }
    return null;
  };

  const handleApprove = async (sheet: GoalSheetWithRelations) => {
    const err = validateSheet(sheet);
    if (err) { toast.error(err); return; }
    setSavingId(sheet.id);
    try {
      for (const g of sheet.goals) {
        const { error } = await supabase.from('goals').update({ weightage: g.weightage, target_value: g.target_value, target_date: g.target_date }).eq('id', g.id);
        if (error) throw error;
      }
      const { error } = await supabase.from('goal_sheets').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user!.id }).eq('id', sheet.id);
      if (error) throw error;
      await supabase.from('audit_logs').insert({ entity_type: 'goal_sheet', entity_id: sheet.id, action: 'APPROVE_GOAL_SHEET', changed_by: user!.id });
      setSheets(sheets.filter(s => s.id !== sheet.id));
      toast.success('Sheet approved');
      
      if (localStorage.getItem('atomquest_teams_enabled') === 'true') {
        setTimeout(() => toast.success('Teams notification sent to employee'), 800);
      }
      if (localStorage.getItem('atomquest_email_enabled') === 'true') {
        setTimeout(() => toast.success('Goal approval email sent to employee'), 1400);
      }
    } catch { toast.error('Failed to approve sheet.'); } finally { setSavingId(null); }
  };

  const handleReworkSubmit = async () => {
    if (!reworkSheetId || !reworkComment.trim()) { toast.error('Please provide a comment.'); return; }
    setSavingId(reworkSheetId);
    try {
      const { error } = await supabase.from('goal_sheets').update({ status: 'rework', manager_comment: reworkComment }).eq('id', reworkSheetId);
      if (error) throw error;
      await supabase.from('audit_logs').insert({ entity_type: 'goal_sheet', entity_id: reworkSheetId, action: 'RETURN_FOR_REWORK', changed_by: user!.id, new_value: { comment: reworkComment } });
      setSheets(sheets.filter(s => s.id !== reworkSheetId));
      setReworkSheetId(null); setReworkComment('');
      toast.success('Sheet returned for rework');
    } catch { toast.error('Failed.'); } finally { setSavingId(null); }
  };

  if (loading && sheets.length === 0) return <div style={{ padding: 32 }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Team Goal Approvals</h1>
        <p className="page-subtitle">Review and approve submitted goal sheets from your team.</p>
      </div>

      {/* Tabs */}
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        {(['pending', 'approved'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`tab-btn${activeTab === t ? ' tab-btn-active' : ''}`}>
            {t === 'pending' ? 'Pending Approvals' : 'Approved'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sheets.length === 0 && !loading && (
          <div className="card">
            <div className="empty-state">
              <Check size={32} className="empty-state-icon" />
              <div className="empty-state-title">All caught up!</div>
              <div className="empty-state-text">No goal sheets in this queue.</div>
            </div>
          </div>
        )}

        {sheets.map(sheet => {
          const totalW = sheet.goals.reduce((s, g) => s + (Number(g.weightage) || 0), 0);
          const isPending = activeTab === 'pending';
          return (
            <div key={sheet.id} className="card">
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sheet.profiles.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Submitted {new Date(sheet.created_at || '').toLocaleDateString()}</div>
                </div>
                {isPending && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setReworkSheetId(sheet.id)} disabled={savingId === sheet.id} className="btn btn-secondary btn-sm">Return for Rework</button>
                    <button onClick={() => handleApprove(sheet)} disabled={savingId === sheet.id || totalW !== 100} className="btn btn-primary btn-sm">
                      {savingId === sheet.id ? 'Saving…' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>

              {/* Goals table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)' }}>
                      {['Thrust Area', 'Title', 'Type', 'Target', 'Weightage'].map(h => (
                        <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.goals.map(goal => (
                      <tr key={goal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{goal.thrust_area}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text)' }}>
                          {goal.title}
                          {goal.description && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 }}>{goal.description}</p>}
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{goal.uom_type}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {isPending ? (
                            goal.uom_type === 'timeline'
                              ? <input type="date" value={goal.target_date || ''} onChange={e => updateGoal(sheet.id, goal.id, 'target_date', e.target.value)} className="form-input" style={{ width: 140 }} />
                              : <input type="number" value={goal.target_value ?? ''} onChange={e => updateGoal(sheet.id, goal.id, 'target_value', parseFloat(e.target.value))} className="form-input" style={{ width: 100 }} />
                          ) : <span style={{ color: 'var(--text-secondary)' }}>{goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}</span>}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input type="number" value={goal.weightage || ''} onChange={e => updateGoal(sheet.id, goal.id, 'weightage', parseInt(e.target.value) || 0)} className="form-input" style={{ width: 64, textAlign: 'right' }} />
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                            </div>
                          ) : <span style={{ fontWeight: 600, color: 'var(--text)' }}>{goal.weightage}%</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {isPending && (
                    <tfoot>
                      <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td colSpan={4} style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Total Weightage:</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: totalW === 100 ? 'var(--green)' : 'var(--red)' }}>{totalW}%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rework Modal */}
      {reworkSheetId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                <MessageSquare size={16} style={{ color: 'var(--text-muted)' }} />
                Return for Rework
              </div>
              <button onClick={() => { setReworkSheetId(null); setReworkComment(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <label className="form-label">Manager Comments</label>
              <textarea rows={4} value={reworkComment} onChange={e => setReworkComment(e.target.value)} placeholder="Explain what needs to be changed…" className="form-textarea" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>These comments will be visible to the employee.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-raised)' }}>
              <button onClick={() => { setReworkSheetId(null); setReworkComment(''); }} className="btn btn-secondary">Cancel</button>
              <button onClick={handleReworkSubmit} disabled={savingId === reworkSheetId || !reworkComment.trim()} className="btn btn-primary">
                {savingId === reworkSheetId ? 'Sending…' : 'Return to Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
