import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { useWhisker } from '../../context/WhiskerContext';
import { AddressValue, SavedLocation } from '../../types';
import { cn } from '../../lib/utils';
import { focusFirstError } from '../../lib/focusFirstError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Provided → edit mode; omitted → create. */
  location?: SavedLocation;
}
export function SavedLocationFormModal({ isOpen, onClose, location }: Props) {
  const { addSavedLocation, updateSavedLocation } = useWhisker();
  const isEdit = !!location;
  const [name, setName] = useState('');
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; address?: string }>({});

  useEffect(() => {
    if (!isOpen) return;
    setName(location?.name ?? '');
    setAddress(location?.address ?? null);
    setActive(location?.active ?? true);
    setErrors({});
  }, [isOpen, location]);

  const save = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Name is required.';
    if (!address?.formatted.trim()) next.address = 'Address is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() =>
      focusFirstError([next.name && 'location_name', next.address && 'location_address'].
      filter((v): v is string => Boolean(v)))
      );
      return;
    }
    const payload = { name: name.trim(), address, active };
    if (isEdit && location) updateSavedLocation(location.id, payload);else
    addSavedLocation(payload);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Location' : 'New Location'}
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      }>

      <div className="space-y-4">
        <div>
          <Label htmlFor="location_name" required>Name</Label>
          <Input
            id="location_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            placeholder="e.g. ACP Clinic, Melissa's House"
            className={errors.name ? 'border-red-500 focus:ring-red-500' : undefined} />
          <FieldError>{errors.name}</FieldError>
        </div>
        <div>
          <Label htmlFor="location_address" required>Address</Label>
          <AddressAutocomplete
            id="location_address"
            value={address}
            error={Boolean(errors.address)}
            onChange={(addr) => {
              setAddress(addr);
              if (errors.address) setErrors((p) => ({ ...p, address: undefined }));
            }}
            placeholder="Search for the address…" />
          <FieldError>{errors.address}</FieldError>
        </div>
        {isEdit &&
        <div className="flex items-center justify-between">
            <Label className="mb-0">Active</Label>
            <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Active"
            onClick={() => setActive((a) => !a)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              active ? 'bg-primary' : 'bg-border'
            )}>
              <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                active ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
        }
      </div>
    </Modal>);

}
