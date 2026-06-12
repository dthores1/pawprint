import { SiteStatus } from '../types';

// Display label + soft pill tone for each site lifecycle status. Tones mirror
// the palette used elsewhere (e.g. ManageSupplyOptions category pills).
export const SITE_STATUS_META: Record<
  SiteStatus,
  { label: string; tone: string; description: string }
> = {
  reported: {
    label: 'Reported',
    tone: 'bg-[#DCEAF7] text-[#356A9A]',
    description: 'Site was reported but not yet reviewed.'
  },
  assessing: {
    label: 'Assessing',
    tone: 'bg-[#F8E7C8] text-[#A36B00]',
    description:
      'Gathering information, contacting the reporter, or determining next steps.'
  },
  active: {
    label: 'Active',
    tone: 'bg-[#DDEFE2] text-[#3E7B52]',
    description: 'Rescue is actively working the site.'
  },
  monitoring: {
    label: 'Monitoring',
    tone: 'bg-[#E8DEEC] text-[#6E4E80]',
    description: 'Major work is complete, but the site is still being observed.'
  },
  closed: {
    label: 'Closed',
    tone: 'bg-[#E5E2DC] text-[#6B6B6B]',
    description: 'Site is no longer being actively managed.'
  }
};

export const SITE_STATUS_ORDER: SiteStatus[] = [
  'reported',
  'assessing',
  'active',
  'monitoring',
  'closed'
];
