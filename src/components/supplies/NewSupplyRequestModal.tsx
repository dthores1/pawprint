import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { SupplyRequestPriority, SupplyRequestItem } from '../../types';
import { PlusIcon, Trash2Icon, BookmarkIcon, BookmarkCheckIcon } from 'lucide-react';

// TODO(auth): replace with the signed-in user once an auth/session layer exists.
// Today the app has no current-user concept (see WhiskerContext); we hardcode
// the demo user so "Requesting as" reads correctly. The Person row exists in
// seed.ts as a foster parent (f3), but Person and FosterParent are separate
// tables — wire requester_person_id properly when auth lands.
const CURRENT_USER = {
  person_id: 'p_dan',
  display_name: 'Dan Thoreson'
};
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
  notes: ''
});
export function NewSupplyRequestModal({
  isOpen,
  onClose
}: NewSupplyRequestModalProps) {
  const { addSupplyRequest, addSupplyRequestItem, products } = useWhisker();
  // Admin-on-behalf-of flow is stubbed until we have roles. When enabled,
  // an admin would pick a contact/foster from `people` here.
  // const { people, animals } = useWhisker();
  const [priority, setPriority] = useState<SupplyRequestPriority>('normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [saveAsCommon, setSaveAsCommon] = useState(false);
  const reset = () => {
    setPriority('normal');
    setNotes('');
    setItems([emptyItem()]);
    setSaveAsCommon(false);
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
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    // Filter out empty items
    const validItems = items.filter(
      (i) => i.product_id && i.product_id !== 'custom' || i.custom_item_name
    );
    if (validItems.length === 0) return;
    const requestId = addSupplyRequest({
      requester_person_id: CURRENT_USER.person_id,
      // requested_for_animal_id intentionally omitted — supplies don't map
      // 1:1 to a single animal. See commented-out "For Animal" field below.
      status: 'submitted',
      priority,
      requested_date: new Date().toISOString(),
      notes: notes.trim() || undefined
    });
    validItems.forEach((item) => {
      addSupplyRequestItem({
        supply_request_id: requestId,
        product_id: item.product_id === 'custom' ? undefined : item.product_id,
        custom_item_name:
        item.product_id === 'custom' ? item.custom_item_name : undefined,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'each',
        notes: item.notes?.trim() || undefined
      });
    });
    // TODO(persistence): "Save as common request" is captured but does not
    // persist — there is no template/abstraction for reusable request
    // bundles yet. Add a `requestTemplates` collection (or similar) in
    // WhiskerContext when persistence lands, then write here.
    handleClose();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Supplies"
      className="max-w-2xl">
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Requesting as</Label>
            <div className="h-11 px-3.5 flex items-center rounded-lg border border-border bg-background/60 text-sm font-medium text-text-primary">
              {CURRENT_USER.display_name}
            </div>
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
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
          <Label className="mb-3">Items *</Label>

          <div className="space-y-3">
            {items.map((item, index) => {
              const isCustom = item.product_id === 'custom';
              return (
                <div
                  key={index}
                  className="p-4 bg-card rounded-xl border border-border space-y-3">
                  
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

                  {/* Product picker */}
                  <div>
                    <Label htmlFor={`product-${index}`} className="text-xs">
                      Product
                    </Label>
                    <Select
                      id={`product-${index}`}
                      value={item.product_id || ''}
                      onChange={(e) =>
                      handleItemChange(index, 'product_id', e.target.value)
                      }
                      required>
                      
                      <option value="">Select an item...</option>
                      {products.map((p) =>
                      <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      )}
                      <option value="custom">Other (custom item)</option>
                    </Select>

                    {isCustom &&
                    <Input
                      placeholder="Custom item name..."
                      value={item.custom_item_name || ''}
                      onChange={(e) =>
                      handleItemChange(
                        index,
                        'custom_item_name',
                        e.target.value
                      )
                      }
                      className="mt-2"
                      required />

                    }
                  </div>

                  {/* Quantity + Unit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`qty-${index}`} className="text-xs">
                        Quantity
                      </Label>
                      <Input
                        id={`qty-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity ?? ''}
                        onChange={(e) =>
                        handleItemChange(index, 'quantity', e.target.value)
                        }
                        required />
                      
                    </div>
                    <div>
                      <Label htmlFor={`unit-${index}`} className="text-xs">
                        Unit
                      </Label>
                      <Select
                        id={`unit-${index}`}
                        value={item.unit || 'each'}
                        onChange={(e) =>
                        handleItemChange(index, 'unit', e.target.value)
                        }
                        required>
                        
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
                </div>);

            })}
          </div>

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
          </div>
        </div>

        <div className="pt-5 flex justify-end gap-3 border-t border-border mt-7">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit">Submit Request</Button>
        </div>
      </form>
    </Modal>);

}