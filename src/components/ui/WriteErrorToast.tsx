import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangleIcon, XIcon } from 'lucide-react';
import { subscribeToWriteErrors } from '../../lib/errorReporting';

// How long the toast lingers before dismissing itself. Another failure while
// it's up simply restarts the clock — bursts read as one problem.
const AUTO_DISMISS_MS = 10_000;

/**
 * Global "Something went wrong" toast for failed Supabase writes. Mounted
 * once inside BrowserRouter (App.tsx); fed by the module-level bus in
 * lib/errorReporting.ts so failures detected outside React can surface it.
 */
export function WriteErrorToastHost() {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeToWriteErrors(() => {
      setVisible(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(
        () => setVisible(false),
        AUTO_DISMISS_MS
      );
    });
    return () => {
      unsubscribe();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible &&
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        role="alert"
        aria-live="assertive"
        className="fixed bottom-6 right-6 z-[70] w-[22rem] max-w-[calc(100vw-3rem)]">

          <div className="flex items-start gap-3 rounded-xl border border-border bg-card shadow-soft-lg p-4">
            <span className="p-1.5 rounded-full bg-[#F5D7D7] text-[#9B3A3A] shrink-0">
              <AlertTriangleIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">
                Something went wrong
              </p>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                We couldn't complete your request. Please try again. If the
                problem continues,{' '}
                <Link
                to="/settings?support=bug"
                onClick={() => setVisible(false)}
                className="font-medium text-primary hover:underline">

                  report a bug
                </Link>
                .
              </p>
            </div>
            <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Dismiss"
            className="p-1 -m-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors shrink-0">

              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      }
    </AnimatePresence>);

}
