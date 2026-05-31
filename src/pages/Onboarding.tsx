import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircleIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { LogoHero } from '../components/ui/Logo';

// Shown when a signed-in user belongs to no organization yet.
//
// Self-service organization creation is intentionally disabled during the beta:
// orgs are provisioned by us (until billing/ownership/onboarding are real), and
// members join via invite. So instead of an org-creation form, this screen is
// an honest dead-end that points people to the two real paths — get invited, or
// contact us about beta access. (The `create_organization_for_current_user` RPC
// still exists; it's just no longer reachable from the UI.)

export function NoOrganizationScreen() {
  const { user, signOut } = useAuth();
  // If the user just signed in via an invite link but acceptance was rejected
  // (e.g. the invite was sent to a different email), AuthContext stashes the
  // reason. Show it once, then clear it.
  const [inviteError, setInviteError] = useState<string | null>(null);
  useEffect(() => {
    const msg = localStorage.getItem('whiskerville.pendingInviteError');
    if (msg) {
      setInviteError(msg);
      localStorage.removeItem('whiskerville.pendingInviteError');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <LogoHero className="w-44" />
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-7">
          <h1 className="text-xl font-heading font-bold text-text-primary mb-1">
            Welcome to Whiskerville
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            You're signed in as{' '}
            <span className="font-medium text-text-primary">{user?.email}</span>
            , but you don't have access to an organization yet.
          </p>

          {inviteError &&
          <div className="flex gap-2.5 mb-6 rounded-lg border border-status-urgent-bg bg-status-urgent-bg/40 p-3">
              <AlertCircleIcon className="w-4 h-4 text-status-urgent-text shrink-0 mt-0.5" />
              <p className="text-sm text-status-urgent-text">{inviteError}</p>
            </div>
          }

          <div className="space-y-4 mb-6">
            <div className="flex gap-3">
              <span className="text-secondary mt-0.5">•</span>
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  Joining an existing rescue?
                </span>{' '}
                Ask an administrator to invite you.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-secondary mt-0.5">•</span>
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  Interested in using Whiskerville for your rescue?
                </span>{' '}
                Contact us to learn about beta access.
              </p>
            </div>
          </div>

          <Link to="/request-access" className="block">
            <Button className="w-full">Contact Us</Button>
          </Link>

          <button
            onClick={signOut}
            className="w-full mt-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">

            Sign out
          </button>
        </div>
      </div>
    </div>);

}
