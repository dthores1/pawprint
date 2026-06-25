// "My Preferences" — the single home for personal, user-level settings, opened
// from the user menu. Keeps personal preferences out of operational screens
// (contact records, the sidebar): Visibility controls what other members see of
// *your* contact info; Experience controls optional in-app helpers.
import { useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import {
  ContactVisibilityFields,
  ShareState } from
'../contacts/ContactVisibilityFields';
import { PasskeysSection } from './PasskeysSection';
import { isDemoMode } from '../../lib/appMode';
import { passkeysSupported } from '../../lib/supabase';

export function PreferencesModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { currentPersonId, currentOrg } = useAuth();
  const { people, peopleIndex, updatePerson, tipsHidden, setTipsHidden } =
  useWhisker();

  // The signed-in user's own person record (self records always load upfront;
  // share flags are also in the index, so this resolves either way).
  const me = useMemo(
    () =>
    currentPersonId ?
    people.find((p) => p.id === currentPersonId) ??
    peopleIndex.find((p) => p.id === currentPersonId) :
    undefined,
    [people, peopleIndex, currentPersonId]
  );

  const share: ShareState = {
    phone: me?.share_phone ?? true,
    email: me?.share_email ?? true,
    address: me?.share_address ?? false
  };

  const updateShare = (next: ShareState) => {
    if (!currentPersonId) return;
    updatePerson(currentPersonId, {
      share_phone: next.phone,
      share_email: next.email,
      share_address: next.address
    });
  };

  // The org-wide kill switch overrides the personal toggle; surface that rather
  // than letting the user check a box that does nothing.
  const guidanceOrgOff = currentOrg?.show_guidance === false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My Preferences">
      <div className="space-y-7">
        {me &&
        <ContactVisibilityFields value={share} onChange={updateShare} />
        }

        <div>
          <p className="text-sm font-medium text-text-primary mb-1">
            Experience
          </p>
          <p className="text-xs text-text-secondary mb-3">
            Optional helpers shown around the app.
          </p>
          <label
            className={`flex items-center gap-2.5 text-sm ${
            guidanceOrgOff ?
            'text-text-secondary cursor-not-allowed' :
            'text-text-primary cursor-pointer'}`
            }>

            <input
              type="checkbox"
              checked={!guidanceOrgOff && !tipsHidden}
              disabled={guidanceOrgOff}
              onChange={(e) => setTipsHidden(!e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary disabled:opacity-50" />

            Show in-app guidance and tips
          </label>
          {guidanceOrgOff &&
          <p className="text-xs text-text-secondary mt-1 ml-[26px]">
              Turned off for your organization by an admin.
            </p>
          }
        </div>

        {/* Passkeys need real Supabase auth + WebAuthn support. */}
        {!isDemoMode && passkeysSupported && <PasskeysSection />}
      </div>
    </Modal>);

}
