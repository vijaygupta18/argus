import type { IssuePriority } from '../api/types';
import { priorityColors, priorityLabels } from '../utils/format';

const ringColors: Record<IssuePriority, string> = {
  critical: 'ring-red-200',
  high: 'ring-orange-200',
  medium: 'ring-amber-200',
  low: 'ring-green-200',
};

interface PriorityBadgeProps {
  priority: IssuePriority | null;
  size?: 'sm' | 'md';
}

export default function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  if (!priority) return <span className="text-xs text-slate-400">--</span>;

  const colors = priorityColors[priority];
  const label = priorityLabels[priority];
  const ring = ringColors[priority];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 transition-colors ${ring} ${colors.bg} ${colors.text} ${sizeClasses}`}
    >
      {label}
    </span>
  );
}
