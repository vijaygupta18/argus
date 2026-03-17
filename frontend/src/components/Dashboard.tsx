import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  BarChart3,
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
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
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
          <BarChart3 className="w-4 h-4 text-slate-500" />
          Team Statistics
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">Open</th>
              <th className="px-5 py-3">Resolved</th>
              <th className="px-5 py-3">Avg Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teamStats.map((ts) => (
              <tr key={ts.team_id} className="hover:bg-slate-50">
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
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">
                  No team data available
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-5 h-5 mr-2" />
        Failed to load dashboard stats
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
              <AlertCircle className="w-4 h-4 text-slate-500" />
              Recent Issues
            </h2>
          </div>
          <div className="p-3 space-y-2 max-h-[480px] overflow-y-auto">
            {recentIssues?.items.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            {(!recentIssues || recentIssues.items.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-8">No issues found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
