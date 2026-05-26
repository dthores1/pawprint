import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
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
  value: 'profile',
  label: 'Profile',
  hint: 'Featured photo for adoption listings'
},
{
  value: 'medical',
  label: 'Medical',
  hint: 'Wound, recovery, procedure'
},
{
  value: 'foster',
  label: 'Foster Update',
  hint: 'Life in foster'
},
{
  value: 'adoption',
  label: 'Adoption',
  hint: 'Going-home day'
},
{
  value: 'post_adoption',
  label: 'Post-Adoption',
  hint: 'Update from new family'
},
{
  value: 'other',
  label: 'Other',
  hint: ''
}];

export function AddPhotoModal({
  isOpen,
  onClose,
  animalId
}: AddPhotoModalProps) {
  const { addPhoto } = useWhisker();
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<PhotoCategory>('profile');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reset = () => {
    setUrl('');
    setFile(null);
    setCategory('profile');
    setCaption('');
    setUploadMode('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    // Data URL just for the preview; the actual File is uploaded on submit.
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setUrl(event.target.result);
      }
    };
    reader.readAsDataURL(selected);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'file' && !file) return;
    if (uploadMode === 'url' && !url.trim()) return;
    setSubmitting(true);
    await addPhoto({
      animal_id: animalId,
      category,
      caption: caption.trim() || undefined,
      ...(uploadMode === 'file' ?
      { file: file! } :
      { url: url.trim() })
    });
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
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">Photo Source</Label>
            <div className="flex bg-background rounded-lg p-1">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${uploadMode === 'file' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                
                <UploadIcon className="w-3.5 h-3.5" /> File
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${uploadMode === 'url' ? 'bg-white shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                
                <LinkIcon className="w-3.5 h-3.5" /> URL
              </button>
            </div>
          </div>

          {uploadMode === 'file' ?
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-background/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}>
            
              <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden" />
            
              <UploadIcon className="w-8 h-8 mx-auto text-text-secondary mb-2" />
              <p className="text-sm font-medium text-text-primary">
                Click to upload image
              </p>
              <p className="text-xs text-text-secondary mt-1">
                PNG, JPG, GIF up to 5MB
              </p>
            </div> :

          <Input
            id="photo_url"
            type="url"
            required={uploadMode === 'url'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..." />

          }
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
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
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Brief description or context…" />
          
        </div>

        {url &&
        <div>
            <Label>Preview</Label>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-background">
              {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
              <img
              src={url}
              alt="Photo preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none';
              }} />
            
            </div>
          </div>
        }

        <div className="pt-5 flex justify-end gap-3 border-t border-border mt-7">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Add Photo'}
          </Button>
        </div>
      </form>
    </Modal>);

}