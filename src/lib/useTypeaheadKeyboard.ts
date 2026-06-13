import { useEffect, useState } from 'react';

/**
 * Arrow-key navigation for the relational typeahead pickers (Animal, Person,
 * Site, Clinic, Product, …). Keeps a highlighted index over a flat list of
 * `count` navigable rows; the caller maps an index to its action via `onChoose`.
 *
 *  - ArrowDown / ArrowUp move the highlight (and open a closed menu), wrapping
 *    at the ends. The first ArrowDown from the input lands on the first row.
 *  - Enter commits the highlighted row.
 *  - Escape closes the menu.
 *
 * Each navigable row in the menu must carry `data-ta-index={i}` (so the active
 * row can be scrolled into view), and should render its highlighted style when
 * `activeIndex === i`. Wire `onKeyDown` onto the search input and pass the
 * scroll container as `menuRef`.
 */
export function useTypeaheadKeyboard({
  open,
  setOpen,
  count,
  onChoose,
  menuRef
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  count: number;
  onChoose: (index: number) => void;
  menuRef: React.RefObject<HTMLElement | null>;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);

  // Drop the highlight when the menu closes or the option set changes, so a
  // stale index can't point past the end of a freshly filtered list.
  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);
  useEffect(() => {
    setActiveIndex(-1);
  }, [count]);

  // Keep the highlighted row scrolled into view while arrowing through.
  useEffect(() => {
    if (activeIndex < 0) return;
    menuRef.current?.
    querySelector(`[data-ta-index="${activeIndex}"]`)?.
    scrollIntoView({ block: 'nearest' });
  }, [activeIndex, menuRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);else
        if (count > 0) setActiveIndex((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);else
        if (count > 0) setActiveIndex((i) => i <= 0 ? count - 1 : i - 1);
        break;
      case 'Enter':
        if (open && activeIndex >= 0 && activeIndex < count) {
          e.preventDefault();
          onChoose(activeIndex);
        }
        break;
      case 'Escape':
        if (open) {
          // Close the menu, and keep this Escape from reaching the Modal's
          // document-level handler — so the first Esc closes the dropdown and
          // only a second Esc (with the menu already closed) closes the modal.
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          setOpen(false);
        }
        break;
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}
