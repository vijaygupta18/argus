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
      className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
    >
      <div className="flex-1 min-w-0 mr-4">
        <h3 className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
          {issue.title}
        </h3>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.team_name && (
            <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {issue.team_name}
            </span>
          )}
          {issue.assignee_name && (
            <span className="text-xs text-slate-400">
              &rarr; {issue.assignee_name}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
        {timeAgo(issue.created_at)}
      </span>
    </div>
  );
}
