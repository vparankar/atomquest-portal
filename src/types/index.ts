export interface Profile {
  id: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
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
  created_at?: string;
  updated_at?: string;
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
  employee_id: string;
  action: string;
  details?: Record<string, any>;
  created_at?: string;
}
