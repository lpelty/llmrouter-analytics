import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSummary, useDecisions } from '@/lib/api';
import type { TimePeriod } from '@/lib/types';

import { TimePeriodSelector } from './TimePeriodSelector';
import { MisrouteAlert } from './MisrouteAlert';
import { MetricCard } from './MetricCard';
import { TierDistributionBar } from './TierDistributionBar';
import { MessageTypeMatrix } from './MessageTypeMatrix';
import { DecisionStream } from './DecisionStream';

export function Dashboard() {
  const [period, setPeriod] = useState<TimePeriod>('24h');
  const { data: summary, loading: summaryLoading, error: summaryError } = useSummary(period);
  const { data: decisions, loading: decisionsLoading } = useDecisions(period);

  const isLoading = summaryLoading || decisionsLoading;
  const placeholder = '--';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            LLMRouter Analytics
          </h1>
          <TimePeriodSelector value={period} onChange={setPeriod} />
        </div>
      </header>

      {/* Error banner */}
      {summaryError && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="rounded-md border border-[#E6495A44] bg-[#E6495A18] p-3 text-sm text-[#E6495A]">
            API error: {summaryError}
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {summary && summary.misroute_count > 0 && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <MisrouteAlert
            misrouteCount={summary.misroute_count}
            misrouteRate={summary.misroute_rate}
          />
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            label="Total Decisions"
            value={isLoading ? placeholder : String(summary?.total_decisions ?? 0)}
          />
          <MetricCard
            label="Estimated Cost"
            value={
              isLoading
                ? placeholder
                : `$${(summary?.estimated_cost ?? 0).toFixed(2)}`
            }
          />
          <MetricCard
            label="Misroute Rate"
            value={
              isLoading
                ? placeholder
                : `${(summary?.misroute_rate ?? 0).toFixed(1)}%`
            }
            valueColor={
              summary && summary.misroute_rate > 0 ? '#E6495A' : undefined
            }
          />
        </div>
      </div>

      {/* Main Content: Two-column layout */}
      <div className="mx-auto max-w-7xl px-6 pb-6">
        <div className="grid grid-cols-5 gap-4">
          {/* Left column: Tier Distribution + Matrix */}
          <div className="col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <TierDistributionBar distribution={summary.tier_distribution} />
                ) : (
                  <div>
                    <div className="h-8 w-full animate-pulse rounded-md bg-elevated" />
                    <p className="mt-3 text-sm text-muted">
                      {isLoading ? 'Loading...' : 'Waiting for data...'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Message Type x Tier</CardTitle>
              </CardHeader>
              <CardContent>
                {summary ? (
                  <MessageTypeMatrix matrix={summary.matrix} />
                ) : (
                  <p className="text-sm text-muted">
                    {isLoading ? 'Loading...' : 'Waiting for data...'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Recent Decisions */}
          <div className="col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Decisions</CardTitle>
                <span className="cursor-pointer text-sm text-tier-flash hover:underline">
                  View all &rarr;
                </span>
              </CardHeader>
              <CardContent>
                {decisions.length > 0 ? (
                  <DecisionStream decisions={decisions} />
                ) : (
                  <p className="text-sm text-muted">
                    {isLoading ? 'Loading...' : 'No decisions yet.'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
