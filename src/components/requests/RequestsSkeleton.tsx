import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

// Loading placeholder for a request list (Supply / Transport / Sitting). Shown
// on the initial coordination load in place of the empty-state card, which
// otherwise flashes for a beat or two before the requests arrive. The shape
// loosely mirrors a request card: a header (requester + status pill), a couple
// of body rows, and a footer date — so the transition to real content is calm.
//
// Widths are varied per row so the placeholder doesn't read as a rigid grid.
const ROW_WIDTHS = ['w-40', 'w-56', 'w-32'];

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <Card className="p-4">
      {/* Header: avatar + requester line, status pill on the right. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Skeleton className="w-6 h-6 rounded-full shrink-0" />
          <Skeleton className="h-3.5 w-44 max-w-full" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full shrink-0" />
      </div>
      {/* Body: itemized/route lines with a trailing quantity/date. */}
      <div className="my-3 border-y border-border/60 py-3 space-y-3">
        {Array.from({ length: rows }, (_, i) =>
        <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className={`h-3.5 ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
            <Skeleton className="h-3.5 w-10 shrink-0" />
          </div>
        )}
      </div>
      {/* Footer: submitted/updated date. */}
      <Skeleton className="h-3 w-28" />
    </Card>);

}

interface Props {
  /** How many placeholder cards to render. */
  count?: number;
  /** Body rows per card. */
  rowsPerCard?: number;
}
export function RequestsSkeleton({ count = 3, rowsPerCard = 2 }: Props) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) =>
      <SkeletonCard key={i} rows={rowsPerCard} />
      )}
    </div>);

}
