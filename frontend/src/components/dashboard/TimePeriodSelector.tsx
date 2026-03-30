import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TimePeriod } from '@/lib/types';

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const ROLLING: TimePeriod[] = ['24h', '7d', '30d'];
const TO_NOW: TimePeriod[] = ['today', 'wtd', 'mtd', 'ytd'];

const TO_NOW_LABELS: Record<string, string> = {
  today: 'Today',
  wtd: 'WTD',
  mtd: 'MTD',
  ytd: 'YTD',
};

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Rolling periods */}
      <Tabs
        value={ROLLING.includes(value) ? value : ''}
        onValueChange={(v) => onChange(v as TimePeriod)}
      >
        <TabsList>
          {ROLLING.map((p) => (
            <TabsTrigger key={p} value={p}>
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* To-now periods */}
      <Tabs
        value={TO_NOW.includes(value) ? value : ''}
        onValueChange={(v) => onChange(v as TimePeriod)}
      >
        <TabsList>
          {TO_NOW.map((p) => (
            <TabsTrigger key={p} value={p}>
              {TO_NOW_LABELS[p] ?? p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 text-sm text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-tier-grok animate-pulse" />
        <span className="font-mono text-xs">Live 5s</span>
      </div>
    </div>
  );
}
