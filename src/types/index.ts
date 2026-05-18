export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  role: 'employee' | 'manager' | 'admin';
  manager_id?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
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
  updated_at?: string;
  profiles?: Profile;
  goals?: Goal[];
}

export interface Achievement {
  id: string;
  employee_id: string;
  title: string;
  description?: string;
  date_earned: string;
  created_at?: string;
}

export interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
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
