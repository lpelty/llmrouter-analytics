import { useEffect, useRef, useState, useCallback } from 'react';
import type { Decision, Summary, Health, TimePeriod } from './types';

const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds

/** Build query string from a time period */
function buildQuery(period: TimePeriod): string {
  switch (period) {
    case '24h': return '?hours=24';
    case '7d': return '?hours=168';
    case '30d': return '?hours=720';
    case 'today': return '?period=today';
    case 'wtd': return '?period=wtd';
    case 'mtd': return '?period=mtd';
    case 'ytd': return '?period=ytd';
    default: return '?hours=24';
  }
}

/** Generic fetch wrapper with error handling */
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Hook: poll /api/summary at a configurable interval.
 */
export function useSummary(
  period: TimePeriod = '24h',
  interval: number = DEFAULT_POLL_INTERVAL,
) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const summary = await fetchJSON<Summary>(
        `/api/summary${buildQuery(period)}`,
      );
      setData(summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, interval]);

  return { data, error, loading };
}

/**
 * Hook: poll /api/decisions at a configurable interval.
 */
export function useDecisions(
  period: TimePeriod = '24h',
  interval: number = DEFAULT_POLL_INTERVAL,
) {
  const [data, setData] = useState<Decision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const decisions = await fetchJSON<Decision[]>(
        `/api/decisions${buildQuery(period)}`,
      );
      setData(decisions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, interval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, interval]);

  return { data, error, loading };
}

/**
 * Hook: fetch /api/health once (no polling by default).
 */
export function useHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJSON<Health>('/api/health')
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unknown error'),
      );
  }, []);

  return { data, error };
}
