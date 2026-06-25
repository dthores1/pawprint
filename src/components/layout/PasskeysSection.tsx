// "Security" block in My Preferences: register and manage passkeys. Passkeys let
// the user sign in with fingerprint/face/device PIN (WebAuthn) instead of a
// password. Rendered only when the platform supports passkeys and we're on real
// Supabase auth (not demo) — the caller gates that.
import { useEffect, useState } from 'react';
import { FingerprintIcon, Trash2Icon, PlusIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { PasskeyInfo } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';

export function PasskeysSection() {
  const { listPasskeys, registerPasskey, deletePasskey } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await listPasskeys();
    if (res.error) setError(res.error);
    else setPasskeys(res.data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    setBusy(true);
    setError(null);
    const { error } = await registerPasskey();
    if (error) setError(error);
    else await refresh();
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    const { error } = await deletePasskey(id);
    if (error) setError(error);
    else setPasskeys((prev) => prev.filter((p) => p.id !== id));
    setBusy(false);
  };

  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-1">Security</p>
      <p className="text-xs text-text-secondary mb-3">
        Passkeys let you sign in with your fingerprint, face, or device PIN —
        no password to remember.
      </p>

      {!loading && passkeys.length > 0 &&
      <ul className="space-y-2 mb-3">
          {passkeys.map((pk) =>
        <li
          key={pk.id}
          className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">

              <FingerprintIcon className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {pk.friendly_name || 'Passkey'}
                </p>
                <p className="text-xs text-text-secondary">
                  Added {formatDate(pk.created_at)}
                </p>
              </div>
              <button
            type="button"
            onClick={() => handleDelete(pk.id)}
            disabled={busy}
            aria-label="Remove passkey"
            className="p-1.5 text-text-secondary/60 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 rounded-lg transition-colors disabled:opacity-50">

                <Trash2Icon className="w-4 h-4" />
              </button>
            </li>
        )}
        </ul>
      }

      {!loading && passkeys.length === 0 &&
      <p className="text-sm text-text-secondary mb-3">No passkeys yet.</p>
      }

      {error && <p className="text-sm text-[#9B3A3A] mb-3">{error}</p>}

      <Button variant="outline" size="sm" onClick={handleAdd} disabled={busy}>
        <PlusIcon className="w-4 h-4 mr-1.5" />
        {busy ? 'Working…' : 'Add a passkey'}
      </Button>
    </div>);

}
