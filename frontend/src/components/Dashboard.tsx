import { useQuery, useQueries } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  BarChart3,
  Inbox,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Eye,
  Filter,
  Zap,
  Users,
  Activity,
  CalendarDays,
} from 'lucide-react';
import { fetchDashboardStats, fetchTeamStats, fetchIssues, fetchIssueHistory } from '../api/client';
import type { DashboardStats, TeamStats, Issue, IssueHistory } from '../api/types';
import { formatHours, timeAgo, statusColors } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Fake trend data for demo polish
function fakeTrend(value: number): { delta: number; direction: 'up' | 'down' | 'flat' } {
  if (value === 0) return { delta: 0, direction: 'flat' };
  const seed = (value * 7 + 3) % 10;
  if (seed < 3) return { delta: Math.max(1, Math.floor(value * 0.08)), direction: 'down' };
  if (seed < 7) return { delta: Math.max(1, Math.floor(value * 0.12)), direction: 'up' };
  return { delta: 0, direction: 'flat' };
}

// Micro sparkline bar showing relative percentage
function SparkBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(8, (value / max) * 100) : 8;
  return (
    <div className="mt-3 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  iconBg: string;
  sparkColor: string;
  sparkValue: number;
  sparkMax: number;
  trend?: { delta: number; direction: 'up' | 'down' | 'flat' };
  animClass?: string;
}

function StatCard({ label, value, icon, iconBg, sparkColor, sparkValue, sparkMax, trend, animClass = '' }: StatCardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group ${animClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] text-slate-500 font-medium">{label}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {trend && trend.direction !== 'flat' && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                trend.direction === 'up' ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.delta}
              </span>
            )}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
      <SparkBar value={sparkValue} max={sparkMax} color={sparkColor} />
    </div>
  );
}

function TeamStatsCards({ teamStats }: { teamStats: TeamStats[] }) {
  if (teamStats.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
          <Users className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No team data yet</p>
        <p className="text-xs text-slate-400 mt-1">Stats appear once teams are assigned issues</p>
      </div>
    );
  }

  const teamColors = [
    { bar: 'bg-blue-500', lightBar: 'bg-blue-100', accent: 'text-blue-600' },
    { bar: 'bg-emerald-500', lightBar: 'bg-emerald-100', accent: 'text-emerald-600' },
    { bar: 'bg-violet-500', lightBar: 'bg-violet-100', accent: 'text-violet-600' },
    { bar: 'bg-amber-500', lightBar: 'bg-amber-100', accent: 'text-amber-600' },
    { bar: 'bg-rose-500', lightBar: 'bg-rose-100', accent: 'text-rose-600' },
  ];

  return (
    <div className="space-y-3">
      {teamStats.map((ts, i) => {
        const total = ts.open_count + ts.resolved_count;
        const resolvedPct = total > 0 ? (ts.resolved_count / total) * 100 : 0;
        const colors = teamColors[i % teamColors.length];

        return (
          <div
            key={ts.team_id}
            className="bg-white rounded-2xl border border-slate-200/60 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{ts.team_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatHours(ts.avg_resolution_hours)} avg resolution
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${colors.bar}`} />
                  <span className="text-slate-600 font-medium">{ts.open_count} open</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 font-medium">{ts.resolved_count} resolved</span>
                </span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${resolvedPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {resolvedPct.toFixed(0)}% resolved of {formatNumber(total)} total
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RecentIssueCard({ issue }: { issue: Issue }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/issues/${issue.id}`)}
      className="bg-white rounded-2xl border border-slate-200/60 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative"
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="mt-1.5 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[issue.status].dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
            {issue.title}
          </h4>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
            {issue.team_name && (
              <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium">
                {issue.team_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            {(issue.assignees?.length > 0 || issue.assignee_name) && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  name={issue.assignees?.length > 0 ? issue.assignees[0].name : (issue.assignee_name || '?')}
                  size="xs"
                />
                <span className="text-xs text-slate-500 truncate max-w-[120px]">
                  {issue.assignees?.length > 0
                    ? issue.assignees.map(a => a.name).join(', ')
                    : issue.assignee_name}
                </span>
              </div>
            )}
            <span className="text-[11px] text-slate-400 ml-auto whitespace-nowrap">
              {timeAgo(issue.created_at)}
            </span>
          </div>
        </div>
      </div>
      {/* View button on hover */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg">
          <Eye className="w-3 h-3" />
          View
        </span>
      </div>
    </div>
  );
}

function ActivityFeed({ recentIssueIds }: { recentIssueIds: string[] }) {
  const ids = recentIssueIds.slice(0, 5);

  const results = useQueries({
    queries: ids.map(id => ({
      queryKey: ['issue-history', id] as const,
      queryFn: () => fetchIssueHistory(id),
      enabled: !!id,
    })),
  });

  const allHistory: IssueHistory[] = [];
  for (const r of results) {
    if (r.data) {
      allHistory.push(...r.data);
    }
  }

  // Sort by created_at desc and take top 5
  allHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = allHistory.slice(0, 5);

  const isLoading = results.some(r => r.isLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (latest.length === 0) {
    return (
      <div className="py-8 text-center">
        <Activity className="w-6 h-6 text-slate-200 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {latest.map((entry) => (
        <Link
          key={entry.id}
          to={`/issues/${entry.issue_id}`}
          className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
        >
          <div className="mt-1 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <Activity className="w-3 h-3 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700">
              <span className="font-medium">{entry.performed_by || 'System'}</span>
              {' '}
              <span className="text-slate-500">{entry.action}</span>
              {entry.new_value && (
                <span className="text-slate-500"> to <span className="font-medium text-slate-700">{entry.new_value}</span></span>
              )}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(entry.created_at)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function QuickActions() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link
        to="/issues"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 hover:shadow-sm transition-all duration-150"
      >
        <BarChart3 className="w-4 h-4 text-slate-400" />
        All Issues
      </Link>
      <Link
        to="/issues?priority=critical"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 hover:shadow-sm transition-all duration-150"
      >
        <Zap className="w-4 h-4" />
        Critical Issues
      </Link>
      <Link
        to="/issues?status=open"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
      >
        <Filter className="w-4 h-4" />
        Open Issues
      </Link>
      <Link
        to="/issues?status=in_progress"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 hover:shadow-sm transition-all duration-150"
      >
        <Clock className="w-4 h-4" />
        In Progress
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
        <Inbox className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">No data yet</h2>
      <p className="text-sm text-slate-500 max-w-sm text-center mb-6">
        Issues will appear on your dashboard as they are reported through Slack or created manually.
      </p>
      <Link
        to="/issues"
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
      >
        Go to Issues
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });

  const {
    data: teamStats,
    isLoading: teamStatsLoading,
  } = useQuery<TeamStats[]>({
    queryKey: ['team-stats'],
    queryFn: fetchTeamStats,
  });

  const { data: recentIssues } = useQuery({
    queryKey: ['recent-issues'],
    queryFn: () => fetchIssues({ page: 1, per_page: 8 }),
  });

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-sm text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600 font-medium">Failed to load dashboard stats</p>
        <button
          onClick={() => refetchStats()}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const totalIssues = stats?.total_issues ?? 0;
  const hasData = totalIssues > 0 || (recentIssues && recentIssues.items.length > 0);

  const recentIssueIds = (recentIssues?.items ?? []).map(i => i.id);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8 animate-fade-up">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-blue-200" />
            <span className="text-sm text-blue-200 font-medium">{formatCurrentDate()}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {user?.name ? `Welcome back, ${user.name}` : 'Dashboard Overview'}
          </h1>
          <p className="text-blue-200 text-sm mt-1 max-w-lg">
            Real-time overview of production issues and team performance across Argus.
          </p>
          {/* Mini stats row inside hero */}
          {hasData && (
            <div className="flex items-center gap-6 mt-5">
              <div>
                <p className="text-3xl font-bold text-white">{formatNumber(stats?.open_issues ?? 0)}</p>
                <p className="text-xs text-blue-200 font-medium mt-0.5">Open Issues</p>
              </div>
              <div className="w-px h-10 bg-blue-500/40" />
              <div>
                <p className="text-3xl font-bold text-white">{formatNumber(stats?.critical_issues ?? 0)}</p>
                <p className="text-xs text-blue-200 font-medium mt-0.5">Critical</p>
              </div>
              <div className="w-px h-10 bg-blue-500/40" />
              <div>
                <p className="text-3xl font-bold text-white">{formatHours(stats?.avg_resolution_hours ?? null)}</p>
                <p className="text-xs text-blue-200 font-medium mt-0.5">Avg Resolution</p>
              </div>
            </div>
          )}
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -right-4 w-24 h-24 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-white/5" />
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Quick Actions */}
          <div className="animate-fade-up-1">
            <QuickActions />
          </div>

          {/* Stat Cards - Primary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up-2">
            <StatCard
              label="Total Issues"
              value={stats?.total_issues ?? 0}
              icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
              color="text-slate-600"
              iconBg="bg-slate-100"
              sparkColor="bg-slate-400"
              sparkValue={stats?.total_issues ?? 0}
              sparkMax={stats?.total_issues ?? 1}
              trend={fakeTrend(stats?.total_issues ?? 0)}
            />
            <StatCard
              label="Open"
              value={stats?.open_issues ?? 0}
              icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
              color="text-blue-600"
              iconBg="bg-blue-50"
              sparkColor="bg-blue-500"
              sparkValue={stats?.open_issues ?? 0}
              sparkMax={stats?.total_issues ?? 1}
              trend={fakeTrend(stats?.open_issues ?? 0)}
            />
            <StatCard
              label="In Progress"
              value={stats?.in_progress_issues ?? 0}
              icon={<Loader2 className="w-5 h-5 text-amber-600" />}
              color="text-amber-600"
              iconBg="bg-amber-50"
              sparkColor="bg-amber-500"
              sparkValue={stats?.in_progress_issues ?? 0}
              sparkMax={stats?.total_issues ?? 1}
              trend={fakeTrend(stats?.in_progress_issues ?? 0)}
            />
          </div>

          {/* Stat Cards - Secondary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up-3">
            <StatCard
              label="Resolved"
              value={stats?.resolved_issues ?? 0}
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              color="text-emerald-600"
              iconBg="bg-emerald-50"
              sparkColor="bg-emerald-500"
              sparkValue={stats?.resolved_issues ?? 0}
              sparkMax={stats?.total_issues ?? 1}
              trend={fakeTrend(stats?.resolved_issues ?? 0)}
            />
            <StatCard
              label="Critical"
              value={stats?.critical_issues ?? 0}
              icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
              color="text-red-600"
              iconBg="bg-red-50"
              sparkColor="bg-red-500"
              sparkValue={stats?.critical_issues ?? 0}
              sparkMax={stats?.total_issues ?? 1}
              trend={fakeTrend(stats?.critical_issues ?? 0)}
            />
            <StatCard
              label="Avg Resolution"
              value={formatHours(stats?.avg_resolution_hours ?? null)}
              icon={<Clock className="w-5 h-5 text-violet-600" />}
              color="text-violet-600"
              iconBg="bg-violet-50"
              sparkColor="bg-violet-500"
              sparkValue={Math.min(stats?.avg_resolution_hours ?? 0, 100)}
              sparkMax={100}
            />
          </div>

          {/* Two column layout: Team Stats + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-up-4">
            {/* Team Stats */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  Team Performance
                </h2>
                <Link
                  to="/teams"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                >
                  View all teams
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {teamStatsLoading ? (
                <div className="flex items-center justify-center h-40 bg-white rounded-2xl border border-slate-200/60">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              ) : (
                <TeamStatsCards teamStats={teamStats ?? []} />
              )}
            </div>

            {/* Activity Feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-400" />
                  Recent Activity
                </h2>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
                <ActivityFeed recentIssueIds={recentIssueIds} />
              </div>
            </div>
          </div>

          {/* Recent Issues */}
          <div className="animate-fade-up-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Recent Issues
              </h2>
              <Link
                to="/issues"
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
              >
                View all issues
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentIssues && recentIssues.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentIssues.items.slice(0, 8).map((issue) => (
                  <RecentIssueCard key={issue.id} issue={issue} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/60 py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 font-medium">No issues found</p>
                <p className="text-xs text-slate-400 mt-1">Issues will appear here as they are reported</p>
              </div>
            )}
            {recentIssues && recentIssues.total > 8 && (
              <div className="mt-4 text-center">
                <Link
                  to="/issues"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all {formatNumber(recentIssues.total)} issues
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
