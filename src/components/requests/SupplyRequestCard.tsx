import { AlertCircleIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { formatDate, cn } from '../../lib/utils';
import { SupplyRequest, SupplyRequestStatus } from '../../types';

export interface SupplyItemRow {
  id: string;
  name: string;
  /** Preformatted quantity, e.g. "2 bags" or "1 each". */
  qty: string;
  /** Optional requester note for this line (e.g. a preferred brand). */
  notes?: string;
}

const STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  denied: 'Denied'
};
const STATUS_COLORS: Record<SupplyRequestStatus, string> = {
  submitted: 'bg-[#E5E2DC] text-[#6B6B6B]',
  in_progress: 'bg-[#F8E7C8] text-[#A36B00]',
  fulfilled: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  denied: 'bg-[#F5D7D7] text-[#9B3A3A]'
};

// Cap the visible rows so a pathologically long list can't make one card huge;
// the rest are summarized and viewable in the detail modal (card click).
const MAX_VISIBLE_ITEMS = 3;

interface Props {
  request: SupplyRequest;
  items: SupplyItemRow[];
  requesterName: string;
  requesterPhoto?: string;
  animalName?: string;
  canCancel: boolean;
  onOpen: () => void;
  onCancel: () => void;
}

// A supply request as a "shopping list": who asked (top), the itemized checklist
// with quantities (the hero, spanning the card so there's no dead space), and
// the submission date + status anchored at the bottom.
export function SupplyRequestCard({
  request,
  items,
  requesterName,
  requesterPhoto,
  animalName,
  canCancel,
  onOpen,
  onCancel
}: Props) {
  const isActive =
  request.status !== 'fulfilled' &&
  request.status !== 'cancelled' &&
  request.status !== 'denied';
  const showPriority = isActive && request.priority !== 'normal';

  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const overflow = items.length - visibleItems.length;

  return (
    <Card
      className={cn(
        'p-4 hover:border-primary/30 transition-colors cursor-pointer group',
        showPriority && 'border-[#9B3A3A]/30 bg-[#F5D7D7]/10'
      )}
      onClick={onOpen}>

      {/* Top — requester (de-emphasized) + priority/status. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 text-sm text-text-secondary">
          <Avatar
            src={requesterPhoto}
            type="person"
            name={requesterName}
            tone="peach"
            className="w-6 h-6 text-[11px] shrink-0" />

          <span className="truncate">
            Requested by{' '}
            <span className="font-medium text-text-primary">{requesterName}</span>
            {animalName &&
            <>
                <span className="text-border"> · </span>
                For {animalName}
              </>
            }
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showPriority &&
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F5D7D7] text-[#9B3A3A] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              <AlertCircleIcon className="w-3 h-3" />
              {request.priority}
            </span>
          }
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
              STATUS_COLORS[request.status]
            )}>

            {STATUS_LABELS[request.status]}
          </span>
        </div>
      </div>

      {/* Hero — itemized checklist with quantities (receipt style). */}
      <ul className="my-3 border-y border-border/60 divide-y divide-border/50">
        {visibleItems.length === 0 ?
        <li className="py-2 text-sm text-text-secondary italic">No items</li> :

        visibleItems.map((it) =>
        <li key={it.id} className="py-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-text-primary group-hover:text-primary transition-colors truncate min-w-0">
                  {it.name}
                </span>
                <span className="text-sm text-text-secondary tabular-nums shrink-0">
                  {it.qty}
                </span>
              </div>
              {/* Per-item note — only rendered when present (no reserved space). */}
              {it.notes &&
          <p className="text-xs text-text-secondary/90 mt-0.5">{it.notes}</p>
          }
            </li>
        )
        }
        {overflow > 0 &&
        <li className="py-2 text-xs text-text-secondary">
            +{overflow} more item{overflow === 1 ? '' : 's'}
          </li>
        }
      </ul>

      {/* Bottom — submission date + (optionally) cancel. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-secondary">
          Submitted {formatDate(request.requested_date)}
        </span>
        {canCancel &&
        <Button
          variant="ghost"
          size="sm"
          className="text-text-secondary hover:text-[#9B3A3A] -my-1"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}>

            Cancel Request
          </Button>
        }
      </div>
    </Card>);

}
