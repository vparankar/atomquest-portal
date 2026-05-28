import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
};

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
  });
}

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
  });
}
