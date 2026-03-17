import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Lock,
  Lightbulb,
  Search as SearchIcon,
  Wrench,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchIssue, fetchIssueHistory, updateIssue, resolveIssue, fetchTeams, fetchAssignableMembers } from '../api/client';
import type { Issue, IssueHistory as IssueHistoryType, IssueStatus, AssignableMember, Team } from '../api/types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { formatDate, timeAgo, statusLabels } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';

interface IssueDetailProps {
  issueId: string;
}

/* ------------------------------------------------------------------ */
/* Avatar helper                                                        */
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

function AvatarChip({ name }: { name: string }) {
  const bg = nameToColor(name);
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-200">
      <span className={`w-5 h-5 rounded-full ${bg} flex items-center justify-center text-[10px] font-semibold text-white shrink-0`}>
        {name.charAt(0).toUpperCase()}
      </span>
      {name}
    </span>
  );
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
  variant = 'default',
}: {
  title: string;
  label: string;
  submitLabel: string;
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  variant?: 'default' | 'resolve' | 'close';
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  };

  const iconBg = variant === 'resolve' ? 'bg-green-50' : variant === 'close' ? 'bg-slate-100' : 'bg-blue-50';
  const iconColor = variant === 'resolve' ? 'text-green-600' : variant === 'close' ? 'text-slate-500' : 'text-blue-600';
  const Icon = variant === 'resolve' ? CheckCircle2 : variant === 'close' ? Lock : CheckCircle2;
  const submitBg = variant === 'resolve'
    ? 'bg-green-600 hover:bg-green-700'
    : variant === 'close'
      ? 'bg-slate-700 hover:bg-slate-800'
      : 'bg-blue-600 hover:bg-blue-700';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-modal-backdrop" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 animate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
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
              rows={5}
              placeholder="Please provide details..."
              className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors leading-relaxed ${
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
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm ${submitBg}`}
            >
              {isPending ? 'Submitting...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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

function RCAMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-slate-900 mt-5 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-slate-800 mt-4 mb-2 first:mt-0 flex items-center gap-1.5">
            <span className="w-1 h-3.5 rounded-full bg-purple-400 shrink-0 inline-block" />
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-slate-700 mt-3 mb-1.5">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-slate-700 leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1 mb-3 pl-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="space-y-1 mb-3 pl-1 list-none counter-reset-item">{children}</ol>
        ),
        li: ({ children, ...props }) => {
          const isOrdered = (props as { ordered?: boolean }).ordered;
          return (
            <li className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
              {isOrdered ? (
                <span className="shrink-0 w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center mt-0.5 tabular-nums">
                  {(props as { index?: number }).index !== undefined ? ((props as { index?: number }).index ?? 0) + 1 : '•'}
                </span>
              ) : (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400 mt-2" />
              )}
              <span className="flex-1">{children}</span>
            </li>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-600">{children}</em>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock ? (
            <code className="block bg-slate-900 text-green-300 text-xs font-mono p-3 rounded-lg overflow-x-auto mb-3">
              {children}
            </code>
          ) : (
            <code className="bg-slate-100 text-purple-700 text-[11px] font-mono px-1.5 py-0.5 rounded">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-300 pl-3 my-2 text-slate-600 italic text-sm">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-slate-200 my-4" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="text-left text-slate-600 font-semibold px-3 py-2 bg-slate-50 border border-slate-200">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border border-slate-200 text-slate-700">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function RCAPanel({ rca }: { rca: Issue['ai_rca'] }) {
  const [expanded, setExpanded] = useState(true);

  if (!rca) return null;

  const data = typeof rca === 'string' ? (() => { try { return JSON.parse(rca); } catch { return null; } })() : rca;
  const isVishwakarma = data?.source === 'vishwakarma';

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 flex items-center justify-center ring-1 ring-purple-100">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">AI Root Cause Analysis</h3>
              {isVishwakarma && (
                <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-semibold rounded-full ring-1 ring-violet-100">
                  Vishwakarma · {data?.tools_called || 0} tools
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isVishwakarma ? 'Deep automated investigation' : 'AI-generated analysis and recommendations'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {/* Vishwakarma: render full markdown report */}
          {isVishwakarma && data?.full_report ? (
            <div className="px-5 py-4">
              <RCAMarkdown content={String(data.full_report)} />
            </div>
          ) : (
            <div className="px-5 pb-5 pt-4 space-y-5">
              {/* Summary */}
              {data?.summary && (
                <div className="bg-purple-50/50 rounded-lg p-4 border border-purple-100/50">
                  <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
                </div>
              )}

              {/* Root Causes */}
              {data?.root_causes?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Root Causes</h4>
                  </div>
                  <div className="space-y-2.5">
                    {data.root_causes.map((rc: { cause: string; probability: string }, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-50/50 rounded-lg px-3 py-2.5">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-slate-700 leading-relaxed">{rc.cause}</span>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                          rc.probability === 'high' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' :
                          rc.probability === 'medium' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' :
                          'bg-green-50 text-green-700 ring-1 ring-green-100'
                        }`}>{rc.probability}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigation Steps */}
              {data?.investigation_steps?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <SearchIcon className="w-3.5 h-3.5 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Investigation Steps</h4>
                  </div>
                  <div className="space-y-1.5">
                    {data.investigation_steps.map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 py-1.5">
                        <span className="shrink-0 w-5 h-5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center mt-0.5 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-700 leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Fixes */}
              {data?.suggested_fixes?.length > 0 && (
                <div className="bg-emerald-50/60 rounded-lg p-4 border border-emerald-100/60">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-emerald-800">Suggested Fixes</h4>
                  </div>
                  <ul className="space-y-2">
                    {data.suggested_fixes.map((fix: string, i: number) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-emerald-800">
                        <Wrench className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="leading-relaxed">{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Systems */}
              {data?.related_systems?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Related Systems</h4>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.related_systems.map((sys: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-medium rounded-lg ring-1 ring-slate-200 hover:bg-slate-100 transition-colors cursor-default">
                        {sys}
                      </span>
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
    return <RefreshCw className="w-3 h-3 text-blue-500" />;
  if (lower.includes('assign'))
    return <UserCheck className="w-3 h-3 text-indigo-500" />;
  if (lower.includes('team'))
    return <ArrowRightLeft className="w-3 h-3 text-amber-500" />;
  if (lower.includes('resolve'))
    return <CheckCircle2 className="w-3 h-3 text-green-500" />;
  if (lower.includes('close'))
    return <X className="w-3 h-3 text-slate-400" />;
  if (lower.includes('priority'))
    return <AlertCircle className="w-3 h-3 text-orange-500" />;
  if (lower.includes('create') || lower.includes('reported'))
    return <GitBranch className="w-3 h-3 text-purple-500" />;
  if (lower.includes('categori'))
    return <Tag className="w-3 h-3 text-teal-500" />;
  return <Clock className="w-3 h-3 text-slate-400" />;
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
  const [showAll, setShowAll] = useState(false);
  const COLLAPSED_COUNT = 5;

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No history available</p>
      </div>
    );
  }

  const visibleHistory = showAll ? history : history.slice(0, COLLAPSED_COUNT);
  const hasMore = history.length > COLLAPSED_COUNT;

  return (
    <div className="space-y-0">
      {visibleHistory.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ring-4 ${getHistoryDotColor(entry.action)}`}>
              {getHistoryIcon(entry.action)}
            </div>
            {idx < visibleHistory.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
          </div>
          {/* Content */}
          <div className="pb-4 flex-1 min-w-0 pt-0.5">
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
            <div className="flex items-center gap-2 mt-0.5">
              {entry.performed_by && (
                <span className="text-xs text-slate-400">by {entry.performed_by}</span>
              )}
              <span className="text-xs text-slate-300">{timeAgo(entry.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ml-8 mt-1"
        >
          Show all {history.length} entries
        </button>
      )}
      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ml-8 mt-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Description with expand/collapse                                     */
/* ------------------------------------------------------------------ */

function DescriptionSection({ issue }: { issue: Issue }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (descRef.current) {
      setNeedsExpand(descRef.current.scrollHeight > descRef.current.clientHeight + 2);
    }
  }, [issue.description]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-900">Description</h3>
      </div>
      <p
        ref={descRef}
        className={`text-sm text-slate-700 leading-relaxed whitespace-pre-wrap ${
          !isExpanded ? 'description-clamp' : ''
        }`}
      >
        {issue.description || 'No description provided'}
      </p>
      {needsExpand && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors mt-2"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
        Reported by {issue.reported_by_name || issue.reported_by_slack_id}{issue.reported_by_email ? ` (${issue.reported_by_email})` : ''}
      </div>
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
  const [successFlash, setSuccessFlash] = useState(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
      setStatusMenuOpen(false);
    }
    if (teamRef.current && !teamRef.current.contains(e.target as Node)) {
      setTeamMenuOpen(false);
    }
    if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
      setAssignMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (statusMenuOpen || teamMenuOpen || assignMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [statusMenuOpen, teamMenuOpen, assignMenuOpen, handleClickOutside]);

  const triggerSuccessFlash = useCallback(() => {
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 1000);
  }, []);

  const {
    data: issue,
    isLoading,
    error,
  } = useQuery<Issue>({
    queryKey: ['issue', issueId],
    queryFn: () => fetchIssue(issueId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (!data.ai_rca) return 3000;
      const rca = data.ai_rca as Record<string, unknown>;
      if (rca?.status === 'investigating') return 3000;
      return false;
    },
  });

  const { data: history } = useQuery<IssueHistoryType[]>({
    queryKey: ['issue-history', issueId],
    queryFn: () => fetchIssueHistory(issueId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { status: IssueStatus; reason?: string }) => updateIssue(issueId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setStatusMenuOpen(false);
      setShowCloseModal(false);
      triggerSuccessFlash();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (reason: string) => resolveIssue(issueId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setShowResolveModal(false);
      triggerSuccessFlash();
    },
  });

  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(new Set());

  const teamChangeMutation = useMutation({
    mutationFn: (teamId: string) => updateIssue(issueId, { team_id: teamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-history', issueId] });
      setTeamMenuOpen(false);
      triggerSuccessFlash();
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
      triggerSuccessFlash();
    },
  });

  const { data: allTeams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  });

  const { data: allMembers } = useQuery<AssignableMember[]>({
    queryKey: ['assignable-members'],
    queryFn: fetchAssignableMembers,
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
    <div className={`space-y-6 animate-page-in ${successFlash ? 'animate-success-flash' : ''}`}>
      {/* Resolve Modal */}
      <ReasonModal
        title="Resolve Issue"
        label="How was this fixed?"
        submitLabel="Resolve"
        open={showResolveModal}
        isPending={resolveMutation.isPending}
        onClose={() => setShowResolveModal(false)}
        onSubmit={(reason) => resolveMutation.mutate(reason)}
        variant="resolve"
      />

      {/* Close Modal */}
      <ReasonModal
        title="Close Issue"
        label="Why are you closing this?"
        submitLabel="Close Issue"
        open={showCloseModal}
        isPending={updateMutation.isPending}
        onClose={() => setShowCloseModal(false)}
        onSubmit={(reason) => updateMutation.mutate({ status: 'closed', reason })}
        variant="close"
      />


      {/* Breadcrumb + Header */}
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-slate-400 mb-4">
          <button
            onClick={() => navigate('/issues')}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Issues
          </button>
          <span>/</span>
          <span className="text-slate-600 font-medium truncate max-w-xs">{issue.title}</span>
        </div>

        {/* Title + badges */}
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 leading-snug flex-1 min-w-0">{issue.title}</h1>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <StatusBadge status={issue.status} size="md" />
            <PriorityBadge priority={issue.priority} size="md" />
          </div>
        </div>

        {/* Created info */}
        <p className="text-sm text-slate-400 mt-2">
          Created {timeAgo(issue.created_at)}
          {issue.reported_by_name && (
            <> by <span className="text-slate-500">{issue.reported_by_name}</span></>
          )}
        </p>
      </div>

      {/* Floating Toolbar */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                onClick={() => { setStatusMenuOpen(!statusMenuOpen); setAssignMenuOpen(false); setTeamMenuOpen(false); }}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
                {updateMutation.isPending ? 'Updating...' : 'Status'}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
              {statusMenuOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 animate-dropdown overflow-hidden">
                  {allStatuses
                    .filter((s) => s !== issue.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setStatusMenuOpen(false);
                          if (s === 'closed') {
                            setShowCloseModal(true);
                          } else if (s === 'resolved') {
                            setShowResolveModal(true);
                          } else {
                            updateMutation.mutate({ status: s });
                          }
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                      >
                        <StatusBadge status={s} />
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Change Team */}
            {canReassign && allTeams && isActiveIssue && (
              <div className="relative" ref={teamRef}>
                <button
                  onClick={() => { setTeamMenuOpen(!teamMenuOpen); setStatusMenuOpen(false); setAssignMenuOpen(false); }}
                  disabled={teamChangeMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {teamChangeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />}
                  {teamChangeMutation.isPending ? 'Moving...' : 'Team'}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {teamMenuOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 animate-dropdown overflow-hidden">
                    {allTeams
                      .filter(t => t.id !== issue.team_id)
                      .map(t => (
                        <button
                          key={t.id}
                          onClick={() => teamChangeMutation.mutate(t.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Reassign dropdown */}
            {canReassign && allMembers && isActiveIssue && (
              <div className="relative" ref={assignRef}>
                <button
                  onClick={() => {
                    setAssignMenuOpen(!assignMenuOpen);
                    setStatusMenuOpen(false);
                    setTeamMenuOpen(false);
                    setAssignSearch('');
                    const current = new Set((issue.assignees || []).map((a: { id: string }) => a.id));
                    if (issue.assigned_to && !current.has(issue.assigned_to)) current.add(issue.assigned_to);
                    setSelectedAssignees(current);
                  }}
                  disabled={assignMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  {assignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 text-slate-500" />}
                  {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                {assignMenuOpen && (
                  <div className="absolute left-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-20 animate-dropdown overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        placeholder="Search by name, email, or team..."
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400 transition-colors bg-slate-50"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {allMembers
                        .filter((m) => {
                          if (!assignSearch) return true;
                          const q = assignSearch.toLowerCase();
                          return m.name.toLowerCase().includes(q)
                            || (m.email || '').toLowerCase().includes(q)
                            || m.team_name.toLowerCase().includes(q);
                        })
                        .map((m) => {
                          const checked = selectedAssignees.has(m.id);
                          return (
                            <label
                              key={m.id}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedAssignees);
                                  if (checked) next.delete(m.id);
                                  else next.add(m.id);
                                  setSelectedAssignees(next);
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-700">{m.name}</div>
                                <div className="text-xs text-slate-400">{m.team_name}</div>
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
                            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Unassign all
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const selected = allMembers
                              .filter(m => selectedAssignees.has(m.id))
                              .map(m => ({ id: m.id, name: m.name, slack_user_id: m.slack_user_id }));
                            assignMutation.mutate(selected);
                          }}
                          disabled={assignMutation.isPending}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mutation error banner */}
      {(updateMutation.isError || resolveMutation.isError || teamChangeMutation.isError || assignMutation.isError) && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            {updateMutation.isError && 'Failed to update status. '}
            {resolveMutation.isError && 'Failed to resolve issue. '}
            {teamChangeMutation.isError && 'Failed to change team. '}
            {assignMutation.isError && 'Failed to update assignment. '}
            Please try again.
          </p>
        </div>
      )}

      {/* Info Grid -- Single Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {/* Team */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Team</span>
            </div>
            <span className="text-sm font-medium text-slate-900 text-right">
              {issue.team_name ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  {issue.team_name}
                </span>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </span>
          </div>

          {/* Channel */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0">
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Channel</span>
            </div>
            <span className="text-sm font-medium text-slate-900">
              {issue.slack_channel_name ? `#${issue.slack_channel_name}` : (issue.slack_channel_id || 'N/A')}
            </span>
          </div>

          {/* Assigned to */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Assigned to</span>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {issue.assignees?.length > 0 ? (
                issue.assignees.map((a: { id: string; name: string }) => (
                  <AvatarChip key={a.id} name={a.name} />
                ))
              ) : (
                <span className="text-sm font-medium text-slate-400">
                  {issue.assignee_name || 'Unassigned'}
                </span>
              )}
            </div>
          </div>

          {/* Reported by */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:border-b-0 sm:pb-0">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Reported by</span>
            </div>
            <span className="text-sm font-medium text-slate-900">
              {issue.reported_by_name || issue.reported_by_slack_id || 'Unknown'}
            </span>
          </div>

          {/* Created */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-500">Created</span>
            </div>
            <span className="text-sm font-medium text-slate-900">{formatDate(issue.created_at)}</span>
          </div>

          {/* Resolved at (if applicable) */}
          {issue.resolved_at && (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-sm text-slate-500">Resolved</span>
              </div>
              <span className="text-sm font-medium text-slate-900">{formatDate(issue.resolved_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <DescriptionSection issue={issue} />

      {/* AI RCA */}
      {issue.ai_rca && typeof issue.ai_rca === 'object' && (issue.ai_rca as Record<string, unknown>).status === 'investigating' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 flex items-center justify-center ring-1 ring-purple-100">
              <Brain className="w-4 h-4 text-purple-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AI Investigating...</h3>
              <p className="text-xs text-slate-400">
                {(issue.ai_rca as Record<string, unknown>).tools_called as number || 0} tools checked
                {((issue.ai_rca as Record<string, unknown>).tools_running as number) > 0 && (
                  <>, {(issue.ai_rca as Record<string, unknown>).tools_running as number} running</>
                )}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {((issue.ai_rca as Record<string, unknown>).tool_details as Array<{tool: string; status: string}> || []).map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {t.status === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                )}
                <span className={t.status === 'done' ? 'text-slate-500' : 'text-slate-700 font-medium'}>
                  {t.tool}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : issue.ai_rca ? (
        <RCAPanel rca={issue.ai_rca} />
      ) : (
        <RCASkeleton />
      )}

      {/* AI Categorization */}
      {issue.ai_categorization && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center ring-1 ring-teal-100">
              <Tag className="w-4 h-4 text-teal-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">AI Categorization</h3>
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
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">History</h3>
            {history && history.length > 0 && (
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          <HistoryTimeline history={history ?? []} />
        </div>
      </div>
    </div>
  );
}
