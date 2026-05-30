import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  managerProfile: (managerId: string) => ['managerProfile', managerId] as const,
  cycles: ['cycles'] as const,
  approvedSheets: ['approvedSheets'] as const,
  employees: ['employees'] as const,
  auditLogs: (entityFilter: string, startDate: string, endDate: string) => ['auditLogs', entityFilter, startDate, endDate] as const,
  employeeStats: (userId: string) => ['employeeStats', userId] as const,
  managerStats: (userId: string) => ['managerStats', userId] as const,
  approvalQueue: (userId: string, status: string) => ['approvalQueue', userId, status] as const,
  checkInReview: (userId: string) => ['checkInReview', userId] as const,
  goalSheet: (userId: string) => ['goalSheet', userId] as const,
  checkIn: (userId: string) => ['checkIn', userId] as const,
};


// ─── Profile ─────────────────────────────────────────────────────────
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.profile(userId) : ['profile', 'none'],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });
}

export function useManagerProfile(managerId: string | null | undefined) {
  return useQuery({
    queryKey: managerId ? queryKeys.managerProfile(managerId) : ['managerProfile', 'none'],
    queryFn: async () => {
      if (!managerId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', managerId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!managerId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string, updates: Partial<Profile> }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
        
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(variables.userId) });
    },
  });
}

// ─── Cycles (all) ────────────────────────────────────────────────────
export function useCycles() {
  return useQuery({
    queryKey: queryKeys.cycles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ─── Approved Sheets ─────────────────────────────────────────────────
export function useApprovedSheets() {
  return useQuery({
    queryKey: queryKeys.approvedSheets,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goal_sheets')
        .select('*, profiles!goal_sheets_employee_id_fkey(full_name)')
        .eq('status', 'approved');
      if (error) throw error;
      return data;
    },
  });
}

// ─── Employees ───────────────────────────────────────────────────────
export function useEmployees() {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['employee', 'manager']);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Audit Logs ──────────────────────────────────────────────────────
export function useAuditLogs(entityFilter: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.auditLogs(entityFilter, startDate, endDate),
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles!audit_logs_changed_by_fkey(full_name)')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (entityFilter) query = query.eq('entity_type', entityFilter);
      if (startDate) query = query.gte('changed_at', `${startDate}T00:00:00Z`);
      if (endDate) query = query.lte('changed_at', `${endDate}T23:59:59Z`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0, // audit logs are append-only — always refetch on mount
  });
}

// ─── Employee Stats (Dashboard) ──────────────────────────────────────
export function useEmployeeStats(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.employeeStats(userId) : ['employeeStats', 'none'],
    queryFn: async () => {
      if (!userId) return null;
      const { data: cycle } = await supabase.from('cycles').select('*').eq('is_active', true).maybeSingle();
      if (!cycle) return { activeCycle: null, sheetStatus: null, totalGoals: 0, completedGoals: 0, onTrackGoals: 0, latestScore: null };
      
      const { data: sheet } = await supabase.from('goal_sheets').select('id,status').eq('employee_id', userId).eq('cycle_id', cycle.id).maybeSingle();
      let totalGoals = 0, completedGoals = 0, onTrackGoals = 0, latestScore: number | null = null;
      
      if (sheet) {
        const { data: goals } = await supabase.from('goals').select('id,status').eq('sheet_id', sheet.id);
        totalGoals = goals?.length || 0;
        completedGoals = goals?.filter(g => g.status === 'completed').length || 0;
        onTrackGoals = goals?.filter(g => g.status === 'on_track').length || 0;
        if (goals && goals.length > 0) {
          const { data: ach } = await supabase.from('achievements').select('score').in('goal_id', goals.map(g => g.id)).eq('cycle_phase', cycle.phase);
          if (ach && ach.length > 0) latestScore = Math.round(ach.reduce((s, a) => s + (a.score || 0), 0) / ach.length);
        }
      }
      return { activeCycle: cycle, sheetStatus: sheet?.status || null, totalGoals, completedGoals, onTrackGoals, latestScore };
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

// ─── Manager Stats (Dashboard) ──────────────────────────────────────
export function useManagerStats(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.managerStats(userId) : ['managerStats', 'none'],
    queryFn: async () => {
      if (!userId) return null;

      // Parallel fetch: cycle + team in one shot
      const [cycleRes, teamRes] = await Promise.all([
        supabase.from('cycles').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('profiles').select('id').eq('manager_id', userId),
      ]);

      const cycle = cycleRes.data;
      const teamIds = teamRes.data?.map(t => t.id) || [];
      let pendingApprovals = 0, approvedSheets = 0, checkInsCompleted = 0, checkInsPending = 0;

      if (cycle && teamIds.length > 0) {
        // Parallel fetch: pending count + approved sheets
        const [pendingRes, approvedRes] = await Promise.all([
          supabase.from('goal_sheets').select('id', { count: 'exact', head: true }).eq('status', 'submitted').in('employee_id', teamIds),
          supabase.from('goal_sheets').select('id').eq('status', 'approved').eq('cycle_id', cycle.id).in('employee_id', teamIds),
        ]);

        pendingApprovals = pendingRes.count || 0;
        const appr = approvedRes.data;
        approvedSheets = appr?.length || 0;

        if (appr && appr.length > 0) {
          const { data: goals } = await supabase.from('goals').select('id').in('sheet_id', appr.map(s => s.id));
          if (goals && goals.length > 0) {
            const { data: ach } = await supabase.from('achievements').select('id,status').eq('cycle_phase', cycle.phase).in('goal_id', goals.map(g => g.id));
            checkInsCompleted = ach?.filter(a => a.status === 'completed' || a.status === 'on_track').length || 0;
            checkInsPending = Math.max(0, goals.length - checkInsCompleted);
          }
        }
      }

      return { activeCycle: cycle, teamSize: teamIds.length, pendingApprovals, approvedSheets, checkInsCompleted, checkInsPending };
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

// ─── Approval Queue ──────────────────────────────────────────────────
export function useApprovalQueue(userId: string | undefined, status: string) {
  return useQuery({
    queryKey: userId ? queryKeys.approvalQueue(userId, status) : ['approvalQueue', 'none', status],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('goal_sheets')
        .select('*, profiles!goal_sheets_employee_id_fkey!inner(*), goals(*)')
        .eq('status', status)
        .eq('profiles.manager_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 0, // always refetch — approval actions change this data
    placeholderData: keepPreviousData,
  });
}

// ─── Check-In Review (Manager) ──────────────────────────────────────
export function useCheckInReview(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.checkInReview(userId) : ['checkInReview', 'none'],
    queryFn: async () => {
      if (!userId) return { activeCycle: null, teamCheckIns: [], initialComments: {} };

      const { data: cycleData, error: cycleError } = await supabase.from('cycles').select('*').eq('is_active', true).single();
      if (cycleError) throw cycleError;
      if (!cycleData) return { activeCycle: null, teamCheckIns: [], initialComments: {} };

      const { data: teamData, error: teamError } = await supabase.from('profiles').select('*').eq('manager_id', userId);
      if (teamError) throw teamError;

      if (!teamData || teamData.length === 0) {
        return { activeCycle: cycleData, teamCheckIns: [], initialComments: {} };
      }

      const teamIds = teamData.map(t => t.id);

      // Parallel fetch: sheets, (then goals + achievements based on sheets)
      const { data: sheetsData } = await supabase
        .from('goal_sheets')
        .select('id,employee_id')
        .eq('cycle_id', cycleData.id)
        .eq('status', 'approved')
        .in('employee_id', teamIds);

      const sheetIds = sheetsData?.map(s => s.id) || [];

      if (sheetIds.length === 0) {
        const teamCheckIns = teamData.map(member => ({
          ...member,
          goals: [],
          overallStatus: 'pending' as const,
        }));
        return { activeCycle: cycleData, teamCheckIns, initialComments: {} };
      }

      // Fetch goals first, then achievements scoped to those goals
      const { data: goalsData_ } = await supabase.from('goals').select('*').in('sheet_id', sheetIds);
      const goalsData = goalsData_ || [];
      const goalIds = goalsData.map(g => g.id);

      let achievementsData: any[] = [];
      if (goalIds.length > 0) {
        const { data: achData } = await supabase
          .from('achievements')
          .select('*')
          .eq('cycle_phase', cycleData.phase)
          .in('goal_id', goalIds);
        achievementsData = achData || [];
      }

      const initialComments: Record<string, string> = {};
      const teamCheckIns = teamData.map(member => {
        const memberSheet = sheetsData?.find(s => s.employee_id === member.id);
        const memberGoals = memberSheet ? goalsData.filter(g => g.sheet_id === memberSheet.id) : [];
        let allCompleted = true;
        const hasGoals = memberGoals.length > 0;
        const goalsWithAch = memberGoals.map(g => {
          const ach = achievementsData.find(a => a.goal_id === g.id);
          if (!ach || ach.status !== 'completed') allCompleted = false;
          if (ach) initialComments[ach.id] = ach.manager_comment || '';
          return { ...g, achievement: ach };
        });
        return {
          ...member,
          goals: goalsWithAch,
          overallStatus: (hasGoals && allCompleted) ? 'completed' as const : 'pending' as const,
        };
      });

      return { activeCycle: cycleData, teamCheckIns, initialComments };
    },
    enabled: !!userId,
    staleTime: 0, // always refetch — check-in data changes frequently
    placeholderData: keepPreviousData,
  });
}

// ─── Employee Goal Sheet ─────────────────────────────────────────────
export function useGoalSheet(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.goalSheet(userId) : ['goalSheet', 'none'],
    queryFn: async () => {
      if (!userId) return { activeCycle: null, goalSheet: null, goals: [] };

      const { data: cycleData, error: cycleError } = await supabase
        .from('cycles')
        .select('*')
        .eq('is_active', true)
        .single();
      if (cycleError) throw cycleError;
      if (!cycleData) return { activeCycle: null, goalSheet: null, goals: [] };

      const { data: sheetData, error: sheetError } = await supabase
        .from('goal_sheets')
        .select('*')
        .eq('employee_id', userId)
        .eq('cycle_id', cycleData.id)
        .maybeSingle();
      if (sheetError) throw sheetError;

      if (!sheetData) {
        return { activeCycle: cycleData, goalSheet: null, goals: [] };
      }

      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('sheet_id', sheetData.id);
      if (goalsError) throw goalsError;

      return { activeCycle: cycleData, goalSheet: sheetData, goals: goalsData || [] };
    },
    enabled: !!userId,
    staleTime: 0, // always refetch — goal edits/submissions change this
    placeholderData: keepPreviousData,
  });
}

// ─── Employee Check-In ──────────────────────────────────────────────
export function useCheckIn(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.checkIn(userId) : ['checkIn', 'none'],
    queryFn: async () => {
      if (!userId) return { activeCycle: null, isOpen: false, goals: [] };

      const { data: cycleData, error: cycleError } = await supabase
        .from('cycles')
        .select('*')
        .eq('is_active', true)
        .single();
      if (cycleError) throw cycleError;
      if (!cycleData) return { activeCycle: null, isOpen: false, goals: [] };

      const today = new Date().toISOString().split('T')[0];
      const isOpen = today >= cycleData.opens_at && today <= cycleData.closes_at;
      if (!isOpen) return { activeCycle: cycleData, isOpen: false, goals: [] };

      const { data: sheetData, error: sheetError } = await supabase
        .from('goal_sheets')
        .select('*')
        .eq('employee_id', userId)
        .eq('cycle_id', cycleData.id)
        .eq('status', 'approved')
        .maybeSingle();
      if (sheetError) throw sheetError;
      if (!sheetData) return { activeCycle: cycleData, isOpen: true, goals: [] };

      // Parallel: goals + achievements
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('sheet_id', sheetData.id);
      if (goalsError) throw goalsError;

      const goalIds = goalsData?.map(g => g.id) || [];
      const { data: achievementsData } = await supabase
        .from('achievements')
        .select('*')
        .in('goal_id', goalIds)
        .eq('cycle_phase', cycleData.phase);

      const merged = (goalsData || []).map(g => {
        const ach = achievementsData?.find(a => a.goal_id === g.id);
        return {
          ...g,
          achievement_id: ach?.id,
          actual_value: ach?.actual_value !== null ? ach?.actual_value : '',
          actual_date: ach?.actual_date || '',
          checkin_status: ach?.status || 'not_started',
          score: ach?.score || 0,
          manager_comment: ach?.manager_comment || '',
        };
      });

      return { activeCycle: cycleData, isOpen: true, goals: merged };
    },
    enabled: !!userId,
    staleTime: 0, // always refetch — check-in saves change this
    placeholderData: keepPreviousData,
  });
}
