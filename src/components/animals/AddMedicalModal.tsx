import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { ProcedureType, MedicalStatus } from '../../types';
interface AddMedicalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
export function AddMedicalModal({
  isOpen,
  onClose,
  animalId
}: AddMedicalModalProps) {
  const { addMedicalRecord } = useWhisker();
  const [formData, setFormData] = useState({
    procedure_type: 'vaccine' as ProcedureType,
    procedure_name: '',
    status: 'completed' as MedicalStatus,
    performed_date: new Date().toISOString().split('T')[0],
    due_date: '',
    provider_name: '',
    notes: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMedicalRecord({
      animal_id: animalId,
      ...formData,
      performed_date:
      formData.status === 'completed' ? formData.performed_date : undefined,
      due_date: formData.status !== 'completed' ? formData.due_date : undefined
    });
    onClose();
    // Reset
    setFormData({
      procedure_type: 'vaccine',
      procedure_name: '',
      status: 'completed',
      performed_date: new Date().toISOString().split('T')[0],
      due_date: '',
      provider_name: '',
      notes: ''
    });
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
    <Modal isOpen={isOpen} onClose={onClose} title="Add Medical Record">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="procedure_type">Type</Label>
            <Select
              id="procedure_type"
              name="procedure_type"
              value={formData.procedure_type}
              onChange={handleChange}>
              
              <option value="vaccine">Vaccine</option>
              <option value="exam">Exam</option>
              <option value="spay_neuter">Spay/Neuter</option>
              <option value="medication">Medication</option>
              <option value="surgery">Surgery</option>
              <option value="microchip">Microchip</option>
              <option value="deworming">Deworming</option>
              <option value="test">Test</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}>
              
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="due">Due</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="procedure_name">Procedure Name</Label>
          <Input
            id="procedure_name"
            name="procedure_name"
            required
            value={formData.procedure_name}
            onChange={handleChange}
            placeholder="e.g. Rabies Vaccine" />
          
        </div>

        <div className="grid grid-cols-2 gap-4">
          {formData.status === 'completed' ?
          <div>
              <Label htmlFor="performed_date">Date Performed</Label>
              <DatePicker
              id="performed_date"
              value={formData.performed_date}
              onChange={(v) =>
              setFormData((prev) => ({ ...prev, performed_date: v }))
              } />

            </div> :

          <div>
              <Label htmlFor="due_date">Due Date</Label>
              <DatePicker
              id="due_date"
              value={formData.due_date}
              onChange={(v) =>
              setFormData((prev) => ({ ...prev, due_date: v }))
              } />

            </div>
          }
          <div>
            <Label htmlFor="provider_name">Provider / Clinic</Label>
            <Input
              id="provider_name"
              name="provider_name"
              value={formData.provider_name}
              onChange={handleChange}
              placeholder="e.g. Dr. Smith" />
            
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional details..." />
          
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Record</Button>
        </div>
      </form>
    </Modal>);

}