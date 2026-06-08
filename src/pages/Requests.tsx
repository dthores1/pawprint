import { useState } from 'react';
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
  const param = searchParams.get('tab');
  const tab: RequestsTab =
  param === 'transport' || param === 'sitting' ? param : 'supply';
  const [isNewOpen, setIsNewOpen] = useState(false);
  const setTab = (next: RequestsTab) => {
    setIsNewOpen(false);
    setSearchParams(next === 'supply' ? {} : { tab: next }, { replace: true });
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
            Coordinate supplies, transportation, and sitting across the org.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'supply' &&
          <Link to="/supplies/catalog">
              <Button variant="soft" className="gap-2">
                <PackageIcon className="w-4 h-4" />
                Manage Product Options
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

      {tab === 'supply' && <SupplyRequestsView />}
      {tab === 'transport' && <TransportsView />}
      {tab === 'sitting' && <SittingRequestsView />}

      {tab === 'supply' &&
      <NewSupplyRequestModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)} />
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
