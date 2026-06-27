import { EyeIcon, XIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Persistent banner shown while "viewing as" another member, so it's never
// ambiguous whose vantage point you're seeing. The view is read-only.
export function ViewAsBanner() {
  const { isViewingAs, viewingAsName, exitViewAs } = useAuth();
  if (!isViewingAs) return null;
  return (
    <div className="bg-amber-500 text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-center gap-3 text-center">
      <span className="flex items-center gap-2">
        <EyeIcon className="w-4 h-4 shrink-0" />
        Viewing as <strong>{viewingAsName ?? 'another member'}</strong> · read-only
      </span>
      <button
        type="button"
        onClick={exitViewAs}
        className="inline-flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors px-2.5 py-0.5 font-semibold">
        <XIcon className="w-3.5 h-3.5" />
        Exit
      </button>
    </div>);

}
