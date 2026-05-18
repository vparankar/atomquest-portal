import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle } from '../../types';
import { Users, CheckCircle2, Clock, ArrowRight, AlertCircle, ClipboardCheck } from 'lucide-react';
import { Spinner } from '../../components/Spinner';

interface ManagerStats {
  activeCycle: Cycle | null;
  teamSize: number;
  pendingApprovals: number;
  approvedSheets: number;
  checkInsCompleted: number;
  checkInsPending: number;
}

export function ManagerHome() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<ManagerStats | null>(null);
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

      // Get team members
      const { data: team } = await supabase
        .from('profiles')
        .select('id')
        .eq('manager_id', user!.id);

      const teamIds = team?.map(t => t.id) || [];
      const teamSize = teamIds.length;

      let pendingApprovals = 0, approvedSheets = 0, checkInsCompleted = 0, checkInsPending = 0;

      if (cycle && teamIds.length > 0) {
        // Pending approvals
        const { count: pendingCount } = await supabase
          .from('goal_sheets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted')
          .in('employee_id', teamIds);
        pendingApprovals = pendingCount || 0;

        // Approved sheets
        const { data: approvedData } = await supabase
          .from('goal_sheets')
          .select('id')
          .eq('status', 'approved')
          .eq('cycle_id', cycle.id)
          .in('employee_id', teamIds);
        approvedSheets = approvedData?.length || 0;

        // Check-in status
        if (approvedData && approvedData.length > 0) {
          const sheetIds = approvedData.map(s => s.id);
          const { data: goals } = await supabase
            .from('goals')
            .select('id')
            .in('sheet_id', sheetIds);

          if (goals && goals.length > 0) {
            const goalIds = goals.map(g => g.id);
            const { data: achievements } = await supabase
              .from('achievements')
              .select('id, status')
              .eq('cycle_phase', cycle.phase)
              .in('goal_id', goalIds);

            checkInsCompleted = achievements?.filter(a => a.status === 'completed' || a.status === 'on_track').length || 0;
            checkInsPending = (goals.length) - checkInsCompleted;
            if (checkInsPending < 0) checkInsPending = 0;
          }
        }
      }

      setStats({
        activeCycle: cycle,
        teamSize,
        pendingApprovals,
        approvedSheets,
        checkInsCompleted,
        checkInsPending,
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
          {greeting()}, {profile?.full_name || 'Manager'}! 👋
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <Users size={20} className="text-indigo-500 mb-3" />
          <p className="text-sm text-gray-500">Team Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.teamSize || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <Clock size={20} className="text-amber-500" />
            {(stats?.pendingApprovals || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                Action needed
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Pending Approvals</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.pendingApprovals || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <CheckCircle2 size={20} className="text-emerald-500 mb-3" />
          <p className="text-sm text-gray-500">Approved Sheets</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.approvedSheets || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <ClipboardCheck size={20} className="text-purple-500 mb-3" />
          <p className="text-sm text-gray-500">Check-ins Done</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats?.checkInsCompleted || 0}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/manager/team"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <div>
            <p className="font-semibold">Team Goal Approvals</p>
            <p className="text-sm text-indigo-200 mt-1">
              {(stats?.pendingApprovals || 0) > 0
                ? `${stats?.pendingApprovals} sheet${stats?.pendingApprovals !== 1 ? 's' : ''} waiting`
                : 'All caught up!'}
            </p>
          </div>
          <ArrowRight size={20} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/manager/reviews"
          className="group flex items-center justify-between p-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <div>
            <p className="font-semibold">Check-In Reviews</p>
            <p className="text-sm text-emerald-200 mt-1">Review team progress & add feedback</p>
          </div>
          <ArrowRight size={20} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Alerts */}
      {!stats?.activeCycle && (
        <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-semibold text-amber-800">No Active Cycle</h4>
            <p className="text-amber-700 text-sm mt-1">Contact your admin to set up and activate a cycle.</p>
          </div>
        </div>
      )}

      {stats?.teamSize === 0 && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-blue-500 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-semibold text-blue-800">No Team Members</h4>
            <p className="text-blue-700 text-sm mt-1">No employees are assigned to you yet. Ask your admin to set up reporting relationships.</p>
          </div>
        </div>
      )}
    </div>
  );
}
