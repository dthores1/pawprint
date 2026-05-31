// Supabase Edge Function: send-invite-email
//
// Sends a transactional invite email via Resend. The client calls this right
// after `create_org_invite` succeeds; if the function isn't deployed or fails,
// the inviter can still copy the link manually from the Organization page.
//
// Setup (one-time):
//   1. Sign up at https://resend.com and verify a sending domain (or use the
//      sandbox from-address while testing).
//   2. supabase secrets set RESEND_API_KEY=re_xxx
//      supabase secrets set APP_BASE_URL=https://your-app.example
//      supabase secrets set INVITE_FROM_EMAIL="Whiskerville <support@whiskerville.app>"
//   3. supabase functions deploy send-invite-email
//
// Request body (JSON): {
//   token: string,             // invite token (uuid)
//   email: string,             // recipient
//   organization_name: string, // for the subject/body
//   role: 'admin' | 'member',  // org-level role
//   invited_by_name?: string   // optional, for personalization
// }

// Deno globals (Supabase runtime). Lint-ignore the unknown ambient.
declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface InvitePayload {
  token: string;
  email: string;
  organization_name: string;
  role: 'admin' | 'member';
  invited_by_name?: string;
}

function emailHtml(p: InvitePayload, link: string): string {
  const inviter = p.invited_by_name ? `${escapeHtml(p.invited_by_name)} on ` : '';
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f1eee8;padding:24px;color:#2b2b2b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e2d8;border-radius:16px;padding:32px">
    <h1 style="font-size:22px;margin:0 0 8px">You're invited to ${escapeHtml(p.organization_name)}</h1>
    <p style="margin:0 0 16px;color:#5a5a5a">${inviter}Whiskerville sent you an invite to join as <strong>${escapeHtml(p.role)}</strong>.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#3e7b52;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Accept invite</a></p>
    <p style="margin:0 0 8px;font-size:13px;color:#5a5a5a">Or open this link directly:</p>
    <p style="margin:0;font-size:13px;word-break:break-all"><a href="${link}" style="color:#3e7b52">${link}</a></p>
    <p style="margin:24px 0 0;font-size:12px;color:#9a9a9a">This invite expires in 14 days. If you weren't expecting it, you can ignore this email.</p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// deno-lint-ignore no-explicit-any
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const baseUrl = Deno.env.get('APP_BASE_URL');
  const from = Deno.env.get('INVITE_FROM_EMAIL') || 'Whiskerville <onboarding@resend.dev>';
  if (!apiKey || !baseUrl) {
    return new Response(
      JSON.stringify({ error: 'Server not configured (RESEND_API_KEY / APP_BASE_URL)' }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }

  let payload: InvitePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }
  if (!payload.token || !payload.email || !payload.organization_name) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' }
    });
  }

  const link = `${baseUrl.replace(/\/$/, '')}/invite/${payload.token}`;
  const subject = `You're invited to ${payload.organization_name} on Pawprint`;
  const html = emailHtml(payload, link);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: payload.email,
      subject,
      html
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
