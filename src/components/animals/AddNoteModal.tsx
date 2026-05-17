import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { NoteType } from '../../types';
interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
export function AddNoteModal({ isOpen, onClose, animalId }: AddNoteModalProps) {
  const { addNote } = useWhisker();
  const [formData, setFormData] = useState({
    note_type: 'general' as NoteType,
    body: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addNote({
      animal_id: animalId,
      author_name: 'Current User',
      ...formData
    });
    onClose();
    setFormData({
      note_type: 'general',
      body: ''
    });
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Note">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="note_type">Note Type</Label>
          <Select
            id="note_type"
            name="note_type"
            value={formData.note_type}
            onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              note_type: e.target.value as NoteType
            }))
            }>
            
            <option value="general">General</option>
            <option value="behavior">Behavior</option>
            <option value="medical">Medical</option>
            <option value="foster_update">Foster Update</option>
            <option value="adoption">Adoption</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="body">Note Content</Label>
          <Textarea
            id="body"
            name="body"
            required
            rows={5}
            value={formData.body}
            onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              body: e.target.value
            }))
            }
            placeholder="Write your note here..." />
          
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Note</Button>
        </div>
      </form>
    </Modal>);

}