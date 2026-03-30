import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface MisrouteAlertProps {
  misrouteCount: number;
  misrouteRate: number;
  details?: string;
}

export function MisrouteAlert({ misrouteCount, misrouteRate, details }: MisrouteAlertProps) {
  if (misrouteCount === 0) return null;

  return (
    <Alert variant="destructive">
      <div className="flex items-start justify-between">
        <div>
          <AlertTitle>
            {misrouteCount} misroute{misrouteCount !== 1 ? 's' : ''} detected &mdash;{' '}
            {misrouteRate.toFixed(1)}% of traffic
          </AlertTitle>
          <AlertDescription>
            {details ?? 'Review routing decisions to identify patterns.'}
          </AlertDescription>
        </div>
        <button className="shrink-0 rounded-md border border-tier-misroute/40 px-3 py-1 text-sm font-medium text-tier-misroute hover:bg-tier-misroute/10 transition-colors">
          View Details
        </button>
      </div>
    </Alert>
  );
}
