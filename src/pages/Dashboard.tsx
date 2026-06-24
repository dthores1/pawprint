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
  CalendarIcon,
  HomeIcon,
  ActivityIcon,
  ChevronRightIcon,
  PackageOpenIcon,
  StethoscopeIcon,
  HeartHandshakeIcon,
  MapPinIcon } from
'lucide-react';
import {
  getDaysUntil,
  formatDate,
  formatDatesInText,
  getGreeting,
  animalDisplayName } from
'../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Priority, Animal } from '../types';
import { BoneIcon } from '../components/ui/BoneIcon';
import { HelpNeededWidget } from '../components/dashboard/HelpNeededWidget';
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  urgent: 3,
  needs_attention: 2,
  normal: 1
};
export function Dashboard() {
  const {
    animals,
    medicalRecords,
    fosters,
    placements,
    actionItems,
    supplyRequests,
    sittingRequests,
    sittingRequestPlacements,
    clinicEvents,
    clinicSlots,
    people
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
  const urgentSupplyRequests = supplyRequests.filter(
    (r) =>
    r.priority === 'urgent' ||
    r.priority === 'critical' &&
    r.status !== 'fulfilled' &&
    r.status !== 'cancelled' &&
    r.status !== 'denied'
  );
  const pendingReviewRequests = supplyRequests.filter(
    (r) => r.status === 'submitted'
  );
  const awaitingDeliveryRequests = supplyRequests.filter(
    (r) => r.status === 'in_progress'
  );
  const now = Date.now();
  const upcomingClinics = clinicEvents.
  filter(
    (e) =>
    new Date(e.date_time).getTime() >= now && e.status !== 'cancelled'
  ).
  sort(
    (a, b) =>
    new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
  ).
  slice(0, 2);
  const unclaimedSitting = sittingRequests.filter((s) => s.status === 'open');
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
        {
          label: 'In Foster',
          value: animalsInFoster.length,
          icon: HomeIcon,
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
        {
          label: 'Intake Capacity',
          value: availableSpots,
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
                            !hasActivePlacement ?
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

          {/* Clinics — between Needs Action and Upcoming Medical */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <StethoscopeIcon className="w-5 h-5 text-primary" />
                Clinics
              </h2>
              <Link
                to="/medical"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>
            </div>
            <Card>
              {upcomingClinics.length === 0 ?
              <div className="p-8 text-center text-text-secondary">
                  <p>No upcoming clinics on the calendar.</p>
                </div> :

              <div className="divide-y divide-border">
                  {upcomingClinics.map((e) => {
                  const slotsFilled = clinicSlots.filter(
                    (s) =>
                    s.clinic_event_id === e.id &&
                    s.status !== 'cancelled'
                  ).length;
                  const vet = e.veterinarian_person_id ?
                  people.find((p) => p.id === e.veterinarian_person_id) :
                  undefined;
                  const date = new Date(e.date_time);
                  const dayLabel = date.toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                  const timeLabel = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                  const percent = Math.min(
                    100,
                    Math.round(
                      slotsFilled / Math.max(1, e.slot_capacity) * 100
                    )
                  );
                  return (
                    <Link
                      key={e.id}
                      to="/medical"
                      className="block p-4 hover:bg-background transition-colors">

                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-text-primary">
                              {dayLabel} · {timeLabel}
                            </p>
                            <p className="text-sm text-text-secondary flex items-center gap-1.5 mt-0.5 truncate">
                              <MapPinIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{e.location}</span>
                            </p>
                            {vet &&
                          <p className="text-xs text-text-secondary mt-0.5">
                                {vet.first_name} {vet.last_name}
                              </p>
                          }
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-text-primary tabular-nums">
                              {slotsFilled} / {e.slot_capacity}
                            </p>
                            <p className="text-xs text-text-secondary">
                              slots
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                          <div
                          className="h-1.5 rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${percent}%` }} />

                        </div>
                      </Link>);

                })}
                </div>
              }
            </Card>
          </motion.div>

          {/* Upcoming Medical */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Upcoming Medical (14 days)
              </h2>
            </div>
            <Card>
              {upcomingMedical.length === 0 ?
              <div className="p-8 text-center text-text-secondary">
                  <p>No upcoming medical appointments.</p>
                </div> :

              <div className="divide-y divide-border">
                  {upcomingMedical.map((record) => {
                  const animal = animals.find(
                    (a) => a.id === record.animal_id
                  );
                  if (!animal) return null;
                  const days = getDaysUntil(record.due_date!);
                  return (
                    <Link
                      key={record.id}
                      to={`/animals/${animal.id}`}
                      className="flex items-center justify-between p-4 hover:bg-background transition-colors group">

                        <div className="flex items-center gap-4">
                          <Avatar
                          src={animal.primary_photo_url}
                          type="animal"
                          size="sm" />

                          <div>
                            <p className="font-medium text-text-primary">
                              {animalDisplayName(animal)}{' '}
                              <span className="text-text-secondary font-normal">
                                — {record.procedure_name}
                              </span>
                            </p>
                            <p className="text-sm text-text-secondary">
                              Due {formatDate(record.due_date!)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                          In {days} day{days !== 1 ? 's' : ''}
                        </div>
                      </Link>);

                })}
                </div>
              }
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Animals by Status → Supply Requests → Sitting Requests */}
        <div className="space-y-8">
          {/* Status Breakdown */}
          <motion.div variants={item}>

          <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <BirdIcon className="w-5 h-5 text-[#356A9A]" />
                Animals by Status
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

          {/* Supply Requests Widget */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <PackageOpenIcon className="w-5 h-5 text-[#D98C5F]" />
                Supply Requests
              </h2>
              <Link
                to="/requests"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>
            </div>
            <Card className="p-4">
              <div className="space-y-3">
                <Link
                  to="/requests"
                  className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-background/80 transition-colors group">

                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#9B3A3A]" />
                    <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                      Urgent requests
                    </span>
                  </div>
                  <span className="text-sm font-bold text-text-primary">
                    {urgentSupplyRequests.length}
                  </span>
                </Link>
                <Link
                  to="/requests"
                  className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-background/80 transition-colors group">

                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#A36B00]" />
                    <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                      Pending review
                    </span>
                  </div>
                  <span className="text-sm font-bold text-text-primary">
                    {pendingReviewRequests.length}
                  </span>
                </Link>
                <Link
                  to="/requests"
                  className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-background/80 transition-colors group">

                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#356A9A]" />
                    <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                      Awaiting delivery
                    </span>
                  </div>
                  <span className="text-sm font-bold text-text-primary">
                    {awaitingDeliveryRequests.length}
                  </span>
                </Link>
              </div>
            </Card>
          </motion.div>

          {/* Sitting Requests Widget */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <HeartHandshakeIcon className="w-5 h-5 text-primary" />
                Sitting Requests
              </h2>
              <Link
                to="/requests?tab=sitting"
                className="text-sm font-medium text-primary hover:underline">

                View all
              </Link>
            </div>
            <Card>
              {unclaimedSitting.length === 0 ?
              <div className="p-6 text-center text-text-secondary text-sm">
                  No coverage needed right now.
                </div> :

              <div className="divide-y divide-border">
                  {unclaimedSitting.slice(0, 3).map((s) => {
                  // Resolve covered animals via the join table.
                  const coveredAnimals = sittingRequestPlacements.
                  filter((srp) => srp.sitting_request_id === s.id).
                  map((srp) =>
                  placements.find((p) => p.id === srp.foster_placement_id)
                  ).
                  filter((p) => !!p).
                  map((p) => animals.find((a) => a.id === p!.animal_id)).
                  filter((a): a is NonNullable<typeof a> => !!a);
                  const lead = coveredAnimals[0];
                  const moreCount = coveredAnimals.length - 1;
                  const labelNames = lead ?
                  moreCount > 0 ?
                  `${lead.name} + ${moreCount} more` :
                  lead.name :
                  'Unknown';
                  const start = new Date(s.start_date);
                  const end = new Date(s.end_date);
                  const sameYear = start.getFullYear() === end.getFullYear();
                  const startStr = start.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: sameYear ? undefined : 'numeric'
                  });
                  const endStr = end.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });
                  return (
                    <Link
                      key={s.id}
                      to="/requests?tab=sitting"
                      className="flex items-center gap-3 p-4 hover:bg-background transition-colors">

                        <Avatar
                        src={lead?.primary_photo_url}
                        type="animal"
                        species={lead?.species}
                        size="sm" />

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-text-primary truncate">
                            {labelNames}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {startStr} – {endStr}
                          </p>
                        </div>
                      </Link>);

                })}
                </div>
              }
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>);

}
