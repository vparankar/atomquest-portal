import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle } from '../../types';
import { FileText, CheckCircle2, AlertCircle, ArrowRight, Target, TrendingUp } from 'lucide-react';
import { Spinner } from '../../components/Spinner';

interface DashboardStats {
  activeCycle: Cycle | null;
  sheetStatus: string | null;
  totalGoals: number;
  completedGoals: number;
  onTrackGoals: number;
  latestScore: number | null;
}

export function EmployeeHome() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadStats();
  }, [user?.id]);

  async function loadStats() {
    try {
      setLoading(true);

      // Get active cycle
      const { data: cycle } = await supabase
        .from('cycles')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (!cycle) {
        setStats({ activeCycle: null, sheetStatus: null, totalGoals: 0, completedGoals: 0, onTrackGoals: 0, latestScore: null });
        setLoading(false);
        return;
      }

      // Get goal sheet
      const { data: sheet } = await supabase
        .from('goal_sheets')
        .select('id, status')
        .eq('employee_id', user!.id)
        .eq('cycle_id', cycle.id)
        .maybeSingle();

      let totalGoals = 0, completedGoals = 0, onTrackGoals = 0, latestScore: number | null = null;

      if (sheet) {
        // Get goals
        const { data: goals } = await supabase
          .from('goals')
          .select('id, status')
          .eq('sheet_id', sheet.id);

        totalGoals = goals?.length || 0;
        completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
        onTrackGoals = goals?.filter(g => g.status === 'on_track').length || 0;

        // Get latest achievements for current phase
        if (goals && goals.length > 0) {
          const { data: achievements } = await supabase
            .from('achievements')
            .select('score')
            .in('goal_id', goals.map(g => g.id))
            .eq('cycle_phase', cycle.phase);

          if (achievements && achievements.length > 0) {
            const totalScore = achievements.reduce((sum, a) => sum + (a.score || 0), 0);
            latestScore = Math.round(totalScore / achievements.length);
          }
        }
      }

      setStats({
        activeCycle: cycle,
        sheetStatus: sheet?.status || null,
        totalGoals,
        completedGoals,
        onTrackGoals,
        latestScore,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8"><Spinner /></div>;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          {greeting()}, {profile?.full_name || 'there'}! 👋
        </h1>
        <p className="mt-2 text-gray-500">
          {stats?.activeCycle
            ? `Current cycle: ${stats.activeCycle.year} — ${stats.activeCycle.phase.replace('_', ' ').toUpperCase()}`
            : 'No active cycle configured.'
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Sheet Status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <FileText size={20} className="text-indigo-500" />
            {stats?.sheetStatus && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize
                ${stats.sheetStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  stats.sheetStatus === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    stats.sheetStatus === 'rework' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'}`}
              >
                {stats.sheetStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Goal Sheet</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats?.sheetStatus ? stats.sheetStatus.replace('_', ' ') : 'Not Started'}
          </p>
        </div>

        {/* Total Goals */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <Target size={20} className="text-blue-500 mb-3" />
          <p className="text-sm text-gray-500">Total Goals</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalGoals || 0}</p>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <CheckCircle2 size={20} className="text-emerald-500 mb-3" />
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.completedGoals || 0}</p>
        </div>

        {/* Avg Score */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <TrendingUp size={20} className="text-purple-500 mb-3" />
          <p className="text-sm text-gray-500">Avg Score</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {stats && stats.latestScore !== null ? `${stats.latestScore}%` : '—'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/employee/goals"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <div>
            <p className="font-semibold">My Goals</p>
            <p className="text-sm text-indigo-200 mt-1">View & manage your goals</p>
          </div>
          <ArrowRight size={20} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/employee/checkin"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <div>
            <p className="font-semibold">Check-In</p>
            <p className="text-sm text-emerald-200 mt-1">Log your quarterly progress</p>
          </div>
          <ArrowRight size={20} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/employee/profile"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <div>
            <p className="font-semibold">Profile</p>
            <p className="text-sm text-purple-200 mt-1">Update your information</p>
          </div>
          <ArrowRight size={20} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* No cycle warning */}
      {!stats?.activeCycle && (
        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-semibold text-amber-800">No Active Cycle</h4>
            <p className="text-amber-700 text-sm mt-1">Contact your admin to set up and activate a cycle.</p>
          </div>
        </div>
      )}
    </div>
  );
}
