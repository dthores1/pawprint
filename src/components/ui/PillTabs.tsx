import { cn } from '../../lib/utils';

export interface PillTab {
  key: string;
  label: string;
}

interface PillTabsProps {
  tabs: PillTab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Secondary (sub-tab) navigation rendered as soft pills — distinct from the
 * primary underlined tabs so the two levels don't read as the same control.
 * Active pill gets a pale-teal tint; inactive items are plain/gray.
 */
export function PillTabs({ tabs, value, onChange, className }: PillTabsProps) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-wrap items-center gap-1', className)}>

      {tabs.map((t) =>
      <button
        key={t.key}
        type="button"
        role="tab"
        aria-selected={value === t.key}
        onClick={() => onChange(t.key)}
        className={cn(
          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
          value === t.key ?
          'bg-primary/10 text-primary' :
          'text-text-secondary hover:text-text-primary hover:bg-background'
        )}>

          {t.label}
        </button>
      )}
    </div>);

}
