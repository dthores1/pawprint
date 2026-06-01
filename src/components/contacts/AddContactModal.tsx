import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { RolesMultiSelect } from '../ui/RolesMultiSelect';
import { useWhisker } from '../../context/WhiskerContext';
import { PersonRole } from '../../types';
import { legacyRoleFor } from '../../lib/peopleApi';
interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const INITIAL = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  roles: [] as PersonRole[],
  organization_name: '',
  notes: ''
};
type ContactField = keyof typeof INITIAL;
type FormErrors = Partial<Record<ContactField, string>>;

function validateForm(form: typeof INITIAL): FormErrors {
  const nextErrors: FormErrors = {};
  if (!form.first_name.trim()) nextErrors.first_name = 'First name is required.';
  if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required.';
  if (form.roles.length === 0) nextErrors.roles = 'Pick at least one role.';
  if (
    form.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  ) {
    nextErrors.email = 'Enter a valid email address.';
  }
  return nextErrors;
}
export function AddContactModal({ isOpen, onClose }: AddContactModalProps) {
  const { addPerson } = useWhisker();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const handleClose = () => {
    setForm(INITIAL);
    setErrors({});
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    addPerson({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      roles: form.roles,
      role: legacyRoleFor(form.roles),
      // Vets carry an organization (clinic).
      organization_name:
      form.roles.includes('vet') ?
      form.organization_name.trim() || undefined :
      undefined,
      notes: form.notes.trim() || undefined,
      active: true
    });
    handleClose();
  };
  const set = (key: ContactField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Contact">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="first_name" required>First Name</Label>
            <Input
              id="first_name"
              aria-invalid={Boolean(errors.first_name)}
              aria-describedby={errors.first_name ? 'first_name_error' : undefined}
              className={errors.first_name && 'border-red-500 focus:ring-red-500'}
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)} />
            <FieldError id="first_name_error">{errors.first_name}</FieldError>

          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input
              id="last_name"
              aria-invalid={Boolean(errors.last_name)}
              aria-describedby={errors.last_name ? 'last_name_error' : undefined}
              className={errors.last_name && 'border-red-500 focus:ring-red-500'}
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)} />
            <FieldError id="last_name_error">{errors.last_name}</FieldError>

          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email_error' : undefined}
              className={errors.email && 'border-red-500 focus:ring-red-500'}
              value={form.email}
              onChange={(e) => set('email', e.target.value)} />
            <FieldError id="email_error">{errors.email}</FieldError>

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

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Add Contact</Button>
        </div>
      </form>
    </Modal>);

}
