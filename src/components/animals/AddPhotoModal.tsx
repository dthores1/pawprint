import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { PhotoCategory } from '../../types';
import { UploadIcon, LinkIcon } from 'lucide-react';
interface AddPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
const CATEGORIES: {
  value: PhotoCategory;
  label: string;
  hint: string;
}[] = [
{
  value: 'intake',
  label: 'Intake',
  hint: 'Day-of-arrival condition photo'
},
{
  value: 'medical',
  label: 'Medical',
  hint: 'Wound, recovery, procedure'
},
{
  value: 'general',
  label: 'General',
  hint: ''
},
{
  value: 'adoption_listing',
  label: 'Adoption Listing',
  hint: 'Featured photo for adoption listings'
}];

export function AddPhotoModal({
  isOpen,
  onClose,
  animalId
}: AddPhotoModalProps) {
  const { addPhoto } = useWhisker();
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [category, setCategory] = useState<PhotoCategory>('general');
  const [caption, setCaption] = useState('');
  const [sourceError, setSourceError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reset = () => {
    setUrl('');
    setFiles([]);
    setPreviewUrl('');
    setCategory('general');
    setCaption('');
    setSourceError(undefined);
    setUploadMode('file');
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const isMulti = files.length > 1;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFiles(selected);
    setSourceError(undefined);
    // Show a thumbnail only for the single-file case — generating data URLs
    // for many files would be heavy and the filenames already convey the set.
    if (selected.length === 1) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setPreviewUrl(event.target.result);
        }
      };
      reader.readAsDataURL(selected[0]);
    } else {
      setPreviewUrl('');
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'file' && files.length === 0) {
      setSourceError('Choose at least one image.');
      return;
    }
    if (uploadMode === 'url' && !url.trim()) {
      setSourceError('Photo URL is required.');
      return;
    }
    setSubmitting(true);
    if (uploadMode === 'file') {
      // Sequential to keep Storage happy with larger batches and to surface
      // per-file progress in the button.
      const cap = isMulti ? undefined : caption.trim() || undefined;
      setProgress({ done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        await addPhoto({
          animal_id: animalId,
          category,
          caption: cap,
          file: files[i]
        });
        setProgress({ done: i + 1, total: files.length });
      }
    } else {
      await addPhoto({
        animal_id: animalId,
        category,
        caption: caption.trim() || undefined,
        url: url.trim()
      });
    }
    setSubmitting(false);
    reset();
    onClose();
  };
  const selectedHint = CATEGORIES.find((c) => c.value === category)?.hint;
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add Photo">
      
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0" required>Photo Source</Label>
            <div className="flex bg-background rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setUploadMode('file');
                  setSourceError(undefined);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${uploadMode === 'file' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                
                <UploadIcon className="w-3.5 h-3.5" /> File
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode('url');
                  setSourceError(undefined);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${uploadMode === 'url' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                
                <LinkIcon className="w-3.5 h-3.5" /> URL
              </button>
            </div>
          </div>

          {uploadMode === 'file' ?
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center hover:bg-background/50 transition-colors cursor-pointer ${sourceError ? 'border-red-500' : 'border-border'}`}
            onClick={() => fileInputRef.current?.click()}>

              <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden" />

              <UploadIcon className="w-8 h-8 mx-auto text-text-secondary mb-2" />
              {files.length === 0 ?
            <>
                  <p className="text-sm font-medium text-text-primary">
                    Click to upload images
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    Hold ⌘ or Shift in the picker to select multiple. PNG, JPG, GIF up to 5MB each.
                  </p>
                </> :

            <>
                  <p className="text-sm font-medium text-text-primary">
                    {files.length === 1 ?
                files[0].name :
                `${files.length} images selected`}
                  </p>
                  {isMulti &&
              <ul className="text-xs text-text-secondary mt-2 space-y-0.5 max-h-20 overflow-y-auto">
                      {files.map((f, i) =>
                <li key={i} className="truncate">
                          {f.name}
                        </li>
                )}
                    </ul>
              }
                  <p className="text-xs text-text-secondary mt-2">
                    Click to choose different files.
                  </p>
                </>
            }
            </div> :

          <Input
            id="photo_url"
            type="url"
            aria-invalid={Boolean(sourceError)}
            aria-describedby={sourceError ? 'photo_source_error' : undefined}
            className={sourceError && 'border-red-500 focus:ring-red-500'}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (sourceError) setSourceError(undefined);
            }}
            placeholder="https://..." />

          }
          <FieldError id="photo_source_error">{sourceError}</FieldError>
        </div>

        <div>
          <Label htmlFor="category" required>Category</Label>
          <Select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as PhotoCategory)}>
            
            {CATEGORIES.map((c) =>
            <option key={c.value} value={c.value}>
                {c.label}
              </option>
            )}
          </Select>
          {selectedHint &&
          <p className="text-xs text-text-secondary mt-1.5">{selectedHint}</p>
          }
        </div>

        <div>
          <Label htmlFor="caption">Caption (optional)</Label>
          <Textarea
            id="caption"
            value={isMulti ? '' : caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isMulti}
            placeholder={
            isMulti ?
            'Captions are skipped for multi-image uploads.' :
            'Brief description or context…'
            } />

          {isMulti &&
          <p className="text-xs text-text-secondary mt-1.5">
              Add captions individually after upload from the photo gallery.
            </p>
          }
        </div>

        {(() => {
          const src = previewUrl || (uploadMode === 'url' ? url : '');
          if (!src) return null;
          return (
            <div>
              <Label>Preview</Label>
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-background">
                {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
                <img
                  src={src}
                  alt="Photo preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }} />

              </div>
            </div>);

        })()}

        <div className="pt-5 flex justify-end gap-3 border-t border-border mt-7">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ?
            progress && progress.total > 1 ?
            `Uploading ${progress.done}/${progress.total}…` :
            'Uploading…' :
            files.length > 1 ?
            `Add ${files.length} Photos` :
            'Add Photo'}
          </Button>
        </div>
      </form>
    </Modal>);

}