import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';
import { Download, CheckCircle2, XCircle, BarChart3, ClipboardCheck } from 'lucide-react';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

interface AchievementRow {
  employeeName: string; department: string; goalTitle: string; thrustArea: string;
  uomType: string; target: string;
  q1Actual: string; q2Actual: string; q3Actual: string; q4Actual: string;
  q1Score: string; q2Score: string; q3Score: string; q4Score: string; status: string;
}
interface CompletionRow { name: string; sheetStatus: string; q1Done: boolean; q2Done: boolean; q3Done: boolean; q4Done: boolean; }

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s === 'completed' ? 'badge badge-green' : s === 'on track' ? 'badge badge-blue' : s === 'not started' ? 'badge badge-amber' : 'badge badge-gray';
  return <span className={cls}>{status}</span>;
}
function DoneIcon({ done }: { done: boolean }) {
  return done ? <CheckCircle2 size={16} style={{ color: 'var(--green)', margin: '0 auto', display: 'block' }} /> : <XCircle size={16} style={{ color: 'var(--red)', margin: '0 auto', display: 'block' }} />;
}

export function Reports() {
  const [activeSection, setActiveSection] = useState<'achievement' | 'completion'>('achievement');
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">View achievement data and completion status across the organisation.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ id: 'achievement', label: 'Achievement Report', icon: <BarChart3 size={14} /> }, { id: 'completion', label: 'Completion Dashboard', icon: <ClipboardCheck size={14} /> }].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id as any)}
            className={activeSection === tab.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
      {activeSection === 'achievement' && <AchievementReport />}
      {activeSection === 'completion' && <CompletionDashboard />}
    </div>
  );
}

function AchievementReport() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('goal_sheets').select(`id,status, profiles!goal_sheets_employee_id_fkey(full_name,department), goals(id,title,thrust_area,uom_type,target_value,target_date,status, achievements(cycle_phase,actual_value,score,status))`);
    if (error) { toast.error('Fetch error: ' + error.message); setLoading(false); return; }
    const mapped: AchievementRow[] = [];
    for (const sheet of (data || []) as any[]) {
      const empName = sheet.profiles?.full_name || 'Unknown';
      const dept = sheet.profiles?.department || '—';
      for (const goal of (sheet.goals || []) as any[]) {
        const ach: Record<string, any> = {};
        for (const a of (goal.achievements || []) as any[]) ach[a.cycle_phase] = a;
        const target = goal.uom_type === 'timeline' ? (goal.target_date || '—') : (goal.target_value != null ? String(goal.target_value) : '—');
        const ga = (q: string) => { const a = ach[q]; return a?.actual_value != null ? String(a.actual_value) : '—'; };
        const gs = (q: string) => { const a = ach[q]; return a?.score != null ? `${Number(a.score).toFixed(0)}%` : '—'; };
        mapped.push({ employeeName: empName, department: dept, goalTitle: goal.title, thrustArea: goal.thrust_area, uomType: goal.uom_type || '—', target, q1Actual: ga('q1'), q2Actual: ga('q2'), q3Actual: ga('q3'), q4Actual: ga('q4'), q1Score: gs('q1'), q2Score: gs('q2'), q3Score: gs('q3'), q4Score: gs('q4'), status: goal.status?.replace('_', ' ') || '—' });
      }
    }
    setRows(mapped); setLoading(false);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ 'Employee': r.employeeName, 'Dept': r.department, 'Goal': r.goalTitle, 'Thrust': r.thrustArea, 'UoM': r.uomType, 'Target': r.target, 'Q1 Actual': r.q1Actual, 'Q2 Actual': r.q2Actual, 'Q3 Actual': r.q3Actual, 'Q4 Actual': r.q4Actual, 'Q1%': r.q1Score, 'Q2%': r.q2Score, 'Q3%': r.q3Score, 'Q4%': r.q4Score, 'Status': r.status })));
    
    ws['!cols'] = [
      { wch: 25 }, // Employee
      { wch: 25 }, // Dept
      { wch: 45 }, // Goal Title
      { wch: 15 }, // Thrust Area
      { wch: 10 }, // UoM
      { wch: 15 }, // Target
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Q1-Q4 Actuals
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, // Q1-Q4 Scores
      { wch: 15 }  // Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Achievement Report');
    XLSX.writeFile(wb, 'achievement_report.xlsx');
    toast.success('Report exported');
  };

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const cols = ['Employee', 'Dept', 'Goal Title', 'Thrust Area', 'UoM', 'Target', 'Q1 Actual', 'Q2 Actual', 'Q3 Actual', 'Q4 Actual', 'Q1%', 'Q2%', 'Q3%', 'Q4%', 'Status'];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Achievement Report</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{rows.length} record{rows.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={handleExport} disabled={rows.length === 0} className="btn btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export to Excel
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>No achievement data found.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{row.employeeName}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.department}</td>
                <td style={{ maxWidth: 200 }}>{row.goalTitle}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.thrustArea}</td>
                <td><span className="badge badge-gray" style={{ textTransform: 'uppercase', fontSize: 10 }}>{row.uomType}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>{row.target}</td>
                <td>{row.q1Actual}</td><td>{row.q2Actual}</td><td>{row.q3Actual}</td><td>{row.q4Actual}</td>
                <td>{row.q1Score}</td><td>{row.q2Score}</td><td>{row.q3Score}</td><td>{row.q4Score}</td>
                <td><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompletionDashboard() {
  const [rows, setRows] = useState<CompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('');
  const { toast } = useToast();

  useEffect(() => { fetchCompletion(); }, []);

  const fetchCompletion = async () => {
    setLoading(true);
    const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).single();
    if (cycle) setPhase(cycle.phase?.replace('_', ' ') || '');
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id,full_name,department').in('role', ['employee', 'manager']);
    if (profErr) { toast.error('Failed to load profiles'); }
    const { data: sheets, error: sheetsErr } = await supabase.from('goal_sheets').select('id,employee_id,status, goals(id, achievements(cycle_phase,actual_value,status))');
    if (sheetsErr) { toast.error('Failed to load goal sheets'); }
    const sheetsByEmp: Record<string, any[]> = {};
    for (const s of (sheets || []) as any[]) { if (!sheetsByEmp[s.employee_id]) sheetsByEmp[s.employee_id] = []; sheetsByEmp[s.employee_id].push(s); }
    const mapped: CompletionRow[] = (profiles || []).map((p: any) => {
      const empSheets = sheetsByEmp[p.id] || [];
      const status = empSheets.length > 0 ? empSheets[0].status : 'none';
      const qd: Record<string, boolean> = { q1: false, q2: false, q3: false, q4: false };
      for (const s of empSheets) for (const g of (s.goals || [])) for (const a of (g.achievements || [])) if (a.actual_value != null || a.status === 'completed' || a.status === 'on_track') qd[a.cycle_phase] = true;
      return { name: p.full_name || 'Unknown', sheetStatus: status.replace('_', ' '), q1Done: qd.q1, q2Done: qd.q2, q3Done: qd.q3, q4Done: qd.q4 };
    });
    setRows(mapped); setLoading(false);
  };

  const completedCount = useMemo(() => {
    const qMap: Record<string, keyof CompletionRow> = { q1: 'q1Done', q2: 'q2Done', q3: 'q3Done', q4: 'q4Done' };
    const field = qMap[phase.replace(' ', '')];
    return field ? rows.filter(r => r[field]).length : 0;
  }, [rows, phase]);

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'Check-ins Completed', val: completedCount, color: 'var(--green)' },
          { label: 'Pending',             val: rows.length - completedCount, color: 'var(--amber)' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Phase: <strong style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{phase || 'N/A'}</strong> · of {rows.length} employees
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header"><span className="card-title">Employee Completion Status</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              {['Name', 'Goal Sheet Status', 'Q1', 'Q2', 'Q3', 'Q4'].map(h => <th key={h} style={{ textAlign: h.startsWith('Q') ? 'center' : 'left' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>No employees found.</td></tr>
                : rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{row.name}</td>
                    <td><StatusBadge status={row.sheetStatus} /></td>
                    <td style={{ textAlign: 'center' }}><DoneIcon done={row.q1Done} /></td>
                    <td style={{ textAlign: 'center' }}><DoneIcon done={row.q2Done} /></td>
                    <td style={{ textAlign: 'center' }}><DoneIcon done={row.q3Done} /></td>
                    <td style={{ textAlign: 'center' }}><DoneIcon done={row.q4Done} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
