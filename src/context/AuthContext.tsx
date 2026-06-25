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
  /** IANA timezone (e.g. 'America/New_York'); used to render clinic dates/times. */
  timezone: string;
  /** When true, all report sections (incl. Rescue Sites + Supply spend) and
   *  supply Total Cost are visible to every member, regardless of permissions. */
  show_all_reports: boolean;
  /** Org-wide kill switch for in-app guidance banners/empty-state copy.
   *  Default true; admins turn it off on Settings. */
  show_guidance: boolean;
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
  /** Update the current org's IANA timezone (admin-gated by RLS). */
  updateOrgTimezone: (timezone: string) => Promise<void>;
  /** Toggle org-wide "Show All Reports to Everyone" (admin-gated by RLS). */
  updateOrgShowAllReports: (value: boolean) => Promise<void>;
  /** Toggle org-wide in-app guidance banners (admin-gated by RLS). */
  updateOrgShowGuidance: (value: boolean) => Promise<void>;

  /**
   * The signed-in user's `people` row id in the current org, used to attribute
   * "requested by" / "claimed by" on coordination records. Resolved (and
   * created on first use) once a user + org are known.
   */
  currentPersonId: string | null;
  /**
   * The signed-in user's `organization_members.id` in the current org. Permission
   * grants attach to this membership id (see member_permissions). Null until a
   * user + org are known.
   */
  currentMemberId: string | null;
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
  /** Sign in with a registered passkey (discoverable — no email needed). */
  signInWithPasskey: () => Promise<{ error: string | null }>;
  /** Register a passkey for the signed-in user. */
  registerPasskey: () => Promise<{ error: string | null }>;
  /** List the signed-in user's registered passkeys. */
  listPasskeys: () => Promise<{ data: PasskeyInfo[]; error: string | null }>;
  /** Delete one of the signed-in user's passkeys. */
  deletePasskey: (passkeyId: string) => Promise<{ error: string | null }>;
}

/** A registered passkey (mirrors auth-js PasskeyListItem). */
export interface PasskeyInfo {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

// WebAuthn ceremonies fail in mundane ways (user dismissed the prompt, timed
// out). Turn those into a calm message instead of a raw browser error.
function friendlyPasskeyError(message: string): string {
  if (/cancel|not allowed|timed out|abort|denied/i.test(message)) {
    return 'Passkey prompt was dismissed. Please try again.';
  }
  return message || 'Something went wrong with the passkey.';
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
    select('role, organizations ( id, name, timezone, show_all_reports, show_guidance )').
    eq('user_id', uid);
    if (!error && data) {
      const orgs: Org[] = data.
      map((row: any) => {
        // The embedded relation is many-to-one, but normalize array/object.
        const o = Array.isArray(row.organizations) ?
        row.organizations[0] :
        row.organizations;
        return o ? { id: o.id, name: o.name, role: row.role, timezone: o.timezone ?? 'America/Los_Angeles', show_all_reports: o.show_all_reports ?? false, show_guidance: o.show_guidance ?? true } : null;
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
        // Surface the reason on the no-access screen the user is about to land
        // on (e.g. signed in with an email the invite wasn't sent to). Stashed
        // here because this runs outside any page's render.
        console.error('[invites] auto-accept failed:', error.message);
        localStorage.setItem('whiskerville.pendingInviteError', error.message);
        return;
      }
      localStorage.removeItem('whiskerville.pendingInviteError');
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

  const updateOrgTimezone = useCallback(
    async (timezone: string) => {
      const orgId = currentOrg?.id;
      if (!orgId) return;
      const { error } = await supabase.
      from('organizations').
      update({ timezone }).
      eq('id', orgId);
      if (error) {
        console.error('[organizations] timezone update failed:', error.message);
        return;
      }
      await refreshOrganizations();
    },
    [currentOrg?.id, refreshOrganizations]
  );

  const updateOrgShowAllReports = useCallback(
    async (value: boolean) => {
      const orgId = currentOrg?.id;
      if (!orgId) return;
      const { error } = await supabase.
      from('organizations').
      update({ show_all_reports: value }).
      eq('id', orgId);
      if (error) {
        console.error('[organizations] show_all_reports update failed:', error.message);
        return;
      }
      await refreshOrganizations();
    },
    [currentOrg?.id, refreshOrganizations]
  );

  const updateOrgShowGuidance = useCallback(
    async (value: boolean) => {
      const orgId = currentOrg?.id;
      if (!orgId) return;
      const { error } = await supabase.
      from('organizations').
      update({ show_guidance: value }).
      eq('id', orgId);
      if (error) {
        console.error('[organizations] show_guidance update failed:', error.message);
        return;
      }
      await refreshOrganizations();
    },
    [currentOrg?.id, refreshOrganizations]
  );

  // Resolve (find-or-create) the signed-in user's person record in the org.
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const currentOrgIdResolved = currentOrg?.id ?? null;

  // Resolve the signed-in user's organization_members.id (permission grants
  // attach to it). Read-only lookup — membership is created elsewhere (invite
  // accept / onboarding), not here.
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !currentOrgIdResolved) {
        setCurrentMemberId(null);
        return;
      }
      const { data, error } = await supabase.
      from('organization_members').
      select('id').
      eq('organization_id', currentOrgIdResolved).
      eq('user_id', user.id).
      limit(1);
      if (cancelled) return;
      if (error) {
        console.error('[auth] member lookup failed:', error.message);
        return;
      }
      setCurrentMemberId(data && data.length > 0 ? data[0].id : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrgIdResolved]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !currentOrgIdResolved) {
        setCurrentPersonId(null);
        return;
      }
      // Tolerant lookup — uses `.limit(1)` instead of `.maybeSingle()`,
      // which previously raised PGRST116 when ≥2 self-rows existed and
      // caused the caller to insert yet another. Picking the oldest keeps
      // the canonical row stable even if a legacy account still has dupes.
      const { data: existingRows, error: lookupErr } = await supabase.
      from('people').
      select('id').
      eq('organization_id', currentOrgIdResolved).
      eq('user_id', user.id).
      order('created_at', { ascending: true }).
      limit(1);
      if (cancelled) return;
      if (lookupErr) {
        console.error('[auth] self-person lookup failed:', lookupErr.message);
        return;
      }
      if (existingRows && existingRows.length > 0) {
        setCurrentPersonId(existingRows[0].id);
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
      if (created) {
        setCurrentPersonId(created.id);
        return;
      }
      // Insert failed. If it lost the unique-index race against a
      // concurrent effect (PG `23505`), refetch and use whoever won.
      if (error?.code === '23505') {
        const { data: refetched } = await supabase.
        from('people').
        select('id').
        eq('organization_id', currentOrgIdResolved).
        eq('user_id', user.id).
        order('created_at', { ascending: true }).
        limit(1);
        if (cancelled) return;
        if (refetched && refetched.length > 0) {
          setCurrentPersonId(refetched[0].id);
        }
        return;
      }
      if (error) {
        console.error('[auth] self-person create failed:', error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrgIdResolved]);

  // After the user's self-record is ready, merge any operational roles the
  // admin pre-assigned on the invite. Stashed by AcceptInvitePage.
  useEffect(() => {
    if (!currentPersonId) return;
    const raw = localStorage.getItem('whiskerville.pendingInviteRoles');
    if (!raw) return;
    let pending: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pending = parsed.filter((r) => typeof r === 'string');
    } catch {
      // ignore malformed
    }
    localStorage.removeItem('whiskerville.pendingInviteRoles');
    if (pending.length === 0) return;
    (async () => {
      const { data: row, error: readErr } = await supabase.
      from('people').
      select('roles, role').
      eq('id', currentPersonId).
      maybeSingle();
      if (readErr || !row) {
        console.error(
          '[auth] could not read self-record for role merge:',
          readErr?.message
        );
        return;
      }
      const existing: string[] = Array.isArray(row.roles) ? row.roles : [];
      const merged = Array.from(new Set([...existing, ...pending]));
      if (merged.length === existing.length) return;
      const { error: writeErr } = await supabase.
      from('people').
      update({ roles: merged }).
      eq('id', currentPersonId);
      if (writeErr) {
        console.error(
          '[auth] applying invited roles failed:',
          writeErr.message
        );
      }
    })();
  }, [currentPersonId]);

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
      if (!error) return { error: null };
      // Supabase returns the generic "Invalid login credentials" for a wrong
      // email OR password; reword it to something a user understands.
      const message =
      error.message === 'Invalid login credentials' ?
      'Invalid email or password.' :
      error.message;
      return { error: message };
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

  // ── Passkeys (experimental Supabase API; enabled in lib/supabase.ts) ───────
  // On success signInWithPasskey emits SIGNED_IN, so onAuthStateChange advances
  // the gate — nothing to set here beyond surfacing an error string.
  const signInWithPasskey = useCallback(async () => {
    const { error } = await supabase.auth.signInWithPasskey();
    return { error: error ? friendlyPasskeyError(error.message) : null };
  }, []);

  const registerPasskey = useCallback(async () => {
    const { error } = await supabase.auth.registerPasskey();
    return { error: error ? friendlyPasskeyError(error.message) : null };
  }, []);

  const listPasskeys = useCallback(async () => {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) return { data: [] as PasskeyInfo[], error: error.message };
    return { data: (data ?? []) as PasskeyInfo[], error: null };
  }, []);

  const deletePasskey = useCallback(async (passkeyId: string) => {
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    return { error: error ? error.message : null };
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
        updateOrgTimezone,
        updateOrgShowAllReports,
        updateOrgShowGuidance,
        currentPersonId,
        currentMemberId,
        signInWithGoogle,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        signInWithPasskey,
        registerPasskey,
        listPasskeys,
        deletePasskey
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
