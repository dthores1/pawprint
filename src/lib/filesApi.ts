import { AnimalFile, AnimalFileCategory } from '../types';

export interface NewFileInput {
  animal_id: string;
  category: AnimalFileCategory;
  notes?: string;
  file: File;
}

export function rowToAnimalFile(r: any): AnimalFile {
  return {
    id: r.id,
    animal_id: r.animal_id,
    file_name: r.file_name,
    file_type: r.file_type ?? undefined,
    file_size: r.file_size ?? undefined,
    storage_path: r.storage_path,
    category: r.category,
    notes: r.notes ?? undefined,
    uploaded_by_user_id: r.uploaded_by_user_id ?? undefined,
    created_at: r.created_at
  };
}

export function fileToInsert(
p: {
  animal_id: string;
  category: AnimalFileCategory;
  notes?: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
},
organizationId: string,
uploadedByUserId: string | null)
{
  return {
    organization_id: organizationId,
    animal_id: p.animal_id,
    category: p.category,
    notes: p.notes ?? null,
    file_name: p.file_name,
    file_type: p.file_type,
    file_size: p.file_size,
    storage_path: p.storage_path,
    uploaded_by_user_id: uploadedByUserId
  };
}

export const FILE_CATEGORY_LABELS: Record<AnimalFileCategory, string> = {
  medical_record: 'Medical Record',
  adoption_application: 'Adoption Application',
  legacy_export: 'Legacy System Export',
  intake_document: 'Intake Document',
  other: 'Other'
};

// 25 MB — matches the bucket's file_size_limit backstop (migration 0071).
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Accepted upload types: PDFs, images, and common office docs/spreadsheets.
export const FILE_ACCEPT =
  '.pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain';
