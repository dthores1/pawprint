---
name: run-app
description: Launch and drive the Whiskerville app (React + Vite SPA) for UI verification — runs it in no-auth demo mode and drives a real browser over the Chrome DevTools Protocol (no Playwright/chromium-cli needed). Use when asked to run/start the app, click through a flow, screenshot a screen, or confirm a UI change works end-to-end.
---

# Running & driving Whiskerville

Whiskerville is a client-rendered Vite SPA. Production mode is auth-gated
(Supabase Google/email login) and **cannot be driven headlessly** — there are no
test credentials. For UI verification, use **demo mode** (`VITE_APP_MODE=demo`),
which renders seeded in-memory data with no login and supports full CRUD
(changes reset on refresh).

Driving is done over the **Chrome DevTools Protocol** using a tiny dependency-free
driver (`cdp-driver.mjs`, next to this file) — Node 22+ has a global `WebSocket`,
so no Playwright or `chromium-cli` install is required. There IS a system Chrome.

## 1. Start the demo dev server (background)

```bash
cd <repo root>
VITE_APP_MODE=demo npm run dev > /tmp/pp-dev.log 2>&1 &
sleep 6
grep -oE 'http://localhost:[0-9]+' /tmp/pp-dev.log | head -1   # <-- READ THE ACTUAL PORT
```

⚠️ The port is **not always 5173** — if you (or the user) already have instances
running, Vite falls through to 5174, 5175, … Always read the printed URL and use
that as `baseUrl`.

## 2. Launch headless Chrome with remote debugging (background)

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rm -rf /tmp/pp-chrome-profile
"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --remote-debugging-port=9333 --user-data-dir=/tmp/pp-chrome-profile \
  --window-size=1400,1000 about:blank > /tmp/pp-chrome.log 2>&1 &
sleep 3
curl -s http://localhost:9333/json/version | head -c 80   # confirm it's up
```

## 3. Write a flow and run it

Create `flow.mjs` next to `cdp-driver.mjs` (or anywhere; fix the import path),
then `node flow.mjs`. Example that mirrors the species/breed checks:

```js
import { connect } from './cdp-driver.mjs';
const d = await connect({ baseUrl: 'http://localhost:5175' }); // use the real port
try {
  await d.nav('/animals');
  await d.screenshot('animals-list');

  await d.clickText('button', 'Add Animal');           // header button opens modal
  await d.sleep(800);
  console.log(await d.evaluate(`return [...document.querySelector('#species').options].map(o=>o.text)`));

  // Select a species by visible option text, then read the dynamic field label.
  await d.evaluate(`const s=document.querySelector('#species');const o=[...s.options].find(x=>x.text==='Reptile');window.__set(s,o.value);`);
  await d.sleep(500);
  console.log('label:', await d.evaluate(`return document.querySelector('label[for="breed"]').textContent`));
  await d.screenshot('reptile-selected');

  await d.close();
} catch (e) { console.error(e); await d.screenshot('error'); await d.close(); }
```

Look at the screenshots in `/tmp/pp-shots/` — a "Loading…" splash means the page
wasn't ready (see gotchas).

## Driver API (`cdp-driver.mjs`)

- `nav(path)` — navigate (`baseUrl`-relative ok) and **poll past the demo splash**.
- `screenshot(name)` — PNG to `/tmp/pp-shots/<name>.png`.
- `evaluate(jsBody)` — run `(function(){ <jsBody> })()` in the page, returns the value.
- `setValue(selector, value)` — set a **React-controlled** input/select/textarea.
- `clickText(tag, text, last=false)` — click the first (or last) element whose text matches.
- `sleep(ms)`, `close()`. Page helpers `window.__set` / `window.__clickText` are injected on each `nav`.

## Gotchas (learned the hard way)

- **Splash gate:** the app shows a "Loading…" splash first. `nav()` already polls
  past it; if you navigate by other means, wait until `document.body.innerText`
  no longer starts with "Loading".
- **React inputs:** never set `el.value` directly — React won't see it. Use
  `setValue()` / `window.__set` (native setter + `input`+`change` events). For
  `<select>`, set the option's **value** (often an id), not its text.
- **Duplicate button labels:** the Animals page header AND the Add-Animal modal
  footer both say "Add Animal". Use `clickText('button','Add Animal', /*last*/ true)`
  to hit the modal's submit, else you just re-open/no-op.
- **Required fields to create an animal:** Name or Rescue ID, Intake source, and
  age. For age, click the **Estimated Age** radio
  (`[...document.querySelectorAll('input[type=radio]')].find(r=>/Estimated Age/i.test(r.closest('label').textContent)).click()`)
  then set the visible `input[type=number]` — the Birthdate path needs the portal
  calendar, which is harder to drive.
- **Demo seed coverage:** seeded breeds exist only for dog/cat/rabbit/bird, so
  less-common species show "No types available" in demo. That's a seed gap, not a
  bug — production (Supabase) has the full catalog. Seeded animals are dogs/cats.
- **Portaled popovers:** date pickers and the breed/type list render to
  `document.body` (not inside their field), so query the whole document for them.
- **`nav()` resets demo state:** it's a full page load, and demo data is
  in-memory. For flows that mutate data then check another page (e.g. Reports),
  navigate client-side instead: `document.querySelector('a[href="/reports"]').click()`.
- **`DatePicker` is a `<button>`, not an input:** its `id` lands on a button
  showing formatted text (`Jul 15, 2026`); read it via `.textContent`, and don't
  `setValue()` it — accept the default or drive the portal calendar.

## Cleanup

```bash
lsof -ti:5175 | xargs kill 2>/dev/null   # the dev server port you used
lsof -ti:9333 | xargs kill 2>/dev/null   # headless Chrome
rm -rf /tmp/pp-chrome-profile
```
