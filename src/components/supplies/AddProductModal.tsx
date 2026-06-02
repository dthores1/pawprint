import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { FieldError, Input, Select, Label } from '../ui/Forms';
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
  const [nameError, setNameError] = useState<string | undefined>();
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
    setNameError(undefined);
  }, [isOpen, product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name is required.');
      return;
    }
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
      title={editing ? 'Edit Product' : 'Add Product'}
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form">
            {editing ? 'Save Changes' : 'Add Product'}
          </Button>
        </div>
      }>

      <form
        id="product-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        noValidate>
        <div>
          <Label htmlFor="product_name" required>Name</Label>
          <Input
            id="product_name"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'product_name_error' : undefined}
            className={nameError && 'border-red-500 focus:ring-red-500'}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(undefined);
            }}
            placeholder="e.g. Kitten Formula" />
          <FieldError id="product_name_error">{nameError}</FieldError>

        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="product_category" required>Category</Label>
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
            <Label htmlFor="product_unit" required>Default unit</Label>
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
      </form>
    </Modal>);

}
