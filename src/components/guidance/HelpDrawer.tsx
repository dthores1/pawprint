// A right-side slide-out panel for in-app help. Keeps explanatory content OFF
// the working screen — it's summoned on demand and dismissed in one click.
// Mirrors Modal.tsx's portal + Escape + body-scroll-lock behavior.
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function HelpDrawer({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer
}: HelpDrawerProps) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen &&
      <>
          <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-text-primary/20 backdrop-blur-sm"
          onClick={onClose} />

          <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
          className={cn(
            'fixed top-0 right-0 bottom-0 z-50 w-full max-w-md',
            'bg-card shadow-soft-lg flex flex-col'
          )}
          role="dialog"
          aria-label={title}>

            <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {icon &&
                <span className="text-primary shrink-0">{icon}</span>
                }
                <h2 className="text-lg font-heading font-bold text-text-primary truncate">
                  {title}
                </h2>
              </div>
              <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-full transition-colors shrink-0">

                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 overflow-y-auto scrollbar-hide flex-1">
              {children}
            </div>

            {footer &&
            <div className="px-6 py-4 border-t border-border bg-card shrink-0">
                {footer}
              </div>
            }
          </motion.div>
        </>
      }
    </AnimatePresence>,
    document.body
  );

}
