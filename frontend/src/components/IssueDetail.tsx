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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
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
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-900">AI Root Cause Analysis</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 space-y-4 mt-3">
          {data?.summary && (
            <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
          )}

          {data?.root_causes?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Root Causes</h4>
              <div className="space-y-2">
                {data.root_causes.map((rc: { cause: string; probability: string }, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                      rc.probability === 'high' ? 'bg-red-50 text-red-700' :
                      rc.probability === 'medium' ? 'bg-amber-50 text-amber-700' :
                      'bg-green-50 text-green-700'
                    }`}>{rc.probability}</span>
                    <span className="text-slate-700">{rc.cause}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.investigation_steps?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Investigation Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
                {data.investigation_steps.map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {data?.suggested_fixes?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Suggested Fixes</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                {data.suggested_fixes.map((fix: string, i: number) => (
                  <li key={i}>{fix}</li>
                ))}
              </ul>
            </div>
          )}

          {data?.related_systems?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Related Systems</h4>
              <div className="flex flex-wrap gap-2">
                {data.related_systems.map((sys: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">{sys}</span>
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

function HistoryTimeline({ history }: { history: IssueHistoryType[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">No history available</p>;
  }

  return (
    <div className="space-y-0">
      {history.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-slate-300 mt-2 shrink-0" />
            {idx < history.length - 1 && <div className="w-px flex-1 bg-slate-200" />}
          </div>
          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-700">{entry.action}</span>
              {entry.old_value && entry.new_value && (
                <span className="text-xs text-slate-500">
                  {entry.old_value} &rarr; {entry.new_value}
                </span>
              )}
              {!entry.old_value && entry.new_value && (
                <span className="text-xs text-slate-500">
                  &rarr; {entry.new_value}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {entry.performed_by && (
                <span className="text-xs text-slate-400">by {entry.performed_by}</span>
              )}
              <span className="text-xs text-slate-400">{timeAgo(entry.created_at)}</span>
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Failed to load issue</p>
        <button
          onClick={() => navigate('/issues')}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Issues
        </button>
      </div>
    );
  }

  const allStatuses: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  const canEdit = canEditIssue(issue);
  const canReassign = isAdmin || Object.entries(issue.team_id ? { [issue.team_id]: true } : {}).some(([tid]) => isLeaderOf(tid));

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate('/issues')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Issues
          </button>
          <h1 className="text-xl font-bold text-slate-900">{issue.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={issue.status} size="md" />
            <PriorityBadge priority={issue.priority} size="md" />
            <span className="text-sm text-slate-400">Created {timeAgo(issue.created_at)}</span>
          </div>
        </div>

        {/* Actions — only shown if user can edit */}
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStatusMenuOpen(!statusMenuOpen); setAssignMenuOpen(false); }}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {updateMutation.isPending ? 'Updating...' : 'Change Status'}
              </button>
              {statusMenuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
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
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {statusLabels[s]}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Change Team — admin/leader only */}
            {canReassign && allTeams && issue.status !== 'resolved' && issue.status !== 'closed' && (
              <div className="relative">
                <button
                  onClick={() => { setTeamMenuOpen(!teamMenuOpen); setStatusMenuOpen(false); setAssignMenuOpen(false); }}
                  disabled={teamChangeMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  {teamChangeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {teamChangeMutation.isPending ? 'Moving...' : 'Change Team'}
                </button>
                {teamMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    {allTeams
                      .filter(t => t.id !== issue.team_id)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => teamChangeMutation.mutate(t.id)}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {t.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Reassign dropdown — admin/leader only */}
            {canReassign && allMembers && issue.status !== 'resolved' && issue.status !== 'closed' && (
              <div className="relative">
                <button
                  onClick={() => {
                    setAssignMenuOpen(!assignMenuOpen);
                    setStatusMenuOpen(false);
                    setAssignSearch('');
                    // Pre-select current assignees
                    const current = new Set((issue.assignees || []).map((a: { id: string }) => a.id));
                    if (issue.assigned_to && !current.has(issue.assigned_to)) current.add(issue.assigned_to);
                    setSelectedAssignees(current);
                  }}
                  disabled={assignMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                </button>
                {assignMenuOpen && (
                  <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Search by name, email, or team..."
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
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
                              className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0"
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
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md"
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
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resolve button */}
            {issue.status !== 'resolved' && issue.status !== 'closed' && (
              <button
                onClick={() => setShowResolveModal(true)}
                disabled={resolveMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <InfoItem
          icon={<Users className="w-4 h-4 text-slate-400" />}
          label="Team"
          value={issue.team_name || 'Unassigned'}
        />
        <InfoItem
          icon={<User className="w-4 h-4 text-slate-400" />}
          label="Assigned To"
          value={
            issue.assignees?.length > 0
              ? issue.assignees.map((a: { name: string }) => a.name).join(', ')
              : (issue.assignee_name || 'Unassigned')
          }
        />
        <InfoItem
          icon={<User className="w-4 h-4 text-slate-400" />}
          label="Reported By"
          value={issue.reported_by_name || issue.reported_by_slack_id || 'Unknown'}
        />
        <InfoItem
          icon={<Hash className="w-4 h-4 text-slate-400" />}
          label="Channel"
          value={issue.slack_channel_name ? `#${issue.slack_channel_name}` : (issue.slack_channel_id || 'N/A')}
        />
        <InfoItem
          icon={<Clock className="w-4 h-4 text-slate-400" />}
          label="Created"
          value={formatDate(issue.created_at)}
        />
      </div>

      {/* Description */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Description</h3>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {issue.description || 'No description provided'}
        </p>
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
          Reported by {issue.reported_by_name || issue.reported_by_slack_id}{issue.reported_by_email ? ` (${issue.reported_by_email})` : ''}
        </div>
      </div>

      {/* AI RCA */}
      {issue.ai_rca ? (
        <RCAPanel rca={issue.ai_rca} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          <span className="text-sm text-slate-500">Generating AI Root Cause Analysis...</span>
        </div>
      )}

      {/* AI Categorization */}
      {issue.ai_categorization && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">AI Categorization</h3>
          <div className="space-y-2 text-sm">
            {issue.ai_categorization.reasoning ? (
              <p className="text-slate-700 leading-relaxed italic">{String(issue.ai_categorization.reasoning)}</p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-slate-600">
              {issue.ai_categorization.category ? (
                <span><span className="font-medium text-slate-500">Category:</span> {String(issue.ai_categorization.category)}</span>
              ) : null}
              {issue.ai_categorization.team_name ? (
                <span><span className="font-medium text-slate-500">Suggested Team:</span> {String(issue.ai_categorization.team_name)}</span>
              ) : null}
            </div>
          </div>
          {issue.ai_provider_used && (
            <p className="text-xs text-slate-400 mt-3">Provider: {issue.ai_provider_used}</p>
          )}
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            History
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
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
    </div>
  );
}
