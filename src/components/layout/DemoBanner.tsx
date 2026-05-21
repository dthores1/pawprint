import React from 'react';
import { InfoIcon } from 'lucide-react';

// Thin banner shown only in demo mode so visitors know the data is sample-only.
export function DemoBanner() {
  return (
    <div className="bg-primary text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 text-center">
      <InfoIcon className="w-4 h-4 shrink-0" />
      Portfolio Demo — sample rescue data. Changes aren't saved and reset on
      refresh.
    </div>);

}
