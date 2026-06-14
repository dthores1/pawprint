import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Select, Textarea, Label } from '../ui/Forms';
import { focusFirstError } from '../../lib/focusFirstError';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal, NoteType } from '../../types';
import { animalDisplayName } from '../../lib/utils';
interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
  animal: Animal;
}
export function AddNoteModal({ isOpen, onClose, animalId, animal }: AddNoteModalProps) {
  const { addNote } = useWhisker();
  const [formData, setFormData] = useState({
    note_type: 'general' as NoteType,
    body: ''
  });
  const [bodyError, setBodyError] = useState<string | undefined>();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.body.trim()) {
      setBodyError('Note content is required.');
      requestAnimationFrame(() => focusFirstError(['body']));
      return;
    }
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
    setBodyError(undefined);
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={animalDisplayName(animal) + ' | Add Note'}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-note-form">
            Add Note
          </Button>
        </div>
      }>

      <form
        id="add-note-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate>
        <div>
          <Label htmlFor="note_type" required>Note Type</Label>
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
            <option value="foster_update">Foster Update</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="body" required>Note Content</Label>
          <Textarea
            id="body"
            name="body"
            aria-invalid={Boolean(bodyError)}
            aria-describedby={bodyError ? 'body_error' : undefined}
            className={bodyError && 'border-red-500 focus:ring-red-500'}
            rows={5}
            value={formData.body}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                body: e.target.value
              }));
              if (bodyError) setBodyError(undefined);
            }}
            placeholder="Write your note here..." />
          <FieldError id="body_error">{bodyError}</FieldError>
          
        </div>
      </form>
    </Modal>);

}