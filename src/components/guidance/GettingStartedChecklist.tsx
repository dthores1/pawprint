// Pattern: Dashboard-only onboarding. The Dashboard is the one place we're happy
// to spend space on guidance, so first-time setup lives here as a checklist.
// Each step's completion is DERIVED from real data (no extra storage), so it
// ticks off as the volunteer actually does the work. Dismissible, and it
// disappears for good once every step is complete.
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2Icon,
  CircleIcon,
  XIcon,
  ArrowRightIcon,
  SparklesIcon } from
'lucide-react';
import { Card } from '../ui/Card';
import { useWhisker } from '../../context/WhiskerContext';
import { useAuth } from '../../context/AuthContext';

export function GettingStartedChecklist() {
  const {
    animalsIndex,
    fosters,
    peopleIndex,
    supplyRequests,
    transportRequests,
    sittingRequests,
    tipsHidden,
    checklistDismissed,
    dismissChecklist
  } = useWhisker();
  const { currentOrg } = useAuth();

  const steps = [
  {
    key: 'animal',
    label: 'Add your first animal',
    to: '/animals',
    done: animalsIndex.length > 0
  },
  {
    key: 'foster',
    label: 'Add a foster home',
    to: '/fosters',
    done: fosters.length > 0
  },
  {
    key: 'contact',
    label: 'Add a contact',
    to: '/contacts',
    done: peopleIndex.length > 0
  },
  {
    key: 'request',
    label: 'Create your first request',
    to: '/requests',
    done:
    supplyRequests.length > 0 ||
    transportRequests.length > 0 ||
    sittingRequests.length > 0
  }];


  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allComplete = completed === total;

  // Once everything's done, retire the checklist for good.
  useEffect(() => {
    if (allComplete && !checklistDismissed) dismissChecklist();
  }, [allComplete, checklistDismissed, dismissChecklist]);

  const guidanceOff = currentOrg && currentOrg.show_guidance === false;
  if (guidanceOff || tipsHidden || checklistDismissed || allComplete) {
    return null;
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-bold text-lg text-text-primary">
            Getting Started
          </h2>
        </div>
        <button
          type="button"
          aria-label="Dismiss checklist"
          onClick={dismissChecklist}
          className="p-1.5 -mr-1.5 -mt-1 text-text-secondary/60 hover:text-text-secondary hover:bg-background rounded-full transition-colors shrink-0">

          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-4 space-y-1">
        {steps.map((step) =>
        <li key={step.key}>
            {step.done ?
          <div className="flex items-center gap-3 px-2 py-2 text-text-secondary">
                <CheckCircle2Icon className="w-5 h-5 text-primary shrink-0" />
                <span className="line-through">{step.label}</span>
              </div> :

          <Link
            to={step.to}
            className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-background transition-colors">

                <CircleIcon className="w-5 h-5 text-border shrink-0" />
                <span className="text-text-primary font-medium flex-1">
                  {step.label}
                </span>
                <ArrowRightIcon className="w-4 h-4 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
          }
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center gap-3 px-2">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(completed / total) * 100}%` }} />

        </div>
        <span className="text-xs font-medium text-text-secondary shrink-0">
          {completed} of {total} completed
        </span>
      </div>
    </Card>);

}
