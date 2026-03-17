import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  User,
  Users,
  Hash,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  History,
  Brain,
  X,
  ArrowRightLeft,
  UserCheck,
  Tag,
  AlertCircle,
  RefreshCw,
  GitBranch,
  Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchIssue, fetchIssueHistory, updateIssue, resolveIssue, fetchTeams, fetchTeamMembers } from '../api/client';
import type { Issue, IssueHistory as IssueHistoryType, IssueStatus, Member, Team } from '../api/types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatDate, timeAgo, statusLabels } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

interface IssueDetailProps {
  issueId: string;
}

/* ------------------------------------------------------------------ */
/* Resolve / Close Modal                                               */
/* ------------------------------------------------------------------ */

function ReasonModal({
  title,
  label,
  submitLabel,
  open,
  isPending,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  submitLabel: string;
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {label} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Please provide details..."
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                touched && !reason.trim()
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-300'
              }`}
            />
            {touched && !reason.trim() && (
              <p className="text-xs text-red-500 mt-1">This field is required</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Submitting...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RCA Skeleton Loader                                                 */
/* ------------------------------------------------------------------ */

function RCASkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-purple-100 animate-pulse" />
        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
        <div className="h-3 bg-slate-100 rounded animate-pulse w-5/6" />
        <div className="h-3 bg-slate-100 rounded animate-pulse w-4/6" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-slate-50 rounded animate-pulse w-32" />
        <div className="h-3 bg-slate-50 rounded animate-pulse w-full" />
        <div className="h-3 bg-slate-50 rounded animate-pulse w-5/6" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-slate-50 rounded animate-pulse w-40" />
        <div className="h-3 bg-slate-50 rounded animate-pulse w-full" />
        <div className="h-3 bg-slate-50 rounded animate-pulse w-3/4" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
        <span className="text-xs text-slate-400">AI is analyzing this issue...</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RCA Panel                                                           */
/* ------------------------------------------------------------------ */

function RCAPanel({ rca }: { rca: Issue['ai_rca'] }) {
  const [expanded, setExpanded] = useState(true);

  if (!rca) return null;

  const data = typeof rca === 'string' ? (() => { try { return JSON.parse(rca); } catch { return null; } })() : rca;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">AI Root Cause Analysis</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-5">
          {data?.summary && (
            <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
          )}

          {data?.root_causes?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Root Causes</h4>
              <div className="space-y-2.5">
                {data.root_causes.map((rc: { cause: string; probability: string }, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
                      rc.probability === 'high' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' :
                      rc.probability === 'medium' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' :
                      'bg-green-50 text-green-700 ring-1 ring-green-100'
                    }`}>{rc.probability}</span>
                    <span className="text-sm text-slate-700 leading-relaxed">{rc.cause}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.investigation_steps?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Investigation Steps</h4>
              <ol className="space-y-2">
                {data.investigation_steps.map((step: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data?.suggested_fixes?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Suggested Fixes</h4>
              <ul className="space-y-2">
                {data.suggested_fixes.map((fix: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400 mt-2" />
                    <span className="leading-relaxed">{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data?.related_systems?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Related Systems</h4>
              <div className="flex flex-wrap gap-2">
                {data.related_systems.map((sys: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">{sys}</span>
                ))}
              </div>
            </div>
          )}

          {!data && (
            <p className="text-sm text-slate-500 italic">{typeof rca === 'string' ? rca : JSON.stringify(rca)}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History Timeline                                                    */
/* ------------------------------------------------------------------ */

function getHistoryIcon(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes('status') || lower.includes('changed status'))
    return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
  if (lower.includes('assign'))
    return <UserCheck className="w-3.5 h-3.5 text-indigo-500" />;
  if (lower.includes('team'))
    return <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />;
  if (lower.includes('resolve'))
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
  if (lower.includes('close'))
    return <X className="w-3.5 h-3.5 text-slate-400" />;
  if (lower.includes('priority'))
    return <AlertCircle className="w-3.5 h-3.5 text-orange-500" />;
  if (lower.includes('create') || lower.includes('reported'))
    return <GitBranch className="w-3.5 h-3.5 text-purple-500" />;
  if (lower.includes('categori'))
    return <Tag className="w-3.5 h-3.5 text-teal-500" />;
  return <Clock className="w-3.5 h-3.5 text-slate-400" />;
}

function getHistoryDotColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('resolve')) return 'bg-green-500 ring-green-100';
  if (lower.includes('close')) return 'bg-slate-400 ring-slate-100';
  if (lower.includes('assign')) return 'bg-indigo-500 ring-indigo-100';
  if (lower.includes('status')) return 'bg-blue-500 ring-blue-100';
  if (lower.includes('team')) return 'bg-amber-500 ring-amber-100';
  if (lower.includes('create') || lower.includes('reported')) return 'bg-purple-500 ring-purple-100';
  return 'bg-slate-300 ring-slate-100';
}

function HistoryTimeline({ history }: { history: IssueHistoryType[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ring-4 ${getHistoryDotColor(entry.action)}`}>
              {getHistoryIcon(entry.action)}
            </div>
            {idx < history.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          {/* Content */}
          <div className="pb-5 flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{entry.action}</span>
              {entry.old_value && entry.new_value && (
                <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                  {entry.old_value} &rarr; {entry.new_value}
                </span>
              )}
              {!entry.old_value && entry.new_value && (
                <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                  &rarr; {entry.new_value}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {entry.performed_by && (
                <span className="text-xs text-slate-400">by {entry.performed_by}</span>
              )}
              <span className="text-xs text-slate-300">{timeAgo(entry.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function IssueDetail({ issueId }: IssueDetailProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEditIssue, isAdmin, isLeaderOf } = useAuth();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const {
    data: issue,
    isLoading,
    error,
  } = useQuery<Issue>({
    queryKey: ['issue', issueId],
    queryFn: () => fetchIssue(issueId),
    refetchInterval: (query) => {
      // Auto-refetch every 3s while RCA is still generating
      const data = query.state.data;
      return data && !data.ai_rca ? 3000 : false;
    },
  });

  const { data: history } = useQuery<IssueHistoryType[]>({
    queryKey: ['issue-history', issueId],
    queryFn: () => fetchIssueHistory(issueId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { status: IssueStatus }) => updateIssue(issueId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setStatusMenuOpen(false);
      setShowCloseModal(false);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (reason: string) => resolveIssue(issueId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setShowResolveModal(false);
    },
  });

  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());

  const teamChangeMutation = useMutation({
    mutationFn: (teamId: string) => updateIssue(issueId, { team_id: teamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setTeamMenuOpen(false);
    },
  });

  const assignMutation = useMutation({
    mutationFn: (members: { id: string; name: string; slack_user_id?: string }[]) => {
      const primary = members[0]?.id || null;
      const assigneesPayload = members.map(m => ({ id: m.id, name: m.name, slack_user_id: m.slack_user_id }));
      return updateIssue(issueId, { assigned_to: primary, assignees: assigneesPayload } as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setAssignMenuOpen(false);
      setSelectedAssignees(new Set());
    },
  });

  // Fetch all teams for member list
  const { data: allTeams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  // Fetch members for all teams the user can manage
  const { data: allMembers } = useQuery<{ member: Member; teamName: string }[]>({
    queryKey: ['all-members-for-assign', allTeams?.map(t => t.id).join(',')],
    queryFn: async () => {
      if (!allTeams) return [];
      const seen = new Set<string>();
      const results: { member: Member; teamName: string }[] = [];
      for (const team of allTeams) {
        const members = await fetchTeamMembers(team.id);
        for (const m of members) {
          if (m.is_active && !seen.has(m.email || m.slack_user_id)) {
            seen.add(m.email || m.slack_user_id);
            results.push({ member: m, teamName: team.name });
          }
        }
      }
      return results;
    },
    enabled: !!allTeams && allTeams.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-sm text-slate-400">Loading issue details...</p>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
        <p className="text-sm text-red-600 font-medium">Failed to load issue</p>
        <button
          onClick={() => navigate('/issues')}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Back to Issues
        </button>
      </div>
    );
  }

  const allStatuses: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  const canEdit = canEditIssue(issue);
  const canReassign = isAdmin || Object.entries(issue.team_id ? { [issue.team_id]: true } : {}).some(([tid]) => isLeaderOf(tid));
  const isActiveIssue = issue.status !== 'resolved' && issue.status !== 'closed';

  return (
    <div className="space-y-6">
      {/* Resolve Modal */}
      <ReasonModal
        title="Resolve Issue"
        label="How was this fixed?"
        submitLabel="Resolve"
        open={showResolveModal}
        isPending={resolveMutation.isPending}
        onClose={() => setShowResolveModal(false)}
        onSubmit={(reason) => resolveMutation.mutate(reason)}
      />

      {/* Close Modal */}
      <ReasonModal
        title="Close Issue"
        label="Why are you closing this?"
        submitLabel="Close Issue"
        open={showCloseModal}
        isPending={updateMutation.isPending}
        onClose={() => setShowCloseModal(false)}
        onSubmit={() => updateMutation.mutate({ status: 'closed' })}
      />

      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/issues')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Issues
        </button>
        <h1 className="text-xl font-bold text-slate-900 leading-snug">{issue.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          <StatusBadge status={issue.status} size="md" />
          <PriorityBadge priority={issue.priority} size="md" />
          <span className="text-sm text-slate-400">Created {timeAgo(issue.created_at)}</span>
        </div>
      </div>

      {/* Toolbar - Action buttons row */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStatusMenuOpen(!statusMenuOpen); setAssignMenuOpen(false); setTeamMenuOpen(false); }}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {updateMutation.isPending ? 'Updating...' : 'Change Status'}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {statusMenuOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {allStatuses
                    .filter((s) => s !== issue.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          if (s === 'closed') {
                            setStatusMenuOpen(false);
                            setShowCloseModal(true);
                          } else {
                            updateMutation.mutate({ status: s });
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                      >
                        {statusLabels[s]}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Change Team - admin/leader only */}
            {canReassign && allTeams && isActiveIssue && (
              <div className="relative">
                <button
                  onClick={() => { setTeamMenuOpen(!teamMenuOpen); setStatusMenuOpen(false); setAssignMenuOpen(false); }}
                  disabled={teamChangeMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {teamChangeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  {teamChangeMutation.isPending ? 'Moving...' : 'Change Team'}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {teamMenuOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    {allTeams
                      .filter(t => t.id !== issue.team_id)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => teamChangeMutation.mutate(t.id)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Reassign dropdown - admin/leader only */}
            {canReassign && allMembers && isActiveIssue && (
              <div className="relative">
                <button
                  onClick={() => {
                    setAssignMenuOpen(!assignMenuOpen);
                    setStatusMenuOpen(false);
                    setTeamMenuOpen(false);
                    setAssignSearch('');
                    // Pre-select current assignees
                    const current = new Set((issue.assignees || []).map((a: { id: string }) => a.id));
                    if (issue.assigned_to && !current.has(issue.assigned_to)) current.add(issue.assigned_to);
                    setSelectedAssignees(current);
                  }}
                  disabled={assignMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {assignMenuOpen && (
                  <div className="absolute left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Search by name, email, or team..."
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-colors"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {allMembers
                        .filter((entry) => {
                          if (!assignSearch) return true;
                          const q = assignSearch.toLowerCase();
                          return entry.member.name.toLowerCase().includes(q)
                            || (entry.member.email || '').toLowerCase().includes(q)
                            || entry.teamName.toLowerCase().includes(q);
                        })
                        .map((entry) => {
                          const checked = selectedAssignees.has(entry.member.id);
                          return (
                            <label
                              key={entry.member.id}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedAssignees);
                                  if (checked) next.delete(entry.member.id);
                                  else next.add(entry.member.id);
                                  setSelectedAssignees(next);
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700">{entry.member.name}</div>
                                <div className="text-xs text-slate-400">{entry.teamName} · {entry.member.open_issue_count} open</div>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                    <div className="p-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{selectedAssignees.size} selected</span>
                      <div className="flex gap-2">
                        {(issue.assigned_to || issue.assignees?.length > 0) && (
                          <button
                            onClick={() => {
                              setSelectedAssignees(new Set());
                              assignMutation.mutate([]);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            Unassign all
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const selected = allMembers
                              .filter(e => selectedAssignees.has(e.member.id))
                              .map(e => ({ id: e.member.id, name: e.member.name, slack_user_id: e.member.slack_user_id }));
                            assignMutation.mutate(selected);
                          }}
                          disabled={assignMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Resolve button */}
            {isActiveIssue && (
              <button
                onClick={() => setShowResolveModal(true)}
                disabled={resolveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info Grid - Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <InfoItem
          icon={<Users className="w-3.5 h-3.5 text-slate-400" />}
          label="Team"
          value={issue.team_name || 'Unassigned'}
        />
        <InfoItem
          icon={<User className="w-3.5 h-3.5 text-slate-400" />}
          label="Assigned To"
          value={
            issue.assignees?.length > 0
              ? issue.assignees.map((a: { name: string }) => a.name).join(', ')
              : (issue.assignee_name || 'Unassigned')
          }
        />
        <InfoItem
          icon={<User className="w-3.5 h-3.5 text-slate-400" />}
          label="Reported By"
          value={issue.reported_by_name || issue.reported_by_slack_id || 'Unknown'}
        />
        <InfoItem
          icon={<Hash className="w-3.5 h-3.5 text-slate-400" />}
          label="Channel"
          value={issue.slack_channel_name ? `#${issue.slack_channel_name}` : (issue.slack_channel_id || 'N/A')}
        />
        <InfoItem
          icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
          label="Created"
          value={formatDate(issue.created_at)}
        />
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900">Description</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {issue.description || 'No description provided'}
        </p>
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          Reported by {issue.reported_by_name || issue.reported_by_slack_id}{issue.reported_by_email ? ` (${issue.reported_by_email})` : ''}
        </div>
      </div>

      {/* AI RCA */}
      {issue.ai_rca ? (
        <RCAPanel rca={issue.ai_rca} />
      ) : (
        <RCASkeleton />
      )}

      {/* AI Categorization */}
      {issue.ai_categorization && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
              <Tag className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">AI Categorization</h3>
          </div>
          <div className="space-y-3 text-sm">
            {issue.ai_categorization.reasoning ? (
              <p className="text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 italic">
                {String(issue.ai_categorization.reasoning)}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-slate-600">
              {issue.ai_categorization.category ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">Category:</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">{String(issue.ai_categorization.category)}</span>
                </span>
              ) : null}
              {issue.ai_categorization.team_name ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-slate-500">Suggested Team:</span>
                  <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-medium">{String(issue.ai_categorization.team_name)}</span>
                </span>
              ) : null}
            </div>
          </div>
          {issue.ai_provider_used && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              Provider: {issue.ai_provider_used}
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            History
            {history && history.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({history.length} events)</span>
            )}
          </h3>
        </div>
        <div className="p-5">
          <HistoryTimeline history={history ?? []} />
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 truncate" title={value}>{value}</p>
    </div>
  );
}
