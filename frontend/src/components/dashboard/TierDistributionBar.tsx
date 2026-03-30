import type { TierDistributionEntry } from '@/lib/types';

interface TierDistributionBarProps {
  distribution: TierDistributionEntry[];
}

export function TierDistributionBar({ distribution }: TierDistributionBarProps) {
  const active = distribution.filter((d) => d.count > 0);

  if (active.length === 0) {
    return (
      <div>
        <div className="h-8 w-full rounded-md bg-elevated" />
        <p className="mt-3 text-sm text-muted">No routing data yet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-md">
        {active.map((entry) => (
          <div
            key={entry.tier}
            className="h-full transition-all duration-300"
            style={{
              width: `${entry.percentage}%`,
              backgroundColor: entry.color,
              minWidth: entry.percentage > 0 ? '2px' : undefined,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {active.map((entry) => (
          <div key={entry.tier} className="flex items-center gap-1.5 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-mono text-xs text-secondary">
              {entry.label}
            </span>
            <span className="font-mono text-xs text-muted">
              {entry.percentage.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-muted">
              ${entry.estimated_cost.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
