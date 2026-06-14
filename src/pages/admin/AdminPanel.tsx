import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useCycles, useApprovedSheets, useEmployees, useAuditLogs } from '../../hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import type { Cycle } from '../../types';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { notificationService } from '../../lib/notifications';

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
        <div style={{ overflowX: 'auto' }}>
          <div className="tab-nav" style={{ padding: '0 20px', minWidth: 'max-content' }}>
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
  const { data: cycles = [], isLoading: loading } = useCycles();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [phase, setPhase] = useState<Cycle['phase']>('goal_setting');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchCycles = () => queryClient.invalidateQueries({ queryKey: ['cycles'] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (editingId) {
      const { error } = await supabase.from('cycles').update({
        year,
        phase,
        opens_at: opensAt,
        closes_at: closesAt,
      }).eq('id', editingId);
      setIsSubmitting(false);
      if (!error) {
        handleCancelEdit();
        fetchCycles();
        toast.success('Cycle updated successfully');
      } else {
        toast.error('Error updating cycle: ' + error.message);
      }
    } else {
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
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this cycle?')) return;
    const { error } = await supabase.from('cycles').delete().eq('id', id);
    if (!error) {
      fetchCycles();
      toast.success('Cycle deleted successfully');
    } else {
      toast.error('Error deleting cycle: ' + error.message);
    }
  };

  const handleEdit = (cycle: Cycle) => {
    setEditingId(cycle.id);
    setYear(cycle.year);
    setPhase(cycle.phase);
    setOpensAt(cycle.opens_at ? cycle.opens_at.split('T')[0] : '');
    setClosesAt(cycle.closes_at ? cycle.closes_at.split('T')[0] : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setYear(new Date().getFullYear());
    setPhase('goal_setting');
    setOpensAt('');
    setClosesAt('');
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
        { id: managerProfile.id, full_name: 'Rajesh Nair', department: 'Product Engineering', manager_id: managerProfile.id },
      ];
      if (adminProfile) {
        profileUpdates.push({ id: adminProfile.id, full_name: 'Anita Desai', department: 'People & Operations', manager_id: null });
      }

      await Promise.all(profileUpdates.map(upd =>
        supabase.from('profiles').update({
          full_name: upd.full_name,
          department: upd.department,
          manager_id: upd.manager_id,
        }).eq('id', upd.id)
      ));

      // Nuclear reset: wipe all transactional data server-side via RPC
      const { error: resetErr } = await supabase.rpc('reset_demo_data');
      if (resetErr) throw new Error('Failed to reset data: ' + resetErr.message);

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
      await Promise.all(cycleDefinitions.map(async (cd) => {
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
      }));

      const q2CycleId = cycleIds['q2'];

      // ── Step 3.5: Create a master shared goal ──
      let sharedMasterGoalId: string | null = null;
      const { data: existingMaster } = await supabase.from('goals').select('id').eq('is_shared', true).eq('title', 'Company-Wide Cost Optimization').maybeSingle();
      if (existingMaster) {
        sharedMasterGoalId = existingMaster.id;
      } else {
        const { data: newMaster, error: masterErr } = await supabase.from('goals').insert({
          thrust_area: 'Cost',
          title: 'Company-Wide Cost Optimization',
          description: 'Reduce overall operational expenditures by 10% across all departments through resource optimization.',
          uom_type: 'min',
          target_value: 10,
          status: 'not_started',
          is_shared: true,
        }).select().single();
        if (masterErr) throw masterErr;
        sharedMasterGoalId = newMaster.id;
      }

      // ── Step 4: Seed goal sheets & goals for Q2 (active cycle) ──
      const employees = allProfiles.filter(p => p.role === 'employee' || p.role === 'manager');

      // Role-specific goal templates — employee vs manager get different goals
      const employeeGoalTemplates = [
        { thrust_area: 'Revenue', title: 'Drive Smart Fan SKU Revenue to ₹12Cr', description: 'Expand the Efficio and Renesa Pro product lines across Tier-2 markets, focusing on dealer activations and Amazon A+ listings.', uom_type: 'min' as const, target_value: 12, weightage: 25 },
        { thrust_area: 'Customer', title: 'Achieve Product NPS of 75+', description: 'Improve after-sales service response time, resolve warranty claims within 48 hours, and implement customer feedback loops.', uom_type: 'min' as const, target_value: 75, weightage: 20 },
        { thrust_area: 'Process', title: 'Deliver IoT Hub Firmware v3.0', description: 'Complete the BLE mesh networking module and OTA update mechanism for the Atomberg IoT ecosystem by end of Q2.', uom_type: 'timeline' as const, target_date: '2026-06-15', weightage: 20 },
        { thrust_area: 'Quality', title: 'Reduce Field Return Rate Below 2%', description: 'Implement automated end-of-line testing for BLDC motor assemblies and tighten incoming QC for PCB batches.', uom_type: 'max' as const, target_value: 2, weightage: 15 },
        { thrust_area: 'People', title: 'Mentor 2 Graduate Trainees', description: 'Onboard and mentor new campus hires on the embedded firmware team through structured 90-day learning paths.', uom_type: 'min' as const, target_value: 2, weightage: 10 },
        { thrust_area: 'Cost', title: 'Company-Wide Cost Optimization', description: 'Reduce overall operational expenditures by 10% across all departments through resource optimization.', uom_type: 'min' as const, target_value: 10, weightage: 10, is_shared: true },
      ];

      const managerGoalTemplates = [
        { thrust_area: 'Revenue', title: 'Grow Engineering-Led Revenue to ₹45Cr', description: 'Deliver 3 new product variants (mixer grinder, water heater smart) and support GTM with technical demos and channel training.', uom_type: 'min' as const, target_value: 45, weightage: 25 },
        { thrust_area: 'Customer', title: 'Maintain Support SLA at 95%+', description: 'Ensure the engineering support team resolves L2/L3 escalations within committed timelines and maintains CSAT above target.', uom_type: 'min' as const, target_value: 95, weightage: 15 },
        { thrust_area: 'Process', title: 'Launch CI/CD Pipeline for Firmware', description: 'Implement automated build, test, and deploy pipelines for all embedded firmware repositories using GitHub Actions and hardware-in-the-loop testing.', uom_type: 'timeline' as const, target_date: '2026-05-31', weightage: 20 },
        { thrust_area: 'Quality', title: 'Achieve Zero Critical Bugs in Production', description: 'Implement static analysis gates, mandatory code reviews, and staging environment validation for all firmware releases.', uom_type: 'zero' as const, target_value: 0, weightage: 15 },
        { thrust_area: 'People', title: 'Build Team Capacity to 12 Engineers', description: 'Hire 4 senior embedded/IoT engineers, conduct structured onboarding, and achieve less than 10% attrition in the engineering team.', uom_type: 'min' as const, target_value: 12, weightage: 15 },
        { thrust_area: 'Cost', title: 'Company-Wide Cost Optimization', description: 'Reduce overall operational expenditures by 10% across all departments through resource optimization.', uom_type: 'min' as const, target_value: 10, weightage: 10, is_shared: true },
      ];

      // Q1 completed achievement data (historical)
      const q1Achievements_employee = [
        { score: 88, status: 'completed' as const, actual_value: 10.5 },
        { score: 72, status: 'on_track' as const, actual_value: 72 },
        { score: 100, status: 'completed' as const, actual_date: '2026-03-12' },
        { score: 75, status: 'on_track' as const, actual_value: 3.2 },
        { score: 50, status: 'on_track' as const, actual_value: 1 },
        { score: 90, status: 'on_track' as const, actual_value: 9 },
      ];

      const q1Achievements_manager = [
        { score: 82, status: 'on_track' as const, actual_value: 37 },
        { score: 93, status: 'completed' as const, actual_value: 93 },
        { score: 100, status: 'completed' as const, actual_date: '2026-03-28' },
        { score: 100, status: 'completed' as const, actual_value: 0 },
        { score: 75, status: 'on_track' as const, actual_value: 9 },
        { score: 100, status: 'completed' as const, actual_value: 13 },
      ];

      // Q2 in-progress achievement data (current quarter)
      const q2Achievements_employee = [
        { score: 45, status: 'on_track' as const, actual_value: 5.4 },
        { score: 68, status: 'on_track' as const, actual_value: 68 },
        { score: 0, status: 'not_started' as const },
        { score: 80, status: 'on_track' as const, actual_value: 2.5 },
        { score: 100, status: 'completed' as const, actual_value: 2 },
        { score: 60, status: 'on_track' as const, actual_value: 6 },
      ];

      const q2Achievements_manager = [
        { score: 38, status: 'on_track' as const, actual_value: 17 },
        { score: 96, status: 'completed' as const, actual_value: 96 },
        { score: 100, status: 'completed' as const, actual_date: '2026-05-20' },
        { score: 100, status: 'completed' as const, actual_value: 0 },
        { score: 83, status: 'on_track' as const, actual_value: 10 },
        { score: 100, status: 'completed' as const, actual_value: 10 },
      ];

      let seededCount = 0;
      await Promise.all(employees.map(async (emp) => {
        const isManager = emp.role === 'manager';
        const templates = isManager ? managerGoalTemplates : employeeGoalTemplates;
        const q1Ach = isManager ? q1Achievements_manager : q1Achievements_employee;
        const q2Ach = isManager ? q2Achievements_manager : q2Achievements_employee;
        const sheetStatus = isManager ? 'submitted' : 'approved';

        const { data: newSheet, error: sheetErr } = await supabase
          .from('goal_sheets')
          .insert({
            employee_id: emp.id, cycle_id: q2CycleId, status: sheetStatus,
            submitted_at: '2026-04-02T10:00:00Z',
            ...(sheetStatus === 'approved' ? { approved_at: '2026-04-03T14:30:00Z' } : {})
          })
          .select().single();
        if (sheetErr) throw sheetErr;

        const goalsToInsert = templates.map(gt => ({
          sheet_id: newSheet.id, thrust_area: gt.thrust_area, title: gt.title,
          description: gt.description, uom_type: gt.uom_type,
          target_value: gt.target_value ?? null,
          target_date: ('target_date' in gt) ? gt.target_date : null,
          weightage: gt.weightage, status: 'on_track' as const,
          is_shared: ('is_shared' in gt) ? gt.is_shared : false,
          shared_from: ('is_shared' in gt && gt.is_shared) ? sharedMasterGoalId : null,
        }));

        const { data: insertedGoals, error: goalsErr } = await supabase
          .from('goals').insert(goalsToInsert).select();
        if (goalsErr) throw goalsErr;

        const achievementsToInsert: any[] = [];
        insertedGoals.forEach((goal: any, i: number) => {
          achievementsToInsert.push({
            goal_id: goal.id, cycle_phase: 'q1', status: q1Ach[i].status,
            score: q1Ach[i].score, actual_value: q1Ach[i].actual_value ?? null,
            actual_date: ('actual_date' in q1Ach[i]) ? q1Ach[i].actual_date : null,
            manager_comment: isManager ? 'Solid Q1 leadership. Team velocity improved.' : 'Good Q1 execution. Keep pushing on deliverables.',
          });
        });
        if (sheetStatus === 'approved') {
          insertedGoals.forEach((goal: any, i: number) => {
            achievementsToInsert.push({
              goal_id: goal.id, cycle_phase: 'q2', status: q2Ach[i].status,
              score: q2Ach[i].score, actual_value: q2Ach[i].actual_value ?? null,
              actual_date: ('actual_date' in q2Ach[i]) ? q2Ach[i].actual_date : null,
              manager_comment: null,
            });
          });
        }
        await supabase.from('achievements').insert(achievementsToInsert);
        seededCount++;
      }));

      // ── Step 5: Add audit log entries + notifications in parallel ──
      const changedBy = adminProfile?.id || employeeProfile.id;
      const auditEntries = [
        { entity_type: 'goal_sheet', action: 'SEED_DEMO_DATA', changed_by: changedBy, new_value: { seeded_employees: seededCount, active_cycle: 'Q2 2026' } },
        { entity_type: 'cycles', action: 'CYCLE_CREATED', changed_by: changedBy, new_value: { year: 2026, phases: 'goal_setting, q1, q2, q3, q4', active: 'q2' } },
        { entity_type: 'profiles', action: 'PROFILES_UPDATED', changed_by: changedBy, new_value: { departments: ['Product Engineering', 'People & Operations'], managers_assigned: true } },
      ];
      const now = new Date();
      const d = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
      const demoNotifications = [
        { user_id: employeeProfile.id, type: 'goal_approved', title: 'Goals Approved', message: 'Your manager has approved your goal sheet for Q2 2026.', is_read: true, action_url: '/employee/goals', created_at: d(25) },
        { user_id: employeeProfile.id, type: 'checkin_reminder', title: 'Q2 Check-In Reminder', message: 'Please log your Q2 progress for all goals before the end of the quarter.', is_read: false, action_url: '/employee/checkin', created_at: d(3) },
        { user_id: employeeProfile.id, type: 'system', title: 'Welcome to AtomQuest', message: 'Your performance management portal is ready. Start by reviewing your goals.', is_read: true, action_url: '/employee', created_at: d(30) },
        { user_id: managerProfile.id, type: 'goal_submitted', title: 'Goal Sheet Submitted', message: 'Priya Sharma has submitted their goal sheet for approval.', is_read: true, action_url: '/manager/team', created_at: d(26) },
        { user_id: managerProfile.id, type: 'checkin_reminder', title: 'Team Check-In Review', message: 'Your team has pending Q2 check-ins waiting for your review.', is_read: false, action_url: '/manager/reviews', created_at: d(2) },
        { user_id: managerProfile.id, type: 'system', title: 'Goal Sheet Pending', message: 'Your goal sheet for Q2 2026 has been submitted and is awaiting approval.', is_read: true, action_url: '/manager/goals', created_at: d(24) },
      ];
      if (adminProfile) {
        demoNotifications.push(
          { user_id: adminProfile.id, type: 'system', title: 'Demo Data Seeded', message: `${seededCount} employee(s) seeded with goals and achievements.`, is_read: false, action_url: '/admin', created_at: now.toISOString() },
          { user_id: adminProfile.id, type: 'system', title: 'Q2 Cycle Active', message: 'The Q2 2026 cycle is now active. Manager sheet is pending approval for escalation demo.', is_read: true, action_url: '/admin/analytics', created_at: d(20) },
        );
      }
      await Promise.all([
        supabase.from('audit_logs').insert(auditEntries),
        supabase.from('notifications').insert(demoNotifications),
      ]);
      toast.success(`Seeded ${seededCount} employee(s) with goals, achievements, and ${demoNotifications.length} notifications!`);
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
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{editingId ? 'Edit Cycle' : 'Create New Cycle'}</h2>
      <form onSubmit={handleSubmit} className="cycle-form-grid">
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
        <div className="mobile-stack-buttons">
          <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ width: editingId ? 'auto' : '100%', flex: 1 }}>
            {isSubmitting ? (editingId ? 'Updating…' : 'Creating…') : (editingId ? 'Update Cycle' : 'Create Cycle')}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
          )}
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
                  <td style={{ textAlign: 'right', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', height: '100%', minHeight: 40 }}>
                    <button
                      onClick={() => handleToggleActive(cycle.id, cycle.is_active)}
                      disabled={cycle.is_active}
                      style={{ fontSize: 12, fontWeight: 500, color: cycle.is_active ? 'var(--text-muted)' : 'var(--brand-yellow-dark)', background: 'none', border: 'none', cursor: cycle.is_active ? 'default' : 'pointer' }}
                    >
                      Set Active
                    </button>
                    <button
                      onClick={() => handleEdit(cycle)}
                      style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cycle.id)}
                      style={{ fontSize: 12, fontWeight: 500, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Delete
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
  const { data: sheetsData = [] } = useApprovedSheets();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const { toast } = useToast();

  const searchSheets = () => queryClient.invalidateQueries({ queryKey: ['approvedSheets'] });

  const sheets = searchTerm
    ? sheetsData.filter((s: any) => s.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : sheetsData;

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

      // Find the employee ID for this sheet to notify them
      const sheet = sheetsData.find((s: any) => s.id === sheetId);
      if (sheet && sheet.employee_id) {
        await notificationService.createNotification({
          user_id: sheet.employee_id,
          type: 'system',
          title: 'Goal Sheet Unlocked',
          message: `Your manager or admin has unlocked your goal sheet for rework. Reason: ${reason}`,
          action_url: '/employee/goals'
        });
      }

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
  const { data: employees = [] } = useEmployees();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thrustArea, setThrustArea] = useState('');
  const [uomType, setUomType] = useState('timeline');
  const [target, setTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
        .select('id, status')
        .eq('employee_id', empId)
        .eq('cycle_id', activeCycle.id)
        .maybeSingle();

      let sheetId = sheet?.id;
      let sheetStatus = sheet?.status;

      if (!sheetId) {
        const { data: newSheet } = await supabase
          .from('goal_sheets')
          .insert({ employee_id: empId, cycle_id: activeCycle.id, status: 'draft' })
          .select()
          .single();
        sheetId = newSheet?.id;
      } else if (sheetStatus === 'submitted' || sheetStatus === 'approved') {
        await supabase.from('goal_sheets').update({ status: 'draft', manager_comment: 'Sheet unlocked due to new shared goal assignment. Please adjust weightages and resubmit.' }).eq('id', sheetId);
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
          is_shared: true,
          shared_from: masterGoal.id,
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
    <div className="shared-goals-grid">
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
          <div className="profile-form-grid">
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
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data: logs = [], isLoading: loading } = useAuditLogs(entityFilter, startDate, endDate);
  const { toast } = useToast();

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(logs.map(log => ({
      'Time': new Date(log.changed_at || log.created_at).toLocaleString(),
      'Actor': log.profiles?.full_name || log.changed_by,
      'Action': log.action,
      'Entity': log.entity_type,
      'Entity ID': log.entity_id || '',
      'Changes': JSON.stringify(log.new_value || log.details || {})
    })));

    ws['!cols'] = [
      { wch: 20 }, // Time
      { wch: 20 }, // Actor
      { wch: 20 }, // Action
      { wch: 15 }, // Entity
      { wch: 30 }, // Entity ID
      { wch: 50 }, // Changes
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, 'audit_log.xlsx');
    toast.success('Audit log exported successfully');
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="card-title">Audit Log</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{logs.length} record{logs.length !== 1 ? 's' : ''}</div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Entity Type</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="form-select"
              style={{ padding: '6px 10px', height: 34, minWidth: 140 }}
            >
              <option value="">All Entities</option>
              <option value="goal_sheet">Goal Sheet</option>
              <option value="goals">Goals</option>
              <option value="cycles">Cycles</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
              style={{ padding: '6px 10px', height: 34 }}
            />
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              style={{ padding: '6px 10px', height: 34 }}
            />
          </div>
          <button onClick={handleExport} disabled={logs.length === 0} className="btn btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34 }}>
            <Download size={14} /> Export to Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8"><Spinner /></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {new Date(log.changed_at || '').toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {log.profiles?.full_name || log.changed_by || 'System'}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {log.action}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {log.entity_type} {log.entity_id ? <span style={{ fontSize: 11, fontFamily: 'monospace' }}>({log.entity_id.slice(0, 8)}...)</span> : ''}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {log.old_value && (
                        <div><strong style={{ color: 'var(--text)' }}>Old:</strong> {JSON.stringify(log.old_value)}</div>
                      )}
                      {log.new_value && (
                        <div><strong style={{ color: 'var(--text)' }}>New:</strong> {JSON.stringify(log.new_value)}</div>
                      )}
                      {!log.old_value && !log.new_value && <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
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