import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

const COLORS = ['#FDB913', '#111827', '#16A34A', '#2563EB', '#7C3AED', '#D97706', '#DC2626'];

interface AnalyticsData {
  qoqTrend: any[];
  goalDistribution: { name: string; value: number }[];
  heatmap: any[];
  managerEffectiveness: { managerName: string; effectiveness: number }[];
}

const heatColor = (v: number | null) => {
  if (v === null) return { bg: '#F3F4F6', color: '#9CA3AF' };
  if (v >= 80) return { bg: '#16A34A', color: '#fff' };
  if (v >= 40) return { bg: '#D97706', color: '#fff' };
  return { bg: '#DC2626', color: '#fff' };
};

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: sheetsData, error } = await supabase.from('goal_sheets').select(`id, profiles!goal_sheets_employee_id_fkey(id,full_name,department,manager_id), goals(id,thrust_area,achievements(id,cycle_phase,score))`);
      if (error) throw error;
      const { data: managersData } = await supabase.from('profiles').select('id,full_name').eq('role', 'manager');
      const sheets = (sheetsData as any[]) || [];
      const deptScores: Record<string, Record<string, { total: number; count: number }>> = {};
      const thrustCount: Record<string, number> = {};

      sheets.forEach(sheet => {
        const dept = sheet.profiles?.department || 'Unassigned';
        if (!deptScores[dept]) deptScores[dept] = { q1: { total: 0, count: 0 }, q2: { total: 0, count: 0 }, q3: { total: 0, count: 0 }, q4: { total: 0, count: 0 } };
        sheet.goals?.forEach((goal: any) => {
          if (goal.thrust_area) thrustCount[goal.thrust_area] = (thrustCount[goal.thrust_area] || 0) + 1;
          goal.achievements?.forEach((a: any) => {
            const p = a.cycle_phase;
            if (p && deptScores[dept][p]) { deptScores[dept][p].total += a.score || 0; deptScores[dept][p].count += 1; }
          });
        });
      });

      const departments = Object.keys(deptScores);
      const heatmap = departments.map(dept => {
        const r: any = { department: dept };
        ['q1', 'q2', 'q3', 'q4'].forEach(q => {
          const s = deptScores[dept][q];
          r[q] = s.count > 0 ? Math.round(s.total / s.count) : null;
        });
        return r;
      });

      const qoqTrend = [{ name: 'Q1' }, { name: 'Q2' }, { name: 'Q3' }, { name: 'Q4' }];
      qoqTrend.forEach(q => {
        const k = q.name.toLowerCase();
        departments.forEach(dept => {
          const s = deptScores[dept][k];
          (q as any)[dept] = s.count > 0 ? Math.round(s.total / s.count) : 0;
        });
      });

      const goalDistribution = Object.keys(thrustCount).map(k => ({ name: k, value: thrustCount[k] }));
      const managerEffectiveness = (managersData || []).map(mgr => {
        const teamSheets = sheets.filter(s => s.profiles?.manager_id === mgr.id);
        let expected = 0, logged = 0;
        teamSheets.forEach(s => s.goals?.forEach((g: any) => { expected += 4; logged += (g.achievements?.length || 0); }));
        return { managerName: mgr.full_name || 'Unknown', effectiveness: expected > 0 ? Math.round((logged / expected) * 100) : 0 };
      });

      setData({ qoqTrend, goalDistribution, heatmap, managerEffectiveness });
    } catch (err: any) {
      toast.error('Failed to load analytics: ' + err.message);
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div style={{ height: 28, width: 200, background: '#E5E7EB', borderRadius: 4, marginBottom: 24 }} />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><Spinner size="lg" /></div>
    </div>
  );
  if (!data) return null;

  const departments = data.heatmap.map(h => h.department);
  const ttStyle = { borderRadius: 4, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 12 };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Analytics Dashboard</h1>
        <p className="page-subtitle">Comprehensive overview of organisational performance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* QoQ Trend */}
        <div className="card">
          <div className="card-header"><span className="card-title">QoQ Achievement Trend</span></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={data.qoqTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <RTooltip contentStyle={ttStyle} />
                <Legend iconType="square" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                {departments.map((d, i) => <Bar key={d} dataKey={d} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Goal Distribution */}
        <div className="card">
          <div className="card-header"><span className="card-title">Goal Distribution by Thrust Area</span></div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie data={data.goalDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}>
                  {data.goalDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RTooltip contentStyle={ttStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Department Completion Heatmap (%)</span></div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
                <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</div>
                {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <div key={q} style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{q}</div>)}
              </div>
              {data.heatmap.map(row => (
                <div key={row.department} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 1fr 1fr', gap: 4, marginBottom: 4 }}>
                  <div style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--surface-raised)', borderRadius: 'var(--radius)' }}>{row.department}</div>
                  {['q1', 'q2', 'q3', 'q4'].map(q => {
                    const { bg, color } = heatColor(row[q]);
                    return (
                      <div key={q} style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, textAlign: 'center', background: bg, color, borderRadius: 'var(--radius)' }}>
                        {row[q] !== null ? `${row[q]}%` : '—'}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {[{ c: '#16A34A', l: '>80% On Track' }, { c: '#D97706', l: '40–80% Watch' }, { c: '#DC2626', l: '<40% At Risk' }, { c: '#F3F4F6', l: 'No Data', tc: '#4B5563' }].map(item => (
                  <div key={item.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: item.c, border: item.c === '#F3F4F6' ? '1px solid #E5E7EB' : 'none' }} />
                    <span style={{ fontSize: 11, color: item.tc || '#6B7280' }}>{item.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manager Effectiveness */}
      <div className="card">
        <div className="card-header"><span className="card-title">Manager Effectiveness (% Check-ins Completed)</span></div>
        <div className="card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart layout="vertical" data={data.managerEffectiveness} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#E5E7EB" />
              <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis dataKey="managerName" type="category" axisLine={false} tickLine={false} width={130} tick={{ fontSize: 12, fill: '#374151' }} />
              <RTooltip contentStyle={ttStyle} formatter={(v: any) => [`${v}%`, 'Effectiveness']} />
              <Bar dataKey="effectiveness" radius={[0, 3, 3, 0]} barSize={20}>
                {data.managerEffectiveness.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
