import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { RolesMultiSelect } from '../ui/RolesMultiSelect';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { useIsAdmin } from '../../lib/useIsAdmin';
import { AddressValue, Person, PersonRole } from '../../types';
import { enabledSpeciesList } from '../../lib/orgCatalog';
import { personToAddressValue } from '../../lib/address';
import { focusFirstError } from '../../lib/focusFirstError';
import { canViewContactField } from '../../lib/contactVisibility';
import {
  ContactVisibilityFields,
  ShareState } from
'../contacts/ContactVisibilityFields';
interface EditFosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The foster — a `people` row with the 'foster_parent' role. */
  foster: Person;
}
type FosterForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: AddressValue | null;
  // `''` lets the user clear the field while typing; coerced to a number on submit.
  max_capacity: number | '';
  preferred_species: string[];
  notes: string;
  active: boolean;
  roles: PersonRole[];
};
type FormField = keyof FosterForm;
type FormErrors = Partial<Record<FormField, string>>;
// Validatable fields in visual order; on a blocked submit we scroll to the
// first with an error (each key matches its input's DOM id).
const ERROR_FIELD_ORDER: FormField[] = [
'first_name',
'last_name',
'email',
'phone',
'address',
'max_capacity'];

function fromFoster(f: Person): FosterForm {
  return {
    first_name: f.first_name,
    last_name: f.last_name,
    email: f.email,
    phone: f.phone ?? '',
    address: personToAddressValue(f),
    max_capacity: f.max_capacity ?? 1,
    preferred_species: f.preferred_species ?? [],
    notes: f.notes ?? '',
    active: f.active,
    roles: f.roles.includes('foster_parent') ?
    f.roles :
    ['foster_parent', ...f.roles]
  };
}
function validateForm(formData: FosterForm): FormErrors {
  const nextErrors: FormErrors = {};
  if (!formData.first_name.trim())
  nextErrors.first_name = 'First name is required.';
  if (!formData.last_name.trim())
  nextErrors.last_name = 'Last name is required.';

  if (!formData.email && !formData.phone) {
    const msg = 'Provide an email or a phone number.';
    nextErrors.email = msg;
    nextErrors.phone = msg;
  } else if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    nextErrors.email = 'Enter a valid email address.';
  }

  if (
  formData.max_capacity === '' ||
  formData.max_capacity < 1 ||
  formData.max_capacity > 10)
  {
    nextErrors.max_capacity = 'Capacity must be between 1 and 10.';
  }
  return nextErrors;
}
export function EditFosterModal({
  isOpen,
  onClose,
  foster
}: EditFosterModalProps) {
  const { updateFoster, species: speciesCatalog, organizationSpecies } =
  useWhisker();
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const canView = {
    phone: canViewContactField(foster, 'phone', isAdmin, currentUserId),
    email: canViewContactField(foster, 'email', isAdmin, currentUserId),
    address: canViewContactField(foster, 'address', isAdmin, currentUserId)
  };
  // Your own record can't be deactivated here (it would only hide you from
  // directories/attribution).
  const isOwnRecord = !!currentUserId && foster.user_id === currentUserId;
  const [formData, setFormData] = useState<FosterForm>(() => fromFoster(foster));
  const [share, setShare] = useState<ShareState>(() => ({
    phone: foster.share_phone ?? true,
    email: foster.share_email ?? true,
    address: foster.share_address ?? false
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  // Re-seed when the modal opens (or the foster changes) so edits start fresh.
  useEffect(() => {
    if (isOpen) {
      setFormData(fromFoster(foster));
      setShare({
        phone: foster.share_phone ?? true,
        email: foster.share_email ?? true,
        address: foster.share_address ?? false
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, foster.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const ids = ERROR_FIELD_ORDER.filter((f) => nextErrors[f]);
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    const updates: Partial<Person> = {
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      roles: formData.roles,
      preferred_species: formData.preferred_species,
      notes: formData.notes.trim(),
      active: formData.active,
      max_capacity: Number(formData.max_capacity)
    };
    // Only write back contact fields the editor could see — a masked field came
    // back empty, so sending it would erase the stored value. Flags travel with
    // their field.
    if (canView.email) {
      updates.email = formData.email.trim();
      updates.share_email = share.email;
    }
    if (canView.phone) {
      updates.phone = formData.phone.trim();
      updates.share_phone = share.phone;
    }
    if (canView.address) {
      const addr = formData.address;
      // Legacy single-line field + the structured components. Empty strings let
      // the API layer null out columns the picked address doesn't supply.
      updates.address = addr?.formatted ?? '';
      updates.address_google_place_id = addr?.placeId || '';
      updates.address_formatted = addr?.formatted || '';
      updates.address_street_1 = addr?.street1 || '';
      updates.address_street_2 = addr?.street2 || '';
      updates.address_city = addr?.city || '';
      updates.address_state = addr?.state || '';
      updates.address_postal_code = addr?.postalCode || '';
      updates.address_country = addr?.country || '';
      updates.address_latitude = addr?.latitude;
      updates.address_longitude = addr?.longitude;
      updates.share_address = share.address;
    }
    updateFoster(foster.id, updates);
    onClose();
  };
  const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    const fieldName = name as FormField;
    setFormData((prev) => {
      if (name === 'max_capacity') {
        if (value === '') return { ...prev, max_capacity: '' };
        const parsed = parseInt(value, 10);
        return { ...prev, max_capacity: Number.isNaN(parsed) ? '' : parsed };
      }
      return { ...prev, [fieldName]: value };
    });
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
  };
  const toggleSpecies = (species: string) => {
    setFormData((prev) => {
      const current = prev.preferred_species;
      return {
        ...prev,
        preferred_species: current.includes(species) ?
        current.filter((s) => s !== species) :
        [...current, species]
      };
    });
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Foster Parent"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-foster-form">
            Save Changes
          </Button>
        </div>
      }>

      <form
        id="edit-foster-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" required>First Name</Label>
            <Input
              id="first_name"
              name="first_name"
              autoComplete="off"
              aria-invalid={Boolean(errors.first_name)}
              className={errors.first_name && 'border-red-500 focus:ring-red-500'}
              value={formData.first_name}
              onChange={handleChange} />
            <FieldError>{errors.first_name}</FieldError>
          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input
              id="last_name"
              name="last_name"
              autoComplete="off"
              aria-invalid={Boolean(errors.last_name)}
              className={errors.last_name && 'border-red-500 focus:ring-red-500'}
              value={formData.last_name}
              onChange={handleChange} />
            <FieldError>{errors.last_name}</FieldError>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              disabled={!canView.email}
              aria-invalid={Boolean(errors.email)}
              className={errors.email && 'border-red-500 focus:ring-red-500'}
              value={canView.email ? formData.email : ''}
              placeholder={canView.email ? undefined : 'Hidden by this foster'}
              onChange={handleChange} />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="off"
              disabled={!canView.phone}
              aria-invalid={Boolean(errors.phone)}
              className={errors.phone && 'border-red-500 focus:ring-red-500'}
              value={canView.phone ? formData.phone : ''}
              placeholder={canView.phone ? undefined : 'Hidden by this foster'}
              onChange={handleChange} />
            <FieldError>{errors.phone}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          {canView.address ?
          <AddressAutocomplete
            id="address"
            error={Boolean(errors.address)}
            value={formData.address}
            onChange={(addr) => {
              setFormData((prev) => ({ ...prev, address: addr }));
              if (errors.address) {
                setErrors((prev) => ({ ...prev, address: undefined }));
              }
            }} /> :

          <Input id="address" disabled value="" placeholder="Hidden by this foster" />
          }
          <FieldError>{errors.address}</FieldError>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_capacity" required>Max Capacity</Label>
            <Input
              id="max_capacity"
              name="max_capacity"
              type="number"
              min="1"
              max="10"
              aria-invalid={Boolean(errors.max_capacity)}
              className={
              errors.max_capacity && 'border-red-500 focus:ring-red-500'
              }
              value={formData.max_capacity}
              onChange={handleChange} />
            <FieldError>{errors.max_capacity}</FieldError>
          </div>
          <div>
            <Label>Preferred Species</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
              ...enabledSpeciesList(speciesCatalog, organizationSpecies),
              // keep any already-selected species that's since been disabled
              ...speciesCatalog.filter(
                (s) =>
                formData.preferred_species.includes(s.name) &&
                !enabledSpeciesList(speciesCatalog, organizationSpecies).some(
                  (e) => e.id === s.id
                )
              )].
              map((s) =>
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSpecies(s.name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${formData.preferred_species.includes(s.name) ? 'bg-primary text-white border-primary' : 'bg-background text-text-secondary border-border hover:border-primary/50'}`}>

                  {s.name}
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label>Roles</Label>
          <RolesMultiSelect
            value={formData.roles}
            locked={['foster_parent']}
            onChange={(roles) =>
            setFormData((prev) => ({ ...prev, roles }))
            } />
          <p className="mt-2 text-xs text-text-secondary">
            This person is a foster parent. Add any other ways they help.
          </p>
        </div>

        <div>
          <Label htmlFor="notes">
            Notes (Home environment, experience, etc.)
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange} />
        </div>

        <ContactVisibilityFields
          value={share}
          onChange={setShare}
          lockedFields={{
            phone: !canView.phone,
            email: !canView.email,
            address: !canView.address
          }} />

        {/* Active toggle — lets coordinators retire a foster without deleting. */}
        <div>
          <label
            className={`flex items-center gap-3 select-none ${
            isOwnRecord ? 'cursor-not-allowed' : 'cursor-pointer'}`
            }>

            <input
              type="checkbox"
              checked={formData.active}
              disabled={isOwnRecord}
              onChange={(e) =>
              setFormData((prev) => ({ ...prev, active: e.target.checked }))
              }
              className="w-4 h-4 rounded text-primary focus:ring-primary disabled:opacity-50" />

            <span className="text-sm text-text-primary">
              Active foster parent
              <span className="text-text-secondary">
                {' '}
                — available for new placements
              </span>
            </span>
          </label>
          {isOwnRecord &&
          <p className="text-xs text-text-secondary mt-1 ml-[26px]">
            You can't deactivate your own record.
          </p>
          }
        </div>
      </form>
    </Modal>);

}
