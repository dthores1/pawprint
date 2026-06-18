import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { VirtualizedGrid } from '../components/ui/VirtualizedGrid';
import { NewSiteModal } from '../components/sites/NewSiteModal';
import {
  MapPinnedIcon,
  PlusIcon,
  UserIcon,
  NavigationIcon } from
'lucide-react';
import { cn } from '../lib/utils';
import { Site } from '../types';
import { SITE_STATUS_META } from '../lib/siteStatus';
import { useCanManageSites } from '../lib/useSitePermissions';
import { haversineMiles, formatDistance, useUserLocation } from '../lib/geo';

type SitesTab = 'new' | 'nearby' | 'mine' | 'all';
const TABS: { key: SitesTab; label: string }[] = [
{ key: 'new', label: 'New' },
{ key: 'nearby', label: 'Nearby' },
{ key: 'mine', label: 'My Sites' },
{ key: 'all', label: 'All Sites' }];

export function SitesList() {
  const { sites, peopleIndex, siteVolunteers } = useWhisker();
  const { currentPersonId } = useAuth();
  const canManage = useCanManageSites();
  const { location } = useUserLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab: SitesTab =
  param === 'nearby' || param === 'mine' || param === 'all' ? param : 'new';
  const [isNewOpen, setIsNewOpen] = useState(false);

  const setTab = (next: SitesTab) =>
  setSearchParams(next === 'new' ? {} : { tab: next }, { replace: true });

  const contactName = (id?: string) => {
    if (!id) return null;
    const p = peopleIndex.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}`.trim() : null;
  };

  const distanceFor = (s: Site): number | null => {
    if (!location) return null;
    const lat = s.address?.latitude;
    const lng = s.address?.longitude;
    if (lat == null || lng == null) return null;
    return haversineMiles(location, { lat, lng });
  };

  const visible = useMemo(() => {
    if (tab === 'new') {
      // Sites added in the last 7 days, newest first.
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return [...sites].
      filter((s) => new Date(s.created_at).getTime() >= cutoff).
      sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    if (tab === 'nearby') {
      // Sites with coordinates, nearest first. Falls back to all sites when
      // we can't compute a distance (no viewer location).
      const withDist = sites.map((s) => ({ s, d: distanceFor(s) }));
      return withDist.
      filter((x) => (location ? x.d != null : true)).
      sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity)).
      map((x) => x.s);
    }
    if (tab === 'mine') {
      // Sites where I'm the lead or a listed volunteer.
      const myVolunteerSiteIds = new Set(
        siteVolunteers.
        filter((v) => v.contact_id === currentPersonId).
        map((v) => v.site_id)
      );
      return [...sites].
      filter(
        (s) =>
        (currentPersonId && s.site_lead === currentPersonId) ||
        myVolunteerSiteIds.has(s.id)
      ).
      sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...sites].sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, tab, location, siteVolunteers, currentPersonId]);

  const renderCard = (s: Site) => {
    const meta = SITE_STATUS_META[s.status];
    const contact = contactName(s.contact_id);
    const dist = distanceFor(s);
    return (
      <Link to={`/sites/${s.id}`} className="block h-full">
        <Card className="p-5 h-full hover:shadow-soft-lg transition-shadow flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPinnedIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-text-primary truncate">
                {s.name}
              </p>
              {s.address?.formatted &&
              <p className="text-xs text-text-secondary truncate">
                  {s.address.formatted}
                </p>
              }
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                meta.tone
              )}>
              {meta.label}
            </span>
            {dist != null &&
            <span className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
                <NavigationIcon className="w-3 h-3" />
                {formatDistance(dist)}
              </span>
            }
          </div>

          {contact &&
          <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-auto">
              <UserIcon className="w-3.5 h-3.5" />
              {contact}
            </div>
          }
        </Card>
      </Link>);

  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <MapPinnedIcon className="w-8 h-8 text-primary" />
            Rescue Sites
          </h1>
          <p className="text-text-secondary mt-1">
            Locations reported to the rescue — colonies, pickups, and trapping
            sites.
          </p>
        </div>
        <div className="flex gap-2">
          {canManage &&
          <Button onClick={() => setIsNewOpen(true)} className="gap-2">
              <PlusIcon className="w-4 h-4" />
              New Site
            </Button>
          }
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) =>
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors',
            tab === t.key ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>
            {t.label}
          </button>
        )}
      </div>

      {tab === 'nearby' && !location &&
      <p className="text-sm text-text-secondary">
          Enable location access or add an address to your profile to sort sites
          by distance. Showing all sites for now.
        </p>
      }

      {visible.length === 0 ?
      <Card className="p-12 text-center text-text-secondary">
          <MapPinnedIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {tab === 'new' ?
          'No new sites' :
          tab === 'mine' ?
          'No sites assigned to you' :
          'No sites yet'}
          </p>
          <p className="text-sm">
            {tab === 'new' ?
          'Sites added in the last 7 days will show up here.' :
          tab === 'mine' ?
          "Sites you lead or volunteer at will appear here." :
          'Create a site when someone reports animals at a location.'}
          </p>
        </Card> :

      <VirtualizedGrid
        items={visible}
        getKey={(s) => s.id}
        renderItem={renderCard} />
      }

      <NewSiteModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>);

}
