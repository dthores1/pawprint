import Papa from 'papaparse';
import { format } from 'date-fns';

// One exported column: a header plus a pure accessor that derives the cell value
// from a row. Keeping the value as a function lets callers resolve/denormalize
// (foster name from id, species label, etc.) at export time.
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

// Normalize a cell to a string PapaParse can serialize. Booleans become Yes/No
// (friendlier in a spreadsheet than true/false); null/undefined become ''.
function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

// Build a CSV from a column spec + rows and trigger a browser download.
// PapaParse handles quoting/escaping (embedded commas, quotes, newlines). The
// leading BOM makes Excel read the file as UTF-8 so accented names aren't mangled.
export function downloadCsv<T>(
  baseName: string,
  columns: CsvColumn<T>[],
  rows: T[])
: void {
  const headers = columns.map((c) => c.header);
  const records = rows.map((row) => {
    const rec: Record<string, string> = {};
    for (const col of columns) rec[col.header] = cell(col.value(row));
    return rec;
  });
  const csv = Papa.unparse({ fields: headers, data: records.map((r) => headers.map((h) => r[h])) });

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // e.g. whiskerville-animals-current-view-2026-Jun-07.csv
  a.download = `whiskerville-${baseName}-${format(new Date(), 'yyyy-MMM-dd')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
