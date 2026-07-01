import { cn } from '../../lib/utils';

// A single shimmering placeholder block. Compose these to mirror the shape of
// content that's still loading (see RequestsSkeleton). Uses the `border` token
// so it reads as a muted neutral on both the card (white) and page backgrounds.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-border', className)} />);

}
