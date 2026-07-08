import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Forms';
import { AddressDisplay } from '../components/ui/AddressDisplay';
import { SiteMap } from '../components/sites/SiteMap';
import { SiteVolunteersCard } from '../components/sites/SiteVolunteersCard';
import { NewSiteModal } from '../components/sites/NewSiteModal';
import { AddAnimalModal } from '../components/animals/AddAnimalModal';
import {
  ArrowLeftIcon,
  MapPinnedIcon,
  PlusIcon,
  Edit2Icon,
  Trash2Icon,
  UserIcon,
  UserPlusIcon,
  LogOutIcon,
  CheckIcon,
  NavigationIcon,
  StickyNoteIcon,
  PawPrintIcon } from
'lucide-react';
import { cn, animalDisplayName, formatDateLong } from '../lib/utils';
import { track } from '../lib/analytics';
import { SITE_STATUS_META } from '../lib/siteStatus';
import { useCanManageSites } from '../lib/useSitePermissions';
import { useAuth } from '../context/AuthContext';
import { useUserLocation, haversineMiles, formatDistance } from '../lib/geo';

export function SiteProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    sites,
    animalsIndex,
    peopleIndex,
    siteNotes,
    siteVolunteers,
    addSiteNote,
    addSiteVolunteer,
    removeSiteVolunteer,
    deleteSite
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const canManage = useCanManageSites();
  const { location } = useUserLocation();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [addAnimalMode, setAddAnimalMode] = useState<null | 'single' | 'litter'>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  // The note composer is hidden until "+ Note" is clicked (matches Animal/Litter).
  const [isAddingNote, setIsAddingNote] = useState(false);

  const site = sites.find((s) => s.id === id);

  const linkedAnimals = useMemo(
    () => animalsIndex.filter((a) => a.site_id === id),
    [animalsIndex, id]
  );

  if (!site) {
    return (
      <div className="space-y-6 pb-8">
        <Link
          to="/sites"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Rescue Sites
        </Link>
        <Card className="p-12 text-center text-text-secondary">
          <MapPinnedIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">Site not found</p>
          <p className="text-sm">It may have been removed.</p>
        </Card>
      </div>);

  }

  const meta = SITE_STATUS_META[site.status];
  const contact = site.contact_id ?
  peopleIndex.find((p) => p.id === site.contact_id) :
  null;

  // Colony breakdown by lifecycle: Released / Adopted are terminal outcomes;
  // "Still in Care" is everything not released/adopted/deceased.
  const total = linkedAnimals.length;
  const released = linkedAnimals.filter((a) => a.status === 'released').length;
  const adopted = linkedAnimals.filter((a) => a.status === 'adopted').length;
  const stillInCare = linkedAnimals.filter(
    (a) => !['released', 'adopted', 'deceased'].includes(a.status)
  ).length;

  const dist =
  location && site.address?.latitude != null && site.address?.longitude != null ?
  haversineMiles(location, {
    lat: site.address.latitude,
    lng: site.address.longitude
  }) :
  null;

  const siteNotesForSite = siteNotes.
  filter((n) => n.site_id === site.id).
  sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  // Prefer the author's profile name (resolved from their account record) over
  // the stored fallback (email / "Team member").
  const noteAuthorName = (createdBy?: string, fallback?: string) => {
    const person = createdBy ?
    peopleIndex.find((p) => p.user_id === createdBy) :
    null;
    return person ?
    `${person.first_name} ${person.last_name}`.trim() :
    fallback ?? 'Unknown';
  };

  const handleAddNote = () => {
    if (!noteBody.trim()) return;
    addSiteNote({ site_id: site.id, body: noteBody.trim() });
    track('site_note_added', { site_id: site.id });
    setNoteBody('');
    setIsAddingNote(false);
  };

  const handleDelete = async () => {
    await deleteSite(site.id);
    navigate('/sites');
  };

  // Join / leave — available to everyone, independent of MANAGE_SITES. The Site
  // Lead is implicitly volunteering and can't "leave" via this button.
  const isLead = !!currentPersonId && site.site_lead === currentPersonId;
  const myVolunteerRow = currentPersonId ?
  siteVolunteers.find(
    (v) => v.site_id === site.id && v.contact_id === currentPersonId
  ) :
  undefined;
  const handleJoin = () => {
    if (!currentPersonId) return;
    addSiteVolunteer({ site_id: site.id, contact_id: currentPersonId });
  };
  const handleLeave = () => {
    if (myVolunteerRow) removeSiteVolunteer(myVolunteerRow.id);
  };

  return (
    <div className="space-y-6 pb-8">
      <Link
        to="/sites"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Rescue Sites
      </Link>

      {/* — Header — */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPinnedIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-text-primary">
              {site.name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  meta.tone
                )}>
                {meta.label}
              </span>
              <span className="text-xs text-text-secondary">{meta.description}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Join / Leave — anyone can volunteer, no permissions required. */}
          {currentPersonId && (
          isLead ?
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#DDEFE2] text-[#3E7B52]">
              <CheckIcon className="w-4 h-4" /> You're volunteering here
            </span> :
          myVolunteerRow ?
          <Button variant="soft" className="gap-2" onClick={handleLeave}>
              <LogOutIcon className="w-4 h-4" /> Leave Site
            </Button> :

          <Button
            className="gap-2 bg-[#3E7B52] text-white hover:bg-[#346B47]"
            onClick={handleJoin}>
              <UserPlusIcon className="w-4 h-4" /> Join Site
            </Button>)
          }
          {canManage &&
          <>
              <Button
              variant="soft"
              className="gap-2"
              onClick={() => setIsEditOpen(true)}>
                <Edit2Icon className="w-4 h-4" /> Edit
              </Button>
              <Button
              variant="ghost"
              className="gap-2 text-[#9B3A3A]"
              onClick={() => setIsDeleteOpen(true)}>
                <Trash2Icon className="w-4 h-4" /> Delete
              </Button>
            </>
          }
        </div>
      </div>

      {/* — Distance banner — */}
      {dist != null &&
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#DCEAF7] text-[#356A9A] font-medium">
          <NavigationIcon className="w-5 h-5" />
          {formatDistance(dist)}
        </div>
      }

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* — Left column: details + site summary + animals + notes — */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <Card className="p-5 space-y-4">
            <h2 className="font-heading font-bold text-text-primary">Details</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">
                  Reporter
                </p>
                {contact ?
                <Link
                  to={`/contacts/${contact.id}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <UserIcon className="w-4 h-4" />
                    {contact.first_name} {contact.last_name}
                  </Link> :

                <p className="text-text-secondary">No contact on file.</p>
                }
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">
                  Address
                </p>
                {site.address?.formatted ?
                <AddressDisplay value={site.address} /> :
                <p className="text-text-secondary">No address on file.</p>
                }
              </div>
              {site.notes &&
              <div>
                  <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">
                    Notes
                  </p>
                  <p className="text-text-primary whitespace-pre-wrap">
                    {site.notes}
                  </p>
                </div>
              }
            </div>
          </Card>

          {/* Site Summary */}
          <Card className="p-5 space-y-4">
            <h2 className="font-heading font-bold text-text-primary">
              Site Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-background p-4 text-center">
                <p className="text-2xl font-heading font-bold text-text-primary">
                  {total}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">All</p>
              </div>
              <div className="rounded-xl bg-[#DCEAF7] p-4 text-center">
                <p className="text-2xl font-heading font-bold text-[#356A9A]">
                  {released}
                </p>
                <p className="text-xs text-[#356A9A] mt-0.5">Released</p>
              </div>
              <div className="rounded-xl bg-[#F8E7C8] p-4 text-center">
                <p className="text-2xl font-heading font-bold text-[#A36B00]">
                  {stillInCare}
                </p>
                <p className="text-xs text-[#A36B00] mt-0.5">Still in Care</p>
              </div>
              <div className="rounded-xl bg-[#DDEFE2] p-4 text-center">
                <p className="text-2xl font-heading font-bold text-[#3E7B52]">
                  {adopted}
                </p>
                <p className="text-xs text-[#3E7B52] mt-0.5">Adopted</p>
              </div>
            </div>
          </Card>

          {/* Animals */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading font-bold text-text-primary">
                Animals ({total})
              </h2>
              {canManage &&
              <div className="flex gap-2">
                  <Button
                  size="sm"
                  variant="soft"
                  className="gap-1.5"
                  onClick={() => setAddAnimalMode('single')}>
                    <PlusIcon className="w-4 h-4" /> Animal
                  </Button>
                  <Button
                  size="sm"
                  variant="soft"
                  className="gap-1.5"
                  onClick={() => setAddAnimalMode('litter')}>
                    <PlusIcon className="w-4 h-4" /> Litter
                  </Button>
                </div>
              }
            </div>
            {linkedAnimals.length === 0 ?
            <div className="py-8 text-center text-text-secondary">
                <PawPrintIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No animals linked to this site yet.</p>
              </div> :

            <div className="divide-y divide-border -mx-1">
                {linkedAnimals.map((a) =>
              <Link
                key={a.id}
                to={`/animals/${a.id}`}
                className="flex items-center gap-3 px-1 py-2.5 hover:bg-background/50 rounded-lg transition-colors">
                    <div className="relative shrink-0">
                      <Avatar
                    src={a.primary_photo_url}
                    type="animal"
                    species={a.species}
                    size="sm" />
                      <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                        <SpeciesBadge species={a.species} />
                      </div>
                    </div>
                    <span className="flex-1 min-w-0 font-medium text-text-primary truncate">
                      {animalDisplayName(a)}
                    </span>
                    <StatusBadge status={a.status} />
                  </Link>
              )}
              </div>
            }
          </Card>

          {/* Notes */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-heading font-bold text-text-primary">Notes</h2>
              {!isAddingNote &&
              <Button
                size="sm"
                variant="soft"
                className="gap-1.5"
                onClick={() => setIsAddingNote(true)}>
                  <PlusIcon className="w-4 h-4" /> Note
                </Button>
              }
            </div>
            {isAddingNote &&
            <div className="space-y-2">
                <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a note about this site…"
                rows={2}
                autoFocus />

                <div className="flex justify-end gap-2">
                  <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingNote(false);
                    setNoteBody('');
                  }}>
                    Cancel
                  </Button>
                  <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteBody.trim()}>
                    Add Note
                  </Button>
                </div>
              </div>
            }
            {siteNotesForSite.length === 0 ?
            <div className="py-8 text-center text-text-secondary">
                <StickyNoteIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notes yet.</p>
                <p className="text-xs mt-1">
                  Add the first note to keep the team in the loop about this site.
                </p>
              </div> :

            <ul className="divide-y divide-border">
                {siteNotesForSite.map((n) =>
              <li key={n.id} className="text-sm py-3 first:pt-0 last:pb-0">
                    <p className="text-text-primary whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      <span className="font-medium text-text-primary/80">
                        {noteAuthorName(n.created_by, n.author_name)}
                      </span>
                      {' · '}
                      <span className="font-medium">
                        {formatDateLong(n.created_at)}
                      </span>
                    </p>
                  </li>
              )}
              </ul>
            }
          </Card>
        </div>

        {/* — Right column: map — */}
        <div className="space-y-6">
          <Card className="p-5 space-y-3">
            <h2 className="font-heading font-bold text-text-primary">Location</h2>
            <SiteMap
              latitude={site.address?.latitude}
              longitude={site.address?.longitude}
              label={site.name}
              address={site.address}
              className="h-72" />
          </Card>

          {/* Site Volunteers — directly below Location */}
          <SiteVolunteersCard site={site} />
        </div>
      </div>

      {/* — Modals — */}
      <NewSiteModal
        isOpen={isEditOpen}
        site={site}
        onClose={() => setIsEditOpen(false)} />
      <AddAnimalModal
        isOpen={addAnimalMode !== null}
        initialMode={addAnimalMode ?? 'single'}
        initialSiteId={site.id}
        onClose={() => setAddAnimalMode(null)} />
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Rescue Site"
        className="max-w-md"
        footer={
        <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Site
            </Button>
          </div>
        }>
        <p className="text-text-secondary">
          Delete <span className="font-medium text-text-primary">{site.name}</span>?
          {total > 0 &&
          <>
              {' '}The {total} animal{total === 1 ? '' : 's'} linked to it will be
              unlinked but not deleted.
            </>
          }
        </p>
      </Modal>
    </div>);

}
