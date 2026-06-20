# Whiskerville (fka Pawprint)

An operationally-focused animal rescue management app. Whiskerville helps small-to-medium rescues track animals, foster parents, medical care, supply logistics, and adoption pipelines without the bloat of legacy shelter software.

This document is the canonical reference for **product logic, data model, and design conventions**. Update it whenever a meaningful behavior changes.

> **Stack note:** Whiskerville is a React + TypeScript + Vite + Tailwind front end backed by **Supabase** (Postgres + Row-Level Security + Storage + Auth). It is **multi-tenant** — every record belongs to an `organization`, and access is gated by org membership via RLS. See §0 for the backend model; the entity sections below describe the app-facing shapes.


![Application Dashboard / Landing page](docs/images/Landing_Page.png "Dashboard of the application where users can determine organization status at a glance and review items that need attention.")

---

## 0. Backend, persistence & auth

Whiskerville persists everything to **Supabase**. The schema lives in `supabase/migrations/*.sql` (run in order in the Supabase SQL editor); the front end talks to it through `src/lib/supabase.ts` and a thin mapping layer in `src/lib/*Api.ts`.

- **Multi-tenant.** Every table carries an `organization_id`. **Row-Level Security** policies restrict every read/write to members of that org (`is_org_member(organization_id)`), so one rescue can never see another's data. `organization_members` links Supabase auth users to orgs with a role (`owner` / `admin` / `member`).
- **Auth.** Google OAuth + email/password (Supabase Auth). On first sign-in a user with no org is sent to an **Onboarding** screen to create one (a DB trigger makes them the owner). The app is gated: loading → login → onboarding → app.
- **Accounts vs. contacts.** The signed-in user gets a "self" row in `people` (linked by `user_id`) so their actions can be attributed ("Requested by …"). These self records are **hidden from the Contacts directory** — `people` doubles as both the org's contact directory *and* the set of user accounts, distinguished by `user_id`. (No separate `profiles` table, by design.)
- **Storage.** Animal photos live in a public `animal-photos` bucket; `animal_photos` rows hold the `storage_path` + `public_url` metadata.
- **State.** `src/context/WhiskerContext.tsx` exposes every collection + CRUD action via `useWhisker()` (now Supabase-backed, optimistic writes), and `src/context/AuthContext.tsx` owns session, `currentOrg`, and `currentPersonId`. `src/data/seed.ts` is no longer loaded at runtime, but is **intentionally kept** for a planned no-auth demo/portfolio mode (see below).

The sections below describe the **app-facing TypeScript shapes** (`src/types/index.ts`). DB columns are snake_case and largely 1:1; a few differences are called out (e.g. photos' `url` ↔ `public_url`).

---

## 1. Domain model

### Animal

The central record. Every animal has both a **lifecycle status** and an orthogonal **priority** — these answer two different questions.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable identifier (e.g. `a4`). Surfaced in UI as `#a4`. |
| `name` | string | |
| `species` | `Dog \| Cat \| Other` | |
| `sex` | `Male \| Female \| Unknown` | |
| `estimated_birth_date` | ISO date | Drives `calculateAge()` display. |
| `intake_date` | ISO date | |
| `intake_source` | string | e.g. "City Shelter Transfer". |
| `status` | `AnimalStatus` | Lifecycle stage — see §2. |
| `priority` | `Priority` | Severity / attention level — see §3. |
| `action_needed` | string? | **Retired** — next steps now live in `animal_action_items` (`AnimalActionItem`). See §4. |
| `description` | string | Free-form personality / context. |
| `microchip_number` | string? | |
| `primary_photo_url` | string? | |
| `adoption_profile_url` | string? | External Petfinder / Adopt-a-Pet / org listing URL. See §8. |

![Animal Detail page](docs/images/Animal_Detail.png "The animal detail page that shows their timeline, medical history, notes, relationships to other animals, and adoption readiness. Specific details on the animal's species, status, priority, etc. are tracked at the top level.")

Two more Animal fields worth calling out:

- **`current_foster_id`** — denormalized cache of the active placement's foster (`person_id`, a `people` row). The placements collection is still the source of truth for history; `placeAnimal` and `reassignFoster` keep this field in sync.
- **`internal_notes`** — staff-only free-form notes. Separate from `description`, which is the public-facing blurb.

### Other entities

- **Fosters are `people`, not a separate table.** A foster is a `Person` whose `roles` include `'foster_parent'`, carrying foster-specific fields (`max_capacity`, `preferred_species`, `address`). The `fosters` collection is a derived view (`people.filter(roles.includes('foster_parent'))`); the Add/Edit Foster forms write a `people` row (legacy `role` set to `'volunteer'`). The old `foster_parents` table is retired — see migration `0012`.
- **`FosterPlacement`** — links one animal to one foster (`person_id` → `people`) with a `start_date`, optional `end_date`, `placement_status` (`active` / `completed` / `interrupted`), `placement_type` (`foster` / `medical_foster` / `trial_adoption`), and optional `reason_ended`. An animal is considered "in foster" if any placement with `placement_status: 'active'` exists. The Placement Timeline on the Animal Profile renders this history as a date-range stack.
- **`MedicalRecord`** — procedure log with `procedure_type`, `procedure_name`, `status` (`completed` / `due` / `scheduled` / `overdue` / `cancelled`), `performed_date` and/or `due_date`, `notes`, and an optional `next_due_date` for recurring procedures (vaccine/exam/surgery/medication) — e.g. a rabies booster due in a year. The Add Medical modal only prompts for next-due on those types, via a relative interval (in N days/weeks/months/years) or an exact date. **Attribution** uses paired lookup-or-free-text fields: **Performed by** is either a known contact (`provider_contact_id` → `people`) or a free-text `provider_name`; **Facility / Event** is either a scheduled clinic (`clinic_id` → `clinic_events`) or a free-text `facility_name`. Each pair is mutually exclusive (picking a contact/clinic clears the free-text, and vice versa). FKs are `ON DELETE SET NULL` so removing a contact or clinic never deletes medical history.
- **`AnimalNote`** — timestamped free-text note with a `note_type` (`behavior` / `medical` / `foster_update` / `adoption` / `general`).
- **`AnimalActionItem`** — a tracked "next step" with `description`, elevated `priority`, and `status` (`open` / `completed` / `cancelled`). Replaces the old `action_needed` field so completions are kept in history. At most one `open` per animal. See §4.
- **`Adoption`** — the operational adoption workflow record (one row per adoption attempt; at most one *active* per animal). `status` runs `inquiry` → `application_submitted` → `meet_and_greet` → `pending_paperwork` → `ready_for_placement`, then a terminal state: `completed` (finalized — sets the animal to `adopted`, stamps `adopted_by_id` / `adopted_at`, closes any active placement), `cancelled` (abandoned), or **`returned`** (a completed adoption reversed because the adopter returned the animal — see §8). Started via **Start Adoption** on the Animal Profile; advanced/completed through the `AdoptionPanel`.
- **`AnimalRelationship`** — animal-to-animal link (mother, father, sibling, etc.). See §8.
- **`Litter`** — groups animals that share intake/age/origin metadata (species, breed, estimated birth date, intake date/source). Members link via `animals.litter_id`; littermates are derived from that shared id, not from `AnimalRelationship`. Created by the Add Litter flow. See §8.
- **`AnimalPhoto`** — gallery photo with a `category`. See §8.
- **`Person`** — every human in the org. A single flat `roles` array is the source of truth for what someone does — `foster_parent`, `admin`, `event_support`, `social_media`, `trapper`, `transport`, `vet`, `rescue_staff` (and system-managed `adopter`). This **replaced the old `role` + `volunteer_type` split** (`volunteer_type` is retired; the legacy single `role` column is still written via `legacyRoleFor()` for back-compat but reads come from `roles`). The Add/Edit Contact and Add/Edit Foster forms all edit `roles` via the grouped `RolesMultiSelect`. Used by the Contacts page, as the requester on supply / transport / sitting requests, and as the foster on placements.
- **`Product`**, **`SupplyRequest`**, **`SupplyRequestItem`** — supply ordering. See §10.
- **`TransportRequest`** — request to move an animal or supplies between locations. See §11.
- **`SittingRequest`** — temporary foster coverage when a placement's foster is unavailable. See §11.
- **`ClinicEvent`**, **`ClinicSlot`**, **`ClinicSlotProcedure`** — TNR clinic planning: a vet date with a fixed capacity, the animals assigned to it (slots), and each slot's procedures (an animal usually gets several per visit). See §11.

---

## 2. Status taxonomy (lifecycle)

Status describes **where the animal is in its journey** — and *only* that. It is intentionally a closed enum; arbitrary statuses are not supported.

| Value | Label | Meaning |
|---|---|---|
| `intake` | Intake | Just arrived. Awaiting evaluation or placement. |
| `in_care` | In Care | In the rescue's care and being readied, but not yet cleared for adoption. |
| `adoptable` | Adoptable | Cleared for adoption and listed. |
| `adopted` | Adopted | Adopted out. Reversible — an **Adoption Return** sends the animal back to `intake` (see §8). |
| `released` | Released | TNR — animal was returned to site. |
| `hospice` | Hospice | End-of-life comfort care. |
| `deceased` | Deceased | Final outcome — passed away. |

Status colors are tuned to feel calm and descriptive, not alarming. See `tailwind.config.js → colors.status`.

**Care flags are orthogonal to status.** *Why* an animal isn't progressing (or what to know about it) is **not** a lifecycle stage — it lives in independent boolean flags that coexist with any status: `is_on_hold` ("temporarily unavailable for adoption or transfer"), `has_behavior_concern`, and `has_medical_concern`. So a kitten with a URI is `in_care` + medical concern; an adoptable dog with a pending application is `adoptable` + on hold. Status is the single gate for listing (`adoptable` && !`is_on_hold`); the concern flags are informational and never subtract from adoptability. This is why there is no `medical` status — it described a *reason*, not a place in the journey (retired in migration 0054 → `in_care` + `has_medical_concern`).

---

## 3. Priority taxonomy (severity)

Priority is **independent of status** and describes how much attention the animal needs right now. Normal priority is the default and is intentionally invisible in the UI so the app stays calm — only elevated priorities surface a pill.

| Value | Label | Visual treatment |
|---|---|---|
| `normal` | Normal | No badge displayed (default). |
| `needs_attention` | Needs Attention | Soft amber dot + pill. |
| `urgent` | Urgent | Warm red dot + pill. |
| `critical` | Critical | Solid deep red pill (highest visual weight). |

Priority ordering for sorts: `critical > urgent > needs_attention > normal`. See `PRIORITY_RANK` in `pages/Dashboard.tsx`.

---

## 4. Action Needed

Priority answers "how worried should I be?" Status answers "where is this animal?" **Action items** answer "what should someone do today?"

- Action items live in their own table (`AnimalActionItem` → `animal_action_items`), **not** a single field on `Animal`. This keeps a tracked history (completions/cancellations show in the activity timeline) — see the `0011` migration. (The legacy `animals.action_needed` column is retired; do not write to it.)
- Each item has a `description`, its own elevated `priority` (`needs_attention` / `urgent` / `critical`), and a lifecycle `status` (`open` / `completed` / `cancelled`). Completing or cancelling stamps `completed_at` + `completed_by`; **at most one `open` item per animal** (partial unique index).
- The `ActionNeededCallout` component (Animal Profile, below the hero) is the canonical surface. It shows the single open item with **Complete** (✓) and **Edit** (✏) icon buttons. Complete opens an in-place confirmation: **Complete**, **Complete & Add Next Step** (completes + creates a fresh open item), or **Cancel item** (sets `cancelled`).
- The banner is visible whenever there's an open item **or** the animal's `priority !== 'normal'`. If the priority is elevated but no open item exists, it shows: *"{name} is still marked {priority} but has no active action item."* with an **Add action item** button — a soft forcing function for data quality.
- Text should be specific and operational. Good: *"Soft food only + finish 10-day antibiotic course (3 days remaining). Recheck on Nov 25."* Bad: *"Needs care."*
- The open item's `description` is reused as the subtitle in the Dashboard's **Needs Action** list and Global Search's **Needs Attention** section. With no open item, those views fall back to `"Needs placement"` (no active placement) or `"Needs review"` (otherwise).

---

## 5. Greeting logic

`getGreeting(date = new Date())` in `lib/utils.ts` returns one of four prefixes based on the user's local time. Boundaries are minute-precise and inclusive.

| Window | Greeting |
|---|---|
| 5:01 am – 11:00 am | Good morning |
| 12:01 pm – 5:00 pm | Good afternoon |
| 7:01 pm – 1:00 am (crosses midnight) | Good evening |
| All other minutes (1:01–5:00, 11:01–12:00, 5:01–7:00) | Welcome back |

The user name is currently hardcoded as `CURRENT_USER_NAME = 'Dan'` in `pages/Dashboard.tsx` with a `TODO` to wire to `useUser().name` when auth lands.

---

## 6. Global search

`components/search/GlobalSearch.tsx` is the primary discovery surface, rendered prominently on the Dashboard.

**What it searches:**
- **Animals** — name, id, microchip number
- **Fosters** — first name, last name, email
- **Contacts** — first name, last name, email, organization

**Empty-query behavior:** When focused with no query, the panel shows a **Needs Attention** default section containing all overdue medical records and all `urgent`/`critical` animals. This makes the search bar useful as an at-a-glance triage tool, not just a search.

**Keyboard:**
- `Cmd/Ctrl + K` — focus the search and open the panel.
- `Esc` — close the panel and blur the input.
- Click any result to navigate to its detail page.

Results are capped per section (5 animals, 5 fosters, 4 contacts, 5 needs-attention items) to keep the panel scannable.

---

## 7. Filters (Animals list)

Hierarchy is intentional:
1. **Search** is dominant — full-width, 48px tall, with a clear (×) button when populated.
2. **Filter pills** sit below in a single compact row: `Status`, `Priority`, `Species`. Each is a `FilterDropdown` (custom popover) showing "Label: value ▾".
3. **Active filter chips** appear below the pills when any filter is applied. Each chip can be cleared individually; a "Clear all" link resets everything. A live "n of m animals" counter sits on the right.

**The Foster filter was intentionally removed** — at scale (dozens of fosters), a dropdown becomes a wall. Search by foster name or use the Fosters page instead.

**Species filter auto-hides** when `ENABLED_SPECIES` contains only one species (see §11).

**Bonded pair indicator.** When an animal has a `bonded_pair` relationship, a small lavender-gray "Bonded Pair" chip with a two-pets glyph renders under its name in the table. Coordinators can spot inseparable pairs without opening the profile.

![Animal List](docs/images/Animal_Tab.png "The animal list shows the organization's animals at a glance and allows quick filtering and sorting based on Status, Priority, or Species.")

---

## 8. Relationships, photos, and the adoption listing

The Animal Profile carries three additional surfaces that round out the record.

### Relationships
Animals can be linked via `AnimalRelationship` records with type `mother | father | child | sibling | bonded_pair`.

- **Storage is one-directional.** A record like `{ animal_id: 'a2', related_animal_id: 'a10', relationship_type: 'mother' }` means "a2 is the mother of a10."
- **Display is bidirectional.** The `RelationshipsCard` walks the relationships list and derives the inverse automatically, so a10's page shows "Mother: a2" without needing a duplicate row.
- Symmetric types (`sibling`, `bonded_pair`) appear identically on both ends.
- **Littermates are not a relationship type.** They are derived from a shared `Litter` (animals with the same `litter_id`) rather than stored as rows — this avoids the N² explosion of pairwise littermate links. The `RelationshipsCard` reads both `AnimalRelationship` rows and `litter_id`, and renders littermate links as read-only (no delete button), since the link lives on the litter, not a relationship. See the Litters note below.
- **The card always renders.** When empty, it shows a soft empty state with a "Link to another animal" CTA. The "Add" button in the header opens `AddRelationshipModal`, which has a searchable animal picker that excludes the current animal and any already-linked animals.
- "Bonded With" is highlighted with a heart icon — adoption coordinators need to see at a glance that an animal cannot be separated.
- The card header uses the custom `BoneIcon` since the relationships are animal-to-animal, not people.

### Litters
Rescues frequently intake whole litters at once. The **Add Litter** flow lives inside the **Add Animal** modal: a `What are you adding?` radio toggles between **Single Animal** and **Litter** (single is the default; the primary CTA stays "Add Animal").

- **Shared once, per-member differs.** Litter-wide fields (species, breed, age / estimated birth date, intake date, intake source, optional litter name + notes) are entered once. Each member row only captures what differs: name, sex, and markings/notes.
- **Members table.** Starts with two rows; "Add another puppy/kitten" (the noun follows species) adds more. Blank names are auto-filled at submit with a temporary placeholder (`Puppy 1`, `Kitten 2`, …).
- **What gets created.** `addLitter` inserts one `Litter` row, then one `Animal` per member stamped with the shared metadata and the new `litter_id`. Members start as `intake` / `normal` priority.
- **Littermates are derived, not stored.** Animals sharing a `litter_id` are littermates; the `RelationshipsCard` surfaces them automatically (read-only). There is intentionally no `littermate` `AnimalRelationship` type.

### Photo gallery
Animals can carry many photos (`AnimalPhoto` records) categorized by `PhotoCategory`: `intake | profile | medical | foster | adoption | post_adoption | other`. The Animal Profile has a dedicated **Photos** tab that:

- Groups photos by category in display order (profile → intake → medical → foster → adoption → post_adoption → other).
- Renders a square thumbnail grid with hover-overlay captions.
- Opens a full-screen lightbox on click with keyboard navigation (← / → / Esc) and a delete affordance.
- Has its own "Add Photo" modal that accepts either a URL **or** a file upload (converted to a data URL via `FileReader.readAsDataURL` since we have no upload backend yet).
- Accepts drag-and-drop directly onto the gallery: drop an image anywhere on the tab and the modal opens pre-filled with that image.

`primary_photo_url` on `Animal` remains the single "featured" photo used in lists and the profile hero — intentionally separate from the gallery.

### Adoption listing
When an animal's `status` is `adoptable`, the `AdoptionProfileCard` appears in the right sidebar with the external `adoption_profile_url` (Petfinder, Adopt-a-Pet, or the org's own site) plus Open / Copy / Edit actions. If status is adoptable but no URL is set, the card prompts to add one — same forcing-function pattern as Action Needed. The card is hidden entirely for non-adoptable statuses.

### Adoption return
Adopted animals are sometimes returned. When `animal.status === 'adopted'`, the Animal Profile shows an **Adoption Return** button (in the slot that otherwise holds Place in Foster / Start Adoption — the three are mutually exclusive). It opens the `AdoptionReturnModal`, which:

- Finds the **latest completed `Adoption`** for the animal. If one exists, that record is flipped to `status: 'returned'`. If none exists (e.g. the adoption predates this workflow), the modal first captures the original adopter and creates a `returned` record inline.
- Captures `returned_at` (defaults to now), a required `return_reason` (a fixed vocabulary: behavioral / medical / financial / housing / pet- or family-compatibility / life changes / rescue request / other), and optional `return_notes`. A DB CHECK (`chk_return_reason_required`, migration `0029`) enforces that a `returned` adoption always carries a reason.
- Brings the animal **back into care**: `status` → `intake`, clears `adopted_by_id` / `adopted_at`, and lifts any adoption hold. The return surfaces as an event on the Animal Profile timeline.

A `returned` adoption is terminal (`isActiveAdoption` treats it like `completed` / `cancelled`) and is excluded from completed-adoption metrics on the Reports page.

---

## 9. Medical history

The Animal Profile uses a tabbed left column:

- **Timeline** — all events (intake, medical, placements, notes) in reverse chronological order.
- **Medical History** — medical records only, grouped into Overdue / Upcoming / Completed / Other, each in a separate card with a colored header. Each record shows procedure name, type, status pill, date (with prefix: "Performed" / "Was due" / "Due"), provider, and notes.
- **Photos** — see §8.

This separation lets a user verify medical compliance without sifting through unrelated events. The Medical History tab uses the custom `MedicalKitIcon` (a briefcase + plus glyph) instead of a generic clipboard.

---

## 10. Supply Requests

The Supplies feature lives at `/supplies` and is designed to feel like **coordinating care resources**, not filing procurement tickets. Lead with the person and the animal; the request ID is a detail, not a header.

### Domain

Three tables back the feature:

- **`Product`** — lightweight catalog (`id`, `name`, `category`, `default_unit`, `active`). Categories: `food | litter | medical | bedding | enrichment | cleaning | other`.
- **`SupplyRequest`** — the parent record (`requester_person_id`, optional `requested_for_animal_id`, `status`, `priority`, `requested_date`, optional `needed_by_date`, optional `approved_by_person_id` / `fulfilled_by_person_id` / `fulfilled_date`, optional `delivery_method` (`pickup | drop_off | shipped`), `notes`, timestamps).
- **`SupplyRequestItem`** — line items, each pointing to either a `product_id` from the catalog **or** a `custom_item_name` (for items not in the catalog), plus `quantity`, `unit`, and optional `notes`.

A request can have many items. Each item is for the same request — multi-animal requests are intentionally out of scope for now.

![Supply Requests tab](docs/images/Supply_Requests_Tab.png "The Supply Requests tab allows quick review of existing Requests, linking to volunteer and animal.")

### Status lifecycle

| Value | Label | Meaning |
|---|---|---|
| `submitted` | Submitted | Just created by the requester. |
| `reviewing` | Reviewing | Staff is evaluating the request. |
| `approved` | Approved | Cleared to order. |
| `ordered` | Ordered | Placed with a vendor. |
| `ready_for_pickup` | Ready for Pickup | Available at the rescue. |
| `delivered` | Delivered | Handed off to the requester. |
| `completed` | Completed | Closed out. |
| `cancelled` | Cancelled | Soft exit at any point. |

`SupplyRequestPriority` is `normal | urgent | critical`, orthogonal to status (same pattern as animals — see §3).

![Supply Requests example](docs/images/Supply_Requests_Detail.png "The Supply Requests modal allows requesting multiple items at once.")

### Surfaces

- **Supplies page (`/supplies`)** — tabbed list of Active vs. Completed/Cancelled requests. Each row leads with the requester avatar (rendered in a consistent peach tone using the `Avatar` `tone="peach"` variant) and the animal avatar; the line-item summary, requested date, and status pill sit to the right. When no specific animal is set, a "General supplies" placeholder fills the animal slot so the row stays visually balanced.
- **Request detail modal** — opened by clicking any row. Shows requester + animal, a **current-status pill** with a colored dot, a **History** list derived from `created_at`, `approved_by_person_id`, `fulfilled_date`, `fulfilled_by_person_id`, and `updated_at`, the line items as a table, and quick-advance / cancel buttons. The presentation is deliberately soft — no horizontal lifecycle stepper, no progress bar. Status feels like a current moment + a short paper trail, not a corporate workflow.
- **New request modal** — "Requesting as" (read-only current user) + priority + per-item cards. Each item card has a product dropdown (with an "Other" custom-item option), quantity + unit (unit is a dropdown of common units; auto-fills from the product's `default_unit` when a catalog product is selected), and optional notes. A dashed "+ Add another item" CTA appends a card. A clickable bookmark icon at the bottom toggles "Save as common request" for a future templates feature (carries a `TODO(persistence)`). The "For Animal" picker was intentionally removed — supplies rarely map 1:1 to a single animal — and the staff-only "Create request on behalf of…" lookup is stubbed in code comments.
- **Dashboard widget** — three soft counts on the dashboard: Urgent requests, Pending review (submitted + reviewing), Awaiting delivery (approved + ordered + ready_for_pickup). Each row links to `/supplies`.
- **Product Catalog (`/supplies/catalog`)** — reached via the "Manage Catalog" button on the Supplies page. Lists the org's `Product` catalog with add/edit (name, category, default unit) and an active/inactive toggle. Inactive products stay on past requests but drop out of the new-request item picker. The catalog is org-scoped and starts empty for a new org — until products are added, the new-request form only offers the "Other (custom item)" path.

### UX north star

Wherever supply requests render, **the requester and animal are the subject of the sentence**, not metadata. Labels like "Requested by" and "For animal" are dropped in lists once the avatars convey the meaning. The vertical divider between requester and animal blocks uses `border-border/60` to feel like a soft separator rather than a column break.

---

## 11. Coordination workflows: Transports, Sitting, Clinics

These three features are most common at TNR-focused orgs (e.g. Alley Cat Project) but the patterns generalize to any rescue that coordinates volunteer help over Slack and Sheets today. All three share a common shape: an authenticated requester, a definable date/time, and a "claim" or "accept" affordance for whoever picks up the work.

### Transport Requests (`/transports`)

Volunteers ferry animals or supplies. The list view leads with **subject → destination**, the date in human terms ("Tomorrow @ 9:00 AM", "Mon · 9:00 AM", or a calendar date past a week out), and the requester. Open requests show a **Claim Request** button that assigns the current user as the volunteer and flips status to `claimed`.

**Type:** `animal | supplies | medical | emergency` — drives whether the form shows the optional animal picker.
**Status:** `open | claimed | in_progress | completed | cancelled`.
**Urgency:** `normal | urgent | critical` — same orthogonal pattern as animals (§3). Urgency only renders as a pill when non-normal.

**Optional links:** `animal_id`, `clinic_event_id`, and `supply_request_id` are all nullable so a transport can target whichever thing is being moved. Clinic-tied transports are how a Saturday clinic gets cats from foster homes to the vet.

**UX intent:** this should not feel like dispatch software. The card is "Pepper → Greenwood Vet Clinic, Tomorrow @ 9:00 AM, Requested by Jessica Wong, needs carrier transport," not a row in a queue.

### Sitting Requests (`/sitting`)

Short-term foster coverage. A foster who's traveling or otherwise unavailable requests a sitter; another org member accepts. The request is keyed off a `foster_placement_id` — it can't exist without an active placement.

**Fields surfaced as sitter requirements** (chips on the card): `medication_required`, `supplies_included`, `transport_needed`. Sitters know up front what they're signing up for.

**Status:** `open | claimed | in_progress | completed | cancelled`. Open requests show **Accept Sitting Request**, which sets `sitter_person_id` and moves to `claimed`.

**Tabs:** the page splits into **Unclaimed** (everyone can pick from these) and **My Requests** (requests I submitted or am sitting). The Dashboard also carries a Sitting Requests widget showing unclaimed coverage at a glance.

**UX intent:** framed gently — "Need temporary coverage?" — not as a job board.

### Clinic Planning (`/clinics`)

The most operationally complex of the three. TNR orgs run periodic clinics (typically weekly) where a vet handles a batch of spay/neuter + vaccines. A lot of manual coordination goes into filling slots, lining up transport, and prepping intake paperwork.

**`ClinicEvent`** captures the date/time, location, and the people involved:
- `veterinarian_person_id` — the vet performing procedures (Person with `role: 'vet'`).
- `contact_person_id` — org-side point of contact (vet tech, clinic admin); may be the same as the vet, or different.
- `transport_coordinator_person_id` / `intake_coordinator_person_id` — internal roles for the day.
- `slot_capacity` — hard cap that drives the capacity bar on cards.
- `status` — `planning | scheduled | in_progress | completed | cancelled`.

**`ClinicSlot`** is one animal's appointment at a clinic, with its own `status` (`reserved | confirmed | completed | no_show | cancelled`) and optional notes. Slots are added inline in the **Clinic Detail modal** — pick an animal from a search picker that excludes anyone already on this clinic's roster, then select one or more procedures.

**`ClinicSlotProcedure`** is a child of `ClinicSlot`: an animal almost always gets several procedures in one visit (e.g. spay/neuter **+** vaccines **+** flea treatment), so procedures are rows, not a single field. Each has a `procedure_type` (`spay_neuter | vaccines | dental | exam | recheck | flea_treatment | deworming | microchip | other`) and a `completed` flag for per-procedure progress. In the Clinic Detail modal, procedures render as chips on each slot: click a chip to toggle done, `×` to remove it, `+ Add` to attach another. (Replaced the old single `clinic_slots.procedure_type` column.)

**Cross-feature ties:**
- A `TransportRequest` can carry a `clinic_event_id` so transport-to-clinic gets coordinated alongside everything else.
- Filled slots that resolve to `completed` are the natural source for future `MedicalRecord` rows (not auto-generated yet, but the data shape supports it).

**Dashboard widget:** the Clinics card sits in the main column between **Needs Action** and **Upcoming Medical**, showing the next 1–2 upcoming clinics with their fill bar.

---

## Notifications

In-app notifications tell members when something needs their attention — a volunteer claimed their transport, their supply request changed status, a medical record landed on an animal they foster, etc. A standard bell-and-badge model: a bell in the desktop **top bar** (and beside the mobile hamburger), a dropdown of recent items, and a dedicated **`/notifications`** page. The bell is the only entry point — there's no Notifications sidebar item. The desktop top bar also hosts the signed-in user's name/profile link (so "My profile" was dropped from the sidebar; it remains in the mobile menu).

**Split data model (migration `0066`).** One canonical `notifications` row (the event + denormalized `title`/`body` + `metadata`) fans out to one `user_notification` row per recipient, so "read" is per-user without duplicating text:
- `notifications`: `organization_id`, `type`, `title`, `body`, `entity_type`, `entity_id`, `actor_user_id`, `metadata jsonb`, `created_at`.
- `user_notification`: `notification_id`, `recipient_user_id`, `read_at`, `created_at` (unique per recipient).

**`entity_type`/`entity_id` is the navigation *target*, not the source row.** Foster/medical/adoption events target the *animal* (`entity_type='animal'`), so the client link is uniformly `/animals/:id`; the source record id rides in `metadata`. `src/lib/notificationLink.ts` maps the target onto routes (`transport_request → /requests?tab=transport`, `sitting_request → /requests?tab=sitting`, `supply_request → /requests`).

**Creation is server-side via `SECURITY DEFINER` triggers** — the app never inserts notifications, so there are no INSERT policies and creation can't be bypassed. Recipients are resolved from `people.user_id` (people without an account get nothing), and the actor (`auth.uid()`) is never notified of their own action. Events wired in `0066`:
- **Transport** assigned/claimed → requester ("being handled") **and** assignee ("you were assigned"); self-claim doesn't self-notify.
- **Sitting** accepted → requester.
- **Supply request** status changed → requester.
- **Animal status** changed (lifecycle, e.g. adoptable → adopted; migration `0067`) → the animal's current active foster.
- **Adoption** status changed (the `adoptions` workflow) → the animal's current active foster.
- **Medical record** added → the animal's current active foster.
- **Foster placement** assigned (new active placement = "animal assigned to you") / ended → the foster.
- **Animal added to a clinic** (a `clinic_slots` insert; migration `0069`) → the animal's active foster ("Clinic Appointment Scheduled — … on June 20 at 9:00 AM", rendered in the org timezone).

**RLS:** a user sees only their own `user_notification` rows (`recipient_user_id = auth.uid()`); a `notifications` row is readable only when the caller has a `user_notification` for it. Marking read is the only client write (`read_at`).

**Freshness (MVP)** is fetch-on-load + refetch on navigation (`AppShell`) + a ~90s background poll, all behind `useWhisker()`'s `notifications` / `unreadNotificationCount` / `refreshNotifications` / `markNotificationRead` / `markAllNotificationsRead` — so swapping in Supabase Realtime later is a drop-in. Per the agreed read behavior: opening the bell dropdown does **not** mark anything read; the `/notifications` page marks rows read as they scroll into view; clicking a row marks it read and navigates; "Mark all as read" clears the loaded (current-org) unreads.

### Scheduled reminders (migration `0068`)

The events above are *reactive* (a row changed). Reminders are *proactive* — "something is about to happen, act now." An hourly `pg_cron` job, **`run_notification_reminders()`** (`'notification-reminders'`, `0 * * * *`; migration `0070`), scans for upcoming events and emits via `create_scheduled_notification()` (the 0066 fan-out plus a `dedupe_key`). Running hourly keeps same-day-created events timely; the `dedupe_key` makes over-running harmless (each reminder is created once).

- **Calendar-day buckets (UTC):** the job finds events on `current_date + N`, so copy ("tomorrow", "in 2 days", "in 3 days") is exact.
- **Idempotent:** `notifications.dedupe_key` is unique; inserts are `on conflict do nothing`, so each reminder fires once no matter how often cron runs.
- **Local clock times (migration `0069`):** `organizations.timezone` (IANA, default `America/Los_Angeles` per migration `0070`, set on Settings → General) lets the DB render `date_time` in the org's zone, so clinic copy includes the local time ("…tomorrow at 9:00 AM — ACP Clinic"). The helpers `notif_local_datetime` / `notif_local_time` do the formatting. Sitting/placement are date-only columns; transport copy stays date-only.

Reminders sent (lead times hardcoded):
- **Clinic** (48h + 24h before): per-animal **foster** ("Marabel has a clinic appointment tomorrow at …") and one **event-level** reminder to creator + transport/intake coordinators ("Your clinic at … is tomorrow — N animals scheduled"). Target `clinic_event` → `/clinics/:id`.
- **Transport** (24h): assigned **volunteer** and **requester** when accepted; an **unaccepted** "still needs volunteer" nudge to the requester when open. Includes the animal name when present.
- **Sitting** (24h): **sitter** and **requester** when accepted; **unaccepted** nudge when open. Names the requester (a sitting can cover multiple animals).
- **Foster placement ending** (72h): the foster, keyed off `expected_end_date`.

**Follow-ups (deliberately deferred):** adoption-hold expiry (needs `animals.hold_until` + a hold-expiry concept); a per-org `notification_rule` config table; the "no future placement arranged" framing once scheduled future placements are modeled.

---

## 12. Org-level configuration

`lib/config.ts` is the seed of a future settings layer. Today it exports:

- **`ENABLED_SPECIES: Species[]`** — controls which species the app surfaces in filters and (eventually) creation forms. A dog-only rescue should set this to `['Dog']`; the species filter then disappears from the Animals page entirely.

When auth/settings persistence land, these constants should move to a per-organization settings record.

---

## 13. Design tokens

Defined in `tailwind.config.js`:

- **Background**: `#F1EEE8` (warm cream — slightly darker than card to give cards lift).
- **Card**: `#FFFFFF`.
- **Border**: `#DDD9D1`.
- **Primary**: `#2E6F68` (deep teal-green — the brand color).
- **Secondary**: `#D98C5F` (warm terracotta — used for the Supplies icon and accents).
- **Text**: `#2B2B2B` primary / `#6B6B6B` secondary.
- **Shadows**: `soft` (1px + 4px layered) and `soft-lg` (24px) — used on cards and popovers respectively.
- **Status palette**: each status has a `bg` and `text` pair tuned for soft readability. See `colors.status`.
- **Typography**: `Lato` for body, `Nunito Sans` for headings.

The visual goal is **calm + operational** — like a well-run vet clinic, not a SaaS dashboard.

### Custom icons

A handful of glyphs are hand-rolled to give the app a distinct, warmer feel than the default lucide set:

- **`MedicalKitIcon`** (`components/ui/MedicalKitIcon.tsx`) — a briefcase + plus glyph used for the Medical History tab and empty state.
- **`BoneIcon`** (`components/ui/BoneIcon.tsx`) — used in the Relationships card header, the Dashboard "All caught up!" empty state, and as the Avatar fallback for dogs without a photo.
- **`PawPrintIcon`** (`components/ui/PawPrintIcon.tsx`) — used as the Avatar fallback for cats / other species without a photo, the Animals list empty state, and the unchecked items in the Adoption Readiness checklist.

The Avatar primitive also supports a fixed `tone` prop (currently `'peach'`) for surfaces that want consistent initial-avatar styling — used on the Supplies list to give every requester the same warm peach + terracotta palette regardless of name.

![Contacts tab](docs/images/Contacts_Tab.png "The Contacts tab allows people management and organization.")

---

## 14. File structure

```
supabase/migrations/                 Ordered SQL: schema, RLS, storage policies
/
├── App.tsx                          Providers (Auth + Whisker) + auth Gate + routes
├── index.tsx, index.css             Entry
├── tailwind.config.js               Theme tokens
├── .env.local                       VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (gitignored)
├── types/index.ts                   All TypeScript types
├── data/seed.ts                     Unused at runtime; kept for a planned demo mode
├── lib/
│   ├── supabase.ts                  Supabase client
│   ├── utils.ts                     cn, calculateAge, formatDate, getDaysUntil, getGreeting
│   ├── config.ts                    ENABLED_SPECIES (org-level config)
│   ├── colors.ts                    Avatar color hashing
│   └── *Api.ts                      DB row ↔ type mappers + insert/update builders
├── context/
│   ├── AuthContext.tsx              Session, orgs, currentOrg, currentPersonId, auth
│   └── WhiskerContext.tsx           Supabase-backed collections + CRUD actions
├── components/
│   ├── ui/                          Primitives: Button, Card, Modal, Forms, Badge,
│   │                                Avatar, FilterDropdown, SpeciesBadge, search pickers,
│   │                                MedicalKitIcon, BoneIcon, PawPrintIcon
│   ├── layout/                      AppShell, Sidebar
│   ├── animals/                     Animal modals, ActionNeededCallout, RelationshipsCard,
│   │                                AdoptionProfileCard, PhotoGallery, AddPhotoModal,
│   │                                AddRelationshipModal
│   ├── contacts/                    AddContactModal
│   ├── fosters/                     Foster-specific modals
│   ├── supplies/                    NewSupplyRequestModal, SupplyRequestDetailModal,
│   │                                AddProductModal
│   ├── transports/                  NewTransportRequestModal
│   ├── sitting/                     NewSittingRequestModal
│   ├── clinics/                     NewClinicEventModal, ClinicDetailModal
│   ├── icons/                       CatIcon (and future custom SVG icons)
│   └── search/GlobalSearch.tsx      Global search component
└── pages/                           Dashboard, AnimalsList, AnimalProfile, FostersList,
                                     FosterProfile, Contacts, SupplyRequests, ProductCatalog,
                                     Transports, Sitting, Clinics, Login, Onboarding
```

---

## 15. Conventions

- **Components**: one per file, named exports only, PascalCase.
- **Types**: shared types live in `types/index.ts`. Local component prop types stay inline.
- **State**: all entity state lives in `WhiskerContext` (Supabase-backed, org-scoped) and is mutated via context actions (`addAnimal`, `updateAnimal`, `placeAnimal`, `reassignFoster`, `addNote`, `addRelationship`, `addPhoto`, `addProduct`, `addSupplyRequest`, `addSupplyRequestItem`, `addTransportRequest` / `claimTransportRequest`, `addSittingRequest` / `acceptSittingRequest`, `addClinicEvent` / `addClinicSlot` / `updateClinicSlot`, etc.). Components never read/write Supabase directly. Each action is optimistic: it updates local state, persists, and reconciles (refetch) on error. DB↔type mapping lives in `lib/*Api.ts`.
- **Status / Priority / animal edits** flow through the `ChangeStatusModal` — an "Edit" modal that also covers Name, Species, Sex, DOB, Internal Notes, and Delete. Status/priority changes are logged as a `general` note when the reason field is filled. Supply / transport / sitting status advances go through quick-action buttons on their respective surfaces.
- **Date inputs** use the shared `Input` component, which normalizes the native date picker. Never apply per-instance date styling (and never add `appearance-none` to a date input — it collapses the WebKit picker layout).
- **Avatars in lists** prefer photos when available, fall back to initials when a `name` is passed, and only fall back to icons when neither is available. Pass `species` for animal avatars so the dog/cat/other fallback glyph is correct.
- **Relational pickers** (Animals, Fosters, Contacts/People) use search-driven typeahead — not dropdowns. Even small datasets grow, and forcing search keeps the interaction consistent at scale.
- **Current-user attribution**. Forms that need a "requested by" / "claimed by" identity use `currentPersonId` from `AuthContext` — the signed-in user's self `people` row (created on first login from auth metadata, hidden from the Contacts directory). Don't reintroduce hardcoded person ids.

---

## Naming

The app is **Whiskerville**. Earlier working names were **Whisker** and then **Pawprint**; the original "Whisker" is still referenced in the internal context (`WhiskerProvider`, `useWhisker`) — that's intentionally untouched since it doesn't surface in the UI.