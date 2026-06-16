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
import { legacyRoleFor } from '../../lib/peopleApi';
import { focusFirstError } from '../../lib/focusFirstError';
import { canViewContactField } from '../../lib/contactVisibility';
import { ContactVisibilityFields, ShareState } from './ContactVisibilityFields';
import {
  addressValueToPersonFields,
  personToAddressValue } from
'../../lib/address';
interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person;
}
type ContactForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  roles: PersonRole[];
  organization_name: string;
  notes: string;
  active: boolean;
};
type FormErrors = Partial<Record<keyof ContactForm, string>>;
// Validatable fields in visual order; on a blocked submit we scroll to the
// first with an error. Keys match the input ids except `roles`, whose target
// is the wrapper div (the RolesMultiSelect has no single focusable input).
const ERROR_FIELD_ORDER: (keyof ContactForm)[] = [
'first_name',
'last_name',
'email',
'roles'];

function fromPerson(p: Person): ContactForm {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone ?? '',
    roles: p.roles,
    organization_name: p.organization_name ?? '',
    notes: p.notes ?? '',
    active: p.active
  };
}
function validateForm(form: ContactForm): FormErrors {
  const nextErrors: FormErrors = {};
  if (!form.first_name.trim()) nextErrors.first_name = 'First name is required.';
  if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required.';
  if (form.roles.length === 0) nextErrors.roles = 'Pick at least one role.';
  if (
  form.email.trim() &&
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
  {
    nextErrors.email = 'Enter a valid email address.';
  }
  return nextErrors;
}
export function EditContactModal({
  isOpen,
  onClose,
  person
}: EditContactModalProps) {
  const { updatePerson } = useWhisker();
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  // Which contact fields the editor may see (and therefore edit). A masked field
  // arrives empty, so we lock it and omit it from the save to avoid clobbering.
  const canView = {
    phone: canViewContactField(person, 'phone', isAdmin, currentUserId),
    email: canViewContactField(person, 'email', isAdmin, currentUserId),
    address: canViewContactField(person, 'address', isAdmin, currentUserId)
  };
  // Your own record can't be deactivated here — it would only hide you from
  // directories/attribution and never makes sense to do to yourself.
  const isOwnRecord = !!currentUserId && person.user_id === currentUserId;
  const [form, setForm] = useState<ContactForm>(() => fromPerson(person));
  const [address, setAddress] = useState<AddressValue | null>(() =>
  personToAddressValue(person)
  );
  const [share, setShare] = useState<ShareState>(() => ({
    phone: person.share_phone ?? true,
    email: person.share_email ?? true,
    address: person.share_address ?? false
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => {
    if (isOpen) {
      setForm(fromPerson(person));
      setAddress(personToAddressValue(person));
      setShare({
        phone: person.share_phone ?? true,
        email: person.share_email ?? true,
        address: person.share_address ?? false
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, person.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const ids = ERROR_FIELD_ORDER.filter((f) => nextErrors[f]);
      requestAnimationFrame(() => focusFirstError(ids));
      return;
    }
    const updates: Partial<Person> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      roles: form.roles,
      role: legacyRoleFor(form.roles),
      organization_name:
      form.roles.includes('vet') ?
      form.organization_name.trim() || undefined :
      undefined,
      notes: form.notes.trim() || undefined,
      active: form.active
    };
    // Only write back the contact fields the editor could actually see — a
    // hidden field arrived masked (empty), so sending it would erase the value.
    // Each field's share flag travels with it for the same reason.
    if (canView.email) {
      updates.email = form.email.trim();
      updates.share_email = share.email;
    }
    if (canView.phone) {
      updates.phone = form.phone.trim() || undefined;
      updates.share_phone = share.phone;
    }
    if (canView.address) {
      Object.assign(updates, addressValueToPersonFields(address));
      updates.share_address = share.address;
    }
    updatePerson(person.id, updates);
    onClose();
  };
  const set = (key: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Contact"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-contact-form">
            Save Changes
          </Button>
        </div>
      }>

      <form
        id="edit-contact-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="first_name" required>First Name</Label>
            <Input
              id="first_name"
              aria-invalid={Boolean(errors.first_name)}
              className={errors.first_name && 'border-red-500 focus:ring-red-500'}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)} />
            <FieldError>{errors.first_name}</FieldError>
          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input
              id="last_name"
              aria-invalid={Boolean(errors.last_name)}
              className={errors.last_name && 'border-red-500 focus:ring-red-500'}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)} />
            <FieldError>{errors.last_name}</FieldError>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              disabled={!canView.email}
              aria-invalid={Boolean(errors.email)}
              className={errors.email && 'border-red-500 focus:ring-red-500'}
              value={canView.email ? form.email : ''}
              placeholder={canView.email ? undefined : 'Hidden by this contact'}
              onChange={(e) => set('email', e.target.value)} />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              disabled={!canView.phone}
              value={canView.phone ? form.phone : ''}
              placeholder={canView.phone ? undefined : 'Hidden by this contact'}
              onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          {canView.address ?
          <AddressAutocomplete
            id="address"
            value={address}
            onChange={setAddress} /> :

          <Input
            id="address"
            disabled
            value=""
            placeholder="Hidden by this contact" />
          }
        </div>

        <div id="roles" style={{ scrollMarginTop: '1rem' }}>
          <Label required>Roles</Label>
          <RolesMultiSelect
            value={form.roles}
            onChange={(roles) => {
              setForm((prev) => ({ ...prev, roles }));
              if (errors.roles) {
                setErrors((prev) => ({ ...prev, roles: undefined }));
              }
            }} />
          <p className="mt-2 text-xs text-text-secondary">
            Select all the ways this person helps the organization.
          </p>
          <FieldError>{errors.roles}</FieldError>
        </div>

        {form.roles.includes('vet') &&
        <div>
            <Label htmlFor="organization_name">Clinic / Organization</Label>
            <Input
            id="organization_name"
            value={form.organization_name}
            onChange={(e) => set('organization_name', e.target.value)} />
          </div>
        }

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)} />
        </div>

        <ContactVisibilityFields
          value={share}
          onChange={setShare}
          lockedFields={{
            phone: !canView.phone,
            email: !canView.email,
            address: !canView.address
          }} />

        <div>
          <label
            className={`flex items-center gap-3 select-none ${
            isOwnRecord ? 'cursor-not-allowed' : 'cursor-pointer'}`
            }>

            <input
              type="checkbox"
              checked={form.active}
              disabled={isOwnRecord}
              onChange={(e) =>
              setForm((prev) => ({ ...prev, active: e.target.checked }))
              }
              className="w-4 h-4 rounded text-primary focus:ring-primary disabled:opacity-50" />

            <span className="text-sm text-text-primary">Active</span>
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
