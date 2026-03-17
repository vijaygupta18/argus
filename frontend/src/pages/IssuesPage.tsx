import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Inbox,
  Plus,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchIssues, fetchTeams, createIssue } from '../api/client';
import type { IssueStatus, IssuePriority, Team, Issue } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { timeAgo, statusLabels, priorityLabels } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

/* ------------------------------------------------------------------ */
/* Avatar helper — deterministic color from name                       */
/* ------------------------------------------------------------------ */

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-violet-500', 'bg-fuchsia-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function AvatarCircle({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const bg = nameToColor(name);
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs';
  return (
    <div
      className={`${bg} ${sizeClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ring-2 ring-white`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Priority bar color for issue cards                                  */
/* ------------------------------------------------------------------ */

function priorityBarClass(priority: IssuePriority | null): string {
  switch (priority) {
    case 'critical': return 'priority-bar-critical';
    case 'high': return 'priority-bar-high';
    case 'medium': return 'priority-bar-medium';
    case 'low': return 'priority-bar-low';
    default: return 'priority-bar-none';
  }
}

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

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || !form.description.trim()) return;
    mutation.mutate();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Create Issue</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
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
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {mutation.isPending ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Issue Card Row                                                       */
/* ------------------------------------------------------------------ */

function IssueRow({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left issue-card-hover border-l-[3px] ${priorityBarClass(issue.priority)} bg-white rounded-lg border border-slate-200 px-4 py-3.5 group cursor-pointer hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {issue.title}
            </h3>
            {issue.category && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-medium shrink-0">
                {issue.category}
              </span>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />

            {issue.team_name && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {issue.team_name}
              </span>
            )}

            {/* Assignee avatars */}
            {issue.assignees && issue.assignees.length > 0 ? (
              <div className="flex items-center -space-x-1.5 ml-1">
                {issue.assignees.slice(0, 3).map((a: { id: string; name: string }) => (
                  <AvatarCircle key={a.id} name={a.name} />
                ))}
                {issue.assignees.length > 3 && (
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 flex items-center justify-center ring-2 ring-white">
                    +{issue.assignees.length - 3}
                  </span>
                )}
              </div>
            ) : issue.assignee_name ? (
              <AvatarCircle name={issue.assignee_name} />
            ) : null}

            {/* Reported by */}
            {issue.reported_by_name && (
              <span className="text-xs text-slate-400 ml-1 hidden sm:inline">
                by {issue.reported_by_name}
              </span>
            )}
          </div>
        </div>

        {/* Right: time */}
        <div className="shrink-0 text-right pt-0.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {timeAgo(issue.created_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chip                                                          */
/* ------------------------------------------------------------------ */

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full ring-1 ring-blue-100">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-blue-100 rounded-full p-0.5 transition-colors -mr-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                          */
/* ------------------------------------------------------------------ */

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="text-center py-20 px-6">
      {/* Illustration-like composition */}
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-slate-100 rounded-2xl rotate-6" />
        <div className="absolute inset-0 bg-slate-50 rounded-2xl -rotate-3" />
        <div className="absolute inset-0 bg-white rounded-2xl border border-slate-200 flex items-center justify-center">
          <Inbox className="w-10 h-10 text-slate-300" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {hasFilters ? 'No issues match your filters' : 'No issues yet'}
      </h3>
      <p className="text-sm text-slate-400 max-w-xs mx-auto">
        {hasFilters
          ? 'Try adjusting your filters or broadening your search query to find what you\'re looking for.'
          : 'Issues will appear here as they are reported via Slack or created manually.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear all filters
        </button>
      )}
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

  const clearAllFilters = useCallback(() => {
    setSearchParams({});
    setLocalSearch('');
  }, [setSearchParams]);

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

  // Build active filter summary text
  const activeFilterParts: string[] = [];
  if (statusFilter) activeFilterParts.push(statusLabels[statusFilter as IssueStatus]);
  if (priorityFilter) activeFilterParts.push(`${priorityLabels[priorityFilter as IssuePriority]} priority`);
  if (teamFilter && teams) {
    const team = teams.find(t => t.id === teamFilter);
    if (team) activeFilterParts.push(team.name);
  }
  if (searchQuery) activeFilterParts.push(`"${searchQuery}"`);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('search', localSearch);
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    updateFilter('search', '');
  };

  // Pagination range
  const startItem = data ? (page - 1) * perPage + 1 : 0;
  const endItem = data ? Math.min(page * perPage, data.total) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-page-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Issues</h1>
            {data && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 tabular-nums">
                {data.total}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {hasActiveFilters
              ? `Filtered by ${activeFilterParts.join(', ')}`
              : 'Track and manage production issues'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
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

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search issues..."
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </form>

          <div className="w-px h-6 bg-slate-200 hidden sm:block" />

          {/* Filter dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />

            <select
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors cursor-pointer"
            >
              <option value="">All Statuses</option>
              {(Object.keys(statusLabels) as IssueStatus[]).map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => updateFilter('priority', e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors cursor-pointer"
            >
              <option value="">All Priorities</option>
              {(Object.keys(priorityLabels) as IssuePriority[]).map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </select>

            <select
              value={teamFilter}
              onChange={(e) => updateFilter('team_id', e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors cursor-pointer"
            >
              <option value="">All Teams</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">Active:</span>

            {statusFilter && (
              <FilterChip
                label={statusLabels[statusFilter as IssueStatus]}
                onRemove={() => updateFilter('status', '')}
              />
            )}
            {priorityFilter && (
              <FilterChip
                label={priorityLabels[priorityFilter as IssuePriority]}
                onRemove={() => updateFilter('priority', '')}
              />
            )}
            {teamFilter && teams && (
              <FilterChip
                label={teams.find(t => t.id === teamFilter)?.name || 'Team'}
                onRemove={() => updateFilter('team_id', '')}
              />
            )}
            {searchQuery && (
              <FilterChip
                label={`Search: ${searchQuery}`}
                onRemove={() => { updateFilter('search', ''); setLocalSearch(''); }}
              />
            )}

            <button
              onClick={clearAllFilters}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium ml-1 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Issue List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-400">Loading issues...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium mb-1">Failed to load issues</p>
          <p className="text-xs text-slate-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Try again
          </button>
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState hasFilters={hasActiveFilters} onClear={clearAllFilters} />
        </div>
      ) : (
        <>
          {/* Issue cards */}
          <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
            {data?.items.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onClick={() => navigate(`/issues/${issue.id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 bg-white rounded-xl border border-slate-200 px-5 py-3 shadow-sm">
              <p className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-700">{startItem}-{endItem}</span> of{' '}
                <span className="font-medium text-slate-700">{data?.total}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateFilter('page', String(page - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
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
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                        pageNum === page
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => updateFilter('page', String(page + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
