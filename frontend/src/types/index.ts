export type Role = 'player' | 'manager' | 'selector' | 'admin';
export type UserStatus = 'active' | 'pending' | 'rejected';
export type AvailabilityStatus = 'available' | 'not_available' | 'maybe' | 'not_responded';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;        // legacy primary role (kept for DB compat)
  roles: Role[];     // all assigned roles
  status?: UserStatus;
  phone?: string;
  bio?: string;
  avatar_url?: string;
  batting_style?: string;
  bowling_style?: string;
  created_at?: string;
}

export interface PendingUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface AvailabilityRecord {
  player_id: number;
  player_name: string;
  avatar_url?: string;
  status: AvailabilityStatus;
  updated_at?: string;
}

export interface Match {
  id: number;
  title: string;
  opponent: string;
  venue: string;
  match_date: string;
  match_time: string;
  match_type: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  result?: string;
  notes?: string;
  ball_type?: 'Red' | 'White';
  attire?: 'White' | 'Colored';
  match_fee?: number | null;
  scorecard_url?: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  team?: TeamSelection[];
}

export interface TeamSelection {
  id: number;
  match_id: number;
  player_id: number;
  player_name: string;
  player_email: string;
  role_in_match: string;
  is_captain: number;
  is_vice_captain: number;
  selected_by: number;
}

export interface BudgetEntry {
  id: number;
  type: 'revenue' | 'expense';
  category: string;
  amount: number;
  description: string;
  entry_date: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface BudgetSummary {
  total_revenue: number;
  total_expense: number;
  net_balance: number;
}

export interface Announcement {
  id: number;
  match_id: number;
  match_title: string;
  opponent: string;
  message: string;
  sent_by: number;
  sent_by_name: string;
  sent_at: string;
}
