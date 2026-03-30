import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MatrixRow } from '@/lib/types';

const TIER_COLUMNS = [
  { key: 'flash-lite', label: 'Lite' },
  { key: 'flash', label: 'Flash' },
  { key: 'grok', label: 'Grok' },
  { key: 'sonnet', label: 'Sonnet' },
];

interface MessageTypeMatrixProps {
  matrix: MatrixRow[];
}

export function MessageTypeMatrix({ matrix }: MessageTypeMatrixProps) {
  const rows = matrix.filter((r) => r.total > 0);

  if (rows.length === 0) {
    return <p className="text-sm text-muted">No routing data yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          {TIER_COLUMNS.map((col) => (
            <TableHead key={col.key} className="text-center">
              {col.label}
            </TableHead>
          ))}
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const hasMisroute = row.misroute_count > 0;
          return (
            <TableRow
              key={row.message_type}
              className={hasMisroute ? 'bg-[#E6495A]/[0.04]' : undefined}
            >
              <TableCell className="font-mono text-xs text-secondary">
                {row.message_type}
              </TableCell>
              {TIER_COLUMNS.map((col) => {
                const cell = row.tiers[col.key];
                if (!cell || cell.count === 0) {
                  return (
                    <TableCell key={col.key} className="text-center text-muted">
                      &mdash;
                    </TableCell>
                  );
                }
                return (
                  <TableCell
                    key={col.key}
                    className={`text-center ${
                      cell.misroute
                        ? 'text-[#E6495A] font-bold'
                        : ''
                    }`}
                  >
                    {cell.count}
                  </TableCell>
                );
              })}
              <TableCell className="text-right">
                {hasMisroute ? (
                  <Badge variant="misroute">
                    {row.misroute_count} misrouted
                  </Badge>
                ) : (
                  <Badge variant="grok">clean</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
