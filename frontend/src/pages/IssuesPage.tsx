import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { fetchIssues, fetchTeams } from '../api/client';
import type { IssueStatus, IssuePriority, Team } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { timeAgo, statusLabels, priorityLabels } from '../utils/format';

export default function IssuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = (searchParams.get('status') as IssueStatus) || '';
  const teamFilter = searchParams.get('team_id') || '';
  const priorityFilter = (searchParams.get('priority') as IssuePriority) || '';
  const searchQuery = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 20;

  const [localSearch, setLocalSearch] = useState(searchQuery);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const newParams = new URLSearchParams(searchParams);
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      if (key !== 'page') {
        newParams.delete('page');
      }
      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['issues', statusFilter, teamFilter, priorityFilter, searchQuery, page],
    queryFn: () =>
      fetchIssues({
        status: statusFilter as IssueStatus || undefined,
        team_id: teamFilter || undefined,
        priority: priorityFilter as IssuePriority || undefined,
        search: searchQuery || undefined,
        page,
        per_page: perPage,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / perPage) : 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', localSearch);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Issues</h1>
        <p className="text-sm text-slate-500 mt-1">
          {data ? `${data.total} total issues` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search issues..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Statuses</option>
            {(Object.keys(statusLabels) as IssueStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Priorities</option>
            {(Object.keys(priorityLabels) as IssuePriority[]).map((p) => (
              <option key={p} value={p}>
                {priorityLabels[p]}
              </option>
            ))}
          </select>

          {/* Team */}
          <select
            value={teamFilter}
            onChange={(e) => updateFilter('team_id', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Teams</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {(statusFilter || teamFilter || priorityFilter || searchQuery) && (
            <button
              onClick={() => {
                setSearchParams({});
                setLocalSearch('');
              }}
              className="text-sm text-slate-500 hover:text-slate-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            <AlertCircle className="w-5 h-5 mr-2" />
            Failed to load issues
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Team</th>
                    <th className="px-5 py-3">Assigned To</th>
                    <th className="px-5 py-3">Reported By</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((issue) => (
                    <tr
                      key={issue.id}
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-900 hover:text-blue-600">
                          {issue.title}
                        </span>
                        {issue.category && (
                          <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {issue.category}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <PriorityBadge priority={issue.priority} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {issue.team_name || <span className="text-slate-400">--</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {issue.assignee_name || <span className="text-slate-400">--</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {issue.reported_by_name || <span className="text-slate-400">--</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {timeAgo(issue.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data && data.items.length === 0 && (
              <div className="text-center py-16">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No issues match your filters</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages} ({data?.total} results)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateFilter('page', String(page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (page <= 4) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = page - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => updateFilter('page', String(pageNum))}
                        className={`w-8 h-8 rounded-lg text-sm font-medium ${
                          pageNum === page
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => updateFilter('page', String(page + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
