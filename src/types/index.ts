export interface Profile {
  id: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface GoalSheet {
  id: string;
  user_id: string;
  cycle_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface Achievement {
  id: string;
  user_id: string;
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
  user_id: string;
  action: string;
  details?: Record<string, any>;
  created_at?: string;
}
