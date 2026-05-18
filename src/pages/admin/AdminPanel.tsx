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
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Manage cycles, goals, and system settings.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'cycles', name: 'Cycle Management' },
              { id: 'unlock', name: 'Goal Unlock' },
              { id: 'shared', name: 'Shared Goals' },
              { id: 'audit', name: 'Audit Log' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
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
        { id: employeeProfile.id, full_name: 'Alice Johnson', department: 'Engineering', manager_id: managerProfile.id },
        { id: managerProfile.id, full_name: 'Bob Smith', department: 'Engineering', manager_id: null },
      ];
      if (adminProfile) {
        profileUpdates.push({ id: adminProfile.id, full_name: 'Carol Admin', department: 'Operations', manager_id: null });
      }

      for (const upd of profileUpdates) {
        await supabase.from('profiles').update({
          full_name: upd.full_name,
          department: upd.department,
          manager_id: upd.manager_id,
        }).eq('id', upd.id);
      }

      // ── Step 3: Create cycles for 2026 (idempotent) ──
      const cycleDefinitions = [
        { year: 2026, phase: 'goal_setting' as const, opens_at: '2025-12-01', closes_at: '2025-12-31', is_active: false },
        { year: 2026, phase: 'q1' as const, opens_at: '2026-01-01', closes_at: '2026-03-31', is_active: true },
        { year: 2026, phase: 'q2' as const, opens_at: '2026-04-01', closes_at: '2026-06-30', is_active: false },
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

      const activeCycleId = cycleIds['q1'];

      // ── Step 4: Seed goal sheets, goals, and achievements for each employee ──
      const employees = allProfiles.filter(p => p.role === 'employee' || p.role === 'manager');

      const goalTemplates = [
        { thrust_area: 'Revenue', title: 'Increase Q1 Sales Revenue by 15%', uom_type: 'min' as const, target_value: 1000000, weightage: 25 },
        { thrust_area: 'Customer', title: 'Achieve NPS Score of 80+', uom_type: 'min' as const, target_value: 80, weightage: 20 },
        { thrust_area: 'Process', title: 'Complete Compliance Training', uom_type: 'timeline' as const, target_date: '2026-03-15', weightage: 15 },
        { thrust_area: 'Quality', title: 'Reduce Bug Escape Rate Below 5%', uom_type: 'max' as const, target_value: 5, weightage: 15 },
        { thrust_area: 'People', title: 'Mentor 2 Junior Team Members', uom_type: 'min' as const, target_value: 2, weightage: 15 },
        { thrust_area: 'Cost', title: 'Cut Infrastructure Costs by 10%', uom_type: 'min' as const, target_value: 10, weightage: 10 },
      ];

      // Achievement data per quarter — varied scores for realistic analytics
      const achievementSets: Record<string, { score: number; status: string; actual_value?: number; actual_date?: string }[]> = {
        q1: [
          { score: 85, status: 'on_track', actual_value: 850000 },
          { score: 78, status: 'on_track', actual_value: 78 },
          { score: 100, status: 'completed', actual_date: '2026-03-10' },
          { score: 60, status: 'on_track', actual_value: 8 },
          { score: 50, status: 'on_track', actual_value: 1 },
          { score: 70, status: 'on_track', actual_value: 7 },
        ],
        q2: [
          { score: 92, status: 'on_track', actual_value: 920000 },
          { score: 82, status: 'on_track', actual_value: 82 },
          { score: 100, status: 'completed', actual_date: '2026-03-10' },
          { score: 80, status: 'on_track', actual_value: 4 },
          { score: 100, status: 'completed', actual_value: 2 },
          { score: 85, status: 'on_track', actual_value: 8.5 },
        ],
        q3: [
          { score: 70, status: 'on_track', actual_value: 700000 },
          { score: 88, status: 'on_track', actual_value: 88 },
          { score: 100, status: 'completed', actual_date: '2026-03-10' },
          { score: 90, status: 'on_track', actual_value: 3 },
          { score: 100, status: 'completed', actual_value: 2 },
          { score: 95, status: 'completed', actual_value: 9.5 },
        ],
        q4: [
          { score: 105, status: 'completed', actual_value: 1050000 },
          { score: 90, status: 'completed', actual_value: 90 },
          { score: 100, status: 'completed', actual_date: '2026-03-10' },
          { score: 100, status: 'completed', actual_value: 2 },
          { score: 100, status: 'completed', actual_value: 2 },
          { score: 100, status: 'completed', actual_value: 10 },
        ],
      };

      let seededCount = 0;
      for (const emp of employees) {
        // Check if goal sheet already exists for this cycle
        const { data: existingSheet } = await supabase
          .from('goal_sheets').select('id')
          .eq('employee_id', emp.id).eq('cycle_id', activeCycleId)
          .maybeSingle();

        if (existingSheet) continue;

        // Create goal sheet
        const { data: newSheet, error: sheetErr } = await supabase
          .from('goal_sheets')
          .insert({
            employee_id: emp.id,
            cycle_id: activeCycleId,
            status: 'approved',
            submitted_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
          })
          .select().single();

        if (sheetErr) throw sheetErr;

        // Create goals
        const goalsToInsert = goalTemplates.map(gt => ({
          sheet_id: newSheet.id,
          thrust_area: gt.thrust_area,
          title: gt.title,
          uom_type: gt.uom_type,
          target_value: gt.target_value ?? null,
          target_date: ('target_date' in gt) ? gt.target_date : null,
          weightage: gt.weightage,
          status: 'on_track' as const,
        }));

        const { data: insertedGoals, error: goalsErr } = await supabase
          .from('goals').insert(goalsToInsert).select();

        if (goalsErr) throw goalsErr;

        // Create achievements for each goal across all 4 quarters
        const achievementsToInsert: any[] = [];
        for (const phase of ['q1', 'q2', 'q3', 'q4']) {
          const phaseAch = achievementSets[phase];
          insertedGoals.forEach((goal: any, i: number) => {
            const achData = phaseAch[i];
            achievementsToInsert.push({
              goal_id: goal.id,
              cycle_phase: phase,
              status: achData.status,
              score: achData.score,
              actual_value: achData.actual_value ?? null,
              actual_date: achData.actual_date ?? null,
              manager_comment: phase === 'q1' ? 'Good start to the year.' :
                phase === 'q2' ? 'Strong mid-year progress.' :
                phase === 'q3' ? 'Keep the momentum going.' :
                'Excellent year-end performance!',
            });
          });
        }

        await supabase.from('achievements').insert(achievementsToInsert);
        seededCount++;
      }

      // ── Step 5: Add audit log entries ──
      const auditEntries = [
        { entity_type: 'goal_sheet', action: 'SEED_DEMO_DATA', changed_by: adminProfile?.id || employeeProfile.id, new_value: { seeded_employees: seededCount } },
        { entity_type: 'cycles', action: 'CYCLE_CREATED', changed_by: adminProfile?.id || employeeProfile.id, new_value: { year: 2026, phases: 'goal_setting, q1, q2, q3, q4' } },
        { entity_type: 'profiles', action: 'PROFILES_UPDATED', changed_by: adminProfile?.id || employeeProfile.id, new_value: { departments_set: true, managers_assigned: true } },
      ];
      await supabase.from('audit_logs').insert(auditEntries);

      if (seededCount > 0) {
        toast.success(`Seeded ${seededCount} employees with 6 goals each, achievements across all 4 quarters, and 5 cycles!`);
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
      <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Cycle</h2>
      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phase</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as any)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="goal_setting">Goal Setting</option>
            <option value="q1">Q1</option>
            <option value="q2">Q2</option>
            <option value="q3">Q3</option>
            <option value="q4">Q4</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Opens At</label>
          <input
            type="date"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Closes At</label>
          <input
            type="date"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Cycle'}
          </button>
        </div>
      </form>

        <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">Existing Cycles</h2>
        <button
          onClick={handleSeedData}
          disabled={isSubmitting}
          className="bg-green-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Processing...' : 'Seed Demo Data'}
        </button>
      </div>
      {cycles.length === 0 ? (
        <p className="text-center text-gray-500 py-6">No cycles yet. Create one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year & Phase</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cycles.map((cycle) => (
                <tr key={cycle.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {cycle.year} — {cycle.phase.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cycle.opens_at ? new Date(cycle.opens_at).toLocaleDateString() : '—'} to{' '}
                    {cycle.closes_at ? new Date(cycle.closes_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cycle.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {cycle.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleToggleActive(cycle.id, cycle.is_active)}
                      disabled={cycle.is_active}
                      className={`text-indigo-600 hover:text-indigo-900 ${cycle.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}
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
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by employee name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sheet ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sheets.map((sheet) => (
              <tr key={sheet.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sheet.profiles?.full_name || sheet.employee_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {sheet.id.slice(0, 8)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Approved
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {selectedSheet === sheet.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <input
                        type="text"
                        placeholder="Reason for unlock"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="text-sm rounded border-gray-300 w-48"
                      />
                      <div className="space-x-2">
                        <button onClick={() => setSelectedSheet(null)} className="text-gray-500">
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUnlock(sheet.id)}
                          className="text-red-600 font-bold"
                        >
                          Confirm Unlock
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedSheet(sheet.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Unlock
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {sheets.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  No approved sheets found.
                </td>
              </tr>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Create Shared Goal</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Thrust Area</label>
            <input
              type="text"
              required
              value={thrustArea}
              onChange={(e) => setThrustArea(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">UoM Type</label>
              <select
                value={uomType}
                onChange={(e) => setUomType(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="timeline">Timeline (Date)</option>
                <option value="max">Maximize (Number)</option>
                <option value="min">Minimize (Number)</option>
                <option value="zero">Zero Tolerance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Target</label>
              <input
                type={uomType === 'timeline' ? 'date' : 'number'}
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Assigning...' : 'Assign Shared Goal'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Select Employees ({selectedEmployees.length} selected)
        </h2>
        <div className="border border-gray-200 rounded-md max-h-[500px] overflow-y-auto p-4 space-y-2 bg-gray-50">
          {employees.length === 0 && (
            <p className="text-sm text-gray-500 text-center">No employees found.</p>
          )}
          {employees.map((emp) => (
            <div key={emp.id} className="flex items-center">
              <input
                type="checkbox"
                id={`emp-${emp.id}`}
                checked={selectedEmployees.includes(emp.id)}
                onChange={() => handleToggleEmployee(emp.id)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor={`emp-${emp.id}`} className="ml-3 block text-sm font-medium text-gray-700">
                {emp.full_name || 'Unnamed'}{' '}
                <span className="text-gray-400 text-xs">({emp.role})</span>
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