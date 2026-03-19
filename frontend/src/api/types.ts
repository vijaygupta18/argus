export interface Team {
  id: string;
  name: string;
  description: string | null;
  reminder_frequency_minutes: number;
  reminder_start_hour: number;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  team_id: string;
  name: string;
  slack_user_id: string;
  email: string | null;
  role: 'manager' | 'agent';
  is_active: boolean;
  notifications_muted: boolean;
  open_issue_count: number;
  total_assigned_count: number;
  created_at: string;
}

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority | null;
  category: string | null;
  team_id: string | null;
  assigned_to: string | null;
  assignees: { id: string; name: string; slack_user_id?: string }[];
  assignee_name: string | null;
  team_name: string | null;
  reported_by_slack_id: string;
  reported_by_name: string | null;
  reported_by_email: string | null;
  slack_channel_id: string;
  slack_channel_name: string | null;
  slack_thread_ts: string;
  ai_categorization: Record<string, unknown> | null;
  ai_rca: Record<string, unknown> | string | null;
  ai_provider_used: string | null;
  resolved_at: string | null;
  notifications_muted: boolean;
  last_reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssueHistory {
  id: string;
  issue_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_issues: number;
  open_issues: number;
  in_progress_issues: number;
  resolved_issues: number;
  critical_issues: number;
  avg_resolution_hours: number | null;
}

export interface TeamStats {
  team_id: string;
  team_name: string;
  open_count: number;
  resolved_count: number;
  avg_resolution_hours: number | null;
}

export interface AssignableMember {
  id: string;
  name: string;
  email: string | null;
  slack_user_id: string;
  team_id: string;
  team_name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface IssueFilters {
  status?: IssueStatus;
  team_id?: string;
  assigned_to?: string;
  priority?: IssuePriority;
  search?: string;
  mine?: boolean;
  page?: number;
  per_page?: number;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  priority?: IssuePriority;
  team_id?: string;
  assigned_to?: string;
  reported_by_slack_id: string;
  slack_channel_id: string;
  slack_thread_ts: string;
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  team_id?: string | null;
  assigned_to?: string | null;
  assignees?: { id: string; name: string; slack_user_id?: string }[];
  notifications_muted?: boolean;
  reason?: string;
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  reminder_frequency_minutes?: number;
  reminder_start_hour?: number;
  notifications_enabled?: boolean;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string | null;
  reminder_frequency_minutes?: number;
  reminder_start_hour?: number;
  notifications_enabled?: boolean;
}

export interface CreateMemberPayload {
  name?: string;
  slack_user_id?: string;
  email?: string;
  is_active?: boolean;
}

export interface UpdateMemberPayload {
  name?: string;
  email?: string | null;
  role?: 'manager' | 'agent';
  is_active?: boolean;
  notifications_muted?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  slack_user_id: string | null;
  is_admin: boolean;
  roles: Record<string, 'manager' | 'agent'>;
}
