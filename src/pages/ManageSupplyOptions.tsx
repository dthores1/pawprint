import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Forms';
import { CalendarPopover } from '../components/ui/CalendarPopover';
import { AddProductModal } from '../components/supplies/AddProductModal';
import {
  ArrowLeftIcon,
  PlusIcon,
  PackageIcon,
  Edit2Icon,
  Trash2Icon,
  ShieldCheckIcon,
  SearchIcon,
  UserPlusIcon,
  XIcon,
  LockIcon } from
'lucide-react';
import { cn } from '../lib/utils';
import { Product, ProductCategory, OrgMember } from '../types';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';
import { useCanManageSupplyRequests } from '../lib/useSupplyPermissions';
import { isPermissionActive } from '../lib/memberPermissionsApi';

interface GrantableMember {
  id: string;
  name: string;
  photo?: string;
}

// Search box to grant fulfillment access. Only members WITHOUT access are
// offered (admins are always allowed and excluded by the caller), so large
// rosters stay manageable. Results render in a portal popover.
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
    <div className="relative max-w-md" ref={anchorRef}>
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

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  food: 'Food',
  litter: 'Litter',
  medical: 'Medical',
  bedding: 'Bedding',
  enrichment: 'Enrichment',
  cleaning: 'Cleaning',
  other: 'Other'
};
const CATEGORY_TONE: Record<ProductCategory, string> = {
  food: 'bg-[#DDEFE2] text-[#3E7B52]',
  litter: 'bg-[#E5E2DC] text-[#6B6B6B]',
  medical: 'bg-[#F8E7C8] text-[#A36B00]',
  bedding: 'bg-[#DCEAF7] text-[#356A9A]',
  enrichment: 'bg-[#E8DEEC] text-[#6E4E80]',
  cleaning: 'bg-[#F3E4D7] text-[#B8632E]',
  other: 'bg-background text-text-secondary border border-border'
};

const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };

export function ManageSupplyOptions() {
  const canManage = useCanManageSupplyRequests();
  const {
    products,
    updateProduct,
    orgMembers,
    memberPermissions,
    people,
    grantSupplyPermission,
    revokeSupplyPermission
  } = useWhisker();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState<Product | null>(null);
  const canArchive = useCanArchive('products', { id: 'na' });

  const backLink = (
    <Link
      to="/requests"
      className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

      <ArrowLeftIcon className="w-4 h-4" /> Back to Supply Requests
    </Link>);


  if (!canManage) {
    return (
      <div className="space-y-6 pb-8">
        {backLink}
        <Card className="p-10 text-center">
          <LockIcon className="w-10 h-10 mx-auto mb-3 text-text-secondary/40" />
          <p className="font-medium text-text-primary mb-1">
            Access restricted
          </p>
          <p className="text-sm text-text-secondary">
            Only admins and members with fulfillment access can manage supply
            options.
          </p>
        </Card>
      </div>);

  }

  const sorted = [...products].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const personByUserId = new Map(
    people.filter((p) => p.user_id).map((p) => [p.user_id as string, p])
  );
  const hasGrant = (memberId: string) =>
  memberPermissions.some(
    (p) =>
    p.member_id === memberId &&
    p.permission_type === 'MANAGE_SUPPLY_REQUESTS' &&
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
  // The roster can be huge, so we never list everyone: only those WITH access
  // (admins + granted members), and a search to add the rest.
  const allowedMembers = sortedMembers.filter(
    (m) => m.role === 'owner' || m.role === 'admin' || hasGrant(m.id)
  );
  const grantableMembers = sortedMembers.
  filter((m) => m.role === 'member' && !hasGrant(m.id)).
  map((m) => ({ id: m.id, ...memberInfo(m) }));

  return (
    <div className="space-y-8 pb-8">
      {backLink}

      <div>
        <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
          <PackageIcon className="w-8 h-8 text-[#D98C5F]" />
          Manage Supply Options
        </h1>
      </div>

      {/* ── Supply Options ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-heading font-bold text-text-primary">
              Supply Options
            </h2>
            <p className="text-text-secondary text-sm mt-0.5">
              Common items and categories available when members request supplies.
            </p>
          </div>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Add Product
          </Button>
        </div>

        {sorted.length === 0 ?
        <Card className="p-10 text-center text-text-secondary">
            <PackageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-text-primary mb-1">No products yet</p>
            <p className="text-sm">
              Add the items your org commonly requests so they're one click away.
            </p>
          </Card> :

        <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {sorted.map((p) =>
            <div
              key={p.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-background/40 transition-colors">

                  <div className="flex-1 min-w-0">
                    <p
                  className={cn(
                    'font-medium truncate',
                    p.active ? 'text-text-primary' : 'text-text-secondary'
                  )}>

                      {p.name}
                      {!p.active &&
                  <span className="ml-2 text-xs text-text-secondary">
                          (inactive)
                        </span>
                  }
                    </p>
                    <p className="text-xs text-text-secondary">
                      Default unit: {p.default_unit}
                    </p>
                  </div>
                  <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0',
                  CATEGORY_TONE[p.category]
                )}>

                    {CATEGORY_LABEL[p.category]}
                  </span>
                  <button
                type="button"
                onClick={() => updateProduct(p.id, { active: !p.active })}
                className="text-xs font-medium text-primary hover:underline shrink-0 w-20 text-right">

                    {p.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                type="button"
                onClick={() => setEditing(p)}
                aria-label={`Edit ${p.name}`}
                className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors shrink-0">

                    <Edit2Icon className="w-4 h-4" />
                  </button>
                  {canArchive &&
                <button
                  type="button"
                  onClick={() => setArchiving(p)}
                  aria-label={`Archive ${p.name}`}
                  className="p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors shrink-0">

                      <Trash2Icon className="w-4 h-4" />
                    </button>
                }
                </div>
            )}
            </div>
          </Card>
        }
      </section>

      {/* ── Fulfillment Access ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-text-primary">
            Fulfillment Access
          </h2>
          <p className="text-text-secondary text-sm mt-0.5">
            Choose which members can approve and fulfill supply requests. Admins
            and owners can always process requests.
          </p>
        </div>

        {/* Search to grant access — only non-admin members without it appear. */}
        <MemberSearchAdd members={grantableMembers} onAdd={grantSupplyPermission} />

        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {allowedMembers.length === 0 ?
            <div className="px-5 py-8 text-center text-sm text-text-secondary">
                No one has fulfillment access yet. Search above to grant it to a
                member.
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
                    onClick={() => revokeSupplyPermission(m.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-[#9B3A3A] shrink-0 transition-colors">

                        <XIcon className="w-4 h-4" />
                        Remove access
                      </button>
                  }
                  </div>);

            })
            }
          </div>
        </Card>
      </section>

      <AddProductModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)} />

      <AddProductModal
        isOpen={editing !== null}
        product={editing}
        onClose={() => setEditing(null)} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="products"
        id={archiving.id}
        typeLabel="product"
        entityLabel={archiving.name} />
      }
    </div>);

}
