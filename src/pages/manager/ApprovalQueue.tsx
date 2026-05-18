import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { GoalSheet, Goal, Profile } from '../../types';
import { Check, X, AlertCircle, MessageSquare } from 'lucide-react';

interface GoalSheetWithRelations extends GoalSheet {
  profiles: Profile;
  goals: Goal[];
}

export function ApprovalQueue() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [sheets, setSheets] = useState<GoalSheetWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rework Modal State
  const [reworkSheetId, setReworkSheetId] = useState<string | null>(null);
  const [reworkComment, setReworkComment] = useState('');

  // Saving State
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchSheets = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const statusFilter = activeTab === 'pending' ? 'submitted' : 'approved';
      const { data, error: fetchErr } = await supabase
        .from('goal_sheets')
        .select(`
          *,
          profiles!inner(*),
          goals(*)
        `)
        .eq('status', statusFilter)
        .eq('profiles.manager_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      setSheets((data as any) || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch approval queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, [user, activeTab]);

  const updateGoal = (sheetId: string, goalId: string, field: keyof Goal, value: any) => {
    setSheets(sheets.map(sheet => {
      if (sheet.id === sheetId) {
        return {
          ...sheet,
          goals: sheet.goals.map(g => g.id === goalId ? { ...g, [field]: value } : g)
        };
      }
      return sheet;
    }));
  };

  const validateSheet = (sheet: GoalSheetWithRelations) => {
    const totalWeightage = sheet.goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);
    if (totalWeightage !== 100) return "Total weightage must be exactly 100%";

    for (let i = 0; i < sheet.goals.length; i++) {
      const g = sheet.goals[i];
      if (!g.weightage || g.weightage < 10 || g.weightage > 90) return `Goal ${i + 1}: Weightage must be between 10% and 90%`;
      if (g.uom_type === 'timeline' && !g.target_date) return `Goal ${i + 1}: Target date is required`;
      if (g.uom_type !== 'timeline' && (g.target_value === undefined || g.target_value === null || isNaN(Number(g.target_value)))) return `Goal ${i + 1}: Target value is required`;
    }
    return null;
  };

  const handleApprove = async (sheet: GoalSheetWithRelations) => {
    const validationError = validateSheet(sheet);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingId(sheet.id);
    setError(null);
    try {
      // First update all goals that might have been changed
      for (const goal of sheet.goals) {
        const { error: goalErr } = await supabase
          .from('goals')
          .update({
            weightage: goal.weightage,
            target_value: goal.target_value,
            target_date: goal.target_date
          })
          .eq('id', goal.id);
        if (goalErr) throw goalErr;
      }

      // Update sheet status
      const { error: sheetErr } = await supabase
        .from('goal_sheets')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user!.id
        })
        .eq('id', sheet.id);

      if (sheetErr) throw sheetErr;

      // Audit log
      await supabase.from('audit_logs').insert({
        entity_type: 'goal_sheet',
        entity_id: sheet.id,
        action: 'APPROVE_GOAL_SHEET',
        changed_by: user!.id
      });

      // Remove from list
      setSheets(sheets.filter(s => s.id !== sheet.id));
    } catch (err: any) {
      console.error(err);
      setError('Failed to approve sheet.');
    } finally {
      setSavingId(null);
    }
  };

  const handleReworkSubmit = async () => {
    if (!reworkSheetId) return;
    if (!reworkComment.trim()) {
      setError("Please provide a comment for rework.");
      return;
    }

    setSavingId(reworkSheetId);
    setError(null);
    try {
      const { error: sheetErr } = await supabase
        .from('goal_sheets')
        .update({
          status: 'rework',
          manager_comment: reworkComment
        })
        .eq('id', reworkSheetId);

      if (sheetErr) throw sheetErr;

      // Audit log
      await supabase.from('audit_logs').insert({
        entity_type: 'goal_sheet',
        entity_id: reworkSheetId,
        action: 'RETURN_FOR_REWORK',
        changed_by: user!.id,
        new_value: { comment: reworkComment }
      });

      // Remove from list
      setSheets(sheets.filter(s => s.id !== reworkSheetId));
      setReworkSheetId(null);
      setReworkComment('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to return for rework.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading && sheets.length === 0) {
    return <div className="p-8 text-center text-slate-500">Loading queue...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8 border-b border-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Team Goal Approvals</h1>
        <div className="flex space-x-8">
          <button
            className={`pb-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approvals
          </button>
          <button
            className={`pb-4 px-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'approved' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
          <AlertCircle size={18} className="mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-6">
        {sheets.length === 0 && !loading && (
          <div className="text-center p-12 bg-slate-50 border border-dashed border-slate-300 rounded-md">
            <Check className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <h3 className="text-sm font-medium text-slate-900">All caught up!</h3>
            <p className="text-sm text-slate-500 mt-1">No goal sheets in this queue.</p>
          </div>
        )}

        {sheets.map((sheet) => {
          const totalWeightage = sheet.goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);
          const isPending = activeTab === 'pending';

          return (
            <div key={sheet.id} className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{sheet.profiles.full_name || 'Unknown Employee'}</h3>
                  <p className="text-sm text-slate-500">Submitted on {new Date(sheet.updated_at || sheet.created_at || '').toLocaleDateString()}</p>
                </div>
                {isPending && (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setReworkSheetId(sheet.id)}
                      disabled={savingId === sheet.id}
                      className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50"
                    >
                      Return for Rework
                    </button>
                    <button
                      onClick={() => handleApprove(sheet)}
                      disabled={savingId === sheet.id || totalWeightage !== 100}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50"
                    >
                      {savingId === sheet.id ? 'Saving...' : 'Approve'}
                    </button>
                  </div>
                )}
              </div>

              <div className="px-6 py-5">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thrust Area</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-1/3">Title</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Weightage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sheet.goals.map((goal) => (
                        <tr key={goal.id}>
                          <td className="px-3 py-4 text-sm text-slate-700">{goal.thrust_area}</td>
                          <td className="px-3 py-4 text-sm text-slate-900 font-medium">
                            {goal.title}
                            {goal.description && <p className="text-xs text-slate-500 mt-1 font-normal">{goal.description}</p>}
                          </td>
                          <td className="px-3 py-4 text-sm text-slate-500">{goal.uom_type}</td>
                          <td className="px-3 py-4 text-sm">
                            {isPending ? (
                              goal.uom_type === 'timeline' ? (
                                <input
                                  type="date"
                                  value={goal.target_date || ''}
                                  onChange={(e) => updateGoal(sheet.id, goal.id, 'target_date', e.target.value)}
                                  className="w-full min-w-[130px] border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                              ) : (
                                <input
                                  type="number"
                                  value={goal.target_value ?? ''}
                                  onChange={(e) => updateGoal(sheet.id, goal.id, 'target_value', parseFloat(e.target.value))}
                                  className="w-full min-w-[100px] border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                              )
                            ) : (
                              <span className="text-slate-700">
                                {goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-sm text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end">
                                <input
                                  type="number"
                                  value={goal.weightage || ''}
                                  onChange={(e) => updateGoal(sheet.id, goal.id, 'weightage', parseInt(e.target.value) || 0)}
                                  className="w-20 border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-right"
                                />
                                <span className="ml-1 text-slate-500">%</span>
                              </div>
                            ) : (
                              <span className="text-slate-700 font-medium">{goal.weightage}%</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {isPending && (
                      <tfoot>
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-sm font-medium text-right text-slate-700">Total Weightage:</td>
                          <td className={`px-3 py-4 text-sm font-bold text-right ${totalWeightage === 100 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalWeightage}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rework Modal */}
      {reworkSheetId && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-slate-900 flex items-center">
                <MessageSquare size={18} className="mr-2 text-slate-500" />
                Return for Rework
              </h3>
              <button
                onClick={() => { setReworkSheetId(null); setReworkComment(''); }}
                className="text-slate-400 hover:text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Manager Comments
              </label>
              <textarea
                rows={4}
                value={reworkComment}
                onChange={(e) => setReworkComment(e.target.value)}
                placeholder="Explain what needs to be changed..."
                className="w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <p className="mt-2 text-sm text-slate-500">
                These comments will be visible to the employee.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => { setReworkSheetId(null); setReworkComment(''); }}
                className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleReworkSubmit}
                disabled={savingId === reworkSheetId || !reworkComment.trim()}
                className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 disabled:opacity-50"
              >
                {savingId === reworkSheetId ? 'Sending...' : 'Return to Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
