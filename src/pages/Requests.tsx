import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { InboxIcon, PlusIcon, PackageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { SupplyRequestsView } from '../components/requests/SupplyRequestsView';
import { TransportsView } from '../components/requests/TransportsView';
import { SittingRequestsView } from '../components/requests/SittingRequestsView';
import { NewSupplyRequestModal } from '../components/supplies/NewSupplyRequestModal';
import { NewTransportRequestModal } from '../components/transports/NewTransportRequestModal';
import { NewSittingRequestModal } from '../components/sitting/NewSittingRequestModal';
import { useCanManageSupplyRequests } from '../lib/useSupplyPermissions';
import { GuidanceLink } from '../components/guidance/GuidanceLink';
import { useFostersEnabled } from '../lib/useFostersEnabled';
import { track } from '../lib/analytics';

type RequestsTab = 'supply' | 'transport' | 'sitting';
const TABS: { key: RequestsTab; label: string }[] = [
{ key: 'supply', label: 'Supply' },
{ key: 'transport', label: 'Transport' },
{ key: 'sitting', label: 'Sitting' }];

const NEW_LABEL: Record<RequestsTab, string> = {
  supply: 'Request Supplies',
  transport: 'New Transport Request',
  sitting: 'New Sitting Request'
};

export function Requests() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Sitting requests cover foster placements, so the whole tab follows the
  // org's foster-management setting (a shelter has no placements to sit).
  const fostersEnabled = useFostersEnabled();
  const tabs = fostersEnabled ? TABS : TABS.filter((t) => t.key !== 'sitting');
  const param = searchParams.get('tab');
  const tab: RequestsTab =
  param === 'transport' || param === 'sitting' && fostersEnabled ?
  param as RequestsTab :
  'supply';
  const [isNewOpen, setIsNewOpen] = useState(false);
  const canManageSupply = useCanManageSupplyRequests();
  // Deep-link target: ?request=<id> asks the active tab's view to focus/open that
  // request (from the dashboard "Help Needed" widget or a duplicate warning).
  const requestParam = searchParams.get('request');
  const setTab = (next: RequestsTab) => {
    track('tab_viewed', { page: 'requests', tab: next });
    setIsNewOpen(false);
    setSearchParams(next === 'supply' ? {} : { tab: next }, { replace: true });
  };
  // Consume the request param once the view has focused it, keeping the tab.
  const clearRequestParam = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('request');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  // The duplicate-request warning opens the existing request via the same param.
  const openRequest = (id: string) => {
    setIsNewOpen(false);
    setSearchParams({ request: id }, { replace: true });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <InboxIcon className="w-8 h-8 text-primary" />
            Requests
          </h1>
          <p className="text-text-secondary mt-1">
            {fostersEnabled ?
            'Coordinate supplies, transportation, and sitting across the org.' :
            'Coordinate supplies and transportation across the org.'}
          </p>
          <GuidanceLink guidanceKey="requests_intro" />
        </div>
        <div className="flex gap-2">
          {tab === 'supply' && canManageSupply &&
          <Link to="/supplies/options">
              <Button variant="soft" className="gap-2">
                <PackageIcon className="w-4 h-4" />
                Manage Supply Options
              </Button>
            </Link>
          }
          <Button onClick={() => setIsNewOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            {NEW_LABEL[tab]}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) =>
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

      {tab === 'supply' &&
      <SupplyRequestsView
        openRequestId={requestParam}
        onOpenedRequest={clearRequestParam} />
      }
      {tab === 'transport' &&
      <TransportsView
        focusRequestId={requestParam}
        onFocusedRequest={clearRequestParam} />
      }
      {tab === 'sitting' &&
      <SittingRequestsView
        focusRequestId={requestParam}
        onFocusedRequest={clearRequestParam} />
      }

      {tab === 'supply' &&
      <NewSupplyRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onViewExisting={openRequest} />
      }
      {tab === 'transport' &&
      <NewTransportRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />
      }
      {tab === 'sitting' &&
      <NewSittingRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />
      }
    </div>);

}
