// The purchase invoice: written on the blue band (photo or barcodes), its details (the supplier picked from the ones bought from, his own
// invoice number, the branch, how it was paid), each line with the part's picture and what it costs, the total as the bottom of a
// receipt with what is still owed; saved, it opens as paper with the «وارد» stamp, the supplier's account, print, WhatsApp and cancel.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const ADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/ads.json'), 'utf8')).map(a => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))));
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoAds:${JSON.stringify(ADS)},demoExtra:${JSON.stringify(EXTRA)},brands:[]};`;
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
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'pur-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const num = s => Number((String(s).match(/\d[\d,]*(?:\.\d+)?/) || ['NaN'])[0].replace(/,/g, ''));
  const confirm = async () => { await see('[data-ok]'); await page.click('[data-ok]'); await page.waitForTimeout(350); };
  const out = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const signIn = async who => { await out(); await go('login'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await page.fill('#ae', who); await page.fill('#ap', '123456'); await page.locator('#ap').press('Enter'); await page.waitForTimeout(1200); };
  try {
    await page.goto(ORIGIN); await page.waitForTimeout(1200);
    await signIn('owner@crossky.ly');
    await go('receive'); await see('#rq');
    must(await page.locator('.rcv-band #rphoto').count() === 1 && await page.locator('.rcv-band #rscan').count() === 1 && /فاتورة شراء جديدة/.test(await text('.rcv-band')), 'the blue band: a new purchase invoice, the photo and the barcodes');
    await page.waitForFunction(() => document.querySelectorAll('#rsupl option').length >= 2);
    must((await page.locator('#rsupl option').evaluateAll(o => o.map(x => x.value))).includes('الشركة الكورية للتوريد'), 'the suppliers already bought from are offered');
    await shot('01-receive');
    log('a new purchase invoice: the photo and the barcodes on the blue band; the suppliers already bought from are offered by name');
    // a part from the catalog: its picture, its cost, and what the line costs
    const cost = await db(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').cost);
    await page.fill('#rq', 'KI-26300'); await page.press('#rq', 'Enter'); await see('#rlines .rline.ok');
    must(await page.locator('#rlines .rline.ok .rl-pic img').count() === 1 && await page.locator('#rlines .rline.ok .rl-badge').count() === 1, 'the part shows its picture, with a tick');
    must(num(await text('#rlines .rline.ok [data-lt]')) === cost, 'the line costs ' + cost);
    await page.locator('#rlines .rline.ok [data-f="qty"]').fill('3');
    must(num(await text('#rlines .rline.ok [data-lt]')) === cost * 3 && await text('#rnu') === '3' && num(await text('#rtot')) === cost * 3, 'three of them: the line and the total follow the typing');
    // a new part by hand
    await page.click('#radd'); await page.waitForTimeout(200); await page.keyboard.type('حساس حرارة جديد');
    const nl = page.locator('#rlines .rline.new').first();
    await nl.locator('[data-f="qty"]').fill('2'); await nl.locator('[data-f="cost"]').fill('40'); await nl.locator('[data-f="price"]').fill('65');
    must(num(await nl.locator('[data-lt]').innerText()) === 80 && await nl.locator('.rl-pic .ic').count() >= 1, 'the new part: a picture of its section, and 2 × 40 = 80');
    const total = cost * 3 + 80;
    must(num(await text('#rtot')) === total && await text('#rnl') === '2' && await text('#rnu') === '5', 'the total box: 2 items, 5 parts, ' + total);
    log('lines: the catalog part with its picture and a tick, the new one with a plus; each line says what it costs; the box adds them up');
    // the details: the supplier and his own invoice number, part paid
    await page.fill('#rsup', 'شركة الأمانة للتوريد'); await page.fill('#rsno', 'A-1009');
    await page.click('label[for="rpay2"]'); await page.waitForTimeout(150); await page.fill('#rpaid', '50');
    must(num(await text('#rpaysum .prow:not(.owe) b')) === 50 && num(await text('#rpaysum .prow.owe b')) === total - 50, 'part paid: 50 now, ' + (total - 50) + ' still owed');
    await page.click('label[for="rpay1"]'); await page.waitForTimeout(150);
    must(num(await text('#rpaysum .prow.owe b')) === total, 'on credit: all of it owed');
    await page.click('label[for="rpay2"]'); await page.waitForTimeout(150); await page.fill('#rpaid', '50');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(150); await shot('02-total');
    log('part paid: the box says what was paid and what is still owed to the supplier (all of it on credit)');
    await page.click('#rsave'); await page.waitForURL(/#pur-/); await see('#pur-doc');
    const id = await db(() => location.hash.slice(5)), doc = await text('#pur-doc');
    must(doc.includes('شركة الأمانة للتوريد') && doc.includes('A-1009') && doc.includes('حساس حرارة جديد') && doc.includes('فلتر زيت'), 'the paper: the supplier, his number, the two lines');
    must(await page.locator('#pur-doc .pur-stamp.part').count() === 1 && /وارد/.test(await text('.pur-stamp')) && /دفع جزء/.test(await text('.pur-stamp')), 'the «وارد» stamp, red: part paid');
    must(await page.locator('#pur-doc tbody tr').count() === 2 && await page.locator('#pur-doc thead th').count() === 4 && await page.locator('#pur-doc tbody .pill.new').count() === 1, 'two lines with cost and total, the new part marked');
    must(num(await text('#pur-doc .inv-tot .big dd')) === total && num(await text('#pur-doc .inv-tot .owe dd')) === total - 50 && await page.locator('#pur-doc .pur-sign span').count() === 2, 'the total, what is owed, two places to sign');
    must(/عليك/.test(await text('#psup')) && (await page.getAttribute('#psup', 'href')).startsWith('#supplier-') && await page.locator('#pprint').count() === 1 && await page.locator('#pundo').count() === 1, 'the supplier account, print and cancel');
    const wa = decodeURIComponent((await page.getAttribute('#psh', 'href')).split('text=')[1] || '');
    must(wa.includes('فاتورة شراء رقم') && wa.includes('A-1009') && wa.includes('حساس حرارة جديد × 2'), 'WhatsApp: the invoice as text');
    await shot('03-invoice');
    log('saved, it opens as paper: the supplier and his number, the red «وارد · دفع جزء» stamp, the lines (the new one marked), owed ' + (total - 50) + ', two signatures; the supplier account, print, WhatsApp, cancel');
    // the supplier's page lists it and opens it again
    await page.click('#psup'); await see('#spay');
    must(await page.locator(`a[href="#pur-${id}"]`).count() === 1, 'the supplier page links to the invoice');
    await page.click(`a[href="#pur-${id}"]`); await page.waitForURL(/#pur-/); await see('#pur-doc');
    log('the supplier account lists the invoice and opens it again');
    // the list: a row for each, found by the supplier's own number
    await go('purchases'); await see('#pl .pur-row');
    const row = page.locator(`#pl a.pur-row[href="#pur-${id}"]`);
    must(await row.count() === 1 && /فاتورته/.test(await row.innerText()) && (await row.innerText()).includes('A-1009') && await row.locator('.pill').count() === 1, 'its row: the supplier number and what is owed');
    await page.fill('#puf input', 'a1009'); await page.press('#puf input', 'Enter'); await page.waitForTimeout(700);
    must(await page.locator('#pl .pur-row').count() === 1, 'found by the supplier invoice number');
    await page.fill('#puf input', ''); await page.press('#puf input', 'Enter'); await page.waitForTimeout(500);
    log('purchase invoices: one row each with the supplier number and what is owed, found by that number');
    // a staff member who enters purchases but does not see costs: the parts and quantities only
    await db(async () => { const r = await window.SP.sb.rpc('save_staff', { p_email: 'seller@crossky.ly', p_name: 'أحمد (بائع)', p_perms: ['sales', 'returns', 'discounts', 'purchases'], p_branch: null, p_active: true, p_max_discount: 10 }); if (r.error) throw r.error; });
    await signIn('seller@crossky.ly');
    await go('pur-' + id); await see('#pur-doc');
    must(await page.locator('#pur-doc thead th').count() === 2 && await page.locator('#pur-doc .inv-tot .big').count() === 0 && await page.locator('.pur-stamp.in').count() === 1, 'no money: the parts and how many, the stamp without the payment');
    must(await page.locator('#psup').count() === 0 && await page.locator('#pundo').count() === 0, 'no supplier account, and not his to cancel');
    log('a seller who enters purchases without the costs permission: the parts and quantities only, nothing to cancel');
    // taken back from its page
    await signIn('owner@crossky.ly');
    const before = await db(() => ({ n: window.__mockdb.purchases.length, q: window.__mockdb.products.find(p => p.sku === 'KI-26300').qty }));
    await go('pur-' + id); await see('#pundo'); await page.click('#pundo'); await confirm(); await page.waitForURL(/#purchases$/);
    const after = await db(() => ({ n: window.__mockdb.purchases.length, q: window.__mockdb.products.find(p => p.sku === 'KI-26300').qty, made: window.__mockdb.products.some(p => p.title === 'حساس حرارة جديد') }));
    must(after.n === before.n - 1 && after.q === before.q - 3 && !after.made, 'taken back: ' + JSON.stringify([before, after]));
    await go('pur-' + id); await see('.empty'); must(/مش موجودة/.test(await text('main')), 'its page says it is gone');
    log('cancelled from its page: the stock goes back, the new part is removed, the page says the invoice is gone');
    if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'));
  } catch (e) {
    console.error('FAIL', e.message); await shot('fail').catch(() => {}); await browser.close(); process.exit(1);
  }
  await browser.close();
  console.log(`ALL ${step} PURCHASE INVOICE CHECKS PASSED`);
})();
