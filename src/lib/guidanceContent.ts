// Default guidance content, mirroring the seed in
// `supabase/migrations/0081_guidance.sql`. Production loads guidance from the DB;
// demo mode (no Supabase) uses this constant so the inline links, help drawers,
// and onboarding checklist all render identically for portfolio visitors.
// Keep this in sync with the migration seed.
import type { GuidanceMessage } from '../types';

function msg(
  partial: Omit<GuidanceMessage, 'created_at' | 'updated_at' | 'enabled'> &
    Partial<Pick<GuidanceMessage, 'enabled'>>
): GuidanceMessage {
  return {
    enabled: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial
  };
}

export const DEFAULT_GUIDANCE: GuidanceMessage[] = [
  msg({
    id: 'g-animals',
    key: 'animals_intro',
    placement: 'page',
    page: 'animals',
    title: 'How Animals work',
    body: `Animals represent the pets managed by your organization, including both active and historical animals. Animals can be added individually or as part of a litter and tracked from intake through adoption, release, or other outcomes.

From an animal's profile you can:
• Track medical records and clinic visits
• Manage foster placements
• Record adoptions and returns
• Create adoption profiles and listings
• Upload photos and files`,
    link_label: 'Learn how it works',
    icon: 'PawPrint',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-fosters',
    key: 'fosters_intro',
    placement: 'page',
    page: 'fosters',
    title: 'How Fosters work',
    body: `Foster Network helps your organization manage foster homes, placements, and capacity.

For each foster you can:
• Track current placements and available capacity
• Place animals and manage care assignments
• Record species preferences and notes
• View contact information
• Invite them to Whiskerville`,
    link_label: 'Learn how it works',
    icon: 'Home',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-adoptions',
    key: 'adoptions_intro',
    placement: 'page',
    page: 'adoptions',
    title: 'How Adoptions work',
    body: `Adoptions connect animals with prospective adopters and track progress through your organization's adoption process.

Each adoption links an animal to a contact and can be managed from initial inquiry through placement.

Adoptions can be started from this page or directly from an animal's profile.`,
    link_label: 'Learn how it works',
    icon: 'Heart',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-requests',
    key: 'requests_intro',
    placement: 'page',
    page: 'requests',
    title: 'How Requests work',
    body: `Requests help coordinate the logistics of rescue work:

• Supply — food, litter, medication, and other items
• Transport — moving animals, supplies, or equipment
• Sitting — temporary care when a foster is unavailable

Create a request when you need help. Requests can be claimed or assigned to volunteers for fulfillment.`,
    link_label: 'Learn how it works',
    icon: 'Inbox',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-sites',
    key: 'sites_intro',
    placement: 'page',
    page: 'sites',
    title: 'How Rescue Sites work',
    body: `Rescue sites are locations where your organization is tracking animals, activity, or follow-up work — such as colonies, trapping locations, reported sightings, or pickup areas.

For each site you can:
• Add an address and see nearby sites
• Link a reporter, caretaker, or other contact
• Assign or join as a site volunteer
• Add animals or litters from that location
• Track notes and site activity`,
    link_label: 'Learn how it works',
    icon: 'MapPin',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-medical',
    key: 'medical_intro',
    placement: 'page',
    page: 'medical',
    title: 'How Medical works',
    body: `Medical helps track animal care from planning through completion.

• Clinics — schedule appointments, reserve slots, and plan procedures
• Medical Records — track completed care and medical history

Completing a clinic creates medical records automatically and can update missing animal information.`,
    link_label: 'Learn how it works',
    icon: 'Stethoscope',
    variant: 'info',
    version: 1,
    sort_order: 0
  }),
  msg({
    id: 'g-supply-empty',
    key: 'supply_empty',
    placement: 'empty',
    page: 'requests',
    title: 'No supply requests yet',
    body: `Supply requests help volunteers ask for food, litter, medication, and other items needed for animals in care. Create one to get started.`,
    icon: 'Package',
    variant: 'info',
    version: 1,
    sort_order: 0
  })
];
