// The System tab for the owner: the windows (اليوم، الأرباح والخسائر، الرصيد الكلي), swiped or tapped, with the right numbers;
// and the Face ID lock (Chrome's virtual platform authenticator stands in for Face ID). Same set-up as run_controls.js.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const ADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/ads.json'), 'utf8')).map(a => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))));
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoAds:${JSON.stringify(ADS)},demoExtra:${JSON.stringify(EXTRA)}};`;
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
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|NotAllowedError/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'sys-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const digits = s => String(s).replace(/[^\d−-]/g, '').replace('−', '-');
  const report = per => db(async k => { const [f, to] = window.SP.bk.span(k); const r = await window.SP.sb.rpc('pnl_report', { p_from: f.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: 'Africa/Tripoli' }); return r.data; }, per);
  try {
    await page.goto(ORIGIN); await page.waitForTimeout(1200);
    await go('login'); await see('#ap'); await page.click('[data-by="email"]'); await page.fill('#ae', 'owner@crossky.ly'); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/);
    // a month with something in it: a sale on credit, an expense
    await db(async () => { const p = window.__mockdb.products.find(x => x.price != null && x.status === 'active' && x.cost != null && (x.qty == null || x.qty > 3));
      await window.SP.sb.rpc('create_invoice', { p: { payment: 'credit', customer_name: 'ورشة الشهر', customer_phone: '0915556677', items: [{ id: p.id, qty: 2 }] } }); });

    await go('system'); await see('.sysp');
    must(await page.locator('.sysp-tabs [data-sp]').count() === 3 && /اليوم/.test(await text('[data-sp="0"]')) && /الأرباح والخسائر/.test(await text('[data-sp="1"]')) && /الرصيد الكلي/.test(await text('[data-sp="2"]')), 'three windows, no «المبيعات»');
    await see('#sp0 .today .astat');
    await shot('01-today');
    await page.click('[data-sp="1"]'); await page.waitForTimeout(700); await see('#sp1 .pl-net b');
    const m = await report('month');
    must(digits(await text('#sp1 .pl-net b')) === String(Math.round(Math.abs(m.net))) && /صافي/.test(await text('#sp1 .pl-net small')), 'the month\'s net: ' + m.net + ' / ' + await text('#sp1 .pl-net b'));
    must((await text('#sp1 .pl-body')).includes('تكلفة البضاعة') && (await text('#sp1 .pl-body')).includes('المصروفات'), 'sales, cost, gross, expenses');
    await shot('02-pnl');
    must(await db(() => { document.querySelector('#sp1 [data-per="year"]').click(); return document.querySelector('#sp1 .pl-body').classList.contains('stale') && !!document.querySelector('#sp1 .pl-net'); }), 'another period keeps the old numbers, faded, until the new ones come');
    await page.waitForTimeout(800);
    const y = await report('year');
    must(digits(await text('#sp1 .pl-net b')) === String(Math.round(Math.abs(y.net))), 'the year');
    log('«الأرباح والخسائر»: the month\'s net ' + m.net + ' from sales ' + m.sales + ', cost, gross, expenses; the year too');
    await page.click('[data-sp="2"]'); await page.waitForTimeout(700); await see('#sp2 .pl-net b');
    const s = await db(async () => (await window.SP.sb.rpc('stock_report', { p_limit: 1 })).data.summary);
    const total = (+s.value_cost || 0) + (+m.receivable) - (+m.payable);
    must(digits(await text('#sp2 .pl-net b')) === String(Math.round(Math.abs(total))), 'the total balance ' + total + ' / ' + await text('#sp2 .pl-net b'));
    must((await text('#sp2')).includes('ديون لينا') && (await text('#sp2')).includes('ديون علينا') && (await text('#sp2')).includes('دخلت'), 'stock, owed, owing, money in and out');
    await shot('03-balance');
    log('«الرصيد الكلي»: stock at cost ' + s.value_cost + ' + owed to us ' + m.receivable + ' − we owe ' + m.payable + ' = ' + total + ', and the month\'s money in and out');
    await db(() => { const tr = document.querySelector('#spt'); tr.scrollTo({ left: 0, behavior: 'auto' }); }); await page.waitForTimeout(600);
    must(await page.locator('[data-sp="0"].on').count() === 1, 'swiping back marks «اليوم»');
    await go('vin'); await go('system'); await see('.sysp'); await page.waitForTimeout(500);
    must(await page.locator('[data-sp="0"].on').count() === 1, 'the window seen last opens again');
    log('swiping moves the tabs; the last window opens again');

    // ----- «استعلام سعر»: a part's price and details by barcode, item code or name -----
    await go('system'); await see('.sys-look');
    await page.click('.sys-look'); await page.waitForURL(/#lookup/); await see('#pqq');
    const part = await db(() => { const p = window.__mockdb.products.find(x => x.barcode && x.price != null && x.cost != null && x.qty > 0 && x.status === 'active'); return p && { id: p.id, bar: p.barcode, title: p.title, price: p.price, cost: p.cost, qty: p.qty }; });
    must(part, 'a demo part with a barcode');
    await page.fill('#pqq', part.bar); await page.press('#pqq', 'Enter'); await see('.pq-card');
    must((await text('.pq-name b')) === part.title && digits(await text('.pq-price b')) === String(Math.round(part.price)) && (await text('.pq-rows')).includes(String(part.qty)), 'by its barcode: the name, price and stock');
    must((await text('.pq-rows')).includes('سعر الشراء') && (await text('.pq-rows')).includes('الربح في القطعة'), 'the owner sees the cost and the profit');
    await shot('06-lookup');
    await page.click('#pqagain'); await page.fill('#pqq', 'فلتر'); await page.waitForTimeout(800); await see('#pqres .pres-row');
    const n1 = await page.locator('#pqres .pres-row').count();
    await page.click('#pqres .pres-row'); await see('.pq-card');
    must(n1 >= 2 && /فلتر/.test(await text('.pq-name b')), 'by name: a list, then the part');
    await page.click('#pqsell'); await page.waitForURL(/#pos/); await see('.pline');
    must(/فلتر/.test(await text('.pline')), '«بيعها» puts it on a sales invoice');
    await page.click('#pnew'); await page.waitForTimeout(200);
    log('«استعلام سعر» on the System tab: by barcode the part, its price, stock, cost and profit; by name a list; «بيعها» starts a sales invoice');

    // ----- the Face ID lock -----
    await go('system'); await see('#lkc .lock-row', 8000);
    await page.click('#lkt'); await see('#lkreg', 8000);
    await page.click('#lkreg'); await page.waitForTimeout(900);
    must(/تتحل بـ/.test(await text('#lkc')) && await db(() => localStorage.getItem('sp_sys_lock') !== null), 'Face ID set up on this phone and the lock on');
    await shot('04-lock-card');
    log('the lock: «شغّل القفل» asks for Face ID; none on this phone yet, so «فعّل Face ID» sets it up and turns the lock on');
    await page.reload(); await page.waitForTimeout(1200); await go('system'); await see('.lock-card');
    must(await page.locator('.sysp').count() === 0 && /مقفولة/.test(await text('.lock-card h2')), 'after reopening the app the system is locked');
    await go('invoices'); await see('.lock-card');
    must(await page.locator('.lock-card').count() === 1, 'every page of the system');
    await go(''); await page.waitForTimeout(500);
    must(await page.locator('.lock-card').count() === 0, 'not the store');
    await go('system'); await see('#lkgo');
    await shot('05-locked');
    await page.click('#lkgo'); await see('.sysp', 8000);
    log('reopened: the system and its pages ask for Face ID (the store does not); Face ID opens it');
    await db(() => { const real = Date.now; Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));
      Date.now = () => real() + 61000; Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); window.__realNow = real; });
    await see('.lock-card');
    await db(() => { Date.now = window.__realNow; });
    log('away more than a minute: locked again');
    await page.click('#lkpw'); await see('#lpi'); await page.fill('#lpi', 'nope00'); await page.click('#lpf .btn-signal'); await page.waitForTimeout(500);
    must(/غلط/.test(await text('#lpe')), 'a wrong password');
    await page.fill('#lpi', '123456'); await page.click('#lpf .btn-signal'); await see('.sysp', 8000);
    log('or the password (a wrong one is refused)');
    await see('#lkt'); await page.click('#lkt'); await page.waitForTimeout(400);
    must(await db(() => localStorage.getItem('sp_sys_lock')) === null, 'turned off');
    await page.reload(); await page.waitForTimeout(1200); await go('system'); await see('.sysp');
    log('turned off: the system opens straight away');
    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' SYSTEM CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
