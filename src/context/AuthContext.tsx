import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState } from
'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Org {
  id: string;
  name: string;
  role: string;
}
export interface AuthContextType {
  /** Initial session restore in flight. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** Org-membership fetch in flight (after a user is known). */
  orgsLoading: boolean;
  organizations: Org[];
  currentOrg: Org | null;
  setCurrentOrgId: (id: string) => void;
  refreshOrganizations: () => Promise<void>;
  /**
   * The signed-in user's `people` row id in the current org, used to attribute
   * "requested by" / "claimed by" on coordination records. Resolved (and
   * created on first use) once a user + org are known.
   */
  currentPersonId: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (
  email: string,
  password: string)
  => Promise<{ error: string | null }>;
  signUpWithPassword: (
  email: string,
  password: string,
  fullName?: string)
  => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

const CURRENT_ORG_KEY = 'whiskerville.currentOrgId';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(
    () => localStorage.getItem(CURRENT_ORG_KEY)
  );
  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // Keep the latest userId in a ref so the stable refresh callback can read it.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const refreshOrganizations = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) {
      setOrganizations([]);
      return;
    }
    setOrgsLoading(true);
    const { data, error } = await supabase.
    from('organization_members').
    select('role, organizations ( id, name )').
    eq('user_id', uid);
    if (!error && data) {
      const orgs: Org[] = data.
      map((row: any) => {
        // The embedded relation is many-to-one, but normalize array/object.
        const o = Array.isArray(row.organizations) ?
        row.organizations[0] :
        row.organizations;
        return o ? { id: o.id, name: o.name, role: row.role } : null;
      }).
      filter((o): o is Org => o !== null).
      sort((a, b) => a.name.localeCompare(b.name));
      setOrganizations(orgs);
    }
    setOrgsLoading(false);
  }, []);

  // Initial session + auth subscription.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Refetch org memberships whenever the signed-in user changes.
  useEffect(() => {
    if (userId) {
      refreshOrganizations();
    } else {
      setOrganizations([]);
    }
  }, [userId, refreshOrganizations]);

  // If the user just signed in via an invite link, consume the token stashed by
  // AcceptInvitePage: accept the invite → refresh memberships → land in the org.
  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('whiskerville.pendingInviteToken');
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc('accept_org_invite', {
        p_token: token
      });
      // Clear regardless — we don't want to retry a bad/expired token forever.
      localStorage.removeItem('whiskerville.pendingInviteToken');
      if (error) {
        console.error('[invites] auto-accept failed:', error.message);
        return;
      }
      await refreshOrganizations();
      if (data) {
        setCurrentOrgIdState(data as string);
        localStorage.setItem(CURRENT_ORG_KEY, data as string);
      }
    })();
  }, [userId, refreshOrganizations]);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(CURRENT_ORG_KEY, id);
  }, []);

  // Resolve the current org from the selection, falling back to the first.
  const currentOrg =
  organizations.find((o) => o.id === currentOrgId) ??
  organizations[0] ??
  null;

  // Resolve (find-or-create) the signed-in user's person record in the org.
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const currentOrgIdResolved = currentOrg?.id ?? null;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !currentOrgIdResolved) {
        setCurrentPersonId(null);
        return;
      }
      const { data: existing } = await supabase.
      from('people').
      select('id').
      eq('organization_id', currentOrgIdResolved).
      eq('user_id', user.id).
      maybeSingle();
      if (cancelled) return;
      if (existing) {
        setCurrentPersonId(existing.id);
        return;
      }
      // No self-record yet — create one from auth metadata.
      const meta = (user.user_metadata ?? {}) as Record<string, any>;
      const fullName: string =
      meta.full_name || meta.name || user.email?.split('@')[0] || 'Member';
      const [first, ...rest] = fullName.trim().split(/\s+/);
      const { data: created, error } = await supabase.
      from('people').
      insert({
        organization_id: currentOrgIdResolved,
        user_id: user.id,
        first_name: first || 'Member',
        last_name: rest.join(' ') || '',
        email: user.email ?? null,
        role: 'rescue_staff',
        photo_url: meta.avatar_url ?? meta.picture ?? null,
        active: true
      }).
      select('id').
      single();
      if (cancelled) return;
      if (error) {
        console.error('[auth] self-person create failed:', error.message);
      } else if (created) {
        setCurrentPersonId(created.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrgIdResolved]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      return { error: error ? error.message : null };
    },
    []
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const trimmedName = fullName?.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Stored in user_metadata so the self-person record gets a real name
        // instead of an email-derived placeholder.
        options: trimmedName ?
        { data: { full_name: trimmedName } } :
        undefined
      });
      if (error) return { error: error.message, needsConfirmation: false };
      // When email confirmation is enabled, no session is returned until the
      // user confirms via email.
      return { error: null, needsConfirmation: !data.session };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(CURRENT_ORG_KEY);
    setCurrentOrgIdState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user,
        orgsLoading,
        organizations,
        currentOrg,
        setCurrentOrgId,
        refreshOrganizations,
        currentPersonId,
        signInWithGoogle,
        signInWithPassword,
        signUpWithPassword,
        signOut
      }}>

      {children}
    </AuthContext.Provider>);

}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
