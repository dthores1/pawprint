import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Product, ProductCategory } from '../../types';

const CATEGORIES: { value: ProductCategory; label: string }[] = [
{ value: 'food', label: 'Food' },
{ value: 'litter', label: 'Litter' },
{ value: 'medical', label: 'Medical' },
{ value: 'bedding', label: 'Bedding' },
{ value: 'enrichment', label: 'Enrichment' },
{ value: 'cleaning', label: 'Cleaning' },
{ value: 'other', label: 'Other' }];

const UNIT_OPTIONS = [
'each', 'can', 'case', 'pack', 'bag', 'box',
'bottle', 'tub', 'pouch', 'lb', 'kg', 'gallon', 'dozen'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** When set, the modal edits this product instead of creating a new one. */
  product?: Product | null;
}
export function AddProductModal({ isOpen, onClose, product }: Props) {
  const { addProduct, updateProduct } = useWhisker();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('food');
  const [unit, setUnit] = useState('each');
  const [active, setActive] = useState(true);
  const editing = !!product;

  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setUnit(product.default_unit);
      setActive(product.active);
    } else {
      setName('');
      setCategory('food');
      setUnit('each');
      setActive(true);
    }
  }, [isOpen, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editing && product) {
      updateProduct(product.id, {
        name: name.trim(),
        category,
        default_unit: unit,
        active
      });
    } else {
      addProduct({
        name: name.trim(),
        category,
        default_unit: unit,
        active
      });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Edit Product' : 'Add Product'}>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="product_name">Name</Label>
          <Input
            id="product_name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kitten Formula" />

        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="product_category">Category</Label>
            <Select
              id="product_category"
              value={category}
              onChange={(e) =>
              setCategory(e.target.value as ProductCategory)
              }>

              {CATEGORIES.map((c) =>
              <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              )}
            </Select>
          </div>
          <div>
            <Label htmlFor="product_unit">Default unit</Label>
            <Select
              id="product_unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}>

              {UNIT_OPTIONS.map((u) =>
              <option key={u} value={u}>
                  {u}
                </option>
              )}
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />

          Active (available when creating supply requests)
        </label>

        <div className="pt-4 flex justify-end gap-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{editing ? 'Save Changes' : 'Add Product'}</Button>
        </div>
      </form>
    </Modal>);

}
