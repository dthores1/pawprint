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

  const body = singleLine || !hasStructured ?
  <span className="truncate">{value.formatted}</span> :

  <span className="leading-snug">
      {line1 && <span className="block">{line1}</span>}
      {line2 && <span className="block">{line2}</span>}
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
