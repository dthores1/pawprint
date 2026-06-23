import { SupplyRequest, SupplyRequestItem } from '../types';

// — Supply requests —————————————————————————————————————
export function rowToSupplyRequest(r: any): SupplyRequest {
  return {
    id: r.id,
    requester_person_id: r.requester_person_id ?? '',
    requested_for_animal_id: r.requested_for_animal_id ?? undefined,
    status: r.status,
    priority: r.priority,
    requested_date: r.requested_date,
    needed_by_date: r.needed_by_date ?? undefined,
    approved_by_person_id: r.approved_by_person_id ?? undefined,
    fulfilled_by_person_id: r.fulfilled_by_person_id ?? undefined,
    fulfilled_date: r.fulfilled_date ?? undefined,
    delivery_method: r.delivery_method ?? undefined,
    notes: r.notes ?? undefined,
    supplier: r.supplier ?? undefined,
    // numeric(10,2) arrives as a string from PostgREST.
    total_cost: r.total_cost != null ? Number(r.total_cost) : undefined,
    denial_reason: r.denial_reason ?? undefined,
    is_common_request: r.is_common_request ?? false,
    common_request_name: r.common_request_name ?? undefined,
    common_request_last_used_at: r.common_request_last_used_at ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

const SUPPLY_COLUMNS = [
'requester_person_id',
'requested_for_animal_id',
'status',
'priority',
'requested_date',
'needed_by_date',
'approved_by_person_id',
'fulfilled_by_person_id',
'fulfilled_date',
'delivery_method',
'notes',
'supplier',
'total_cost',
'denial_reason',
'is_common_request',
'common_request_name',
'common_request_last_used_at'] as
const;

// Columns to SELECT for a supply request read. `total_cost` is financial data:
// it's dropped from the query for users without supply-management permission, so
// the value never reaches the browser (network response omits it entirely).
// Keep in sync with rowToSupplyRequest.
const SUPPLY_READ_COLUMNS = ['id', ...SUPPLY_COLUMNS, 'created_at', 'updated_at'];

export function supplySelectColumns(canViewFinancials: boolean): string {
  const cols = canViewFinancials ?
  SUPPLY_READ_COLUMNS :
  SUPPLY_READ_COLUMNS.filter((c) => c !== 'total_cost');
  return cols.join(',');
}

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function supplyRequestToInsert(
req: Omit<SupplyRequest, 'id' | 'created_at' | 'updated_at'>,
organizationId: string)
{
  const row: Record<string, any> = { organization_id: organizationId };
  for (const col of SUPPLY_COLUMNS) {
    const v = (req as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}

export function supplyRequestUpdateToRow(updates: Partial<SupplyRequest>) {
  const row: Record<string, any> = {};
  for (const col of SUPPLY_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}

// — Supply request items ————————————————————————————————
export function rowToSupplyItem(r: any): SupplyRequestItem {
  return {
    id: r.id,
    supply_request_id: r.supply_request_id,
    product_id: r.product_id ?? undefined,
    custom_item_name: r.custom_item_name ?? undefined,
    quantity: Number(r.quantity) || 1,
    unit: r.unit ?? 'each',
    notes: r.notes ?? undefined,
    product_url: r.product_url ?? undefined
  };
}

export function supplyItemToInsert(
item: Omit<SupplyRequestItem, 'id'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    supply_request_id: item.supply_request_id,
    product_id: item.product_id ?? null,
    custom_item_name: item.custom_item_name ?? null,
    quantity: item.quantity ?? 1,
    unit: item.unit ?? 'each',
    notes: item.notes ?? null,
    product_url: item.product_url ?? null
  };
}
