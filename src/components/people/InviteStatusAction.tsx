import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  MailIcon,
  Send as SendIcon,
  UserPlusIcon,
  XCircleIcon } from
'lucide-react';
import { Button } from '../ui/Button';
import { InviteToAppModal } from './InviteToAppModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { useIsAdmin } from '../../lib/useIsAdmin';
import { isDemoMode } from '../../lib/appMode';
import { track } from '../../lib/analytics';
import { Person } from '../../types';

// The profile-page "Invite to Whiskerville" affordance, state-aware:
//   1. member (user_id set + present in organization_members)  → "On Whiskerville ✓" chip
//   2. live invite outstanding                                  → "Invite sent" + resend/copy/revoke menu
//   3. previously joined (user_id set but membership removed)   → "Reinvite to Whiskerville"
//   4. otherwise                                                → "Invite to Whiskerville"
// Note person.user_id alone doesn't mean *current* member — remove_member
// deletes the organization_members row but leaves user_id set — hence the
// orgMembers intersection. Admin-only, matching the invites-table RLS.

// Row read from organization_invitations. There is no status column — status
// is derived from the timestamps (same pattern as OrganizationPage).
interface InviteRow {
  id: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

function isLive(invite: InviteRow) {
  return (
    !invite.accepted_at &&
    !invite.revoked_at &&
    new Date(invite.expires_at).getTime() > Date.now());

}

export function InviteStatusAction({ person }: { person: Person }) {
  const { currentOrg } = useAuth();
  const { orgMembers } = useWhisker();
  const isAdmin = useIsAdmin();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InviteRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Transient feedback for the menu actions ("Resent ✓" / "Copied ✓").
  const [feedback, setFeedback] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const email = person.email?.trim().toLowerCase() ?? '';
  // orgMembers always includes the signed-in admin once loaded, so an empty
  // list means "still loading" — treat a linked person as a member meanwhile
  // rather than flashing "Reinvite" at every page load.
  const membersLoaded = orgMembers.length > 0;
  const isMember =
  !!person.user_id && (
  !membersLoaded || orgMembers.some((m) => m.user_id === person.user_id));
  const previouslyJoined = !!person.user_id && membersLoaded && !isMember;

  const refreshInvites = useCallback(async () => {
    // Demo mode has no Supabase; invites simply stay "none".
    if (isDemoMode || !currentOrg || !email) return;
    const { data, error } = await supabase.
    from('organization_invitations').
    select('id, role, token, expires_at, accepted_at, revoked_at').
    eq('organization_id', currentOrg.id).
    eq('email', email).
    order('created_at', { ascending: false });
    if (error) {
      console.warn('[invites] pending-invite lookup failed:', error.message);
      return;
    }
    setPendingInvite(((data as InviteRow[]) ?? []).find(isLive) ?? null);
  }, [currentOrg, email]);

  useEffect(() => {
    if (isAdmin && !isMember) refreshInvites();
  }, [isAdmin, isMember, refreshInvites]);

  // Close the actions menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const flashFeedback = (message: string) => {
    setFeedback(message);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleResend = async () => {
    if (!pendingInvite || !currentOrg) return;
    setMenuOpen(false);
    try {
      await supabase.functions.invoke('send-invite-email', {
        body: {
          token: pendingInvite.token,
          email,
          organization_name: currentOrg.name,
          role: pendingInvite.role
        }
      });
      track('app_invite_resent');
      flashFeedback('Invite email resent');
    } catch (err) {
      console.warn('[invite to Whiskerville] resend failed:', err);
      flashFeedback('Email send failed — copy the link instead');
    }
  };

  const handleCopyLink = async () => {
    if (!pendingInvite) return;
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/invite/${pendingInvite.token}`
      );
      flashFeedback('Invite link copied');
    } catch {
      flashFeedback('Copy blocked by the browser');
    }
  };

  const handleRevoke = async () => {
    if (!pendingInvite) return;
    setMenuOpen(false);
    const { error } = await supabase.rpc('revoke_org_invite', {
      p_invite_id: pendingInvite.id
    });
    if (error) {
      console.warn('[invites] revoke failed:', error.message);
      flashFeedback('Revoke failed');
      return;
    }
    track('app_invite_revoked');
    setPendingInvite(null);
  };

  if (!isAdmin) return null;

  // 1. Current member — non-interactive status chip.
  if (isMember) {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-[#DDEFE2] text-[#3E7B52]">
        <CheckCircle2Icon className="w-4 h-4" />
        On Whiskerville
      </span>);

  }

  // No email on file → nothing actionable (matches the old button's gate).
  if (!email) return null;

  // 2. Live invite outstanding — status + secondary actions menu.
  if (pendingInvite) {
    return (
      <div ref={menuRef} className="relative">
        <div className="inline-flex items-stretch rounded-lg border border-border bg-white/75 overflow-hidden">
          <span className="inline-flex items-center gap-1.5 h-8 pl-3 pr-2 text-sm font-medium text-text-secondary">
            <ClockIcon className="w-4 h-4" />
            Invite sent
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Invite actions"
            aria-expanded={menuOpen}
            className="flex items-center px-1.5 border-l border-border text-text-secondary hover:bg-background hover:text-text-primary transition-colors">

            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>
        {feedback &&
        <span className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-md bg-text-primary px-2.5 py-1.5 text-xs font-medium text-card shadow-soft z-30">
            {feedback}
          </span>
        }
        {menuOpen &&
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-card shadow-soft-lg py-1 z-30">
            <button
            type="button"
            onClick={handleResend}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-background transition-colors">

              <MailIcon className="w-4 h-4 text-text-secondary" />
              Resend invite email
            </button>
            <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-background transition-colors">

              <CopyIcon className="w-4 h-4 text-text-secondary" />
              Copy invite link
            </button>
            <button
            type="button"
            onClick={handleRevoke}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

              <XCircleIcon className="w-4 h-4" />
              Revoke invite
            </button>
          </div>
        }
      </div>);

  }

  // 3 & 4. No live invite — offer (re)invite. Closing the modal refreshes so a
  // just-sent invite immediately flips this to "Invite sent".
  return (
    <>
      <Button variant="soft" size="sm" onClick={() => setIsInviteOpen(true)}>
        {previouslyJoined ?
        <>
            <UserPlusIcon className="w-4 h-4 mr-2" /> Reinvite to Whiskerville
          </> :

        <>
            <SendIcon className="w-4 h-4 mr-2" /> Invite to Whiskerville
          </>
        }
      </Button>
      <InviteToAppModal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          refreshInvites();
        }}
        person={person} />

    </>);

}
