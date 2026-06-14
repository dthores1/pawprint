// Supabase Edge Function: generate-adoption-profile
//
// Generates the ANIMAL-SPECIFIC portions of an adoption posting. The client
// assembles the final posting from the org's template (fixed disclaimers/fees +
// {{animal.*}} variables + these AI sections), so this function deliberately
// only produces the three AI placeholders and never the legal/boilerplate text:
//
//   ai_intro             a short hook / opening line(s)
//   ai_body              the main personality + temperament + medical-considerations narrative
//   ai_home_requirements a bulleted "what they're looking for in a home" list
//
// Grounded: it uses only the supplied Whiskerville data — no invented behaviors,
// toys, training history, kid/dog/cat compatibility, medical facts, or traits.
//
// Setup (one-time):
//   1. supabase secrets set OPENAI_API_KEY=sk-...   (already done)
//   2. supabase functions deploy generate-adoption-profile
//
// Response (JSON):
//   { sections: { ai_intro, ai_body, ai_home_requirements }, model }

// Deno globals (Supabase runtime). Lint-ignore the unknown ambient.
declare const Deno: { env: { get(key: string): string | undefined } };

const MODEL = 'gpt-4o-mini';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  });

interface AnimalInput {
  name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  age?: string;
  status?: string;
  description?: string;
}
interface TraitInput { name: string; description?: string }
interface MedicalInput {
  name: string;
  type?: string;
  status?: string;
  date?: string;
  notes?: string;
}
interface NoteInput { type?: string; body: string; date?: string }

interface ProfileRequest {
  animal?: AnimalInput;
  traits?: TraitInput[];
  medical?: MedicalInput[];
  notes?: NoteInput[];
  readiness?: Record<string, boolean>;
  // Per-generation user guidance, e.g. "keep it short for Petfinder".
  guidance?: string;
  // Org-level controls.
  tone?: string;
  length?: string;
  styleNotes?: string;
}

const TONE_GUIDANCE: Record<string, string> = {
  warm_conversational: 'Warm, friendly, and conversational — like a foster describing a pet they love.',
  professional: 'Professional, polished, and neutral in tone.',
  playful: 'Upbeat and playful, while staying accurate.'
};

const LENGTH_GUIDANCE: Record<string, string> = {
  short: 'Keep it concise — suitable for a short Petfinder blurb. ai_body should be 1 short paragraph.',
  standard: 'Standard length — ai_body should be 2 to 3 short paragraphs.',
  detailed: 'Detailed — ai_body may be 3 to 4 paragraphs, suitable for a website profile.'
};

function systemPrompt(req: ProfileRequest): string {
  const tone = TONE_GUIDANCE[req.tone ?? ''] ?? TONE_GUIDANCE.warm_conversational;
  const length = LENGTH_GUIDANCE[req.length ?? ''] ?? LENGTH_GUIDANCE.standard;
  return `You are writing the animal-specific sections of an adoption posting for an animal rescue organization.

GROUNDING — this is the most important rule:
Only use information that is explicitly provided in the data below. Do NOT infer, speculate, embellish, or invent. Specifically, never invent: behaviors, favorite toys or activities, training history, compatibility with children, compatibility with dogs or cats, medical information, or personality traits. If something is not stated, omit it. Accuracy is preferred over completeness — a shorter accurate profile is better than a longer speculative one.

FOCUS — prioritize what matters to an adopter: personality, temperament, compatibility with people and other animals (only if stated), home requirements, and medical considerations the adopter must know. Do NOT include internal rescue workflow details (intake logistics, staff names, internal IDs) unless directly relevant to an adopter.

DO NOT write any disclaimers, adoption fees, application instructions, organization information, or legal/closing language — those are added separately by the organization's template. Write ONLY the three sections below.

TONE: ${tone}
LENGTH: ${length}
${req.styleNotes ? `ORGANIZATION STYLE NOTES: ${req.styleNotes}\n` : ''}
Return a JSON object with exactly these string keys:
- "ai_intro": a brief opening hook (1-2 sentences) introducing the animal by name.
- "ai_body": the main narrative (personality, temperament, compatibility, medical considerations) per the length guidance.
- "ai_home_requirements": a bulleted list, one item per line, each line starting with "- ", describing what this animal needs in a home. Base each bullet only on provided data (e.g. "indoor-only" only if stated). If little is known, it is fine to return a short list.

Output ONLY valid JSON with those three keys and nothing else.`;
}

function buildUserMessage(req: ProfileRequest): string {
  const lines: string[] = [];
  const a = req.animal ?? {};

  lines.push('ANIMAL');
  if (a.name) lines.push(`Name: ${a.name}`);
  if (a.species) lines.push(`Species: ${a.species}`);
  if (a.breed) lines.push(`Breed/Type: ${a.breed}`);
  if (a.sex) lines.push(`Sex: ${a.sex}`);
  if (a.age) lines.push(`Age: ${a.age}`);
  if (a.description) lines.push(`Existing description: ${a.description}`);

  const traits = req.traits ?? [];
  lines.push('', 'PERSONALITY TRAITS');
  lines.push(
    traits.length === 0 ?
    '(none recorded)' :
    traits.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`).join('\n')
  );

  const medical = req.medical ?? [];
  lines.push('', 'MEDICAL RECORDS');
  lines.push(
    medical.length === 0 ?
    '(none recorded)' :
    medical.
    map((m) => {
      const parts = [m.name];
      if (m.status) parts.push(`status: ${m.status}`);
      if (m.date) parts.push(`date: ${m.date}`);
      if (m.notes) parts.push(`notes: ${m.notes}`);
      return `- ${parts.join(' · ')}`;
    }).
    join('\n')
  );

  const notes = req.notes ?? [];
  const fosterUpdates = notes.filter((n) => n.type === 'foster_update');
  const otherNotes = notes.filter((n) => n.type !== 'foster_update');
  lines.push('', 'FOSTER UPDATES');
  lines.push(
    fosterUpdates.length === 0 ?
    '(none recorded)' :
    fosterUpdates.map((n) => `- ${n.date ? `(${n.date}) ` : ''}${n.body}`).join('\n')
  );
  lines.push('', 'OTHER TIMELINE NOTES');
  lines.push(
    otherNotes.length === 0 ?
    '(none recorded)' :
    otherNotes.
    map((n) => `- ${[n.date, n.type].filter(Boolean).join(' · ')}: ${n.body}`).
    join('\n')
  );

  if (req.readiness && Object.keys(req.readiness).length > 0) {
    lines.push('', 'ADOPTION READINESS');
    for (const [k, v] of Object.entries(req.readiness)) {
      lines.push(`- ${k}: ${v ? 'yes' : 'no'}`);
    }
  }

  if (req.guidance && req.guidance.trim()) {
    lines.push(
      '',
      'ADDITIONAL USER GUIDANCE (follow this where it does not conflict with the grounding rule):',
      req.guidance.trim()
    );
  }

  lines.push(
    '',
    'Using ONLY the information above, produce the JSON with ai_intro, ai_body, and ai_home_requirements. Omit anything not stated; never invent traits, behaviors, or compatibility.'
  );
  return lines.join('\n');
}

function coerceSections(parsed: any): {
  ai_intro: string;
  ai_body: string;
  ai_home_requirements: string;
} {
  const str = (v: unknown): string =>
    typeof v === 'string' ?
    v.trim() :
    Array.isArray(v) ?
    v.map((x) => (typeof x === 'string' ? x : String(x))).join('\n') :
    '';
  return {
    ai_intro: str(parsed?.ai_intro),
    ai_body: str(parsed?.ai_body),
    ai_home_requirements: str(parsed?.ai_home_requirements)
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'Server not configured (OPENAI_API_KEY)' }, 500);

  let payload: ProfileRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!payload.animal) return json({ error: 'Missing animal data' }, 400);

  let resp: Response;
  try {
    resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(payload) },
          { role: 'user', content: buildUserMessage(payload) }
        ]
      })
    });
  } catch (err) {
    return json({ error: `OpenAI request failed: ${String(err)}` }, 502);
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message =
      (data && data.error && data.error.message) || `OpenAI error (${resp.status})`;
    return json({ error: message }, 502);
  }

  const raw: string | undefined = data?.choices?.[0]?.message?.content;
  if (!raw) return json({ error: 'OpenAI returned no content' }, 502);

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'OpenAI returned malformed JSON' }, 502);
  }
  const sections = coerceSections(parsed);
  if (!sections.ai_intro && !sections.ai_body) {
    return json({ error: 'OpenAI returned empty sections' }, 502);
  }

  return json({ sections, model: MODEL });
};

// @ts-expect-error — Deno-only ambient.
Deno.serve(handler);
