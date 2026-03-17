import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Filter,
  Inbox,
  Plus,
  X,
} from 'lucide-react';
import { fetchIssues, fetchTeams, createIssue } from '../api/client';
import type { IssueStatus, IssuePriority, Team } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { timeAgo, statusLabels, priorityLabels } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

/* ------------------------------------------------------------------ */
/* Create Issue Modal                                                   */
/* ------------------------------------------------------------------ */

function CreateIssueModal({
  open,
  onClose,
  teams,
}: {
  open: boolean;
  onClose: () => void;
  teams: Team[] | undefined;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as IssuePriority,
    team_id: '',
  });
  const [touched, setTouched] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createIssue({
        title: form.title,
        description: form.description,
        priority: form.priority,
        team_id: form.team_id || undefined,
        reported_by_slack_id: 'web',
        slack_channel_id: 'web',
        slack_thread_ts: Date.now().toString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setForm({ title: '', description: '', priority: 'medium', team_id: '' });
      setTouched(false);
      onClose();
    },
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || !form.description.trim()) return;
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Create Issue</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the issue"
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                touched && !form.title.trim() ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
            />
            {touched && !form.title.trim() && (
              <p className="text-xs text-red-500 mt-1">Title is required</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Detailed description of the production issue..."
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                touched && !form.description.trim() ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
            />
            {touched && !form.description.trim() && (
              <p className="text-xs text-red-500 mt-1">Description is required</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as IssuePriority })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {(Object.keys(priorityLabels) as IssuePriority[]).map((p) => (
                  <option key={p} value={p}>{priorityLabels[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
              <select
                value={form.team_id}
                onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Unassigned</option>
                {teams?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          {mutation.isError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-sm text-red-700">Failed to create issue. Please try again.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Issues Page                                                     */
/* ------------------------------------------------------------------ */

export default function IssuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, user } = useAuth();
  const isLeader = user && Object.values(user.roles).includes('leader');
  const canCreate = isAdmin || isLeader;

  const statusFilter = (searchParams.get('status') as IssueStatus) || '';
  const teamFilter = searchParams.get('team_id') || '';
  const priorityFilter = (searchParams.get('priority') as IssuePriority) || '';
  const searchQuery = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = 20;

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const { data, isLoading, error, refetch } = useQuery({
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
  const hasActiveFilters = !!(statusFilter || teamFilter || priorityFilter || searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', localSearch);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Issues</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `${data.total} total issue${data.total !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Issue
          </button>
        )}
      </div>

      {/* Create Issue Modal */}
      <CreateIssueModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        teams={teams}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
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
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
          </form>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
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
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
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
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
          >
            <option value="">All Teams</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchParams({});
                setLocalSearch('');
              }}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-400">Loading issues...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600 font-medium">Failed to load issues</p>
            <button
              onClick={() => refetch()}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Try again
            </button>
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
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
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
                        {issue.team_name || <span className="text-slate-300">--</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {issue.assignees && issue.assignees.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {issue.assignees.map((a: { id: string; name: string }, idx: number) => (
                              <span key={a.id} className="inline-flex items-center">
                                <span className="text-slate-700">{a.name}</span>
                                {idx < issue.assignees.length - 1 && (
                                  <span className="text-slate-300 mx-0.5">,</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          issue.assignee_name || <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {issue.reported_by_name || <span className="text-slate-300">--</span>}
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
                <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  {hasActiveFilters ? 'No issues match your filters' : 'No issues yet'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or search query'
                    : 'Issues will appear here as they are reported via Slack'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSearchParams({});
                      setLocalSearch('');
                    }}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear all filters
                  </button>
                )}
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
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          pageNum === page
                            ? 'bg-blue-600 text-white shadow-sm'
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
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
