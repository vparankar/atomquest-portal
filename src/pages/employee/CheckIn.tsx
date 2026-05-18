import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle, Goal } from '../../types';
import { AlertCircle, Save, CheckCircle2 } from 'lucide-react';

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
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to load data' });
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
    setMessage(null);

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

      // Update local state with newly created IDs if any
      const updatedGoals = goals.map(g => {
        const matchingAch = data?.find(a => a.goal_id === g.id);
        if (matchingAch) {
          return { ...g, achievement_id: matchingAch.id };
        }
        return g;
      });
      setGoals(updatedGoals);

      setMessage({ type: 'success', text: 'Check-in saved successfully!' });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'An error occurred while saving.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  if (!activeCycle) {
    return <div className="p-8 text-center text-red-500">No active cycle found.</div>;
  }

  if (!isOpen) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Check-in window not open</h2>
          <p className="text-slate-600">
            The current check-in phase ({activeCycle.phase.toUpperCase()}) is open from {activeCycle.opens_at} to {activeCycle.closes_at}.
          </p>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-8">
          <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-amber-800 mb-2">No Approved Goals Found</h2>
          <p className="text-amber-700">
            You do not have an approved goal sheet for the current cycle phase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-end border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Check-In</h1>
          <p className="text-slate-500 mt-1">Cycle: {activeCycle.year} - {activeCycle.phase.toUpperCase()}</p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-md flex items-center ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} className="mr-2" /> : <AlertCircle size={18} className="mr-2" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {goals.map((goal, index) => (
          <div key={goal.id} className="bg-white border border-slate-200 rounded-md p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded mb-2">{goal.thrust_area}</span>
                <h3 className="text-lg font-medium text-slate-800">{goal.title}</h3>
                {goal.description && <p className="text-sm text-slate-500 mt-1">{goal.description}</p>}
              </div>
              <div className="mt-4 md:mt-0 text-right">
                <div className="text-sm text-slate-500">Target</div>
                <div className="font-medium text-slate-900">
                  {goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}
                  {goal.uom_type !== 'timeline' && <span className="text-xs text-slate-400 ml-1">({goal.uom_type})</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Actual {goal.uom_type === 'timeline' ? 'Date' : 'Value'}
                </label>
                {goal.uom_type === 'timeline' ? (
                  <input
                    type="date"
                    value={goal.actual_date || ''}
                    onChange={e => handleChange(index, 'actual_date', e.target.value)}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                ) : (
                  <input
                    type="number"
                    value={goal.actual_value || ''}
                    onChange={e => handleChange(index, 'actual_value', e.target.value)}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={goal.checkin_status}
                  onChange={e => handleChange(index, 'checkin_status', e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="not_started">Not Started</option>
                  <option value="on_track">On Track</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-md text-center border border-slate-100">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Score</div>
                <div className={`text-xl font-semibold ${(goal.score || 0) >= 100 ? 'text-green-600' :
                  (goal.score || 0) >= 50 ? 'text-amber-600' : 'text-slate-700'
                  }`}>
                  {goal.score || 0}%
                </div>
              </div>
            </div>

            {goal.manager_comment && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded text-sm">
                <span className="font-semibold text-blue-800">Manager Comment: </span>
                <span className="text-blue-700">{goal.manager_comment}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center bg-slate-900 text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={18} className="mr-2" />
          {saving ? 'Saving...' : 'Save Check-In'}
        </button>
      </div>
    </div>
  );
}
