import type { IssuePriority } from '../api/types';
import { priorityColors, priorityLabels } from '../utils/format';

interface PriorityBadgeProps {
  priority: IssuePriority | null;
  size?: 'sm' | 'md';
}

export default function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  if (!priority) return <span className="text-xs text-slate-400">--</span>;

  const colors = priorityColors[priority];
  const label = priorityLabels[priority];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium transition-colors ${colors.bg} ${colors.text} ${sizeClasses}`}
    >
      {label}
    </span>
  );
}
