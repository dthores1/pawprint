// Supabase Edge Function: send-support-email
//
// Emails the Whiskerville support team when a member files a support ticket.
// The client calls this right after the `support_tickets` row is inserted; the
// row is the source of truth, so a failed/unconfigured send never blocks the
// report (the client logs and moves on).
//
// Setup (one-time):
//   1. Reuse the existing Resend setup from send-invite-email.
//   2. supabase secrets set RESEND_API_KEY=re_xxx
//      supabase secrets set INVITE_FROM_EMAIL="Whiskerville <support@whiskerville.app>"
//      supabase secrets set SUPPORT_TO_EMAIL=support@whiskerville.app   # optional, defaults below
//   3. supabase functions deploy send-support-email
//
// Request body (JSON): {
//   ticket_number: number,
//   category: 'bug' | 'feature' | 'question',
//   subject: string,
//   description: string,
//   steps_to_reproduce?: string,
//   organization_name?: string,
//   reporter_name?: string,
//   reporter_email?: string,
//   page_path?: string,
//   user_agent?: string,
//   app_version?: string,
//   attachment_url?: string,   // short-lived signed URL to the screenshot/file
//   attachment_name?: string
// }

// Deno globals (Supabase runtime). Lint-ignore the unknown ambient.
declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface SupportPayload {
  ticket_number: number;
  category: 'bug' | 'feature' | 'question';
  subject: string;
  description: string;
  steps_to_reproduce?: string;
  organization_name?: string;
  reporter_name?: string;
  reporter_email?: string;
  page_path?: string;
  user_agent?: string;
  app_version?: string;
  attachment_url?: string;
  attachment_name?: string;
}

const CATEGORY_LABEL: Record<SupportPayload['category'], string> = {
  bug: '🐞 Bug',
  feature: '💡 Feature request',
  question: '❓ Question'
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value?: string): string {
  if (!value) return '';
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#9a9a9a;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
    <td style="padding:4px 0;color:#2b2b2b;font-size:13px;word-break:break-word">${escapeHtml(value)}</td>
  </tr>`;
}

function emailHtml(p: SupportPayload): string {
  const reporter = p.reporter_name
    ? `${escapeHtml(p.reporter_name)}${p.reporter_email ? ` (${escapeHtml(p.reporter_email)})` : ''}`
    : p.reporter_email ?? 'Unknown';
  const stepsBlock = p.steps_to_reproduce
    ? `<h2 style="font-size:15px;margin:20px 0 6px;color:#2b2b2b">Steps to reproduce</h2>
       <p style="margin:0;color:#5a5a5a;font-size:14px;white-space:pre-wrap">${escapeHtml(p.steps_to_reproduce)}</p>`
    : '';
  const attachmentBlock = p.attachment_url
    ? `<p style="margin:20px 0 0;font-size:13px"><a href="${p.attachment_url}" style="color:#3e7b52">📎 ${escapeHtml(p.attachment_name ?? 'View attachment')}</a> <span style="color:#9a9a9a">(link expires)</span></p>`
    : '';
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f1eee8;padding:24px;color:#2b2b2b">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7e2d8;border-radius:16px;padding:32px">
    <div style="font-size:13px;color:#9a9a9a;margin:0 0 4px">Whiskerville support · Ticket #${p.ticket_number}</div>
    <h1 style="font-size:20px;margin:0 0 4px">${CATEGORY_LABEL[p.category] ?? 'Support'} — ${escapeHtml(p.subject)}</h1>
    <table style="border-collapse:collapse;margin:12px 0 4px">
      ${row('Reporter', reporter)}
      ${row('Organization', p.organization_name)}
      ${row('Page', p.page_path)}
      ${row('App version', p.app_version)}
      ${row('Browser', p.user_agent)}
    </table>
    <h2 style="font-size:15px;margin:20px 0 6px;color:#2b2b2b">Description</h2>
    <p style="margin:0;color:#5a5a5a;font-size:14px;white-space:pre-wrap">${escapeHtml(p.description)}</p>
    ${stepsBlock}
    ${attachmentBlock}
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
  const to = Deno.env.get('SUPPORT_TO_EMAIL') || 'support@whiskerville.app';
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server not configured (RESEND_API_KEY)' }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }

  let payload: SupportPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
  if (!payload.subject || !payload.description || !payload.category) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }

  const subject = `[${payload.category}] #${payload.ticket_number}: ${payload.subject}`;
  const html = emailHtml(payload);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      // Replies route back to the reporter when their email is known.
      ...(payload.reporter_email ? { reply_to: payload.reporter_email } : {})
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
