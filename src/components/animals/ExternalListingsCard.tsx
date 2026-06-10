import { useState } from 'react';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import {
  AddExternalListingModal,
  PROVIDER_OPTIONS,
  STATUS_OPTIONS } from
'./AddExternalListingModal';
import {
  AnimalExternalListing,
  ExternalListingProvider,
  ExternalListingStatus } from
'../../types';
import { cn } from '../../lib/utils';
import {
  GlobeIcon,
  PlusIcon,
  ExternalLinkIcon,
  Edit2Icon,
  Trash2Icon } from
'lucide-react';

const PROVIDER_LABEL: Record<ExternalListingProvider, string> = Object.fromEntries(
  PROVIDER_OPTIONS.map((o) => [o.value, o.label])
) as Record<ExternalListingProvider, string>;
const STATUS_LABEL: Record<ExternalListingStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<ExternalListingStatus, string>;

const STATUS_PILL: Record<ExternalListingStatus, string> = {
  published: 'bg-[#DDEFE2] text-[#3E7B52]',
  draft: 'bg-[#F8E7C8] text-[#A36B00]',
  removed: 'bg-[#F5D7D7] text-[#9B3A3A]',
  unknown: 'bg-background text-text-secondary border border-border'
};

const displayUrl = (url: string) =>
url.replace(/^https?:\/\//, '').replace(/\/$/, '');

interface Props {
  animalId: string;
}

export function ExternalListingsCard({ animalId }: Props) {
  const { externalListings, deleteExternalListing } = useWhisker();
  const listings = externalListings.filter((l) => l.animal_id === animalId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<AnimalExternalListing | null>(null);

  const remove = (listing: AnimalExternalListing) => {
    if (
    window.confirm(
      `Remove this ${PROVIDER_LABEL[listing.provider]} listing? This only removes it from Whiskerville — it won't take down the public post.`
    ))
    {
      deleteExternalListing(listing.id);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-lg font-heading font-bold flex items-center gap-2">
            <GlobeIcon className="w-5 h-5 text-primary" />
            External Listings
          </h3>
          <button
            onClick={() => setIsAddOpen(true)}
            className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors shrink-0"
            aria-label="Add listing">

            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Track public adoption posts for this animal.
        </p>

        {listings.length === 0 ?
        <div className="text-center py-3">
            <p className="text-sm text-text-secondary mb-3">
              Not posted anywhere yet.
            </p>
            <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-text-primary text-white hover:bg-text-primary/90 transition-colors">

              <PlusIcon className="w-3.5 h-3.5" />
              Add Listing
            </button>
          </div> :

        <div className="space-y-2.5">
            {listings.map((l) =>
          <div
            key={l.id}
            className="rounded-xl border border-border p-3 group">

                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-background text-text-primary border border-border">
                    {PROVIDER_LABEL[l.provider]}
                  </span>
                  <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  STATUS_PILL[l.status]
                )}>

                    {STATUS_LABEL[l.status]}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                  type="button"
                  onClick={() => setEditing(l)}
                  aria-label="Edit listing"
                  className="p-1 rounded-md text-text-secondary/70 hover:text-primary hover:bg-primary/10 transition-colors">

                      <Edit2Icon className="w-3.5 h-3.5" />
                    </button>
                    <button
                  type="button"
                  onClick={() => remove(l)}
                  aria-label="Remove listing"
                  className="p-1 rounded-md text-text-secondary/70 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                      <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <a
              href={l.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline max-w-full">

                  <span className="font-mono truncate">{displayUrl(l.url)}</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0" />
                </a>

                {l.notes &&
            <p className="text-xs text-text-secondary mt-1.5">{l.notes}</p>
            }
              </div>
          )}
          </div>
        }
      </Card>

      <AddExternalListingModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        animalId={animalId} />

      {editing &&
      <AddExternalListingModal
        isOpen={true}
        onClose={() => setEditing(null)}
        animalId={animalId}
        listing={editing} />
      }
    </>);

}
