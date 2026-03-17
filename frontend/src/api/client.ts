import axios from 'axios';
import type {
  Issue,
  IssueHistory,
  IssueFilters,
  CreateIssuePayload,
  UpdateIssuePayload,
  Team,
  CreateTeamPayload,
  UpdateTeamPayload,
  Member,
  AssignableMember,
  CreateMemberPayload,
  UpdateMemberPayload,
  DashboardStats,
  TeamStats,
  PaginatedResponse,
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Issues
export async function fetchIssues(filters: IssueFilters = {}): Promise<PaginatedResponse<Issue>> {
  const params: Record<string, string | number> = {};
  if (filters.status) params.status = filters.status;
  if (filters.team_id) params.team_id = filters.team_id;
  if (filters.assigned_to) params.assigned_to = filters.assigned_to;
  if (filters.priority) params.priority = filters.priority;
  if (filters.search) params.search = filters.search;
  params.page = filters.page || 1;
  params.per_page = filters.per_page || 20;
  const { data } = await api.get<PaginatedResponse<Issue>>('/issues', { params });
  return data;
}

export async function fetchIssue(id: string): Promise<Issue> {
  const { data } = await api.get<Issue>(`/issues/${id}`);
  return data;
}

export async function createIssue(payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await api.post<Issue>('/issues', payload);
  return data;
}

export async function updateIssue(id: string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}`, payload);
  return data;
}

export async function resolveIssue(id: string, reason: string): Promise<Issue> {
  const { data } = await api.post<Issue>(`/issues/${id}/resolve`, { reason });
  return data;
}

export async function fetchIssueHistory(id: string): Promise<IssueHistory[]> {
  const { data } = await api.get<IssueHistory[]>(`/issues/${id}/history`);
  return data;
}

// Teams
export async function fetchTeams(): Promise<Team[]> {
  const { data } = await api.get<Team[]>('/teams');
  return data;
}

export async function fetchTeam(id: string): Promise<Team> {
  const { data } = await api.get<Team>(`/teams/${id}`);
  return data;
}

export async function createTeam(payload: CreateTeamPayload): Promise<Team> {
  const { data } = await api.post<Team>('/teams', payload);
  return data;
}

export async function updateTeam(id: string, payload: UpdateTeamPayload): Promise<Team> {
  const { data } = await api.patch<Team>(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await api.delete(`/teams/${id}`);
}

// Members
export async function fetchTeamMembers(teamId: string): Promise<Member[]> {
  const { data } = await api.get<Member[]>(`/teams/${teamId}/members`);
  return data;
}

export async function createMember(teamId: string, payload: CreateMemberPayload): Promise<Member> {
  const { data } = await api.post<Member>(`/teams/${teamId}/members`, payload);
  return data;
}

export async function updateMember(id: string, payload: UpdateMemberPayload): Promise<Member> {
  const { data } = await api.patch<Member>(`/members/${id}`, payload);
  return data;
}

export async function deleteMember(id: string): Promise<void> {
  await api.delete(`/members/${id}`);
}

export async function fetchAssignableMembers(): Promise<AssignableMember[]> {
  const { data } = await api.get<AssignableMember[]>('/members/assignable');
  return data;
}

// Dashboard
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard/stats');
  return data;
}

export async function fetchTeamStats(): Promise<TeamStats[]> {
  const { data } = await api.get<TeamStats[]>('/dashboard/team-stats');
  return data;
}

export async function fetchRecentActivity(limit: number = 5): Promise<IssueHistory[]> {
  const { data } = await api.get<IssueHistory[]>('/dashboard/recent-activity', { params: { limit } });
  return data;
}

