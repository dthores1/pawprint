import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { RolesMultiSelect } from '../ui/RolesMultiSelect';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { useWhisker } from '../../context/WhiskerContext';
import { AddressValue, PersonRole } from '../../types';
interface AddFosterModalProps {
  isOpen: boolean;
  onClose: () => void;
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
const INITIAL_FORM: FosterForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: null,
  max_capacity: 1,
  preferred_species: ['Dog', 'Cat'],
  notes: '',
  active: true,
  roles: ['foster_parent']
};
type FormField = keyof FosterForm;
type FormErrors = Partial<Record<FormField, string>>;

// Provides form validations -- required fields, validation rules, email formatting, etc.
function validateForm(formData: FosterForm): FormErrors {
  const nextErrors: FormErrors = {};
  if (!formData.first_name.trim()) nextErrors.first_name = 'First name is required.';
  if (!formData.last_name.trim()) nextErrors.last_name = 'Last name is required.';

  // At least one contact method — email or phone — is required, but not both.
  // The shared "missing" message is mirrored on both fields so the user sees it
  // regardless of which they were focused on.
  const email = formData.email.trim();
  const phone = formData.phone.trim();
  if (!email && !phone) {
    const msg = 'Provide an email or a phone number.';
    nextErrors.email = msg;
    nextErrors.phone = msg;
  } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    nextErrors.email = 'Enter a valid email address.';
  }
  if (
    formData.max_capacity === '' ||
    formData.max_capacity < 1 ||
    formData.max_capacity > 10
  ) {
    nextErrors.max_capacity = 'Capacity must be between 1 and 10.';
  }
  return nextErrors;
}
export function AddFosterModal({ isOpen, onClose }: AddFosterModalProps) {
  const { addFoster, species: speciesCatalog } = useWhisker();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const handleClose = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validateForm(formData);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const addr = formData.address;
    addFoster({
      ...formData,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      // Legacy single-line field + the structured components. Empty strings let
      // the API layer null out columns the picked address doesn't supply.
      address: addr?.formatted ?? '',
      address_google_place_id: addr?.placeId || '',
      address_formatted: addr?.formatted || '',
      address_street_1: addr?.street1 || '',
      address_street_2: addr?.street2 || '',
      address_city: addr?.city || '',
      address_state: addr?.state || '',
      address_postal_code: addr?.postalCode || '',
      address_country: addr?.country || '',
      address_latitude: addr?.latitude,
      address_longitude: addr?.longitude,
      notes: formData.notes.trim(),
      max_capacity: Number(formData.max_capacity)
    });
    handleClose();
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
        return {
          ...prev,
          max_capacity: Number.isNaN(parsed) ? '' : parsed
        };
      }
      return { ...prev, [fieldName]: value };
    });
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
    // Email and phone share an "at least one" rule — typing into either clears
    // the error on the other so the red border doesn't linger after the user
    // satisfies the rule by filling the alternate field.
    if (fieldName === 'email' && errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
    } else if (fieldName === 'phone' && errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };
  const toggleSpecies = (species: string) => {
    setFormData((prev) => {
      const current = prev.preferred_species;
      if (current.includes(species)) {
        return {
          ...prev,
          preferred_species: current.filter((s) => s !== species)
        };
      } else {
        return {
          ...prev,
          preferred_species: [...current, species]
        };
      }
    });
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Foster Parent"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-foster-form">
            Add Foster
          </Button>
        </div>
      }>

      <form
        id="add-foster-form"
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
              aria-describedby={errors.first_name ? 'first_name_error' : undefined}
              className={errors.first_name && 'border-red-500 focus:ring-red-500'}
              value={formData.first_name}
              onChange={handleChange} />
            <FieldError id="first_name_error">{errors.first_name}</FieldError>
            
          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input
              id="last_name"
              name="last_name"
              autoComplete="off"
              aria-invalid={Boolean(errors.last_name)}
              aria-describedby={errors.last_name ? 'last_name_error' : undefined}
              className={errors.last_name && 'border-red-500 focus:ring-red-500'}
              value={formData.last_name}
              onChange={handleChange} />
            <FieldError id="last_name_error">{errors.last_name}</FieldError>
            
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="off"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email_error' : undefined}
                className={errors.email && 'border-red-500 focus:ring-red-500'}
                value={formData.email}
                onChange={handleChange} />
              <FieldError id="email_error">{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="off"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'phone_error' : undefined}
                className={errors.phone && 'border-red-500 focus:ring-red-500'}
                value={formData.phone}
                onChange={handleChange} />
              <FieldError id="phone_error">{errors.phone}</FieldError>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Provide an email or a phone number. Most fosters will have both.
          </p>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <AddressAutocomplete
            id="address"
            error={Boolean(errors.address)}
            value={formData.address}
            onChange={(addr) => {
              setFormData((prev) => ({ ...prev, address: addr }));
              if (errors.address) {
                setErrors((prev) => ({ ...prev, address: undefined }));
              }
            }} />
          <FieldError id="address_error">{errors.address}</FieldError>
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
              aria-describedby={
                errors.max_capacity ? 'max_capacity_error' : undefined
              }
              className={
                errors.max_capacity && 'border-red-500 focus:ring-red-500'
              }
              value={formData.max_capacity}
              onChange={handleChange} />
            <FieldError id="max_capacity_error">
              {errors.max_capacity}
            </FieldError>
            
          </div>
          <div>
            <Label>Preferred Species</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {speciesCatalog.map((s) =>
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
      </form>
    </Modal>);

}