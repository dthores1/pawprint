import { useState } from 'react';
import { ShieldCheckIcon, ShieldIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { SupportAccessDuration } from '../../types';
import { formatDate } from '../../lib/utils';

const DURATIONS: { value: SupportAccessDuration; label: string }[] = [
{ value: '24h', label: '24 hours' },
{ value: '7d', label: '7 days' },
{ value: 'until_resolved', label: 'Until resolved' }];

// Human-readable line for an audit event.
function auditLine(action: string, actor?: string): string {
  switch (action) {
    case 'support_access.granted':
      return `${actor ?? 'An admin'} granted support access`;
    case 'support_access.revoked':
      return `${actor ?? 'An admin'} revoked support access`;
    case 'support_access.expired':
      return 'Support access expired';
    default:
      return action;
  }
}

export function SupportAccessCard() {
  const { supportAccess, auditEvents, grantSupportAccess, revokeSupportAccess } =
  useWhisker();
  const [duration, setDuration] = useState<SupportAccessDuration>('7d');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const grant = async () => {
    setBusy(true);
    setError(undefined);
    const err = await grantSupportAccess(duration);
    setBusy(false);
    if (err) setError(err);
  };
  const revoke = async () => {
    setBusy(true);
    setError(undefined);
    const err = await revokeSupportAccess();
    setBusy(false);
    if (err) setError(err);
  };

  const accessEvents = auditEvents.filter((e) =>
  e.action.startsWith('support_access.')
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-heading font-semibold text-lg text-text-primary">
          Support Access
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Allow the Whiskerville support team to temporarily access this
          organization to investigate reported issues. Access expires
          automatically and you can revoke it at any time.
        </p>
      </div>

      <div className="p-5 space-y-4">
        {supportAccess.active ?
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheckIcon className="w-5 h-5 text-green-700 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-text-primary">
                  Support access is enabled
                </div>
                <div className="text-xs text-text-secondary">
                  {supportAccess.expires_at ?
                `Expires ${formatDate(supportAccess.expires_at)}` :
                'Until the linked ticket is resolved'}
                </div>
              </div>
            </div>
            <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={revoke}
            className="shrink-0">
              {busy ? 'Revoking…' : 'Revoke'}
            </Button>
          </div> :

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ShieldIcon className="w-5 h-5 text-text-secondary shrink-0" />
              <div>
                <div className="font-medium text-text-primary">Disabled</div>
                <div className="text-xs text-text-secondary">
                  No one from support can access your organization.
                </div>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <label
                htmlFor="support_access_duration"
                className="block text-xs font-medium text-text-secondary mb-1">
                  Grant for
                </label>
                <Select
                id="support_access_duration"
                value={duration}
                onChange={(e) =>
                setDuration(e.target.value as SupportAccessDuration)
                }
                className="w-36">
                  {DURATIONS.map((d) =>
                <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                )}
                </Select>
              </div>
              <Button disabled={busy} onClick={grant}>
                {busy ? 'Enabling…' : 'Enable access'}
              </Button>
            </div>
          </div>
        }

        {error &&
        <p className="text-xs font-medium text-red-700">{error}</p>
        }

        {accessEvents.length > 0 &&
        <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
              Access history
            </h3>
            <ul className="space-y-1.5">
              {accessEvents.slice(0, 8).map((e) =>
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-text-primary truncate">
                    {auditLine(e.action, e.actor_label)}
                    {e.ticket_id &&
                <span className="text-text-secondary"> · for a ticket</span>
                }
                  </span>
                  <span className="text-xs text-text-secondary shrink-0">
                    {formatDate(e.created_at)}
                  </span>
                </li>
            )}
            </ul>
          </div>
        }
      </div>
    </Card>);

}
