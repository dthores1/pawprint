import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AddContactModal } from '../contacts/AddContactModal';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { AddressValue, Site, SiteStatus } from '../../types';
import { focusFirstError } from '../../lib/focusFirstError';
import { SITE_STATUS_META, SITE_STATUS_ORDER } from '../../lib/siteStatus';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When supplied, switches the modal to edit mode: the form is pre-populated
   * and Save calls updateSite instead of addSite.
   */
  site?: Site;
}

export function NewSiteModal({ isOpen, onClose, site }: Props) {
  const { addSite, updateSite, peopleIndex } = useWhisker();
  const { currentPersonId } = useAuth();
  const isEditMode = !!site;

  const [name, setName] = useState('');
  const [status, setStatus] = useState<SiteStatus>('reported');
  const [address, setAddress] = useState<AddressValue | null>(null);
  const [contactId, setContactId] = useState('');
  const [siteLeadId, setSiteLeadId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [isContactOpen, setIsContactOpen] = useState(false);
  // Which picker the inline "+ New Contact" flow should populate on save.
  const [contactTarget, setContactTarget] = useState<'contact' | 'lead'>('contact');

  useEffect(() => {
    if (!isOpen) return;
    if (site) {
      setName(site.name);
      setStatus(site.status);
      setAddress(site.address ?? null);
      setContactId(site.contact_id ?? '');
      setSiteLeadId(site.site_lead ?? '');
      setNotes(site.notes ?? '');
    } else {
      setName('');
      setStatus('reported');
      setAddress(null);
      setContactId('');
      // New sites default their lead to the creator (editable here).
      setSiteLeadId(currentPersonId ?? '');
      setNotes('');
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, site?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Site name is required.' });
      requestAnimationFrame(() => focusFirstError(['site_name']));
      return;
    }
    const payload = {
      name: name.trim(),
      status,
      contact_id: contactId || undefined,
      site_lead: siteLeadId || undefined,
      notes: notes.trim() || undefined,
      address
    };
    if (site) {
      updateSite(site.id, payload);
    } else {
      addSite({ ...payload, organization_id: '' });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Rescue Site' : 'New Rescue Site'}
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="site-form">
            {isEditMode ? 'Save Changes' : 'Create Site'}
          </Button>
        </div>
      }>

      <form id="site-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <Label htmlFor="site_name" required>Name</Label>
          <Input
            id="site_name"
            value={name}
            className={errors.name ? 'border-[#9B3A3A] focus:ring-[#9B3A3A]' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({});
            }}
            placeholder="e.g. North Beacon Hill Colony" />
          <FieldError>{errors.name}</FieldError>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="site_status" required>Status</Label>
            <Select
              id="site_status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SiteStatus)}>
              {SITE_STATUS_ORDER.map((s) =>
              <option key={s} value={s}>{SITE_STATUS_META[s].label}</option>
              )}
            </Select>
          </div>
          <div>
            <Label htmlFor="site_contact">Point of contact</Label>
            <PersonSearchPicker
              id="site_contact"
              people={peopleIndex}
              value={contactId}
              onChange={setContactId}
              onCreateNew={() => {
                setContactTarget('contact');
                setIsContactOpen(true);
              }}
              placeholder="Reporter, colony caretaker…" />
          </div>
        </div>

        <div>
          <Label htmlFor="site_lead">Site Lead</Label>
          <PersonSearchPicker
            id="site_lead"
            people={peopleIndex}
            value={siteLeadId}
            onChange={setSiteLeadId}
            onCreateNew={() => {
              setContactTarget('lead');
              setIsContactOpen(true);
            }}
            placeholder="Who is coordinating this site?" />
          <p className="mt-1 text-xs text-text-secondary">
            Defaults to you. Appears at the top of Site Volunteers.
          </p>
        </div>

        <div>
          <Label htmlFor="site_address">Address</Label>
          <AddressAutocomplete
            id="site_address"
            value={address}
            onChange={setAddress}
            placeholder="Start typing the site location…" />
        </div>

        <div>
          <Label htmlFor="site_notes">Notes (optional)</Label>
          <Textarea
            id="site_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Access details, feeding schedule, number of animals seen…"
            rows={3} />
        </div>
      </form>

      {/* Inline "New Contact" flow — stacks above the site form, which keeps its
          state so the new contact lands back in the Point-of-contact field. */}
      <AddContactModal
        isOpen={isContactOpen}
        defaultRoles={['community_contact']}
        onCreated={(person) =>
        contactTarget === 'lead' ?
        setSiteLeadId(person.id) :
        setContactId(person.id)
        }
        onClose={() => setIsContactOpen(false)} />
    </Modal>);

}
