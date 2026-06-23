import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Body copy / rich content. */
  children: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the confirm button red (destructive actions). */
  tone?: 'default' | 'danger';
}

// Reusable confirmation modal built on the Modal primitive — replaces
// window.confirm() for a polished, on-brand confirm step.
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default'
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}>

            {confirmLabel}
          </Button>
        </div>
      }>

      <div className="text-sm text-text-secondary leading-relaxed">
        {children}
      </div>
    </Modal>);

}
