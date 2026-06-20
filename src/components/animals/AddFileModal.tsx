import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalFileCategory } from '../../types';
import { FILE_CATEGORY_LABELS, FILE_ACCEPT, MAX_FILE_BYTES } from '../../lib/filesApi';
import { UploadIcon } from 'lucide-react';
import { focusFirstError } from '../../lib/focusFirstError';

interface AddFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}

const CATEGORY_ORDER: AnimalFileCategory[] = [
'medical_record',
'adoption_application',
'intake_document',
'legacy_export',
'other'];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AddFileModal({ isOpen, onClose, animalId }: AddFileModalProps) {
  const { addAnimalFile } = useWhisker();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AnimalFileCategory>('medical_record');
  const [notes, setNotes] = useState('');
  const [fileError, setFileError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setCategory('medical_record');
    setNotes('');
    setFileError(undefined);
    setSubmitError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setFileError(`File is too large (${humanSize(selected.size)}). Max 25 MB.`);
      setFile(null);
      return;
    }
    setFileError(undefined);
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFileError('Choose a file to upload.');
      requestAnimationFrame(() => focusFirstError(['file_source']));
      return;
    }
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await addAnimalFile({
        animal_id: animalId,
        category,
        notes: notes.trim() || undefined,
        file
      });
      setSubmitting(false);
      close();
    } catch {
      setSubmitting(false);
      setSubmitError('Upload failed. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add File"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="add-file-form" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Add File'}
          </Button>
        </div>
      }>

      <form id="add-file-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <p className="text-sm text-text-secondary">
          Upload PDFs, forms, records, and other documents related to this animal.
        </p>

        <div id="file_source" style={{ scrollMarginTop: '1rem' }}>
          <Label className="mb-2" required>File</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center hover:bg-background/50 transition-colors cursor-pointer ${fileError ? 'border-red-500' : 'border-border'}`}
            onClick={() => fileInputRef.current?.click()}>

            <input
              type="file"
              ref={fileInputRef}
              accept={FILE_ACCEPT}
              onChange={handleFileChange}
              className="hidden" />

            <UploadIcon className="w-8 h-8 mx-auto text-text-secondary mb-2" />
            {file ?
            <>
                <p className="text-sm font-medium text-text-primary break-all">
                  {file.name}
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  {humanSize(file.size)} · Click to choose a different file.
                </p>
              </> :

            <>
                <p className="text-sm font-medium text-text-primary">
                  Click to upload a file
                </p>
                <p className="text-xs text-text-secondary mt-1">
                  PDF, image, Word, Excel, CSV, or text — up to 25 MB.
                </p>
              </>
            }
          </div>
          <FieldError id="file_source_error">{fileError}</FieldError>
        </div>

        <div>
          <Label htmlFor="file_category" required>Category</Label>
          <Select
            id="file_category"
            value={category}
            onChange={(e) => setCategory(e.target.value as AnimalFileCategory)}>

            {CATEGORY_ORDER.map((c) =>
            <option key={c} value={c}>
                {FILE_CATEGORY_LABELS[c]}
              </option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="file_notes">Notes (optional)</Label>
          <Textarea
            id="file_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Brief description or context…" />

        </div>

        {submitError && <FieldError id="file_submit_error">{submitError}</FieldError>}
      </form>
    </Modal>);

}
