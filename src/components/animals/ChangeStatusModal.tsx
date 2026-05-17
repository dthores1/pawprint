import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus, Priority } from '../../types';
interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
  currentStatus: AnimalStatus;
  currentPriority: Priority;
}
export function ChangeStatusModal({
  isOpen,
  onClose,
  animalId,
  currentStatus,
  currentPriority
}: ChangeStatusModalProps) {
  const { updateAnimal, addNote } = useWhisker();
  const [status, setStatus] = useState<AnimalStatus>(currentStatus);
  const [priority, setPriority] = useState<Priority>(currentPriority);
  const [reason, setReason] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: string[] = [];
    if (status !== currentStatus)
    changes.push(`status: ${currentStatus} → ${status}`);
    if (priority !== currentPriority)
    changes.push(`priority: ${currentPriority} → ${priority}`);
    updateAnimal(animalId, {
      status,
      priority
    });
    if (changes.length > 0 && reason.trim()) {
      addNote({
        animal_id: animalId,
        author_name: 'Current User',
        note_type: 'general',
        body: `${changes.join(', ')}. Reason: ${reason}`
      });
    }
    onClose();
    setReason('');
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Status & Priority">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <Label htmlFor="new_status">Status</Label>
            <Select
              id="new_status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AnimalStatus)}>
              
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
            <Label htmlFor="new_priority">Priority</Label>
            <Select
              id="new_priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}>
              
              <option value="normal">Normal</option>
              <option value="needs_attention">Needs Attention</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="reason">Reason / Note (Optional)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What changed?" />
          
        </div>

        <div className="pt-5 flex justify-end gap-3 border-t border-border mt-7">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>);

}