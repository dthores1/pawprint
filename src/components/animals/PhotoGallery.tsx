import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  PlusIcon,
  XIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UploadCloudIcon } from
'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AddPhotoModal } from './AddPhotoModal';
import { PhotoCategory, AnimalPhoto } from '../../types';
import { formatDate, cn } from '../../lib/utils';
interface PhotoGalleryProps {
  animalId: string;
}
const CATEGORY_LABELS: Record<PhotoCategory, string> = {
  intake: 'Intake',
  profile: 'Profile',
  medical: 'Medical',
  foster: 'Foster Updates',
  adoption: 'Adoption Day',
  post_adoption: 'Post-Adoption',
  other: 'Other'
};
const CATEGORY_TONE: Record<PhotoCategory, string> = {
  intake: 'bg-[#E5E2DC] text-[#6B6B6B]',
  profile: 'bg-[#DDEFE2] text-[#3E7B52]',
  medical: 'bg-[#F8E7C8] text-[#A36B00]',
  foster: 'bg-[#DCEAF7] text-[#356A9A]',
  adoption: 'bg-[#F3E4D7] text-[#B8632E]',
  post_adoption: 'bg-[#E8DEEC] text-[#6E4E80]',
  other: 'bg-background text-text-secondary border border-border'
};
// Display order for category groups
const CATEGORY_ORDER: PhotoCategory[] = [
'profile',
'intake',
'medical',
'foster',
'adoption',
'post_adoption',
'other'];

export function PhotoGallery({ animalId }: PhotoGalleryProps) {
  const { photos, deletePhoto, addPhoto } = useWhisker();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
      );
      if (files.length === 0) return;
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            addPhoto({
              animal_id: animalId,
              url: event.target.result,
              category: 'other'
            });
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [addPhoto, animalId]
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

        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            {animalPhotos.length === 0 ?
            'No photos yet — capture this animal\u2019s journey.' :
            `${animalPhotos.length} photo${animalPhotos.length === 1 ? '' : 's'} across ${grouped.length} categor${grouped.length === 1 ? 'y' : 'ies'}.`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddOpen(true)}>
            
            <PlusIcon className="w-4 h-4 mr-2" /> Add Photo
          </Button>
        </div>

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
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxIndex(flatIdx)}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary">
                  
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
                    </button>);

            })}
              </div>
            </Card>
        )
        }
      </div>

      <AddPhotoModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        animalId={animalId} />
      

      <AnimatePresence>
        {lightboxIndex !== null && flatPhotos[lightboxIndex] &&
        <Lightbox
          photo={flatPhotos[lightboxIndex]}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < flatPhotos.length - 1}
          onPrev={() => setLightboxIndex((i) => i === null ? null : i - 1)}
          onNext={() => setLightboxIndex((i) => i === null ? null : i + 1)}
          onClose={() => setLightboxIndex(null)}
          onDelete={() => {
            deletePhoto(flatPhotos[lightboxIndex].id);
            // close if last photo
            if (flatPhotos.length === 1) setLightboxIndex(null);else
            if (lightboxIndex >= flatPhotos.length - 1)
            setLightboxIndex(lightboxIndex - 1);
          }} />

        }
      </AnimatePresence>
    </>);

}
interface LightboxProps {
  photo: AnimalPhoto;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDelete: () => void;
}
function Lightbox({
  photo,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onDelete
}: LightboxProps) {
  return (
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-6 left-6 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 text-sm flex items-center gap-2">
        
        <Trash2Icon className="w-4 h-4" />
        Delete
      </button>

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
    </motion.div>);

}