// Pattern 2 — empty-state guidance. Shown where a collection is genuinely empty,
// so users meet the explanation exactly when they're trying to understand the
// feature. Not dismissible (it disappears on its own once records exist).
//
// Copy comes from a `guidance_messages` row (placement 'empty') keyed by
// `guidanceKey`; pass `fallback` so the page still renders sensible copy if the
// row is absent or guidance is turned off for the org. `action` is an optional
// CTA (e.g. a "Create Supply Request" button).
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { guidanceIcon } from './guidanceIcons';

interface GuidanceEmptyStateProps {
  guidanceKey: string;
  action?: ReactNode;
  /** Copy used when no DB row exists or guidance is disabled for the org. */
  fallback?: { title?: string; body?: string };
}

export function GuidanceEmptyState({
  guidanceKey,
  action,
  fallback
}: GuidanceEmptyStateProps) {
  const { guidanceMessages } = useWhisker();
  const { currentOrg } = useAuth();

  const message = guidanceMessages.find(
    (m) => m.key === guidanceKey && m.placement === 'empty'
  );
  const guidanceOff =
  (currentOrg && currentOrg.show_guidance === false) || !message?.enabled;

  const title = (!guidanceOff && message?.title) || fallback?.title;
  const body = (!guidanceOff && message?.body) || fallback?.body;
  if (!title && !body && !action) return null;

  const Icon = guidanceIcon(message?.icon);

  return (
    <Card className="py-12 text-center">
      <div className="flex flex-col items-center gap-3 max-w-md mx-auto px-4">
        <Icon className="w-10 h-10 text-text-secondary/30" />
        {title &&
        <h3 className="font-heading font-semibold text-lg text-text-primary">
            {title}
          </h3>
        }
        {body &&
        <p className="text-text-secondary whitespace-pre-line">{body}</p>
        }
        {action && <div className="mt-2">{action}</div>}
      </div>
    </Card>);

}
