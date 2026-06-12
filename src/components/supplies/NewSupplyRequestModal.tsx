import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { ProductSearchPicker } from '../ui/ProductSearchPicker';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import {
  SupplyRequest,
  SupplyRequestPriority,
  SupplyRequestItem } from
'../../types';
import { PlusIcon, Trash2Icon, BookmarkIcon, BookmarkCheckIcon, RepeatIcon } from 'lucide-react';

// Cap how many common requests one person keeps; saving a new one beyond this
// demotes their least-recently-used template.
const MAX_COMMON_REQUESTS = 5;

interface NewSupplyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}
// Common units used across the catalog plus a few useful extras.
// Kept singular for consistency in display ("2 can", "1 case") — could
// be pluralized later by a small helper if desired.
const UNIT_OPTIONS = [
'each',
'can',
'case',
'pack',
'bag',
'box',
'bottle',
'tub',
'pouch',
'lb',
'kg',
'gallon',
'dozen'];

type DraftItem = Partial<SupplyRequestItem>;
const emptyItem = (): DraftItem => ({
  product_id: '',
  quantity: 1,
  unit: 'each',
  notes: '',
  product_url: ''
});

// Order-insensitive content fingerprint (items + priority + notes) used to avoid
// saving a duplicate common request when the content matches an existing one.
type SigItem = {
  product_id?: string;
  custom_item_name?: string;
  quantity?: number | string;
  unit?: string;
  notes?: string;
};
function requestSignature(
items: SigItem[],
priority: string,
notes?: string)
: string {
  const itemSigs = items.
  map((it) => {
    const isCustom = !it.product_id;
    return [
    isCustom ?
    `c:${(it.custom_item_name || '').trim().toLowerCase()}` :
    `p:${it.product_id}`,
    `q:${Number(it.quantity) || 1}`,
    `u:${it.unit || 'each'}`,
    `n:${(it.notes || '').trim().toLowerCase()}`].
    join('|');
  }).
  sort();
  return JSON.stringify({
    items: itemSigs,
    priority,
    notes: (notes || '').trim().toLowerCase()
  });
}
export function NewSupplyRequestModal({
  isOpen,
  onClose
}: NewSupplyRequestModalProps) {
  const {
    addSupplyRequest,
    addSupplyRequestItem,
    updateSupplyRequest,
    supplyRequests,
    supplyRequestItems,
    products,
    people
  } = useWhisker();
  const { currentPersonId } = useAuth();
  const currentPerson = people.find((p) => p.id === currentPersonId);
  const currentDisplayName = currentPerson ?
  `${currentPerson.first_name} ${currentPerson.last_name}` :
  'You';
  const [priority, setPriority] = useState<SupplyRequestPriority>('normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [itemsError, setItemsError] = useState<string | undefined>();
  const [saveAsCommon, setSaveAsCommon] = useState(false);
  const [commonName, setCommonName] = useState('');
  // Set when the form was prefilled from a common request — bumps that
  // template's last-used time on submit (the template itself is never reused).
  const [usedTemplateId, setUsedTemplateId] = useState<string | null>(null);
  const reset = () => {
    setPriority('normal');
    setNotes('');
    setItems([emptyItem()]);
    setItemsError(undefined);
    setSaveAsCommon(false);
    setCommonName('');
    setUsedTemplateId(null);
  };

  const itemsForRequest = (requestId: string) =>
  supplyRequestItems.filter((i) => i.supply_request_id === requestId);
  const itemLabel = (it: { product_id?: string; custom_item_name?: string }) =>
  it.product_id ?
  products.find((p) => p.id === it.product_id)?.name ?? 'Item' :
  it.custom_item_name || 'Custom item';
  const deriveName = (
  its: { product_id?: string; custom_item_name?: string }[]) =>
  {
    const names = its.map(itemLabel).filter(Boolean);
    if (names.length === 0) return '';
    if (names.length <= 2) return names.join(' + ');
    return `${names.slice(0, 2).join(' + ')} +${names.length - 2} more`;
  };

  // The current user's common-request templates, most-recently-used first.
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
  const commonLabel = (req: SupplyRequest) =>
  req.common_request_name?.trim() ||
  deriveName(itemsForRequest(req.id)) ||
  'Common request';

  const applyCommonRequest = (req: SupplyRequest) => {
    const tplItems = itemsForRequest(req.id);
    setItems(
      tplItems.length ?
      tplItems.map((it) =>
      it.product_id ?
      {
        product_id: it.product_id,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes ?? ''
      } :
      {
        custom_item_name: it.custom_item_name,
        quantity: it.quantity,
        unit: it.unit,
        notes: it.notes ?? ''
      }
      ) :
      [emptyItem()]
    );
    setPriority(req.priority);
    setNotes(req.notes ?? '');
    setSaveAsCommon(false);
    setCommonName('');
    setUsedTemplateId(req.id);
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleAddItem = () => {
    setItems([...items, emptyItem()]);
  };
  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  const handleItemChange = (
  index: number,
  field: keyof SupplyRequestItem,
  value: any) =>
  {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    // Auto-fill unit if a catalog product is selected
    if (field === 'product_id' && value !== 'custom' && value !== '') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].unit = product.default_unit;
      }
    }
    setItems(newItems);
    if (itemsError) setItemsError(undefined);
  };
  // Product/custom is set together (mutually exclusive) by the search picker.
  const handleProductChange = (
  index: number,
  next: { product_id?: string; custom_item_name?: string }) =>
  {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      product_id: next.product_id ?? '',
      custom_item_name: next.custom_item_name
    };
    if (next.product_id) {
      const product = products.find((p) => p.id === next.product_id);
      if (product) newItems[index].unit = product.default_unit;
    }
    setItems(newItems);
    if (itemsError) setItemsError(undefined);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setItemsError('Add at least one item.');
      return;
    }
    // Filter out empty items
    const validItems = items.filter(
      (i) => i.product_id || i.custom_item_name
    );
    if (validItems.length === 0) {
      setItemsError('Select a product or enter a custom item.');
      return;
    }
    // Don't create a duplicate template: if "save as common" is on but the
    // content already matches one of the user's common requests, treat it as a
    // reuse of that one (bump its last-used) instead of saving a new copy.
    const draftSig = requestSignature(validItems, priority, notes);
    const duplicateCommon = myCommonRequests.find(
      (r) =>
      requestSignature(itemsForRequest(r.id), r.priority, r.notes) === draftSig
    );
    const createCommon = saveAsCommon && !duplicateCommon;
    // Create the request first; its id keys the line items.
    const requestId = await addSupplyRequest({
      requester_person_id: currentPersonId ?? '',
      // requested_for_animal_id intentionally omitted — supplies don't map
      // 1:1 to a single animal. See commented-out "For Animal" field below.
      status: 'submitted',
      priority,
      requested_date: new Date().toISOString(),
      notes: notes.trim() || undefined,
      is_common_request: createCommon,
      common_request_name: createCommon ?
      commonName.trim() || deriveName(validItems) || undefined :
      undefined
    });
    if (!requestId) return;
    await Promise.all(
      validItems.map((item) =>
      addSupplyRequestItem({
        supply_request_id: requestId,
        product_id: item.product_id || undefined,
        custom_item_name: item.custom_item_name || undefined,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'each',
        notes: item.notes?.trim() || undefined,
        product_url: item.product_url?.trim() || undefined
      })
      )
    );
    // Bump the source template's last-used time (don't otherwise touch it):
    // either the one explicitly reused, or the matching duplicate we collapsed
    // into when "save as common" had no real changes.
    const templateToBump =
    usedTemplateId ?? (saveAsCommon ? duplicateCommon?.id ?? null : null);
    if (templateToBump) {
      updateSupplyRequest(templateToBump, {
        common_request_last_used_at: new Date().toISOString()
      });
    }
    // Cap common requests per person: demote the least-recently-used templates
    // beyond the limit (keeping the new one + the most-recent existing).
    if (createCommon) {
      myCommonRequests.
      slice(MAX_COMMON_REQUESTS - 1).
      forEach((r) => updateSupplyRequest(r.id, { is_common_request: false }));
    }
    handleClose();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Supplies"
      className="max-w-2xl"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-supply-request-form">
            Submit Request
          </Button>
        </div>
      }>

      <form
        id="new-supply-request-form"
        onSubmit={handleSubmit}
        className="space-y-6"
        noValidate>
        {/* Reuse one of the requester's saved common requests. */}
        {myCommonRequests.length > 0 &&
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15">
            <div className="flex items-center gap-2 mb-2">
              <RepeatIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-text-primary">
                Use a common request?
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {myCommonRequests.slice(0, MAX_COMMON_REQUESTS).map((req) => {
              const active = usedTemplateId === req.id;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => applyCommonRequest(req)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-border hover:border-primary/50 hover:text-text-primary'}`}>

                    {commonLabel(req)}
                  </button>);

            })}
            </div>
          </div>
        }

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Requesting as</Label>
            <div className="h-11 px-3.5 flex items-center rounded-lg border border-border bg-background/60 text-sm font-medium text-text-primary">
              {currentDisplayName}
            </div>
          </div>
          <div>
            <Label htmlFor="priority" required>Priority</Label>
            <Select
              id="priority"
              value={priority}
              onChange={(e) =>
              setPriority(e.target.value as SupplyRequestPriority)
              }>

              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
        </div>

        {/*
          Admin / staff only: "Create request on behalf of…" with a search
          lookup over the Contact / Foster Parent table. Stubbed until we
          have roles + permissions.

          {isAdmin && (
            <div>
              <Label htmlFor="onBehalfOf">Create request on behalf of…</Label>
              <PersonSearchInput
                value={onBehalfOfId}
                onChange={setOnBehalfOfId}
                people={people}
                placeholder="Search contacts and foster parents…"
              />
            </div>
          )}
        */}

        {/*
          "For Animal" intentionally removed — supplies rarely map cleanly to
          a single animal. Keeping this comment as a marker in case we
          revisit; the SupplyRequest schema still has `requested_for_animal_id`
          as optional, so re-enabling is a UI-only change.

          <div>
            <Label htmlFor="animal">For Animal (Optional)</Label>
            <Select
              id="animal"
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}>
              <option value="">General / No specific animal</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>{a.name} (#{a.id})</option>
              ))}
            </Select>
          </div>
        */}

        {/* Items — card-style stacked layout */}
        <div>
          <Label className="mb-3" required>Items</Label>

          <div className="space-y-3">
            {items.map((item, index) => {
              return (
                <div
                  key={index}
                  className={`p-4 bg-card rounded-xl border space-y-3 ${itemsError ? 'border-red-500' : 'border-border'}`}>
                  
                  {/* Header row: item number + remove */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
                      Item {index + 1}
                    </span>
                    {items.length > 1 &&
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-[#9B3A3A] transition-colors">
                      
                        <Trash2Icon className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    }
                  </div>

                  {/* Product picker — searchable, with an "Other" free-text option */}
                  <div>
                    <Label htmlFor={`product-${index}`} className="text-xs" required>
                      Product
                    </Label>
                    <ProductSearchPicker
                      id={`product-${index}`}
                      products={products}
                      value={{
                        product_id: item.product_id,
                        custom_item_name: item.custom_item_name
                      }}
                      onChange={(next) => handleProductChange(index, next)} />

                  </div>

                  {/* Quantity + Unit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`qty-${index}`} className="text-xs" required>
                        Quantity
                      </Label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity ?? ''}
                        onChange={(e) =>
                        handleItemChange(index, 'quantity', e.target.value)
                        } />
                      
                    </div>
                    <div>
                      <Label htmlFor={`unit-${index}`} className="text-xs" required>
                        Unit
                      </Label>
                      <Select
                        id={`unit-${index}`}
                        value={item.unit || 'each'}
                        onChange={(e) =>
                        handleItemChange(index, 'unit', e.target.value)
                        }>
                        
                        {UNIT_OPTIONS.map((u) =>
                        <option key={u} value={u}>
                            {u}
                          </option>
                        )}
                        {/* If the unit doesn't match the list (e.g. legacy), still include it */}
                        {item.unit && !UNIT_OPTIONS.includes(item.unit) &&
                        <option value={item.unit}>{item.unit}</option>
                        }
                      </Select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor={`notes-${index}`} className="text-xs">
                      Notes (optional)
                    </Label>
                    <Input
                      id={`notes-${index}`}
                      placeholder="Brand preference, dietary notes…"
                      value={item.notes || ''}
                      onChange={(e) =>
                      handleItemChange(index, 'notes', e.target.value)
                      } />

                  </div>

                  {/* Product link */}
                  <div>
                    <Label htmlFor={`product_url-${index}`} className="text-xs">
                      Product link (optional)
                    </Label>
                    <Input
                      id={`product_url-${index}`}
                      type="url"
                      placeholder="https://www.amazon.com/…  or  https://www.chewy.com/…"
                      value={item.product_url || ''}
                      onChange={(e) =>
                      handleItemChange(index, 'product_url', e.target.value)
                      } />

                  </div>
                </div>);

            })}
          </div>
          <FieldError>{itemsError}</FieldError>

          {/* Add another item — full-width dashed CTA */}
          <button
            type="button"
            onClick={handleAddItem}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed border-border text-sm font-medium text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors">
            
            <PlusIcon className="w-4 h-4" />
            Add another item
          </button>
        </div>

        <div>
          <Label htmlFor="notes">General Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery instructions, context..."
            rows={3} />
          
        </div>

        {/* Save as common request — the bookmark icon itself is the toggle. */}
        {/* TODO(persistence): the toggled value is currently dropped on submit;
            see handleSubmit. Wire to a `requestTemplates` store when added. */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border">
          <button
            type="button"
            onClick={() => setSaveAsCommon((v) => !v)}
            aria-pressed={saveAsCommon}
            aria-label={
            saveAsCommon ?
            'Unsave as common request' :
            'Save as common request'
            }
            className={`shrink-0 p-2 rounded-lg transition-colors ${saveAsCommon ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-text-secondary hover:bg-background hover:text-text-primary'}`}>

            {saveAsCommon ?
            <BookmarkCheckIcon className="w-5 h-5" /> :
            <BookmarkIcon className="w-5 h-5" />
            }
          </button>
          <div className="flex-1 pt-0.5">
            <div className="text-sm font-medium text-text-primary">
              {saveAsCommon ?
              'Saved as common request' :
              'Save as common request'}
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Reuse these items next time you need to restock for the same
              situation.
            </p>
            {saveAsCommon &&
            <Input
              value={commonName}
              onChange={(e) => setCommonName(e.target.value)}
              placeholder={
              deriveName(
                items.filter((i) => i.product_id || i.custom_item_name)
              ) || 'e.g. Monthly litter refill'
              }
              className="mt-2"
              maxLength={60} />
            }
          </div>
        </div>
      </form>
    </Modal>);

}