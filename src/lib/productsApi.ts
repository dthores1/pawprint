import { Product } from '../types';

export function rowToProduct(r: any): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    default_unit: r.default_unit ?? 'each',
    active: r.active ?? true
  };
}

const PRODUCT_COLUMNS = ['name', 'category', 'default_unit', 'active'] as const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function productToInsert(
p: Omit<Product, 'id'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of PRODUCT_COLUMNS) {
    const v = (p as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function productUpdateToRow(updates: Partial<Product>) {
  const row: Record<string, any> = {};
  for (const col of PRODUCT_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
