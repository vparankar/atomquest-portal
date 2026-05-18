import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { GoalSheet as GoalSheetType, Goal, Cycle } from '../../types';
import { Lock, Plus, Trash2, AlertCircle, Info } from 'lucide-react';

const THRUST_AREAS = ["Revenue", "Cost", "Customer", "People", "Process", "Quality"];
const UOM_TYPES = [
  { value: "min", label: "Numeric (Higher is better)" },
  { value: "max", label: "Numeric (Lower is better)" },
  { value: "timeline", label: "Timeline (Date)" },
  { value: "zero", label: "Zero (Zero = success)" }
];

export function GoalSheet() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [goalSheet, setGoalSheet] = useState<GoalSheetType | null>(null);
  const [goals, setGoals] = useState<Partial<Goal>[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('Failed to load goal sheet data');
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
    updated[index] = { ...updated[index], [field]: value };
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
      setError(validationError);
      return;
    }
    setError(null);
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
            status: 'submitted'
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
        employee_id: user!.id,
        action: 'SUBMIT_GOAL_SHEET',
        details: { sheet_id: currentSheetId, num_goals: goals.length }
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading goal sheet...</div>;
  }

  if (!activeCycle) {
    return <div className="p-8 text-center text-red-500">No active cycle found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Goals</h1>
          <p className="text-slate-500 mt-1">Cycle: {activeCycle.year} - {activeCycle.phase.toUpperCase()}</p>
        </div>

        {goalSheet && (
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded text-sm font-medium uppercase tracking-wider
              ${goalSheet.status === 'approved' ? 'bg-green-100 text-green-700' :
                goalSheet.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                  goalSheet.status === 'rework' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-700'}`}>
              {goalSheet.status}
            </span>
            {isReadOnly && <Lock size={18} className="text-slate-400" />}
          </div>
        )}
      </div>

      {isRework && goalSheet?.manager_comment && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start">
          <AlertCircle className="text-amber-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-medium text-amber-800">Manager Comment (Rework)</h4>
            <p className="text-amber-700 mt-1">{goalSheet.manager_comment}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
          <AlertCircle size={18} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {goals.map((goal, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-md p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-slate-800">Goal {index + 1}</h3>
              {!isReadOnly && goals.length > 1 && (
                <button
                  onClick={() => removeGoal(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove Goal"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Thrust Area */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Thrust Area</label>
                <select
                  disabled={isReadOnly}
                  value={goal.thrust_area || ''}
                  onChange={e => updateGoal(index, 'thrust_area', e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {THRUST_AREAS.map(ta => <option key={ta} value={ta}>{ta}</option>)}
                </select>
              </div>

              {/* Weightage */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Weightage (%)</label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  value={goal.weightage || ''}
                  onChange={e => updateGoal(index, 'weightage', parseInt(e.target.value) || 0)}
                  min={10} max={90}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={goal.title || ''}
                  onChange={e => updateGoal(index, 'title', e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="E.g., Increase Q3 Sales Revenue"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  disabled={isReadOnly}
                  value={goal.description || ''}
                  onChange={e => updateGoal(index, 'description', e.target.value)}
                  rows={2}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              {/* UoM Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit of Measurement</label>
                <select
                  disabled={isReadOnly}
                  value={goal.uom_type || 'min'}
                  onChange={e => updateGoal(index, 'uom_type', e.target.value)}
                  className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {UOM_TYPES.map(uom => <option key={uom.value} value={uom.value}>{uom.label}</option>)}
                </select>
              </div>

              {/* Target Value/Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
                {goal.uom_type === 'timeline' ? (
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={goal.target_date || ''}
                    onChange={e => updateGoal(index, 'target_date', e.target.value)}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                ) : (
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={goal.target_value !== undefined ? goal.target_value : ''}
                    onChange={e => updateGoal(index, 'target_value', parseFloat(e.target.value))}
                    className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isReadOnly && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between bg-white p-4 border border-slate-200 rounded-md shadow-sm">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <button
              onClick={addGoal}
              disabled={goals.length >= 8}
              className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={18} className="mr-1" />
              Add Another Goal
            </button>
            <span className="text-xs text-slate-500 flex items-center">
              <Info size={14} className="mr-1" />
              Max 8 goals allowed
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="text-sm text-slate-500 mr-2">Total Weightage:</span>
              <span className={`text-lg font-semibold ${totalWeightage > 100 ? 'text-red-600' :
                totalWeightage === 100 ? 'text-green-600' : 'text-slate-700'
                }`}>
                {totalWeightage}%
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={saving || totalWeightage !== 100}
              className="bg-slate-900 text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
