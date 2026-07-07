import React from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { GettingStartedChecklist } from '../components/guidance/GettingStartedChecklist';
import { PriorityBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { GlobalSearch } from '../components/search/GlobalSearch';
import {
  AlertCircleIcon,
  BirdIcon,
  HomeIcon,
  ActivityIcon,
  ChevronRightIcon,
  HeartIcon,
  UserPlusIcon,
  StethoscopeIcon } from
'lucide-react';
import {
  getDaysUntil,
  formatDate,
  formatDatesInText,
  getGreeting,
  animalDisplayName,
  parseLocalDate } from
'../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Priority, Animal, PersonRole } from '../types';
import { ADOPTION_STATUS_LABELS } from '../lib/adoptions';
import { useFostersEnabled } from '../lib/useFostersEnabled';
import { BoneIcon } from '../components/ui/BoneIcon';
import { HelpNeededWidget } from '../components/dashboard/HelpNeededWidget';

// Adoption stages that are still "in the pipeline" (not a terminal outcome).
const ADOPTION_TERMINAL: string[] = ['completed', 'cancelled', 'returned'];

// One short label per person, for the "New Contacts" widget. Picks the most
// descriptive role; "Volunteer"/"Contact" are the neutral fallbacks (we don't
// assume everyone is a volunteer).
const ROLE_LABEL: Partial<Record<PersonRole, string>> = {
  foster_parent: 'Foster',
  adopter: 'Adopter',
  vet: 'Vet',
  rescue_staff: 'Staff',
  trapper: 'Trapper',
  transport: 'Transport',
  event_support: 'Event Support',
  social_media: 'Social Media',
  donor: 'Donor',
  community_contact: 'Community Contact',
  volunteer: 'Volunteer'
};
const ROLE_PRIORITY: PersonRole[] = [
'foster_parent', 'adopter', 'vet', 'rescue_staff', 'trapper', 'transport',
'event_support', 'social_media', 'donor', 'community_contact', 'volunteer'];
function primaryRoleLabel(roles: PersonRole[]): string {
  const hit = ROLE_PRIORITY.find((r) => roles.includes(r));
  return hit ? ROLE_LABEL[hit]! : 'Contact';
}

/** "Joined today / yesterday / N days ago / Mon D" from a timestamp. */
function joinedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Joined today';
  if (days === 1) return 'Joined yesterday';
  if (days < 7) return `Joined ${days} days ago`;
  return `Joined ${new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })}`;
}

/** Relative time for the activity feed ("2 hours ago / Yesterday / Jul 2"). */
function activityTimeLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  urgent: 3,
  needs_attention: 2,
  normal: 1
};
export function Dashboard() {
  const {
    animals,
    animalsIndex,
    medicalRecords,
    fosters,
    placements,
    actionItems,
    adoptions,
    notes,
    clinicEvents,
    people,
    peopleIndex
  } = useWhisker();
  const { currentOrg, user, currentPersonId } = useAuth();
  // Greet the user by name. Prefer the self-record's first_name (which captures
  // anything the user later edits on their profile); fall back to sign-up
  // metadata, then to the email prefix.
  const selfPerson = currentPersonId ?
  people.find((p) => p.id === currentPersonId) :
  null;
  const metaFullName =
  (user?.user_metadata as Record<string, unknown> | undefined)?.full_name ??
  (user?.user_metadata as Record<string, unknown> | undefined)?.name;
  const greetingName =
  selfPerson?.first_name?.trim() ||
  (typeof metaFullName === 'string' ? metaFullName.trim().split(/\s+/)[0] : '') ||
  user?.email?.split('@')[0] ||
  'there';
  const orgName = currentOrg?.name ?? 'your rescue';

  const openActionFor = (animalId: string) =>
  actionItems.find((a) => a.animal_id === animalId && a.status === 'open')?.
  description;
  const activePlacements = placements.filter(
    (p) => p.placement_status === 'active'
  );
  const activePlacementsCount = activePlacements.length;
  const totalCapacity = fosters.reduce(
    (sum, f) => sum + (f.active === false ? 0 : f.max_capacity ?? 0),
    0
  );

  // Calculate the "Total Animals" metric for the animals in our care
  const animalsInCare = animals.filter((a) => a.status !== 'adopted' && a.status !== 'deceased');
  // "In foster" is derived from the current_foster_id cache, not the status.
  const animalsInFoster = animals.filter((a) => !!a.current_foster_id);
  const availableSpots = totalCapacity - activePlacementsCount;
  const fostersEnabled = useFostersEnabled();
  // Shelter-persona replacements for the two foster stat cards (In Foster and
  // Intake Capacity are both placement/foster-capacity math).
  const adoptableCount = animals.filter((a) => a.status === 'adoptable').length;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const adopted30d = adoptions.filter(
    (a) =>
    a.status === 'completed' &&
    a.completed_at &&
    Date.now() - new Date(a.completed_at).getTime() <= THIRTY_DAYS_MS
  ).length;

  // Animals needing action: elevated priority OR an open action item (the
  // literal next step — e.g. a foster reassignment request). An open item always
  // carries an elevated priority, so we triage by the higher of the animal's own
  // priority and its open item's priority.
  const openActionByAnimal = new Map(
    actionItems.filter((a) => a.status === 'open').map((a) => [a.animal_id, a])
  );
  const effectivePriority = (animal: Animal): Priority => {
    const item = openActionByAnimal.get(animal.id);
    return item &&
    PRIORITY_RANK[item.priority] > PRIORITY_RANK[animal.priority] ?
    item.priority :
    animal.priority;
  };
  const highPriorityAnimals = animals.
  filter((a) => a.status !== 'adopted' && a.status !== 'deceased').
  filter(
    (a) =>
    a.priority === 'urgent' ||
    a.priority === 'critical' ||
    openActionByAnimal.has(a.id)
  ).
  sort(
    (a, b) =>
    PRIORITY_RANK[effectivePriority(b)] - PRIORITY_RANK[effectivePriority(a)]
  );
  const overdueMedical = medicalRecords.filter(
    (m) =>
    m.status === 'overdue' ||
    m.status === 'due' && m.due_date && getDaysUntil(m.due_date) < 0
  );
  // Cap the Needs Action list; the rest are reachable via "Review All".
  const NEEDS_ACTION_LIMIT = 5;
  const shownHighPriority = highPriorityAnimals.slice(0, NEEDS_ACTION_LIMIT);
  const shownOverdue = overdueMedical.slice(
    0,
    Math.max(0, NEEDS_ACTION_LIMIT - shownHighPriority.length)
  );
  const needsActionTotal = highPriorityAnimals.length + overdueMedical.length;
  const hasMoreNeedsAction =
  needsActionTotal > shownHighPriority.length + shownOverdue.length;
  // "Review All" opens the (in-care) Animals list; the Priority filter was
  // removed from that page, so sort by the Priority column to triage there.
  const reviewAllTo = '/animals';
  const upcomingMedical = medicalRecords.
  filter(
    (m) =>
    (m.status === 'due' || m.status === 'scheduled') &&
    m.due_date &&
    getDaysUntil(m.due_date) >= 0 &&
    getDaysUntil(m.due_date) <= 14
  ).
  sort(
    (a, b) =>
    new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
  );
  const statusCounts = animals.reduce(
    (acc, animal) => {
      acc[animal.status] = (acc[animal.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const now = Date.now();

  // — Pending Adoptions — active adoption pipelines, most recently touched first.
  const pendingAdoptions = adoptions.
  filter((a) => !ADOPTION_TERMINAL.includes(a.status)).
  sort(
    (a, b) =>
    new Date(b.updated_at ?? b.created_at).getTime() -
    new Date(a.updated_at ?? a.created_at).getTime()
  ).
  slice(0, 5);

  // — New Contacts — real contacts (not app-account self records or support)
  // created in the last 30 days. "Contact", not "Volunteer": they may be
  // fosters, adopters, vets, staff, or partners.
  const NEW_CONTACT_DAYS = 30;
  const newContactCutoff = now - NEW_CONTACT_DAYS * 86400000;
  const newContacts = peopleIndex.
  filter((p) => !p.user_id).
  filter((p) => !(p.email ?? '').toLowerCase().endsWith('@whiskerville.app')).
  filter((p) => new Date(p.created_at).getTime() >= newContactCutoff).
  sort(
    (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).
  slice(0, 5);

  // — Upcoming Care — clinic events + individual medical appointments, merged
  // and sorted by date (replaces the separate Clinics + Upcoming Medical cards).
  const careItems = [
  ...clinicEvents.
  filter(
    (e) =>
    new Date(e.date_time).getTime() >= now && e.status !== 'cancelled'
  ).
  map((e) => ({
    key: `clinic-${e.id}`,
    time: new Date(e.date_time).getTime(),
    dateLabel: new Date(e.date_time).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }),
    title: e.location || 'Clinic',
    subtitle: 'Clinic',
    to: '/medical',
    animal: null as Animal | null
  })),
  ...upcomingMedical.map((m) => {
    const animal = animalsIndex.find((a) => a.id === m.animal_id) ?? null;
    return {
      key: `med-${m.id}`,
      time: parseLocalDate(m.due_date!).getTime(),
      dateLabel: formatDate(m.due_date!).replace(/,\s*\d{4}$/, ''),
      title: animal ? animalDisplayName(animal) : 'Animal',
      subtitle: m.procedure_name,
      to: animal ? `/animals/${animal.id}` : '/medical',
      animal
    };
  })].
  sort((a, b) => a.time - b.time).
  slice(0, 5);

  // — Recent Activity — the org-wide notes feed (status changes, foster updates,
  // adoption + medical notes), newest first. The "pulse of the rescue".
  const recentActivity = [...notes].
  sort(
    (a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).
  slice(0, 6);

  const container = {
    hidden: {
      opacity: 0
    },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  const item = {
    hidden: {
      opacity: 0,
      y: 20
    },
    show: {
      opacity: 1,
      y: 0
    }
  };
  return (
    <motion.div
      className="space-y-8 pb-8"
      variants={container}
      initial="hidden"
      animate="show">

      <motion.div variants={item} className="space-y-5">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">
            {getGreeting()}, {greetingName}
          </h1>
          <p className="text-text-secondary">
            Here's what's happening at {orgName} today.
          </p>
        </div>
        <GlobalSearch />
      </motion.div>

      <GettingStartedChecklist />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {[
        {
          label: 'Total Animals',
          value: animalsInCare.length,
          icon: ActivityIcon,
          color: 'text-primary',
          bg: 'bg-primary/10'
        },
        // Foster orgs see placement stats; shelters see adoption-pipeline
        // stats in the same two slots (In Foster and Intake Capacity are
        // both foster/placement math).
        fostersEnabled ?
        {
          label: 'In Foster',
          value: animalsInFoster.length,
          icon: HomeIcon,
          color: 'text-[#356A9A]',
          bg: 'bg-[#DCEAF7]'
        } :
        {
          label: 'Adoptable',
          value: adoptableCount,
          icon: HeartIcon,
          color: 'text-[#356A9A]',
          bg: 'bg-[#DCEAF7]'
        },
        {
          label: 'Needs Action',
          value: highPriorityAnimals.length + overdueMedical.length,
          icon: AlertCircleIcon,
          color: 'text-[#9B3A3A]',
          bg: 'bg-[#F5D7D7]'
        },
        fostersEnabled ?
        {
          label: 'Intake Capacity',
          value: availableSpots,
          icon: HomeIcon,
          color: 'text-[#3E7B52]',
          bg: 'bg-[#DDEFE2]'
        } :
        {
          label: 'Adopted (30 days)',
          value: adopted30d,
          icon: HomeIcon,
          color: 'text-[#3E7B52]',
          bg: 'bg-[#DDEFE2]'
        }].
        map((stat, i) =>
        <motion.div key={i} variants={item} className="h-full min-w-0">
            <Card className="h-full p-4 xl:p-5 flex items-start gap-3 xl:gap-4">
              <div
                className={`shrink-0 p-2 xl:p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5 xl:w-6 xl:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs xl:text-sm font-medium text-text-secondary leading-snug line-clamp-2 min-h-[1.5em]">
                  {stat.label}
                </p>
                <p className="text-xl xl:text-2xl font-heading font-bold text-text-primary">
                  {stat.value}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Needs Action → Clinics → Upcoming Medical */}
        <div className="lg:col-span-2 space-y-8">
          {/* Needs Action */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <AlertCircleIcon className="w-5 h-5 text-status-urgent-text" />
                Needs Action
              </h2>
            </div>
            <Card>
              {highPriorityAnimals.length === 0 &&
              overdueMedical.length === 0 ?
              <div className="p-8 text-center text-text-secondary">
                  <div className="flex flex-col items-center gap-3">
                    <BoneIcon className="w-10 h-10 text-primary/40" />
                    <p>All caught up! No urgent actions needed.</p>
                  </div>
                </div> :

              <>
                  <div className="divide-y divide-border">
                  {shownHighPriority.map((animal) => {
                  const hasActivePlacement = activePlacements.some(
                    (p) => p.animal_id === animal.id
                  );
                  const actionDesc = openActionFor(animal.id);
                  return (
                    <Link
                      key={animal.id}
                      to={`/animals/${animal.id}`}
                      className="flex items-center justify-between p-4 hover:bg-background transition-colors group">

                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar
                            src={animal.primary_photo_url}
                            type="animal" />

                            <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                              <SpeciesBadge species={animal.species} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">
                              {animalDisplayName(animal)}
                            </p>
                            <p className="text-sm text-text-secondary line-clamp-1">
                              {actionDesc ?
                            formatDatesInText(actionDesc) :
                            fostersEnabled && !hasActivePlacement ?
                            'Needs placement' :
                            'Needs review'}
                            </p>
                          </div>
                        </div>
                        <PriorityBadge
                        priority={effectivePriority(animal)}
                        className="shrink-0" />

                      </Link>);

                })}
                  {shownOverdue.map((record) => {
                  const animal = animals.find(
                    (a) => a.id === record.animal_id
                  );
                  if (!animal) return null;
                  return (
                    <Link
                      key={record.id}
                      to={`/animals/${animal.id}`}
                      className="flex items-center justify-between p-4 hover:bg-background transition-colors group">

                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar
                            src={animal.primary_photo_url}
                            type="animal" />

                            <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                              <SpeciesBadge species={animal.species} />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">
                              {animalDisplayName(animal)}
                            </p>
                            <p className="text-sm text-status-urgent-text font-medium">
                              Overdue: {record.procedure_name}
                            </p>
                          </div>
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>);

                })}
                  </div>
                  {hasMoreNeedsAction &&
                <Link
                  to={reviewAllTo}
                  className="flex items-center justify-center gap-1.5 p-3 border-t border-border text-sm font-medium text-primary hover:bg-background transition-colors">

                      Review All
                      <ChevronRightIcon className="w-4 h-4" />
                    </Link>
                }
                </>
              }
            </Card>
          </motion.div>

          {/* Help Needed — cross-type unclaimed requests. Renders nothing when
              empty, so it's not wrapped in an animated row (which would leave a
              gap); the widget owns its own heading + card. */}
          <HelpNeededWidget />

          {/* Recent Activity — the org-wide notes feed (status changes, foster
              updates, adoption/medical notes). The "pulse of the rescue". */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <ActivityIcon className="w-5 h-5 text-primary" />
                Recent Activity
              </h2>
            </div>
            <Card>
              {recentActivity.length === 0 ?
              <div className="p-8 text-center text-text-secondary">
                  <p>No recent activity yet.</p>
                </div> :

              <div className="divide-y divide-border">
                  {recentActivity.map((note) => {
                  const animal = animalsIndex.find(
                    (a) => a.id === note.animal_id
                  );
                  return (
                    <Link
                      key={note.id}
                      to={animal ? `/animals/${animal.id}` : '/animals'}
                      className="flex items-start gap-4 p-4 hover:bg-background transition-colors">

                        <div className="relative shrink-0">
                          <Avatar
                          src={animal?.primary_photo_url}
                          type="animal"
                          species={animal?.species}
                          size="sm" />

                          <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                            <SpeciesBadge species={animal?.species ?? ''} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">
                            {animal ? animalDisplayName(animal) : 'Animal'}
                          </p>
                          <p className="text-sm text-text-secondary line-clamp-2">
                            {formatDatesInText(note.body)}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {activityTimeLabel(note.created_at)}
                          </p>
                        </div>
                      </Link>);

                })}
                </div>
              }
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Animal Pipline → Supply Requests → Sitting Requests */}
        <div className="space-y-8">
          {/* Status Breakdown */}
          <motion.div variants={item}>

          <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <BirdIcon className="w-5 h-5 text-[#356A9A]" />
                Animal Pipeline
              </h2>

              <Link
                to="/animals"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>              
            </div>

            <Card className="p-4">
              <div className="space-y-3">
                {[
                {
                  status: 'intake',
                  label: 'Intake',
                  color: 'bg-[#E5E2DC]'
                },
                {
                  status: 'in_care',
                  label: 'In Care',
                  color: 'bg-[#E3E4F2]'
                },
                {
                  status: 'adoptable',
                  label: 'Adoptable',
                  color: 'bg-[#DDEFE2]'
                }].
                map((it) => {
                  const count = statusCounts[it.status] || 0;
                  const percentage =
                  animals.length > 0 ? count / animals.length * 100 : 0;
                  return (
                    <div key={it.status} className="flex items-center gap-3">
                      <div className="w-24 text-sm font-medium text-text-secondary">
                        {it.label}
                      </div>
                      <div className="flex-1 h-8 bg-background rounded-md overflow-hidden flex items-center relative">
                        <div
                          className={`absolute top-0 left-0 h-full ${it.color} transition-all duration-1000`}
                          style={{
                            width: `${percentage}%`
                          }} />

                        <span className="relative z-10 pl-3 text-sm font-bold text-text-primary">
                          {count}
                        </span>
                      </div>
                    </div>);

                })}
              </div>
            </Card>
          </motion.div>

          {/* Pending Adoptions — active adoption pipelines. */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <HeartIcon className="w-5 h-5 text-[#9B3A3A]" />
                Pending Adoptions
              </h2>
              <Link
                to="/adoptions"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>
            </div>
            <Card>
              {pendingAdoptions.length === 0 ?
              <div className="p-6 text-center text-text-secondary text-sm">
                  No adoptions in progress.
                </div> :

              <div className="divide-y divide-border">
                  {pendingAdoptions.map((a) => {
                  const animal = animalsIndex.find((x) => x.id === a.animal_id);
                  const applicant = peopleIndex.find(
                    (p) => p.id === a.adopter_id
                  );
                  return (
                    <Link
                      key={a.id}
                      to={animal ? `/animals/${animal.id}` : '/adoptions'}
                      className="flex items-center gap-3 p-4 hover:bg-background transition-colors">

                        <div className="relative shrink-0">
                          <Avatar
                          src={animal?.primary_photo_url}
                          type="animal"
                          species={animal?.species}
                          size="sm" />

                          <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                            <SpeciesBadge species={animal?.species ?? ''} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">
                            {animal ? animalDisplayName(animal) : 'Animal'}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {applicant ?
                          `${applicant.first_name} ${applicant.last_name}`.trim() :
                          'Applicant'}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {ADOPTION_STATUS_LABELS[a.status]}
                        </span>
                      </Link>);

                })}
                </div>
              }
            </Card>
          </motion.div>

          {/* Upcoming Care — clinic events + individual medical appointments. */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <StethoscopeIcon className="w-5 h-5 text-primary" />
                Upcoming Care
              </h2>
            </div>
            <Card>
              {careItems.length === 0 ?
              <div className="p-6 text-center text-text-secondary text-sm">
                  Nothing scheduled.
                </div> :

              <>
                  <div className="divide-y divide-border">
                    {careItems.map((c) =>
                  <Link
                    key={c.key}
                    to={c.to}
                    className="flex items-center gap-3 p-4 hover:bg-background transition-colors">

                        <div className="shrink-0 w-14 text-sm font-semibold text-text-primary tabular-nums">
                          {c.dateLabel}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">
                            {c.title}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {c.subtitle}
                          </p>
                        </div>
                      </Link>
                  )}
                  </div>
                  <Link
                  to="/medical"
                  className="flex items-center justify-center gap-1.5 p-3 border-t border-border text-sm font-medium text-primary hover:bg-background transition-colors">

                    View calendar
                    <ChevronRightIcon className="w-4 h-4" />
                  </Link>
                </>
              }
            </Card>
          </motion.div>

          {/* New Contacts — recently added people (fosters, adopters, vets,
              staff, partners). Deliberately not "New Volunteers". */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-[#356A9A]" />
                New Contacts
              </h2>
              <Link
                to="/contacts"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>
            </div>
            <Card>
              {newContacts.length === 0 ?
              <div className="p-6 text-center text-text-secondary text-sm">
                  No new contacts in the last 30 days.
                </div> :

              <div className="divide-y divide-border">
                  {newContacts.map((p) =>
                <Link
                  key={p.id}
                  to={`/contacts/${p.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-background transition-colors">

                      <Avatar
                    src={p.photo_url}
                    name={`${p.first_name} ${p.last_name}`}
                    colorKey={p.id}
                    size="sm" />

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-text-secondary truncate">
                          {joinedLabel(p.created_at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-text-secondary bg-background px-2.5 py-1 rounded-full">
                        {primaryRoleLabel(p.roles)}
                      </span>
                    </Link>
                )}
                </div>
              }
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>);

}
