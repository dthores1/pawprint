import React, { Children } from 'react';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { GlobalSearch } from '../components/search/GlobalSearch';
import {
  AlertCircleIcon,
  CalendarIcon,
  HomeIcon,
  ActivityIcon,
  ChevronRightIcon,
  PackageOpenIcon } from
'lucide-react';
import { getDaysUntil, formatDate, getGreeting } from '../lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Priority } from '../types';
import { BoneIcon } from '../components/ui/BoneIcon';
// TODO: source from the authenticated user once auth lands — e.g. useUser().name
const CURRENT_USER_NAME = 'Dan';
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 4,
  urgent: 3,
  needs_attention: 2,
  normal: 1
};
export function Dashboard() {
  const { animals, medicalRecords, fosters, placements, supplyRequests } =
  useWhisker();
  const activePlacements = placements.filter(
    (p) => p.placement_status === 'active'
  );
  const activePlacementsCount = activePlacements.length;
  const totalCapacity = fosters.reduce((sum, f) => sum + f.max_capacity, 0);
  const availableSpots = totalCapacity - activePlacementsCount;
  // High-priority animals (urgent + critical), sorted critical first
  const highPriorityAnimals = animals.
  filter((a) => a.priority === 'urgent' || a.priority === 'critical').
  sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]);
  const overdueMedical = medicalRecords.filter(
    (m) =>
    m.status === 'overdue' ||
    m.status === 'due' && m.due_date && getDaysUntil(m.due_date) < 0
  );
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
    r.status !== 'completed' &&
    r.status !== 'canceled'
  );
  const pendingReviewRequests = supplyRequests.filter(
    (r) => r.status === 'submitted' || r.status === 'reviewing'
  );
  const awaitingDeliveryRequests = supplyRequests.filter(
    (r) => r.status === 'ready_for_pickup' || r.status === 'ordered'
  );
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
            {getGreeting()}, {CURRENT_USER_NAME}
          </h1>
          <p className="text-text-secondary">
            Here's what's happening at Pawprint today.
          </p>
        </div>
        <GlobalSearch />
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
        {
          label: 'Total Animals',
          value: animals.length,
          icon: ActivityIcon,
          color: 'text-primary',
          bg: 'bg-primary/10'
        },
        {
          label: 'In Foster',
          value: statusCounts['fostered'] || 0,
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
          label: 'Available Spots',
          value: availableSpots,
          icon: HomeIcon,
          color: 'text-[#3E7B52]',
          bg: 'bg-[#DDEFE2]'
        }].
        map((stat, i) =>
        <motion.div key={i} variants={item}>
            <Card className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  {stat.label}
                </p>
                <p className="text-2xl font-heading font-bold text-text-primary">
                  {stat.value}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Action & Medical */}
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

              <div className="divide-y divide-border">
                  {highPriorityAnimals.map((animal) => {
                  const hasActivePlacement = activePlacements.some(
                    (p) => p.animal_id === animal.id
                  );
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
                              {animal.name}
                            </p>
                            <p className="text-sm text-text-secondary line-clamp-1">
                              {animal.action_needed || (
                            !hasActivePlacement ?
                            'Needs placement' :
                            'Needs review')}
                            </p>
                          </div>
                        </div>
                        <PriorityBadge
                        priority={animal.priority}
                        className="shrink-0" />
                      
                      </Link>);

                })}
                  {overdueMedical.map((record) => {
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
                              {animal.name}
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
                              {animal.name}{' '}
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

        {/* Right Column: Stats & Capacity */}
        <div className="space-y-8">
          {/* Supply Requests Widget */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                <PackageOpenIcon className="w-5 h-5 text-[#D98C5F]" />
                Supply Requests
              </h2>
              <Link
                to="/supplies"
                className="text-sm font-medium text-primary hover:underline">
                
                View all
              </Link>
            </div>
            <Card className="p-4">
              <div className="space-y-3">
                <Link
                  to="/supplies?filter=urgent"
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
                  to="/supplies?filter=pending"
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
                  to="/supplies?filter=delivery"
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

          {/* Foster Capacity */}
          <motion.div variants={item}>
            <h2 className="text-xl font-heading font-bold mb-4">
              Foster Capacity
            </h2>
            <Card className="p-6">
              <div className="mb-4 flex justify-between items-end">
                <div>
                  <p className="text-4xl font-heading font-bold text-primary">
                    {activePlacementsCount}
                  </p>
                  <p className="text-sm text-text-secondary">
                    Animals in foster
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-heading font-bold text-text-primary">
                    {totalCapacity}
                  </p>
                  <p className="text-sm text-text-secondary">Total capacity</p>
                </div>
              </div>

              <div className="w-full bg-background rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(100, activePlacementsCount / totalCapacity * 100)}%`
                  }} />
                
              </div>
              <p className="text-sm text-text-secondary text-center mt-4">
                {availableSpots} spots available across {fosters.length} active
                fosters.
              </p>
            </Card>
          </motion.div>

          {/* Status Breakdown */}
          <motion.div variants={item}>
            <h2 className="text-xl font-heading font-bold mb-4">
              Animals by Status
            </h2>
            <Card className="p-4">
              <div className="space-y-3">
                {[
                {
                  status: 'intake',
                  label: 'Intake',
                  color: 'bg-[#E5E2DC]'
                },
                {
                  status: 'medical',
                  label: 'Medical',
                  color: 'bg-[#F8E7C8]'
                },
                {
                  status: 'hold',
                  label: 'Hold',
                  color: 'bg-[#E8DEEC]'
                },
                {
                  status: 'fostered',
                  label: 'Fostered',
                  color: 'bg-[#DCEAF7]'
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
        </div>
      </div>
    </motion.div>);

}