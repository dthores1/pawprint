import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Species, Sex, Priority } from '../../types';
interface AddAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const INITIAL = {
  name: '',
  species: 'Dog' as Species,
  sex: 'Unknown' as Sex,
  estimated_birth_date: '',
  intake_date: new Date().toISOString().split('T')[0],
  intake_source: '',
  status: 'intake' as AnimalStatus,
  priority: 'normal' as Priority,
  description: '',
  microchip_number: '',
  primary_photo_url: ''
};
export function AddAnimalModal({ isOpen, onClose }: AddAnimalModalProps) {
  const { addAnimal } = useWhisker();
  const [formData, setFormData] = useState(INITIAL);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAnimal(formData);
    onClose();
    setFormData(INITIAL);
  };
  const handleChange = (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>

  {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Animal">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Biscuit" />
            
          </div>
          <div>
            <Label htmlFor="species">Species</Label>
            <Select
              id="species"
              name="species"
              value={formData.species}
              onChange={handleChange}>
              
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Other">Other</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="sex">Sex</Label>
            <Select
              id="sex"
              name="sex"
              value={formData.sex}
              onChange={handleChange}>
              
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unknown">Unknown</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="estimated_birth_date">Est. Birth Date</Label>
            <Input
              id="estimated_birth_date"
              name="estimated_birth_date"
              type="date"
              required
              value={formData.estimated_birth_date}
              onChange={handleChange} />
            
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="intake_date">Intake Date</Label>
            <Input
              id="intake_date"
              name="intake_date"
              type="date"
              required
              value={formData.intake_date}
              onChange={handleChange} />
            
          </div>
          <div>
            <Label htmlFor="intake_source">Intake Source</Label>
            <Input
              id="intake_source"
              name="intake_source"
              required
              value={formData.intake_source}
              onChange={handleChange}
              placeholder="e.g. City Shelter Transfer" />
            
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="status">Initial Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}>
              
              <option value="intake">Intake</option>
              <option value="medical">Medical</option>
              <option value="hold">Hold</option>
              <option value="fostered">Fostered</option>
              <option value="adoptable">Adoptable</option>
              <option value="adopted">Adopted</option>
              <option value="hospice">Hospice</option>
              <option value="deceased">Deceased</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}>
              
              <option value="normal">Normal</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="primary_photo_url">Photo URL (optional)</Label>
          <Input
            id="primary_photo_url"
            name="primary_photo_url"
            type="url"
            value={formData.primary_photo_url}
            onChange={handleChange}
            placeholder="https://..." />
          
        </div>

        <div>
          <Label htmlFor="description">Description & Notes</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Brief description of the animal..." />
          
        </div>

        <div className="pt-5 flex justify-end gap-3 border-t border-border mt-7">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Animal</Button>
        </div>
      </form>
    </Modal>);

}