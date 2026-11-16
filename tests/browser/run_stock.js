// The Stock page's «قرب يخلص» and «خلصت»: first on the page, the count of what is running low and what ran out, the items with
// the fewest left first and how many are left, the names of what ran out; tapping a number opens the list on it, tapping an
// item adds stock. Same set-up as run_company.js (in-browser demo backend, Chrome).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoExtra:${JSON.stringify(EXTRA)}};`;
const errors = []; let step = 0;
const log = s => console.log(`${++step}. ${s}`);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' !== ORIGIN) return route.abort();
    const p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    if (p === '/config.js' && !process.env.SITE) return route.fulfill({ contentType: 'text/javascript', body: CONFIG });
    const f = path.join(SITE, p);
    return fs.existsSync(f) ? route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'stk-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const facts = () => db(() => { const D = window.__mockdb, lv = D.settings.low_stock == null ? 3 : D.settings.low_stock;
    const low = D.products.filter(p => p.qty != null && p.qty >= 1 && p.qty <= lv).sort((a, b) => a.qty - b.qty || a.title.localeCompare(b.title, 'ar'));
    return { lv, low: low.map(p => ({ id: p.id, title: p.title, qty: p.qty })), out: D.products.filter(p => p.qty === 0).map(p => p.title) }; });
  try {
    await page.goto(ORIGIN); await page.waitForTimeout(1200);
    await go('login'); await see('#ae'); await page.fill('#ae', 'owner@crossky.ly'); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/);
    let f = await facts();
    must(f.low.length >= 2 && f.out.length >= 1, 'the demo has parts running low and run out ' + JSON.stringify(f));
    await go('stock'); await see('.stk-alert');
    must(await page.locator('#slow').evaluate(el => el === el.parentElement.querySelector('#slow, .stk-actions, #ssum')), 'first on the page');
    must((await text('.sa-num.low b')) === String(f.low.length) && (await text('.sa-num.out b')) === String(f.out.length), 'the two counts: ' + await text('.sa-nums'));
    const rows = await page.locator('.sa-row').evaluateAll(els => els.map(e => ({ q: +e.querySelector('.sa-left b').textContent, t: e.querySelector('.ar-main b').textContent })));
    must(rows.length === Math.min(6, f.low.length) && rows.every((r, i) => r.q === f.low[i].qty && r.t === f.low[i].title), 'the fewest left first, with what is left: ' + JSON.stringify(rows));
    must((await text('.sa-out')).includes(f.out[0]), 'what ran out is named');
    await shot('01-panel');
    log('first on the Stock page: «' + f.low.length + ' قرب يخلص» and «' + f.out.length + ' خلصت», then ' + rows.map(r => r.t + ' (باقي ' + r.q + ')').join('، ') + ', and what ran out by name');
    await page.click('.sa-num.low'); await page.waitForTimeout(700);
    must(await page.locator('.chip.on[data-f="low"]').count() === 1, 'the list on «قرب يخلص»');
    const listed = await page.locator('#sll .stk-row').evaluateAll(els => els.map(e => +e.querySelector('.qty-chip').textContent));
    must(listed.length === f.low.length && listed.every((q, i) => i === 0 || listed[i - 1] <= q), 'listed fewest first: ' + listed);
    log('tapping «قرب يخلص» opens the list on it, the fewest left first: ' + listed.join(', '));
    await go('stock'); await see('.sa-row');
    const first = f.low[0];
    await page.click('.sa-row[data-low="' + first.id + '"]'); await see('#adj');
    must(await page.locator('#adj input[value="in"]').isChecked(), 'the sheet opens on «زيد»');
    await page.fill('#aq', '10'); await page.click('#adj .btn-signal'); await page.waitForTimeout(700);
    f = await facts();
    must(!f.low.some(p => p.id === first.id) && (await text('.sa-num.low b')) === String(f.low.length), 'added 10: no longer running low');
    log('tapping «' + first.title + '» opens «زيد»; +10 and it leaves the list (' + f.low.length + ' left running low)');
    await db(() => { const D = window.__mockdb; D.products.forEach(p => { if (p.qty != null && p.qty <= 3) { p.qty = 12; p.status = 'active'; } });
      const k = Object.keys(localStorage).find(x => x.startsWith('sp_demo_db_v') && !x.endsWith('_session')); localStorage.setItem(k, JSON.stringify(D)); });
    await go('vin'); await go('stock'); await see('.stk-good');
    must((await text('.stk-good')).includes('متوفرة') && await page.locator('.stk-alert').count() === 0, 'all good');
    log('when nothing is running low: one green line instead');
    await db(() => window.SP.setLang('en')); await db(() => { const D = window.__mockdb; D.products[0].qty = 1; D.products[1].qty = 0; }); await go('vin'); await go('stock'); await see('.stk-alert');
    must((await text('.sa-num.low')).includes('Running low') && (await text('.sa-left small')) === 'left', 'English');
    await shot('02-english');
    log('English reads left to right');
    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' STOCK CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
