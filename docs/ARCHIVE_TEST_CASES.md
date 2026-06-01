# Archive / Recycle Bin — Test Plan

A QA checklist for the soft-delete (archive) and Recycle Bin features. Work through the sections in order; each section covers one entity type or one cross-cutting rule.

When the doc says "the trash icon", it means the small `Trash2` icon that appears on the relevant card, row, or thumbnail. When it says "the Recycle Bin", it means the page reached from the **Recycle Bin** entry at the bottom of the left sidebar.

All test IDs are stable — please report any failures by ID so they're easy to track.

---

## Prerequisites

Set up before running the tests:

1. Two test accounts in the same organization:
   - **Admin** (role = `owner` or `admin`)
   - **Member** (role = `member`)
   Have both logged in in separate browsers or browser profiles. The Member tests rely on being signed in as the non-admin.
2. At least one animal in the org with all of the following on its profile:
   - Two or more notes (one written by Admin, one written by Member)
   - Two or more photos (one uploaded by Admin, one uploaded by Member)
   - At least one open action item (created by Member)
   - At least one medical record (created by Admin)
3. The Product Catalog (under Supplies) has at least one product.
4. The org has at least one **Supply Request** in each of these states:
   - Submitted (still in-flight)
   - Fulfilled (archive NOT allowed — see SUP cases)
   - Cancelled (with at least one item attached, for the cascade test)
   - Denied
5. The org has at least one **Sitting Request** in each of these states:
   - Open
   - Completed
   - Canceled
   The completed one should have at least one placement attached.
6. The org has at least one **Transport Request** in each of these states:
   - Open
   - Completed
   - Canceled

Browser tips:
- Keep the browser console open. Errors raised by the server show up as red toasts in the UI, but the console has the full message.
- After archiving or restoring, the affected list / card should update immediately. If it doesn't, refresh the page and report it.

Wording reference — all archive confirmations use the same dialog. The title is **Archive [type]?** (e.g. "Archive note?", "Archive supply request?"). The body says **Archive [name]?** in bold, followed by *"This [type] will be hidden from lists but can be restored from the Recycle Bin later."* The confirm button is **Archive [type]** in red.

---

## Notes

The trash icon appears at the right edge of a note row in the animal profile timeline.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| NOTE-01 | Author archives their own note | Member | A note authored by the signed-in Member exists on an animal | 1. Open the animal profile. 2. Find the note in the timeline. 3. Click the trash icon at the right end of the note row. 4. In the dialog, click **Archive note**. | Dialog closes. Note disappears from the timeline immediately. |
| NOTE-02 | Admin archives any note | Admin | A note authored by someone else (e.g. the Member) | 1. Open the animal profile as Admin. 2. Find the Member's note. 3. Click the trash icon. 4. Confirm. | Note disappears from the timeline. |
| NOTE-03 | Member cannot archive someone else's note | Member | A note authored by the Admin exists on an animal | 1. Sign in as Member. 2. Open the animal profile. 3. Find the note written by Admin. | The trash icon does NOT render on that note row. |
| NOTE-04 | Cancel the archive dialog | Either | Any note visible | 1. Click the trash icon on a note. 2. In the dialog, click **Cancel** (or press Escape). | Dialog closes. The note is still in the timeline. |
| NOTE-05 | Archived note shows up in Recycle Bin | Either | A note was just archived in NOTE-01 or NOTE-02 | 1. Open **Recycle Bin** from the sidebar. | A row appears with type **Note**, the first ~80 characters of the note body as the name, the archiver's name in **Archived by**, and today's date in **Archived at**. |
| NOTE-06 | Restore note from Recycle Bin | Either (admin or archiver) | A note in the Recycle Bin archived by the signed-in user | 1. In the Recycle Bin, find the row. 2. Click the circular restore arrow at the right end. | Row disappears from the bin. Open the animal profile — the note is back in the timeline. |
| NOTE-07 | Member cannot restore an Admin's archive | Member | A note archived by Admin is in the bin | 1. Sign in as Member. 2. Open Recycle Bin. 3. Locate the note archived by Admin. | The restore icon does NOT render in the Actions column for that row. |

---

## Photos

The trash icon sits on each photo thumbnail in the photo gallery (visible on hover on the top-right of the thumbnail) and also as a delete control in the lightbox (when a photo is opened large).

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| PHOTO-01 | Uploader archives their own photo | Member | A photo uploaded by the Member exists in the gallery | 1. Open the animal profile. 2. Scroll to the photo gallery. 3. Hover the Member's photo. 4. Click the trash icon overlaid on the thumbnail. 5. Confirm in the dialog. | Photo disappears from the gallery. |
| PHOTO-02 | Admin archives any photo | Admin | A photo uploaded by someone else | 1. Sign in as Admin. 2. Open the gallery. 3. Hover the photo. 4. Click trash. 5. Confirm. | Photo disappears. |
| PHOTO-03 | Member cannot archive someone else's photo | Member | A photo uploaded by Admin exists | 1. Sign in as Member. 2. Open the gallery. 3. Hover the Admin's photo. | No trash icon appears on that thumbnail. |
| PHOTO-04 | Archive via lightbox | Either | The signed-in user can archive at least one photo | 1. Click a photo to open the lightbox. 2. Click the delete (trash) control. 3. Confirm. | Lightbox closes (or steps to the next photo if more remain). Photo is gone from the gallery. |
| PHOTO-05 | Archived photo appears in Recycle Bin | Either | A photo was just archived | 1. Open Recycle Bin. | A row with type **Photo** appears. Name is the photo's caption, or "Photo" if no caption. |
| PHOTO-06 | Restore photo | Either (admin or archiver) | A photo is in the bin | 1. In the Recycle Bin, click the restore icon on the photo row. | Row disappears from the bin. The photo is back in the animal's gallery. |
| PHOTO-07 | Profile photo behaviour | Admin | The photo set as the animal's profile image is archived | 1. Set a photo as profile. 2. Archive that photo. 3. View the animal card / hero. | The hero falls back to initials / species icon. Note for the team: archiving a photo does not currently clear `primary_photo_url`; if the hero still displays the archived image's URL, log it. |

---

## Action items

The trash icon appears in the right-hand controls of the **Action Needed** callout banner at the top of an animal profile (only when there is an open action item).

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| ACTION-01 | Creator archives own open action item | Member | An open action item created by the Member | 1. Open the animal profile. 2. Locate the Action Needed banner. 3. Click the trash icon in the controls row of the banner. 4. Confirm. | Action item is archived. Banner collapses (or shows the empty / no-action state if the animal is still elevated priority). |
| ACTION-02 | Admin archives any open action item | Admin | An open action item created by Member | 1. Sign in as Admin. 2. Open the animal profile. 3. Click trash in the Action Needed banner. 4. Confirm. | Action item is archived. |
| ACTION-03 | Member cannot archive someone else's | Member | An open action item created by Admin | 1. Sign in as Member. 2. Open the animal profile. | Trash icon does NOT appear in the Action Needed banner. (Edit / Complete icons may still be visible.) |
| ACTION-04 | Archived action item appears in Recycle Bin | Either | An action item was just archived | 1. Open Recycle Bin. | Row with type **Action item** and the first ~80 characters of the description. |
| ACTION-05 | Restore action item | Either (admin or archiver) | An action item is in the bin | 1. In the bin, click restore on the action item row. | Row disappears. Re-open the animal profile — the Action Needed banner shows the item again. |
| ACTION-06 | Completed / cancelled items are not archived by completing | Either | An open action item exists | 1. Click **Complete** (checkmark) instead of trash. | Item is marked completed; it does NOT show up in the Recycle Bin (complete is not the same as archive). |

---

## Medical records

Medical records are admin-only — the trash icon only renders for admins. The icon sits at the right end of each medical record row inside the **Medical History** card on the animal profile.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| MED-01 | Admin archives a medical record | Admin | A medical record on an animal | 1. Open the animal profile as Admin. 2. Scroll to the Medical History card. 3. Click the trash icon on a record row. 4. Confirm. | Record disappears from the list. |
| MED-02 | Member cannot archive medical records | Member | A medical record on the animal | 1. Sign in as Member. 2. Open the animal profile. 3. Scroll to Medical History. | No trash icon appears on ANY medical record row. (Edit and other icons may still be present.) |
| MED-03 | Archived medical record in Recycle Bin | Admin | A medical record was archived | 1. Open Recycle Bin. | Row with type **Medical record** and the procedure name. |
| MED-04 | Restore medical record | Admin | A medical record is in the bin | 1. In the bin, click restore on the row. | Record returns to the Medical History card on the animal profile. |

---

## Products

The Product Catalog page is at **Supplies → Product Catalog**. The trash icon sits on the right side of each product row, next to the edit (pencil) icon. Admins only.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| PROD-01 | Admin archives a product | Admin | A product exists in the catalog | 1. Sign in as Admin. 2. Open the Product Catalog. 3. Click the trash icon on a product row. 4. Confirm. | Product disappears from the catalog list. |
| PROD-02 | Member cannot archive products | Member | Catalog has products | 1. Sign in as Member. 2. Open the Product Catalog. | No trash icons render on any product row. |
| PROD-03 | Archived product in Recycle Bin | Admin | A product was archived | 1. Open Recycle Bin. | Row with type **Product** and the product name. |
| PROD-04 | Restore product | Admin | A product is in the bin | 1. In the bin, click restore. | Product returns to the catalog. |
| PROD-05 | New supply requests still allow archived product? | Admin | A product was archived | 1. Open **New Supply Request**. 2. Look for the archived product in the product picker. | The archived product should NOT appear in the picker (it's filtered from active lists). Log if it still shows up. |

---

## Supply requests

The trash icon sits in the **Supply Request Detail Modal** — open a request by clicking it on the Supply Requests page, then look in the top-right of the modal beside the status pill. Admins only, and only when the request is **cancelled or denied**. Fulfilled requests are treated as audit history — the icon does NOT appear on them.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| SUP-01 | Archive a cancelled supply request (with items) | Admin | A cancelled supply request that has at least one item | 1. Open the Supply Requests page. 2. Click the cancelled request. 3. Click the trash icon next to the status pill. 4. Confirm. | Modal closes. Request disappears from the list. |
| SUP-02 | Archive a denied supply request | Admin | A denied supply request | 1. Open the denied request. 2. Trash → Confirm. | Request gone from the list. |
| SUP-03 | Fulfilled requests are NOT archivable | Admin | A fulfilled supply request | 1. Open the fulfilled request. 2. Look in the modal header. | No trash icon. Fulfilled requests are audit history and cannot be archived from the UI. |
| SUP-04 | Submitted request cannot be archived | Admin | A submitted (in-flight) request | 1. Open the submitted request. 2. Look at the top-right header area. | The trash icon does NOT render. The status pill is visible but no archive control. |
| SUP-05 | In-progress request cannot be archived | Admin | An in-progress request | 1. Open the in-progress request. 2. Look at the top-right header area. | No trash icon. |
| SUP-06 | Member cannot archive supply requests | Member | Any cancelled supply request | 1. Sign in as Member. 2. Open the cancelled request. | No trash icon in the modal header. |
| SUP-07 | Cascade: items archived with parent | Admin | The cancelled request from SUP-01 (with items) | 1. Before SUP-01, note the items listed in the request. 2. Run SUP-01 to archive. 3. Open Recycle Bin. | One row appears with type **Supply request**. The individual item rows do NOT appear as separate rows in the bin (children are hidden when the parent is archived). |
| SUP-08 | Restore supply request — items return | Admin | The supply request from SUP-07 is in the bin | 1. In the bin, click restore on the supply request row. 2. Open the Supply Requests page and find the restored request. | Request reappears in the list. Open it — all the items that were attached before archiving are back on the request. |
| SUP-09 | Server rejects manual archive of in-flight or fulfilled request | Admin | A submitted, in-progress, or fulfilled supply request (only verifiable via SQL editor) | This is a server-side guard; not reachable from the UI. If you do try via the Supabase SQL editor: `select archive_record('supply_requests', '<id>');` against one of those statuses. | Server raises an error: *"supply request must be cancelled or denied before archiving (currently …)"*. |

---

## Sitting requests

The trash icon sits on the right side of each sitting request **card** on the Sitting page. Admins only, and only when the request is completed or canceled.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| SIT-01 | Archive a completed sitting request | Admin | A completed sitting request with at least one placement | 1. Open the Sitting page. 2. Find the completed request card. 3. Click the trash icon in the card's action area. 4. Confirm. | Card disappears from the list. |
| SIT-02 | Archive a canceled sitting request | Admin | A canceled sitting request | 1. Find the canceled request. 2. Trash → Confirm. | Card disappears. |
| SIT-03 | Open sitting request cannot be archived | Admin | An open sitting request | 1. Look at the open request card. | No trash icon visible. (The Claim / Cancel buttons may still be present.) |
| SIT-04 | Member cannot archive sitting requests | Member | A completed sitting request | 1. Sign in as Member. 2. Open the Sitting page (Mine tab if needed). | No trash icon on the card. |
| SIT-05 | Cascade: placements archived with parent | Admin | The completed request from SIT-01 (with placements) | 1. Run SIT-01. 2. Open Recycle Bin. | One row with type **Sitting request**. The sitting placement rows do NOT appear as their own rows (cascade child hiding). |
| SIT-06 | Restore sitting request — placements return | Admin | The sitting request from SIT-05 is in the bin | 1. Restore from the bin. 2. Open the Sitting page (Mine tab if needed). 3. Open the restored request. | Request is back. All previously-attached placements are listed again. |
| SIT-07 | Server rejects in-flight sitting archive | Admin | An open sitting request | Not reachable from UI; via SQL editor only: `select archive_record('sitting_requests', '<id>');` against an open one. | Server raises: *"sitting request must be completed or cancelled before archiving (currently open)"*. |

---

## Transport requests

The trash icon sits on each transport request **card** on the Transports page (use the **Completed** tab to find archivable rows). Admins only, and only when the request is completed or canceled.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| TRP-01 | Archive a completed transport | Admin | A completed transport request | 1. Open Transports. 2. Switch to the **Completed** tab. 3. Find the completed row. 4. Click the trash icon. 5. Confirm. | Card disappears from the list. |
| TRP-02 | Archive a canceled transport | Admin | A canceled transport (also lives in the Completed tab) | 1. In the Completed tab, find the canceled row. 2. Trash → Confirm. | Card disappears. |
| TRP-03 | Open transport cannot be archived | Admin | An open transport | 1. Switch to the **Open** tab. 2. Look at any open card. | No trash icon visible. |
| TRP-04 | Claimed transport cannot be archived | Admin | A claimed / in-progress transport | 1. Switch to **Claimed / In Progress**. 2. Look at the card. | No trash icon visible. |
| TRP-05 | Member cannot archive transports | Member | A completed transport | 1. Sign in as Member. 2. Open Transports → Completed. | No trash icons on any card. |
| TRP-06 | Archived transport appears in bin | Admin | A transport was archived | 1. Open Recycle Bin. | Row with type **Transport**, name shaped like *"<pickup> → <dropoff>"*. |
| TRP-07 | Restore transport | Admin | A transport is in the bin | 1. Restore from the bin. | Transport reappears in the Completed tab on the Transports page. |
| TRP-08 | Server rejects in-flight transport archive | Admin | An open or claimed transport | Not reachable from UI; via SQL editor only: `select archive_record('transport_requests', '<id>');` against an in-flight one. | Server raises: *"transport request must be completed or cancelled before archiving (currently <status>)"*. |

---

## Recycle Bin behaviour

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| BIN-01 | Sidebar entry visible to all members | Either | Signed in to an org | 1. Look at the left sidebar. | **Recycle Bin** entry is the last item in the sidebar nav, with a trash icon. |
| BIN-02 | Empty state | Either | An org with nothing currently archived (or test in a fresh org) | 1. Open Recycle Bin. | The page shows a centered trash icon, the heading **"Nothing here"**, and the text *"Archived records will appear in this bin."* No filter chips show. |
| BIN-03 | Newest-first ordering | Either | At least three archived records of any type, archived at different times | 1. Open Recycle Bin. 2. Read the **Archived at** column top-to-bottom. | Dates / times go from most recent at the top to oldest at the bottom. |
| BIN-04 | All / type filter chips | Either | Bin has at least two distinct types archived (e.g. a note and a photo) | 1. Open Recycle Bin. 2. Inspect the chips row above the table. | An **All** chip is selected by default with the total count. One chip per archived type, each showing its count. Counts are sorted highest first after **All**. |
| BIN-05 | Filtering by type | Either | Bin has at least two distinct types | 1. Click a non-All chip (e.g. **Note**). | Table now only shows rows of that type. The chip is highlighted (filled). Click **All** to clear. |
| BIN-06 | Refresh button | Either | Anything in the bin | 1. Click **Refresh** in the top-right of the page. | Icon spins briefly. List re-fetches. |
| BIN-07 | Archived-by column shows person name | Either | An archive performed by a user whose `people` row has a first / last name | 1. Open the bin. | The **Archived by** column shows "First Last" of the archiver. If the archiver has no matching `people` row, an em-dash (—) is shown instead. |
| BIN-08 | Restore icon hidden when not permitted | Member | An item in the bin archived by someone else (e.g. Admin), and signed-in user is Member | 1. Sign in as Member. 2. Open the bin. 3. Locate the row archived by Admin. | The Actions column for that row is empty (no restore icon). |
| BIN-09 | Cross-page: archived note hidden from animal timeline | Either | A note was archived | 1. Open the animal whose note was archived. 2. Scroll the activity timeline. | The archived note does NOT appear anywhere in the timeline. |
| BIN-10 | Cross-page: restore brings it back | Either | The same note is in the bin and signed-in user can restore | 1. Open Recycle Bin. 2. Restore the note. 3. Open the animal profile. | The note appears in the timeline again, in its original chronological position. |
| BIN-11 | Detail-page link behaviour (informational) | Either | A row in the bin | 1. Try clicking the name cell. | Rows in the bin are NOT clickable links currently. You restore from the bin to view the record on its source page. Log if that changes. |

---

## Permission rules (cross-cutting)

These reaffirm the matrix already exercised above; run them as a quick sanity sweep when fixing a permission bug.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| PERM-01 | Member sees archive on own low-risk records only | Member | Member created at least one note, one photo, one action item | 1. Sign in as Member. 2. Open the animal profile. | Trash icons appear on Member's own notes, photos, and the open action item if Member created it. No trash icons on others' notes / photos / action items, medical records, products, supply / sitting / transport requests. |
| PERM-02 | Admin sees archive everywhere it's allowed | Admin | At least one row of each archivable type exists in a state that permits archiving | 1. Sign in as Admin. 2. Tour each surface (animal profile → notes / photos / action items / medical history, Product Catalog, Supply Requests detail modals, Sitting page, Transports page Completed tab). | Trash icons render in every documented spot. |
| PERM-03 | Original archiver can restore even as Member | Member | Member archived something earlier in this test run | 1. Sign in as Member. 2. Open Recycle Bin. 3. Find the Member's own archive. | Restore icon is present. Clicking it restores the record. |
| PERM-04 | Admin can restore anything | Admin | Anything in the bin | 1. Sign in as Admin. 2. Open Recycle Bin. | Restore icon is present on every row. |
| PERM-05 | Confirmation dialog wording | Either | Any archivable record | 1. Click a trash icon for any record type. 2. Read the dialog title, body text, and the danger button label. | Title: **Archive [type]?** (e.g. *Archive note?*). Body: bold *Archive [name]?* then *"This [type] will be hidden from lists but can be restored from the Recycle Bin later."* Buttons: **Cancel** (ghost) and **Archive [type]** in red with a trash glyph. |
| PERM-06 | Server error surface | Either | Use an admin to attempt a forbidden archive via the Supabase SQL editor (e.g. submitted supply request) | 1. Run `select archive_record('supply_requests', '<id>');` in the Supabase SQL editor against a submitted request. | A red error message appears in the SQL editor with the human-readable text (status blocker or permission). The UI-side dialog also surfaces the error message inline if you trigger it that way. |

---

## 7-day visibility cap

The Recycle Bin only surfaces records archived in the last 7 days. Older archived records remain in the database (no automatic purge) but are not shown in the bin. This is enforced server-side in the `list_archived` function — the UI has no toggle to override it.

This cannot be exercised purely through the UI. To verify it, you have to manually back-date the `deleted_at` value in the Supabase SQL editor.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| CAP-01 | Record archived <7 days ago shows | Either | A record archived today (anything from earlier tests) | 1. Open Recycle Bin. | Record is visible. |
| CAP-02 | Record archived >7 days ago is hidden | Admin with SQL access | A record currently in the bin whose id you can copy | 1. Copy the id of an archived row (e.g. an `animal_notes` row — its `id` is the same as the bin row's `record_id`, viewable via the SQL editor). 2. In the Supabase SQL editor, run:<br/>`update animal_notes set deleted_at = now() - interval '10 days' where id = '<id>';`<br/>3. Reload the Recycle Bin. | The row no longer appears in the bin. The underlying record is still archived (still hidden from the animal timeline). |
| CAP-03 | Restoring after the cap (via SQL) | Admin with SQL access | The row from CAP-02 | 1. In the SQL editor:<br/>`select restore_record('animal_notes', '<id>');`<br/>2. Reload the animal profile. | The note reappears in the timeline (restore still works on rows older than 7 days; only the bin's visibility is capped). |
| CAP-04 | Bring a hidden row back into the bin window | Admin with SQL access | The row from CAP-02 (still archived, back-dated) | 1. In the SQL editor:<br/>`update animal_notes set deleted_at = now() - interval '1 hour' where id = '<id>';`<br/>2. Reload the Recycle Bin. | The row reappears in the bin (deleted_at is back inside the 7-day window). |

Other tables you can back-date with the same technique (substitute the table name):
- `animal_photos`
- `animal_action_items`
- `medical_records`
- `products`
- `supply_requests`
- `sitting_requests`
- `transport_requests`

When back-dating a parent (supply or sitting request), the children inherit the parent's original `deleted_at`. If you want the cascade to "vanish" with the parent, back-date both the parent and its children, e.g.:

```sql
update supply_requests
  set deleted_at = now() - interval '10 days'
  where id = '<id>';
update supply_request_items
  set deleted_at = now() - interval '10 days'
  where supply_request_id = '<id>' and is_deleted = true;
```

---

## Clinics (Phase 5)

Clinics introduce a three-level hierarchy: **Clinic event → Clinic slot → Procedure**. All three are admin-only to archive. Status blockers and cascade rules live in `supabase/migrations/0027_archive_phase5_clinics.sql`.

Status rules:
- A **clinic event** is archivable only when its status is **Planning**, **Completed**, or **Canceled**. The trash icon is hidden (and the server would reject a direct call) for **Scheduled** and **In Progress**.
- A **clinic slot** (and a procedure within a slot) is blocked while the parent clinic is **In Progress**. Otherwise admins may archive.

Cascade:
- Archiving a clinic event also archives every slot it contains AND every procedure on those slots — all sharing the parent's `deleted_at`.
- Archiving a slot also archives every procedure on that slot, sharing the slot's `deleted_at`.
- Restoring a parent brings back the children that share its `deleted_at` (children archived in earlier, separate actions stay archived).

UI surfaces:
- **Clinic header** (route `/clinics/:id`): a small trash icon sits next to the **Edit** button (and to the right of the green **Complete Clinic** button when that one is visible). Confirming archive navigates back to the Clinics list.
- **Each slot row**: the existing trash icon at the right end of the row is now an archive button (was a hard delete previously). Confirming opens the standard archive dialog.
- **Procedures**: the small `×` on each procedure chip is still a hard delete (not an archive). There is no per-procedure archive surfaced yet — don't write tests for archiving a procedure alone.

### Clinic events

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| CLIN-01 | Archive a Planning clinic with slots and procedures | Admin | A clinic event with status **Planning**, at least one slot, and at least two procedures on that slot | 1. Open the clinic at `/clinics/:id`. 2. Click the trash icon next to **Edit** in the header. 3. Confirm in the dialog. | Dialog closes. User is navigated back to the Clinics list. The clinic no longer appears in the active list. |
| CLIN-02 | Bin shows one row per cascade group | Admin | The clinic archived in CLIN-01 (with slots + procedures cascaded out) | 1. Open **Recycle Bin** from the sidebar. | Exactly one row appears for that clinic, with type **Clinic event** and a name like *"<location> — <date>"*. The child slot row and per-procedure rows do NOT appear as their own rows. |
| CLIN-03 | Archive a Completed clinic | Admin | A clinic event with status **Completed** that has at least one slot whose procedures generated medical records during clinic completion | 1. Open the completed clinic. 2. Click the header trash icon. 3. Confirm. | Clinic disappears from the active list. The user is navigated to `/clinics`. The Recycle Bin shows one **Clinic event** row for it. |
| CLIN-04 | Completed clinic preserves medical records | Admin | The clinic archived in CLIN-03; you know an animal whose medical history was populated from that clinic | 1. Open the animal profile referenced in CLIN-03. 2. Scroll to the **Medical History** card. | The medical records created from that clinic are STILL present (not archived). They still link to the (now-archived) clinic — only the clinic / slots / procedures cascade; medical records do not. |
| CLIN-05 | SQL spot-check medical records survive | Admin with SQL access | The clinic archived in CLIN-03, and an animal id from CLIN-04 | 1. In the Supabase SQL editor:<br/>`select id, is_deleted, clinic_id from medical_records where animal_id = '<animal_id>' and clinic_id = '<clinic_id>';` | Rows are returned. Every row shows `is_deleted = false` and `clinic_id` still points to the archived clinic. (No cascade from `clinic_events` → `medical_records`.) |
| CLIN-06 | Archive a Canceled clinic | Admin | A clinic event with status **Canceled** | 1. Open the canceled clinic. 2. Click the header trash icon. 3. Confirm. | Clinic disappears from the active list. User is navigated to `/clinics`. Bin shows a **Clinic event** row. |
| CLIN-07 | Scheduled clinic has no archive icon | Admin | A clinic event with status **Scheduled** | 1. Open the scheduled clinic. 2. Inspect the header (next to **Edit**). | The trash icon does NOT render. (The **Edit** button is visible; **Complete Clinic** appears as well because the clinic is Scheduled.) |
| CLIN-08 | In Progress clinic has no archive icon | Admin | A clinic event with status **In Progress** | 1. Open the in-progress clinic. 2. Inspect the header. | The trash icon does NOT render. |
| CLIN-09 | Server rejects direct archive of Scheduled / In Progress clinic | Admin with SQL access | A clinic in Scheduled or In Progress status | 1. In the Supabase SQL editor: `select archive_record('clinic_events', '<id>');` | Server raises: *"clinic must be in Planning, Completed, or Cancelled before archiving (currently \<status\>)"*. |
| CLIN-10 | Member sees no archive icons anywhere on clinic | Member | A clinic event in any archivable status (Planning / Completed / Canceled) with at least one slot | 1. Sign in as Member. 2. Open the clinic. 3. Inspect the header AND each slot row. | No trash icon appears in the header. No trash icon appears on any slot row. (Edit / status / procedure controls may still be visible per their own role rules.) |
| CLIN-11 | Restore clinic — slots and procedures come back together | Admin | The clinic from CLIN-01 is in the Recycle Bin | 1. Open Recycle Bin. 2. Click the restore icon on the clinic row. 3. Open `/clinics/:id` for that clinic. | Clinic reappears in the active list. On its profile, all of the slots that were on it before archiving are back, and each slot has all its procedures back. |

### Clinic slots

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| CLIN-SLOT-01 | Archive a slot on a Planning clinic | Admin | A clinic in **Planning** with at least one slot that has two or more procedures | 1. Open the clinic. 2. Find the slot row. 3. Click the trash icon at the right end of the slot row. 4. Confirm. | Slot row disappears. The slot count in the **Slots** header decreases by one. |
| CLIN-SLOT-02 | Slot archive cascades its procedures | Admin | The slot archived in CLIN-SLOT-01 had two or more procedures | 1. Open Recycle Bin. | One row with type **Clinic slot** appears for that slot. The individual procedures on it do NOT show as their own rows (cascade-child hiding). |
| CLIN-SLOT-03 | Slot archive icon hidden while clinic is In Progress | Admin | A clinic with status **In Progress** that has at least one slot | 1. Open the in-progress clinic. 2. Inspect the slot row. | The trash icon at the right end of the slot row does NOT render. (The status `<select>` and procedure chips remain.) |
| CLIN-SLOT-04 | Server rejects slot archive while clinic is In Progress | Admin with SQL access | A slot whose parent clinic is **In Progress** | 1. In the Supabase SQL editor: `select archive_record('clinic_slots', '<slot_id>');` | Server raises: *"cannot archive while the clinic is in progress"*. |
| CLIN-SLOT-05 | Member sees no slot archive icon | Member | A clinic in Planning / Completed / Canceled with at least one slot | 1. Sign in as Member. 2. Open the clinic. 3. Inspect every slot row. | The trash icon does NOT render on any slot row, regardless of clinic status. |
| CLIN-SLOT-06 | Restore an independently-archived slot | Admin | A slot was archived alone (not as part of a clinic cascade); the parent clinic is still active | 1. Open Recycle Bin. 2. Click restore on the **Clinic slot** row. 3. Open the parent clinic at `/clinics/:id`. | Slot reappears in the Slots list with all of its procedures back. (Procedures share the slot's `deleted_at`, so they cascade-restore.) |
| CLIN-SLOT-07 | Restoring parent clinic does not restore independently-archived child slot | Admin | A clinic that was archived; before archiving the clinic, one of its slots had already been archived on its own (different `deleted_at`) | 1. Restore the clinic from the Recycle Bin. 2. Open the clinic. | The slots that were cascaded with the clinic are back. The slot that was archived independently earlier (with a different `deleted_at`) stays archived — it remains in the Recycle Bin as its own **Clinic slot** row and must be restored separately. |

---

## Notes for the next test pass

- The **archived banner** (a calm grey *"This record has been archived."* callout with archiver name, date, and a Restore button) is implemented in code but is not currently mounted on any detail page in the UI. Skip banner-specific tests for now — the surfaces that hide archived rows from lists (animal timeline, Medical History card, request lists, Clinics list) are doing the visible work in this round. When a banner is added (e.g. when viewing an archived clinic's profile directly), add a TEST-XX-BANNER block per entity.
- **Procedures have no archive surface yet.** The `×` on a procedure chip is still a hard delete (`deleteClinicSlotProcedure`), not an archive call. The server side does support `archive_record('clinic_slot_procedures', …)` and `list_archived` will hide cascade-children correctly, but until a per-procedure archive control ships there is no UI path to exercise. Don't write CLIN-PROC tests against the UI; if you want to verify the server path, drive it from the SQL editor and check `list_archived` shows nothing extra (because the parent slot will be active).
- **Medical records do not cascade with clinics.** Even though a medical record can link back to a clinic via `medical_records.clinic_id`, archiving the clinic event leaves the medical record row untouched (`is_deleted = false`). This is intentional — the medical history is the animal's own record, not the clinic's. See CLIN-04 / CLIN-05.
- **Archived animals leave their sub-records in the DB by design.** Archiving an animal (Phase 7) does NOT cascade — notes, photos, medical records, action items, placements, and so on stay in place with `is_deleted = false`. They simply become unreachable through the UI because the animal's list rows and profile route are hidden. Restoring the animal brings the profile back with everything intact and untouched, so no separate child-row restore is needed. The same idea applies to people and litters in Phase 7.
- Migration history for reference:
  - `supabase/migrations/0024_archive_support.sql` — adds the `is_deleted` / `deleted_at` / `deleted_by` columns across every supported table, and the `archive_record` / `restore_record` / `list_archived` server functions. Phase 1 wires only `animal_notes`.
  - `supabase/migrations/0025_archive_phase2_photos_actions.sql` — adds `created_by` to `animal_photos` and `animal_action_items`, extends the creator-or-admin rule to these two tables.
  - `supabase/migrations/0026_archive_phase4_requests.sql` — adds status blockers + parent→child cascade for supply / sitting / transport requests, and the 7-day cap + cascade-child hiding in `list_archived`.
  - `supabase/migrations/0027_archive_phase5_clinics.sql` — adds status blockers for clinic events (Planning / Completed / Canceled only) and slots/procedures (blocked while parent clinic is In Progress), the two-level cascade on clinic event archive, the one-level cascade on slot archive, matching-`deleted_at` cascade restore, and cascade-child hiding for `clinic_slots` and `clinic_slot_procedures` in `list_archived`.
  - `supabase/migrations/0028_archive_tighten_supply_blocker.sql` — tightens the supply-request rule so only **Cancelled** and **Denied** are archivable. Fulfilled is now audit history.
  - `supabase/migrations/0029_archive_phase6_adoptions_placements_relationships.sql` — adds status blockers for adoptions (only `cancelled`) and foster_placements (block `active`); relationships are admin-only with no blockers.
  - `supabase/migrations/0030_archive_phase7_animals_people_litters.sql` — adds cross-table blockers for animals (foster placement / relationships / adoption / clinic slot / sitting / transport / supply / status=adopted), people (foster placement / adoption / sitting / transport / supply), and litters (active animals linked). No cascade for these — sub-records remain in place when the parent is archived.

---

## Animal-profile cards (Phase 6)

Phase 6 adds archive controls to three leaf entities on the animal profile. All three are **admin-only**; Members never see the icon. There is no cascade — each row is a standalone leaf. Status / role rules live in `supabase/migrations/0029_archive_phase6_adoptions_placements_relationships.sql`.

### Animal relationships

The X icon appears on hover at the right end of each non-derived relationship row inside the **Relationships** card (right column of the animal profile). Stored relationships (mother, father, parents, children, siblings, bonded-with) get the icon when signed in as Admin. Littermates that come from a shared `litter_id` are derived at render time and have no underlying relationship row — they never get an icon.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| REL-01 | Admin archives a mother / father link | Admin | Two animals are linked via a `mother` (or `father`) relationship row | 1. Open the child animal's profile as Admin. 2. Locate the parent in the **Relationships** card. 3. Hover the row and click the X icon. 4. Confirm in the dialog. | Dialog closes. The parent row disappears from the child's Relationships card. Open the parent animal — the inverse "child" row is also gone (one stored row, rendered bidirectionally). |
| REL-02 | Restore relationship from Recycle Bin | Admin | The relationship archived in REL-01 is in the bin | 1. Open **Recycle Bin** from the sidebar. 2. Locate the **Animal relationship** row. 3. Click the restore icon. 4. Open both animals' profiles. | The relationship reappears on both animals' Relationships cards (the inverse is rendered automatically). |
| REL-03 | Member sees no X on any relationship row | Member | An animal with at least one stored relationship | 1. Sign in as Member. 2. Open the animal profile. 3. Inspect every row in the **Relationships** card. | No X icon renders on any row, regardless of relationship type. |
| REL-04 | Derived littermates have no X | Admin | An animal whose `litter_id` matches at least one other animal so that littermate rows are rendered from the shared litter | 1. Open the animal profile as Admin. 2. Locate the derived **Littermate** rows in the Relationships card. 3. Hover each one. | No X icon appears on any derived littermate row, even for Admin. (Derived rows are not backed by a stored relationship row.) |

### Foster placements

The trash icon sits on hover next to the date range of each non-active placement on the animal profile's **Placements** timeline tab. The currently-active placement (`placement_status = 'active'`) does NOT get an icon — close it via reassignment or end the placement first.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| PLACE-01 | Admin archives a completed placement | Admin | An animal with at least one completed (or interrupted) foster placement in its history | 1. Open the animal profile as Admin. 2. Switch to the **Placements** tab. 3. Hover the completed placement's date range. 4. Click the trash icon. 5. Confirm in the dialog — the foster's name appears in the dialog body. | Dialog closes. The placement row disappears from the Placements tab. |
| PLACE-02 | Active placement has no trash icon | Admin | An animal currently in foster (one `active` placement) | 1. Open the animal profile as Admin. 2. Switch to the **Placements** tab. 3. Hover the active placement's date range. | No trash icon renders. (Close the placement via reassignment or end it before archiving.) |
| PLACE-03 | Server rejects archive of an active placement | Admin with SQL access | An active foster placement | 1. In the Supabase SQL editor: `select archive_record('foster_placements', '<active-id>');` | Server raises: *"cannot archive an active foster placement — close it first (reassign or end the placement)"*. |
| PLACE-04 | Member sees no trash icons on the Placements tab | Member | An animal with any mix of placement history | 1. Sign in as Member. 2. Open the animal profile. 3. Switch to the **Placements** tab. 4. Inspect every row. | No trash icon renders on any placement row, active or not. |
| PLACE-05 | Restore placement from Recycle Bin | Admin | The placement archived in PLACE-01 is in the bin | 1. Open Recycle Bin. 2. Click restore on the **Foster placement** row. 3. Open the animal profile and switch to the **Placements** tab. | The placement reappears in the animal's placement history in its original chronological position. |

### Adoptions

The trash icon sits to the right of the event title / date on cancelled adoption entries in the animal profile's **activity timeline**. Completed and returned adoption events are audit history — they do NOT get an icon. In-flight adoption events (inquiry / submitted / approved / etc.) also do NOT get an icon; cancel the adoption first before archiving.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| ADOPT-01 | Admin archives a cancelled adoption from the timeline | Admin | An animal with a cancelled adoption on its timeline (the timeline may show earlier in-flight events for the same adoption — they live on the same row) | 1. Open the animal profile as Admin. 2. Scroll the activity timeline to the **Adoption cancelled** entry. 3. Click the trash icon to the right of the event title / date. 4. Confirm. | Dialog closes. The cancelled entry disappears from the timeline, along with any earlier in-flight events for that same adoption (they share the underlying row). |
| ADOPT-02 | Completed adoption has no trash icon | Admin | An animal with a completed adoption event on its timeline | 1. Open the animal profile as Admin. 2. Locate the **Adoption completed** event on the timeline. 3. Inspect the controls next to the title / date. | No trash icon renders. Completed adoptions are audit history. |
| ADOPT-03 | In-flight adoption events have no trash icon | Admin | An animal with an in-flight adoption (inquiry / submitted / approved / etc.) showing one or more timeline events for that adoption | 1. Open the animal profile as Admin. 2. Locate each in-flight adoption event on the timeline. 3. Inspect the controls on each one. | No trash icon renders on any of those events. (Cancel the adoption first to make it archivable.) |
| ADOPT-04 | Server rejects archive of a non-cancelled adoption | Admin with SQL access | A completed adoption row | 1. In the Supabase SQL editor: `select archive_record('adoptions', '<completed-id>');` | Server raises: *"adoption must be cancelled before archiving (currently completed)"*. |
| ADOPT-05 | Member sees no trash icons on adoption events | Member | An animal whose timeline includes at least one cancelled adoption | 1. Sign in as Member. 2. Open the animal profile. 3. Scroll the timeline. 4. Inspect each adoption event. | No trash icon renders on any adoption event, including cancelled ones. |
| ADOPT-06 | Restore cancelled adoption from Recycle Bin | Admin | The adoption archived in ADOPT-01 is in the bin | 1. Open Recycle Bin. 2. Click restore on the **Adoption** row. 3. Open the animal profile and scroll the timeline. | The cancelled adoption event reappears on the timeline in its original chronological position. Any earlier in-flight events for that adoption also return (they share the underlying row). |

---

## Animals, people, litters (Phase 7)

Phase 7 wires archive into the three top-level entities — **animals**, **people** (contacts and fosters), and **litters**. All three are **admin-only**, all three live in the relevant profile-page header (a trash icon next to the **Edit** / **Update Group** button), and all three carry rich cross-table blockers because each entity sits at the centre of multiple workflows. There is **no cascade** for these — archiving an animal, a person, or a litter leaves every child / linked row untouched in the DB; they simply become unreachable through the UI while the parent is archived. Rules and exact error text live in `supabase/migrations/0030_archive_phase7_animals_people_litters.sql`.

### Animals

The trash icon sits in the **AnimalProfile** hero header (route `/animals/:id`) directly next to the **Edit** button. On confirmed archive the user is navigated back to `/animals`.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| ANIMAL-01 | Archive an intake animal with no active obligations | Admin | An animal with status `intake`, no active foster placement, no stored relationships, no pending adoption, no upcoming clinic slot, and no active sitting / transport / supply request referencing it. The animal has a few notes, photos, and medical records on its profile. | 1. Open the animal at `/animals/:id` as Admin. 2. Click the trash icon next to **Edit** in the hero header. 3. Confirm in the dialog. | Dialog closes. User is navigated back to `/animals`. The animal no longer appears in the Animals list. Visiting `/animals/:id` directly shows "Animal not found". Open Recycle Bin — one row appears with type **Animal** and the animal's name. |
| ANIMAL-02 | Restore animal — sub-records still attached | Admin | The animal archived in ANIMAL-01 is in the bin | 1. Open Recycle Bin. 2. Click the restore icon on the **Animal** row. 3. Open `/animals/:id` for that animal. | Animal reappears in the Animals list and on its profile route. Every note, photo, and medical record it had before archiving is still present (no cascade ran on archive, so no cascade-restore was needed). |
| ANIMAL-03 | Blocker: active foster placement | Admin | An animal currently in foster (one `foster_placements` row with `placement_status = 'active'`) | 1. Open the animal profile as Admin. 2. Click the trash icon next to **Edit**. 3. Confirm. | The trash icon IS visible (blockers are server-enforced, not UI-gated). The confirm dialog raises the exact error *"cannot archive: animal has an active foster placement"*. The animal is NOT archived; it still appears in the Animals list. |
| ANIMAL-04 | Blocker: active relationships exist | Admin | An animal with at least one non-archived `animal_relationships` row referencing it (either direction — e.g. it's the mother of another animal, or is bonded with another) | 1. Open the animal profile as Admin. 2. Click the trash icon. 3. Confirm. | Dialog raises the exact error *"cannot archive: animal has active relationships — remove them from the Relationships card first"*. Animal is not archived. |
| ANIMAL-05 | Blocker: pending adoption | Admin | An animal with an `adoptions` row whose status is anything other than `completed` / `cancelled` / `returned` (e.g. `inquiry`, `submitted`, `approved`) | 1. Open the animal profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: animal has a pending adoption — cancel it first"*. Animal is not archived. |
| ANIMAL-06 | Blocker: status = adopted | Admin | An animal whose status is `adopted` (tracked-history record) | 1. Open the animal profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive an adopted animal — this record is tracked history"*. Animal is not archived and remains in the Animals list (under whatever filter shows adopted records). |
| ANIMAL-07 | Blocker: upcoming clinic slot | Admin | An animal with a `clinic_slots` row whose parent `clinic_events.status` is not `completed` / `canceled`, and whose own `status` is not `canceled` / `no_show` (e.g. a scheduled clinic with this animal slotted in) | 1. Open the animal profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: animal has an upcoming clinic slot — remove the slot or cancel the clinic first"*. Animal is not archived. |
| ANIMAL-08 | Blocker: open transport request | Admin | An animal that's the subject of a `transport_requests` row whose status is not `completed` / `canceled` (e.g. an open or claimed transport) | 1. Open the animal profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: animal has an active transport request"*. Animal is not archived. |
| ANIMAL-09 | Member sees no trash icon on any animal | Member | Any animal in the org, in any status | 1. Sign in as Member. 2. Open `/animals/:id` for any animal. 3. Inspect the hero header. | No trash icon renders next to **Edit**. (The **Edit** button itself may still be visible per its own role rules.) |

### People (contacts and fosters)

The same `people` row is editable from two profile pages — **ContactProfile** at `/contacts/:id` and **FosterProfile** at `/fosters/:id`. Both surface a trash icon next to the **Edit** button in the profile header, and both route the same server call. On confirmed archive, ContactProfile redirects to `/contacts`; FosterProfile redirects to `/fosters`.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| PERSON-01 | Archive a contact with no active obligations | Admin | A contact (a `people` row) with no active foster placement as foster, no in-flight adoption as adopter, no active sitting / transport / supply request involvement | 1. Open `/contacts/:id` for that person as Admin. 2. Click the trash icon next to **Edit** in the profile header. 3. Confirm in the dialog. | Dialog closes. User is redirected to `/contacts`. The contact no longer appears in the Contacts directory. Recycle Bin shows one row with type **Person** and the contact's name. |
| PERSON-02 | Archive a foster from FosterProfile | Admin | A foster (a `people` row whose `roles` include `foster_parent`) whose foster placements are ALL `completed` / `interrupted` (no `active` placement), and who has no in-flight adoption / sitting / transport / supply involvement | 1. Open `/fosters/:id` for that foster as Admin. 2. Click the trash icon next to **Edit** in the profile header. 3. Confirm. | Dialog closes. User is redirected to `/fosters`. The foster no longer appears in the Fosters list. Recycle Bin shows one **Person** row. |
| PERSON-03 | Blocker: active foster placement as foster | Admin | A person who is the foster on at least one `foster_placements` row with `placement_status = 'active'` | 1. Open `/fosters/:id` (or `/contacts/:id`) for that person as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: person is the foster on an active placement"*. Person is not archived. |
| PERSON-04 | Blocker: pending adoption as adopter | Admin | A person who is the `adopter_id` on an `adoptions` row whose status is not `completed` / `cancelled` / `returned` | 1. Open `/contacts/:id` for that person as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: person is the adopter on a pending adoption"*. Person is not archived. |
| PERSON-05 | Blocker: active sitting request as sitter | Admin | A person who is the `sitter_person_id` (or `requested_by_person_id`) on a `sitting_requests` row whose status is not `completed` / `canceled` | 1. Open the person's profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: person is on an active sitting request"*. Person is not archived. |
| PERSON-06 | Blocker: open supply request as requester | Admin | A person who is the `requester_person_id` on a `supply_requests` row whose status is not `fulfilled` / `cancelled` / `denied` | 1. Open the person's profile as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: person has an open supply request"*. Person is not archived. |
| PERSON-07 | Member sees no trash icon on a person profile | Member | Any contact and any foster in the org | 1. Sign in as Member. 2. Open `/contacts/:id` for a contact. 3. Inspect the header. 4. Open `/fosters/:id` for a foster. 5. Inspect the header. | No trash icon renders next to **Edit** on either profile, regardless of the person's role or activity. |

### Litters

The trash icon sits in the **LitterProfile** header (the litter detail page) directly next to the **Update Group** button. On confirmed archive the user is navigated back to `/animals`.

| ID | Title | Role | Preconditions | Steps | Expected |
|---|---|---|---|---|---|
| LITTER-01 | Archive a litter whose only animals are archived (or unlinked) | Admin | A litter whose members have all either been archived (`animals.is_deleted = true`) or had their `litter_id` cleared — so no active animal still references it | 1. Open the litter detail page as Admin. 2. Click the trash icon next to **Update Group** in the header. 3. Confirm in the dialog. | Dialog closes. User is navigated back to `/animals`. The litter no longer appears anywhere in the litters UI. Recycle Bin shows one row with type **Litter**. Note: any archived animals that were members of this litter keep their `litter_id` set — they remain linked historically. |
| LITTER-02 | Blocker: at least one non-archived animal still linked | Admin | A litter that still has one or more `animals` rows with `litter_id = this.id` AND `is_deleted = false` | 1. Open the litter detail page as Admin. 2. Click trash → Confirm. | Dialog raises the exact error *"cannot archive: litter still has active animals linked — archive (or unlink) those animals first"*. Litter is not archived. |
| LITTER-03 | Member sees no trash icon on a litter profile | Member | Any litter in the org | 1. Sign in as Member. 2. Open the litter detail page. 3. Inspect the header. | No trash icon renders next to **Update Group**. (The **Update Group** button itself may still be visible per its own role rules.) |
