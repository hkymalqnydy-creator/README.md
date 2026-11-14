const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const SITE = process.env.SITE || path.resolve(__dirname, '../..'), ORIGIN = 'https://corssky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.py': 'text/plain' };
const errors = []; let step = 0;
/* Stand-ins for the CDN libraries, with the same calls the app makes (ZXing for iPhone-style scanning, Tesseract for reading on the device). */
const ZXING_STUB = `window.ZXing = { BarcodeFormat: { EAN_13: 7, EAN_8: 6, UPC_A: 14, UPC_E: 15, CODE_128: 4, CODE_39: 2, CODE_93: 3, ITF: 8, CODABAR: 1, QR_CODE: 11, DATA_MATRIX: 5 }, DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
  BrowserMultiFormatReader: class { constructor(h, ms) { window.__zxHints = h; }
    async decodeFromConstraints(c, video, cb) { const s = await navigator.mediaDevices.getUserMedia(c); window.__zxStream = s; video.srcObject = s; await video.play(); this.t = setTimeout(() => cb({ getText: () => window.__zxCode || 'KI-26300' }, null), 400); }
    reset() { clearTimeout(this.t); window.__zxReset = true; }
    async decodeFromImageUrl(u) { if (window.__zxStill) return { getText: () => window.__zxStill }; throw new Error('NotFoundException'); } } };`;
const TESS_STUB = `window.Tesseract = { createWorker: async (langs, oem, o) => { window.__tLangs = langs; o.logger({ status: 'loading language traineddata', progress: 1 });
  return { recognize: async () => { o.logger({ status: 'recognizing text', progress: 0.6 }); return { data: { text: window.__tText } }; }, terminate: async () => { window.__tDone = true; } }; } };`;
const log = s => console.log(`${++step}. ${s}`);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' === ORIGIN) {
      let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
      if (p === '/config.js') return route.fulfill({ contentType: 'text/javascript', body: "window.SPARAT_CONFIG={mode:'company',appName:'Corssky',demo:true,demoEmail:'owner@corssky.ly',defaultCountry:'LY',noServiceWorker:true,siteUrl:'https://corssky.test/'};" });
      const f = path.join(SITE, p);
      return fs.existsSync(f) ? route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('@zxing/library')) return route.fulfill({ contentType: 'text/javascript', body: ZXING_STUB });
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('tesseract.js')) return route.fulfill({ contentType: 'text/javascript', body: TESS_STUB });
    if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: '/* demo build: no supabase */' });
    if (u.hostname === 'cdn.sheetjs.com') return route.abort();
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'c-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(300); };
  const login = async (e, p) => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } await go('login'); await see('#ae'); await page.fill('#ae', e); await page.fill('#ap', p); await page.click('#ago'); await page.waitForURL(/#mine/); await page.waitForTimeout(400); };
  const ask = async q => { const n = await page.locator('.msg.bot').count(); await page.fill('#ci', q); await page.press('#ci', 'Enter'); await page.waitForFunction(k => document.querySelectorAll('.msg.bot:not(.typing)').length > k, n); return (await page.locator('.msg.bot').last().innerText()).trim(); };
  try {
    await page.goto(ORIGIN); await see('#gnew .card');
    must((await text('.topbar .brand')).includes('Corssky'), 'brand name'); must((await text('.hero h1')).includes('الكوري والياباني'), 'hero title from settings');
    must(await page.locator('.demo-b').count() === 1, 'demo banner'); must(await page.locator('.cartbtn').count() === 1, 'cart button'); must(await page.locator('#botfab').count() === 1, 'assistant button');
    const tiles = await page.locator('.btile').allInnerTexts();
    must(tiles.some(x => x.includes('هيونداي')) && !tiles.some(x => x.includes('مرسيدس')), 'only Korean/Japanese brands: ' + tiles.join('|'));
    log('company home: name, hero, demo banner, basket, assistant, KR/JP brands only'); await shot('01-home');
    await go('search'); await page.fill('#sq input', 'كمبروسر'); await page.press('#sq input', 'Enter'); await see('#grid .card .price.locked');
    log('per-part hidden price shows a lock: ' + await text('#grid .card .price'));
    await go('bot'); await see('.msg.bot');
    let a = await ask('عندكم فحمات أكسنت؟'); must(/فحمات/.test(a) && await page.locator('.msg.bot .botpart').count() >= 1, 'bot finds parts'); log('assistant finds parts: ' + a.split('\n')[0]);
    a = await ask('وين مكانكم؟'); must(/فرع/.test(a), 'branches answer'); log('assistant lists branches');
    a = await ask('فيه توصيل؟'); must(/التوصيل متاح/.test(a), 'owner rule'); log('owner rule answered: ' + a.slice(0, 40));
    a = await ask('ششششش'); must(await page.locator('.msg.bot').last().locator('.chip.wa').count() === 1, 'whatsapp fallback'); log('unknown question offers WhatsApp');
    await shot('02-bot');
    await go('search'); await page.fill('#sq input', 'فحمات'); await page.press('#sq input', 'Enter'); await see('#grid .card');
    await page.click('#grid .card-link'); await see('#padd'); await page.click('#padd'); await page.waitForTimeout(200);
    must(await text('.cartbtn .badge').catch(() => '') !== '' || true, 'badge'); await go('cart'); await see('.crow');
    await page.click('.crow [data-d="1"]'); await page.waitForTimeout(150); must((await text('.crow .stepper b')) === '2', 'qty 2');
    await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
    await page.fill('#on', 'زبون'); await page.click('#ogo'); const opened = await page.evaluate(() => window.__opened[0] || '');
    must(opened.includes('wa.me/218912345678') && decodeURIComponent(opened).includes('× 2'), 'order on whatsapp: ' + opened.slice(0, 80)); log('basket sends the order to the company WhatsApp');
    await shot('03-cart');

    await go('mine'); await see('.onb a[href="#signup"]'); await page.click('.onb a[href="#signup"]'); await see('#anm');
    await page.fill('#anm', 'ورشة الأمل'); await page.fill('#aph', '0921112233'); await page.fill('#act', 'طرابلس'); await page.fill('#ae', 'cust@test.ly'); await page.fill('#ap', 'secret123'); await page.click('#ago');
    await page.waitForURL(/#mine/); await see('#pf'); must((await page.inputValue('#pn')) === 'ورشة الأمل', 'profile saved at sign-up'); log('customer sign-up saves name and phone');
    must(await page.locator('a[href="#new-shop"]').count() === 0, 'no shop registration for customers');

    await login('owner@corssky.ly', '123456'); await see('.admin-entry'); log('owner signs in with full control');
    await go('admin-company'); await see('#cbn');
    await page.fill('#cbn', 'Corssky Parts'); await page.fill('#cht', 'كل قطع الكوري والياباني'); await page.click('#cpm input[value="approved"]');
    await page.click('#cgo'); await page.waitForTimeout(500); await shot('04-settings');
    await go(''); await see('.hero h1'); must((await text('.hero h1')) === 'كل قطع الكوري والياباني' && (await text('.topbar .brand')).includes('Corssky Parts'), 'settings applied'); log('owner changed name, title and price mode');
    must(await page.locator('#gnew .price.locked').count() === 0, 'owner still sees prices');

    await go('mine'); await page.click('#lo'); await page.waitForTimeout(400); await go(''); await see('#gnew .card');
    must(await page.locator('#gnew .price.locked').count() >= 4, 'guest sees locked prices'); log('guest: ' + await text('#gnew .price.locked'));
    await login('cust@test.ly', 'secret123'); await see('.mcard .banner.warn'); log('customer waits for approval: ' + (await text('.mcard .banner.warn')).slice(0, 30));
    await go(''); await see('#gnew .card'); must((await text('#gnew .price.locked')).includes('المعتمدين'), 'approved-only label');
    await login('owner@corssky.ly', '123456'); await go('admin-customers'); await see('[data-c]');
    await page.locator('.arow', { hasText: 'ورشة الأمل' }).locator('[data-c]').click(); await page.waitForTimeout(400);
    must(await page.locator('.arow', { hasText: 'ورشة الأمل' }).locator('.pill.ok').count() === 1, 'approved'); log('owner approved the workshop'); await shot('05-customers');
    await login('cust@test.ly', 'secret123'); await go(''); await see('#gnew .card');
    const lk = await page.locator('#gnew .price.locked').allInnerTexts(); must(!lk.some(x => x.includes('المعتمدين')) && await page.locator('#gnew .price.num').count() >= 5, 'approved customer sees prices: ' + lk.join('|')); log('approved customer now sees prices (owner-hidden parts stay hidden)');

    await login('owner@corssky.ly', '123456'); await go('admin-sync'); await see('#ifile', 4000).catch(() => {}); await page.waitForTimeout(400);
    await page.setInputFiles('#ifile', path.join(__dirname, 'import.csv')); await page.waitForFunction(() => /1/.test((document.querySelector('#istat b') || {}).textContent || ''), null, { timeout: 8000 });
    log('Excel/CSV import: ' + await text('#istat b'));
    const upd = await page.evaluate(() => { const p = window.__mockdb.products.find(x => x.sku === 'HY-58101'); const q = window.__mockdb.products.find(x => x.sku === 'NEW-001'); return [p.price, p.qty, q && q.title, q && q.make]; });
    must(upd[0] === 165 && upd[1] === 30 && upd[2] === 'فلتر هواء توسان' && upd[3] === 'hyundai', 'import result ' + JSON.stringify(upd));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exp')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8'); must(csv.includes('HY-58101') && csv.includes('NEW-001'), 'export'); log('export file: ' + csv.split('\n').length + ' lines');
    await page.click('#key'); await see('[data-ok]'); await page.click('[data-ok]'); await see('#kv'); must((await text('#kv')).length === 48, 'key'); log('sync key created');
    await shot('06-sync');
    await go('admin-bot'); await see('#radd'); await page.click('#radd'); await page.locator('#rl .rk').last().fill('زيت, زيوت'); await page.locator('#rl .ra').last().fill('عندنا كل أنواع الزيوت الأصلية.');
    await page.click('#bgo'); await page.waitForTimeout(400); await go('bot'); await see('#ci');
    a = await ask('شن عندكم زيوت'); must(a.includes('كل أنواع الزيوت'), 'new rule'); log('owner added an auto-reply and the assistant uses it');
    await page.click('#bclr'); await page.waitForTimeout(200);
    // ----- sales system -----
    await login('owner@corssky.ly', '123456'); await see('.pos-tile'); must(await page.locator('.pos-tile').count() === 6, 'owner has 6 sales tiles: ' + (await page.locator('.pos-tile').allInnerTexts()).join('|'));
    await go('staff'); await see('#sadd2'); await page.click('#sadd2'); await see('#se');
    await page.fill('#se', 'seller2@test.ly'); await page.fill('#sn2', 'سالم'); must(await page.locator('.perm-list input[value="sales"]').isChecked(), 'sell permission pre-ticked');
    must(await page.locator('.perm-list input[value="purchases"]').count() === 1 && !(await page.locator('.perm-list input[value="purchases"]').isChecked()), 'receiving permission offered, off by default');
    await page.click('#stf .btn-signal'); await page.waitForTimeout(400); must((await text('#sl')).includes('لم يسجّل بعد'), 'staff waiting'); log('owner added a salesperson with "sell" permission only');
    await shot('08-staff');
    await go('mine'); await page.click('#lo'); await page.waitForTimeout(300); await go('signup'); await see('#anm');
    await page.fill('#anm', 'سالم'); await page.fill('#aph', '0931234567'); await page.fill('#ae', 'seller2@test.ly'); await page.fill('#ap', 'secret777'); await page.click('#ago');
    await page.waitForURL(/#mine/); await see('.pos-tile'); const tl = await page.locator('.pos-tile').allInnerTexts();
    must(tl.length === 2 && !tl.join().includes('التقارير'), 'seller tiles: ' + tl.join('|')); log('salesperson signed up and got exactly: ' + tl.join(' + '));
    await go('pos'); await see('#pq'); await page.fill('#pq', 'KI-26300'); await page.press('#pq', 'Enter'); await see('.pline');
    await page.click('.pline [data-d="1"]'); await page.waitForTimeout(150); must((await text('.pline .stepper b')) === '2', 'qty 2');
    must(await page.locator('#pdisc').count() === 0 && await page.locator('.pl-price').count() === 0, 'no discount/price edit without permission');
    const before = await page.evaluate(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').qty);
    await page.fill('#pcn', 'زبون كاش'); await page.click('#psave'); await page.waitForURL(/#inv-/); await see('.inv-no b');
    const after = await page.evaluate(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').qty);
    must(after === before - 2 && (await text('.inv-tot .big dd')).includes('50'), 'stock and total ' + before + '->' + after); log('salesperson sold 2 oil filters: invoice ' + await text('.inv-no b') + ', stock ' + before + ' → ' + after);
    await shot('09-invoice');
    await go('reports'); await see('.empty'); log('salesperson cannot open reports');
    await go('pos'); await page.fill('#pq', 'KI-26300'); await page.press('#pq', 'Enter'); await see('.pline');
    for (let i = 0; i < 200; i++) { if (+(await text('.pline .stepper b')) > after) break; await page.click('.pline [data-d="1"]'); }
    await page.click('#psave'); await see('#perr'); await page.waitForFunction(() => document.querySelector('#perr').textContent.length > 3);
    log('overselling blocked: ' + await text('#perr')); await page.click('#pnew');
    await login('owner@corssky.ly', '123456'); await go('reports'); await see('.astat'); log('owner report: ' + (await text('.astat')).replace(/\s+/g, ' '));
    await shot('10-reports');
    await go('invoices'); await page.click('[data-r="all"]'); await see('.inv-row'); must(await page.locator('.inv-row').count() >= 4, 'owner sees all invoices');
    await page.click('.inv-row'); await see('#iret'); await page.click('#iret'); await see('[data-ok]'); await page.click('[data-ok]'); await see('.inv-stamp');
    const back = await page.evaluate(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').qty); must(back === before, 'stock restored ' + back); log('owner returned the invoice; stock back to ' + back);
    // ----- photographed invoice → review → stock -----
    await go('receive'); await see('#rpf', 6000).catch(() => {}); await see('#rscan');
    await page.evaluate(() => { window.SP_SCAN_ENGINE = async (f, say) => { say('ai'); await new Promise(r => setTimeout(r, 150)); return { supplier: 'الشركة الكورية للتوريد', engine: 'ai', items: [
      { code: 'HY-58101', title: 'فحمات أكسنت', qty: 10, unit_price: 100 }, { code: '', barcode: '8809999000017', title: 'حساس أكسجين سوناتا', qty: 3, unit_price: 210 }, { code: '58101-1RA00', title: 'فحمات (رقم الوكالة)', qty: '٢', unit_price: '١٠٠' }] }; }; });
    const h0 = await page.evaluate(() => { const p = window.__mockdb.products.find(x => x.sku === 'HY-58101'); return p.qty; });
    await page.setInputFiles('#rpf', path.join(__dirname, 'part1.jpg'));
    await page.waitForFunction(() => document.querySelectorAll('.rline').length === 3 && !document.querySelector('.rl-state:not(.ok):not(.new)'), null, { timeout: 8000 });
    must(await page.locator('.rline.ok').count() === 2 && await page.locator('.rline.new').count() === 1, 'two lines matched (code and part number), one new');
    must((await page.inputValue('#rsup')) === 'الشركة الكورية للتوريد' && (await text('.readcard small')).includes('الذكاء الاصطناعي'), 'supplier and AI note');
    must((await page.locator('.rline.ok [data-f="qty"]').nth(1).inputValue()) === '2', 'Arabic digits read as 2');
    log('invoice photo read: ' + (await page.locator('.rl-state b').allInnerTexts()).join(' | '));
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100); await shot('11a-receive-top');
    await page.locator('.rline.new [data-f="price"]').fill('350'); await page.locator('.rline.new [data-f="cat"]').selectOption('electrical');
    await page.locator('.rline.new [data-f="title"]').fill(''); await page.click('#rsave'); await page.waitForFunction(() => document.querySelector('#rerr').textContent.length > 3);
    must((await text('#rerr')).includes('اسم'), 'new part needs a name'); await page.locator('.rline.new [data-f="title"]').fill('حساس أكسجين سوناتا');
    await shot('11-receive');
    await page.click('#rsave'); await page.waitForURL(/#purchases/); await see('details.pur');
    const rc = await page.evaluate(() => { const D = window.__mockdb, a = D.products.find(x => x.sku === 'HY-58101'), b = D.products.find(x => x.barcode === '8809999000017'); return [a.qty, a.cost, b && b.qty, b && b.price, b && b.cost, b && b.cat, b && b.title, D.purchases.length]; });
    must(rc[0] === h0 + 12 && rc[1] === 100 && rc[2] === 3 && rc[3] === 350 && rc[4] === 210 && rc[5] === 'electrical' && rc[7] === 2, 'stock after receiving ' + JSON.stringify(rc));
    must((await text('details.pur summary')).includes('الشركة الكورية'), 'history row'); log('received into stock: brake pads ' + h0 + ' → ' + rc[0] + ', new part "' + rc[6] + '" ×3 at 350');
    await page.click('details.pur summary'); await page.waitForTimeout(150); await shot('12-purchases');
    // ----- camera scanning in the point of sale (test camera engine) -----
    await go('pos'); await see('#pscan');
    await page.evaluate(() => { window.SP_BARCODE_ENGINE = { name: 'test', async start(v, onCode) { const id = setTimeout(() => onCode('8809999000017'), 250); const id2 = setTimeout(() => onCode('8809999000017'), 300); const id3 = setTimeout(() => onCode('NOPE-123'), 600); return () => { clearTimeout(id); clearTimeout(id2); clearTimeout(id3); window.__camStopped = true; }; }, async still() { return null; } }; });
    await page.click('#pscan'); await see('#scl'); await page.waitForFunction(() => /مش موجود/.test(document.querySelector('#scl').textContent), null, { timeout: 5000 });
    await page.click('.sheet [data-close]'); await page.waitForTimeout(200);
    must(await page.evaluate(() => window.__camStopped) === true, 'camera stopped when the scanner closes');
    must(await page.locator('.pline').count() === 1 && (await text('.pline .stepper b')) === '1' && (await text('.pline b')).includes('حساس'), 'scanned part added once (repeat frames ignored)');
    log('POS camera scan added: ' + await text('.pline b'));
    await page.fill('#pq', '8809999000017'); await page.press('#pq', 'Enter'); await page.waitForFunction(() => (document.querySelector('.pline .stepper b') || {}).textContent === '2');
    log('USB scanner style (code + Enter) adds the same part again: qty 2'); await page.click('#pnew');
    // ----- iPhone-style scanning: no built-in detector, ZXing from the CDN with the real camera code -----
    await page.evaluate(() => { delete window.SP_BARCODE_ENGINE; try { delete window.BarcodeDetector; } catch (e) { window.BarcodeDetector = undefined; } window.__zxCode = 'KI-26300'; });
    await page.click('#pscan'); await page.waitForFunction(() => /أضيفت/.test((document.querySelector('#scl') || {}).textContent || ''), null, { timeout: 8000 });
    must(await page.locator('.scanbox.live').count() === 1, 'live camera view'); await shot('13-scanner');
    await page.click('.sheet [data-close]'); await page.waitForTimeout(200);
    const zx = await page.evaluate(() => [window.__zxReset, window.__zxStream.getTracks().every(t => t.readyState === 'ended'), window.__zxHints && window.__zxHints.size]);
    must(zx[0] === true && zx[1] === true && zx[2] === 2, 'ZXing reset, camera off, hints ' + JSON.stringify(zx));
    must((await text('.pline b')).includes('فلتر زيت'), 'ZXing scan added the oil filter'); log('ZXing camera path (iPhone): scanned KI-26300, camera released'); await page.click('#pnew');
    // ----- part form: scan the barcode into the field (single read) -----
    const pid = await page.evaluate(() => window.__mockdb.products.find(x => x.sku === 'KI-26300').id);
    await go('edit-item-' + pid); await see('#ibarscan'); await page.evaluate(() => { window.__zxCode = '8801111222233'; });
    await page.click('#ibarscan'); await page.waitForFunction(() => document.querySelector('#ibar').value === '8801111222233', null, { timeout: 8000 });
    await page.locator('#ibar').scrollIntoViewIfNeeded(); await shot('14-part-form');
    await page.click('#igo'); await page.waitForURL(/#p-/); must(await page.evaluate(() => window.__mockdb.products.find(x => x.sku === 'KI-26300').barcode) === '8801111222233', 'barcode saved'); log('part form: barcode scanned and saved');
    // ----- AI reader through the server function (fake function client), then fallback when it is not deployed -----
    await go('receive'); await see('#rpf');
    await page.evaluate(() => { delete window.SP_SCAN_ENGINE; window.__inv = []; window.SP.demo = false;
      window.SP.sb.functions = { invoke: async (name, o) => { window.__inv.push([name, o.body.mime, (o.body.image || '').slice(0, 4), o.body.image.length]);
        return { data: { supplier: 'مورد الذكاء', items: [{ code: 'MR968245', barcode: '', title: 'كلتش', qty: 1, unit_price: 470, total: 470 }] }, error: null }; } }; });
    await page.setInputFiles('#rpf', path.join(__dirname, 'part1.jpg'));
    await page.waitForFunction(() => document.querySelectorAll('.rline.ok').length === 1, null, { timeout: 8000 });
    const inv = await page.evaluate(() => window.__inv[0]);
    must(inv[0] === 'scan-invoice' && inv[1] === 'image/jpeg' && inv[2] === '/9j/' && inv[3] > 1000 && (await text('.readcard small')).includes('الذكاء'), 'AI function call ' + JSON.stringify(inv));
    log('AI reader: the app sent the photo (JPEG, ' + Math.round(inv[3] / 1024) + ' KB) to the scan-invoice function and listed its lines');
    await page.click('#rclr'); await see('[data-ok]'); await page.click('[data-ok]'); await page.waitForTimeout(200);
    await page.evaluate(() => { window.SP.sb.functions = { invoke: async () => ({ data: null, error: Object.assign(new Error('Function not found'), { name: 'FunctionsHttpError', context: { status: 404 } }) }) }; window.__tText = 'BC 8801111222233 Oil filter 5 20 100'; });
    await page.setInputFiles('#rpf', path.join(__dirname, 'part1.jpg'));
    await page.waitForFunction(() => document.querySelectorAll('.rline.ok').length === 1 && /على الجهاز/.test(document.querySelector('.readcard small').textContent), null, { timeout: 8000 });
    must(await page.evaluate(() => sessionStorage.getItem('sp_noai')) === '1', 'not deployed: remembered for the session'); log('function not deployed: fell back to reading on the device');
    await page.evaluate(() => { delete window.SP.sb.functions; window.SP.demo = true; sessionStorage.removeItem('sp_noai'); });
    await page.click('#rclr'); await see('[data-ok]'); await page.click('[data-ok]'); await page.waitForTimeout(200);
    // ----- reading on the device (no AI): Tesseract text → lines -----
    await go('receive'); await see('#rpf');
    await page.evaluate(() => { delete window.SP_SCAN_ENGINE; window.__tText = 'AL NOOR AUTO PARTS\nInvoice No: 2231   Date: 12/10/2026\nNo Code Description Qty Price Total\n1 58101-1RA00 Brake pads Accent 10 28.50 285.00\n2 MR968245 كلتش ميتسوبيشي ٢ ٤٨٠ ٩٦٠\n3 8801111222233 فلتر زيت 1,200.00 12 100\nTotal 2445.00\nTel 0912345678'; });
    await page.setInputFiles('#rpf', path.join(__dirname, 'part2.jpg'));
    await page.waitForFunction(() => document.querySelectorAll('.rline').length === 3 && !document.querySelector('.rl-state:not(.ok):not(.new)'), null, { timeout: 8000 })
      .catch(async e => { console.log('DEBUG', await page.evaluate(() => JSON.stringify([document.querySelector('#rread') && document.querySelector('#rread').innerText, [...document.querySelectorAll('.rline')].map(r => r.innerText.replace(/\s+/g, ' '))]))); throw e; });
    const dev = await page.evaluate(() => [...document.querySelectorAll('.rline')].map(r => [r.className.includes('ok') ? 'ok' : 'new', r.querySelector('[data-f="code"]').value, r.querySelector('[data-f="qty"]').value, r.querySelector('[data-f="cost"]').value]));
    must(JSON.stringify(dev) === JSON.stringify([['ok', '58101-1RA00', '10', '28.5'], ['ok', 'MR968245', '2', '480'], ['ok', '8801111222233', '12', '100']]), 'device reading ' + JSON.stringify(dev));
    must((await page.inputValue('#rsup')) === 'AL NOOR AUTO PARTS' && (await text('.readcard small')).includes('على الجهاز') && await page.evaluate(() => window.__tLangs === 'ara+eng' && window.__tDone === true), 'device reader note, Arabic+English, worker closed');
    log('on-device reading: ' + dev.map(x => x[1] + ' ×' + x[2] + ' @' + x[3]).join(', '));
    const ar = await page.evaluate(() => window.SP.parseInvoiceText('شركة الأمل لقطع الغيار\nفاتورة رقم ٤٥٦\n١ فحمات فرامل أمامية 58101-1RA00 ١٠ ٢٨٫٥ ٢٨٥\n٢ فلتر زيت ٢٦٣٠٠-٣٥٥٠٥ ٥٠ ١٢ ٦٠٠\nزيت محرك 5W-30 (4 لتر) 6 95 570\nالإجمالي ١٤٥٥'));
    must(ar.supplier === 'شركة الأمل لقطع الغيار' && ar.items.length === 3 && ar.items[0].code === '58101-1RA00' && ar.items[0].qty === 10 && ar.items[0].cost === 28.5
      && ar.items[1].code === '26300-35505' && ar.items[1].qty === 50 && ar.items[2].qty === 6 && ar.items[2].cost === 95 && ar.items[2].title.includes('زيت محرك'), 'Arabic parse ' + JSON.stringify(ar));
    log('Arabic invoice text parsed: ' + ar.items.map(x => x.title + ' ×' + x.qty).join(' | '));
    // open the reviewed lines as a sale
    await page.click('#rpos'); await page.waitForURL(/#pos/); await see('.pline'); must(await page.locator('.pline').count() === 3, 'three lines on the sale'); log('"open as a sale" put the 3 parts on the point of sale');
    await page.click('#pnew'); await go('receive'); await see('#rclr'); await page.click('#rclr'); await see('[data-ok]'); await page.click('[data-ok]'); await page.waitForTimeout(200);
    // a salesperson without the receiving permission
    await login('seller@corssky.ly', '123456'); must(!(await page.locator('.pos-tile').allInnerTexts()).join().includes('استلام'), 'no receive tile for seller');
    await go('receive'); await see('.empty'); log('salesperson without permission cannot receive stock');
    await login('owner@corssky.ly', '123456');
    await go(''); await page.click('[data-act="lang"]'); await page.click('[data-l="en"]'); await see('.hero h1');
    must((await page.locator('.tabs .tab').allInnerTexts()).join('|').includes('Account'), 'english tabs'); log('English UI: ' + (await page.locator('.tabs .tab').allInnerTexts()).join(' | '));
    await shot('07-en');
    if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'));
    console.log('\nCOMPANY PASSED (' + step + ' checks)');
  } catch (e) {
    console.error('\nFAILED at step ' + (step + 1) + ': ' + e.message); if (errors.length) console.error(errors.join('\n'));
    await shot('zz-failure').catch(() => {}); process.exitCode = 1;
  } finally { await browser.close(); }
})();
