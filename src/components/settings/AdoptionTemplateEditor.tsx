import { useEffect, useRef, useState } from 'react';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Forms';
import {
  AdoptionProfileTone,
  AdoptionProfileLength } from
'../../types';
import {
  AI_PLACEHOLDERS,
  ANIMAL_PLACEHOLDERS } from
'../../lib/adoptionTemplate';
import { PlusIcon, Trash2Icon, StarIcon } from 'lucide-react';

const TONE_OPTIONS: { value: AdoptionProfileTone; label: string }[] = [
{ value: 'warm_conversational', label: 'Warm & conversational' },
{ value: 'professional', label: 'Professional' },
{ value: 'playful', label: 'Playful' }];

const LENGTH_OPTIONS: { value: AdoptionProfileLength; label: string }[] = [
{ value: 'short', label: 'Short (Petfinder blurb)' },
{ value: 'standard', label: 'Standard' },
{ value: 'detailed', label: 'Detailed (website profile)' }];

// Settings → Adoption Profiles. Manages the org's adoption-posting templates:
// pick one to edit (name, body, tone/length, style notes), add/delete, and
// choose the default. The AI fills the {{ai_*}} placeholders and Whiskerville
// fills the {{animal.*}} variables; everything else is reproduced verbatim.
export function AdoptionTemplateEditor() {
  const {
    adoptionTemplates,
    updateAdoptionTemplate,
    addAdoptionTemplate,
    setDefaultAdoptionTemplate,
    deleteAdoptionTemplate
  } = useWhisker();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const template =
  adoptionTemplates.find((t) => t.id === selectedId) ??
  adoptionTemplates.find((t) => t.is_default) ??
  adoptionTemplates[0] ??
  null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [tone, setTone] = useState<AdoptionProfileTone>('warm_conversational');
  const [length, setLength] = useState<AdoptionProfileLength>('standard');
  const [styleNotes, setStyleNotes] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the form whenever the selected template changes (incl. first load).
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (template && loadedId.current !== template.id) {
      loadedId.current = template.id;
      setSelectedId(template.id);
      setName(template.name);
      setBody(template.template_body);
      setTone(template.tone);
      setLength(template.length);
      setStyleNotes(template.style_notes ?? '');
    }
  }, [template]);

  if (!template) {
    return (
      <Card className="p-5">
        <h2 className="font-heading font-semibold text-lg text-text-primary">
          Adoption Profiles
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          No template found for this organization. Run migration 0056 to seed a
          default template.
        </p>
      </Card>);

  }

  const dirty =
  name !== template.name ||
  body !== template.template_body ||
  tone !== template.tone ||
  length !== template.length ||
  (styleNotes || '') !== (template.style_notes ?? '');

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const save = () => {
    updateAdoptionTemplate(template.id, {
      name: name.trim() || template.name,
      template_body: body,
      tone,
      length,
      style_notes: styleNotes
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAdd = async () => {
    const id = await addAdoptionTemplate('New template');
    if (id) {
      loadedId.current = null; // force the form to reseed from the new template
      setSelectedId(id);
    }
  };

  const handleDelete = () => {
    if (template.is_default) return;
    if (!window.confirm(`Delete the "${template.name}" template?`)) return;
    const fallback = adoptionTemplates.find((t) => t.id !== template.id);
    deleteAdoptionTemplate(template.id);
    loadedId.current = null;
    setSelectedId(fallback?.id ?? null);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="font-heading font-semibold text-lg text-text-primary">
          Adoption Profiles
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Templates used when generating an animal's adoption posting. AI writes
          the <code className="text-xs">{'{{ai_*}}'}</code> sections; everything
          else — fees, disclaimers, closing language — is reproduced exactly as
          written here. The default is used unless another is chosen at
          generation time.
        </p>
      </div>

      {/* Template chooser */}
      <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
        {adoptionTemplates.map((t) =>
        <button
          key={t.id}
          type="button"
          onClick={() => {
            loadedId.current = null;
            setSelectedId(t.id);
          }}
          className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium transition-colors ${t.id === template.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-background'}`}>

            {t.is_default &&
          <StarIcon className="w-3.5 h-3.5 fill-current" />
          }
            {t.name}
          </button>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors">

          <PlusIcon className="w-4 h-4" /> New template
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Name + default/delete controls */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Template name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40" />

          </div>
          <div className="flex items-center gap-2">
            {template.is_default ?
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <StarIcon className="w-3.5 h-3.5 fill-current" /> Default
              </span> :

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefaultAdoptionTemplate(template.id)}>

                Set as default
              </Button>
            }
            <button
              type="button"
              onClick={handleDelete}
              disabled={template.is_default}
              title={
              template.is_default ?
              'Set another template as default first' :
              'Delete template'
              }
              className="p-2 rounded-lg text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary">

              <Trash2Icon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tone + length */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Tone
            </label>
            <Select
              value={tone}
              onChange={(e) => setTone(e.target.value as AdoptionProfileTone)}>

              {TONE_OPTIONS.map((o) =>
              <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Length
            </label>
            <Select
              value={length}
              onChange={(e) =>
              setLength(e.target.value as AdoptionProfileLength)
              }>

              {LENGTH_OPTIONS.map((o) =>
              <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )}
            </Select>
          </div>
        </div>

        {/* Style notes */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Style notes{' '}
            <span className="font-normal text-text-secondary">(optional)</span>
          </label>
          <textarea
            value={styleNotes}
            onChange={(e) => setStyleNotes(e.target.value)}
            rows={2}
            placeholder="Organization-wide writing guidance, e.g. avoid slang, always refer to the animal by name."
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />

        </div>

        {/* Placeholder palette */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
            Insert placeholder
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AI_PLACEHOLDERS.map((p) =>
            <button
              key={p.token}
              type="button"
              onClick={() => insertToken(p.token)}
              title={p.description}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">

                {p.token}
              </button>
            )}
            {ANIMAL_PLACEHOLDERS.map((p) =>
            <button
              key={p.token}
              type="button"
              onClick={() => insertToken(p.token)}
              title={p.description}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-background text-text-secondary border border-border hover:text-text-primary transition-colors">

                {p.token}
              </button>
            )}
          </div>
        </div>

        {/* Template body */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            Template body
          </label>
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-mono text-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />

        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!dirty}>
            Save template
          </Button>
          {saved &&
          <span className="text-sm text-[#3E7B52] font-medium">Saved</span>
          }
          {dirty && !saved &&
          <span className="text-sm text-text-secondary">Unsaved changes</span>
          }
        </div>
      </div>
    </Card>);

}
