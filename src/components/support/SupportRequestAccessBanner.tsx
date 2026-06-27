import { useState } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { SupportAccessDuration, SupportTicket } from '../../types';

const DURATIONS: { value: SupportAccessDuration; label: string }[] = [
{ value: '24h', label: '24 hours' },
{ value: '7d', label: '7 days' },
{ value: 'until_resolved', label: 'Until resolved' }];

// Shown on a ticket when support has asked to access the org to investigate it.
// Admins get a one-click grant (tied to this ticket); members get a heads-up.
export function SupportRequestAccessBanner({
  ticket,
  isAdmin
}: {
  ticket: SupportTicket;
  isAdmin: boolean;
}) {
  const { grantSupportAccess } = useWhisker();
  const [duration, setDuration] = useState<SupportAccessDuration>('until_resolved');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const grant = async () => {
    setBusy(true);
    setError(undefined);
    const err = await grantSupportAccess(duration, ticket.id);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-text-primary">
          <KeyRoundIcon className="w-4 h-4 text-amber-700 shrink-0" />
          Support has requested access to investigate this issue.
        </span>
        {isAdmin ?
        <div className="flex items-center gap-2">
            <Select
            aria-label="Grant access for"
            value={duration}
            onChange={(e) =>
            setDuration(e.target.value as SupportAccessDuration)
            }
            className="h-9 w-36 text-sm">
              {DURATIONS.map((d) =>
            <option key={d.value} value={d.value}>{d.label}</option>
            )}
            </Select>
            <Button size="sm" disabled={busy} onClick={grant}>
              {busy ? 'Granting…' : 'Grant access'}
            </Button>
          </div> :

        <span className="text-xs text-text-secondary">
            Ask an organization admin to grant access.
          </span>
        }
      </div>
      {error && <p className="text-xs font-medium text-red-700 mt-1.5">{error}</p>}
    </div>);

}
