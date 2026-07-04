import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { GuidanceLink } from '../components/guidance/GuidanceLink';
import { Button } from '../components/ui/Button';
import { VirtualizedGrid } from '../components/ui/VirtualizedGrid';
import { FilterDropdown } from '../components/ui/FilterDropdown';
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

// Distance options for the Nearby tab. Values are the mile threshold; 'all'
// keeps every located site (no distance cap). Labelled "Within: …" in the UI.
const RADIUS_OPTIONS = [
{ value: '1', label: '1 mile' },
{ value: '5', label: '5 miles' },
{ value: '10', label: '10 miles' },
{ value: '25', label: '25 miles' },
{ value: 'all', label: 'Any distance' }];
const DEFAULT_RADIUS = '5';
// Persisted so the chosen distance sticks across visits (mirrors how the current
// org is stored — see AuthContext CURRENT_ORG_KEY).
const RADIUS_KEY = 'whiskerville.sitesNearbyRadius';

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
  // Nearby-tab distance threshold ('all' = no cap). Restored from localStorage,
  // defaulting to 5 mi; `setRadius` writes the choice back so it persists.
  const [radius, setRadiusState] = useState(() => {
    const saved =
    typeof localStorage !== 'undefined' ? localStorage.getItem(RADIUS_KEY) : null;
    return saved && RADIUS_OPTIONS.some((o) => o.value === saved) ?
    saved :
    DEFAULT_RADIUS;
  });
  const setRadius = (v: string) => {
    setRadiusState(v);
    try {
      localStorage.setItem(RADIUS_KEY, v);
    } catch {
      // Ignore storage failures (private mode, quota) — the choice still applies.
    }
  };

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
  }, [sites, tab, siteVolunteers, currentPersonId]);

  // Nearby = "sites by proximity", not just "sites with a distance". Located
  // sites (within the chosen radius) sort nearest-first; sites we can't place
  // (no address, or no viewer location) still belong — shown last with no
  // distance line. Note: distanceFor() returns null for every site when the
  // viewer has no location, so they all land in `unknown` (the old fallback).
  const nearby = useMemo(() => {
    const limit = radius === 'all' ? null : Number(radius);
    const withDist = sites.map((s) => ({ s, d: distanceFor(s) }));
    const located = withDist.
    filter((x): x is { s: Site; d: number } => x.d != null).
    sort((a, b) => a.d - b.d);
    const inRadius = (limit == null ? located : located.filter((x) => x.d <= limit)).
    map((x) => x.s);
    const unknown = withDist.
    filter((x) => x.d == null).
    map((x) => x.s).
    sort((a, b) => a.name.localeCompare(b.name));
    return { located: inRadius, unknown };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, radius, location]);

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

  const nearbyTotal = nearby.located.length + nearby.unknown.length;
  const isEmpty = tab === 'nearby' ? nearbyTotal === 0 : visible.length === 0;
  // Only break out a labelled "Distance unknown" group once there are several
  // such sites (and some located ones to separate them from) — for one or two,
  // they just trail the list without ceremony.
  const showUnknownDivider =
  tab === 'nearby' &&
  nearby.located.length > 0 &&
  nearby.unknown.length >= 3;

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
          <GuidanceLink guidanceKey="sites_intro" />
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

      {tab === 'nearby' && (
      location ?
      <div className="flex items-center gap-2">
          <FilterDropdown
          label="Within"
          value={radius}
          options={RADIUS_OPTIONS}
          onChange={setRadius} />
        </div> :

      <p className="text-sm text-text-secondary">
          Enable location access or add an address to your profile to sort sites
          by distance. Showing all sites for now.
        </p>)
      }

      {isEmpty ?
      <Card className="p-12 text-center text-text-secondary">
          <MapPinnedIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            {tab === 'new' ?
          'No new sites' :
          tab === 'mine' ?
          'No sites assigned to you' :
          tab === 'nearby' && location && radius !== 'all' ?
          `No sites within ${radius} mi` :
          'No sites yet'}
          </p>
          <p className="text-sm">
            {tab === 'new' ?
          'Sites added in the last 7 days will show up here.' :
          tab === 'mine' ?
          "Sites you lead or volunteer at will appear here." :
          tab === 'nearby' && location && radius !== 'all' ?
          'Try a larger distance, or Any distance.' :
          'Create a site when someone reports animals at a location.'}
          </p>
        </Card> :
      tab === 'nearby' ?
      <div className="space-y-4">
          <VirtualizedGrid
          items={
          showUnknownDivider ?
          nearby.located :
          [...nearby.located, ...nearby.unknown]
          }
          getKey={(s) => s.id}
          renderItem={renderCard}
          pageScroll />

          {showUnknownDivider &&
          <>
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Distance unknown
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <VirtualizedGrid
              items={nearby.unknown}
              getKey={(s) => s.id}
              renderItem={renderCard}
              pageScroll />
            </>
          }
        </div> :

      <VirtualizedGrid
        items={visible}
        getKey={(s) => s.id}
        renderItem={renderCard}
        pageScroll />
      }

      <NewSiteModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>);

}
