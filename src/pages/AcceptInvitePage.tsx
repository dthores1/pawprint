import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PawPrintIcon, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

const PENDING_TOKEN_KEY = 'pawprint.pendingInviteToken';

interface InviteInfo {
  invite_id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
  revoked: boolean;
}

// Public route — reachable without a session. If the visitor isn't signed in
// yet we stash the token and direct them to sign in; AuthContext consumes it
// after the user lands back. Signed-in visitors accept directly here.
export function AcceptInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, refreshOrganizations, setCurrentOrgId } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_invite_by_token', {
        p_token: token
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        setError('Invite not found.');
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setInvite(row as InviteInfo);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    if (!invite) return;
    setAccepting(true);
    setError(null);
    const { data, error } = await supabase.rpc('accept_org_invite', {
      p_token: token
    });
    if (error) {
      setError(error.message);
      setAccepting(false);
      return;
    }
    await refreshOrganizations();
    if (data) setCurrentOrgId(data as string);
    localStorage.removeItem(PENDING_TOKEN_KEY);
    setAccepted(true);
    setAccepting(false);
  };

  const stashAndSignIn = () => {
    localStorage.setItem(PENDING_TOKEN_KEY, token);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 text-primary mb-6">
          <PawPrintIcon className="w-9 h-9" />
          <span className="font-heading font-bold text-3xl tracking-tight">
            Pawprint
          </span>
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-7">
          {loading ?
          <p className="text-sm text-text-secondary text-center">
              Loading invite…
            </p> :
          error || !invite ?
          <div className="flex flex-col items-center text-center gap-3">
              <AlertCircleIcon className="w-10 h-10 text-status-urgent-text" />
              <p className="text-text-primary font-medium">
                {error ?? 'This invite is not valid.'}
              </p>
              <Link
              to="/"
              className="text-sm font-medium text-primary hover:underline">

                Go to Pawprint →
              </Link>
            </div> :
          accepted ?
          <div className="flex flex-col items-center text-center gap-3">
              <CheckCircle2Icon className="w-10 h-10 text-[#3E7B52]" />
              <h1 className="text-xl font-heading font-bold text-text-primary">
                You're in.
              </h1>
              <p className="text-sm text-text-secondary">
                You've joined{' '}
                <span className="font-medium text-text-primary">
                  {invite.organization_name}
                </span>
                .
              </p>
              <Button onClick={() => navigate('/')}>Open Pawprint</Button>
            </div> :

          <>
              <h1 className="text-xl font-heading font-bold text-text-primary mb-1">
                Join {invite.organization_name}
              </h1>
              <p className="text-sm text-text-secondary mb-6">
                You've been invited as{' '}
                <span className="font-medium text-text-primary capitalize">
                  {invite.role}
                </span>{' '}
                ({invite.email}).
              </p>

              {invite.revoked ?
            <p className="text-sm text-status-urgent-text mb-4">
                  This invite has been revoked.
                </p> :
            invite.accepted ?
            <p className="text-sm text-text-secondary mb-4">
                  This invite has already been used.
                </p> :
            new Date(invite.expires_at) < new Date() ?
            <p className="text-sm text-status-urgent-text mb-4">
                  This invite has expired.
                </p> :
            session ?
            <Button
              onClick={accept}
              disabled={accepting}
              className="w-full">

                  {accepting ? 'Accepting…' : 'Accept invite'}
                </Button> :

            <div className="space-y-3">
                  <Button onClick={stashAndSignIn} className="w-full">
                    Sign in to accept
                  </Button>
                  <p className="text-xs text-text-secondary text-center">
                    We'll bring you right back here after you sign in.
                  </p>
                </div>
            }
            </>
          }
        </div>
      </div>
    </div>);

}
