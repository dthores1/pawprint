import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AddProductModal } from '../components/supplies/AddProductModal';
import {
  ArrowLeftIcon,
  PlusIcon,
  PackageIcon,
  Edit2Icon,
  Trash2Icon } from
'lucide-react';
import { cn } from '../lib/utils';
import { Product, ProductCategory } from '../types';
import { ArchiveConfirmDialog } from '../components/archive/ArchiveConfirmDialog';
import { useCanArchive } from '../components/archive/useCanArchive';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  food: 'Food',
  litter: 'Litter',
  medical: 'Medical',
  bedding: 'Bedding',
  enrichment: 'Enrichment',
  cleaning: 'Cleaning',
  other: 'Other'
};
const CATEGORY_TONE: Record<ProductCategory, string> = {
  food: 'bg-[#DDEFE2] text-[#3E7B52]',
  litter: 'bg-[#E5E2DC] text-[#6B6B6B]',
  medical: 'bg-[#F8E7C8] text-[#A36B00]',
  bedding: 'bg-[#DCEAF7] text-[#356A9A]',
  enrichment: 'bg-[#E8DEEC] text-[#6E4E80]',
  cleaning: 'bg-[#F3E4D7] text-[#B8632E]',
  other: 'bg-background text-text-secondary border border-border'
};

export function ProductCatalog() {
  const { products, updateProduct } = useWhisker();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState<Product | null>(null);
  const canArchive = useCanArchive('products', { id: 'na' });

  const sorted = [...products].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6 pb-8">
      <Link
        to="/requests"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

        <ArrowLeftIcon className="w-4 h-4" /> Back to Supply Requests
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary flex items-center gap-3">
            <PackageIcon className="w-8 h-8 text-[#D98C5F]" />
            Product Catalog
          </h1>
          <p className="text-text-secondary mt-1">
            The items volunteers can pick from when requesting supplies.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          Add Product
        </Button>
      </div>

      {sorted.length === 0 ?
      <Card className="p-10 text-center text-text-secondary">
          <PackageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-text-primary mb-1">
            No products yet
          </p>
          <p className="text-sm">
            Add the items your org commonly requests so they're one click away.
          </p>
        </Card> :

      <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {sorted.map((p) =>
          <div
            key={p.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-background/40 transition-colors">

                <div className="flex-1 min-w-0">
                  <p
                className={cn(
                  'font-medium truncate',
                  p.active ? 'text-text-primary' : 'text-text-secondary'
                )}>

                    {p.name}
                    {!p.active &&
                <span className="ml-2 text-xs text-text-secondary">
                        (inactive)
                      </span>
                }
                  </p>
                  <p className="text-xs text-text-secondary">
                    Default unit: {p.default_unit}
                  </p>
                </div>
                <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0',
                CATEGORY_TONE[p.category]
              )}>

                  {CATEGORY_LABEL[p.category]}
                </span>
                <button
              type="button"
              onClick={() =>
              updateProduct(p.id, { active: !p.active })
              }
              className="text-xs font-medium text-primary hover:underline shrink-0 w-20 text-right">

                  {p.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button
              type="button"
              onClick={() => setEditing(p)}
              aria-label={`Edit ${p.name}`}
              className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors shrink-0">

                  <Edit2Icon className="w-4 h-4" />
                </button>
                {canArchive &&
              <button
                type="button"
                onClick={() => setArchiving(p)}
                aria-label={`Archive ${p.name}`}
                className="p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors shrink-0">

                    <Trash2Icon className="w-4 h-4" />
                  </button>
              }
              </div>
          )}
          </div>
        </Card>
      }

      <AddProductModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)} />

      <AddProductModal
        isOpen={editing !== null}
        product={editing}
        onClose={() => setEditing(null)} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="products"
        id={archiving.id}
        typeLabel="product"
        entityLabel={archiving.name} />

      }
    </div>);

}
