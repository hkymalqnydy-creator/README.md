// The edition that starts empty (tools/build_company.py --empty-stock, config demoEmpty): no parts, no sales, no money moves.
// Customers see a store waiting for its parts, staff are sent to bring their stock in, every page of the System opens with
// nothing in it, and the first purchase and the first sale work (purchase 1, invoice 1001).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const ADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/ads.json'), 'utf8')).map(a => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))));
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmpty:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoAds:${JSON.stringify(ADS)},demoExtra:${JSON.stringify(EXTRA)},brands:[]};`;
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
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'empty-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const out = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const signIn = async (by, who) => { await out(); await go('login'); await see('#ap'); await page.click(`[data-by="${by}"]`); await page.fill(by === 'phone' ? '#alp' : '#ae', who); await page.fill('#ap', '123456'); await page.locator('#ap').press('Enter'); await page.waitForTimeout(1200); };
  const clean = (m) => { must(!errors.length, m + ': ' + errors.join(' | ')); };
  try {
    await page.goto(ORIGIN); await see('#gnew .empty', 15000);
    const ED = await db(() => ({ email: window.SPARAT_CONFIG.demoEmail, ads: (window.SPARAT_CONFIG.demoAds || []).length }));   // the edition built into SITE
    const d0 = await db(() => { const D = window.__mockdb; return { p: D.products.length, i: D.invoices.length, b: D.purchases.length, m: D.stock_moves.length, e: D.expenses.length, a: D.activity.length,
      st: D.staff.map(x => x.perms.join('+')), sh: D.shops.length, c: D.customers.length, ads: (D.settings.ads || []).length }; });
    must(!d0.p && !d0.i && !d0.b && !d0.m && !d0.e && !d0.a, 'nothing in stock and nothing sold, bought or spent: ' + JSON.stringify(d0));
    must(d0.sh === 3 && d0.c >= 2 && d0.st.includes('warehouse') && d0.st.some(x => x.includes('sales')) && d0.ads === ED.ads, 'the branches, staff, merchants and ads stay: ' + JSON.stringify(d0));
    must(/ما فيش قطع بعد/.test(await text('#gnew .empty')) && !(await page.locator('#gnew .card').count()), 'a customer sees the parts are coming');
    must(/^https:\/\/wa\.me\/218912345678\?text=/.test(await page.getAttribute('#gnew .empty a.btn-wa', 'href') || ''), 'and asks for the part he needs on the company\'s WhatsApp');
    await page.locator('#gnew').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await shot('01-home');
    await go('cats'); await see('.catrow'); await go('search?q=' + encodeURIComponent('فلتر')); await page.waitForTimeout(700);
    must(!(await page.locator('.card').count()), 'a search finds nothing');
    clean('the store and a search with no parts');
    log('a customer: an empty store that says the parts are coming; the store and a search open with nothing in them');
    await signIn('email', ED.email);
    await go(''); await see('#gnew .empty');
    must(await page.locator('#gnew .empty a[href="#receive"]').count() === 1, 'staff are sent to bring their stock in');
    await page.locator('#gnew').scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await shot('02-home-owner');
    const pages = ['system', 'pos', 'receive', 'lookup', 'invoices', 'purchases', 'orders', 'picks', 'reports', 'staff', 'stock', 'merchants', 'buyers', 'suppliers', 'expenses', 'pnl', 'admin', 'admin-log', 'admin-control'];
    for (const h of pages) { await go(h); await page.waitForTimeout(350); must(await page.locator('main').count() >= 1, 'page ' + h); clean('page ' + h); }
    await go('pnl'); await page.waitForTimeout(500); await shot('03-pnl');
    log('the owner: home sends him to a purchase invoice; every page of the System opens empty: ' + pages.length + ' pages');
    // the first part comes in with a purchase invoice
    await go('receive'); await see('#rq');
    await page.click('#radd'); await page.waitForTimeout(200); await page.keyboard.type('فلتر هواء أكسنت');
    const nl = page.locator('#rlines .rline.new').first();
    await nl.locator('[data-f="cost"]').fill('30'); await nl.locator('[data-f="price"]').fill('45'); await nl.locator('[data-f="qty"]').first().fill('10');
    await page.fill('#rsup', 'الشركة الكورية للتوريد'); await page.click('#rsave'); await page.waitForURL(/#pur-/);
    const p1 = await db(() => { const D = window.__mockdb, p = D.products[0]; return { n: D.products.length, title: p && p.title, qty: p && p.qty, price: p && p.price, pur: D.purchases.map(v => v.no) }; });
    must(p1.n === 1 && p1.title === 'فلتر هواء أكسنت' && p1.qty === 10 && p1.price === 45 && p1.pur.join() === '1', 'the first part and purchase 1: ' + JSON.stringify(p1));
    await go(''); await see('#gnew .card');
    must(await page.locator('#gnew .card').count() === 1, 'the part shows on the home screen');
    log('the first purchase: purchase 1 brings in the first part, and it shows on the home screen');
    // and the first sale
    await go('pos'); await see('#pq');
    await page.fill('#pq', 'فلتر هواء'); await page.waitForTimeout(900);
    if (await page.locator('#pres .pres-row').count()) { await page.click('#pres .pres-row'); await page.waitForTimeout(400); }
    await see('#psave'); await page.click('#psave'); await page.waitForURL(/#inv-/, { timeout: 8000 });
    const s1 = await db(() => { const D = window.__mockdb; return { nos: D.invoices.map(v => v.no), qty: D.products[0].qty, log: D.activity.map(x => x.kind) }; });
    must(s1.nos.join() === '1001' && s1.qty === 9 && s1.log.includes('receive') && s1.log.includes('sale'), 'invoice 1001, one part out of stock, both in the log: ' + JSON.stringify(s1));
    await page.waitForTimeout(600); await shot('04-invoice');
    clean('the first purchase and sale');
    log('the first sale: invoice 1001, the stock goes down by one, the log has both');
  } catch (e) {
    console.error('FAIL', e.message); await shot('fail').catch(() => {}); await browser.close(); process.exit(1);
  }
  await browser.close();
  console.log(`ALL ${step} EMPTY-EDITION CHECKS PASSED`);
})();
