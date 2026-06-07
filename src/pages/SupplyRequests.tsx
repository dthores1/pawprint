import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { SupplyRequestDetailModal } from '../components/supplies/SupplyRequestDetailModal';
import { NewSupplyRequestModal } from '../components/supplies/NewSupplyRequestModal';
import {
  PackageOpenIcon,
  PlusIcon,
  AlertCircleIcon,
  RepeatIcon,
  Trash2Icon,
  BookmarkIcon,
  PackageIcon } from
'lucide-react';
import { formatDate, cn, animalDisplayName } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { SupplyRequest, SupplyRequestStatus } from '../types';
import { motion } from 'framer-motion';
const STATUS_LABELS: Record<SupplyRequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  denied: 'Denied'
};
const STATUS_COLORS: Record<SupplyRequestStatus, string> = {
  submitted: 'bg-[#E5E2DC] text-[#6B6B6B]',
  in_progress: 'bg-[#F8E7C8] text-[#A36B00]',
  fulfilled: 'bg-[#DDEFE2] text-[#3E7B52]',
  cancelled: 'bg-[#F5D7D7] text-[#9B3A3A]',
  denied: 'bg-[#F5D7D7] text-[#9B3A3A]'
};
export function SupplyRequests() {
  const {
    supplyRequests,
    peopleIndex: people,
    animalsIndex: animals,
    supplyRequestItems,
    products,
    addSupplyRequest,
    addSupplyRequestItem,
    updateSupplyRequest
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'common'>(
    'active'
  );
  const activeRequests = supplyRequests.
  filter(
    (r) =>
    r.status !== 'fulfilled' &&
    r.status !== 'cancelled' &&
    r.status !== 'denied'
  ).
  sort(
    (a, b) =>
    new Date(b.requested_date).getTime() -
    new Date(a.requested_date).getTime()
  );
  const completedRequests = supplyRequests.
  filter(
    (r) =>
    r.status === 'fulfilled' ||
    r.status === 'cancelled' ||
    r.status === 'denied'
  ).
  sort(
    (a, b) =>
    new Date(b.requested_date).getTime() -
    new Date(a.requested_date).getTime()
  );
  const displayRequests =
  activeTab === 'active' ? activeRequests : completedRequests;

  // Common requests — only the current user's saved templates.
  const itemsFor = (requestId: string) =>
  supplyRequestItems.filter((i) => i.supply_request_id === requestId);
  const summarizeItems = (requestId: string) => {
    const its = itemsFor(requestId);
    const names = its.
    slice(0, 2).
    map((item) =>
    item.product_id ?
    products.find((p) => p.id === item.product_id)?.name ??
    item.custom_item_name :
    item.custom_item_name
    ).
    filter(Boolean);
    return (
      names.join(', ') + (its.length > 2 ? ` +${its.length - 2} more` : ''));

  };
  const myCommonRequests = supplyRequests.
  filter(
    (r) => r.is_common_request && r.requester_person_id === currentPersonId
  ).
  sort((a, b) => {
    const at = a.common_request_last_used_at ?
    new Date(a.common_request_last_used_at).getTime() :
    0;
    const bt = b.common_request_last_used_at ?
    new Date(b.common_request_last_used_at).getTime() :
    0;
    if (bt !== at) return bt - at;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Resubmit: create a fresh request copied from the template, bump its
  // last-used (never mutate the template otherwise).
  const handleResubmit = async (template: SupplyRequest) => {
    const tplItems = itemsFor(template.id);
    const newId = await addSupplyRequest({
      requester_person_id: currentPersonId ?? '',
      status: 'submitted',
      priority: template.priority,
      requested_date: new Date().toISOString(),
      notes: template.notes || undefined,
      is_common_request: false
    });
    if (!newId) return;
    await Promise.all(
      tplItems.map((it) =>
      addSupplyRequestItem({
        supply_request_id: newId,
        product_id: it.product_id ?? undefined,
        custom_item_name: it.custom_item_name ?? undefined,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes ?? undefined
      })
      )
    );
    updateSupplyRequest(template.id, {
      common_request_last_used_at: new Date().toISOString()
    });
    setActiveTab('active');
  };
  // Remove: unsave the template (the original request stays in history).
  const handleRemoveCommon = (template: SupplyRequest) => {
    if (
    window.confirm(
      'Remove this common request? The original request stays in your history.'
    ))
    {
      updateSupplyRequest(template.id, { is_common_request: false });
    }
  };
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <PackageOpenIcon className="w-8 h-8 text-[#D98C5F]" />
            Supply Requests
          </h1>
          <p className="text-text-secondary mt-1">
            Keep fosters stocked and animals cared for.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/supplies/catalog">
            <Button variant="soft" className="gap-2">
              <PackageIcon className="w-4 h-4" />
              Manage Product Options
            </Button>
          </Link>
          <Button onClick={() => setIsNewModalOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Request Supplies
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('active')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'active' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>
          
          Active Requests ({activeRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'completed' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          Completed & Cancelled
        </button>
        <button
          onClick={() => setActiveTab('common')}
          className={cn(
            'px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
            activeTab === 'common' ?
            'border-primary text-primary' :
            'border-transparent text-text-secondary hover:text-text-primary'
          )}>

          Common Requests ({myCommonRequests.length})
        </button>
      </div>

      {activeTab === 'common' ?
      myCommonRequests.length === 0 ?
      <Card className="p-12 text-center">
          <BookmarkIcon className="w-12 h-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No common requests saved
          </h3>
          <p className="text-text-secondary">
            On the New Supply Request form, tick “Save as common request” to keep
            a reusable bundle here.
          </p>
        </Card> :

      <div className="grid gap-3">
          {myCommonRequests.map((req) =>
        <Card key={req.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookmarkIcon className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="font-heading font-bold text-text-primary truncate">
                      {req.common_request_name?.trim() ||
                  summarizeItems(req.id) ||
                  'Common request'}
                    </h3>
                  </div>
                  <p className="text-sm text-text-secondary mt-1 truncate">
                    {summarizeItems(req.id) || 'No items'}
                  </p>
                  <p className="text-xs text-text-secondary/80 mt-0.5">
                    {req.common_request_last_used_at ?
                `Last used ${formatDate(req.common_request_last_used_at)}` :
                'Not used yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                size="sm"
                onClick={() => handleResubmit(req)}
                className="gap-1.5">

                    <RepeatIcon className="w-4 h-4" />
                    Resubmit
                  </Button>
                  <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCommon(req)}
                className="gap-1.5 text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60">

                    <Trash2Icon className="w-4 h-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
        )}
        </div> :
      displayRequests.length === 0 ?
      <Card className="p-12 text-center">
          <PackageOpenIcon className="w-12 h-12 text-border mx-auto mb-4" />
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No {activeTab} requests
          </h3>
          <p className="text-text-secondary">
            {activeTab === 'active' ?
          'All caught up! Fosters and animals have what they need.' :
          'No completed requests yet.'}
          </p>
        </Card> :

      <div className="grid gap-4">
          {displayRequests.map((request) => {
          const requester = people.find(
            (p) => p.id === request.requester_person_id
          );
          const animal = request.requested_for_animal_id ?
          animals.find((a) => a.id === request.requested_for_animal_id) :
          null;
          const items = supplyRequestItems.filter(
            (i) => i.supply_request_id === request.id
          );
          // Generate a summary string of items
          const itemSummary =
          items.
          slice(0, 2).
          map((item) => {
            const product = item.product_id ?
            products.find((p) => p.id === item.product_id) :
            null;
            return product ? product.name : item.custom_item_name;
          }).
          join(', ') + (
          items.length > 2 ? ` +${items.length - 2} more` : '');
          return (
            <motion.div
              key={request.id}
              initial={{
                opacity: 0,
                y: 10
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                duration: 0.2
              }}>
              
                <Card
                className={cn(
                  'p-5 hover:border-primary/30 transition-colors cursor-pointer group',
                  request.priority !== 'normal' &&
                  request.status !== 'fulfilled' &&
                  request.status !== 'cancelled' &&
                  request.status !== 'denied' ?
                  'border-[#9B3A3A]/30 bg-[#F5D7D7]/10' :
                  ''
                )}
                onClick={() => setSelectedRequestId(request.id)}>
                
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                      {/* Requester */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <Avatar
                        src={requester?.photo_url}
                        type="person"
                        name={
                        requester ?
                        `${requester.first_name} ${requester.last_name}` :
                        undefined
                        }
                        tone="peach"
                        className="w-12 h-12 text-[15px]" />
                      
                        <p className="font-medium text-text-primary group-hover:text-primary transition-colors">
                          {requester?.first_name} {requester?.last_name}
                        </p>
                      </div>

                      {/* Animal — show animal or "no animal" placeholder */}
                      <div className="hidden sm:flex items-center gap-3 min-w-[200px] border-l border-border/60 pl-6">
                        {animal ?
                      <>
                            <Avatar
                          src={animal.primary_photo_url}
                          type="animal"
                          name={animal.name ?? undefined}
                          species={animal.species}
                          className="w-12 h-12 text-[15px]" />
                        
                            <p className="font-medium text-text-primary">
                              {animalDisplayName(animal)}
                            </p>
                          </> :

                      <>
                            <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shrink-0">
                              <PackageIcon className="w-5 h-5 text-text-secondary/50" />
                            </div>
                            <p className="text-sm text-text-secondary italic">
                              General supplies
                            </p>
                          </>
                      }
                      </div>
                    </div>

                    {/* Items Summary */}
                    <div className="flex-1 text-sm text-text-secondary hidden md:block">
                      <p className="truncate max-w-[250px]">{itemSummary}</p>
                    </div>

                    {/* Status & Date */}
                    <div className="flex items-center gap-4 md:min-w-[200px] justify-end">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-text-secondary">
                          {formatDate(request.requested_date)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium',
                          STATUS_COLORS[request.status]
                        )}>
                        
                          {STATUS_LABELS[request.status]}
                        </span>
                        {request.priority !== 'normal' &&
                      request.status !== 'fulfilled' &&
                      request.status !== 'cancelled' &&
                      request.status !== 'denied' &&
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9B3A3A]">
                              <AlertCircleIcon className="w-3 h-3" />
                              {request.priority}
                            </span>
                      }
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>);

        })}
        </div>
      }

      <NewSupplyRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)} />
      

      <SupplyRequestDetailModal
        isOpen={!!selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId} />
      
    </div>);

}