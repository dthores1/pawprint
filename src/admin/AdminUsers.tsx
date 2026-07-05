import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon, XIcon } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { Input } from '../components/ui/Forms';
import { FilterDropdown } from '../components/ui/FilterDropdown';
import { MultiFilterDropdown } from '../components/ui/MultiFilterDropdown';
import { formatDate } from '../lib/utils';
import { fetchAdminUsers, AdminUserRow } from '../lib/adminApi';

// Sign-in provider ids (auth.users app_metadata) → display labels.
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  email: 'Email',
  webauthn: 'Passkey',
  phone: 'Phone'
};

function providerLabel(provider: string): string {
  return (
    PROVIDER_LABELS[provider] ??
    provider.charAt(0).toUpperCase() + provider.slice(1));

}

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: 'bg-[#F3E4D7] text-[#B8632E]',
  admin: 'bg-[#DCEAF7] text-[#356A9A]',
  member: 'bg-[#E5E2DC] text-[#6B6B6B]'
};

function isBanned(user: AdminUserRow): boolean {
  return Boolean(
    user.banned_until && new Date(user.banned_until) > new Date()
  );
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers().
    then((rows) => {
      if (!cancelled) setUsers(rows);
    }).
    catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Login-method filter options come from the data itself, so a new provider
  // (e.g. Apple someday) shows up without a code change.
  const providerOptions = useMemo(() => {
    const seen = new Set<string>();
    (users ?? []).forEach((u) => u.providers.forEach((p) => seen.add(p)));
    return [...seen].
    sort().
    map((p) => ({ value: p, label: providerLabel(p) }));
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (q) {
        const haystack = [
        user.name ?? '',
        user.email,
        ...user.memberships.map((m) => m.org_name)].

        join(' ').
        toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (roleFilter.length > 0) {
        const roles = user.memberships.map((m) => m.role);
        const matches =
        roleFilter.some((r) => roles.includes(r)) ||
        roleFilter.includes('none') && user.memberships.length === 0;
        if (!matches) return false;
      }
      if (
      providerFilter.length > 0 &&
      !providerFilter.some((p) => user.providers.includes(p)))
      {
        return false;
      }
      if (verifiedFilter !== 'all') {
        const verified = Boolean(user.email_confirmed_at);
        if (verifiedFilter === 'verified' && !verified) return false;
        if (verifiedFilter === 'unverified' && verified) return false;
      }
      if (statusFilter !== 'all') {
        const banned = isBanned(user);
        if (statusFilter === 'active' && banned) return false;
        if (statusFilter === 'banned' && !banned) return false;
      }
      return true;
    });
  }, [
  users,
  searchQuery,
  roleFilter,
  providerFilter,
  verifiedFilter,
  statusFilter]
  );

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-text-primary font-medium">Couldn't load users.</p>
        <p className="text-sm text-text-secondary mt-1">{error}</p>
      </Card>);

  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Users
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Every account on the platform, with org membership and sign-in
          details.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search by name, email, or organization..."
          className="pl-11 h-12 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />

        {searchQuery &&
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          aria-label="Clear search">

            <XIcon className="w-4 h-4" />
          </button>
        }
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiFilterDropdown
          label="Role"
          values={roleFilter}
          onChange={setRoleFilter}
          options={[
          { value: 'owner', label: 'Owner' },
          { value: 'admin', label: 'Admin' },
          { value: 'member', label: 'Member' },
          { value: 'none', label: 'No organization' }]
          } />

        <MultiFilterDropdown
          label="Login"
          values={providerFilter}
          onChange={setProviderFilter}
          options={providerOptions} />

        <FilterDropdown
          label="Verified"
          value={verifiedFilter}
          onChange={setVerifiedFilter}
          options={[
          { value: 'all', label: 'All' },
          { value: 'verified', label: 'Verified' },
          { value: 'unverified', label: 'Unverified' }]
          } />

        <FilterDropdown
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'banned', label: 'Banned' }]
          } />

        {users &&
        <span className="ml-auto text-sm text-text-secondary">
            {filtered.length === users.length ?
          `${users.length} users` :
          `${filtered.length} of ${users.length} users`}
          </span>
        }
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Organizations</th>
                <th className="px-6 py-3 font-medium">Login</th>
                <th className="px-6 py-3 font-medium">Last Login</th>
                <th className="px-6 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users === null &&
              <tr>
                  <td colSpan={5} className="px-6 py-4">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              }
              {users !== null && filtered.length === 0 &&
              <tr>
                  <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-text-secondary">
                    No users match.
                  </td>
                </tr>
              }
              {filtered.map((user) => {
                const banned = isBanned(user);
                const unverified = !user.email_confirmed_at;
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0 align-top">

                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-text-primary">
                          {user.name ?? user.email}
                        </span>
                        {unverified &&
                        <Badge className="bg-[#F8E7C8] text-[#A36B00]">
                            Unverified
                          </Badge>
                        }
                        {banned &&
                        <Badge className="bg-[#F5D7D7] text-[#9B3A3A]">
                            Banned
                          </Badge>
                        }
                      </div>
                      {user.name &&
                      <p className="text-text-secondary text-xs mt-0.5">
                          {user.email}
                        </p>
                      }
                    </td>
                    <td className="px-6 py-3">
                      {user.memberships.length === 0 ?
                      <span className="text-text-secondary">—</span> :

                      <div className="space-y-1">
                          {user.memberships.map((m) =>
                        <div
                          key={m.org_id}
                          className="flex items-center gap-2">

                              <Link
                            to={`/orgs/${m.org_id}`}
                            className="text-text-primary hover:text-primary hover:underline">

                                {m.org_name}
                              </Link>
                              <Badge
                            className={
                            ROLE_BADGE_STYLES[m.role] ??
                            'bg-background text-text-secondary'
                            }>

                                {m.role.charAt(0).toUpperCase() +
                            m.role.slice(1)}
                              </Badge>
                              {m.is_support &&
                          <Badge className="bg-[#E8DEEC] text-[#6E4E80]">
                                  Support
                                </Badge>
                          }
                            </div>
                        )}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-3">
                      {user.providers.length === 0 ?
                      <span className="text-text-secondary">—</span> :

                      <div className="flex items-center gap-1.5 flex-wrap">
                          {user.providers.map((p) =>
                        <Badge key={p}>{providerLabel(p)}</Badge>
                        )}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                      {user.last_sign_in_at ?
                      formatDate(user.last_sign_in_at) :
                      'Never'}
                    </td>
                    <td className="px-6 py-3 text-text-secondary whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

}
