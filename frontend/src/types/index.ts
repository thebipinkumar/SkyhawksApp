export type Role = 'player' | 'manager' | 'selector' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  bio?: string;
  avatar_url?: string;
  batting_style?: string;
  bowling_style?: string;
  created_at?: string;
}

export interface Match {
  id: number;
  title: string;
  opponent: string;
  venue: string;
  match_date: string;
  match_time: string;
  match_type: 'T20' | 'ODI' | 'Test' | 'Practice';
  status: 'scheduled' | 'completed' | 'cancelled';
  result?: string;
  notes?: string;
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
