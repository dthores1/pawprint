import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  UserCheck,
  PawPrint,
  MailPlus,
  Inbox,
  LifeBuoy } from
'lucide-react';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate } from '../lib/utils';
import {
  fetchPlatformStats,
  fetchAdminOrganizations,
  PlatformStats,
  AdminOrgRow } from
'../lib/adminApi';

const STAT_TILES: {
  key: keyof PlatformStats;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
{ key: 'organization_count', label: 'Organizations', icon: Building2 },
{ key: 'total_users', label: 'Total Users', icon: Users },
{ key: 'active_users_30d', label: 'Active Users (30d)', icon: UserCheck },
{ key: 'total_animals', label: 'Animals', icon: PawPrint },
{ key: 'pending_invitations', label: 'Pending Invites', icon: MailPlus },
{ key: 'pending_signup_requests', label: 'Signup Requests', icon: Inbox },
{ key: 'open_support_tickets', label: 'Open Support', icon: LifeBuoy }];


function StatTile({
  label,
  value,
  icon: Icon



}: {label: string;value: number | null;icon: React.ComponentType<{className?: string;}>;}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-secondary" />
      </div>
      <div className="min-w-0">
        {value === null ?
        <Skeleton className="h-7 w-12" /> :

        <p className="font-heading text-2xl font-bold text-text-primary leading-tight">
            {value.toLocaleString()}
          </p>
        }
        <p className="text-xs text-text-secondary truncate">{label}</p>
      </div>
    </Card>);

}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrgRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPlatformStats(), fetchAdminOrganizations()]).
    then(([s, o]) => {
      if (cancelled) return;
      setStats(s);
      setOrgs(o);
    }).
    catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-text-primary font-medium">
          Couldn't load platform data.
        </p>
        <p className="text-sm text-text-secondary mt-1">{error}</p>
      </Card>);

  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Platform Overview
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Read-only view across every Whiskerville organization.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {STAT_TILES.map((tile) =>
        <StatTile
          key={tile.key}
          label={tile.label}
          icon={tile.icon}
          value={stats ? stats[tile.key] : null} />

        )}
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-bold text-text-primary">
            Organizations
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border">
                <th className="px-6 py-3 font-medium">Organization</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Members</th>
                <th className="px-6 py-3 font-medium text-right">Animals</th>
                <th className="px-6 py-3 font-medium text-right">
                  Open Support
                </th>
                <th className="px-6 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {orgs === null &&
              <tr>
                  <td colSpan={6} className="px-6 py-4">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              }
              {orgs?.length === 0 &&
              <tr>
                  <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-text-secondary">
                    No organizations yet.
                  </td>
                </tr>
              }
              {orgs?.map((org) =>
              <tr
                key={org.id}
                className="border-b border-border last:border-b-0 hover:bg-background cursor-pointer transition-colors"
                onClick={() => navigate(`/orgs/${org.id}`)}>

                  <td className="px-6 py-3 font-medium text-text-primary">
                    {org.name}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {formatDate(org.created_at)}
                  </td>
                  <td className="px-6 py-3 text-right text-text-primary">
                    {org.member_count}
                  </td>
                  <td className="px-6 py-3 text-right text-text-primary">
                    {org.animal_count}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {org.open_support_count > 0 ?
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8E7C8] text-[#A36B00]">
                        {org.open_support_count}
                      </span> :

                  <span className="text-text-secondary">0</span>
                  }
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {org.last_activity ? formatDate(org.last_activity) : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>);

}
