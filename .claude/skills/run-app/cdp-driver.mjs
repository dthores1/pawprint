// cdp-driver.mjs — drive the Whiskerville app over the Chrome DevTools Protocol.
// Zero external deps: relies on Node's global WebSocket (Node 22+) + fetch.
//
// Usage (write a flow.mjs next to this and `node flow.mjs`):
//
//   import { connect } from './cdp-driver.mjs';
//   const d = await connect({ baseUrl: 'http://localhost:5175' });
//   await d.nav('/animals');
//   await d.screenshot('animals');
//   await d.clickText('button', 'Add Animal');     // header button
//   console.log(await d.evaluate(`return [...document.querySelector('#species').options].map(o=>o.text)`));
//   await d.clickText('button', 'Add Animal', true); // footer submit (LAST match)
//   await d.close();

import { writeFileSync, mkdirSync } from 'node:fs';

export async function connect({
  baseUrl = 'http://localhost:5175',
  cdpPort = 9333,
  shotDir = '/tmp/pp-shots'
} = {}) {
  mkdirSync(shotDir, { recursive: true });
  const ver = await (await fetch(`http://localhost:${cdpPort}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  let sessionId = null;
  const loadWaiters = [];
  ws.onmessage = (m) => {
    const x = JSON.parse(m.data);
    if (x.id && pending.has(x.id)) {
      const { resolve, reject } = pending.get(x.id);
      pending.delete(x.id);
      x.error ? reject(new Error(JSON.stringify(x.error))) : resolve(x.result);
    } else if (x.method === 'Page.loadEventFired') {
      loadWaiters.splice(0).forEach((w) => w());
    }
  };
  const send = (method, params = {}, useSession = true) =>
    new Promise((resolve, reject) => {
      const _id = ++id;
      pending.set(_id, { resolve, reject });
      ws.send(JSON.stringify({ id: _id, method, params, sessionId: useSession ? sessionId : undefined }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false);
  sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, false)).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const evaluate = async (expr) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression: `(function(){${expr}})()`,
      returnByValue: true,
      awaitPromise: true
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'eval error');
    return result.value;
  };

  // Injected page helpers: React-aware value setter + text-matched click.
  const HELPERS = `
    window.__set=function(el,v){const p=el.tagName==='SELECT'?HTMLSelectElement.prototype:(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype);Object.getOwnPropertyDescriptor(p,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    window.__clickText=function(tag,text,last){const e=[...document.querySelectorAll(tag)].filter(x=>x.textContent.trim().toLowerCase().includes(text.toLowerCase()));const t=last?e[e.length-1]:e[0];if(t){t.click();return true;}return false;};`;

  const nav = async (path, { settleMs = 0 } = {}) => {
    const done = new Promise((r) => loadWaiters.push(r));
    await send('Page.navigate', { url: path.startsWith('http') ? path : baseUrl + path });
    await done;
    // Poll past the demo splash ("Loading…") before interacting.
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const t = await evaluate(`return document.body.innerText`);
      if (t && !/Loading/.test(t.slice(0, 60))) break;
    }
    await evaluate(HELPERS);
    if (settleMs) await sleep(settleMs);
  };

  const screenshot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const p = `${shotDir}/${name}.png`;
    writeFileSync(p, Buffer.from(data, 'base64'));
    return p;
  };
  // Set a React-controlled input/select/textarea by CSS selector.
  const setValue = (selector, value) =>
    evaluate(`const el=document.querySelector(${JSON.stringify(selector)}); if(el) window.__set(el, ${JSON.stringify(value)}); return !!el;`);
  // Click the first (or, with last=true, the last) element whose text matches.
  const clickText = (tag, text, last = false) =>
    evaluate(`return window.__clickText(${JSON.stringify(tag)}, ${JSON.stringify(text)}, ${last});`);

  return { send, evaluate, nav, screenshot, setValue, clickText, sleep, close: () => ws.close() };
}
