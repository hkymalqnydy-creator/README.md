// The warehouse: where each part is kept, every new invoice waiting for the warehouse employee (يوسف, store@…), the lines
// with their shelf and bin, ticked and «تم التجهيز»; the owner sees who prepared it.
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
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'wh-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const out = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const signIn = async (who) => { await out(); await go('login'); await see('#ap'); await page.click('[data-by="email"]'); await page.fill('#ae', who); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/); };
  const toast = async re => { for (let i = 0; i < 40; i++) { const tx = await page.locator('.toast').allInnerTexts().catch(() => []); if (tx.some(x => re.test(x))) return true; await page.waitForTimeout(100); } return false; };
  try {
    await page.goto(ORIGIN); await page.waitForTimeout(1200);
    await signIn('owner@crossky.ly');
    // the owner: where a part is kept, on its page and in the price lookup; the warehouse permission for staff
    const kia = await db(() => { const p = window.__mockdb.products.find(x => x.sku === 'KI-26300'); return { id: p.id, loc: p.location }; });
    must(/^رف [A-D]\d · خانة \d+$/.test(kia.loc), 'every demo part has its place: ' + kia.loc);
    await go('edit-item-' + kia.id); await see('#iloc');
    await page.fill('#iloc', 'رف K1 · خانة 4'); await page.click('#igo'); await page.waitForTimeout(800);
    must(await db(id => window.__mockdb.products.find(x => x.id === id).location, kia.id) === 'رف K1 · خانة 4', 'the place saved from the part page');
    await go('lookup'); await see('#pqq'); await page.fill('#pqq', 'KI-26300'); await page.press('#pqq', 'Enter'); await see('.pq-card');
    must((await text('.pq-rows')).includes('رف K1 · خانة 4'), 'the price lookup says where it is kept');
    await go('staff'); await see('#sadd2'); await page.click('#sadd2'); await see('#se');
    must(await page.locator('.perm-list input[value="warehouse"]').count() === 1 && /المخزن/.test(await page.locator('.perm-list label:has(input[value="warehouse"])').innerText()), 'a warehouse permission for staff');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    log('where a part is kept: on the part page, in the price lookup; staff can get the warehouse permission');
    // a purchase: a part already in stock shows where it goes; a new part gets its place
    await go('receive'); await see('#rq');
    await page.fill('#rq', 'KI-26300'); await page.waitForTimeout(900);
    if (await page.locator('#rres .pres-row').count()) { await page.click('#rres .pres-row'); await page.waitForTimeout(400); } // an exact code goes in by itself
    await see('#rlines .rline.ok');
    must((await text('#rlines .rline.ok .rl-loc')).includes('رف K1 · خانة 4'), 'a matched line says where it goes');
    await page.click('#radd'); await page.waitForTimeout(200); await page.keyboard.type('حساس أكسجين خلفي');
    const nl = page.locator('#rlines .rline.new').first();
    await nl.locator('[data-f="cost"]').fill('50'); await nl.locator('[data-f="location"]').fill('رف E1 · خانة 3');
    await page.fill('#rsup', 'شركة الوفاء لقطع الغيار'); await page.click('#rsave'); await page.waitForURL(/#purchases/);
    must(await db(() => (window.__mockdb.products.find(p => p.title === 'حساس أكسجين خلفي') || {}).location) === 'رف E1 · خانة 3', 'the new part was made with its place');
    log('a purchase: the part already in stock says where it goes; a new part entered by hand gets its place');
    // a sale at the till goes to the warehouse
    await go('pos'); await see('#pq'); await page.fill('#pq', 'KI-26300'); await page.press('#pq', 'Enter'); await see('.pline');
    await page.waitForTimeout(700); // the search that follows typing must not put it on a second time
    must(await db(() => JSON.parse(sessionStorage.getItem('sp_pos')).lines.map(l => l.qty).join()) === '1', 'a code and Enter (a barcode scanner) go on once');
    await page.click('.pline [data-d="1"]'); await page.waitForTimeout(150);
    await page.click('#psave'); await page.waitForURL(/#inv-/); await see('#invoice');
    const inv = await db(() => { const v = window.__mockdb.invoices[window.__mockdb.invoices.length - 1]; return { id: v.id, no: v.no, st: v.pick_state }; });
    must(inv.st === 'waiting' && /تستنى التجهيز/.test(await text('main')), 'the new invoice waits in the warehouse, and its page says so');
    await go('system'); await see('.pos-tile[href="#picks"]'); await page.waitForTimeout(600);
    log('a sale at the till (a code and Enter go on once; 2 × KI-26300) goes to the warehouse: its page says «تستنى التجهيز»; the owner has «تجهيز الفواتير»');
    // يوسف, the warehouse employee
    await signIn('store@crossky.ly');
    await go('system'); await see('.sys-act[href="#picks"]');
    must(await page.locator('.sys-act').count() === 1 && await page.locator('.sys-act[href="#pos"]').count() === 0, 'his first button: «تجهيز الفواتير», and no selling');
    await page.waitForTimeout(800);
    const nb = await page.locator('#tabs a[href="#system"] .nbadge').innerText().catch(() => '');
    must(+nb >= 1, 'a count on the System tab: ' + nb);
    await page.click('.sys-act[href="#picks"]'); await page.waitForURL(/#picks/); await see('.pk-card');
    must((await page.locator('.pk-card').allInnerTexts()).some(x => x.includes(String(inv.no))), 'the sale is in his list');
    await shot('01-list');
    await page.click('.pk-card[href="#pick-' + inv.id + '"]'); await see('.pk-line');
    must((await text('.pk-line .pk-loc')).includes('رف K1 · خانة 4') && /× 2/.test(await text('.pk-line .pk-qty')) && (await text('.pk-line')).includes('KI-26300'), 'the line: where it is, how many, its code');
    await page.click('.pk-line [data-tick]'); await page.waitForTimeout(400);
    must(await page.locator('.pk-line.got').count() === 1 && /1 من 1/.test(await text('.pk-prog')), 'ticked');
    await shot('02-sheet');
    await page.click('#pkdone'); must(await toast(/تجهزت الفاتورة رقم/), 'prepared'); await page.waitForURL(/#picks$/);
    must(await db(id => window.__mockdb.invoices.find(v => v.id === id).pick_state, inv.id) === 'done', 'done in the books');
    await page.click('[data-pt="done"]'); await see('.pk-card.done');
    must((await text('.pk-card.done')).includes('يوسف'), 'in «تجهزت», by him');
    log('يوسف (warehouse only): one button «تجهيز الفواتير» and a count on the tab; the sale with the shelf and bin of each part; ticks it; «تم التجهيز»');
    // a new invoice from another phone: a word for him
    await go('mine'); await page.waitForTimeout(500);
    const no2 = await db(id => { const D = window.__mockdb, v = D.invoices.find(x => x.id === id), no = ++D.inv_seq;
      D.invoices.push({ ...v, id: crypto.randomUUID(), no, created_at: new Date().toISOString(), pick_state: 'waiting', picked_at: null, picked_name: '' });
      document.dispatchEvent(new Event('visibilitychange')); return no; }, inv.id);
    must(await toast(new RegExp('فاتورة جديدة للتجهيز رقم ' + no2)), 'a word when a new invoice comes');
    await go('picks'); await see('.pk-card');
    must((await page.locator('.pk-card').allInnerTexts()).some(x => x.includes(String(no2))), 'and it is in his list');
    log('a new invoice from the till while he is elsewhere: «فاتورة جديدة للتجهيز رقم …», and it is in his list');
    // the owner sees who prepared it
    await signIn('owner@crossky.ly'); await go('inv-' + inv.id); await see('#invoice');
    must(/تجهزت في المخزن: يوسف/.test(await text('main')), 'the invoice page: prepared by يوسف');
    await go('admin-log'); await page.waitForTimeout(600);
    must((await text('main')).includes('جهّز الفاتورة ' + inv.no), 'in the activity log');
    log('the owner: the invoice says «تجهزت في المخزن: يوسف», and the activity log has it');
    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' WAREHOUSE CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
