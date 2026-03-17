import type { IssueStatus } from '../api/types';
import { statusColors, statusLabels } from '../utils/format';

const ringColors: Record<IssueStatus, string> = {
  open: 'ring-blue-200',
  in_progress: 'ring-amber-200',
  resolved: 'ring-green-200',
  closed: 'ring-slate-200',
};

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = statusColors[status];
  const label = statusLabels[status];
  const ring = ringColors[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 transition-colors ${ring} ${colors.bg} ${colors.text} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}
