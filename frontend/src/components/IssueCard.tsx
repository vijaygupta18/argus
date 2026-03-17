import { useNavigate } from 'react-router-dom';
import type { Issue } from '../api/types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { timeAgo } from '../utils/format';

interface IssueCardProps {
  issue: Issue;
}

export default function IssueCard({ issue }: IssueCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/issues/${issue.id}`)}
      className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex-1 min-w-0 mr-4">
        <h3 className="text-sm font-medium text-slate-900 truncate">{issue.title}</h3>
        <div className="flex items-center gap-3 mt-1">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.team_name && (
            <span className="text-xs text-slate-500">{issue.team_name}</span>
          )}
          {issue.assignee_name && (
            <span className="text-xs text-slate-500">
              <span className="text-slate-400">-&gt;</span> {issue.assignee_name}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(issue.created_at)}</span>
    </div>
  );
}
