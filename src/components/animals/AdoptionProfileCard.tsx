import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLinkIcon,
  CopyIcon,
  CheckIcon,
  Edit2Icon,
  PlusIcon,
  XIcon,
  GlobeIcon } from
'lucide-react';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalStatus } from '../../types';
import { cn } from '../../lib/utils';
interface AdoptionProfileCardProps {
  animalId: string;
  status: AnimalStatus;
  adoptionProfileUrl?: string;
}
// Require http(s):// followed by a domain that contains at least one dot.
// Permissive enough for real listings (Petfinder, Adopt-a-Pet, org sites,
// query strings, fragments) while rejecting plain text and protocol-less input.
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
export function AdoptionProfileCard({
  animalId,
  status,
  adoptionProfileUrl
}: AdoptionProfileCardProps) {
  const { updateAnimal } = useWhisker();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(adoptionProfileUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Only render when status is adoptable. Other statuses don't need this card.
  if (status !== 'adoptable') return null;
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && !URL_RE.test(trimmed)) {
      setError('Please enter a full link starting with http:// or https://');
      return;
    }
    setError(null);
    updateAnimal(animalId, {
      adoption_profile_url: trimmed || undefined
    });
    setEditing(false);
  };
  const cancel = () => {
    setDraft(adoptionProfileUrl || '');
    setError(null);
    setEditing(false);
  };
  const copy = async () => {
    if (!adoptionProfileUrl) return;
    try {
      await navigator.clipboard.writeText(adoptionProfileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {

      // ignore — clipboard may not be available
    }};
  // Compact label of the URL (strip protocol + trailing slash)
  const displayUrl = adoptionProfileUrl ?
  adoptionProfileUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') :
  '';
  return (
    <Card className="p-6">
      <h3 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
        <GlobeIcon className="w-5 h-5 text-primary" />
        Adoption Listing
      </h3>

      <AnimatePresence mode="wait">
        {editing ?
        <motion.div
          key="editing"
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="space-y-3">
          
            <input
            type="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
            autoFocus
            placeholder="https://www.petfinder.com/..."
            aria-invalid={!!error}
            aria-describedby={error ? 'adoption-url-error' : undefined}
            className={cn(
              'w-full h-10 px-3 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent',
              error ?
              'border-red-500 focus:ring-red-500' :
              'border-border focus:ring-primary'
            )} />
          
            {error &&
          <p id="adoption-url-error" className="text-xs text-red-500">
              {error}
            </p>
          }
            <div className="flex items-center gap-2">
              <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-text-primary text-white hover:bg-text-primary/90">
              
                <CheckIcon className="w-3.5 h-3.5" />
                Save
              </button>
              <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-text-secondary hover:bg-background">
              
                Cancel
              </button>
            </div>
          </motion.div> :
        adoptionProfileUrl ?
        <motion.div
          key="display"
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="space-y-3">
          
            <div className="p-3 rounded-lg bg-background/60 border border-border">
              <p className="text-sm text-text-primary font-mono truncate">
                {displayUrl}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
              href={adoptionProfileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors">
              
                <ExternalLinkIcon className="w-3.5 h-3.5" />
                Open listing
              </a>
              <button
              type="button"
              onClick={copy}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
                copied ?
                'bg-[#DDEFE2] text-[#3E7B52] border-[#DDEFE2]' :
                'bg-card text-text-secondary border-border hover:bg-background hover:text-text-primary'
              )}>
              
                {copied ?
              <CheckIcon className="w-3.5 h-3.5" /> :

              <CopyIcon className="w-3.5 h-3.5" />
              }
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-md text-xs font-medium text-text-secondary hover:bg-background hover:text-text-primary ml-auto"
              aria-label="Edit URL">
              
                <Edit2Icon className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div> :

        <motion.div
          key="empty"
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          className="space-y-3">
          
            <p className="text-sm text-text-secondary italic">
              Not yet posted publicly. Add a link to the external adoption
              listing once it's live.
            </p>
            <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-text-primary text-white hover:bg-text-primary/90">
            
              <PlusIcon className="w-3.5 h-3.5" />
              Add listing URL
            </button>
          </motion.div>
        }
      </AnimatePresence>
    </Card>);

}