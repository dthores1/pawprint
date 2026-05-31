import React from 'react';
import { Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import {
  DateRange,
  RangePreset,
  formatYMD,
  parseYMD,
  thisMonthRange,
  thisYearRange } from
'../../lib/reports';

interface Props {
  preset: RangePreset;
  range: DateRange;
  onChange: (next: { preset: RangePreset; range: DateRange }) => void;
}

// Preset chips + a custom date-range pair. Time-bound report sections (e.g.
// "adoptions this month") read from `range`; snapshot sections ignore it.
export function ReportsDateFilter({ preset, range, onChange }: Props) {
  const setPreset = (next: RangePreset) => {
    if (next === 'month') onChange({ preset: 'month', range: thisMonthRange() });
    else if (next === 'year') onChange({ preset: 'year', range: thisYearRange() });
    else onChange({ preset: 'custom', range });
  };

  const setCustomStart = (s: string) => {
    if (!s) return;
    onChange({ preset: 'custom', range: { start: parseYMD(s), end: range.end } });
  };
  const setCustomEnd = (s: string) => {
    if (!s) return;
    // Bump to end-of-day so the picked day is fully included.
    const d = parseYMD(s);
    d.setHours(23, 59, 59, 999);
    onChange({ preset: 'custom', range: { start: range.start, end: d } });
  };

  const buttons: { id: RangePreset; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom range' }];


  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 shrink-0">
      <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-1 shrink-0">
        {buttons.map((b) =>
        <button
          key={b.id}
          type="button"
          onClick={() => setPreset(b.id)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
          preset === b.id ?
          'bg-primary text-white' :
          'text-text-secondary hover:bg-background hover:text-text-primary'}`
          }>

            {b.label}
          </button>
        )}
      </div>

      {preset === 'custom' &&
      <div className="grid grid-cols-2 gap-2">
          <div className="min-w-[8.5rem]">
            <Label htmlFor="report_start" className="text-xs">
              From
            </Label>
            <DatePicker
            id="report_start"
            value={formatYMD(range.start)}
            onChange={setCustomStart} />

          </div>
          <div className="min-w-[8.5rem]">
            <Label htmlFor="report_end" className="text-xs">
              To
            </Label>
            <DatePicker
            id="report_end"
            value={formatYMD(range.end)}
            onChange={setCustomEnd}
            align="end" />

          </div>
        </div>
      }
    </div>);

}
