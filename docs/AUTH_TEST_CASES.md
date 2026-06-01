# Login / Sign-up — Test Plan

A short checklist for the ways someone gets into Whiskerville. Built to be run end-to-end without much setup. If something fails, report it by **ID** (e.g. "AUTH-02 failed").

**Who's who:** "Admin" = an existing Whiskerville admin (Dan) who can send invites. "You" = the tester signing in.

---

## Before you start

- Pick a test email you control (Gmail tips below).
- For the invite scenarios, ask the Admin to **send you an invite first**. It arrives as an email with a **"Join …"** button/link (the URL looks like `…/invite/<long-token>`).
- Start each run **signed out**: use a private/incognito window or a separate browser profile. Closing and reopening the incognito window gives you a clean session.
- On the *first* sign-in of a session you'll see a ~2-second pulsing logo "loading" screen — that's expected. It should **not** reappear when you refresh a page later in the same session.

---

## ⚠️ Email tips (matters a lot for Google)

Gmail treats all of these as the **same inbox**: `you@gmail.com`, `y.o.u@gmail.com`, and `you+anything@gmail.com`. Handy for catching lots of test invites in one place — but there's a catch:

- **Email + password sign-up:** `you+rescue@gmail.com` counts as a **separate account**. Great for making several test accounts from one inbox.
- **Google sign-in:** Google always signs you in as the plain `you@gmail.com` — the `+rescue` (and any dots) are **dropped**. So if the Admin invites `you+rescue@gmail.com` and you "Continue with Google," your real account email is `you@gmail.com`, which **won't match the invite** and you'll be denied.
  - 👉 For Google scenarios, have the Admin invite your **plain** Gmail address. The address must match the invite (capitalization doesn't matter, but `+suffix`/dots do).

---

## Scenarios

| ID | Title | Steps | Expected |
|---|---|---|---|
| AUTH-01 | Accept invite, sign in with **Google** | Precondition: Admin invited your **plain** Gmail. 1. Open the invite email → click **Join …**. 2. The page shows **"Join \<Org\>"** with your email + role. 3. Click **Sign in to accept**. 4. On the next screen click **Continue with Google**. 5. Pick your Google account. | Google sends you back and you drop **straight into the org** (the dashboard) with no extra clicks — the invite auto-accepts. |
| AUTH-02 | Accept invite, register with **email + password** | Precondition: Admin invited your email (a `+suffix` is fine here). 1. Click **Join …** in the invite email. 2. Click **Sign in to accept**. 3. The screen opens in **Sign Up** mode with your email prefilled. 4. Enter first name, last name, a password (**≥ 8 characters**), and confirm it. 5. Click **Sign Up**. 6. *If* you see **"Check your email,"** open the confirmation email, click its link, then return and sign in with the same email + password. | After signing up (and confirming, if asked), you land **in the org / dashboard**. The invite is accepted automatically. |
| AUTH-03 | Try to register **without** an invite (should be blocked) | 1. Signed out, open the app and click **Sign In** (or go to `/login` directly). 2. Look at the form. | Only **Sign In** is offered — **no** "Sign up" toggle and **no** name fields. Below the form it says *"Want to use Whiskerville for your rescue? **Request access**."* You cannot self-register an email/password account without an invite. |
| AUTH-04 | Request beta access | 1. From the sign-in screen click **Request access** (or open `/request-access`). 2. Fill in the form. 3. Click **Request Beta Access**. | A **"Thanks for your interest in Whiskerville!"** confirmation appears. No account is created — this just sends your request to the team. |
| AUTH-05 | Google sign-in with **no invite/org** (cold) | 1. Signed out, go to `/login`. 2. Click **Continue with Google**. 3. Pick a Google account that has **not** been invited anywhere. | Sign-in succeeds, but you land on the honest **no-access** screen: *"Signed in as \<email\>, but you don't have access to an organization yet,"* listing two paths (ask an admin to invite you / request beta access). No app data shows. |
| AUTH-06 | Invite opened with the **wrong account** | 1. Sign in (any method) using an email that is **not** the invited address. 2. Open the invite link. | The invite page warns: *"This invite was sent to \<invited\>, but you're signed in as \<yours\>."* The **Accept invite** button is disabled, and there's a **"Sign out and use \<invited\>"** link. *(If instead you clicked the link first and then signed in with the wrong email, you'll land on the no-access screen explaining the mismatch.)* |

---

## Quick extra invite checks (optional)

Open an invite link that is in one of these states and confirm the message:

- **Already used** → *"This invite has already been used."*
- **Revoked** (Admin cancels it) → *"This invite has been revoked."*
- **Expired** → *"This invite has expired."*
- **Garbled / partial link** → *"This invite link is invalid or has expired."*

---

## Tips while testing

- Keep the browser console open — server errors surface as red text in the UI, but the console has the full message.
- To re-test from scratch, sign out (avatar/menu → Sign out) **and** open a fresh incognito window, so both the session and the "first-load splash" reset.
