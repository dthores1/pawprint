import { useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';
import {
  SparklesIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  PencilIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  Loader2Icon } from
'lucide-react';

interface SummaryTabProps {
  animalId: string;
  /** Whether the viewer may generate/edit/regenerate the summary (MANAGE_ANIMALS,
   *  admin, or the active foster). When false the tab is read-only. Defaults to true. */
  canManage?: boolean;
  /** Counts that drive the "Summary Inputs" data-quality card. */
  traitCount: number;
  noteCount: number;
  medicalCount: number;
  fosterNoteCount: number;
}

/** One row of the Summary Inputs card: a green check when present, amber when not. */
function InputRow({
  count,
  noun,
  pluralNoun


}: {count: number;noun: string;pluralNoun: string;}) {
  const present = count > 0;
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {present ?
      <CheckCircle2Icon className="w-4 h-4 text-[#3E7B52] shrink-0" /> :
      <AlertCircleIcon className="w-4 h-4 text-[#A36B00] shrink-0" />
      }
      <span className={present ? 'text-text-primary' : 'text-[#A36B00]'}>
        {present ? `${count} ${count === 1 ? noun : pluralNoun}` : `No ${pluralNoun}`}
      </span>
    </div>);

}

function SummaryInputsCard({
  traitCount,
  noteCount,
  medicalCount,
  fosterNoteCount


}: Omit<SummaryTabProps, 'animalId'>) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">
        Summary Inputs
      </h4>
      <div className="space-y-2">
        <InputRow
          count={traitCount}
          noun="Personality Trait"
          pluralNoun="Personality Traits" />

        <InputRow count={noteCount} noun="Timeline Note" pluralNoun="Timeline Notes" />
        <InputRow
          count={medicalCount}
          noun="Medical Record"
          pluralNoun="Medical Records" />

        <InputRow
          count={fosterNoteCount}
          noun="Foster Note"
          pluralNoun="Foster Notes" />

      </div>
    </div>);

}

export function SummaryTab({
  animalId,
  canManage = true,
  traitCount,
  noteCount,
  medicalCount,
  fosterNoteCount
}: SummaryTabProps) {
  const {
    aiContent,
    generateAiSummary,
    updateAiDraft,
    resetAiDraft,
    computeAnimalFingerprint
  } = useWhisker();
  const summary = aiContent.find(
    (c) => c.animal_id === animalId && c.content_type === 'summary'
  );
  // Stale when the animal's inputs changed since this summary was generated.
  // Only flag when a fingerprint was stored (rows predating the feature are
  // treated as unknown, never falsely stale).
  const isStale =
  !!summary?.source_fingerprint &&
  summary.source_fingerprint !== computeAnimalFingerprint(animalId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');

  const runGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      await generateAiSummary(animalId);
      setIsEditing(false);
    } catch (e) {
      //setError(e instanceof Error ? e.message : 'Failed to generate the summary.');
      setError("There was an issue generating the summary. Please try again later.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (
    summary?.user_edited &&
    !window.confirm(
      'Regenerating will replace your edited summary with a fresh AI version. Continue?'
    ))
    {
      return;
    }
    runGenerate();
  };

  const startEditing = () => {
    if (!summary) return;
    setDraftValue(summary.draft_content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!summary) return;
    updateAiDraft(summary.id, draftValue);
    setIsEditing(false);
  };

  // — Empty state (read-only viewer) —————————————————————————————————————
  if (!summary && !canManage) {
    return (
      <Card className="p-8 text-center">
        <SparklesIcon className="w-8 h-8 mx-auto mb-3 text-text-secondary opacity-40" />
        <p className="font-medium text-text-primary mb-1">
          No summary has been generated yet.
        </p>
        <p className="text-sm text-text-secondary">
          A coordinator or this animal's foster can generate one.
        </p>
      </Card>);

  }

  // — Empty state: educational copy + (optional) no-traits warning + Generate —
  if (!summary) {
    return (
      <Card className="p-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No summary has been generated yet.
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed mb-1">
            AI summaries are based on personality traits, notes, medical records,
            and foster history.
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Adding personality traits and detailed notes will produce better
            results.
          </p>

          <div className="mt-6 text-left">
            <SummaryInputsCard
              traitCount={traitCount}
              noteCount={noteCount}
              medicalCount={medicalCount}
              fosterNoteCount={fosterNoteCount} />

          </div>

          {traitCount === 0 &&
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E8D9B0] bg-[#FBF1DC] px-4 py-3 text-left">
              <AlertCircleIcon className="w-4 h-4 text-[#A36B00] shrink-0 mt-0.5" />
              <p className="text-sm text-[#7A5200]">
                <span className="font-semibold">
                  No personality traits have been added for this animal.
                </span>{' '}
                The generated summary may be less detailed.
              </p>
            </div>
          }

          {error &&
          <p className="mt-4 text-sm text-status-urgent-text">{error}</p>
          }

          <Button
            variant="primary"
            className="mt-6"
            onClick={runGenerate}
            disabled={isGenerating}>

            {isGenerating ?
            <>
                <Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> Generating…
              </> :

            <>
                <SparklesIcon className="w-4 h-4 mr-2" /> Generate Summary
              </>
            }
          </Button>
        </div>
      </Card>);

  }

  // — Populated state: prose + edit / reset / regenerate ———————————————————
  const paragraphs = summary.draft_content.
  split(/\n\s*\n/).
  map((p) => p.trim()).
  filter(Boolean);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold text-text-primary">
            Summary
          </h3>
          {summary.user_edited &&
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8E7C8] text-[#A36B00]">
              Edited
            </span>
          }
          {isStale &&
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FBF1DC] text-[#A36B00]">
              <AlertCircleIcon className="w-3.5 h-3.5" /> May be outdated
            </span>
          }
        </div>
        {!isEditing && canManage &&
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" size="sm" onClick={startEditing}>
              <PencilIcon className="w-4 h-4 mr-2" /> Edit
            </Button>
            {summary.user_edited &&
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetAiDraft(summary.id)}>

                <RotateCcwIcon className="w-4 h-4 mr-2" /> Reset to AI version
              </Button>
          }
            <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isGenerating}>

              {isGenerating ?
            <Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> :

            <RefreshCwIcon className="w-4 h-4 mr-2" />
            }
              Regenerate
            </Button>
          </div>
        }
      </div>

      {error &&
      <p className="mb-4 text-sm text-status-urgent-text">{error}</p>
      }

      {isStale && !isEditing && canManage &&
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#E8D9B0] bg-[#FBF1DC] px-4 py-3">
          <AlertCircleIcon className="w-4 h-4 text-[#A36B00] shrink-0 mt-0.5" />
          <p className="text-sm text-[#7A5200]">
            This summary was generated before the animal's traits, notes, or
            medical records last changed.{' '}
            <button
            type="button"
            onClick={handleRegenerate}
            className="font-semibold underline hover:no-underline">

              Regenerate
            </button>{' '}
            to refresh it.
          </p>
        </div>
      }

      {isEditing ?
      <div>
          <textarea
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          rows={12}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
          placeholder="Write the summary…" />

          <div className="flex items-center gap-2 mt-3">
            <Button variant="primary" size="sm" onClick={saveEdit}>
              Save
            </Button>
            <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}>

              Cancel
            </Button>
          </div>
        </div> :

      <div className="text-text-primary leading-relaxed">
          {paragraphs.length > 0 ?
        paragraphs.map((p, i) =>
        <p key={i} className="mb-3 last:mb-0">
                {p}
              </p>
        ) :

        <p className="text-text-secondary italic">This summary is empty.</p>
        }
        </div>
      }

      <p className="mt-5 pt-4 border-t border-border text-xs text-text-secondary">
        Generated {formatDate(summary.generated_at)}
        {summary.model ? ` · ${summary.model}` : ''}. AI-generated drafts should
        be reviewed before publishing.
      </p>
    </Card>);

}
