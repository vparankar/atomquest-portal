import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle, Profile, Goal, Achievement } from '../../types';
import { ChevronDown, ChevronUp, Save, MessageSquare, Users } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

interface TeamMemberCheckIn extends Profile {
  goals: (Goal & { achievement?: Achievement })[];
  overallStatus: 'pending' | 'completed';
}

export function CheckInReview() {
  const { user } = useAuth();
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [teamCheckIns, setTeamCheckIns] = useState<TeamMemberCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { toast } = useToast();

  // Local state for manager comments to avoid full re-renders on typing
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

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

      // Fetch team members
      const { data: teamData, error: teamError } = await supabase
        .from('profiles')
        .select('*')
        .eq('manager_id', user!.id);

      if (teamError) throw teamError;

      if (teamData && teamData.length > 0) {
        const teamIds = teamData.map(t => t.id);

        // Fetch their approved goal sheets
        const { data: sheetsData, error: sheetsError } = await supabase
          .from('goal_sheets')
          .select('id, employee_id')
          .eq('cycle_id', cycleData.id)
          .eq('status', 'approved')
          .in('employee_id', teamIds);

        if (sheetsError) throw sheetsError;

        const sheetIds = sheetsData?.map(s => s.id) || [];

        // Fetch goals
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals')
          .select('*')
          .in('sheet_id', sheetIds);

        if (goalsError) throw goalsError;

        const goalIds = goalsData?.map(g => g.id) || [];

        // Fetch achievements
        const { data: achievementsData, error: achError } = await supabase
          .from('achievements')
          .select('*')
          .eq('cycle_phase', cycleData.phase)
          .in('goal_id', goalIds);

        if (achError) throw achError;

        // Build the composite data structure
        const initialComments: Record<string, string> = {};

        const mergedTeamData = teamData.map(member => {
          const memberSheet = sheetsData?.find(s => s.employee_id === member.id);
          const memberGoals = memberSheet ? (goalsData?.filter(g => g.sheet_id === memberSheet.id) || []) : [];

          let allCompleted = true;
          let hasGoals = memberGoals.length > 0;

          const goalsWithAch = memberGoals.map(g => {
            const ach = achievementsData?.find(a => a.goal_id === g.id);
            if (!ach || ach.status !== 'completed') {
              allCompleted = false;
            }
            if (ach) {
              initialComments[ach.id] = ach.manager_comment || '';
            }
            return { ...g, achievement: ach };
          });

          return {
            ...member,
            goals: goalsWithAch,
            overallStatus: (hasGoals && allCompleted) ? 'completed' : 'pending'
          } as TeamMemberCheckIn;
        });

        setComments(initialComments);
        setTeamCheckIns(mergedTeamData);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load team check-ins');
    } finally {
      setLoading(false);
    }
  }

  const toggleRow = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const handleCommentChange = (achievementId: string, val: string) => {
    setComments(prev => ({ ...prev, [achievementId]: val }));
  };

  const saveComment = async (achievementId: string) => {
    setSavingId(achievementId);
    try {
      const { error } = await supabase
        .from('achievements')
        .update({ manager_comment: comments[achievementId] })
        .eq('id', achievementId);

      if (error) throw error;

      // Update local state to reflect the save
      setTeamCheckIns(prev => prev.map(member => ({
        ...member,
        goals: member.goals.map(g => {
          if (g.achievement?.id === achievementId) {
            return { ...g, achievement: { ...g.achievement, manager_comment: comments[achievementId] } };
          }
          return g;
        })
      })));

      toast.success('Comment saved successfully');
    } catch (err: any) {
      console.error('Failed to save comment', err);
      toast.error('Failed to save comment');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-8"><Spinner /></div>;

  if (!activeCycle) return <div className="p-8 text-center text-red-500">No active cycle found.</div>;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Team Check-In Review</h1>
        <p className="text-slate-500 mt-1">Cycle: {activeCycle.year} - {activeCycle.phase.toUpperCase()}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-medium">Employee</th>
              <th className="px-6 py-4 font-medium">Department</th>
              <th className="px-6 py-4 font-medium">Goals</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {teamCheckIns.map(member => (
              <React.Fragment key={member.id}>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{member.full_name || 'Unnamed Employee'}</td>
                  <td className="px-6 py-4 text-slate-600">{member.department || '-'}</td>
                  <td className="px-6 py-4 text-slate-600">{member.goals.length} Goals</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${member.overallStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {member.overallStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleRow(member.id)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    >
                      {expandedRow === member.id ? (
                        <>Hide Details <ChevronUp size={16} className="ml-1" /></>
                      ) : (
                        <>View Details <ChevronDown size={16} className="ml-1" /></>
                      )}
                    </button>
                  </td>
                </tr>

                {/* Expanded Details Row */}
                {expandedRow === member.id && (
                  <tr className="bg-slate-50 border-t-0">
                    <td colSpan={5} className="px-6 py-6">
                      <div className="bg-white rounded border border-slate-200 overflow-hidden">
                        {member.goals.length === 0 ? (
                          <div className="p-6 text-center text-slate-500">No approved goals found for this employee.</div>
                        ) : (
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600">
                              <tr>
                                <th className="px-4 py-3 font-medium">Goal</th>
                                <th className="px-4 py-3 font-medium">Target</th>
                                <th className="px-4 py-3 font-medium">Actual</th>
                                <th className="px-4 py-3 font-medium">Score</th>
                                <th className="px-4 py-3 font-medium">Manager Comment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {member.goals.map(goal => (
                                <tr key={goal.id}>
                                  <td className="px-4 py-4 w-1/4">
                                    <div className="font-medium text-slate-800">{goal.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">{goal.thrust_area}</div>
                                  </td>
                                  <td className="px-4 py-4 w-1/6">
                                    {goal.uom_type === 'timeline' ? goal.target_date : goal.target_value}
                                    <div className="text-xs text-slate-400">({goal.uom_type})</div>
                                  </td>
                                  <td className="px-4 py-4 w-1/6">
                                    {goal.achievement ? (
                                      <div>
                                        <span className="font-medium">
                                          {goal.uom_type === 'timeline' ? goal.achievement.actual_date : goal.achievement.actual_value}
                                        </span>
                                        <div className="text-xs text-slate-500 mt-1 capitalize">{goal.achievement.status.replace('_', ' ')}</div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No check-in</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 w-1/12">
                                    {goal.achievement ? (
                                      <span className={`font-semibold ${goal.achievement.score! >= 100 ? 'text-green-600' : goal.achievement.score! >= 50 ? 'text-amber-600' : 'text-slate-700'}`}>
                                        {goal.achievement.score}%
                                      </span>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="px-4 py-4 w-1/3">
                                    {goal.achievement ? (
                                      <div className="flex items-start space-x-2">
                                        <MessageSquare size={16} className="text-slate-400 mt-2 flex-shrink-0" />
                                        <div className="flex-1">
                                          <textarea
                                            rows={2}
                                            value={comments[goal.achievement.id] || ''}
                                            onChange={(e) => handleCommentChange(goal.achievement!.id, e.target.value)}
                                            placeholder="Add feedback..."
                                            className="w-full border-slate-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 block"
                                          />
                                        </div>
                                        <button
                                          onClick={() => saveComment(goal.achievement!.id)}
                                          disabled={savingId === goal.achievement.id || comments[goal.achievement.id] === goal.achievement.manager_comment}
                                          className="p-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                                          title="Save Comment"
                                        >
                                          <Save size={16} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs italic">Awaiting employee check-in</span>
                                    )}
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

            {teamCheckIns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-900">No team members found</p>
                  <p className="text-xs text-slate-500 mt-1">There are no team members assigned to you.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
