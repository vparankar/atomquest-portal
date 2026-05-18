import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { Download, CheckCircle2, XCircle, Loader2, BarChart3, ClipboardCheck } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AchievementRow {
  employeeName: string;
  department: string;
  goalTitle: string;
  thrustArea: string;
  uomType: string;
  target: string;
  q1Actual: string;
  q2Actual: string;
  q3Actual: string;
  q4Actual: string;
  q1Score: string;
  q2Score: string;
  q3Score: string;
  q4Score: string;
  status: string;
}

interface CompletionRow {
  name: string;
  sheetStatus: string;
  q1Done: boolean;
  q2Done: boolean;
  q3Done: boolean;
  q4Done: boolean;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function Reports() {
  const [activeSection, setActiveSection] = useState<'achievement' | 'completion'>('achievement');

  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="mt-2 text-sm text-gray-500">View achievement data and completion status across the organisation.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveSection('achievement')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
            ${activeSection === 'achievement'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
        >
          <BarChart3 size={16} />
          Achievement Report
        </button>
        <button
          onClick={() => setActiveSection('completion')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
            ${activeSection === 'completion'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
        >
          <ClipboardCheck size={16} />
          Completion Dashboard
        </button>
      </div>

      {activeSection === 'achievement' && <AchievementReport />}
      {activeSection === 'completion' && <CompletionDashboard />}
    </div>
  );
}

// ─── Section 1: Achievement Report ──────────────────────────────────────────

function AchievementReport() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch goal_sheets with nested profiles, goals, and achievements
    const { data, error } = await supabase
      .from('goal_sheets')
      .select(`
        id, status,
        profiles!goal_sheets_employee_id_fkey ( full_name, department ),
        goals (
          id, title, thrust_area, uom_type, target_value, target_date, status,
          achievements ( cycle_phase, actual_value, score, status )
        )
      `);

    if (error) {
      console.error('Achievement fetch error:', error);
      setLoading(false);
      return;
    }

    const mapped: AchievementRow[] = [];

    for (const sheet of (data || []) as any[]) {
      const profile = sheet.profiles;
      const empName = profile?.full_name || 'Unknown';
      const dept = profile?.department || '—';

      for (const goal of (sheet.goals || []) as any[]) {
        const achievements: Record<string, any> = {};
        for (const a of (goal.achievements || []) as any[]) {
          achievements[a.cycle_phase] = a;
        }

        const target = goal.uom_type === 'timeline'
          ? (goal.target_date || '—')
          : (goal.target_value != null ? String(goal.target_value) : '—');

        const getActual = (q: string) => {
          const a = achievements[q];
          if (!a) return '—';
          return a.actual_value != null ? String(a.actual_value) : '—';
        };

        const getScore = (q: string) => {
          const a = achievements[q];
          if (!a || a.score == null) return '—';
          return `${Number(a.score).toFixed(0)}%`;
        };

        mapped.push({
          employeeName: empName,
          department: dept,
          goalTitle: goal.title,
          thrustArea: goal.thrust_area,
          uomType: goal.uom_type || '—',
          target,
          q1Actual: getActual('q1'),
          q2Actual: getActual('q2'),
          q3Actual: getActual('q3'),
          q4Actual: getActual('q4'),
          q1Score: getScore('q1'),
          q2Score: getScore('q2'),
          q3Score: getScore('q3'),
          q4Score: getScore('q4'),
          status: goal.status?.replace('_', ' ') || '—',
        });
      }
    }

    setRows(mapped);
    setLoading(false);
  };

  const handleExport = () => {
    const wsData = rows.map((r) => ({
      'Employee Name': r.employeeName,
      Department: r.department,
      'Goal Title': r.goalTitle,
      'Thrust Area': r.thrustArea,
      'UoM Type': r.uomType,
      Target: r.target,
      'Q1 Actual': r.q1Actual,
      'Q2 Actual': r.q2Actual,
      'Q3 Actual': r.q3Actual,
      'Q4 Actual': r.q4Actual,
      'Q1 Score%': r.q1Score,
      'Q2 Score%': r.q2Score,
      'Q3 Score%': r.q3Score,
      'Q4 Score%': r.q4Score,
      Status: r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Achievement Report');
    XLSX.writeFile(wb, 'achievement_report.xlsx');
  };

  const columns = [
    'Employee Name', 'Department', 'Goal Title', 'Thrust Area', 'UoM Type', 'Target',
    'Q1 Actual', 'Q2 Actual', 'Q3 Actual', 'Q4 Actual',
    'Q1 Score%', 'Q2 Score%', 'Q3 Score%', 'Q4 Score%', 'Status',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
        <Loader2 className="animate-spin" size={20} />
        Loading achievement data…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50/60 to-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Achievement Report</h2>
          <p className="text-xs text-gray-500 mt-0.5">{rows.length} goal record{rows.length !== 1 ? 's' : ''} found</p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold
            bg-gradient-to-r from-emerald-500 to-green-600 text-white
            shadow-lg shadow-emerald-200 hover:shadow-emerald-300
            hover:from-emerald-600 hover:to-green-700
            active:scale-[0.97] transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Download size={16} strokeWidth={2.5} />
          Export to Excel
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                  No achievement data found.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.employeeName}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.department}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{row.goalTitle}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.thrustArea}</td>
                  <td className="px-4 py-3 text-gray-500 uppercase text-xs font-medium">{row.uomType}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.target}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q1Actual}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q2Actual}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q3Actual}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q4Actual}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q1Score}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q2Score}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q3Score}</td>
                  <td className="px-4 py-3 text-gray-700">{row.q4Score}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let classes = 'bg-gray-100 text-gray-700';
  if (s === 'completed') classes = 'bg-emerald-100 text-emerald-700';
  else if (s === 'on track') classes = 'bg-blue-100 text-blue-700';
  else if (s === 'not started') classes = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${classes}`}>
      {status}
    </span>
  );
}

// ─── Section 2: Completion Dashboard ────────────────────────────────────────

function CompletionDashboard() {
  const [completionRows, setCompletionRows] = useState<CompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState('');

  useEffect(() => {
    fetchCompletion();
  }, []);

  const fetchCompletion = async () => {
    setLoading(true);

    // Get the active cycle
    const { data: cycle } = await supabase
      .from('cycles')
      .select('*')
      .eq('is_active', true)
      .single();

    if (cycle) {
      setCurrentPhase(cycle.phase?.replace('_', ' ') || '');
    }

    // All employees
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .in('role', ['employee', 'manager']);

    // All goal_sheets with goals + achievements
    const { data: sheets } = await supabase
      .from('goal_sheets')
      .select(`
        id, employee_id, status,
        goals (
          id,
          achievements ( cycle_phase, actual_value, status )
        )
      `);

    const sheetsByEmp: Record<string, any> = {};
    for (const s of (sheets || []) as any[]) {
      if (!sheetsByEmp[s.employee_id]) sheetsByEmp[s.employee_id] = [];
      sheetsByEmp[s.employee_id].push(s);
    }

    const rows: CompletionRow[] = (profiles || []).map((p: any) => {
      const empSheets = sheetsByEmp[p.id] || [];
      const sheetStatus = empSheets.length > 0 ? empSheets[0].status : 'none';

      // Check if any achievement exists for each quarter
      const quarterDone: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };
      for (const s of empSheets) {
        for (const g of (s.goals || [])) {
          for (const a of (g.achievements || [])) {
            if (a.actual_value != null || a.status === 'completed' || a.status === 'on_track') {
              quarterDone[a.cycle_phase] = true;
            }
          }
        }
      }

      return {
        name: p.full_name || 'Unknown',
        sheetStatus: sheetStatus.replace('_', ' '),
        q1Done: quarterDone.q1,
        q2Done: quarterDone.q2,
        q3Done: quarterDone.q3,
        q4Done: quarterDone.q4,
      };
    });

    setCompletionRows(rows);
    setLoading(false);
  };

  const completedCount = useMemo(() => {
    const phaseKey = currentPhase.replace(' ', '') as string;
    const qMap: Record<string, keyof CompletionRow> = {
      q1: 'q1Done', q2: 'q2Done', q3: 'q3Done', q4: 'q4Done',
    };
    const field = qMap[phaseKey];
    if (!field) return 0;
    return completionRows.filter((r) => r[field]).length;
  }, [completionRows, currentPhase]);

  const pendingCount = completionRows.length - completedCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
        <Loader2 className="animate-spin" size={20} />
        Loading completion data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[80px] -mr-2 -mt-2" />
          <div className="relative">
            <p className="text-sm font-medium text-gray-500 mb-1">Check-ins Completed</p>
            <p className="text-4xl font-extrabold text-emerald-600 tracking-tight">{completedCount}</p>
            <p className="text-xs text-gray-400 mt-2">
              Current phase: <span className="font-semibold text-gray-600 capitalize">{currentPhase || 'N/A'}</span>
            </p>
          </div>
        </div>
        <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-[80px] -mr-2 -mt-2" />
          <div className="relative">
            <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
            <p className="text-4xl font-extrabold text-amber-600 tracking-tight">{pendingCount}</p>
            <p className="text-xs text-gray-400 mt-2">
              Out of <span className="font-semibold text-gray-600">{completionRows.length}</span> employees
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Employee Completion Status</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Name', 'Goal Sheet Status', 'Q1 Done?', 'Q2 Done?', 'Q3 Done?', 'Q4 Done?'].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {completionRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No employees found.
                  </td>
                </tr>
              ) : (
                completionRows.map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{row.name}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.sheetStatus} />
                    </td>
                    <td className="px-5 py-3 text-center"><DoneIcon done={row.q1Done} /></td>
                    <td className="px-5 py-3 text-center"><DoneIcon done={row.q2Done} /></td>
                    <td className="px-5 py-3 text-center"><DoneIcon done={row.q3Done} /></td>
                    <td className="px-5 py-3 text-center"><DoneIcon done={row.q4Done} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DoneIcon({ done }: { done: boolean }) {
  return done
    ? <CheckCircle2 size={20} className="text-emerald-500 mx-auto" />
    : <XCircle size={20} className="text-red-400 mx-auto" />;
}
