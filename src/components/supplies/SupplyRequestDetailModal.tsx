import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useWhisker } from '../../context/WhiskerContext';
import { SupplyRequestStatus } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { PackageOpenIcon, XCircleIcon } from 'lucide-react';
interface SupplyRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string | null;
}
const STATUS_FLOW: SupplyRequestStatus[] = [
'submitted',
'reviewing',
'approved',
'ordered',
'ready_for_pickup',
'delivered',
'completed'];

const STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  approved: 'Approved',
  ordered: 'Ordered',
  ready_for_pickup: 'Ready for Pickup',
  delivered: 'Delivered',
  completed: 'Completed',
  canceled: 'Canceled'
};
const STATUS_DOT: Record<SupplyRequestStatus, string> = {
  submitted: 'bg-[#6B6B6B]',
  reviewing: 'bg-[#A36B00]',
  approved: 'bg-[#356A9A]',
  ordered: 'bg-[#6E4E80]',
  ready_for_pickup: 'bg-[#B8632E]',
  delivered: 'bg-[#3E7B52]',
  completed: 'bg-[#3E7B52]',
  canceled: 'bg-[#9B3A3A]'
};
const STATUS_PILL: Record<SupplyRequestStatus, string> = {
  submitted: 'bg-[#E5E2DC] text-[#6B6B6B]',
  reviewing: 'bg-[#F8E7C8] text-[#A36B00]',
  approved: 'bg-[#DCEAF7] text-[#356A9A]',
  ordered: 'bg-[#E8DEEC] text-[#6E4E80]',
  ready_for_pickup: 'bg-[#F3E4D7] text-[#B8632E]',
  delivered: 'bg-[#DDEFE2] text-[#3E7B52]',
  completed: 'bg-[#DDEFE2] text-[#3E7B52]',
  canceled: 'bg-[#F5D7D7] text-[#9B3A3A]'
};
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
  if (!requestId) return null;
  const request = supplyRequests.find((r) => r.id === requestId);
  if (!request) return null;
  const items = supplyRequestItems.filter(
    (i) => i.supply_request_id === requestId
  );
  const requester = people.find((p) => p.id === request.requester_person_id);
  // "For animal" intentionally not surfaced — supplies don't map 1:1 to a
  // single animal. Mirror of the create form (NewSupplyRequestModal).
  const approver = request.approved_by_person_id ?
  people.find((p) => p.id === request.approved_by_person_id) :
  null;
  const fulfiller = request.fulfilled_by_person_id ?
  people.find((p) => p.id === request.fulfilled_by_person_id) :
  null;
  const currentStatusIndex = STATUS_FLOW.indexOf(request.status);
  const isCanceled = request.status === 'canceled';
  const isComplete = request.status === 'completed';
  // Build a soft history list from available fields. We don't have a true
  // per-status audit log, so we surface the events we can derive.
  const history: {
    label: string;
    date?: string;
  }[] = [];
  history.push({
    label: 'Submitted',
    date: request.created_at
  });
  if (approver) {
    history.push({
      label: `Approved by ${approver.first_name} ${approver.last_name}`
    });
  }
  if (request.fulfilled_date && fulfiller) {
    history.push({
      label: `Fulfilled by ${fulfiller.first_name} ${fulfiller.last_name}`,
      date: request.fulfilled_date
    });
  }
  // If current status differs from "submitted" and isn't already represented above,
  // add a final "Marked as ..." entry stamped at updated_at.
  if (
  request.status !== 'submitted' &&
  !isCanceled &&
  !(isComplete && fulfiller) // already covered by fulfillment line
  ) {
    history.push({
      label: `Marked as ${STATUS_LABELS[request.status]}`,
      date: request.updated_at
    });
  }
  if (isCanceled) {
    history.push({
      label: 'Canceled',
      date: request.updated_at
    });
  }
  const handleStatusChange = (newStatus: SupplyRequestStatus) => {
    updateSupplyRequest(request.id, {
      status: newStatus
    });
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Details"
      className="max-w-2xl">
      
      <div className="space-y-8">
        {/* Header Info */}
        <div className="flex items-center gap-4">
          <Avatar src={requester?.photo_url} type="person" size="md" />
          <div>
            <p className="text-xs uppercase tracking-wider text-text-secondary mb-0.5">
              Requested by
            </p>
            <p className="font-medium text-text-primary text-lg">
              {requester?.first_name} {requester?.last_name}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {formatDate(request.requested_date)}
            </p>
          </div>
        </div>

        {/* Status — softer, current-emphasis layout */}
        <div className="bg-background rounded-2xl p-5 border border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-text-secondary mb-2">
                Current Status
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold',
                    STATUS_PILL[request.status]
                  )}>
                  
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      STATUS_DOT[request.status]
                    )} />
                  
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
          </div>

          {/* History */}
          {history.length > 0 &&
          <div className="mt-5 pt-5 border-t border-border">
              <p className="text-xs uppercase tracking-wider text-text-secondary mb-3">
                History
              </p>
              <ul className="space-y-2">
                {history.map((entry, i) =>
              <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/40 mt-2 shrink-0" />
                    <span className="flex-1 text-text-primary">
                      {entry.label}
                    </span>
                    {entry.date &&
                <span className="text-text-secondary text-xs whitespace-nowrap">
                        {formatDate(entry.date)}
                      </span>
                }
                  </li>
              )}
              </ul>
            </div>
          }

          {/* Quick Actions */}
          {!isCanceled && currentStatusIndex < STATUS_FLOW.length - 1 &&
          <div className="mt-5 pt-5 border-t border-border flex flex-col sm:flex-row justify-end gap-2">
              <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange('canceled')}
              className="text-text-secondary hover:text-[#9B3A3A]">
              
                Cancel Request
              </Button>
              <Button
              size="sm"
              onClick={() =>
              handleStatusChange(STATUS_FLOW[currentStatusIndex + 1])
              }>
              
                Mark as {STATUS_LABELS[STATUS_FLOW[currentStatusIndex + 1]]}
              </Button>
            </div>
          }

          {isCanceled &&
          <div className="mt-5 flex items-center gap-2 text-[#9B3A3A] bg-[#F5D7D7]/60 p-3 rounded-lg text-sm">
              <XCircleIcon className="w-4 h-4 shrink-0" />
              <span>This request was canceled.</span>
            </div>
          }
        </div>

        {/* Line Items */}
        <div>
          <h4 className="font-semibold text-text-primary mb-3">
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
                  const name = product ? product.name : item.custom_item_name;
                  return (
                    <tr key={item.id} className="bg-card">
                      <td className="py-3 px-4 font-medium text-text-primary">
                        {name}
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

        {/* Notes */}
        {request.notes &&
        <div>
            <h4 className="font-semibold text-text-primary mb-2">
              Additional Notes
            </h4>
            <div className="bg-[#F3E4D7]/30 p-4 rounded-xl text-sm text-text-primary border border-[#D98C5F]/20">
              {request.notes}
            </div>
          </div>
        }
      </div>
    </Modal>);

}