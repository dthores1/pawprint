import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';

// A lightly tinted, grouped section for record/intake forms — subtle header,
// soft background so the white inputs read as a set within the group. Pass
// `collapsible` to render the header as a button that toggles the body.
interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}
export function FormSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true
}: FormSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open;
  const Heading = collapsible ?
  <button
    type="button"
    onClick={() => setOpen((v) => !v)}
    aria-expanded={open}
    className="w-full flex items-center justify-between text-left group">
      <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary group-hover:text-text-primary transition-colors">
        {title}
      </span>
      <ChevronDownIcon
        className={`w-4 h-4 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
    </button> :
  <h3 className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
      {title}
    </h3>;

  return (
    <section
      className={`rounded-xl border border-border bg-background/50 p-4 ${isOpen ? 'space-y-4' : ''}`}>
      {Heading}
      <AnimatePresence initial={false}>
        {isOpen &&
        <motion.div
          key="content"
          initial={collapsible ? { height: 0, opacity: 0 } : false}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden">
            <div className="space-y-4">{children}</div>
          </motion.div>
        }
      </AnimatePresence>
    </section>);
}
