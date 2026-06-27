import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '../ui/Button';
import { Select } from '../ui/Forms';
import { formatDate } from '../../lib/utils';
import {
  MegaphoneIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  PencilIcon,
  RotateCcwIcon,
  RefreshCwIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
  SlidersHorizontalIcon } from
'lucide-react';

interface AdoptionProfileTabProps {
  animalId: string;
  /** Whether the viewer may generate/edit/regenerate the profile (MANAGE_ANIMALS,
   *  admin, or the active foster). When false the tab is read-only — the existing
   *  profile (if any) can be viewed and copied, but not changed. Defaults to true. */
  canManage?: boolean;
  /** Counts that drive the "Profile Inputs" data-quality card. */
  traitCount: number;
  noteCount: number;
  fosterUpdateCount: number;
  medicalCount: number;
}

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

function ProfileInputsCard({
  traitCount,
  noteCount,
  fosterUpdateCount,
  medicalCount


}: Omit<AdoptionProfileTabProps, 'animalId'>) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">
        Profile Inputs
      </h4>
      <div className="space-y-2">
        <InputRow
          count={traitCount}
          noun="Personality Trait"
          pluralNoun="Personality Traits" />

        <InputRow count={noteCount} noun="Timeline Note" pluralNoun="Timeline Notes" />
        <InputRow
          count={fosterUpdateCount}
          noun="Foster Update"
          pluralNoun="Foster Updates" />

        <InputRow
          count={medicalCount}
          noun="Medical Record"
          pluralNoun="Medical Records" />

      </div>
    </div>);

}

/** Template chooser, shown only when the org has more than one template. */
function TemplatePicker({
  templates,
  value,
  onChange


}: {
  templates: { id: string; name: string; is_default: boolean }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1.5">
        Template
      </label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {templates.map((t) =>
        <option key={t.id} value={t.id}>
            {t.name}
            {t.is_default ? ' (default)' : ''}
          </option>
        )}
      </Select>
    </div>);

}

/** Optional per-generation guidance textarea. */
function GuidanceField({
  value,
  onChange


}: {value: string;onChange: (v: string) => void;}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1.5">
        Guidance for the AI{' '}
        <span className="font-normal text-text-secondary">(optional)</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="e.g. Emphasize she needs a quiet home · Keep it short for Petfinder · Don't mention intake history"
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />

    </div>);

}

export function AdoptionProfileTab({
  animalId,
  canManage = true,
  traitCount,
  noteCount,
  fosterUpdateCount,
  medicalCount
}: AdoptionProfileTabProps) {
  const {
    aiContent,
    adoptionTemplates,
    generateAdoptionProfile,
    updateAiDraft,
    resetAiDraft,
    computeAnimalFingerprint
  } = useWhisker();
  const profile = aiContent.find(
    (c) => c.animal_id === animalId && c.content_type === 'adoption_profile'
  );
  // Stale when the animal's inputs changed since this profile was generated.
  const isStale =
  !!profile?.source_fingerprint &&
  profile.source_fingerprint !== computeAnimalFingerprint(animalId);
  const hasTemplate = adoptionTemplates.some((t) => t.is_default) ||
  adoptionTemplates.length > 0;

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [guidance, setGuidance] = useState('');
  const [showGuidance, setShowGuidance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  // Which template to generate with — the explicit choice, else the org default.
  const effectiveTemplateId =
  templateId ||
  adoptionTemplates.find((t) => t.is_default)?.id ||
  adoptionTemplates[0]?.id ||
  '';
  const multipleTemplates = adoptionTemplates.length > 1;

  const runGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      await generateAdoptionProfile(animalId, guidance, effectiveTemplateId);
      setIsEditing(false);
    } catch (e) {
      setError(
        e instanceof Error ?
        e.message :
        'Failed to generate the adoption profile.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    if (profile?.user_edited) {
      setConfirmRegen(true);
      return;
    }
    runGenerate();
  };

  const startEditing = () => {
    if (!profile) return;
    setDraftValue(profile.draft_content);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!profile) return;
    updateAiDraft(profile.id, draftValue);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.draft_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked; the text is still selectable */
    }
  };

  // — No template configured ————————————————————————————————————————————
  if (!hasTemplate) {
    return (
      <Card className="p-8 text-center">
        <AlertCircleIcon className="w-8 h-8 mx-auto mb-3 text-[#A36B00]" />
        <p className="font-medium text-text-primary mb-1">
          No adoption-profile template is set up yet.
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Adoption profiles are assembled from your organization's template so
          fees and disclaimers stay exact.
        </p>
        <Link
          to="/settings"
          className="text-sm font-medium text-primary hover:underline">

          Set up a template in Settings → Adoption Profiles
        </Link>
      </Card>);

  }

  // — Empty state (read-only viewer) —————————————————————————————————————
  if (!profile && !canManage) {
    return (
      <Card className="p-8 text-center">
        <MegaphoneIcon className="w-8 h-8 mx-auto mb-3 text-text-secondary opacity-40" />
        <p className="font-medium text-text-primary mb-1">
          No adoption profile has been generated yet.
        </p>
        <p className="text-sm text-text-secondary">
          A coordinator or this animal's foster can generate one.
        </p>
      </Card>);

  }

  // — Empty state ————————————————————————————————————————————————————————
  if (!profile) {
    return (
      <Card className="p-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <MegaphoneIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
            No adoption profile has been generated yet.
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Whiskerville drafts the animal-specific copy and assembles it into
            your organization's template (intro, fees, disclaimers, and closing
            stay exactly as configured). Always review before publishing.
          </p>

          <div className="mt-6 text-left">
            <ProfileInputsCard
              traitCount={traitCount}
              noteCount={noteCount}
              fosterUpdateCount={fosterUpdateCount}
              medicalCount={medicalCount} />

          </div>

          {multipleTemplates &&
          <div className="mt-4 text-left">
              <TemplatePicker
              templates={adoptionTemplates}
              value={effectiveTemplateId}
              onChange={setTemplateId} />

            </div>
          }

          <div className="mt-4 text-left">
            <GuidanceField value={guidance} onChange={setGuidance} />
          </div>

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
                <MegaphoneIcon className="w-4 h-4 mr-2" /> Generate Adoption
                Profile
              </>
            }
          </Button>
        </div>
      </Card>);

  }

  // — Populated state ————————————————————————————————————————————————————
  const paragraphs = profile.draft_content.
  split(/\n\s*\n/).
  map((p) => p.trim()).
  filter(Boolean);

  return (
    <>
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <MegaphoneIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-heading font-bold text-text-primary">
            Adoption Profile
          </h3>
          {profile.user_edited &&
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
        {!isEditing &&
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="soft" size="sm" onClick={handleCopy}>
              {copied ?
            <>
                  <CheckIcon className="w-4 h-4 mr-2" /> Copied
                </> :

            <>
                  <CopyIcon className="w-4 h-4 mr-2" /> Copy
                </>
            }
            </Button>
            {canManage &&
          <>
              <Button variant="soft" size="sm" onClick={startEditing}>
                <PencilIcon className="w-4 h-4 mr-2" /> Edit
              </Button>
              {profile.user_edited &&
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetAiDraft(profile.id)}>

                  <RotateCcwIcon className="w-4 h-4 mr-2" /> Reset to AI version
                </Button>
            }
              <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuidance((s) => !s)}
              title="Adjust guidance before regenerating">

                <SlidersHorizontalIcon className="w-4 h-4 mr-2" /> Guidance
              </Button>
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
            </>
          }
          </div>
        }
      </div>

      {!isEditing && showGuidance &&
      <div className="mb-4 space-y-3">
          {multipleTemplates &&
        <TemplatePicker
          templates={adoptionTemplates}
          value={effectiveTemplateId}
          onChange={setTemplateId} />
        }
          <GuidanceField value={guidance} onChange={setGuidance} />
          <p className="text-xs text-text-secondary">
            Click <span className="font-medium">Regenerate</span> to apply this
            {multipleTemplates ? ' template & guidance.' : ' guidance.'}
          </p>
        </div>
      }

      {error && <p className="mb-4 text-sm text-status-urgent-text">{error}</p>}

      {isStale && !isEditing && canManage &&
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#E8D9B0] bg-[#FBF1DC] px-4 py-3">
          <AlertCircleIcon className="w-4 h-4 text-[#A36B00] shrink-0 mt-0.5" />
          <p className="text-sm text-[#7A5200]">
            This profile was generated before the animal's traits, notes, or
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
          rows={18}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
          placeholder="Write the adoption profile…" />

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

      <div className="text-text-primary leading-relaxed whitespace-pre-line">
          {paragraphs.length > 0 ?
        paragraphs.map((p, i) =>
        <p key={i} className="mb-3 last:mb-0">
                {p}
              </p>
        ) :

        <p className="text-text-secondary italic">This profile is empty.</p>
        }
        </div>
      }

      <p className="mt-5 pt-4 border-t border-border text-xs text-text-secondary">
        Generated {formatDate(profile.generated_at)}
        {profile.model ? ` · ${profile.model}` : ''}. Fixed sections come from
        your organization's template. Review before publishing.
      </p>
    </Card>
    {confirmRegen &&
    <ConfirmDialog
      isOpen={true}
      onClose={() => setConfirmRegen(false)}
      onConfirm={() => {
        setConfirmRegen(false);
        runGenerate();
      }}
      title="Regenerate profile?"
      confirmLabel="Regenerate"
      cancelLabel="Keep mine"
      tone="danger">

        Regenerating will replace your edited profile with a fresh AI version.
      </ConfirmDialog>
    }
    </>);

}
