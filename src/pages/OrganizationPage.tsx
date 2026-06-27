import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWhisker } from '../context/WhiskerContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select, Label, FieldError } from '../components/ui/Forms';
import { Avatar } from '../components/ui/Avatar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { RolesPickerPopover } from '../components/ui/RolesPickerPopover';
import { PersonRole } from '../types';
import {
  UsersIcon,
  MailIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  BuildingIcon,
  EyeIcon,
  TrashIcon } from
'lucide-react';
import { formatDate } from '../lib/utils';

type OrgRole = 'owner' | 'admin' | 'member';

interface OrgMember {
  id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function inviteStatus(
inv: Invite)
: 'pending' | 'accepted' | 'revoked' | 'expired' {
  if (inv.revoked_at) return 'revoked';
  if (inv.accepted_at) return 'accepted';
  if (new Date(inv.expires_at) < new Date()) return 'expired';
  return 'pending';
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-status-medical-bg text-status-medical-text',
  accepted: 'bg-status-adoptable-bg text-status-adoptable-text',
  revoked: 'bg-status-intake-bg text-status-intake-text',
  expired: 'bg-status-intake-bg text-status-intake-text'
};

export function OrganizationPage() {
  const { currentOrg, user, canViewAs, viewAsMember } = useAuth();
  const { people } = useWhisker();
  const isAdmin = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [personRoles, setPersonRoles] = useState<PersonRole[]>([]);
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  // Pending destructive actions, surfaced through ConfirmDialog.
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const [removingMember, setRemovingMember] = useState<OrgMember | null>(null);

  const loadMembers = useCallback(async () => {
    if (!currentOrg) {
      setMembers([]);
      return;
    }
    const { data, error } = await supabase.
    from('organization_members').
    select('id, user_id, role, created_at').
    eq('organization_id', currentOrg.id).
    order('created_at', { ascending: true });
    if (error) {
      console.error('[members] load failed:', error.message);
    } else {
      setMembers((data ?? []) as OrgMember[]);
    }
  }, [currentOrg]);

  const loadInvites = useCallback(async () => {
    if (!currentOrg || !isAdmin) {
      setInvites([]);
      return;
    }
    setInvitesLoading(true);
    const { data, error } = await supabase.
    from('organization_invitations').
    select(
      'id, email, role, token, expires_at, accepted_at, revoked_at, created_at'
    ).
    eq('organization_id', currentOrg.id).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[invites] load failed:', error.message);
    } else {
      setInvites((data ?? []) as Invite[]);
    }
    setInvitesLoading(false);
  }, [currentOrg, isAdmin]);

  useEffect(() => {
    loadInvites();
    loadMembers();
  }, [loadInvites, loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    if (!email.trim()) {
      setFormError('Email is required.');
      return;
    }
    setSubmitting(true);
    setFormError(undefined);
    const { data, error } = await supabase.rpc('create_org_invite', {
      p_org_id: currentOrg.id,
      p_email: email.trim(),
      p_role: role,
      p_person_roles: personRoles
    });
    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }
    // Best-effort: send the invite email via the edge function if deployed. If
    // it isn't configured the inviter can still copy the link manually.
    const token = (data as { token?: string } | null)?.token;
    if (token) {
      supabase.functions.
      invoke('send-invite-email', {
        body: {
          token,
          email: email.trim(),
          organization_name: currentOrg.name,
          role
        }
      }).
      catch((err) => console.warn('[invites] email send failed:', err));
    }
    setEmail('');
    setRole('member');
    setPersonRoles([]);
    await loadInvites();
    setSubmitting(false);
  };

  const copyLink = async (inv: Invite) => {
    const url = `${window.location.origin}/invite/${inv.token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback: select-and-copy is browser-dependent; ignore.
    }
    setCopiedId(inv.id);
    setTimeout(
      () => setCopiedId((cur) => (cur === inv.id ? null : cur)),
      2000
    );
  };

  const revoke = async (inv: Invite) => {
    const { error } = await supabase.rpc('revoke_org_invite', {
      p_invite_id: inv.id
    });
    if (error) {
      console.error('[invites] revoke failed:', error.message);
      return;
    }
    loadInvites();
  };

  const changeMemberRole = async (member: OrgMember, next: OrgRole) => {
    setMemberActionError(null);
    const { error } = await supabase.rpc('update_member_role', {
      p_member_id: member.id,
      p_role: next
    });
    if (error) {
      setMemberActionError(error.message);
      return;
    }
    loadMembers();
  };
  const removeMember = async (member: OrgMember) => {
    setMemberActionError(null);
    const { error } = await supabase.rpc('remove_member', {
      p_member_id: member.id
    });
    if (error) {
      setMemberActionError(error.message);
      return;
    }
    loadMembers();
  };

  const personByUserId = new Map(
    people.filter((p) => p.user_id).map((p) => [p.user_id as string, p])
  );
  const pendingInvites = invites.filter((i) => inviteStatus(i) === 'pending');
  const historyInvites = invites.filter((i) => inviteStatus(i) !== 'pending');

  if (!currentOrg) {
    return (
      <div className="p-8 text-center text-text-secondary">
        No organization loaded.
      </div>);

  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Members
        </h1>
        <p className="text-text-secondary mt-1 flex items-center gap-2">
          <BuildingIcon className="w-4 h-4" />
          {currentOrg.name}
        </p>
      </div>

      {/* Invite Member */}
      {isAdmin &&
      <Card className="p-6">
          <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
            <MailIcon className="w-5 h-5 text-primary" />
            Invite a member
          </h2>
          <form onSubmit={handleInvite} className="space-y-4">
            {/* Email + Permission share one visual field. The native select
                lives flush inside the input on the right with a subtle
                divider, so the form reads as "what email, what level" in a
                single glance. `pr-32` reserves room for the select; if the
                Member/Admin label ever grows past that we'll widen it. */}
            <div>
              <Label htmlFor="invite_email">Email</Label>
              <div className="relative">
                <Input
                  id="invite_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rescue.org"
                  className="pr-32" />

                <div className="absolute inset-y-1 right-1 flex items-center">
                  <div className="h-full w-px bg-border mr-1" />
                  <select
                    aria-label="Permission level"
                    value={role}
                    onChange={(e) =>
                    setRole(e.target.value as 'member' | 'admin')
                    }
                    className="h-full pl-2 pr-7 text-sm font-medium text-text-primary bg-transparent border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-primary rounded-md
                       bg-[length:0.65em_0.65em] bg-no-repeat bg-[right_0.5rem_center]
                       bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')]">

                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="invite_op_roles">
                Operational Roles (optional)
              </Label>
              <RolesPickerPopover
                id="invite_op_roles"
                value={personRoles}
                onChange={setPersonRoles} />

              <p className="text-xs text-text-secondary mt-1.5">
                Pre-assign hats the invitee should wear (foster parent,
                trapper, etc.). Applied to their profile when they accept.
              </p>
            </div>

            <FieldError>{formError}</FieldError>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Create Invite'}
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              Creates a single-use invite link valid for 14 days. We'll try to
              email it to them — and you can always copy the link from the list
              below as a fallback.
            </p>
          </form>
        </Card>
      }

      {/* Pending invites */}
      {isAdmin &&
      <Card className="p-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            Pending invites
          </h2>
          {invitesLoading ?
        <p className="text-sm text-text-secondary">Loading invites…</p> :
        pendingInvites.length === 0 ?
        <p className="text-sm text-text-secondary">No pending invites.</p> :

        <div className="space-y-2">
              {pendingInvites.map((inv) =>
          <div
            key={inv.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">

                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {inv.role} · invitation will expire on{' '}
                      {formatDate(inv.expires_at.split('T')[0])}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                size="sm"
                variant="soft"
                onClick={() => copyLink(inv)}>

                      {copiedId === inv.id ?
                <>
                          <CheckIcon className="w-4 h-4 mr-1.5" />
                          Copied
                        </> :

                <>
                          <CopyIcon className="w-4 h-4 mr-1.5" />
                          Copy link
                        </>
                }
                    </Button>
                    <Button
                size="sm"
                variant="ghost"
                onClick={() => setRevoking(inv)}
                className="text-[#9B3A3A] hover:bg-[#F5D7D7]/60 hover:text-[#9B3A3A]">

                      <XIcon className="w-4 h-4 mr-1.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
          )}
            </div>
        }
        </Card>
      }

      {/* Invite history */}
      {isAdmin && historyInvites.length > 0 &&
      <Card className="p-6">
          <h2 className="text-lg font-heading font-bold mb-4">
            Invite history
          </h2>
          <div className="space-y-2">
            {historyInvites.map((inv) => {
            const s = inviteStatus(inv);
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">

                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {inv.role} ·{' '}
                      {formatDate(inv.created_at.split('T')[0])}
                    </p>
                  </div>
                  <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[s]}`}>

                    {s}
                  </span>
                </div>);

          })}
          </div>
        </Card>
      }

      {/* Members */}
      <Card className="p-6">
        <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-primary" />
          Members
        </h2>
        {memberActionError &&
        <FieldError>{memberActionError}</FieldError>
        }
        {members.length === 0 ?
        <p className="text-sm text-text-secondary">No members yet.</p> :

        <div className="space-y-2">
            {members.map((m) => {
            const p = personByUserId.get(m.user_id);
            const name = p ?
            `${p.first_name} ${p.last_name}` :
            'Pending profile';
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">

                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                  src={p?.photo_url}
                  name={name}
                  colorKey={m.user_id}
                  type="person" />

                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {name}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {p?.email ?? 'No profile yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canViewAs && m.user_id !== user?.id &&
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                    viewAsMember({
                      memberId: m.id,
                      userId: m.user_id,
                      role: m.role,
                      personId: p?.id ?? null,
                      name
                    })
                    }
                    aria-label={`View as ${name}`}>

                        <EyeIcon className="w-4 h-4 mr-1.5" /> View as
                      </Button>
                  }
                    {isAdmin ?
                  <Select
                    value={m.role}
                    onChange={(e) =>
                    changeMemberRole(m, e.target.value as OrgRole)
                    }
                    className="text-sm">

                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </Select> :

                  <span className="text-sm text-text-secondary capitalize">
                        {m.role}
                      </span>
                  }
                    {isAdmin &&
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemovingMember(m)}
                    className="text-[#9B3A3A] hover:bg-[#F5D7D7]/60 hover:text-[#9B3A3A]"
                    aria-label={`Remove ${name}`}>

                        <TrashIcon className="w-4 h-4" />
                      </Button>
                  }
                  </div>
                </div>);

          })}
          </div>
        }
        {!isAdmin &&
        <p className="text-xs text-text-secondary mt-4">
            Only admins can invite new members.
          </p>
        }
      </Card>

      {revoking &&
      <ConfirmDialog
        isOpen={true}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          revoke(revoking);
          setRevoking(null);
        }}
        title="Revoke invite?"
        confirmLabel="Revoke"
        cancelLabel="Keep"
        tone="danger">

          The invite for {revoking.email} will no longer be usable.
        </ConfirmDialog>
      }
      {removingMember &&
      <ConfirmDialog
        isOpen={true}
        onClose={() => setRemovingMember(null)}
        onConfirm={() => {
          removeMember(removingMember);
          setRemovingMember(null);
        }}
        title="Remove member?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        tone="danger">

          {(() => {
            const person = people.find(
              (p) => p.user_id === removingMember.user_id
            );
            const label = person ?
            `${person.first_name} ${person.last_name}` :
            'This member';
            return `${label} will lose access to this organization.`;
          })()}
        </ConfirmDialog>
      }
    </div>);

}
