import { AnimalActionItem } from '../types';

export function rowToActionItem(r: any): AnimalActionItem {
  return {
    id: r.id,
    animal_id: r.animal_id,
    description: r.description,
    priority: r.priority,
    status: r.status,
    created_at: r.created_at,
    completed_at: r.completed_at ?? undefined,
    completed_by: r.completed_by ?? undefined,
    completion_note: r.completion_note ?? undefined
  };
}

export function actionItemToInsert(
item: Pick<AnimalActionItem, 'animal_id' | 'description' | 'priority'>,
organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: item.animal_id,
    description: item.description,
    priority: item.priority,
    status: 'open'
  };
}

const COLUMNS = [
'description',
'priority',
'status',
'completed_at',
'completed_by',
'completion_note'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function actionItemUpdateToRow(updates: Partial<AnimalActionItem>) {
  const row: Record<string, any> = {};
  for (const col of COLUMNS) {
    if (!(col in updates)) continue;
    const v = (updates as any)[col];
    if (v === undefined) continue;
    row[col] = normalize(v);
  }
  return row;
}
