import React from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

// Cycles a column's sort: unsorted → asc → desc → unsorted.
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return null;
}

// Stable string/number comparison that always parks empty values at the end,
// regardless of direction. Returns a NEW sorted array.
export function sortItems<T>(
  items: T[],
  getValue: (item: T) => string | number | null | undefined,
  dir: SortDir)
: T[] {
  const isEmpty = (v: string | number | null | undefined) =>
  v == null || v === '';
  const withVal: T[] = [];
  const without: T[] = [];
  for (const item of items) {
    (isEmpty(getValue(item)) ? without : withVal).push(item);
  }
  withVal.sort((a, b) => {
    const av = getValue(a)!;
    const bv = getValue(b)!;
    const cmp =
    typeof av === 'string' || typeof bv === 'string' ?
    String(av).localeCompare(String(bv)) :
    (av as number) - (bv as number);
    return dir === 'asc' ? cmp : -cmp;
  });
  return [...withVal, ...without];
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

// A <th> whose label is a button that toggles sorting on its column and shows a
// directional arrow (up = asc, down = desc, faint neutral chevrons = sortable
// but inactive).
export function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  align = 'left'
}: SortableHeaderProps) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  return (
    <th className={cn('py-4 px-6 font-medium', className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'group inline-flex items-center gap-1.5 -mx-1 px-1 py-0.5 rounded transition-colors',
          active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
          align === 'right' && 'flex-row-reverse'
        )}>

        {label}
        {active ?
        dir === 'asc' ?
        <ArrowUpIcon className="w-3.5 h-3.5" /> :
        <ArrowDownIcon className="w-3.5 h-3.5" /> :

        <ChevronsUpDownIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        }
      </button>
    </th>);

}
