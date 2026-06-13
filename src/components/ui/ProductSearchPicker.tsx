import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon, PlusIcon } from 'lucide-react';
import { Input } from './Forms';
import { CalendarPopover } from './CalendarPopover';
import { Product } from '../../types';
import { cn } from '../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Searchable product picker. Pick a catalog product (→ product_id) or type a
// custom item (→ custom_item_name) for the "Other" case. Mirrors BreedCombobox:
// the result list renders in a portal popover so the modal's overflow can't clip
// it, and free-text entry is first-class.
export interface ProductPickerValue {
  product_id?: string;
  custom_item_name?: string;
}
interface ProductSearchPickerProps {
  products: Product[];
  value: ProductPickerValue;
  onChange: (next: ProductPickerValue) => void;
  id?: string;
}

export function ProductSearchPicker({
  products,
  value,
  onChange,
  id
}: ProductSearchPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuWidth, setMenuWidth] = useState<number>();
  useLayoutEffect(() => {
    if (open && anchorRef.current) setMenuWidth(anchorRef.current.offsetWidth);
  }, [open]);

  const selectedProduct = value.product_id ?
  products.find((p) => p.id === value.product_id) :
  undefined;
  const selectedLabel = value.custom_item_name ?? selectedProduct?.name;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.
    filter((p) => p.active).
    filter((p) => (q ? p.name.toLowerCase().includes(q) : true)).
    sort((a, b) => a.name.localeCompare(b.name)).
    slice(0, 50);
  }, [products, query]);

  const trimmed = query.trim();
  const hasExactMatch = results.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCustomOption = trimmed.length > 0 && !hasExactMatch;

  const pickKnown = (productId: string) => {
    onChange({ product_id: productId, custom_item_name: undefined });
    setQuery('');
    setOpen(false);
  };
  const pickCustom = (text: string) => {
    const v = text.trim();
    if (!v) return;
    onChange({ product_id: undefined, custom_item_name: v });
    setQuery('');
    setOpen(false);
  };

  // The custom-item row (when shown) is the last navigable row.
  const { activeIndex, setActiveIndex, onKeyDown: navKeyDown } =
  useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length + (showCustomOption ? 1 : 0),
    onChoose: (i) =>
    i < results.length ? pickKnown(results[i].id) : pickCustom(trimmed),
    menuRef
  });

  if (selectedLabel) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
        <span className="font-medium text-text-primary truncate">
          {selectedLabel}
          {value.custom_item_name &&
          <span className="ml-2 text-xs font-normal text-text-secondary">
              (custom)
            </span>
          }
        </span>
        <button
          type="button"
          onClick={() =>
          onChange({ product_id: undefined, custom_item_name: undefined })
          }
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear item">

          <XIcon className="w-4 h-4" />
        </button>
      </div>);

  }

  return (
    <div className="relative" ref={anchorRef}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder="Search supplies…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          navKeyDown(e);
          // Enter with nothing highlighted still commits a typed custom item.
          if (!e.defaultPrevented && e.key === 'Enter' && showCustomOption) {
            e.preventDefault();
            pickCustom(trimmed);
          }
        }}
        className="pl-9" />

      <CalendarPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        padded={false}>

        <div
          ref={menuRef}
          style={{ width: menuWidth }}
          className="max-h-60 overflow-y-auto">
          {results.length === 0 && !showCustomOption &&
          <div className="p-4 text-sm text-text-secondary text-center">
              No supplies match. Type to add a custom item.
            </div>
          }
          {results.length > 0 &&
          <ul className="py-1">
              {results.map((p, i) =>
            <li key={p.id}>
                  <button
                type="button"
                data-ta-index={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pickKnown(p.id)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background cursor-pointer transition-colors',
                  activeIndex === i && 'bg-background'
                )}>

                    {p.name}
                  </button>
                </li>
            )}
            </ul>
          }
          {showCustomOption &&
          <button
            type="button"
            data-ta-index={results.length}
            onMouseEnter={() => setActiveIndex(results.length)}
            onClick={() => pickCustom(trimmed)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-background border-t border-border cursor-pointer transition-colors',
              activeIndex === results.length && 'bg-background'
            )}>

              <PlusIcon className="w-4 h-4 shrink-0" />
              <span>
                Other: <span className="font-medium">"{trimmed}"</span>
              </span>
            </button>
          }
        </div>
      </CalendarPopover>
    </div>);

}
