import { AnimalPhoto, PhotoCategory } from '../types';

// Input for creating a photo: provide EITHER an uploaded file (stored in the
// `animal-photos` bucket) OR an external URL.
export interface NewPhotoInput {
  animal_id: string;
  category: PhotoCategory;
  caption?: string;
  file?: File;
  url?: string;
  /** Force this photo to become the animal's profile picture after upload. */
  setAsProfile?: boolean;
}

export function rowToPhoto(r: any): AnimalPhoto {
  return {
    id: r.id,
    animal_id: r.animal_id,
    url: r.public_url ?? '',
    storage_path: r.storage_path ?? undefined,
    category: r.category,
    caption: r.caption ?? undefined,
    created_by: r.created_by ?? undefined,
    uploaded_at: r.created_at
  };
}

export function photoToInsert(
p: {
  animal_id: string;
  category: PhotoCategory;
  caption?: string;
  storage_path: string | null;
  public_url: string;
},
organizationId: string,
createdBy: string | null)
{
  return {
    organization_id: organizationId,
    animal_id: p.animal_id,
    category: p.category,
    caption: p.caption ?? null,
    storage_path: p.storage_path,
    public_url: p.public_url,
    created_by: createdBy
  };
}
