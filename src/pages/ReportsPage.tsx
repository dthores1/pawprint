import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line } from
'recharts';
import {
  PieChartIcon,
  BarChart3Icon } from
'lucide-react';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { useCanManageSites } from '../lib/useSitePermissions';
import { useCanViewSupplyFinancials } from '../lib/useSupplyPermissions';
import { Card } from '../components/ui/Card';
import { ReportsDateFilter } from '../components/reports/ReportsDateFilter';
import {
  DateRange,
  RangePreset,
  inRange,
  lastNMonths,
  meanDaysBetween,
  monthBucketsBetween,
  thisMonthRange } from
'../lib/reports';
import { ADOPTION_STATUS_LABELS, isActiveAdoption } from '../lib/adoptions';
import { AnimalStatus, SiteStatus } from '../types';
import { SITE_STATUS_META, SITE_STATUS_ORDER } from '../lib/siteStatus';
import { formatDate } from '../lib/utils';
import { speciesIconByName } from '../lib/speciesIcons';
import { track } from '../lib/analytics';

const STATUS_LABEL: Record<AnimalStatus, string> = {
  intake: 'Intake',
  in_care: 'In Care',
  adoptable: 'Adoptable',
  adopted: 'Adopted',
  released: 'Released',
  hospice: 'Hospice',
  deceased: 'Deceased'
};

// Palette tuned to the existing status tokens so charts blend with the rest.
const STATUS_COLORS: Record<AnimalStatus, string> = {
  intake: '#6B6B6B',
  in_care: '#525694',
  adoptable: '#3E7B52',
  adopted: '#B8632E',
  released: '#4F7A70',
  hospice: '#7C4A3D',
  deceased: '#555555'
};
const ADOPTION_COLORS: Record<string, string> = {
  inquiry: '#6B6B6B',
  application_submitted: '#A36B00',
  meet_and_greet: '#356A9A',
  pending_paperwork: '#B4641E',
  ready_for_placement: '#3E7B52',
  completed: '#B8632E',
  cancelled: '#9B3A3A',
  returned: '#B5677E'
};
const NEUTRAL_BARS = ['#3E7B52', '#356A9A', '#B8632E', '#A36B00', '#6E4E80'];
// Chart hexes for site statuses (the SITE_STATUS_META tones are CSS classes).
const SITE_STATUS_COLORS: Record<SiteStatus, string> = {
  reported: '#356A9A',
  assessing: '#A36B00',
  active: '#3E7B52',
  monitoring: '#6E4E80',
  closed: '#6B6B6B'
};

// Square marker for the Intake line so the two trend series stay
// distinguishable without relying on color (Adoptions uses default circles).
function TrendSquareDot(props: {
  cx?: number;
  cy?: number;
  stroke?: string;
  active?: boolean;
}) {
  const { cx, cy, stroke, active } = props;
  if (cx === undefined || cy === undefined) return null;
  const half = active ? 5 : 3.5;
  return (
    <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} fill={stroke} />);
}

function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs uppercase tracking-wider font-medium text-text-secondary">
        {label}
      </p>
      <p className="text-2xl font-heading font-bold text-text-primary mt-1 leading-tight">
        {value}
      </p>
      {hint && <p className="text-xs text-text-secondary mt-1">{hint}</p>}
    </Card>);

}

// Small two-state toggle for swapping a status breakdown between a donut and a
// bar chart — same data, different shape. Sits in the card header.
type ChartType = 'pie' | 'bar';
function ChartTypeToggle({
  value,
  onChange
}: {
  value: ChartType;
  onChange: (v: ChartType) => void;
}) {
  const options: { id: ChartType; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'pie', Icon: PieChartIcon, label: 'Donut chart' },
  { id: 'bar', Icon: BarChart3Icon, label: 'Bar chart' }];

  return (
    <div className="flex items-center bg-background border border-border rounded-md p-0.5">
      {options.map(({ id, Icon, label }) =>
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-label={label}
        title={label}
        className={`p-1 rounded-sm transition-colors ${
        value === id ?
        'bg-card text-primary shadow-sm' :
        'text-text-secondary hover:text-text-primary'}`
        }>

          <Icon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>);

}

// One status-breakdown shape, rendered as either a donut or a bar chart.
function StatusBreakdown({
  data,
  type
}: {
  data: { status?: string; label: string; count: number; color: string }[];
  type: ChartType;
}) {
  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}>

            {data.map((d, i) =>
            <Cell key={d.status ?? i} fill={d.color} />
            )}
          </Pie>
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }} />

        </PieChart>
      </ResponsiveContainer>);

  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
        <XAxis
          dataKey="label"
          stroke="#6B6B6B"
          fontSize={10}
          interval={0}
          angle={-25}
          textAnchor="end"
          height={60} />

        <YAxis stroke="#6B6B6B" fontSize={11} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count">
          {data.map((d, i) =>
          <Cell key={d.status ?? i} fill={d.color} />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>);

}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-heading font-bold text-text-primary mb-3">
      {children}
    </h2>);

}

export function ReportsPage() {
  const {
    animals,
    ensureHistoricalLoaded,
    ensureInactiveLoaded,
    ensureSupplyHistoryLoaded,
    adoptions,
    fosters,
    placements,
    medicalRecords,
    clinicEvents,
    clinicSlots,
    supplyRequests,
    supplyRequestItems,
    products,
    sites,
    siteVolunteers
  } = useWhisker();

  // Per-section visibility. Animals / Fosters / Clinics / Adoptions are visible
  // to all members; Rescue Sites and Supply (financial) are permission-gated.
  // The org-wide "Show All Reports to Everyone" setting opens everything.
  const { currentOrg } = useAuth();
  const showAllReports = !!currentOrg?.show_all_reports;
  const fostersEnabled = currentOrg?.foster_management_enabled !== false;
  const canViewSites = useCanManageSites() || showAllReports;
  const canViewSupply = useCanViewSupplyFinancials(); // already folds in showAll

  // Reports must cover everything, but the default loads are scoped (animals =
  // in-care, people = active, supply requests = operational only) — pull the
  // historical animals, inactive contacts, and closed supply requests in on
  // mount so the supply report counts fulfilled/denied requests.
  useEffect(() => {
    ensureHistoricalLoaded();
    ensureInactiveLoaded();
    ensureSupplyHistoryLoaded();
  }, [ensureHistoricalLoaded, ensureInactiveLoaded, ensureSupplyHistoryLoaded]);

  const [preset, setPreset] = useState<RangePreset>('month');
  const [range, setRange] = useState<DateRange>(thisMonthRange);
  const [appsChartType, setAppsChartType] = useState<ChartType>('pie');
  const [animalsChartType, setAnimalsChartType] = useState<ChartType>('pie');
  const [sitesChartType, setSitesChartType] = useState<ChartType>('pie');

  // — Adoptions —————————————————————————————————————————————————————
  // Directly-recorded adoptions (source 'direct' — Edit-modal status changes,
  // typically historical backfills) never had an application: their created_at
  // is just the backfill day. They're excluded from the funnel metrics
  // (applications, conversion, avg days) but included in completed counts,
  // the trend chart, and the completed list below.
  const adoptionsInRange = useMemo(
    () =>
    adoptions.filter(
      (a) => a.source !== 'direct' && inRange(a.created_at, range)
    ),
    [adoptions, range]
  );
  const applicationsByStatus = useMemo(() => {
    const acc = new Map<string, number>();
    for (const a of adoptionsInRange) {
      acc.set(a.status, (acc.get(a.status) ?? 0) + 1);
    }
    return Array.from(acc.entries()).map(([status, count]) => ({
      status,
      label: ADOPTION_STATUS_LABELS[status as keyof typeof ADOPTION_STATUS_LABELS] ?? status,
      count,
      color: ADOPTION_COLORS[status] ?? '#6B6B6B'
    }));
  }, [adoptionsInRange]);
  const avgDaysToAdoption = useMemo(() => {
    const pairs = adoptions.
    filter(
      (a) =>
      a.source !== 'direct' &&
      a.status === 'completed' &&
      !!a.completed_at &&
      inRange(a.completed_at, range)
    ).
    map((a) => ({ start: a.created_at, end: a.completed_at! }));
    return meanDaysBetween(pairs);
  }, [adoptions, range]);
  const completedAdoptions = useMemo(() => {
    return adoptions.
    filter(
      (a) =>
      a.status === 'completed' &&
      !!a.completed_at &&
      inRange(a.completed_at, range)
    ).
    map((a) => ({
      adoption: a,
      animal: animals.find((an) => an.id === a.animal_id)
    })).
    sort(
      (a, b) =>
      new Date(b.adoption.completed_at!).getTime() -
      new Date(a.adoption.completed_at!).getTime()
    );
  }, [adoptions, animals, range]);
  // Conversion: completed adoptions ÷ applications, both in the selected
  // range. Each event buckets when it happened (completed_at vs created_at),
  // so a range that clears a backlog of older applications can exceed 100%.
  // Directly-recorded adoptions are excluded from both sides — no application.
  const conversionRate = useMemo(() => {
    if (adoptionsInRange.length === 0) return null;
    const workflowCompleted = completedAdoptions.filter(
      ({ adoption }) => adoption.source !== 'direct'
    ).length;
    return workflowCompleted / adoptionsInRange.length;
  }, [adoptionsInRange, completedAdoptions]);

  // — Animals ———————————————————————————————————————————————————————
  const animalsByStatus = useMemo(() => {
    const acc = new Map<AnimalStatus, number>();
    for (const a of animals) acc.set(a.status, (acc.get(a.status) ?? 0) + 1);
    return Array.from(acc.entries()).map(([status, count]) => ({
      status,
      label: STATUS_LABEL[status],
      count,
      color: STATUS_COLORS[status]
    }));
  }, [animals]);
  const adoptableCount = animalsByStatus.find((s) => s.status === 'adoptable')?.count ?? 0;
  const fosteredCount = animals.filter((a) => !!a.current_foster_id).length;
  const releasedCount = animalsByStatus.find((s) => s.status === 'released')?.count ?? 0;
  // "Adoption pending" is no longer a status — it's the set of animals with an
  // active (non-terminal) adoption record, which also sets is_on_hold.
  const adoptionPendingCount = useMemo(
    () => adoptions.filter(isActiveAdoption).length,
    [adoptions]
  );

  const trend = useMemo(() => {
    const months = lastNMonths(12);
    return months.map((m) => ({
      label: m.label,
      intakes: animals.filter((a) => inRange(a.intake_date, m)).length,
      adoptions: adoptions.filter(
        (a) => a.status === 'completed' && inRange(a.completed_at, m)
      ).length
    }));
  }, [animals, adoptions]);

  // — Rescue Sites ——————————————————————————————————————————————————
  // "Recovered" = animals whose intake falls in the range AND that came from a
  // site (have an origin site_id).
  const recoveredAnimals = useMemo(
    () =>
    animals.filter((a) => a.site_id && inRange(a.intake_date, range)),
    [animals, range]
  );
  const newRescueSites = useMemo(
    () => sites.filter((s) => inRange(s.created_at, range)).length,
    [sites, range]
  );
  const activeSites = useMemo(
    () => sites.filter((s) => s.status === 'active').length,
    [sites]
  );
  const sitesWithVolunteers = useMemo(
    () => new Set(siteVolunteers.map((v) => v.site_id)).size,
    [siteVolunteers]
  );
  // Recovered animals grouped by origin site (in range), most active first.
  const animalsBySite = useMemo(() => {
    const acc = new Map<string, number>();
    for (const a of recoveredAnimals) {
      acc.set(a.site_id!, (acc.get(a.site_id!) ?? 0) + 1);
    }
    return Array.from(acc.entries()).
    map(([siteId, count]) => ({
      siteId,
      name: sites.find((s) => s.id === siteId)?.name ?? 'Unknown site',
      count
    })).
    sort((a, b) => b.count - a.count);
  }, [recoveredAnimals, sites]);
  const sitesByStatus = useMemo(() => {
    const acc = new Map<SiteStatus, number>();
    for (const s of sites) acc.set(s.status, (acc.get(s.status) ?? 0) + 1);
    return SITE_STATUS_ORDER.
    filter((st) => acc.has(st)).
    map((st) => ({
      status: st,
      label: SITE_STATUS_META[st].label,
      count: acc.get(st)!,
      color: SITE_STATUS_COLORS[st]
    }));
  }, [sites]);

  // — Fosters ———————————————————————————————————————————————————————
  const newFostersInRange = useMemo(
    () =>
    fosters.filter(
      (f) => f.active !== false && f.created_at && inRange(f.created_at, range)
    ).length,
    [fosters, range]
  );
  const activeFosterHomes = useMemo(() => {
    const ids = new Set<string>();
    for (const p of placements) {
      if (p.placement_status === 'active') ids.add(p.person_id);
    }
    return ids.size;
  }, [placements]);
  const totalCapacity = useMemo(
    () =>
    fosters.reduce(
      (sum, f) => sum + (f.active === false ? 0 : f.max_capacity ?? 0),
      0
    ),
    [fosters]
  );
  const activePlacementsCount = useMemo(
    () => placements.filter((p) => p.placement_status === 'active').length,
    [placements]
  );
  const availableCapacity = Math.max(0, totalCapacity - activePlacementsCount);

  // — Clinic ————————————————————————————————————————————————————————
  const spayNeuterCompleted = useMemo(
    () =>
    medicalRecords.filter(
      (m) =>
      m.procedure_type === 'spay_neuter' &&
      m.status === 'completed' &&
      inRange(m.performed_date, range)
    ).length,
    [medicalRecords, range]
  );
  const vaccinesCompleted = useMemo(
    () =>
    medicalRecords.filter(
      (m) =>
      m.procedure_type === 'vaccine' &&
      m.status === 'completed' &&
      inRange(m.performed_date, range)
    ).length,
    [medicalRecords, range]
  );
  const medicalByType = useMemo(() => {
    const acc = new Map<string, number>();
    for (const m of medicalRecords) {
      if (m.status !== 'completed') continue;
      if (!inRange(m.performed_date, range)) continue;
      acc.set(m.procedure_type, (acc.get(m.procedure_type) ?? 0) + 1);
    }
    return Array.from(acc.entries()).
    map(([type, count]) => ({
      type,
      label: type.replace(/_/g, ' '),
      count
    })).
    sort((a, b) => b.count - a.count);
  }, [medicalRecords, range]);
  // — Supply Requests ——————————————————————————————————————————————
  // Anchor spend on fulfilled_date — that's when the order actually went out
  // and the cost was incurred. Skips drafts/in-progress that have no cost yet.
  const fulfilledOrdersInRange = useMemo(
    () =>
    supplyRequests.filter(
      (r) =>
      r.status === 'fulfilled' &&
      r.total_cost != null &&
      inRange(r.fulfilled_date ?? r.updated_at, range)
    ),
    [supplyRequests, range]
  );
  const orderCostTotal = useMemo(
    () => fulfilledOrdersInRange.reduce((sum, r) => sum + (r.total_cost ?? 0), 0),
    [fulfilledOrdersInRange]
  );
  const avgOrderSpend =
  fulfilledOrdersInRange.length > 0 ?
  orderCostTotal / fulfilledOrdersInRange.length :
  null;
  // Distribute each order's total_cost equally across the unique product
  // categories represented by its items. Requests with no product-linked items
  // bucket into "Uncategorized" so spend is never lost.
  const spendByCategory = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of fulfilledOrdersInRange) {
      const myItems = supplyRequestItems.filter(
        (i) => i.supply_request_id === r.id
      );
      const cats = new Set<string>();
      for (const it of myItems) {
        const prod = it.product_id ?
        products.find((p) => p.id === it.product_id) :
        null;
        cats.add(prod?.category ?? 'uncategorized');
      }
      const list = cats.size > 0 ? Array.from(cats) : ['uncategorized'];
      const share = (r.total_cost ?? 0) / list.length;
      for (const c of list) acc.set(c, (acc.get(c) ?? 0) + share);
    }
    return Array.from(acc.entries()).
    map(([category, total]) => ({
      category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      total
    })).
    sort((a, b) => b.total - a.total).
    slice(0, 5);
  }, [fulfilledOrdersInRange, supplyRequestItems, products]);
  const spendByMonth = useMemo(() => {
    const buckets = monthBucketsBetween(range);
    return buckets.map((m) => ({
      label: m.label,
      total: fulfilledOrdersInRange.
      filter((r) => inRange(r.fulfilled_date ?? r.updated_at, m)).
      reduce((sum, r) => sum + (r.total_cost ?? 0), 0)
    }));
  }, [fulfilledOrdersInRange, range]);
  const formatUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const upcomingClinics = useMemo(() => {
    const now = Date.now();
    return clinicEvents.
    filter(
      (e) => new Date(e.date_time).getTime() >= now && e.status !== 'cancelled'
    ).
    sort(
      (a, b) =>
      new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    ).
    slice(0, 5).
    map((e) => {
      const filled = clinicSlots.filter(
        (s) =>
        s.clinic_event_id === e.id &&
        s.status !== 'cancelled' &&
        s.status !== 'no_show'
      ).length;
      return { event: e, filled, capacity: e.slot_capacity };
    });
  }, [clinicEvents, clinicSlots]);

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Reports
          </h1>
          <p className="text-text-secondary mt-1">
            {fostersEnabled ?
            'Operational metrics across adoptions, animals, fosters, and clinics.' :
            'Operational metrics across adoptions, animals, and clinics.'}
          </p>
        </div>
        <ReportsDateFilter
          preset={preset}
          range={range}
          onChange={(next) => {
            track('report_range_changed', { preset: next.preset });
            setPreset(next.preset);
            setRange(next.range);
          }} />

      </div>

      {/* Adoptions */}
      <section>
        <SectionTitle>Adoptions</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard
            label="Adoptions in range"
            value={completedAdoptions.length}
            hint="Completed in the selected range" />

          <MetricCard
            label="Applications in range"
            value={adoptionsInRange.length} />

          <MetricCard
            label="Avg days application → adoption"
            value={
            avgDaysToAdoption != null ?
            avgDaysToAdoption.toFixed(1) :
            '—'
            }
            hint="Completed adoptions in the selected range" />

          <MetricCard
            label="Conversion rate"
            value={
            conversionRate != null ?
            `${Math.round(conversionRate * 100)}%` :
            '—'
            }
            hint="Completed adoptions ÷ applications in range" />

        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-text-primary">
                Applications by status
              </h3>
              <ChartTypeToggle
                value={appsChartType}
                onChange={(v) => {
                  track('report_chart_changed', { chart: 'apps', chart_type: v });
                  setAppsChartType(v);
                }} />

            </div>
            {applicationsByStatus.length === 0 ?
            <p className="text-sm text-text-secondary">
                No applications in this range.
              </p> :

            <StatusBreakdown
              data={applicationsByStatus}
              type={appsChartType} />

            }
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Adoptions
            </h3>
            {completedAdoptions.length === 0 ?
            <p className="text-sm text-text-secondary">
                No completed adoptions in this range.
              </p> :

            <div className="max-h-[240px] overflow-y-auto -mx-2">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {completedAdoptions.map(({ adoption, animal }) => {
                    const Icon = speciesIconByName(animal?.species);
                    return (
                      <tr
                        key={adoption.id}
                        className="border-b border-border last:border-b-0">

                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="w-4 h-4 text-text-secondary shrink-0" />
                              {animal ?
                            <Link
                              to={`/animals/${animal.id}`}
                              className="font-medium text-text-primary hover:text-primary truncate">

                                  {animal.name}
                                  {animal.rescue_id ?
                              <span className="text-text-secondary font-normal">
                                      {' '}
                                      ({animal.rescue_id})
                                    </span> :
                              null}
                                </Link> :

                            <span className="text-text-secondary">
                                  Unknown animal
                                </span>
                            }
                              {adoption.source === 'direct' &&
                            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#E5E2DC] text-[#6B6B6B]">
                                  Recorded directly
                                </span>
                            }
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-text-secondary whitespace-nowrap">
                            {formatDate(adoption.completed_at!.split('T')[0])}
                          </td>
                        </tr>);

                  })}
                  </tbody>
                </table>
              </div>
            }
          </Card>
        </div>
      </section>

      {/* Animals */}
      <section>
        <SectionTitle>Animals</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard label="Adoptable" value={adoptableCount} />
          {fostersEnabled &&
          <MetricCard label="Fostered" value={fosteredCount} />
          }
          <MetricCard label="Adoption pending" value={adoptionPendingCount} />
          <MetricCard label="Released" value={releasedCount} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-text-primary">
                Current animals by status
              </h3>
              <ChartTypeToggle
                value={animalsChartType}
                onChange={(v) => {
                  track('report_chart_changed', {
                    chart: 'animals',
                    chart_type: v
                  });
                  setAnimalsChartType(v);
                }} />

            </div>
            {animalsByStatus.length === 0 ?
            <p className="text-sm text-text-secondary">No animals yet.</p> :

            <StatusBreakdown
              data={animalsByStatus}
              type={animalsChartType} />

            }
          </Card>
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Intake vs adoption (last 12 months)
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                <XAxis dataKey="label" stroke="#6B6B6B" fontSize={11} />
                <YAxis stroke="#6B6B6B" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="intakes"
                  stroke="#B07D2B"
                  strokeWidth={2}
                  dot={<TrendSquareDot />}
                  activeDot={<TrendSquareDot active />}
                  legendType="square"
                  name="Intakes" />

                <Line
                  type="monotone"
                  dataKey="adoptions"
                  stroke="#4F7A70"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#4F7A70', stroke: '#4F7A70' }}
                  activeDot={{ r: 6, fill: '#4F7A70', stroke: '#4F7A70' }}
                  legendType="circle"
                  name="Adoptions" />

              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </section>

      {/* Rescue Sites — sensitive (colony/trapping locations); admins +
          MANAGE_SITES, or everyone when "Show All Reports" is on. */}
      {canViewSites &&
      <section>
        <SectionTitle>Rescue Sites</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard
            label="New rescue sites"
            value={newRescueSites}
            hint="Created in selected range" />

          <MetricCard
            label="Recovered animals"
            value={recoveredAnimals.length}
            hint="From sites, intake in range" />

          <MetricCard label="Active sites" value={activeSites} />
          <MetricCard
            label="Site volunteers"
            value={siteVolunteers.length}
            hint={`Across ${sitesWithVolunteers} site${
            sitesWithVolunteers === 1 ? '' : 's'}`
            } />

        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Animals by origin site
            </h3>
            {animalsBySite.length === 0 ?
            <p className="text-sm text-text-secondary">
                No animals recovered from sites in this range.
              </p> :

            <div className="max-h-[240px] overflow-y-auto -mx-2">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                    <tr>
                      <th className="py-2 px-2 font-medium">Site</th>
                      <th className="py-2 px-2 font-medium text-right">Animals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {animalsBySite.map((row) =>
                  <tr key={row.siteId}>
                        <td className="py-2.5 px-2">
                          <Link
                        to={`/sites/${row.siteId}`}
                        className="font-medium text-text-primary hover:text-primary truncate">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2.5 px-2 text-right text-text-primary">
                          {row.count}
                        </td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            }
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-text-primary">
                Sites by status
              </h3>
              <ChartTypeToggle
                value={sitesChartType}
                onChange={(v) => {
                  track('report_chart_changed', { chart: 'sites', chart_type: v });
                  setSitesChartType(v);
                }} />

            </div>
            {sitesByStatus.length === 0 ?
            <p className="text-sm text-text-secondary">No sites yet.</p> :

            <StatusBreakdown data={sitesByStatus} type={sitesChartType} />
            }
          </Card>
        </div>
      </section>
      }

      {/* Fosters — hidden entirely for non-foster orgs. */}
      {fostersEnabled &&
      <section>
        <SectionTitle>Fosters</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="New foster parents (range)"
            value={newFostersInRange} />

          <MetricCard
            label="Active foster homes"
            value={activeFosterHomes}
            hint={`${activePlacementsCount} animals placed`} />

          <MetricCard
            label="Available Foster Spots"
            value={availableCapacity}
            hint={`${activePlacementsCount} / ${totalCapacity} occupied`} />

        </div>
      </section>
      }

      {/* Clinic */}
      <section>
        <SectionTitle>Clinics</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard
            label="Spay/neuters completed"
            value={spayNeuterCompleted}
            hint="In selected range" />

          <MetricCard
            label="Vaccines completed"
            value={vaccinesCompleted}
            hint="In selected range" />

          <MetricCard
            label="Upcoming clinic events"
            value={upcomingClinics.length}
            hint={
            upcomingClinics.length > 0 ?
            `${upcomingClinics.reduce((s, c) => s + c.filled, 0)}/${upcomingClinics.reduce((s, c) => s + c.capacity, 0)} slots filled` :
            'Next 5 shown below'
            } />

        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Completed medical records by type
            </h3>
            {medicalByType.length === 0 ?
            <p className="text-sm text-text-secondary">
                No completed records in this range.
              </p> :

            <ResponsiveContainer width="100%" height={240}>
                <BarChart data={medicalByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                  <XAxis dataKey="label" stroke="#6B6B6B" fontSize={11} />
                  <YAxis stroke="#6B6B6B" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count">
                    {medicalByType.map((_d, i) =>
                  <Cell key={i} fill={NEUTRAL_BARS[i % NEUTRAL_BARS.length]} />
                  )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Upcoming clinic events
            </h3>
            {upcomingClinics.length === 0 ?
            <p className="text-sm text-text-secondary">
                No upcoming events scheduled.
              </p> :

            <div className="space-y-2">
                {upcomingClinics.map(({ event: e, filled, capacity }) => {
                const full = capacity > 0 && filled >= capacity;
                return (
                  <Link
                    key={e.id}
                    to="/medical"
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border hover:bg-background transition-colors">

                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {e.location || 'Clinic event'}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {formatDate(e.date_time.split('T')[0])}
                        </p>
                      </div>
                      <span
                      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                      full ?
                      'bg-status-medical-bg text-status-medical-text' :
                      'bg-status-adoptable-bg text-status-adoptable-text'}`
                      }>

                        {filled}/{capacity} {full ? 'full' : 'filled'}
                      </span>
                    </Link>);

              })}
              </div>
            }
          </Card>
        </div>
      </section>

      {/* Supply Requests — financial data; admins + MANAGE_SUPPLY_REQUESTS, or
          everyone when "Show All Reports" is on. For unauthorized users the
          underlying total_cost is also absent from the data (see loadCoordination). */}
      {canViewSupply &&
      <section>
        <SectionTitle>Supply Requests</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <MetricCard label="Order cost" value={formatUSD(orderCostTotal)} />
          <MetricCard
            label="Orders placed"
            value={fulfilledOrdersInRange.length} />

          <MetricCard
            label="Avg order spend"
            value={avgOrderSpend != null ? formatUSD(avgOrderSpend) : '—'} />

        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Spend by category
            </h3>
            {spendByCategory.length === 0 ?
            <p className="text-sm text-text-secondary">
                No spend recorded in this range.
              </p> :

            <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-text-secondary border-b border-border">
                  <tr>
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {spendByCategory.map((row) =>
                <tr key={row.category}>
                      <td className="py-2.5 capitalize text-text-primary">
                        {row.label}
                      </td>
                      <td className="py-2.5 text-right text-text-primary">
                        {formatUSD(row.total)}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            }
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">
              Spend by month
            </h3>
            {spendByMonth.length === 0 || orderCostTotal === 0 ?
            <p className="text-sm text-text-secondary">
                No spend recorded in this range.
              </p> :

            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={spendByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                  <XAxis dataKey="label" stroke="#6B6B6B" fontSize={11} />
                  <YAxis
                  stroke="#6B6B6B"
                  fontSize={11}
                  tickFormatter={(v) => `$${v}`} />

                  <Tooltip
                  formatter={(v) => formatUSD(Number(v) || 0)} />


                  <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3E7B52"
                  strokeWidth={2}
                  name="Total spend" />

                </LineChart>
              </ResponsiveContainer>
            }
          </Card>
        </div>
      </section>
      }
    </div>);

}
