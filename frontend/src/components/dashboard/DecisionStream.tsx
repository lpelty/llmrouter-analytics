import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Decision, TierName } from '@/lib/types';
import { TIER_LABELS } from '@/lib/types';

interface DecisionStreamProps {
  decisions: Decision[];
  maxItems?: number;
}

function relativeTime(timestamp: string | null): string {
  if (!timestamp) return '\u2014';
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return '\u2014';
  const diffMs = now - then;
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function tierVariant(tier: TierName): TierName {
  return tier;
}

export function DecisionStream({ decisions, maxItems = 4 }: DecisionStreamProps) {
  const items = decisions.slice(0, maxItems);

  if (items.length === 0) {
    return <p className="text-sm text-muted">No decisions yet.</p>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        {items.map((d, i) => (
          <div
            key={i}
            className={`rounded-md border border-border bg-elevated p-3 ${
              d.misroute ? 'border-l-2 border-l-[#E6495A]' : ''
            }`}
          >
            {/* Top row: tier pill + message type + timestamp */}
            <div className="flex items-center gap-2">
              <Badge variant={tierVariant(d.tier)}>
                {TIER_LABELS[d.tier] ?? d.tier}
              </Badge>
              <span className="font-mono text-xs text-secondary">
                {d.message_type}
              </span>
              <span className="ml-auto font-mono text-xs text-muted">
                {relativeTime(d.timestamp)}
              </span>
            </div>

            {/* Message preview */}
            <p className="mt-1.5 truncate text-sm text-muted">
              {d.query || '\u2014'}
            </p>

            {/* Misroute info */}
            {d.misroute && (
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="misroute">MISROUTE</Badge>
                <span className="font-mono text-xs text-[#E6495A]">
                  Expected: {d.expected_tier ?? '?'} &rarr; Routed: {TIER_LABELS[d.tier] ?? d.tier}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
