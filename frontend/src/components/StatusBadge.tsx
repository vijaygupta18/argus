import type { IssueStatus } from '../api/types';
import { statusColors, statusLabels } from '../utils/format';

interface StatusBadgeProps {
  status: IssueStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const colors = statusColors[status];
  const label = statusLabels[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-colors ${colors.bg} ${colors.text} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}
