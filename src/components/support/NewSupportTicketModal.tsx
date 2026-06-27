import React, { useEffect, useState } from 'react';
import { CheckCircle2Icon, PaperclipIcon, XIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Label, Select, Textarea } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { SupportTicketCategory } from '../../types';
import { focusFirstError } from '../../lib/focusFirstError';

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
{ value: 'bug', label: '🐞 Report a bug' },
{ value: 'feature', label: '💡 Suggest a feature' },
{ value: 'question', label: '❓ Contact support' }];

const TITLE: Record<SupportTicketCategory, string> = {
  bug: 'Report a Bug',
  feature: 'Suggest a Feature',
  question: 'Contact Support'
};

// 25 MB — matches the support-attachments bucket cap.
const MAX_FILE_BYTES = 26214400;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Preselected category when opened from a specific Support card. */
  category?: SupportTicketCategory;
}
export function NewSupportTicketModal({ isOpen, onClose, category: initial }: Props) {
  const { addSupportTicket } = useWhisker();
  const [category, setCategory] = useState<SupportTicketCategory>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [subjectError, setSubjectError] = useState<string | undefined>();
  const [descError, setDescError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategory(initial ?? 'bug');
    setSubject('');
    setDescription('');
    setSteps('');
    setFile(null);
    setSubjectError(undefined);
    setDescError(undefined);
    setFileError(undefined);
    setFormError(undefined);
    setDone(false);
  }, [isOpen, initial]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) {
      setFileError('File is too large (max 25 MB).');
      setFile(null);
      return;
    }
    setFileError(undefined);
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let bad = false;
    if (!subject.trim()) {
      setSubjectError('A short subject is required.');
      bad = true;
    }
    if (!description.trim()) {
      setDescError('Please describe the issue.');
      bad = true;
    }
    if (bad) {
      requestAnimationFrame(() => focusFirstError(['support_subject', 'support_description']));
      return;
    }
    setSubmitting(true);
    setFormError(undefined);
    const error = await addSupportTicket({
      category,
      subject: subject.trim(),
      description: description.trim(),
      steps_to_reproduce: category === 'bug' ? steps.trim() || undefined : undefined,
      file: file ?? undefined
    });
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    setDone(true);
  };

  // Confirmation state — reassures the user the report wasn't lost.
  if (done) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={TITLE[category]}>
        <div className="py-6 text-center space-y-3">
          <CheckCircle2Icon className="w-12 h-12 text-primary mx-auto" />
          <h3 className="font-heading font-semibold text-lg text-text-primary">
            Thanks — we’ve got it.
          </h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Your request has been logged and the support team has been notified.
            You can track its status under <strong>My Support Requests</strong>.
          </p>
          <div className="pt-2">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>);

  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={TITLE[category]}
      footer={
      <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-text-secondary">
            Your browser, current page, and app version are attached automatically.
          </span>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="support-form" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      }>

      <form id="support-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="support_category" required>Type</Label>
          <Select
            id="support_category"
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}>
            {CATEGORIES.map((c) =>
            <option key={c.value} value={c.value}>{c.label}</option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="support_subject" required>Subject</Label>
          <Input
            id="support_subject"
            aria-invalid={Boolean(subjectError)}
            className={subjectError && 'border-red-500 focus:ring-red-500'}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (subjectError) setSubjectError(undefined);
            }}
            placeholder={
            category === 'feature' ?
            'e.g. Add a bulk-print option for clinic sheets' :
            'e.g. Medical tab doesn’t load on a foster’s account'
            } />
          <FieldError id="support_subject_error">{subjectError}</FieldError>
        </div>

        <div>
          <Label htmlFor="support_description" required>
            {category === 'feature' ? 'What would you like to see?' : 'Description'}
          </Label>
          <Textarea
            id="support_description"
            rows={4}
            aria-invalid={Boolean(descError)}
            className={descError && 'border-red-500 focus:ring-red-500'}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (descError) setDescError(undefined);
            }}
            placeholder={
            category === 'feature' ?
            'Describe the feature and how it would help your rescue.' :
            'What happened? What did you expect to happen instead?'
            } />
          <FieldError id="support_description_error">{descError}</FieldError>
        </div>

        {category === 'bug' &&
        <div>
            <Label htmlFor="support_steps">Steps to reproduce</Label>
            <Textarea
            id="support_steps"
            rows={3}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder={'1. Go to…\n2. Click…\n3. Notice that…'} />
            <p className="mt-1.5 text-xs text-text-secondary">
              Optional, but it helps us reproduce the issue faster.
            </p>
          </div>
        }

        <div>
          <Label htmlFor="support_file">Screenshot or file</Label>
          {file ?
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <span className="flex items-center gap-2 min-w-0 text-sm text-text-primary">
                <PaperclipIcon className="w-4 h-4 text-text-secondary shrink-0" />
                <span className="truncate">{file.name}</span>
              </span>
              <button
              type="button"
              aria-label="Remove file"
              onClick={() => setFile(null)}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-card transition-colors shrink-0">
                <XIcon className="w-4 h-4" />
              </button>
            </div> :

          <label
            htmlFor="support_file"
            className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-text-secondary hover:border-primary hover:text-primary transition-colors">
              <PaperclipIcon className="w-4 h-4" />
              Attach a screenshot or file (optional)
            </label>
          }
          <input
            id="support_file"
            type="file"
            className="sr-only"
            onChange={onPickFile} />
          <FieldError id="support_file_error">{fileError}</FieldError>
        </div>

        <FieldError id="support_form_error">{formError}</FieldError>
      </form>
    </Modal>);

}
