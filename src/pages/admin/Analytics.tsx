import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface AnalyticsData {
  qoqTrend: any[];
  goalDistribution: { name: string; value: number }[];
  heatmap: any[];
  managerEffectiveness: { managerName: string; effectiveness: number }[];
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: sheetsData, error: sheetsError } = await supabase
        .from('goal_sheets')
        .select(`
          id,
          profiles!goal_sheets_employee_id_fkey(
            id,
            full_name,
            department,
            manager_id
          ),
          goals(
            id,
            thrust_area,
            achievements(
              id,
              cycle_phase,
              score
            )
          )
        `);

      if (sheetsError) throw sheetsError;

      const { data: managersData, error: managersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'manager');

      if (managersError) throw managersError;

      // Process Data
      const deptScores: Record<string, Record<string, { total: number; count: number }>> = {};
      const thrustCount: Record<string, number> = {};

      const sheets = (sheetsData as any[]) || [];

      sheets.forEach(sheet => {
        const dept = sheet.profiles?.department || 'Unassigned';
        if (!deptScores[dept]) {
          deptScores[dept] = { q1: { total: 0, count: 0 }, q2: { total: 0, count: 0 }, q3: { total: 0, count: 0 }, q4: { total: 0, count: 0 } };
        }

        sheet.goals?.forEach((goal: any) => {
          // Goal Distribution
          if (goal.thrust_area) {
            thrustCount[goal.thrust_area] = (thrustCount[goal.thrust_area] || 0) + 1;
          }

          // QoQ Trend & Heatmap
          goal.achievements?.forEach((ach: any) => {
            const phase = ach.cycle_phase;
            if (phase && deptScores[dept][phase]) {
              deptScores[dept][phase].total += ach.score || 0;
              deptScores[dept][phase].count += 1;
            }
          });
        });
      });

      // Build QoQ and Heatmap Data
      const heatmap: any[] = [];
      const departments = Object.keys(deptScores);
      
      departments.forEach(dept => {
        const q1 = deptScores[dept].q1.count > 0 ? Math.round(deptScores[dept].q1.total / deptScores[dept].q1.count) : null;
        const q2 = deptScores[dept].q2.count > 0 ? Math.round(deptScores[dept].q2.total / deptScores[dept].q2.count) : null;
        const q3 = deptScores[dept].q3.count > 0 ? Math.round(deptScores[dept].q3.total / deptScores[dept].q3.count) : null;
        const q4 = deptScores[dept].q4.count > 0 ? Math.round(deptScores[dept].q4.total / deptScores[dept].q4.count) : null;
        
        heatmap.push({ department: dept, q1, q2, q3, q4 });
      });

      // QoQ Trend Data Shape: [ { name: 'Q1', Sales: 80, Engineering: 70 }, ... ]
      const qoqTrend = [
        { name: 'Q1' }, { name: 'Q2' }, { name: 'Q3' }, { name: 'Q4' }
      ];
      
      qoqTrend.forEach(q => {
        const key = q.name.toLowerCase();
        departments.forEach(dept => {
          const stats = deptScores[dept][key];
          (q as any)[dept] = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
        });
      });

      // Build Goal Distribution Data
      const goalDistribution = Object.keys(thrustCount).map(key => ({
        name: key,
        value: thrustCount[key]
      }));

      // Build Manager Effectiveness Data
      const managerEffectiveness: { managerName: string; effectiveness: number }[] = [];
      
      (managersData || []).forEach(manager => {
        const teamSheets = sheets.filter(s => s.profiles?.manager_id === manager.id);
        let expectedAchievements = 0;
        let loggedAchievements = 0;

        teamSheets.forEach(sheet => {
          sheet.goals?.forEach((goal: any) => {
            expectedAchievements += 4; // Assuming 4 check-ins expected per year per goal
            loggedAchievements += (goal.achievements?.length || 0);
          });
        });

        const effectiveness = expectedAchievements > 0 
          ? Math.round((loggedAchievements / expectedAchievements) * 100) 
          : 0;

        managerEffectiveness.push({
          managerName: manager.full_name || 'Unknown',
          effectiveness
        });
      });

      setData({ qoqTrend, goalDistribution, heatmap, managerEffectiveness });

    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHeatmapColor = (value: number | null) => {
    if (value === null) return 'bg-gray-100 text-gray-400';
    if (value >= 80) return 'bg-emerald-500 text-white';
    if (value >= 40) return 'bg-amber-500 text-white';
    return 'bg-rose-500 text-white';
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 animate-pulse bg-gray-200 h-8 w-64 rounded"></h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const departments = data.heatmap.map(h => h.department);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-2">Comprehensive overview of organizational performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: QoQ Achievement Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">QoQ Achievement Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.qoqTrend} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                {departments.map((dept, index) => (
                  <Bar key={dept} dataKey={dept} fill={COLORS[index % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Goal Distribution by Thrust Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Goal Distribution by Thrust Area</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.goalDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.goalDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Completion Heatmap */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Department Completion Heatmap (%)</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-5 gap-1 mb-2">
                <div className="font-medium text-gray-500 text-sm p-3">Department</div>
                {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                  <div key={q} className="font-medium text-gray-500 text-sm p-3 text-center">{q}</div>
                ))}
              </div>
              
              <div className="space-y-1">
                {data.heatmap.map((row) => (
                  <div key={row.department} className="grid grid-cols-5 gap-1">
                    <div className="p-3 text-sm font-medium text-gray-900 flex items-center bg-gray-50 rounded">
                      {row.department}
                    </div>
                    {['q1', 'q2', 'q3', 'q4'].map(q => (
                      <div 
                        key={q} 
                        className={`p-3 text-sm font-medium text-center rounded flex items-center justify-center ${getHeatmapColor(row[q as keyof typeof row])}`}
                      >
                        {row[q as keyof typeof row] !== null ? `${row[q as keyof typeof row]}%` : '-'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500"></div>
                  <span className="text-xs text-gray-600">On Track (&gt;80%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500"></div>
                  <span className="text-xs text-gray-600">Needs Attention (40-80%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-rose-500"></div>
                  <span className="text-xs text-gray-600">At Risk (&lt;40%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-100"></div>
                  <span className="text-xs text-gray-600">No Data</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 4: Manager Effectiveness */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Manager Effectiveness (% Check-ins Completed)</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data.managerEffectiveness}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} />
                <YAxis dataKey="managerName" type="category" axisLine={false} tickLine={false} width={120} />
                <RechartsTooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [`${value}%`, 'Effectiveness']}
                />
                <Bar dataKey="effectiveness" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={24}>
                  {data.managerEffectiveness.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
