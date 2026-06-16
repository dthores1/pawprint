import { ContactField } from '../../lib/contactVisibility';

export interface ShareState {
  phone: boolean;
  email: boolean;
  address: boolean;
}

const ROWS: { key: ContactField; label: string }[] = [
{ key: 'phone', label: 'Share phone number with organization members' },
{ key: 'email', label: 'Share email address with organization members' },
{ key: 'address', label: 'Share address with organization members' }];

/**
 * The three contact-info visibility toggles, shared by the Add/Edit Contact and
 * Foster forms. When a field is hidden from the current editor (a non-admin who
 * can't see it), pass it in `lockedFields` to render that toggle disabled with a
 * note — the caller also omits that field from the save so it isn't clobbered.
 */
export function ContactVisibilityFields({
  value,
  onChange,
  lockedFields
}: {
  value: ShareState;
  onChange: (next: ShareState) => void;
  lockedFields?: Partial<Record<ContactField, boolean>>;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-1">
        Visibility
      </p>
      <p className="text-xs text-text-secondary mb-3">
        Admins always see all contact info. Choose what other organization
        members can see.
      </p>
      <div className="space-y-2.5">
        {ROWS.map(({ key, label }) => {
          const locked = !!lockedFields?.[key];
          return (
            <div key={key}>
              <label
                className={`flex items-center gap-2.5 text-sm ${
                locked ?
                'text-text-secondary cursor-not-allowed' :
                'text-text-primary cursor-pointer'}`
                }>

                <input
                  type="checkbox"
                  checked={value[key]}
                  disabled={locked}
                  onChange={(e) =>
                  onChange({ ...value, [key]: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-primary focus:ring-primary disabled:opacity-50" />

                {label}
              </label>
              {locked &&
              <p className="text-xs text-text-secondary mt-1 ml-[26px]">
                  Hidden from you — only an admin can change this.
                </p>
              }
            </div>);

        })}
      </div>
    </div>);

}
