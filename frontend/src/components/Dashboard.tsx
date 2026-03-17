import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  BarChart3,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import { fetchDashboardStats, fetchTeamStats, fetchIssues } from '../api/client';
import type { DashboardStats, TeamStats } from '../api/types';
import { formatHours } from '../utils/format';
import IssueCard from './IssueCard';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} group-hover:scale-105 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TeamStatsTable({ teamStats }: { teamStats: TeamStats[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          Team Statistics
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">Open</th>
              <th className="px-5 py-3">Resolved</th>
              <th className="px-5 py-3">Avg Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {teamStats.map((ts) => (
              <tr key={ts.team_id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-900">
                  {ts.team_name}
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {ts.open_count}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    {ts.resolved_count}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">
                  {formatHours(ts.avg_resolution_hours)}
                </td>
              </tr>
            ))}
            {teamStats.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No team data available yet</p>
                  <p className="text-xs text-slate-300 mt-1">Team stats will appear once teams are assigned issues</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
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
    queryFn: () => fetchIssues({ page: 1, per_page: 10 }),
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

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Issues"
          value={stats?.total_issues ?? 0}
          icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
          color="bg-slate-100"
        />
        <StatCard
          label="Open"
          value={stats?.open_issues ?? 0}
          icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="In Progress"
          value={stats?.in_progress_issues ?? 0}
          icon={<Loader2 className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Resolved"
          value={stats?.resolved_issues ?? 0}
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Critical"
          value={stats?.critical_issues ?? 0}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          label="Avg Resolution"
          value={formatHours(stats?.avg_resolution_hours ?? null)}
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Stats */}
        <div>
          {teamStatsLoading ? (
            <div className="flex items-center justify-center h-40 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <TeamStatsTable teamStats={teamStats ?? []} />
          )}
        </div>

        {/* Recent Issues */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              Recent Issues
            </h2>
          </div>
          <div className="divide-y divide-slate-50 max-h-[480px] overflow-y-auto">
            {recentIssues?.items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            {(!recentIssues || recentIssues.items.length === 0) && (
              <div className="py-12 text-center">
                <Inbox className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">No issues found</p>
                <p className="text-xs text-slate-300 mt-1">Issues will appear here as they are reported</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
