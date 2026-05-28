import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle, Goal } from '../../types';
import { AlertCircle, Save } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

interface GoalWithCheckIn extends Goal {
  achievement_id?: string;
  actual_value?: number | string;
  actual_date?: string;
  checkin_status: 'not_started' | 'on_track' | 'completed';
  score?: number;
  manager_comment?: string;
}

export function CheckIn() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [goals, setGoals] = useState<GoalWithCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialGoalsRef = useRef<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user?.id]);

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
      if (!cycleData) {
        setLoading(false);
        return;
      }

      setActiveCycle(cycleData);

      // Check if window is open
      const today = new Date().toISOString().split('T')[0];
      const open = today >= cycleData.opens_at && today <= cycleData.closes_at;
      setIsOpen(open);

      if (!open) {
        setLoading(false);
        return;
      }

      // Fetch approved goal sheet
      const { data: sheetData, error: sheetError } = await supabase
        .from('goal_sheets')
        .select('*')
        .eq('employee_id', user!.id)
        .eq('cycle_id', cycleData.id)
        .eq('status', 'approved')
        .maybeSingle();

      if (sheetError) throw sheetError;

      if (sheetData) {
        // Fetch goals
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals')
          .select('*')
          .eq('sheet_id', sheetData.id);

        if (goalsError) throw goalsError;

        // Fetch existing achievements for this cycle phase
        const { data: achievementsData, error: achievementsError } = await supabase
          .from('achievements')
          .select('*')
          .in('goal_id', goalsData?.map(g => g.id) || [])
          .eq('cycle_phase', cycleData.phase);

        if (achievementsError) throw achievementsError;

        const merged: GoalWithCheckIn[] = (goalsData || []).map(g => {
          const ach = achievementsData?.find(a => a.goal_id === g.id);
          return {
            ...g,
            achievement_id: ach?.id,
            actual_value: ach?.actual_value !== null ? ach?.actual_value : '',
            actual_date: ach?.actual_date || '',
            checkin_status: ach?.status || 'not_started',
            score: ach?.score || 0,
            manager_comment: ach?.manager_comment || ''
          };
        });

        setGoals(merged);
        initialGoalsRef.current = JSON.stringify(merged.map(g => ({ actual_value: g.actual_value, actual_date: g.actual_date, checkin_status: g.checkin_status })));
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const computeScore = (goal: GoalWithCheckIn, actualVal: number | string, actualDate: string): number => {
    if (goal.uom_type === 'timeline') {
      if (!actualDate || !goal.target_date) return 0;
      return actualDate <= goal.target_date ? 100 : 0;
    }

    const actual = Number(actualVal) || 0;
    const target = Number(goal.target_value) || 0;

    if (goal.uom_type === 'zero') {
      return actual === 0 ? 100 : 0;
    }

    if (goal.uom_type === 'min') {
      if (target === 0) return 0;
      return Math.min((actual / target) * 100, 100);
    }

    if (goal.uom_type === 'max') {
      if (actual === 0) return 100;
      return (target / actual) * 100;
    }

    return 0;
  };

  const handleChange = (index: number, field: string, value: any) => {
    const updated = [...goals];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-compute score if actuals change
    if (field === 'actual_value' || field === 'actual_date') {
      const actualVal = field === 'actual_value' ? value : updated[index].actual_value;
      const actualDate = field === 'actual_date' ? value : updated[index].actual_date;
      updated[index].score = Math.round(computeScore(updated[index], actualVal as any, actualDate as any));
    }

    setGoals(updated);
  };

  const handleSave = async () => {
    if (!activeCycle) return;
    setSaving(true);

    try {
      const achievementsToUpsert = goals.map(g => {
        const payload: any = {
          goal_id: g.id,
          cycle_phase: activeCycle.phase,
          status: g.checkin_status,
          score: g.score || 0
        };

        if (g.achievement_id) {
          payload.id = g.achievement_id;
        }

        if (g.uom_type === 'timeline') {
          payload.actual_date = g.actual_date || null;
          payload.actual_value = null;
        } else {
          payload.actual_value = g.actual_value !== '' && g.actual_value !== undefined ? Number(g.actual_value) : null;
          payload.actual_date = null;
        }

        return payload;
      });

      const { data, error } = await supabase
        .from('achievements')
        .upsert(achievementsToUpsert)
        .select();

      if (error) throw error;

      // Update the status in the goals table for each goal to stay in sync
      const goalUpdates = goals.map(g =>
        supabase
          .from('goals')
          .update({ status: g.checkin_status })
          .eq('id', g.id)
      );
      const updateResults = await Promise.all(goalUpdates);
      const updateError = updateResults.find(r => r.error)?.error;
      if (updateError) throw updateError;

      // Update local state with newly created IDs if any
      const updatedGoals = goals.map(g => {
        const matchingAch = data?.find(a => a.goal_id === g.id);
        if (matchingAch) {
          return { ...g, achievement_id: matchingAch.id };
        }
        return g;
      });
      setGoals(updatedGoals);
      initialGoalsRef.current = JSON.stringify(updatedGoals.map(g => ({ actual_value: g.actual_value, actual_date: g.actual_date, checkin_status: g.checkin_status })));

      toast.success('Check-in saved successfully!');

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

  if (!isOpen) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <AlertCircle size={36} style={{ color: 'var(--border-strong)' }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Check-in window not open
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            The current check-in phase ({activeCycle.phase.toUpperCase()}) is open from {activeCycle.opens_at} to {activeCycle.closes_at}.
          </p>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
        <div className="alert alert-amber" style={{ flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
          <AlertCircle size={36} style={{ marginBottom: 12, color: 'var(--amber)' }} />
          <strong style={{ fontSize: 16, marginBottom: 4 }}>No Approved Goals Found</strong>
          <span style={{ fontSize: 13 }}>
            You do not have an approved goal sheet for the current cycle phase.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 32px' }}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.3 }}>
            Check-In
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Cycle: {activeCycle.year} - {activeCycle.phase.toUpperCase()}
          </p>
        </div>
      </div>

      {/* ── Goals List ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {goals.map((goal, index) => (
          <div key={goal.id} className="card" style={{ padding: 0 }}>
            {/* Goal Info Header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <span className="badge badge-gray" style={{ marginBottom: 6, display: 'inline-block' }}>
                  {goal.thrust_area}
                </span>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {goal.title}
                </h3>
                {goal.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{goal.description}</p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Target</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}
                  {goal.uom_type !== 'timeline' && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>({goal.uom_type})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Check-in Fields */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: 16, alignItems: 'end' }}>
                {/* Actual Value/Date */}
                <div>
                  <label className="form-label">
                    Actual {goal.uom_type === 'timeline' ? 'Date' : 'Value'}
                  </label>
                  {goal.uom_type === 'timeline' ? (
                    <input
                      type="date"
                      value={goal.actual_date || ''}
                      onChange={e => handleChange(index, 'actual_date', e.target.value)}
                      className="form-input"
                    />
                  ) : (
                    <input
                      type="number"
                      value={goal.actual_value || ''}
                      onChange={e => handleChange(index, 'actual_value', e.target.value)}
                      className="form-input"
                    />
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={goal.checkin_status}
                    onChange={e => handleChange(index, 'checkin_status', e.target.value)}
                    className="form-select"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="on_track">On Track</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Score */}
                <div style={{
                  background: 'var(--surface-raised)', padding: '8px 12px',
                  borderRadius: 'var(--radius-md)', textAlign: 'center',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                    Score
                  </div>
                  <div style={{
                    fontSize: 18, fontWeight: 700,
                    color: (goal.score || 0) >= 100 ? 'var(--green)' :
                      (goal.score || 0) >= 50 ? 'var(--amber)' : 'var(--text-secondary)',
                  }}>
                    {goal.score || 0}%
                  </div>
                </div>
              </div>

              {/* Manager Comment */}
              {goal.manager_comment && (
                <div className="alert alert-blue" style={{ marginTop: 16 }}>
                  <div>
                    <strong>Manager Comment: </strong>
                    <span>{goal.manager_comment}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Save Button ─────────────────────────────────────────── */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={saving || JSON.stringify(goals.map(g => ({ actual_value: g.actual_value, actual_date: g.actual_date, checkin_status: g.checkin_status }))) === initialGoalsRef.current}
          className="btn btn-primary"
        >
          <Save size={15} />
          {saving ? 'Saving...' : 'Save Check-In'}
        </button>
      </div>
    </div>
  );
}
