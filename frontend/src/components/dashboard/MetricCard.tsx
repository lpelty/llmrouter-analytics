import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricCardProps {
  label: string;
  value: string;
  valueColor?: string;
}

export function MetricCard({ label, value, valueColor }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal font-mono uppercase tracking-wider text-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className="font-heading text-4xl font-semibold"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
