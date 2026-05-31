import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { SupplyRequestStatus, SupplySupplier } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  MapPinIcon,
  RotateCcwIcon,
  XCircleIcon } from
'lucide-react';

interface SupplyRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string | null;
}

const STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  denied: 'Denied'
};
const STATUS_PILL: Record<SupplyRequestStatus, string> = {
  submitted: 'bg-[#E5E2DC] text-[#6B6B6B]',
  in_progress: 'bg-[#F8E7C8] text-[#A36B00]',
  fulfilled: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  denied: 'bg-[#F5D7D7] text-[#9B3A3A]'
};
const SUPPLIER_OPTIONS: SupplySupplier[] = [
'Amazon',
'Chewy',
'Petco',
'PetSmart',
'Target',
'Walmart',
'Costco',
'Tractor Supply',
'Local Store',
'Other'];


export function SupplyRequestDetailModal({
  isOpen,
  onClose,
  requestId
}: SupplyRequestDetailModalProps) {
  const {
    supplyRequests,
    supplyRequestItems,
    products,
    people,
    updateSupplyRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();

  const request = requestId ?
  supplyRequests.find((r) => r.id === requestId) :
  null;

  // Fulfillment fields are inline-editable; save on blur to keep things simple.
  const [supplier, setSupplier] = useState<string>(request?.supplier ?? '');
  const [totalCost, setTotalCost] = useState<string>(
    request?.total_cost != null ? String(request.total_cost) : ''
  );
  const [addressCopied, setAddressCopied] = useState(false);
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  useEffect(() => {
    setSupplier(request?.supplier ?? '');
    setTotalCost(
      request?.total_cost != null ? String(request.total_cost) : ''
    );
    setAddressCopied(false);
    setDenyMode(false);
    setDenyReason('');
  }, [request?.id, request?.supplier, request?.total_cost]);

  if (!request) return null;

  const items = supplyRequestItems.filter(
    (i) => i.supply_request_id === request.id
  );
  const requester = people.find((p) => p.id === request.requester_person_id);
  const fulfiller = request.fulfilled_by_person_id ?
  people.find((p) => p.id === request.fulfilled_by_person_id) :
  null;
  const approver = request.approved_by_person_id ?
  people.find((p) => p.id === request.approved_by_person_id) :
  null;

  // The requester sees "Cancel Request"; anyone else (a reviewer) sees the
  // "Deny Request" flow with a required reason.
  const isRequester =
  !!currentPersonId && currentPersonId === request.requester_person_id;
  const isTerminal =
  request.status === 'cancelled' ||
  request.status === 'denied' ||
  request.status === 'fulfilled';

  const handleSetStatus = (next: SupplyRequestStatus) => {
    const patch: Partial<typeof request> = { status: next };
    // Stamp the actor on the appropriate column so history can attribute it.
    if (currentPersonId) {
      if (next === 'in_progress' || next === 'denied') {
        patch.approved_by_person_id = currentPersonId;
      } else if (next === 'fulfilled') {
        patch.fulfilled_by_person_id = currentPersonId;
        if (!request.approved_by_person_id) {
          patch.approved_by_person_id = currentPersonId;
        }
      }
    }
    if (next === 'fulfilled' && !request.fulfilled_date) {
      patch.fulfilled_date = new Date().toISOString();
    }
    updateSupplyRequest(request.id, patch);
  };

  const handleConfirmDeny = () => {
    const reason = denyReason.trim();
    if (!reason) return;
    const patch: Partial<typeof request> = {
      status: 'denied',
      denial_reason: reason
    };
    if (currentPersonId) patch.approved_by_person_id = currentPersonId;
    updateSupplyRequest(request.id, patch);
    setDenyMode(false);
    setDenyReason('');
  };

  const saveSupplier = (val: string) => {
    if (val === (request.supplier ?? '')) return;
    updateSupplyRequest(request.id, {
      supplier: val ? val as SupplySupplier : undefined
    });
  };
  const saveTotalCost = () => {
    const trimmed = totalCost.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    if (parsed != null && isNaN(parsed)) return;
    if (parsed === request.total_cost) return;
    updateSupplyRequest(request.id, { total_cost: parsed });
  };

  const handleCopyAddress = async () => {
    if (!requester?.address) return;
    try {
      await navigator.clipboard.writeText(requester.address);
    } catch {
      // clipboard write may be blocked; ignore.
    }
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const personName = (id?: string) => {
    if (!id) return undefined;
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : undefined;
  };

  // Soft, attribution-aware history. Each row reflects an action we can derive
  // from the persisted fields (we don't have a true per-event audit log).
  type HistoryRow = { label: string; actor?: string; date?: string };
  const history: HistoryRow[] = [
  {
    label: 'Submitted',
    actor: personName(request.requester_person_id),
    date: request.created_at
  }];

  if (
  request.status === 'in_progress' ||
  request.status === 'fulfilled' ||
  request.status === 'denied' && request.approved_by_person_id)
  {
    if (request.status === 'in_progress' || request.status === 'fulfilled') {
      history.push({
        label: 'Marked In Progress',
        actor: personName(request.approved_by_person_id)
      });
    }
  }
  if (request.fulfilled_date) {
    history.push({
      label: 'Fulfilled',
      actor: personName(request.fulfilled_by_person_id),
      date: request.fulfilled_date
    });
  }
  if (request.status === 'cancelled') {
    history.push({
      label: 'Cancelled',
      actor: personName(request.requester_person_id),
      date: request.updated_at
    });
  }
  if (request.status === 'denied') {
    history.push({
      label: 'Denied',
      actor: personName(request.approved_by_person_id),
      date: request.updated_at
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Details"
      className="max-w-2xl">

      <div className="space-y-6">
        {/* Header: requester + status pill */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Avatar src={requester?.photo_url} type="person" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-text-secondary">
                Requested by
              </p>
              <p className="font-medium text-text-primary truncate">
                {requester?.first_name} {requester?.last_name}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {formatDate(request.requested_date)}
              </p>
              {requester?.address &&
              <div className="mt-2 flex items-start gap-2">
                  <MapPinIcon className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                  <p className="text-sm text-text-primary whitespace-pre-line flex-1">
                    {requester.address}
                  </p>
                  <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0 px-2 py-0.5 rounded">

                    {addressCopied ?
                  <>
                        <CheckIcon className="w-3.5 h-3.5" /> Copied
                      </> :

                  <>
                        <CopyIcon className="w-3.5 h-3.5" /> Copy
                      </>
                  }
                  </button>
                </div>
              }
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
                STATUS_PILL[request.status]
              )}>

              {STATUS_LABELS[request.status]}
            </span>
            {request.priority !== 'normal' &&
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                request.priority === 'urgent' ?
                'bg-[#F8E7C8] text-[#A36B00]' :
                'bg-[#F5D7D7] text-[#9B3A3A]'
              )}>

                {request.priority}
              </span>
            }
          </div>
        </div>

        {/* Primary actions — contextual to the current status + who's viewing */}
        {denyMode ?
        <div className="space-y-2">
            <Label htmlFor="deny_reason">Reason for denial (required)</Label>
            <Textarea
            id="deny_reason"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            placeholder="Why is this request being denied?"
            rows={2}
            autoFocus />

            <div className="flex flex-wrap gap-2">
              <Button
              size="sm"
              onClick={handleConfirmDeny}
              disabled={!denyReason.trim()}
              className="bg-[#9B3A3A] hover:bg-[#7d2e2e]">

                <BanIcon className="w-4 h-4 mr-1.5" /> Confirm Deny
              </Button>
              <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDenyMode(false);
                setDenyReason('');
              }}>

                Back
              </Button>
            </div>
          </div> :

        <>
            {request.status === 'submitted' &&
          <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleSetStatus('in_progress')}>
                  Start Processing
                </Button>
                {isRequester ?
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetStatus('cancelled')}
              className="text-text-secondary hover:text-[#9B3A3A]">

                    Cancel Request
                  </Button> :

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDenyMode(true)}
              className="text-text-secondary hover:text-[#9B3A3A]">

                    <BanIcon className="w-4 h-4 mr-1.5" /> Deny Request
                  </Button>
            }
              </div>
          }
            {request.status === 'in_progress' &&
          <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleSetStatus('fulfilled')}>
                  <CheckIcon className="w-4 h-4 mr-1.5" /> Mark Fulfilled
                </Button>
                {isRequester ?
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetStatus('cancelled')}
              className="text-text-secondary hover:text-[#9B3A3A]">

                    Cancel Request
                  </Button> :

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDenyMode(true)}
              className="text-text-secondary hover:text-[#9B3A3A]">

                    <BanIcon className="w-4 h-4 mr-1.5" /> Deny Request
                  </Button>
            }
              </div>
          }
            {request.status === 'fulfilled' &&
          <div>
                <Button
              size="sm"
              variant="soft"
              onClick={() => handleSetStatus('in_progress')}>

                  <RotateCcwIcon className="w-4 h-4 mr-1.5" /> Reopen
                </Button>
              </div>
          }
            {request.status === 'cancelled' &&
          <div className="flex items-center gap-2 text-[#9B3A3A] bg-[#F5D7D7]/60 p-3 rounded-lg text-sm">
                <XCircleIcon className="w-4 h-4 shrink-0" />
                <span>This request was cancelled.</span>
              </div>
          }
            {request.status === 'denied' &&
          <div className="flex items-start gap-2 text-[#9B3A3A] bg-[#F5D7D7]/60 p-3 rounded-lg text-sm">
                <BanIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium">
                    Denied
                    {approver ? ` by ${approver.first_name} ${approver.last_name}` : ''}
                  </p>
                  {request.denial_reason &&
              <p className="text-[#9B3A3A]/80 mt-0.5 whitespace-pre-line">
                      {request.denial_reason}
                    </p>
              }
                </div>
              </div>
          }
          </>
        }

        {/* Requested items */}
        <div>
          <h4 className="font-semibold text-text-primary mb-2">
            Requested Items
          </h4>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-background border-b border-border text-text-secondary">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Item</th>
                  <th className="py-2.5 px-4 font-medium w-24">Qty</th>
                  <th className="py-2.5 px-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const product = item.product_id ?
                  products.find((p) => p.id === item.product_id) :
                  null;
                  const name = product ?
                  product.name :
                  item.custom_item_name || 'Item';
                  return (
                    <tr key={item.id} className="bg-card align-top">
                      <td className="py-3 px-4">
                        <p className="font-medium text-text-primary">{name}</p>
                        {item.product_url &&
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">

                            <ExternalLinkIcon className="w-3 h-3" />
                            Product link
                          </a>
                        }
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-text-secondary italic">
                        {item.notes || '—'}
                      </td>
                    </tr>);

                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fulfillment */}
        <div>
          <h4 className="font-semibold text-text-primary mb-2">Fulfillment</h4>
          <div className="border border-border rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier" className="text-xs">
                  Supplier
                </Label>
                <Select
                  id="supplier"
                  value={supplier}
                  onChange={(e) => {
                    setSupplier(e.target.value);
                    saveSupplier(e.target.value);
                  }}>

                  <option value="">—</option>
                  {SUPPLIER_OPTIONS.map((s) =>
                  <option key={s} value={s}>
                      {s}
                    </option>
                  )}
                </Select>
              </div>
              <div>
                <Label htmlFor="total_cost" className="text-xs">
                  Total cost (USD)
                </Label>
                <Input
                  id="total_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  onBlur={saveTotalCost}
                  placeholder="0.00" />

              </div>
            </div>
            {request.notes &&
            <div>
                <p className="text-xs uppercase tracking-wider text-text-secondary mb-1">
                  Fulfillment notes
                </p>
                <p className="text-sm text-text-primary whitespace-pre-line">
                  {request.notes}
                </p>
              </div>
            }
          </div>
        </div>

        {/* History — small + de-emphasized, lives at the bottom */}
        {history.length > 0 &&
        <div className="pt-2">
            <p className="text-xs uppercase tracking-wider text-text-secondary mb-2">
              History
            </p>
            <ul className="space-y-1.5">
              {history.map((entry, i) =>
            <li
              key={i}
              className="flex items-start gap-3 text-xs text-text-secondary">

                  <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/40 mt-1.5 shrink-0" />
                  <span className="flex-1">
                    <strong className="font-semibold text-text-primary">
                      {entry.label}
                    </strong>
                    {entry.actor && <> by {entry.actor}</>}
                  </span>
                  {entry.date &&
              <span className="whitespace-nowrap">
                      {formatDate(entry.date)}
                    </span>
              }
                </li>
            )}
            </ul>
          </div>
        }
      </div>
    </Modal>);

}
