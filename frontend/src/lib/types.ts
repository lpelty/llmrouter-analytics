/** A single routing decision from the LLMRouter log */
export interface Decision {
  timestamp: string | null;
  tier: TierName;
  message_type: string;
  query: string;
  misroute: boolean;
  expected_tier: string | null;
  strategy: string;
}

/** Tier distribution entry in the summary */
export interface TierDistributionEntry {
  tier: string;
  label: string;
  color: string;
  count: number;
  percentage: number;
  estimated_cost: number;
}

/** Matrix cell: count + misroute flag */
export interface MatrixCell {
  count: number;
  misroute: boolean;
}

/** Matrix row: one message type */
export interface MatrixRow {
  message_type: string;
  tiers: Record<string, MatrixCell>;
  total: number;
  misroute_count: number;
  status: string;
}

/** Aggregated summary of routing decisions */
export interface Summary {
  total_decisions: number;
  estimated_cost: number;
  misroute_count: number;
  misroute_rate: number;
  tier_distribution: TierDistributionEntry[];
  matrix: MatrixRow[];
  classifier_errors: number;
}

/** Health check response */
export interface Health {
  status: string;
  uptime_seconds: number;
  log_file: string;
  log_exists: boolean;
  last_parse_time: string | null;
  port: number;
}

/** Tier identifiers */
export type TierName = 'flash-lite' | 'flash' | 'grok' | 'grok-companion' | 'sonnet';

/** Time period for filtering */
export type TimePeriod =
  | '24h' | '7d' | '30d'
  | 'today' | 'wtd' | 'mtd' | 'ytd';

/** Tier color mapping */
export const TIER_COLORS: Record<TierName, string> = {
  'flash-lite': '#7A7A8C',
  'flash': '#60A5FA',
  'grok': '#4ADE80',
  'grok-companion': '#34D399',
  'sonnet': '#C084FC',
};

/** Tier display names */
export const TIER_LABELS: Record<TierName, string> = {
  'flash-lite': 'Flash Lite',
  'flash': 'Flash',
  'grok': 'Grok',
  'grok-companion': 'Grok Companion',
  'sonnet': 'Sonnet',
};
