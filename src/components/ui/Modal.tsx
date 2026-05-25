import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
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

  // Portal to <body> so the fixed-position backdrop is anchored to the viewport,
  // not to an ancestor that may establish a containing block (transform/filter).
  return createPortal(
    <AnimatePresence>
      {isOpen &&
      <>
          <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="fixed inset-0 z-50 bg-text-primary/20 backdrop-blur-sm"
          onClick={onClose} />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
            initial={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20
            }}
            transition={{
              type: 'spring',
              duration: 0.5,
              bounce: 0
            }}
            className={cn(
              'bg-card w-full max-w-lg rounded-2xl shadow-soft-lg pointer-events-auto flex flex-col max-h-[90vh]',
              className
            )}>

              <div className="flex items-center justify-between px-7 py-5 border-b border-border">
                <h2 className="text-lg font-heading font-bold text-text-primary">
                  {title}
                </h2>
                <button
                onClick={onClose}
                className="p-2 -mr-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-full transition-colors">

                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="px-7 py-6 overflow-y-auto scrollbar-hide">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      }
    </AnimatePresence>,
    document.body
  );

}