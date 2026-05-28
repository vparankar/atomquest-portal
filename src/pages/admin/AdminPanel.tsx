import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import type { Cycle, Profile } from '../../types';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';

export function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'cycles' | 'unlock' | 'shared' | 'audit'>('cycles');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Manage cycles, goals, and system settings.</p>
      </div>

      <div className="card">
        <div className="tab-nav" style={{ padding: '0 20px' }}>
          {[
            { id: 'cycles', name: 'Cycle Management' },
            { id: 'unlock', name: 'Goal Unlock' },
            { id: 'shared', name: 'Shared Goals' },
            { id: 'audit', name: 'Audit Log' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab-btn${activeTab === tab.id ? ' tab-btn-active' : ''}`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === 'cycles' && <CycleManagement />}
          {activeTab === 'unlock' && <GoalUnlock user={user} />}
          {activeTab === 'shared' && <SharedGoals />}
          {activeTab === 'audit' && <AuditLogViewer />}
        </div>
      </div>
    </div>
  );
}

// ─── Cycle Management ────────────────────────────────────────────────────────

function CycleManagement() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  const [year, setYear] = useState(new Date().getFullYear());
  const [phase, setPhase] = useState<Cycle['phase']>('goal_setting');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .order('year', { ascending: false })

    if (!error && data) setCycles(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await supabase.from('cycles').insert({
      year,
      phase,
      opens_at: opensAt,
      closes_at: closesAt,
      is_active: false,
    });
    setIsSubmitting(false);
    if (!error) {
      setOpensAt('');
      setClosesAt('');
      fetchCycles();
      toast.success('Cycle created successfully');
    } else {
      toast.error('Error creating cycle: ' + error.message);
    }
  };

  const handleSeedData = async () => {
    setIsSubmitting(true);
    try {
      // ── Step 1: Ensure all 3 demo users have logged in at least once ──
      const { data: allProfiles } = await supabase.from('profiles').select('id, role');
      if (!allProfiles || allProfiles.length === 0) {
        toast.error("No profiles found. Please login with all 3 demo accounts (employee, manager, admin) at least once first.");
        setIsSubmitting(false);
        return;
      }

      const employeeProfile = allProfiles.find(p => p.role === 'employee');
      const managerProfile = allProfiles.find(p => p.role === 'manager');
      const adminProfile = allProfiles.find(p => p.role === 'admin');

      if (!employeeProfile || !managerProfile) {
        toast.error("Need at least the employee and manager demo accounts. Please login as each first.");
        setIsSubmitting(false);
        return;
      }

      // ── Step 2: Set departments & manager assignments on profiles ──
      const profileUpdates = [
        { id: employeeProfile.id, full_name: 'Priya Sharma', department: 'Product Engineering', manager_id: managerProfile.id },
        { id: managerProfile.id, full_name: 'Rajesh Nair', department: 'Product Engineering', manager_id: null },
      ];
      if (adminProfile) {
        profileUpdates.push({ id: adminProfile.id, full_name: 'Anita Desai', department: 'People & Operations', manager_id: null });
      }

      for (const upd of profileUpdates) {
        await supabase.from('profiles').update({
          full_name: upd.full_name,
          department: upd.department,
          manager_id: upd.manager_id,
        }).eq('id', upd.id);
      }

      // ── Step 3: Create cycles for 2026 — Q2 is active (current quarter) ──
      const cycleDefinitions = [
        { year: 2026, phase: 'goal_setting' as const, opens_at: '2025-12-01', closes_at: '2025-12-31', is_active: false },
        { year: 2026, phase: 'q1' as const, opens_at: '2026-01-01', closes_at: '2026-03-31', is_active: false },
        { year: 2026, phase: 'q2' as const, opens_at: '2026-04-01', closes_at: '2026-06-30', is_active: true },
        { year: 2026, phase: 'q3' as const, opens_at: '2026-07-01', closes_at: '2026-09-30', is_active: false },
        { year: 2026, phase: 'q4' as const, opens_at: '2026-10-01', closes_at: '2026-12-31', is_active: false },
      ];

      // Deactivate all existing cycles first
      await supabase.from('cycles').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

      const cycleIds: Record<string, string> = {};
      for (const cd of cycleDefinitions) {
        const { data: existing } = await supabase
          .from('cycles').select('id')
          .eq('year', cd.year).eq('phase', cd.phase)
          .maybeSingle();

        if (existing) {
          await supabase.from('cycles').update({ is_active: cd.is_active, opens_at: cd.opens_at, closes_at: cd.closes_at }).eq('id', existing.id);
          cycleIds[cd.phase] = existing.id;
        } else {
          const { data: newCycle, error } = await supabase
            .from('cycles').insert(cd as any).select().single();
          if (error) throw error;
          cycleIds[cd.phase] = newCycle.id;
        }
      }

      const q2CycleId = cycleIds['q2'];

      // ── Step 4: Seed goal sheets & goals for Q2 (active cycle) ──
      const employees = allProfiles.filter(p => p.role === 'employee' || p.role === 'manager');

      // Role-specific goal templates — employee vs manager get different goals
      const employeeGoalTemplates = [
        { thrust_area: 'Revenue', title: 'Drive Smart Fan SKU Revenue to ₹12Cr', description: 'Expand the Efficio and Renesa Pro product lines across Tier-2 markets, focusing on dealer activations and Amazon A+ listings.', uom_type: 'min' as const, target_value: 12, weightage: 25 },
        { thrust_area: 'Customer', title: 'Achieve Product NPS of 75+', description: 'Improve after-sales service response time, resolve warranty claims within 48 hours, and implement customer feedback loops.', uom_type: 'min' as const, target_value: 75, weightage: 20 },
        { thrust_area: 'Process', title: 'Deliver IoT Hub Firmware v3.0', description: 'Complete the BLE mesh networking module and OTA update mechanism for the Atomberg IoT ecosystem by end of Q2.', uom_type: 'timeline' as const, target_date: '2026-06-15', weightage: 20 },
        { thrust_area: 'Quality', title: 'Reduce Field Return Rate Below 2%', description: 'Implement automated end-of-line testing for BLDC motor assemblies and tighten incoming QC for PCB batches.', uom_type: 'max' as const, target_value: 2, weightage: 15 },
        { thrust_area: 'People', title: 'Mentor 2 Graduate Trainees', description: 'Onboard and mentor new campus hires on the embedded firmware team through structured 90-day learning paths.', uom_type: 'min' as const, target_value: 2, weightage: 10 },
        { thrust_area: 'Cost', title: 'Reduce Cloud Hosting Costs by 15%', description: 'Migrate telemetry pipelines to reserved instances, implement auto-scaling, and archive cold data to S3 Glacier.', uom_type: 'min' as const, target_value: 15, weightage: 10 },
      ];

      const managerGoalTemplates = [
        { thrust_area: 'Revenue', title: 'Grow Engineering-Led Revenue to ₹45Cr', description: 'Deliver 3 new product variants (mixer grinder, water heater smart) and support GTM with technical demos and channel training.', uom_type: 'min' as const, target_value: 45, weightage: 25 },
        { thrust_area: 'Customer', title: 'Maintain Support SLA at 95%+', description: 'Ensure the engineering support team resolves L2/L3 escalations within committed timelines and maintains CSAT above target.', uom_type: 'min' as const, target_value: 95, weightage: 15 },
        { thrust_area: 'Process', title: 'Launch CI/CD Pipeline for Firmware', description: 'Implement automated build, test, and deploy pipelines for all embedded firmware repositories using GitHub Actions and hardware-in-the-loop testing.', uom_type: 'timeline' as const, target_date: '2026-05-31', weightage: 20 },
        { thrust_area: 'Quality', title: 'Achieve Zero Critical Bugs in Production', description: 'Implement static analysis gates, mandatory code reviews, and staging environment validation for all firmware releases.', uom_type: 'zero' as const, target_value: 0, weightage: 15 },
        { thrust_area: 'People', title: 'Build Team Capacity to 12 Engineers', description: 'Hire 4 senior embedded/IoT engineers, conduct structured onboarding, and achieve less than 10% attrition in the engineering team.', uom_type: 'min' as const, target_value: 12, weightage: 15 },
        { thrust_area: 'Cost', title: 'Optimize Lab & Prototyping Budget', description: 'Reduce prototyping cycle costs by 20% through 3D printing in-house, negotiating better rates with PCB vendors, and reusing test jigs.', uom_type: 'min' as const, target_value: 20, weightage: 10 },
      ];

      // Q1 completed achievement data (historical)
      const q1Achievements_employee = [
        { score: 88, status: 'completed' as const, actual_value: 10.5 },
        { score: 72, status: 'on_track' as const, actual_value: 72 },
        { score: 100, status: 'completed' as const, actual_date: '2026-03-12' },
        { score: 75, status: 'on_track' as const, actual_value: 3.2 },
        { score: 50, status: 'on_track' as const, actual_value: 1 },
        { score: 60, status: 'on_track' as const, actual_value: 9 },
      ];

      const q1Achievements_manager = [
        { score: 82, status: 'on_track' as const, actual_value: 37 },
        { score: 93, status: 'completed' as const, actual_value: 93 },
        { score: 100, status: 'completed' as const, actual_date: '2026-03-28' },
        { score: 100, status: 'completed' as const, actual_value: 0 },
        { score: 75, status: 'on_track' as const, actual_value: 9 },
        { score: 65, status: 'on_track' as const, actual_value: 13 },
      ];

      // Q2 in-progress achievement data (current quarter)
      const q2Achievements_employee = [
        { score: 45, status: 'on_track' as const, actual_value: 5.4 },
        { score: 68, status: 'on_track' as const, actual_value: 68 },
        { score: 0, status: 'not_started' as const },
        { score: 80, status: 'on_track' as const, actual_value: 2.5 },
        { score: 100, status: 'completed' as const, actual_value: 2 },
        { score: 40, status: 'on_track' as const, actual_value: 6 },
      ];

      const q2Achievements_manager = [
        { score: 38, status: 'on_track' as const, actual_value: 17 },
        { score: 96, status: 'completed' as const, actual_value: 96 },
        { score: 100, status: 'completed' as const, actual_date: '2026-05-20' },
        { score: 100, status: 'completed' as const, actual_value: 0 },
        { score: 83, status: 'on_track' as const, actual_value: 10 },
        { score: 50, status: 'on_track' as const, actual_value: 10 },
      ];

      let seededCount = 0;
      for (const emp of employees) {
        const isManager = emp.role === 'manager';
        const templates = isManager ? managerGoalTemplates : employeeGoalTemplates;
        const q1Ach = isManager ? q1Achievements_manager : q1Achievements_employee;
        const q2Ach = isManager ? q2Achievements_manager : q2Achievements_employee;

        // Check if goal sheet already exists for Q2
        const { data: existingSheet } = await supabase
          .from('goal_sheets').select('id')
          .eq('employee_id', emp.id).eq('cycle_id', q2CycleId)
          .maybeSingle();

        if (existingSheet) continue;

        // Create goal sheet for Q2 (active cycle)
        const { data: newSheet, error: sheetErr } = await supabase
          .from('goal_sheets')
          .insert({
            employee_id: emp.id,
            cycle_id: q2CycleId,
            status: 'approved',
            submitted_at: '2026-04-02T10:00:00Z',
            approved_at: '2026-04-03T14:30:00Z',
          })
          .select().single();

        if (sheetErr) throw sheetErr;

        // Create goals
        const goalsToInsert = templates.map(gt => ({
          sheet_id: newSheet.id,
          thrust_area: gt.thrust_area,
          title: gt.title,
          description: gt.description,
          uom_type: gt.uom_type,
          target_value: gt.target_value ?? null,
          target_date: ('target_date' in gt) ? gt.target_date : null,
          weightage: gt.weightage,
          status: 'on_track' as const,
        }));

        const { data: insertedGoals, error: goalsErr } = await supabase
          .from('goals').insert(goalsToInsert).select();

        if (goalsErr) throw goalsErr;

        // Create achievements for Q1 (historical) and Q2 (current/in-progress)
        const achievementsToInsert: any[] = [];

        // Q1 achievements — completed quarter
        insertedGoals.forEach((goal: any, i: number) => {
          const achData = q1Ach[i];
          achievementsToInsert.push({
            goal_id: goal.id,
            cycle_phase: 'q1',
            status: achData.status,
            score: achData.score,
            actual_value: achData.actual_value ?? null,
            actual_date: ('actual_date' in achData) ? achData.actual_date : null,
            manager_comment: isManager ? 'Solid Q1 leadership. Team velocity improved.' : 'Good Q1 execution. Keep pushing on deliverables.',
          });
        });

        // Q2 achievements — current quarter (in-progress)
        insertedGoals.forEach((goal: any, i: number) => {
          const achData = q2Ach[i];
          achievementsToInsert.push({
            goal_id: goal.id,
            cycle_phase: 'q2',
            status: achData.status,
            score: achData.score,
            actual_value: achData.actual_value ?? null,
            actual_date: ('actual_date' in achData) ? achData.actual_date : null,
            manager_comment: achData.status === 'completed' ? 'Well done, target achieved ahead of schedule.'
              : achData.status === 'on_track' ? 'On track — review progress in the next sync.'
                : '',
          });
        });

        await supabase.from('achievements').insert(achievementsToInsert);
        seededCount++;
      }

      // ── Step 5: Add audit log entries ──
      const auditEntries = [
        { entity_type: 'goal_sheet', action: 'SEED_DEMO_DATA', changed_by: adminProfile?.id || employeeProfile.id, new_value: { seeded_employees: seededCount, active_cycle: 'Q2 2026' } },
        { entity_type: 'cycles', action: 'CYCLE_CREATED', changed_by: adminProfile?.id || employeeProfile.id, new_value: { year: 2026, phases: 'goal_setting, q1, q2, q3, q4', active: 'q2' } },
        { entity_type: 'profiles', action: 'PROFILES_UPDATED', changed_by: adminProfile?.id || employeeProfile.id, new_value: { departments: ['Product Engineering', 'People & Operations'], managers_assigned: true } },
      ];
      await supabase.from('audit_logs').insert(auditEntries);

      if (seededCount > 0) {
        toast.success(`Seeded ${seededCount} employee(s) with 6 goals each, Q1 + Q2 achievements, and Q2 as the active cycle!`);
      } else {
        toast.success('Demo data already exists — no duplicates created.');
      }
      fetchCycles();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to seed demo data: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    if (currentlyActive) return;
    await supabase.from('cycles').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('cycles').update({ is_active: true }).eq('id', id);
    fetchCycles();
  };

  if (loading) return <div className="py-8"><Spinner /></div>;

  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Create New Cycle</h2>
      <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28, alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Year</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="form-input" required />
        </div>
        <div>
          <label className="form-label">Phase</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value as any)} className="form-select">
            <option value="goal_setting">Goal Setting</option>
            <option value="q1">Q1</option>
            <option value="q2">Q2</option>
            <option value="q3">Q3</option>
            <option value="q4">Q4</option>
          </select>
        </div>
        <div>
          <label className="form-label">Opens At</label>
          <input type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className="form-input" required />
        </div>
        <div>
          <label className="form-label">Closes At</label>
          <input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="form-input" required />
        </div>
        <div>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: '100%' }}>
            {isSubmitting ? 'Creating…' : 'Create Cycle'}
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Existing Cycles</h2>
        <button onClick={handleSeedData} disabled={isSubmitting} className="btn btn-success btn-sm">
          {isSubmitting ? 'Processing…' : 'Seed Demo Data'}
        </button>
      </div>
      {cycles.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 13 }}>No cycles yet. Create one above.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Year &amp; Phase</th>
                <th>Dates</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>
                    {cycle.year} — {cycle.phase.replace('_', ' ')}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {cycle.opens_at ? new Date(cycle.opens_at).toLocaleDateString() : '—'}{' '}to{' '}
                    {cycle.closes_at ? new Date(cycle.closes_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className={cycle.is_active ? 'badge badge-green' : 'badge badge-gray'}>
                      {cycle.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleActive(cycle.id, cycle.is_active)}
                      disabled={cycle.is_active}
                      style={{ fontSize: 12, fontWeight: 500, color: cycle.is_active ? 'var(--text-muted)' : 'var(--brand-yellow-dark)', background: 'none', border: 'none', cursor: cycle.is_active ? 'default' : 'pointer' }}
                    >
                      Set Active
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Goal Unlock ─────────────────────────────────────────────────────────────

function GoalUnlock({ user }: { user: any }) {
  const [sheets, setSheets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const { toast } = useToast();

  const searchSheets = async () => {
    const { data, error } = await supabase
      .from('goal_sheets')
      .select('*, profiles!goal_sheets_employee_id_fkey(full_name)')
      .eq('status', 'approved');

    if (error) { console.error(error); return; }

    let filtered = (data as any[]) || [];
    if (searchTerm) {
      filtered = filtered.filter((s) =>
        s.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setSheets(filtered);
  };

  useEffect(() => {
    searchSheets();
  }, [searchTerm]);

  const handleUnlock = async (sheetId: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for unlocking.');
      return;
    }

    const { error } = await supabase
      .from('goal_sheets')
      .update({ status: 'draft' })
      .eq('id', sheetId);

    if (!error) {
      await supabase.from('audit_logs').insert({
        entity_type: 'goal_sheet',
        entity_id: sheetId,
        action: 'unlocked',
        changed_by: user?.id,
        old_value: { status: 'approved' },
        new_value: { status: 'draft', reason },
      });
      setReason('');
      setSelectedSheet(null);
      searchSheets();
      toast.success('Goal sheet unlocked');
    } else {
      toast.error('Failed to unlock: ' + error.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <input type="text" placeholder="Search by employee name…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" style={{ maxWidth: 300 }} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Sheet ID</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id}>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sheet.profiles?.full_name || sheet.employee_id}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{sheet.id.slice(0, 8)}…</td>
                <td><span className="badge badge-green">Approved</span></td>
                <td style={{ textAlign: 'right' }}>
                  {selectedSheet === sheet.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <input type="text" placeholder="Reason for unlock" value={reason} onChange={(e) => setReason(e.target.value)} className="form-input" style={{ width: 200 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setSelectedSheet(null)} className="btn btn-secondary btn-sm">Cancel</button>
                        <button onClick={() => handleUnlock(sheet.id)} className="btn btn-danger btn-sm">Confirm Unlock</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedSheet(sheet.id)} className="btn btn-secondary btn-sm">Unlock</button>
                  )}
                </td>
              </tr>
            ))}
            {sheets.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No approved sheets found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared Goals ─────────────────────────────────────────────────────────────

function SharedGoals() {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thrustArea, setThrustArea] = useState('');
  const [uomType, setUomType] = useState('timeline');
  const [target, setTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['employee', 'manager']);
      if (data) setEmployees(data);
    };
    fetchEmployees();
  }, []);

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee.');
      return;
    }
    setIsSubmitting(true);

    // Create master goal (no sheet_id — it's a template)
    const { data: masterGoal, error: masterError } = await supabase
      .from('goals')
      .insert({
        title,
        description,
        thrust_area: thrustArea,
        uom_type: uomType,
        target_value: uomType !== 'timeline' ? Number(target) : null,
        target_date: uomType === 'timeline' ? target : null,
        status: 'not_started',
        is_shared: true,
        weightage: 0,
      })
      .select()
      .single();

    if (masterError || !masterGoal) {
      toast.error('Error creating master goal: ' + masterError?.message);
      setIsSubmitting(false);
      return;
    }

    const { data: activeCycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!activeCycle) {
      toast.error('No active cycle found. Please set a cycle as active first.');
      setIsSubmitting(false);
      return;
    }

    const promises = selectedEmployees.map(async (empId) => {
      let { data: sheet } = await supabase
        .from('goal_sheets')
        .select('id')
        .eq('employee_id', empId)
        .eq('cycle_id', activeCycle.id)
        .maybeSingle();

      let sheetId = sheet?.id;

      if (!sheetId) {
        const { data: newSheet } = await supabase
          .from('goal_sheets')
          .insert({ employee_id: empId, cycle_id: activeCycle.id, status: 'draft' })
          .select()
          .single();
        sheetId = newSheet?.id;
      }

      if (sheetId) {
        await supabase.from('goals').insert({
          sheet_id: sheetId,
          title,
          description,
          thrust_area: thrustArea,
          uom_type: uomType,
          target_value: uomType !== 'timeline' ? Number(target) : null,
          target_date: uomType === 'timeline' ? target : null,
          status: 'not_started',
          shared_from: masterGoal.id,
          weightage: 0,
        });
      }
    });

    await Promise.all(promises);

    toast.success('Shared goals assigned successfully!');
    setTitle('');
    setDescription('');
    setThrustArea('');
    setTarget('');
    setSelectedEmployees([]);
    setIsSubmitting(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Create Shared Goal</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Thrust Area</label>
            <input type="text" required value={thrustArea} onChange={(e) => setThrustArea(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="form-textarea" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">UoM Type</label>
              <select value={uomType} onChange={(e) => setUomType(e.target.value)} className="form-select">
                <option value="timeline">Timeline (Date)</option>
                <option value="max">Maximize (Number)</option>
                <option value="min">Minimize (Number)</option>
                <option value="zero">Zero Tolerance</option>
              </select>
            </div>
            <div>
              <label className="form-label">Target</label>
              <input type={uomType === 'timeline' ? 'date' : 'number'} required value={target} onChange={(e) => setTarget(e.target.value)} className="form-input" />
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ marginTop: 4 }}>
            {isSubmitting ? 'Assigning…' : 'Assign Shared Goal'}
          </button>
        </form>
      </div>

      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          Select Employees ({selectedEmployees.length} selected)
        </h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', maxHeight: 400, overflowY: 'auto', padding: 12, background: 'var(--surface-raised)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {employees.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No employees found.</p>}
          {employees.map((emp) => (
            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id={`emp-${emp.id}`} checked={selectedEmployees.includes(emp.id)} onChange={() => handleToggleEmployee(emp.id)} style={{ accentColor: 'var(--brand-yellow)', width: 15, height: 15 }} />
              <label htmlFor={`emp-${emp.id}`} style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer' }}>
                {emp.full_name || 'Unnamed'}{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({emp.role})</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, startDate, endDate]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*, profiles!audit_logs_changed_by_fkey(full_name)')
      .order('changed_at', { ascending: false })
      .limit(100);

    if (entityFilter) query = query.eq('entity_type', entityFilter);
    if (startDate) query = query.gte('changed_at', new Date(startDate).toISOString());
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('changed_at', end.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error('Audit log fetch error:', error);
      toast.error('Audit log fetch error: ' + error.message);
    }
    if (data) setLogs(data);
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col md:flex-row gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700">Entity Type</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Entities</option>
            <option value="goal_sheet">Goal Sheet</option>
            <option value="goals">Goals</option>
            <option value="cycles">Cycles</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-8"><Spinner /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(log.changed_at || '').toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.profiles?.full_name || log.changed_by || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="text-xs space-y-1">
                      {log.old_value && (
                        <div><span className="font-medium text-gray-600">Old:</span> {JSON.stringify(log.old_value)}</div>
                      )}
                      {log.new_value && (
                        <div><span className="font-medium text-gray-600">New:</span> {JSON.stringify(log.new_value)}</div>
                      )}
                      {!log.old_value && !log.new_value && <span className="italic text-gray-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}