import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select, Input, Textarea, Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import {
  AnimalExternalListing,
  ExternalListingProvider,
  ExternalListingStatus } from
'../../types';
import { track } from '../../lib/analytics';

const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i;

export const PROVIDER_OPTIONS: { value: ExternalListingProvider; label: string }[] = [
{ value: 'petfinder', label: 'Petfinder' },
{ value: 'adopt_a_pet', label: 'Adopt-a-Pet' },
{ value: 'rescue_website', label: 'Rescue Website' },
{ value: 'facebook', label: 'Facebook' },
{ value: 'instagram', label: 'Instagram' },
{ value: 'other', label: 'Other' }];


export const STATUS_OPTIONS: { value: ExternalListingStatus; label: string }[] = [
{ value: 'draft', label: 'Draft' },
{ value: 'published', label: 'Published' },
{ value: 'removed', label: 'Removed' },
{ value: 'unknown', label: 'Unknown' }];


interface Props {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
  /** Present → edit mode. */
  listing?: AnimalExternalListing;
}

export function AddExternalListingModal({
  isOpen,
  onClose,
  animalId,
  listing
}: Props) {
  const { addExternalListing, updateExternalListing } = useWhisker();
  const isEdit = !!listing;

  const [provider, setProvider] = useState<ExternalListingProvider>('petfinder');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ExternalListingStatus>('published');
  const [notes, setNotes] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  // (Re)hydrate whenever the modal opens or the target listing changes.
  useEffect(() => {
    if (!isOpen) return;
    setProvider(listing?.provider ?? 'petfinder');
    setUrl(listing?.url ?? '');
    setStatus(listing?.status ?? 'published');
    setNotes(listing?.notes ?? '');
    setUrlError(null);
  }, [isOpen, listing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || !URL_RE.test(trimmed)) {
      setUrlError('Enter a full link starting with http:// or https://');
      return;
    }
    if (isEdit && listing) {
      updateExternalListing(listing.id, {
        provider,
        url: trimmed,
        status,
        notes: notes.trim() || undefined
      });
    } else {
      addExternalListing({
        animal_id: animalId,
        provider,
        url: trimmed,
        status,
        notes: notes.trim() || undefined
      });
      track('external_listing_added', { platform: provider });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Listing' : 'Add Listing'}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="external-listing-form" disabled={!url.trim()}>
            {isEdit ? 'Save Listing' : 'Add Listing'}
          </Button>
        </div>
      }>

      <form id="external-listing-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="listing_provider" required>Provider</Label>
          <Select
            id="listing_provider"
            value={provider}
            onChange={(e) =>
            setProvider(e.target.value as ExternalListingProvider)
            }>

            {PROVIDER_OPTIONS.map((o) =>
            <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="listing_url" required>Listing URL</Label>
          <Input
            id="listing_url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            placeholder="https://www.petfinder.com/..."
            aria-invalid={!!urlError}
            className={urlError ? 'border-red-500 focus:ring-red-500' : undefined} />

          <FieldError id="listing_url_error">{urlError}</FieldError>
        </div>

        <div>
          <Label htmlFor="listing_status">Status</Label>
          <Select
            id="listing_status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExternalListingStatus)}>

            {STATUS_OPTIONS.map((o) =>
            <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="listing_notes">Notes (optional)</Label>
          <Textarea
            id="listing_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. posted by Maria; refreshed monthly" />

        </div>
      </form>
    </Modal>);

}
