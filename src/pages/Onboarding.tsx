import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Input, Label } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { LogoHero } from '../components/ui/Logo';

// Shown when a signed-in user belongs to no organization yet (e.g. a fresh
// Google sign-up). Creating an org relies on the `add_org_creator_as_owner`
// trigger to make them the owner, so they immediately gain access.
export function Onboarding() {
  const { user, refreshOrganizations, setCurrentOrgId, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    // Use the SECURITY DEFINER RPC: it inserts the org + the creator's
    // membership in one atomic step and avoids the "new row violates RLS policy"
    // error you can hit doing a direct INSERT here.
    const { data, error } = await supabase.rpc(
      'create_organization_for_current_user',
      { p_name: name.trim() }
    );
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    await refreshOrganizations();
    if (data) setCurrentOrgId(data as string);
    // Gate will advance to the app once organizations include this one.
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <LogoHero className="w-44" />
        </div>

        <div className="bg-card rounded-2xl shadow-soft-lg border border-border p-7">
          <h1 className="text-xl font-heading font-bold text-text-primary mb-1">
            Create your organization
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            You're signed in as{' '}
            <span className="font-medium text-text-primary">
              {user?.email}
            </span>
            , but you're not part of a rescue yet. Create one to get started.
          </p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="org_name">Organization name</Label>
              <Input
                id="org_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alley Cat Project"
                required />

            </div>
            {error && <p className="text-sm text-[#9B3A3A]">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Creating…' : 'Create Organization'}
            </Button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-5">
            Joining an existing rescue? Ask an admin to invite you (invites
            coming soon).{' '}
            <button
              onClick={signOut}
              className="font-medium text-primary hover:underline">

              Sign out
            </button>
          </p>
        </div>
      </div>
    </div>);

}
