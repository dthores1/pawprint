import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge, STATUS_LABELS } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate } from '../lib/utils';
import { AnimalStatus } from '../types';
import {
  fetchAdminOrgDetail,
  AdminOrgDetail as OrgDetail,
  AdminOrgInvitation } from
'../lib/adminApi';

// Support-ticket status pills (colors follow the app's soft-pill palette).
const TICKET_STATUS_STYLES: Record<string, string> = {
  open: 'bg-[#F8E7C8] text-[#A36B00]',
  in_progress: 'bg-[#DCEAF7] text-[#356A9A]',
  waiting: 'bg-[#E8DEEC] text-[#6E4E80]',
  resolved: 'bg-[#DDEFE2] text-[#3E7B52]',
  closed: 'bg-[#E0E0E0] text-[#555555]'
};

function inviteStatus(invite: AdminOrgInvitation): {
  label: string;
  cls: string;
} {
  if (invite.accepted_at)
  return { label: 'Accepted', cls: 'bg-[#DDEFE2] text-[#3E7B52]' };
  if (invite.revoked_at)
  return { label: 'Revoked', cls: 'bg-[#E0E0E0] text-[#555555]' };
  if (new Date(invite.expires_at) < new Date())
  return { label: 'Expired', cls: 'bg-[#E5E2DC] text-[#6B6B6B]' };
  return { label: 'Pending', cls: 'bg-[#F8E7C8] text-[#A36B00]' };
}

// 'support_access.granted' → 'Support access granted'
function humanizeAction(action: string): string {
  const text = action.replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function animalStatusLabel(status: string): string {
  return STATUS_LABELS[status as AnimalStatus] ?? status;
}

function Section({
  title,
  children



}: {title: string;children: React.ReactNode;}) {
  return (
    <Card>
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-heading text-lg font-bold text-text-primary">
          {title}
        </h2>
      </div>
      {children}
    </Card>);

}

function EmptyRow({ colSpan, label }: {colSpan: number;label: string;}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-6 text-center text-text-secondary text-sm">
        {label}
      </td>
    </tr>);

}

const TH_CLS =
'px-6 py-3 font-medium text-left text-xs text-text-secondary';
const TD_CLS = 'px-6 py-3';
const ROW_CLS = 'border-b border-border last:border-b-0';

export function AdminOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchAdminOrgDetail(id).
    then((d) => {
      if (!cancelled) setDetail(d);
    }).
    catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-text-primary font-medium">
          Couldn't load this organization.
        </p>
        <p className="text-sm text-text-secondary mt-1">{error}</p>
      </Card>);

  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>);

  }

  if (!detail.organization) {
    return (
      <Card className="p-6">
        <p className="text-text-primary font-medium">Organization not found.</p>
        <Link
          to="/"
          className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to overview
        </Link>
      </Card>);

  }

  const org = detail.organization;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All organizations
        </Link>
        <h1 className="font-heading text-2xl font-bold text-text-primary mt-2">
          {org.name}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Created {formatDate(org.created_at)}
        </p>
      </div>

      <Section title={`Members (${detail.members.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH_CLS}>Name</th>
                <th className={TH_CLS}>Email</th>
                <th className={TH_CLS}>Role</th>
                <th className={TH_CLS}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.length === 0 &&
              <EmptyRow colSpan={4} label="No members." />
              }
              {detail.members.map((m, i) =>
              <tr key={i} className={ROW_CLS}>
                  <td className={`${TD_CLS} font-medium text-text-primary`}>
                    {m.name}
                  </td>
                  <td className={`${TD_CLS} text-text-secondary`}>{m.email}</td>
                  <td className={TD_CLS}>
                    <span className="inline-flex items-center gap-1.5">
                      <Badge>
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </Badge>
                      {m.is_support &&
                    <Badge className="bg-[#E8DEEC] text-[#6E4E80]">
                          {m.expires_at && new Date(m.expires_at) < new Date() ?
                      'Support (expired)' :
                      'Support access'}
                        </Badge>
                    }
                    </span>
                  </td>
                  <td className={`${TD_CLS} text-text-secondary`}>
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent Animals">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH_CLS}>Name</th>
                <th className={TH_CLS}>Species</th>
                <th className={TH_CLS}>Status</th>
                <th className={TH_CLS}>Added</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_animals.length === 0 &&
              <EmptyRow colSpan={4} label="No animals yet." />
              }
              {detail.recent_animals.map((a) =>
              <tr key={a.id} className={ROW_CLS}>
                  <td className={`${TD_CLS} font-medium text-text-primary`}>
                    {a.name || a.rescue_id || 'Unnamed'}
                  </td>
                  <td className={`${TD_CLS} text-text-secondary`}>
                    {a.species ?? '—'}
                  </td>
                  <td className={TD_CLS}>
                    <Badge status={a.status as AnimalStatus}>
                      {animalStatusLabel(a.status)}
                    </Badge>
                  </td>
                  <td className={`${TD_CLS} text-text-secondary`}>
                    {formatDate(a.created_at)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent Support Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH_CLS}>Ticket</th>
                <th className={TH_CLS}>Subject</th>
                <th className={TH_CLS}>Category</th>
                <th className={TH_CLS}>Status</th>
                <th className={TH_CLS}>Opened</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_support_tickets.length === 0 &&
              <EmptyRow colSpan={5} label="No support requests." />
              }
              {detail.recent_support_tickets.map((t) =>
              <tr key={t.ticket_number} className={ROW_CLS}>
                  <td className={`${TD_CLS} font-medium text-text-primary`}>
                    #{t.ticket_number}
                  </td>
                  <td className={`${TD_CLS} text-text-primary`}>{t.subject}</td>
                  <td className={`${TD_CLS} text-text-secondary capitalize`}>
                    {t.category}
                  </td>
                  <td className={TD_CLS}>
                    <Badge
                    className={
                    TICKET_STATUS_STYLES[t.status] ??
                    'bg-background text-text-secondary'
                    }>
                      {humanizeAction(t.status)}
                    </Badge>
                  </td>
                  <td className={`${TD_CLS} text-text-secondary`}>
                    {formatDate(t.created_at)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent Invitations">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={TH_CLS}>Email</th>
                <th className={TH_CLS}>Role</th>
                <th className={TH_CLS}>Status</th>
                <th className={TH_CLS}>Sent</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_invitations.length === 0 &&
              <EmptyRow colSpan={4} label="No invitations." />
              }
              {detail.recent_invitations.map((invite, i) => {
                const status = inviteStatus(invite);
                return (
                  <tr key={i} className={ROW_CLS}>
                    <td className={`${TD_CLS} text-text-primary`}>
                      {invite.email}
                    </td>
                    <td className={`${TD_CLS} text-text-secondary capitalize`}>
                      {invite.role}
                    </td>
                    <td className={TD_CLS}>
                      <Badge className={status.cls}>{status.label}</Badge>
                    </td>
                    <td className={`${TD_CLS} text-text-secondary`}>
                      {formatDate(invite.created_at)}
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recent Activity">
        {detail.recent_activity.length === 0 ?
        <p className="px-6 py-6 text-center text-text-secondary text-sm">
            No audited activity yet.
          </p> :

        <ul className="divide-y divide-border">
            {detail.recent_activity.map((event, i) =>
          <li key={i} className="px-6 py-3 flex items-baseline gap-3">
                <span className="text-sm text-text-primary">
                  {humanizeAction(event.action)}
                  {event.actor_label &&
              <span className="text-text-secondary">
                      {' '}
                      · {event.actor_label}
                    </span>
              }
                </span>
                <span className="ml-auto text-xs text-text-secondary whitespace-nowrap">
                  {formatDate(event.created_at)}
                </span>
              </li>
          )}
          </ul>
        }
      </Section>
    </div>);

}
