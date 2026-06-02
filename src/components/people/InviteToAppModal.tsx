import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FieldError, Label, Select } from '../ui/Forms';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Person } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The contact / foster we're inviting. Their email + roles drive the form. */
  person: Person;
}

export function InviteToAppModal({ isOpen, onClose, person }: Props) {
  const { currentOrg } = useAuth();
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRole('member');
      setSubmitting(false);
      setError(null);
      setLink(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || submitting) return;
    if (!person.email) {
      setError('This contact has no email on file. Add one before inviting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_org_invite', {
      p_org_id: currentOrg.id,
      p_email: person.email,
      p_role: role,
      // Carry the existing roles forward so the invitee lands with the same
      // hat(s) the contact was already tracked under (foster_parent, etc.).
      p_person_roles: person.roles
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const token = (data as {token?: string;} | null)?.token;
    if (!token) {
      setError('Invite was created but no token was returned.');
      return;
    }
    // Best-effort email send via the edge function. If it isn't configured
    // the admin can still copy the link from the dialog.
    supabase.functions.
    invoke('send-invite-email', {
      body: {
        token,
        email: person.email,
        organization_name: currentOrg.name,
        role
      }
    }).
    catch((err) => console.warn('[invite to Whiskerville] email send failed:', err));
    setLink(`${window.location.origin}/invite/${token}`);
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; the link is still visible to copy manually
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite to Whiskerville"
      footer={
      link ?
      <div className="flex justify-end gap-3">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div> :
      <div className="flex justify-end gap-3">
            <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}>
              Cancel
            </Button>
            <Button
            type="submit"
            form="invite-to-app-form"
            disabled={submitting || !person.email}>
              {submitting ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
      }>

      {link ?
      <div className="space-y-4">
          <p className="text-sm text-text-primary">
            Invite created for{' '}
            <span className="font-medium">{person.email}</span>. They'll get
            an email if email sending is configured — otherwise share this link
            with them directly. It expires in 14 days.
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background/60">
            <code className="text-xs text-text-secondary break-all flex-1">
              {link}
            </code>
            <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0 px-2 py-1 rounded">

              {copied ?
            <>
                  <CheckIcon className="w-3.5 h-3.5" /> Copied
                </> :

            <>
                  <CopyIcon className="w-3.5 h-3.5" /> Copy
                </>
            }
            </button>
          </div>
        </div> :

      <form
        id="invite-to-app-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate>
          <p className="text-sm text-text-secondary">
            Sends an invite to{' '}
            <span className="font-medium text-text-primary">
              {person.email || '— no email on file —'}
            </span>{' '}
            for{' '}
            <span className="font-medium text-text-primary">
              {currentOrg?.name}
            </span>. When they sign up, this contact record gets linked to
            their account — no duplicate entry.
          </p>
          <div>
            <Label htmlFor="invite_role">Organization role</Label>
            <Select
            id="invite_role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>

              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
            <p className="mt-1 text-xs text-text-secondary">
              Members can do day-to-day work. Admins can also manage members,
              archive records, and edit org settings.
            </p>
          </div>
          {person.roles.length > 0 &&
        <div className="text-xs text-text-secondary">
              Roles carried over:{' '}
              <span className="font-medium text-text-primary">
                {person.roles.join(', ')}
              </span>
            </div>
        }
          {error &&
        <FieldError>{error}</FieldError>
        }
        </form>
      }
    </Modal>);

}
