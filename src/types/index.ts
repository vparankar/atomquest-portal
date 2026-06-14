export interface Profile {
  id: string;
  full_name?: string;
  role: 'employee' | 'manager' | 'admin';
  manager_id?: string;
  department?: string;
  created_at?: string;
}

export interface Goal {
  id: string;
  sheet_id?: string;
  thrust_area: string;
  title: string;
  description?: string;
  uom_type?: 'min' | 'max' | 'timeline' | 'zero';
  target_value?: number;
  target_date?: string;
  weightage?: number;
  status: 'not_started' | 'on_track' | 'completed';
  is_shared?: boolean;
  shared_from?: string;
  created_at?: string;
}

export interface GoalSheet {
  id: string;
  employee_id: string;
  cycle_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'rework';
  manager_comment?: string;
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  created_at?: string;
  profiles?: Profile;
  goals?: Goal[];
}

export interface Achievement {
  id: string;
  goal_id: string;
  cycle_phase: 'q1' | 'q2' | 'q3' | 'q4';
  actual_value?: number;
  actual_date?: string;
  status: 'not_started' | 'on_track' | 'completed';
  score?: number;
  manager_comment?: string;
  logged_at?: string;
  goal?: Goal;
}

export interface Cycle {
  id: string;
  year: number;
  phase: 'goal_setting' | 'q1' | 'q2' | 'q3' | 'q4';
  opens_at: string;
  closes_at: string;
  is_active: boolean;
  created_at?: string;
}

export interface AuditLog {
  id: string;
  entity_type?: string;
  entity_id?: string;
  action: string;
  changed_by?: string;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  changed_at?: string;
  // Legacy fields for backward compatibility with existing code
  employee_id?: string;
  details?: Record<string, any>;
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'goal_submitted' | 'goal_approved' | 'goal_rejected' | 'checkin_reminder' | 'escalation' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  created_at?: string;
}
