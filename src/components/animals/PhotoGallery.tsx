import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  XIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UploadCloudIcon,
  StarIcon } from
'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { AddPhotoModal } from './AddPhotoModal';
import { PhotoCategory, AnimalPhoto } from '../../types';
import { formatDate, cn } from '../../lib/utils';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';
interface PhotoGalleryProps {
  animalId: string;
  /** Whether the viewer may upload photos / set the profile photo (MANAGE_ANIMALS,
   *  admin, or the active foster). When false the gallery is view-only. Defaults
   *  to true. Per-photo archive stays separately gated by useCanArchive. */
  canManage?: boolean;
  /** Add-photo modal state, lifted so the trigger can live in the tab row. */
  isAddOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}
const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  intake: 'Intake',
  medical: 'Medical',
  general: 'General',
  adoption_listing: 'Adoption Listing'
};
const CATEGORY_TONE: Record<PhotoCategory, string> = {
  intake: 'bg-[#E5E2DC] text-[#6B6B6B]',
  medical: 'bg-[#F8E7C8] text-[#A36B00]',
  general: 'bg-[#DDEFE2] text-[#3E7B52]',
  adoption_listing: 'bg-[#F3E4D7] text-[#B8632E]'
};
// Display order for category groups
const CATEGORY_ORDER: PhotoCategory[] = [
'intake',
'medical',
'general',
'adoption_listing'];

export function PhotoGallery({
  animalId,
  canManage = true,
  isAddOpen,
  onAddOpenChange
}: PhotoGalleryProps) {
  const { photos, addPhoto, updateAnimal, animals } = useWhisker();
  const animal = animals.find((a) => a.id === animalId);
  const profileUrl = animal?.primary_photo_url;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [archivingPhoto, setArchivingPhoto] = useState<AnimalPhoto | null>(null);
  const animalPhotos = useMemo(
    () =>
    photos.
    filter((p) => p.animal_id === animalId).
    sort(
      (a, b) =>
      new Date(b.uploaded_at).getTime() -
      new Date(a.uploaded_at).getTime()
    ),
    [photos, animalId]
  );
  const grouped = useMemo(() => {
    const map = new Map<PhotoCategory, AnimalPhoto[]>();
    for (const photo of animalPhotos) {
      const arr = map.get(photo.category) || [];
      arr.push(photo);
      map.set(photo.category, arr);
    }
    return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      category: cat,
      photos: map.get(cat)!
    }));
  }, [animalPhotos]);
  // Flat list for lightbox navigation (in category order)
  const flatPhotos = useMemo(() => grouped.flatMap((g) => g.photos), [grouped]);
  const handleSetProfile = useCallback(
    (photo: AnimalPhoto) => {
      updateAnimal(animalId, { primary_photo_url: photo.url });
    },
    [updateAnimal, animalId]
  );
  // Open the archive confirm dialog. If the photo being archived is currently
  // the animal's profile picture, slide the badge to the next remaining photo
  // (or clear it) up-front so the hero doesn't render a stale broken image
  // once the archive RPC removes the row from the loaded `photos` collection.
  const handleArchivePhoto = useCallback(
    (photo: AnimalPhoto) => {
      if (profileUrl && profileUrl === photo.url) {
        const next = animalPhotos.find((p) => p.id !== photo.id);
        updateAnimal(animalId, { primary_photo_url: next?.url ?? '' });
      }
      setArchivingPhoto(photo);
    },
    [profileUrl, animalPhotos, updateAnimal, animalId]
  );
  // Lightbox keyboard nav
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft')
      setLightboxIndex((i) => i === null ? null : Math.max(0, i - 1));
      if (e.key === 'ArrowRight')
      setLightboxIndex((i) =>
      i === null ? null : Math.min(flatPhotos.length - 1, i + 1)
      );
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, flatPhotos.length]);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!canManage) return;
    e.preventDefault();
    setIsDragging(true);
  }, [canManage]);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canManage) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
      );
      if (files.length === 0) return;
      // Upload each dropped file to Storage via the context action.
      files.forEach((file) => {
        addPhoto({
          animal_id: animalId,
          category: 'general',
          file
        });
      });
    },
    [addPhoto, animalId, canManage]
  );
  return (
    <>
      <div
        className="space-y-5 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        
        <AnimatePresence>
          {isDragging &&
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            className="absolute inset-0 z-10 bg-primary/5 border-2 border-dashed border-primary rounded-xl flex items-center justify-center backdrop-blur-[1px]">
            
              <div className="bg-card px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
                <UploadCloudIcon className="w-6 h-6 text-primary" />
                <span className="font-medium text-text-primary">
                  Drop images to upload
                </span>
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {animalPhotos.length > 0 &&
          <p className="text-sm text-text-secondary">
            {
            `${animalPhotos.length} photo${animalPhotos.length === 1 ? '' : 's'} across ${grouped.length} categor${grouped.length === 1 ? 'y' : 'ies'}.`}
          </p>
        }

        {animalPhotos.length === 0 ?
        <Card className="p-12 text-center text-text-secondary">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-text-primary mb-1">No photos yet</p>
            <p className="text-sm">
              Intake, medical, foster, and adoption photos all live here.
            </p>
          </Card> :

        grouped.map(({ category, photos: catPhotos }) =>
        <Card key={category} className="overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-background/60 flex items-center gap-2">
                <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                CATEGORY_TONE[category]
              )}>
              
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="text-xs text-text-secondary">
                  ({catPhotos.length})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
                {catPhotos.map((photo) => {
              const flatIdx = flatPhotos.findIndex((p) => p.id === photo.id);
              const isProfile = !!profileUrl && photo.url === profileUrl;
              return (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-background border border-border">

                      <button
                    type="button"
                    onClick={() => setLightboxIndex(flatIdx)}
                    className="absolute inset-0 w-full h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">

                        <img
                      src={photo.url}
                      alt={
                      photo.caption || `${CATEGORY_LABELS[category]} photo`
                      }
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

                        {photo.caption &&
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-white line-clamp-2 text-left">
                              {photo.caption}
                            </p>
                          </div>
                    }
                      </button>

                      {isProfile &&
                  <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#DDEFE2] text-[#3E7B52] text-[10px] font-bold uppercase tracking-wide shadow-soft">
                          <StarIcon className="w-3 h-3 fill-current" />
                          Profile
                        </span>
                  }

                      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!isProfile && canManage &&
                    <button
                      type="button"
                      onClick={() => handleSetProfile(photo)}
                      aria-label="Set as profile picture"
                      title="Set as profile picture"
                      className="p-1.5 rounded-md bg-card/95 text-text-secondary hover:text-[#3E7B52] shadow-soft transition-colors">

                            <StarIcon className="w-3.5 h-3.5" />
                          </button>
                    }
                        <PhotoArchiveButton
                      photo={photo}
                      onArchive={() => handleArchivePhoto(photo)} />

                      </div>
                    </div>);

            })}
              </div>
            </Card>
        )
        }
      </div>

      <AddPhotoModal
        isOpen={isAddOpen}
        onClose={() => onAddOpenChange(false)}
        animalId={animalId} />
      

      {archivingPhoto &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchivingPhoto(null)}
        table="animal_photos"
        id={archivingPhoto.id}
        typeLabel="photo"
        entityLabel={archivingPhoto.caption || 'this photo'} />

      }

      <AnimatePresence>
        {lightboxIndex !== null && flatPhotos[lightboxIndex] &&
        <Lightbox
          photo={flatPhotos[lightboxIndex]}
          canSetProfile={canManage}
          isProfile={
          !!profileUrl && flatPhotos[lightboxIndex].url === profileUrl
          }
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < flatPhotos.length - 1}
          onPrev={() => setLightboxIndex((i) => i === null ? null : i - 1)}
          onNext={() => setLightboxIndex((i) => i === null ? null : i + 1)}
          onClose={() => setLightboxIndex(null)}
          onSetProfile={() => handleSetProfile(flatPhotos[lightboxIndex])}
          onDelete={() => {
            const photo = flatPhotos[lightboxIndex];
            // close if last photo
            if (flatPhotos.length === 1) setLightboxIndex(null);else
            if (lightboxIndex >= flatPhotos.length - 1)
            setLightboxIndex(lightboxIndex - 1);
            handleArchivePhoto(photo);
          }} />

        }
      </AnimatePresence>
    </>);

}
// Per-thumbnail archive button. The useCanArchive check happens here so each
// photo independently decides whether to render the action — uploaders see it
// for their own photos, admins see it everywhere.
function PhotoArchiveButton({
  photo,
  onArchive
}: {
  photo: AnimalPhoto;
  onArchive: () => void;
}) {
  const canArchive = useCanArchive('animal_photos', {
    id: photo.id,
    created_by: photo.created_by ?? null
  });
  if (!canArchive) return null;
  return (
    <button
      type="button"
      onClick={onArchive}
      aria-label="Archive photo"
      title="Archive photo"
      className="p-1.5 rounded-md bg-card/95 text-text-secondary hover:text-[#9B3A3A] shadow-soft transition-colors">

      <Trash2Icon className="w-3.5 h-3.5" />
    </button>);

}

interface LightboxProps {
  photo: AnimalPhoto;
  canSetProfile: boolean;
  isProfile: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSetProfile: () => void;
  onDelete: () => void;
}
function Lightbox({
  photo,
  canSetProfile,
  isProfile,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onSetProfile,
  onDelete
}: LightboxProps) {
  // Mirror the per-thumbnail archive gate so the lightbox Delete respects the
  // same admin/uploader rule.
  const canArchive = useCanArchive('animal_photos', {
    id: photo.id,
    created_by: photo.created_by ?? null
  });
  // Portal to <body> so the fixed-position backdrop anchors to the viewport
  // (not the AppShell page wrapper, which has framer-motion transforms that
  // would otherwise establish a containing block and leave the sidebar
  // un-dimmed at the top of the screen).
  return createPortal(
    <motion.div
      initial={{
        opacity: 0
      }}
      animate={{
        opacity: 1
      }}
      exit={{
        opacity: 0
      }}
      transition={{
        duration: 0.15
      }}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}>
      
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
        aria-label="Close">
        
        <XIcon className="w-6 h-6" />
      </button>

      <div className="absolute top-6 left-6 flex items-center gap-2">
        {isProfile ?
        <span className="text-white/80 text-sm flex items-center gap-2 px-2 py-1">
            <StarIcon className="w-4 h-4 fill-current" />
            Profile photo
          </span> :
        canSetProfile ?
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetProfile();
          }}
          className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 text-sm flex items-center gap-2">

            <StarIcon className="w-4 h-4" />
            Set as profile
          </button> :
        null
        }
        {canArchive &&
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 text-sm flex items-center gap-2">

          <Trash2Icon className="w-4 h-4" />
          Delete
        </button>
        }
      </div>

      {hasPrev &&
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10"
        aria-label="Previous photo">
        
          <ChevronLeftIcon className="w-7 h-7" />
        </button>
      }

      {hasNext &&
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10"
        aria-label="Next photo">
        
          <ChevronRightIcon className="w-7 h-7" />
        </button>
      }

      <motion.div
        initial={{
          scale: 0.96,
          opacity: 0
        }}
        animate={{
          scale: 1,
          opacity: 1
        }}
        exit={{
          scale: 0.96,
          opacity: 0
        }}
        transition={{
          duration: 0.18
        }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl max-h-full flex flex-col items-center gap-4">
        
        <img
          src={photo.url}
          alt={photo.caption || 'Photo'}
          className="max-h-[75vh] w-auto rounded-lg shadow-2xl object-contain" />
        
        <div className="text-center max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs mb-2">
            {CATEGORY_LABELS[photo.category]} · {formatDate(photo.uploaded_at)}
          </div>
          {photo.caption &&
          <p className="text-white text-sm leading-relaxed">
              {photo.caption}
            </p>
          }
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );

}