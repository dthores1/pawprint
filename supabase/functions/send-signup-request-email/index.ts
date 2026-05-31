// Supabase Edge Function: send-signup-request-email
//
// Notifies support@ when someone submits the public "Request Beta Access" form.
// The request row is already persisted by the client (RLS-allowed anon insert);
// this is a best-effort notification, so failures here don't block the user.
//
// Setup (one-time) — reuses the same Resend secrets as send-invite-email:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set INVITE_FROM_EMAIL="Whiskerville <invites@your-domain>"
//   (optional) supabase secrets set SIGNUP_NOTIFY_EMAIL="support@whiskerville.app"
//   supabase functions deploy send-signup-request-email
//
// Request body (JSON): the inserted row (organization_name, organization_type,
// contact_*, city, state, website, animal_count_range, notes, …).

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface SignupRow {
  organization_name?: string;
  organization_type?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string | null;
  city?: string;
  state?: string;
  website?: string | null;
  animal_count_range?: string | null;
  notes?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value?: string | null): string {
  if (!value) return '';
  return `<tr>
    <td style="padding:6px 12px;color:#6b6b6b;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
    <td style="padding:6px 12px;color:#2b2b2b">${escapeHtml(value)}</td>
  </tr>`;
}

function emailHtml(p: SignupRow): string {
  const name = `${p.contact_first_name ?? ''} ${p.contact_last_name ?? ''}`.trim();
  const place = [p.city, p.state].filter(Boolean).join(', ');
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f1eee8;padding:24px;color:#2b2b2b">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7e2d8;border-radius:16px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 4px">New beta access request</h1>
    <p style="margin:0 0 20px;color:#5a5a5a">${escapeHtml(p.organization_name ?? 'Unknown organization')}</p>
    <table style="border-collapse:collapse;font-size:14px;width:100%">
      ${row('Organization', p.organization_name)}
      ${row('Type', p.organization_type)}
      ${row('Location', place)}
      ${row('Website', p.website ?? undefined)}
      ${row('Contact', name)}
      ${row('Email', p.contact_email)}
      ${row('Phone', p.contact_phone ?? undefined)}
      ${row('Animals at a time', p.animal_count_range ?? undefined)}
      ${row('Notes', p.notes ?? undefined)}
    </table>
    <p style="margin:24px 0 0;font-size:12px;color:#9a9a9a">Logged in organization_signup_requests. Reply directly to reach the contact.</p>
  </div>
</body></html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('INVITE_FROM_EMAIL') || 'Whiskerville <onboarding@resend.dev>';
  const to = Deno.env.get('SIGNUP_NOTIFY_EMAIL') || 'support@whiskerville.app';
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server not configured (RESEND_API_KEY)' }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }

  let payload: SignupRow;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Beta request: ${payload.organization_name ?? 'New organization'}`,
      html: emailHtml(payload),
      // Let support reply straight to the requester.
      reply_to: payload.contact_email || undefined
    })
  });
  const data = await resp.text();
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: 'Resend send failed', detail: data }), {
      status: 502,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'application/json' }
  });
};

// @ts-expect-error — Deno-only ambient.
Deno.serve(handler);
