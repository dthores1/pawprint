import { useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Forms';
import { CalendarPopover } from '../ui/CalendarPopover';
import {
  SearchIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  XIcon } from
'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { OrgMember, MemberPermissionType } from '../../types';
import { isPermissionActive } from '../../lib/memberPermissionsApi';

interface GrantableMember {
  id: string;
  name: string;
  photo?: string;
}

const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };

// Search box to grant access. Only members WITHOUT the permission are offered
// (admins are always allowed and excluded by the caller).
function MemberSearchAdd({
  members,
  onAdd
}: {
  members: GrantableMember[];
  onAdd: (memberId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuWidth, setMenuWidth] = useState<number>();
  useLayoutEffect(() => {
    if (open && anchorRef.current) setMenuWidth(anchorRef.current.offsetWidth);
  }, [open]);

  const q = query.trim().toLowerCase();
  const results = members.
  filter((m) => (q ? m.name.toLowerCase().includes(q) : true)).
  slice(0, 30);

  return (
    <div className="relative" ref={anchorRef}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        type="text"
        autoComplete="off"
        placeholder="Search members to grant access…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="pl-9" />

      <CalendarPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        padded={false}>

        <div style={{ width: menuWidth }} className="max-h-60 overflow-y-auto">
          {results.length === 0 ?
          <div className="p-4 text-sm text-text-secondary text-center">
              {members.length === 0 ?
            'Everyone already has access.' :
            'No members match.'}
            </div> :

          <ul className="py-1">
              {results.map((m) =>
            <li key={m.id}>
                  <button
                type="button"
                onClick={() => {
                  onAdd(m.id);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background cursor-pointer transition-colors">

                    <Avatar
                  src={m.photo}
                  name={m.name}
                  colorKey={m.id}
                  type="person"
                  size="sm" />

                    <span className="text-sm text-text-primary truncate flex-1">
                      {m.name}
                    </span>
                    <UserPlusIcon className="w-4 h-4 text-primary shrink-0" />
                  </button>
                </li>
            )}
            </ul>
          }
        </div>
      </CalendarPopover>
    </div>);

}

interface Props {
  permissionType: MemberPermissionType;
  /** Short heading for this permission (e.g. "Animal Management"). */
  title: string;
  /** One-line explanation of what the grant lets a member do. */
  description: string;
}

/**
 * Reusable Settings section to grant/revoke one member permission. Admins/owners
 * are always allowed (shown as a badge); plain members are searchable to grant
 * and removable. Mirrors the Sites/Supply access UIs, driven by the generic
 * grantPermission/revokePermission context actions.
 */
export function MemberPermissionManager({
  permissionType,
  title,
  description
}: Props) {
  const {
    orgMembers,
    memberPermissions,
    people,
    grantPermission,
    revokePermission
  } = useWhisker();

  const personByUserId = new Map(
    people.filter((p) => p.user_id).map((p) => [p.user_id as string, p])
  );
  const hasGrant = (memberId: string) =>
  memberPermissions.some(
    (p) =>
    p.member_id === memberId &&
    p.permission_type === permissionType &&
    isPermissionActive(p)
  );
  const sortedMembers = [...orgMembers].sort((a, b) => {
    const r = (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9);
    if (r !== 0) return r;
    const pa = personByUserId.get(a.user_id);
    const pb = personByUserId.get(b.user_id);
    return `${pa?.first_name ?? ''} ${pa?.last_name ?? ''}`.localeCompare(
      `${pb?.first_name ?? ''} ${pb?.last_name ?? ''}`
    );
  });

  const memberInfo = (m: OrgMember) => {
    const p = personByUserId.get(m.user_id);
    return {
      name: p ? `${p.first_name} ${p.last_name}` : 'Pending profile',
      photo: p?.photo_url
    };
  };
  const allowedMembers = sortedMembers.filter(
    (m) => m.role === 'owner' || m.role === 'admin' || hasGrant(m.id)
  );
  const grantableMembers = sortedMembers.
  filter((m) => m.role === 'member' && !hasGrant(m.id)).
  map((m) => ({ id: m.id, ...memberInfo(m) }));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>

      <MemberSearchAdd
        members={grantableMembers}
        onAdd={(memberId) => grantPermission(memberId, permissionType)} />

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="divide-y divide-border">
          {allowedMembers.length === 0 ?
          <div className="px-5 py-6 text-center text-sm text-text-secondary">
              No one has this access yet. Search above to grant it.
            </div> :

          allowedMembers.map((m) => {
            const info = memberInfo(m);
            const isAdminRole = m.role === 'owner' || m.role === 'admin';
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                  src={info.photo}
                  name={info.name}
                  colorKey={m.user_id}
                  type="person" />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {info.name}
                    </p>
                    <p className="text-xs text-text-secondary capitalize">
                      {m.role}
                    </p>
                  </div>
                  {isAdminRole ?
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#DDEFE2] text-[#3E7B52] shrink-0">
                      <ShieldCheckIcon className="w-3.5 h-3.5" />
                      Admin · always allowed
                    </span> :

                <button
                  type="button"
                  onClick={() => revokePermission(m.id, permissionType)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-[#9B3A3A] shrink-0 transition-colors">

                      <XIcon className="w-4 h-4" />
                      Remove access
                    </button>
                }
                </div>);

          })
          }
        </div>
      </div>
    </div>);

}
