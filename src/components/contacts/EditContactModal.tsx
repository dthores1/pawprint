import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { RolesMultiSelect } from '../ui/RolesMultiSelect';
import { useWhisker } from '../../context/WhiskerContext';
import { Person, PersonRole } from '../../types';
import { legacyRoleFor } from '../../lib/peopleApi';
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
  const [form, setForm] = useState<ContactForm>(() => fromPerson(person));
  const [errors, setErrors] = useState<FormErrors>({});
  useEffect(() => {
    if (isOpen) {
      setForm(fromPerson(person));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, person.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    updatePerson(person.id, {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      roles: form.roles,
      role: legacyRoleFor(form.roles),
      organization_name:
      form.roles.includes('vet') ?
      form.organization_name.trim() || undefined :
      undefined,
      notes: form.notes.trim() || undefined,
      active: form.active
    });
    onClose();
  };
  const set = (key: keyof ContactForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Contact">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              aria-invalid={Boolean(errors.first_name)}
              className={errors.first_name && 'border-red-500 focus:ring-red-500'}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)} />
            <FieldError>{errors.first_name}</FieldError>
          </div>
          <div>
            <Label htmlFor="last_name">Last Name</Label>
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
              aria-invalid={Boolean(errors.email)}
              className={errors.email && 'border-red-500 focus:ring-red-500'}
              value={form.email}
              onChange={(e) => set('email', e.target.value)} />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Roles / Capabilities</Label>
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

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
            setForm((prev) => ({ ...prev, active: e.target.checked }))
            }
            className="w-4 h-4 rounded text-primary focus:ring-primary" />

          <span className="text-sm text-text-primary">Active</span>
        </label>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>);

}
