// Smoke test of a built company edition (tools/build_company.py) with its own config.js and service worker:
// name, manifest, brands, offline caches named after the company, owner demo login, #receive and #pos, offline reload.
//   python3 -m http.server 8765 --bind 127.0.0.1 --directory crossky &
//   PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 node tests/browser/smoke_build.js
// (the variable lets the test block the service worker's own CDN requests, as a phone without a connection would fail them)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const URL0 = process.env.URL0 || 'http://localhost:8765/';
(async () => {
  const errors = [], must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-LY' });
  await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  const page = await ctx.newPage();
  page.on('crash', () => errors.push('page crashed'));
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(URL0);
  await page.locator('#gnew .card').first().waitFor({ timeout: 15000 });
  const title = await page.title(), brand = (await page.locator('.topbar .brand').first().innerText()).trim() || (await page.getAttribute('.topbar .brand img', 'alt')) || '';
  must(title.startsWith('CROSSKY') && brand.includes('CROSSKY'), 'name: ' + title + ' / ' + brand);
  must(await page.evaluate(() => [...document.querySelectorAll('.topbar .brand img')].every(i => i.complete && i.naturalWidth > 0)), 'the logo in the bar loads');
  const man = await (await page.request.get(URL0 + 'manifest.webmanifest')).json();
  must(man.name === 'CROSSKY' && man.shortcuts.some(s => s.url === './#receive'), 'manifest');
  const cfg = await page.evaluate(() => window.SPARAT_CONFIG);
  must(cfg.mode === 'company' && cfg.demo === true && cfg.brands.length === 18, 'config');
  const sw = await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); const r = await navigator.serviceWorker.ready; await new Promise(s => setTimeout(s, 1500)); return { active: !!r.active, caches: await caches.keys() }; });
  must(sw.active && sw.caches.some(k => k.startsWith('crossky-')) && !sw.caches.some(k => k.startsWith('sparat-')), 'service worker caches: ' + sw.caches.join(','));
  // owner login (demo)
  await page.evaluate(() => { location.hash = 'login'; }); await page.locator('#ae').waitFor();
  await page.fill('#ae', 'owner@crossky.ly'); await page.fill('#ap', '123456');
  await page.locator('#ae').press('Enter'); await page.waitForTimeout(1200);
  await page.evaluate(() => { location.hash = 'receive'; }); await page.locator('#rpf').waitFor({ state: 'attached', timeout: 8000 }); await page.locator('#rscan').waitFor();
  await page.evaluate(() => { location.hash = 'pos'; }); await page.locator('#pscan').waitFor({ timeout: 8000 });
  // reload offline from the service worker cache
  await ctx.setOffline(true); await page.reload({ waitUntil: 'commit' });
  await page.locator('#pscan').waitFor({ timeout: 10000 }); await page.evaluate(() => { location.hash = ''; }); await page.locator('.topbar .brand').first().waitFor({ timeout: 10000 }); await ctx.setOffline(false);
  must(!errors.length, errors.join(' | '));
  console.log('BUILD SMOKE OK:', title, '| brands', cfg.brands.length, '| caches', sw.caches.join(','), '| owner reached #receive and #pos | offline reload OK');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
