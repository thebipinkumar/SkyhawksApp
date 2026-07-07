export type Role = 'player' | 'manager' | 'selector' | 'admin' | 'account_manager';

export interface Tournament {
  id: number;
  name: string;
  format?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  created_by: number;
  created_by_name?: string;
  created_at?: string;
}
export type UserStatus = 'active' | 'pending' | 'rejected';
export type AvailabilityStatus = 'available' | 'not_available' | 'not_responded';

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
  membership_start?: string | null;
  membership_end?: string | null;
  last_login?: string | null;
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
  note?: string | null;
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
  tournament_id?: number | null;
  tournament_name?: string | null;
  is_announced?: number;
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
  player_avatar?: string | null;
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
  type: 'team_selection' | 'custom';
  subject: string;
  content: string;
  sent_by_name: string;
  sent_at: string;
  recipient_count?: number | null;
  // team_selection only
  match_title?: string | null;
  opponent?: string | null;
  // custom only
  image_url?: string | null;
  image_position?: 'above' | 'below' | null;
}

export interface BroadcastMember {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  broadcast_email: number; // 1 = enabled, 0 = disabled
}

export type MembershipPaymentStatus = 'paid' | 'pending' | 'waived';

export interface MembershipFee {
  id: number;
  year: number;
  amount: number;
  currency: string;
  created_by: number;
  updated_at: string;
}

export interface MembershipPayment {
  user_id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  status: MembershipPaymentStatus;
  paid_date?: string | null;
  notes?: string | null;
  updated_at?: string | null;
}

export interface MyMembershipStatus {
  year: number;
  status: MembershipPaymentStatus;
  paid_date?: string | null;
  fee_amount?: number | null;
  fee_currency: string;
}

export interface PendingAvailabilityMatch {
  id: number;
  title: string;
  opponent: string;
  venue: string;
  match_date: string;
  match_time: string;
  match_type: string;
  tournament_name?: string | null;
}
