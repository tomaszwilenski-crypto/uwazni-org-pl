const { expect } = require('@playwright/test');
const ORIGIN = 'http://localhost:4173';
const API = 'https://api.uwazni.org.pl';

const ME = { id: 'x', state: 'waiting', lang: 'pl', referral_code: 'ABCD1234', first_name: null, last_name: null, balance_points: 250, completion_pct: 33, has_account_number: false };
const PROFILE = { birth_year: 1980, gender: null, voivodeship: null, town_size: null, device: null, interests: ['tech', 'biznes', 'auto'], completion_pct: 33 };

/** routes: { 'METHOD /path': (body, calls) => [status, json] | {status, json, text} }. Zwraca log wywołań. */
async function mock(page, routes = {}) {
  const calls = [], blocked = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN)) return route.continue();
    blocked.push(u); return route.abort();
  });
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `window.turnstile={render:function(el,o){el.textContent='[turnstile mock]';setTimeout(function(){o.callback('tok-mock')},20);return 1},reset:function(){}};
           var cb=new URL(document.currentScript.src).searchParams.get('onload'); if(cb&&window[cb])window[cb]();`,
  }));
  await page.route(API + '/**', async (route) => {
    const req = route.request(), url = new URL(req.url());
    const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'Content-Type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = url.pathname.replace('/api/panel', '');
    let body = null; try { body = req.postDataJSON(); } catch (e) {}
    const call = { method: req.method(), path, body, contentType: req.headers()['content-type'] };
    calls.push(call);
    const h = routes[req.method() + ' ' + path];
    if (!h) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":"not_found"}' });
    let r = h(body, calls); if (Array.isArray(r)) r = { status: r[0], json: r[1] };
    return route.fulfill({ status: r.status, headers: cors, contentType: 'application/json', body: r.text != null ? r.text : JSON.stringify(r.json || {}) });
  });
  await page.addInitScript(() => {
    window.__fetchLog = [];
    const f = window.fetch; window.fetch = function (u, o) { window.__fetchLog.push({ url: String(u), credentials: o && o.credentials }); return f.apply(this, arguments); };
  });
  page.__blocked = blocked;
  return calls;
}

async function noHorizontalScroll(page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(o).toBeLessThanOrEqual(0);
}

module.exports = { mock, noHorizontalScroll, ME, PROFILE, ORIGIN, API };
