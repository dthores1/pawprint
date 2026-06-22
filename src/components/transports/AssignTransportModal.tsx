import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { useWhisker } from '../../context/WhiskerContext';
import { focusFirstError } from '../../lib/focusFirstError';
import { TransportRequest } from '../../types';

interface AssignTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TransportRequest;
}

// Coordinator assigns (or reassigns) a transport request to a specific
// volunteer, who then accepts or declines. Setting the assignee fires the
// existing notify_transport_assignment() trigger so the volunteer is notified.
export function AssignTransportModal({
  isOpen,
  onClose,
  request
}: AssignTransportModalProps) {
  const { peopleIndex: people, assignTransportRequest } = useWhisker();
  const isReassign = Boolean(request.assigned_volunteer_person_id);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isOpen) {
      setSelectedId('');
      setError(undefined);
      return;
    }
    // Prefill the current assignee when reassigning.
    setSelectedId(request.assigned_volunteer_person_id ?? '');
  }, [isOpen, request.assigned_volunteer_person_id]);

  // Active directory contacts and app users — anyone who could drive. Exclude
  // the requester so a request isn't directed back at the person who raised it.
  const candidates = people.filter(
    (p) => p.active !== false && p.id !== request.requested_by_person_id
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Select a volunteer to assign.');
      requestAnimationFrame(() => focusFirstError(['assign_volunteer']));
      return;
    }
    assignTransportRequest(request.id, selectedId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReassign ? 'Reassign Transport' : 'Assign Transport'}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-transport-form">
            {isReassign ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      }>

      <form id="assign-transport-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          Direct this request to a specific volunteer. They’ll be notified and can
          accept or decline.
        </p>
        <div id="assign_volunteer" style={{ scrollMarginTop: '1rem' }}>
          <Label required>Volunteer</Label>
          <PersonSearchPicker
            people={candidates}
            value={selectedId}
            onChange={(id) => {
              setSelectedId(id);
              setError(undefined);
            }}
            placeholder="Search volunteers by name or email…" />

        </div>
        {error && <FieldError>{error}</FieldError>}
      </form>
    </Modal>);

}
