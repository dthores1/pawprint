import { AddressValue } from '../../types';
import { googleMapsUrl } from '../../lib/address';
import { cn } from '../../lib/utils';

interface Props {
  value: AddressValue | null;
  className?: string;
  /** Render the single formatted line instead of the two-line block (compact
   *  rows like list/card headers). Still links to Maps. */
  singleLine?: boolean;
}

// Renders a structured address as two lines (street / city-state-zip) linked to
// Google Maps. Falls back to the single formatted line when components are
// missing (manually-typed addresses). Returns null when there's no address.
export function AddressDisplay({ value, className, singleLine }: Props) {
  if (!value || !value.formatted.trim()) return null;

  const line1 = [value.street1, value.street2].filter(Boolean).join(', ');
  const line2 = [
  value.city,
  [value.state, value.postalCode].filter(Boolean).join(' ').trim()].
  filter(Boolean).
  join(', ');
  const hasStructured = Boolean(line1 || line2);
  const href = googleMapsUrl(value);

  // For manually-typed addresses we only have the formatted string. Split on the
  // first comma so the street sits on its own line and the rest (city/state/zip)
  // wraps below — matching the structured two-line block instead of truncating.
  const commaIdx = value.formatted.indexOf(',');
  const fallbackLine1 =
  commaIdx === -1 ? value.formatted : value.formatted.slice(0, commaIdx).trim();
  const fallbackLine2 =
  commaIdx === -1 ? '' : value.formatted.slice(commaIdx + 1).trim();

  const body = singleLine ?
  <span className="truncate">{value.formatted}</span> :
  hasStructured ?
  <span className="leading-snug">
      {line1 && <span className="block">{line1}</span>}
      {line2 && <span className="block">{line2}</span>}
    </span> :

  <span className="leading-snug">
      <span className="block">{fallbackLine1}</span>
      {fallbackLine2 && <span className="block">{fallbackLine2}</span>}
    </span>;

  if (!href) {
    return <span className={cn('text-text-primary', className)}>{body}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
      className={cn('text-primary hover:underline', className)}>

      {body}
    </a>);

}
