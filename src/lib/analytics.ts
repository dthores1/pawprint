import posthog from 'posthog-js';
import { isDemoMode, isAdminConsole } from './appMode';

// PostHog product analytics.
//
// Scope: PostHog answers "what are users doing" (feature usage, funnels,
// adoption). It is NOT the audit trail — "who changed this record" belongs in
// Postgres — and error tracking may move to Sentry later.
//
// Privacy: never send rescue/contact PII (names, addresses, phones, emails,
// note text, AI prompt contents). Events carry ids, enums, and counts only.
// The one exception is the signed-in staff user's own email on identify().
//
// Gating: tracking runs only in the real production app (not the demo/
// portfolio deploy, not the owner console) and only when VITE_POSTHOG_KEY is
// set. Every helper no-ops when uninitialized, so call sites never guard.
// Dev builds with a key DO capture — events carry an `environment` super
// property (vite mode) so dev traffic can be filtered out in PostHog.

// The full event catalog. Adding an event = adding it here first; the union
// keeps call sites typo-safe and doubles as the source of truth for what we
// track and how it's spelled (snake_case, past tense).
export type AnalyticsEvent =
  // Auth lifecycle
  | 'signed_in'                 // { method } — provider from auth metadata
  | 'signed_out'
  // Record creation / mutation (fired from modal submit handlers after the
  // context action resolves — not inside WhiskerContext, where demo/view-as
  // silently no-op writes and would produce false events)
  | 'animal_created'            // { species, status }
  | 'litter_created'            // { member_count, species }
  | 'litter_member_added'
  | 'litter_updated'
  | 'note_added'                // { note_type }
  | 'medical_record_added'      // { record_type }
  | 'photo_added'
  | 'file_added'
  | 'relationship_added'        // { relationship_type }
  | 'external_listing_added'    // { platform }
  | 'animal_placed'             // { reassignment }
  | 'placement_ended'
  | 'reassignment_requested'
  | 'animal_status_changed'     // { new_status, new_priority }
  | 'traits_updated'            // { trait_count }
  | 'adoption_started'
  | 'adoption_completed'
  | 'adoption_updated'
  | 'adoption_cancelled'
  | 'adoption_returned'
  | 'contact_added'             // { roles }
  | 'foster_added'
  | 'app_invite_sent'
  | 'app_invite_resent'
  | 'app_invite_revoked'
  | 'supply_request_created'    // { item_count }
  | 'supply_request_status_changed' // { new_status }
  | 'product_added'
  | 'transport_request_created'
  | 'transport_claimed'
  | 'transport_assigned'
  | 'transport_accepted'
  | 'transport_unassigned'
  | 'transport_completed'
  | 'sitting_request_created'
  | 'sitting_accepted'
  | 'sitting_released'
  | 'sitting_completed'
  | 'clinic_event_created'
  | 'clinic_slot_added'         // { procedure_count }
  | 'clinic_procedure_toggled'  // { completed }
  | 'clinic_completed'
  | 'site_created'
  | 'site_updated'
  | 'site_note_added'
  | 'support_ticket_created'
  | 'action_item_added'
  | 'action_item_completed'
  | 'action_item_cancelled'
  // UI interactions
  | 'tab_viewed'                // { page, tab }
  | 'modal_opened'              // { modal, page }
  | 'help_opened'               // { guidance_key }
  | 'checklist_dismissed'
  | 'search_opened'
  | 'search_result_selected'    // { result_type }
  | 'address_selected'          // Places suggestion picked (not per keystroke)
  | 'ai_generation_started'     // { asset_type: 'summary' | 'adoption_profile', regenerate }
  | 'ai_generation_succeeded'   // { asset_type }
  | 'ai_generation_failed'      // { asset_type }
  | 'setting_changed'           // { setting, value? } — value only for toggles/enums
  | 'report_range_changed'      // { preset }
  | 'report_chart_changed'      // { chart, chart_type }
  | 'history_toggled';          // { page, shown }

let initialized = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || isDemoMode || isAdminConsole) return;
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    // Explicit events only — no DOM-click autocapture, and SPA pageviews are
    // fired manually on route change (trackPageView) instead of on load.
    autocapture: false,
    capture_pageview: false,
    person_profiles: 'identified_only'
  });
  posthog.register({
    app: 'whiskerville',
    environment: import.meta.env.MODE
  });
  initialized = true;
}

export function track(
event: AnalyticsEvent,
properties?: Record<string, unknown>)
{
  if (!initialized) return;
  posthog.capture(event, properties);
}

// SPA pageview on route change. PostHog reads the URL itself; the explicit
// path property makes funnels readable without $current_url parsing.
export function trackPageView(path: string) {
  if (!initialized) return;
  posthog.capture('$pageview', { path });
}

export function identifyUser(userId: string, email?: string | null) {
  if (!initialized) return;
  posthog.identify(userId, email ? { email } : undefined);
}

// Org-level (group) analytics: usage rolls up per rescue, and every event
// carries organization_id while the group is set.
export function setAnalyticsOrganization(
orgId: string,
name: string,
role?: string)
{
  if (!initialized) return;
  posthog.group('organization', orgId, { name, role });
  posthog.register({ organization_id: orgId });
}

// Mark events fired during "view as" impersonation (writes no-op there, but
// navigation/open events still flow — this keeps them filterable).
export function setViewAsActive(active: boolean) {
  if (!initialized) return;
  if (active) posthog.register({ view_as: true });else
  posthog.unregister('view_as');
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}
