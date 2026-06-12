import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Forms';
import { PersonSearchPicker } from '../ui/PersonSearchPicker';
import { AddContactModal } from '../contacts/AddContactModal';
import { PlusIcon, XIcon, StarIcon, UsersIcon } from 'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { useCanManageSites } from '../../lib/useSitePermissions';
import { Site } from '../../types';

interface Props {
  site: Site;
}

// Roster of people helping at a site. The Site Lead (site.site_lead) is always
// shown first with a "Site Lead" badge and is NOT duplicated in the volunteer
// rows below it. Managers (admins / MANAGE_SITES) can add and remove volunteers.
export function SiteVolunteersCard({ site }: Props) {
  const {
    siteVolunteers,
    peopleIndex,
    addSiteVolunteer,
    removeSiteVolunteer
  } = useWhisker();
  const canManage = useCanManageSites();

  const [isAdding, setIsAdding] = useState(false);
  const [pickedId, setPickedId] = useState('');
  const [role, setRole] = useState('');
  const [isContactOpen, setIsContactOpen] = useState(false);

  const personById = (id: string) => peopleIndex.find((p) => p.id === id) || null;
  const personName = (id: string) => {
    const p = personById(id);
    return p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown';
  };

  const lead = site.site_lead ? personById(site.site_lead) : null;
  // Volunteers for this site, excluding the lead (shown separately above).
  const volunteers = siteVolunteers.
  filter((v) => v.site_id === site.id && v.contact_id !== site.site_lead).
  sort((a, b) => personName(a.contact_id).localeCompare(personName(b.contact_id)));

  // Ids already on the roster (lead + volunteers) — hidden from the add picker.
  const excludeIds = [
  ...(site.site_lead ? [site.site_lead] : []),
  ...volunteers.map((v) => v.contact_id)];

  const resetAdd = () => {
    setPickedId('');
    setRole('');
    setIsAdding(false);
  };
  const handleAdd = () => {
    if (!pickedId) return;
    addSiteVolunteer({
      site_id: site.id,
      contact_id: pickedId,
      role: role.trim() || undefined
    });
    resetAdd();
  };

  const isEmpty = !lead && volunteers.length === 0;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading font-bold text-text-primary flex items-center gap-2">
          <UsersIcon className="w-5 h-5 text-primary" />
          Site Volunteers
        </h2>
        {canManage && !isAdding &&
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        }
      </div>

      {isEmpty && !isAdding &&
      <p className="text-sm text-text-secondary">No volunteers assigned yet.</p>
      }

      <div className="space-y-2">
        {lead &&
        <div className="flex items-center gap-3">
            <Avatar
            src={lead.photo_url}
            name={`${lead.first_name} ${lead.last_name}`}
            colorKey={lead.id}
            size="sm" />
            <div className="min-w-0 flex-1">
              <Link
              to={`/contacts/${lead.id}`}
              className="font-medium text-text-primary hover:text-primary hover:underline truncate block">
                {lead.first_name} {lead.last_name}
              </Link>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8E7C8] text-[#A36B00] shrink-0">
              <StarIcon className="w-3 h-3" />
              Site Lead
            </span>
          </div>
        }
        {volunteers.map((v) => {
          const p = personById(v.contact_id);
          return (
            <div key={v.id} className="flex items-center gap-3 group">
              <Avatar
                src={p?.photo_url}
                name={personName(v.contact_id)}
                colorKey={v.contact_id}
                size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/contacts/${v.contact_id}`}
                  className="font-medium text-text-primary hover:text-primary hover:underline truncate block">
                  {personName(v.contact_id)}
                </Link>
              </div>
              {v.role &&
              <span className="text-xs text-text-secondary shrink-0">{v.role}</span>
              }
              {canManage &&
              <button
                type="button"
                onClick={() => removeSiteVolunteer(v.id)}
                aria-label={`Remove ${personName(v.contact_id)}`}
                className="p-1 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors shrink-0">
                <XIcon className="w-4 h-4" />
              </button>
              }
            </div>);

        })}
      </div>

      {isAdding &&
      <div className="space-y-2 pt-2 border-t border-border">
          <PersonSearchPicker
          people={peopleIndex}
          value={pickedId}
          onChange={setPickedId}
          excludeIds={excludeIds}
          onCreateNew={() => setIsContactOpen(true)}
          placeholder="Search a person to add…" />
          <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (optional) — e.g. Feeder, Trapper" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetAdd}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!pickedId}>
              Add Volunteer
            </Button>
          </div>
        </div>
      }

      {/* Inline "New Contact" flow (Community Contact) for adding a volunteer. */}
      <AddContactModal
        isOpen={isContactOpen}
        defaultRoles={['community_contact']}
        onCreated={(person) => setPickedId(person.id)}
        onClose={() => setIsContactOpen(false)} />
    </Card>);

}
