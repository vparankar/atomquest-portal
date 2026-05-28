import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { GoalSheet as GoalSheetType, Goal, Cycle } from '../../types';
import { Lock, Plus, Trash2, AlertCircle, Info } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { notificationService } from '../../lib/notifications';

const THRUST_AREAS = ["Revenue", "Cost", "Customer", "People", "Process", "Quality"];
const UOM_TYPES = [
  { value: "min", label: "Numeric (Higher is better)" },
  { value: "max", label: "Numeric (Lower is better)" },
  { value: "timeline", label: "Timeline (Date)" },
  { value: "zero", label: "Zero (Zero = success)" }
];

const statusBadge: Record<string, string> = {
  approved:  'badge badge-green',
  submitted: 'badge badge-blue',
  rework:    'badge badge-amber',
  draft:     'badge badge-gray',
};

export function GoalSheet() {
  const { user, profile } = useAuth();
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [goalSheet, setGoalSheet] = useState<GoalSheetType | null>(null);
  const [goals, setGoals] = useState<Partial<Goal>[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      try {
        setLoading(true);
        // Fetch active cycle
        const { data: cycleData, error: cycleError } = await supabase
          .from('cycles')
          .select('*')
          .eq('is_active', true)
          .single();

        if (cycleError) throw cycleError;
        setActiveCycle(cycleData);

        // Fetch goal sheet if exists
        if (cycleData) {
          const { data: sheetData, error: sheetError } = await supabase
            .from('goal_sheets')
            .select('*')
            .eq('employee_id', user!.id)
            .eq('cycle_id', cycleData.id)
            .maybeSingle();

          if (sheetError) throw sheetError;

          if (sheetData) {
            setGoalSheet(sheetData);

            // Fetch goals
            const { data: goalsData, error: goalsError } = await supabase
              .from('goals')
              .select('*')
              .eq('sheet_id', sheetData.id);

            if (goalsError) throw goalsError;
            setGoals(goalsData || []);
          } else {
            // Start with one empty goal
            setGoals([createEmptyGoal()]);
          }
        }
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to load goal sheet data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.id]);

  const createEmptyGoal = (): Partial<Goal> => ({
    thrust_area: THRUST_AREAS[0],
    title: '',
    description: '',
    uom_type: 'min',
    target_value: undefined,
    target_date: undefined,
    weightage: undefined,
    status: 'not_started'
  });

  const addGoal = () => {
    if (goals.length < 8) {
      setGoals([...goals, createEmptyGoal()]);
    }
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const updateGoal = (index: number, field: keyof Goal, value: any) => {
    const updated = [...goals];
    
    if (field === 'weightage') {
      const parsedValue = value === '' ? undefined : Number(value);
      const currentTotalWithoutThisGoal = goals.reduce((sum, g, i) => i !== index ? sum + (Number(g.weightage) || 0) : sum, 0);
      if (parsedValue !== undefined && currentTotalWithoutThisGoal + parsedValue > 100) {
        toast.error(`Weightage cannot exceed remaining available (${100 - currentTotalWithoutThisGoal}%)`);
        return;
      }
      updated[index] = { ...updated[index], [field]: parsedValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    // Clear the other target field based on uom
    if (field === 'uom_type') {
      if (value === 'timeline') {
        updated[index].target_value = undefined;
      } else {
        updated[index].target_date = undefined;
      }
    }
    setGoals(updated);
  };

  const totalWeightage = goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);

  const isReadOnly = goalSheet?.status === 'approved' || goalSheet?.status === 'submitted';
  const isRework = goalSheet?.status === 'rework';

  const validate = () => {
    if (goals.length === 0) return "Add at least one goal";
    if (totalWeightage !== 100) return "Total weightage must be exactly 100%";

    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      if (!g.title?.trim()) return `Goal ${i + 1}: Title is required`;
      if (!g.weightage || g.weightage < 10 || g.weightage > 90) return `Goal ${i + 1}: Weightage must be between 10% and 90%`;
      if (g.uom_type === 'timeline' && !g.target_date) return `Goal ${i + 1}: Target date is required`;
      if (g.uom_type !== 'timeline' && (g.target_value === undefined || g.target_value === null || isNaN(g.target_value))) return `Goal ${i + 1}: Target value is required`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);

    try {
      let currentSheetId = goalSheet?.id;

      if (!currentSheetId) {
        // Create new sheet
        const { data: newSheet, error: sheetErr } = await supabase
          .from('goal_sheets')
          .insert({
            employee_id: user!.id,
            cycle_id: activeCycle!.id,
            status: 'submitted',
            submitted_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sheetErr) throw sheetErr;
        currentSheetId = newSheet.id;
        setGoalSheet(newSheet);
      } else {
        // Update existing sheet to submitted
        const { error: sheetErr } = await supabase
          .from('goal_sheets')
          .update({ status: 'submitted' })
          .eq('id', currentSheetId);

        if (sheetErr) throw sheetErr;
        setGoalSheet({ ...goalSheet!, status: 'submitted' });
      }

      // Upsert goals
      const { error: delErr } = await supabase
        .from('goals')
        .delete()
        .eq('sheet_id', currentSheetId);

      if (delErr) throw delErr;

      const goalsToInsert = goals.map(g => ({
        sheet_id: currentSheetId,
        thrust_area: g.thrust_area,
        title: g.title,
        description: g.description || null,
        uom_type: g.uom_type,
        target_value: g.target_value !== undefined ? Number(g.target_value) : null,
        target_date: g.target_date || null,
        weightage: Number(g.weightage),
        status: g.status || 'not_started'
      }));

      const { error: insertErr } = await supabase
        .from('goals')
        .insert(goalsToInsert);

      if (insertErr) throw insertErr;

      // Audit log
      await supabase.from('audit_logs').insert({
        entity_type: 'goal_sheet',
        entity_id: currentSheetId,
        action: 'SUBMIT_GOAL_SHEET',
        changed_by: user!.id,
        new_value: { num_goals: goals.length }
      });

      toast.success('Goals submitted successfully!');

      if (profile?.manager_id) {
        await notificationService.createNotification({
          user_id: profile.manager_id,
          type: 'goal_submitted',
          title: 'Goal Sheet Submitted',
          message: `${profile.full_name || 'An employee'} has submitted their goal sheet for approval.`,
          action_url: '/manager/team'
        });
      }

      if (localStorage.getItem('atomquest_teams_enabled') === 'true') {
        setTimeout(() => toast.success('Teams notification sent to your manager'), 800);
      }
      if (localStorage.getItem('atomquest_email_enabled') === 'true') {
        setTimeout(() => toast.success('Approval request email sent to your manager'), 1400);
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32 }}><Spinner /></div>;
  }

  if (!activeCycle) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
        <div className="alert alert-red">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>No active cycle found.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
            My Goals
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Cycle: {activeCycle.year} - {activeCycle.phase.toUpperCase()}
          </p>
        </div>

        {goalSheet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={statusBadge[goalSheet.status] || 'badge badge-gray'}
              style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {goalSheet.status}
            </span>
            {isReadOnly && <Lock size={15} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}
      </div>

      {/* ── Rework Alert ────────────────────────────────────────── */}
      {isRework && goalSheet?.manager_comment && (
        <div className="alert alert-amber" style={{ marginBottom: 20 }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', marginBottom: 2 }}>Manager Comment (Rework)</strong>
            <span>{goalSheet.manager_comment}</span>
          </div>
        </div>
      )}

      {/* ── Goals List ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {goals.length === 0 && (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div className="empty-state-icon">
              <AlertCircle size={32} style={{ color: 'var(--border-strong)' }} />
            </div>
            <p className="empty-state-title">No goals yet.</p>
            {!isReadOnly && (
              <button onClick={addGoal} className="btn btn-primary" style={{ marginTop: 16 }}>
                <Plus size={15} /> Add your first goal
              </button>
            )}
          </div>
        )}

        {goals.map((goal, index) => (
          <div key={index} className="card" style={{ padding: 0 }}>
            {/* Goal Card Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Goal {index + 1}</h3>
              </div>
              {!isReadOnly && goals.length > 1 && !(goal.is_shared || goal.shared_from) && (
                <button
                  onClick={() => removeGoal(index)}
                  className="btn btn-danger btn-sm"
                  title="Remove Goal"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {/* Goal Card Body */}
            <div style={{ padding: 20 }}>
              {/* Row 1: Thrust Area + Weightage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label">Thrust Area</label>
                  <select
                    disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                    value={goal.thrust_area || ''}
                    onChange={e => updateGoal(index, 'thrust_area', e.target.value)}
                    className="form-select"
                    style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                  >
                    {THRUST_AREAS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Weightage (%)</label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={goal.weightage || ''}
                    onChange={e => updateGoal(index, 'weightage', e.target.value)}
                    min={10} max={100}
                    className="form-input"
                    style={isReadOnly ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                  />
                </div>
              </div>

              {/* Row 2: Goal Title */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Goal Title</label>
                <input
                  type="text"
                  disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                  value={goal.title || ''}
                  onChange={e => updateGoal(index, 'title', e.target.value)}
                  className="form-input"
                  placeholder="E.g., Increase Q3 Sales Revenue"
                  style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                />
              </div>

              {/* Row 3: Description */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                  value={goal.description || ''}
                  onChange={e => updateGoal(index, 'description', e.target.value)}
                  rows={2}
                  className="form-textarea"
                  style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                />
              </div>

              {/* Row 4: UoM + Target */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
                <div>
                  <label className="form-label">Unit of Measurement</label>
                  <select
                    disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                    value={goal.uom_type || 'min'}
                    onChange={e => updateGoal(index, 'uom_type', e.target.value)}
                    className="form-select"
                    style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                  >
                    {UOM_TYPES.map(uom => <option key={uom.value} value={uom.value}>{uom.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Target</label>
                  {goal.uom_type === 'timeline' ? (
                    <input
                      type="date"
                      disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                      value={goal.target_date || ''}
                      onChange={e => updateGoal(index, 'target_date', e.target.value)}
                      className="form-input"
                      style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                    />
                  ) : (
                    <input
                      type="number"
                      disabled={isReadOnly || !!(goal.is_shared || goal.shared_from)}
                      value={goal.target_value !== undefined ? goal.target_value : ''}
                      onChange={e => updateGoal(index, 'target_value', parseFloat(e.target.value))}
                      className="form-input"
                      style={(isReadOnly || !!(goal.is_shared || goal.shared_from)) ? { background: 'var(--surface-raised)', color: 'var(--text-muted)' } : undefined}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom Action Bar ───────────────────────────────────── */}
      {!isReadOnly && (
        <div className="card" style={{
          marginTop: 20, padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={addGoal}
              disabled={goals.length >= 8}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={15} />
              <span>Add Goal</span>
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Info size={13} />
              Max 8 goals
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 6 }}>Total Weightage:</span>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: totalWeightage > 100 ? 'var(--red)' :
                  totalWeightage === 100 ? 'var(--green)' : 'var(--amber)',
              }}>
                {totalWeightage}/100%
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || totalWeightage !== 100}
              className="btn btn-primary"
            >
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
