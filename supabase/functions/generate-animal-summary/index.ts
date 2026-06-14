// Supabase Edge Function: generate-animal-summary
//
// Generates written content about an animal (currently the "Summary" tab) by
// calling OpenAI. The client assembles a structured `inputs` payload from the
// data already loaded on the animal page (bio, traits, medical records, notes)
// and POSTs it here; this function turns that into a strict prompt, calls the
// Chat Completions API, and returns the text. It deliberately does NOT touch
// the database — the client persists the result through the normal RLS path
// (see `generateAiSummary` in WhiskerContext), keeping all writes in one place.
//
// Setup (one-time):
//   1. supabase secrets set OPENAI_API_KEY=sk-...   (already done)
//   2. supabase functions deploy generate-animal-summary
//
// Request body (JSON):
//   {
//     contentType: 'summary',
//     animal: { name, species, breed?, sex, age?, status?, intakeSource?, description? },
//     traits:  [{ name, description? }],
//     medical: [{ name, type?, status?, date?, notes? }],
//     notes:   [{ type?, body, date? }]
//   }
//
// Response (JSON): { content: string, model: string }

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
  intakeSource?: string;
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

interface SummaryRequest {
  contentType?: string;
  animal?: AnimalInput;
  traits?: TraitInput[];
  medical?: MedicalInput[];
  notes?: NoteInput[];
}

// The system prompt is intentionally strict: the rescue context makes
// fabricated personality/behavior claims actively harmful (they end up in
// adoption listings). Accuracy over richness, always.
const SYSTEM_PROMPT = `You are writing a summary for an animal rescue organization.

Only use information that is explicitly provided.

Do not infer, speculate, embellish, or invent facts.

Do not assume favorite activities, toys, behaviors, preferences, training level, family interactions, or personality traits that are not provided.

If information is unavailable, omit it.

It is better to produce a short and accurate summary than a detailed but speculative one.

Write 2 to 4 short paragraphs of plain prose. Do not use headings, bullet points, markdown, or a closing sign-off. Write in a warm but factual tone suitable for staff and potential adopters.`;

function buildUserMessage(req: SummaryRequest): string {
  const lines: string[] = [];
  const a = req.animal ?? {};

  lines.push('ANIMAL');
  if (a.name) lines.push(`Name: ${a.name}`);
  if (a.species) lines.push(`Species: ${a.species}`);
  if (a.breed) lines.push(`Breed/Type: ${a.breed}`);
  if (a.sex) lines.push(`Sex: ${a.sex}`);
  if (a.age) lines.push(`Age: ${a.age}`);
  if (a.status) lines.push(`Status: ${a.status}`);
  if (a.intakeSource) lines.push(`How they came into rescue: ${a.intakeSource}`);
  if (a.description) lines.push(`Existing description: ${a.description}`);

  const traits = req.traits ?? [];
  lines.push('', 'PERSONALITY TRAITS');
  if (traits.length === 0) {
    lines.push('(none recorded)');
  } else {
    for (const t of traits) {
      lines.push(`- ${t.name}${t.description ? `: ${t.description}` : ''}`);
    }
  }

  const medical = req.medical ?? [];
  lines.push('', 'MEDICAL RECORDS');
  if (medical.length === 0) {
    lines.push('(none recorded)');
  } else {
    for (const m of medical) {
      const parts = [m.name];
      if (m.status) parts.push(`status: ${m.status}`);
      if (m.date) parts.push(`date: ${m.date}`);
      if (m.notes) parts.push(`notes: ${m.notes}`);
      lines.push(`- ${parts.join(' · ')}`);
    }
  }

  const notes = req.notes ?? [];
  lines.push('', 'NOTES');
  if (notes.length === 0) {
    lines.push('(none recorded)');
  } else {
    for (const n of notes) {
      const prefix = [n.date, n.type].filter(Boolean).join(' · ');
      lines.push(`- ${prefix ? `(${prefix}) ` : ''}${n.body}`);
    }
  }

  lines.push(
    '',
    'Using ONLY the information above, write the summary. Remember: omit anything not stated, and never invent traits or behaviors.'
  );
  return lines.join('\n');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return json({ error: 'Server not configured (OPENAI_API_KEY)' }, 500);
  }

  let payload: SummaryRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!payload.animal) {
    return json({ error: 'Missing animal data' }, 400);
  }

  const userMessage = buildUserMessage(payload);

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
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
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

  const content: string | undefined = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return json({ error: 'OpenAI returned no content' }, 502);
  }

  return json({ content, model: MODEL });
};

// @ts-expect-error — Deno-only ambient.
Deno.serve(handler);
