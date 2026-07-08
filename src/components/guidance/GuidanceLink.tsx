// Pattern: a tiny, inline "Learn how it works" link that sits under a page
// description. One line — never a card — so it doesn't eat vertical space on
// screens power users visit constantly. Clicking opens a right-side HelpDrawer
// with the full explanation. A subtle "New" dot appears until the user has
// opened it at the message's current version (bump the version to re-flag it).
//
// Usage: <GuidanceLink guidanceKey="animals_intro" />
// Renders nothing if the message is missing/disabled, guidance is off for the
// org, or the user has hidden tips — so it's always safe to drop in.
import { useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { HelpDrawer } from './HelpDrawer';
import { guidanceIcon } from './guidanceIcons';
import { track } from '../../lib/analytics';

export function GuidanceLink({ guidanceKey }: { guidanceKey: string }) {
  const {
    guidanceMessages,
    guidanceSeen,
    tipsHidden,
    markGuidanceSeen
  } = useWhisker();
  const { currentOrg } = useAuth();
  const [open, setOpen] = useState(false);

  const message = guidanceMessages.find(
    (m) => m.key === guidanceKey && m.placement === 'page'
  );

  if (!message || !message.enabled) return null;
  if (currentOrg && currentOrg.show_guidance === false) return null;
  if (tipsHidden) return null;

  const seen = guidanceSeen.some(
    (s) => s.guidance_key === message.key && s.version === message.version
  );
  const Icon = guidanceIcon(message.icon);

  const openDrawer = () => {
    track('help_opened', { guidance_key: guidanceKey });
    setOpen(true);
    markGuidanceSeen(message.key, message.version);
  };

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="group inline-flex items-center gap-1.5 mt-1.5 text-sm text-primary hover:text-primary-hover transition-colors">

        <InfoIcon className="w-4 h-4 shrink-0" />
        <span className="font-medium">
          {message.link_label || 'Learn how it works'}
        </span>
        {!seen &&
        <span className="ml-0.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            New
          </span>
        }
      </button>

      <HelpDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        title={message.title}
        icon={<Icon className="w-5 h-5" />}
        footer={
        <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>Got It</Button>
          </div>
        }>

        <p className="text-text-secondary whitespace-pre-line leading-relaxed">
          {message.body}
        </p>
      </HelpDrawer>
    </>);

}
