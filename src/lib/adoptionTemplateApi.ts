import { OrganizationAdoptionTemplate } from '../types';

export function rowToAdoptionTemplate(r: any): OrganizationAdoptionTemplate {
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    template_body: r.template_body,
    tone: r.tone,
    length: r.length,
    style_notes: r.style_notes ?? undefined,
    is_default: r.is_default ?? true,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

const TEMPLATE_COLUMNS = [
'name',
'template_body',
'tone',
'length',
'style_notes'] as
const;

function normalize(v: any): any {
  return typeof v === 'string' && v === '' ? null : v;
}

export function adoptionTemplateUpdateToRow(
  updates: Partial<OrganizationAdoptionTemplate>)
{
  const row: Record<string, any> = {};
  for (const col of TEMPLATE_COLUMNS) {
    if (!(col in updates)) continue;
    row[col] = normalize((updates as any)[col]);
  }
  return row;
}
