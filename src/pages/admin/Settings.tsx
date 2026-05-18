import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Cycle } from '../../types';
import { Settings as SettingsIcon, Database, Zap, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [stats, setStats] = useState({ profiles: 0, goalSheets: 0, goals: 0, achievements: 0, auditLogs: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadSystemInfo();
  }, []);

  async function loadSystemInfo() {
    try {
      setLoading(true);

      const [cycleRes, profilesRes, sheetsRes, goalsRes, achRes, logsRes] = await Promise.all([
        supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('goal_sheets').select('id', { count: 'exact', head: true }),
        supabase.from('goals').select('id', { count: 'exact', head: true }),
        supabase.from('achievements').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      ]);

      setActiveCycle(cycleRes.data);
      setStats({
        profiles: profilesRes.count || 0,
        goalSheets: sheetsRes.count || 0,
        goals: goalsRes.count || 0,
        achievements: achRes.count || 0,
        auditLogs: logsRes.count || 0,
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load system info');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8"><Spinner /></div>;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <SettingsIcon size={28} className="text-gray-400" />
          System Settings
        </h1>
        <p className="mt-2 text-sm text-gray-500">System status, database statistics, and configuration.</p>
      </div>

      {/* Active Cycle Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap size={18} className="text-amber-500" />
          Active Cycle
        </h2>
        {activeCycle ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-indigo-50 rounded-xl">
              <p className="text-xs font-medium text-indigo-500 uppercase tracking-wider">Year</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">{activeCycle.year}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Phase</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1 capitalize">{activeCycle.phase.replace('_', ' ')}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-xs font-medium text-blue-500 uppercase tracking-wider">Opens</p>
              <p className="text-lg font-bold text-blue-700 mt-1">
                {activeCycle.opens_at ? new Date(activeCycle.opens_at).toLocaleDateString() : '—'}
              </p>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl">
              <p className="text-xs font-medium text-rose-500 uppercase tracking-wider">Closes</p>
              <p className="text-lg font-bold text-rose-700 mt-1">
                {activeCycle.closes_at ? new Date(activeCycle.closes_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-amber-800 font-medium">No active cycle configured</p>
            <p className="text-xs text-amber-600 mt-1">Go to Admin Dashboard → Cycle Management to create and activate a cycle.</p>
          </div>
        )}
      </div>

      {/* Database Statistics */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database size={18} className="text-blue-500" />
          Database Statistics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Users', value: stats.profiles, color: 'indigo' },
            { label: 'Goal Sheets', value: stats.goalSheets, color: 'emerald' },
            { label: 'Goals', value: stats.goals, color: 'blue' },
            { label: 'Achievements', value: stats.achievements, color: 'purple' },
            { label: 'Audit Logs', value: stats.auditLogs, color: 'amber' },
          ].map(item => (
            <div key={item.label} className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-extrabold text-gray-900">{item.value}</p>
              <p className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Account Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Info size={18} className="text-gray-400" />
          Demo Accounts
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { role: 'Employee', email: 'employee@test.com', password: 'employee' },
                { role: 'Manager', email: 'manager@test.com', password: 'manager' },
                { role: 'Admin', email: 'admin@test.com', password: 'admin' },
              ].map(acc => (
                <tr key={acc.role}>
                  <td className="py-3 px-4 font-medium text-gray-900">{acc.role}</td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-xs">{acc.email}</td>
                  <td className="py-3 px-4 text-gray-600 font-mono text-xs">{acc.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-500" />
          System Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Frontend</span>
            <span className="font-medium text-gray-900">React 19 + Vite</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Backend</span>
            <span className="font-medium text-gray-900">Supabase (PostgreSQL)</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Styling</span>
            <span className="font-medium text-gray-900">Tailwind CSS v4</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Charts</span>
            <span className="font-medium text-gray-900">Recharts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
