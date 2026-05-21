import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Species } from '../../types';
interface AddFosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const INITIAL_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  max_capacity: 1,
  preferred_species: ['Dog', 'Cat'] as Species[],
  notes: '',
  active: true
};
type FormField = keyof typeof INITIAL_FORM;
type FormErrors = Partial<Record<FormField, string>>;

function validateForm(formData: typeof INITIAL_FORM): FormErrors {
  const nextErrors: FormErrors = {};
  if (!formData.first_name.trim()) nextErrors.first_name = 'First name is required.';
  if (!formData.last_name.trim()) nextErrors.last_name = 'Last name is required.';
  if (!formData.email.trim()) {
    nextErrors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    nextErrors.email = 'Enter a valid email address.';
  }
  if (!formData.phone.trim()) nextErrors.phone = 'Phone is required.';
  if (!formData.address.trim()) nextErrors.address = 'Address is required.';
  if (formData.max_capacity < 1 || formData.max_capacity > 10) {
    nextErrors.max_capacity = 'Capacity must be between 1 and 10.';
  }
  return nextErrors;
}
export function AddFosterModal({ isOpen, onClose }: AddFosterModalProps) {
  const { addFoster } = useWhisker();
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
    addFoster({
      ...formData,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      notes: formData.notes.trim()
    });
    handleClose();
  };
  const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    const fieldName = name as FormField;
    setFormData((prev) => ({
      ...prev,
      [fieldName]: name === 'max_capacity' ? parseInt(value) || 1 : value
    }));
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
  };
  const toggleSpecies = (species: Species) => {
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Foster Parent">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name</Label>
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
            <Label htmlFor="last_name">Last Name</Label>
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

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            autoComplete="off"
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? 'address_error' : undefined}
            className={errors.address && 'border-red-500 focus:ring-red-500'}
            value={formData.address}
            onChange={handleChange} />
          <FieldError id="address_error">{errors.address}</FieldError>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="max_capacity">Max Capacity</Label>
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
            <div className="flex gap-2 mt-1">
              {(['Dog', 'Cat', 'Other'] as Species[]).map((species) =>
              <button
                key={species}
                type="button"
                onClick={() => toggleSpecies(species)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${formData.preferred_species.includes(species) ? 'bg-primary text-white border-primary' : 'bg-background text-text-secondary border-border hover:border-primary/50'}`}>
                
                  {species}
                </button>
              )}
            </div>
          </div>
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

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Add Foster</Button>
        </div>
      </form>
    </Modal>);

}