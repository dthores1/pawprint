import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Species } from '../../types';
interface AddFosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export function AddFosterModal({ isOpen, onClose }: AddFosterModalProps) {
  const { addFoster } = useWhisker();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    max_capacity: 1,
    preferred_species: ['Dog', 'Cat'] as Species[],
    notes: '',
    active: true
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addFoster(formData);
    onClose();
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      max_capacity: 1,
      preferred_species: ['Dog', 'Cat'],
      notes: '',
      active: true
    });
  };
  const handleChange = (
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'max_capacity' ? parseInt(value) || 1 : value
    }));
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
    <Modal isOpen={isOpen} onClose={onClose} title="Add Foster Parent">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              name="first_name"
              required
              value={formData.first_name}
              onChange={handleChange} />
            
          </div>
          <div>
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              name="last_name"
              required
              value={formData.last_name}
              onChange={handleChange} />
            
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange} />
            
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={handleChange} />
            
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            name="address"
            required
            value={formData.address}
            onChange={handleChange} />
          
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
              required
              value={formData.max_capacity}
              onChange={handleChange} />
            
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
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Foster</Button>
        </div>
      </form>
    </Modal>);

}