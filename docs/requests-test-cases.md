# Requests — Test Cases

Manual test cases for the **Requests** area (Supply, Transport, Sitting). Each
case is one path with steps and expected results.

## Roles

- **Requester** — any member; raises requests, can cancel/edit their own.
- **Coordinator** — owner/admin, or a member with the relevant permission
  (`MANAGE_SUPPLY_REQUESTS` for Supply). May process/assign/reassign/archive.
- **Volunteer / Fulfiller** — any member acting on someone else's request
  (claim, accept/decline, fulfill).

## Conventions

- Navigate to **Requests** (`/requests`); pick the **Supply / Transport / Sitting**
  tab. Lists have sub-tabs (Active/History, or Mine/Unclaimed/Assigned/Completed).
- **Notifications** are created by the backend, never for the **acting user's own
  action**, and only reach recipients who have an account (a `people.user_id`).
- Unless stated, "you" = the signed-in user, and actions are taken from the
  request card or its detail.

---

## 1. Supply Requests

Status flow: **Submitted → In Progress → Fulfilled**; or **Denied**; or
**Cancelled**. Supply has no requester-side "edit" — withdraw and re-raise, or
use a Common Request.

### SR-01 — Raise a single-item request
1. Tab **Supply** → **Request Supplies**.
2. Pick a product, set quantity + unit, leave priority **Normal**, submit.
- **Expected:** Request appears in **Active** as **Submitted**, attributed to you;
  one line item shown with its quantity.

### SR-02 — Raise a multi-item request with notes & priority
1. Open the form, **Add another item** twice (3 items); set per-item notes on one.
2. Set priority **Urgent**, submit.
- **Expected:** Card shows all items (4th+ collapse to "+N more"), the **URGENT**
  chip + red tint, and the per-item note as a muted sub-line.

### SR-03 — Custom ("Other") item requires a note
1. In the product picker choose **Other** and type a name; leave the note blank; submit.
- **Expected:** Validation blocks submit until the note (description) is filled.

### SR-04 — Duplicate-product warning (non-blocking)
1. Have an open (Submitted/In Progress) request of yours containing product **X**.
2. Start a new request and select **X**.
- **Expected:** Amber inline warning "You already have an open request for X" with
  **View existing request**; **Submit stays enabled**. The link opens that
  request's detail. A different requester selecting **X** sees **no** warning.

### SR-05 — Common request: save, resubmit, remove
1. On the form tick **Save as common request**, name it, submit.
2. **Common** sub-tab → **Resubmit** the template; then **Remove** it.
- **Expected:** Resubmit creates a brand-new Submitted request copied from the
  template (template unchanged, last-used bumped); Remove un-saves the template
  but leaves the original in History.

### SR-06 — Cancel your own submitted request
1. On your **Submitted** request, click **Cancel Request** and confirm.
- **Expected:** Status → **Cancelled**, moves to **History**; requester is the
  actor so no self-notification.

### SR-07 — Cancel is unavailable once processing
1. View a request that is **In Progress** (or anyone else's request).
- **Expected:** No **Cancel Request** control is shown.

### SR-08 — Start processing (Coordinator)
1. As Coordinator, open a **Submitted** request → **Start Processing**.
- **Expected:** Status → **In Progress**; requester receives a status-change
  notification.

### SR-09 — Fulfill a request (Coordinator)
1. Open an **In Progress** request, record **Supplier** + **Total cost**, mark fulfilled.
- **Expected:** Status → **Fulfilled**, moves to **History**; requester notified.

### SR-10 — Deny a request (Coordinator)
1. Open a **Submitted** request → **Deny Request**, enter a reason, confirm.
- **Expected:** Status → **Denied** (reason required & stored); requester notified.

### SR-11 — Financial visibility gating
1. As a member **without** supply permission (and org "Show all reports" off),
   view a request.
- **Expected:** **Total cost** is not shown (and isn't sent to the browser). A
  Coordinator (or with the setting on) does see it.

### SR-12 — Active list ordering
1. With a mix of statuses/priorities, open the **Active** list.
- **Expected:** Order = **Urgent Submitted** → **Submitted** → **In Progress**,
  **oldest-first within each group**. History stays newest-first.

### SR-13 — Permission gating of actions
1. As a member without `MANAGE_SUPPLY_REQUESTS`, view a Submitted request.
- **Expected:** No Start Processing / Fulfill / Deny actions; supply items do not
  appear in the dashboard **Help Needed** widget for them.

---

## 2. Transport Requests

Status flow: **Open → Claimed / Assigned → Accepted → In Progress → Completed**;
or **Cancelled**; or **Expired**. Sub-tabs: **Assigned to Me / Unclaimed /
Assigned / Completed**.

### TR-01 — Raise a transport request (schedule types)
1. Tab **Transport** → **New Transport Request**; set animals, pickup/dropoff.
2. Repeat for each schedule type: **Exact** date/time, **Flexible** window,
   **ASAP**, **Coordinate later**.
- **Expected:** Request created as **Open** (Unclaimed); the card's "when" line
  reflects the schedule type (date·time / Flexible / ASAP / Date TBD).

### TR-02 — Raise with direct assignment
1. On the form choose **Assign to a volunteer** and pick one; submit.
- **Expected:** Status **Assigned**; the assigned volunteer receives an
  assignment notification (even though it was assigned at creation).

### TR-03 — Claim an open request (Volunteer)
1. As a volunteer (not the requester), open an **Unclaimed** request → **Claim Request**.
- **Expected:** Status → **Claimed**, you become the assignee; the **requester**
  is notified it was claimed.

### TR-04 — Cannot claim your own request
1. View an Open request that **you** raised.
- **Expected:** No **Claim** control (requesters can't claim their own).

### TR-05 — Assign / reassign (Coordinator)
1. As Coordinator, on an Open request use **Assign…** and pick a volunteer.
2. On an assigned/accepted request, **Reassign** to a different volunteer.
- **Expected:** Status **Assigned**; the (new) assignee is notified; on reassign
  the previous assignee is cleared.

### TR-06 — Accept an assignment (Volunteer)
1. As the assigned volunteer, open the request → **Accept**.
- **Expected:** Status → **Accepted**.

### TR-07 — Decline an assignment (Volunteer)
1. As the assigned volunteer, **Decline** (or Coordinator **Remove assignment**).
- **Expected:** Assignee cleared, status → **Open**; the **requester** is notified
  their volunteer dropped (so they can find coverage).

### TR-08 — Complete a transport
1. As the assignee/requester/Coordinator on a committed ride, **Mark Complete**.
- **Expected:** Status → **Completed**, moves to **Completed** sub-tab.

### TR-09 — Edit your own open request
1. As the requester, on an **Open/Expired** request → **Edit**, change details, save.
- **Expected:** Changes persist; edit is unavailable once claimed/assigned.

### TR-10 — Cancel your own request
1. As the requester, **Cancel** a non-terminal request and confirm.
- **Expected:** Status → **Cancelled**.

### TR-11 — Archive a terminal request (Coordinator)
1. On a Completed/Cancelled request, **Archive**.
- **Expected:** Removed from the list to the Recycle Bin; restorable there.

### TR-12 — Time-based reminders
1. Leave an unaccepted/assigned request approaching its time.
- **Expected:** Reminder notifications fire to the relevant party (requester /
  assigned volunteer / "still unaccepted").

### TR-13 — Deep-link from dashboard "Help Needed"
1. On the Dashboard, click an unclaimed Transport row in **Help Needed**.
- **Expected:** Lands on **Transport → Unclaimed** with that request scrolled into
  view and briefly highlighted (no detail modal for transport).

---

## 3. Sitting Requests

Status flow: **Open → Claimed / In Progress → Completed**; or **Cancelled**; or
**Expired**. Sub-tabs mirror Transport (**Mine / Unclaimed / Assigned / Completed**).

### ST-01 — Raise a sitting request
1. Tab **Sitting** → **New Sitting Request**; choose animal(s) in your care, set
   start/end dates; optionally tick **Transport needed**; submit.
- **Expected:** Request created **Open** (Unclaimed); card shows animals + date range.

### ST-02 — Accept (claim) an open request (Volunteer)
1. As a sitter (not the requester), open an **Unclaimed** request → **Accept**.
- **Expected:** Status → **Claimed**, you become the sitter; the **requester** is
  notified you accepted.

### ST-03 — Cannot accept your own request
1. View an Open sitting request **you** raised.
- **Expected:** No **Accept** control.

### ST-04 — Release after accepting ("Unable to Sit")
1. As the committed sitter, **Release** the request.
- **Expected:** Sitter cleared, status → **Open** (reopened); the **requester** is
  notified their coverage fell through.

### ST-05 — Complete a sitting
1. As sitter/requester/Coordinator on a committed sit, **Mark Complete**.
- **Expected:** Status → **Completed**, moves to **Completed** sub-tab.

### ST-06 — Edit your own open request
1. As the requester, on an **Open/Expired** request → **Edit**, change details, save.
- **Expected:** Changes persist; unavailable once a sitter has accepted.

### ST-07 — Cancel your own request
1. As the requester, **Cancel** a non-terminal request and confirm.
- **Expected:** Status → **Cancelled**.

### ST-08 — Arrange transport for a sitting
1. On a sitting request, **Arrange transport** and complete the transport form.
- **Expected:** A linked Transport request is created; the sitting card reflects
  the linked transport.

### ST-09 — Archive a terminal request (Coordinator)
1. On a Completed/Cancelled request, **Archive**.
- **Expected:** Removed to the Recycle Bin; restorable.

### ST-10 — Time-based reminders
1. Leave an unaccepted/accepted request approaching its start.
- **Expected:** Reminder notifications fire to the relevant party (requester /
  volunteer / "still unaccepted").

### ST-11 — Deep-link from dashboard "Help Needed"
1. On the Dashboard, click an unclaimed Sitter row in **Help Needed**.
- **Expected:** Lands on **Sitting → Unclaimed** with that request scrolled into
  view and briefly highlighted.

---

## Cross-cutting checks

- **Notifications:** the acting user never gets a notification for their own
  action; recipients without an account receive nothing; the bell badge and list
  update, and opening a notification routes to the right request tab.
- **History tab** (Supply) sorts newest-first and is loaded on demand.
- **"View as" (read-only):** while viewing as another member, request write
  actions (claim/assign/accept/cancel/complete) are disabled.
