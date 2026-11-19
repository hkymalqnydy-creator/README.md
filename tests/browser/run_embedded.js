// In-app page edition (tools/build_artifact.py): the app as a page inside the Claude app. Served here under the page
// frame's content security policy (from the artifacts guide), with stand-ins for the Claude app's "sample" (ask Claude,
// with images) and "downloads" capabilities. Needs a built company edition:
//   python3 tools/build_company.py --name CROSSKY --email owner@crossky.ly --brand branding/crossky/png --out crossky --skin royal \
//     --logo branding/crossky/svg/wordmark-white.svg --logo-ink branding/crossky/svg/wordmark-ink.svg   (the full line is in README.md)
//   SITE=crossky CHROME=/path/to/chrome node tests/browser/run_embedded.js
// A folder built with --empty-stock gets the short run: the empty store, then the first parts from a supplier invoice read by Claude.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), SITE = path.resolve(process.env.SITE || path.join(ROOT, 'crossky'));
const PAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'page-'));
execFileSync('python3', [path.join(ROOT, 'tools', 'build_artifact.py'), SITE, PAGE], { stdio: 'inherit' });
const ORIGIN = 'https://page.test/';
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://unpkg.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob:; " +
  "connect-src 'self'; worker-src 'self' blob:; frame-src 'none'; object-src 'none'";
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
// ZXing stand-in (the real one loads from cdn.jsdelivr.net/npm/, which the page frame allows): reads a still photo
const ZXING_STUB = `window.ZXing = { BarcodeFormat: { EAN_13: 7, EAN_8: 6, UPC_A: 14, UPC_E: 15, CODE_128: 4, CODE_39: 2, CODE_93: 3, ITF: 8, CODABAR: 1, QR_CODE: 11, DATA_MATRIX: 5 }, DecodeHintType: { POSSIBLE_FORMATS: 2, TRY_HARDER: 3 },
  BrowserMultiFormatReader: class { async decodeFromConstraints() { throw new Error('no camera in this test'); } reset() {}
    async decodeFromImageUrl(u) { return { getText: () => 'KI-26300' }; } } };`;
const log = (() => { let n = 0; return s => console.log(`${++n}. ${s}`); })();
(async () => {
  const errors = [], must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__csp = []; window.__cam = 0; window.__calls = []; window.__saved = []; window.__sampleMode = 'ok';
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__cam++; throw new DOMException('refused', 'NotAllowedError'); };
    const sample = async () => ({ text: '', truncated: false });
    sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } });
    sample.json = async (input, o) => {
      window.__calls.push({ prompt: String(input).slice(0, 40), images: [].concat(o && o.images || []).map(b => b.type + ':' + b.size), tier: o && o.modelTier });
      if (window.__sampleMode !== 'ok') throw { code: window.__sampleMode, message: 'stand-in' };
      await new Promise(r => setTimeout(r, 200));
      return { supplier: 'شركة النور للتوريد', invoice_no: '77', currency: 'LYD', items: [
        { code: 'hy-58101', barcode: '', title: 'فحمات فرامل أمامية', qty: '١٠', unit_price: '٢٨٫٥', total: null },
        { code: '26300-35505', barcode: '', title: 'فلتر زيت كيا', qty: 4, unit_price: null, total: '1,000' },
        { code: 'NEW-AC-1', barcode: '8801234500017', title: 'حساس مكيف جديد', qty: 2, unit_price: 80, total: 160 },
        { code: '', barcode: '', title: '', qty: 1 }] };
    };
    const downloads = { save: async r => { window.__saved.push({ filename: r.filename, head: String(r.data).slice(0, 12), size: String(r.data).length }); return { status: 'saved' }; } };
    window.claude = { use: async name => name === 'sample' ? sample : name === 'downloads' ? downloads : null };
  });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' === ORIGIN) {
      const p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname), f = path.join(PAGE, p);
      if (!f.startsWith(PAGE) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
      const headers = { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' };
      if (p.endsWith('.html')) headers['content-security-policy'] = CSP;
      return route.fulfill({ headers, body: fs.readFileSync(f) });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('@zxing/library')) return route.fulfill({ contentType: 'text/javascript', body: ZXING_STUB });
    return route.abort(); // fonts and everything else: unreachable, as on a weak connection
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'e-' + n + '.png') });
  const see = (s, ms) => page.locator(s).first().waitFor({ state: 'visible', timeout: ms || 8000 });
  const text = async s => (await page.locator(s).first().innerText()).trim();
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(350); };
  const db = f => page.evaluate(f);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  try {
    await page.goto(ORIGIN); await see('#gnew .card, #gnew .empty', 15000);
    const brandName = (await text('.topbar .brand')) || (await page.getAttribute('.topbar .brand img', 'alt')) || '';
    must(brandName.includes('CROSSKY'), 'brand ' + brandName);
    must(await page.evaluate(() => [...document.querySelectorAll('.topbar .brand img')].every(i => i.complete && i.naturalWidth > 0)), 'the logo in the bar loads');
    must(await page.locator('.banner.inst').count() === 0, 'no install banner inside the Claude app');
    // the Claude app blocks outside photos, so its page keeps the bundled part pictures
    must(await page.evaluate(() => [...document.querySelectorAll('img')].every(i => !/^https?:/.test(i.getAttribute('src') || ''))), 'no outside photos inside the Claude app');
    // the edition's ad still opens the home screen, on the brand gradient instead of its outside photo
    must(await page.locator('.hero .ads .ad.noimg').count() === 1 && (await text('.ad-t')) === 'قطع غيار نيسان باترول', 'the Patrol ad without its photo');
    const cfg = await page.evaluate(() => window.SPARAT_CONFIG);
    must(cfg.embedded && cfg.noServiceWorker && cfg.demo && !cfg.supabaseUrl, 'page config'); log('opens as a page with the demo, fonts unreachable, no install banner, the Patrol ad on the brand gradient');
    await go('login'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await see('#ae'); await page.fill('#ae', 'owner@crossky.ly'); await page.fill('#ap', '123456'); await page.click('#ago');
    await page.waitForURL(/#mine/); await page.waitForTimeout(400);
    if (cfg.demoEmpty) {
      // the edition that starts empty (--empty-stock): nothing in stock, and the first parts come in from a supplier invoice read by Claude
      must(await db(() => window.__mockdb.products.length + window.__mockdb.invoices.length) === 0, 'an empty store');
      await go('receive'); await see('#rscan');
      await page.setInputFiles('#rpf', path.join(__dirname, 'part1.jpg'));
      await see('.readcard.done', 10000);
      const got = await db(() => { const D = window.__mockdb; return { n: D.products.length, pur: D.purchases.map(v => v.no), qty: D.products.map(p => p.qty).sort((a, b) => a - b) }; });
      must(got.n === 3 && got.pur.join() === '1' && got.qty.join() === '2,4,10', 'the first parts from the photo: ' + JSON.stringify(got));
      log('the empty store: a supplier invoice read by Claude brings in the first three parts (purchase 1)');
      const csp = await db(() => window.__csp), own = csp.filter(v => /page\.test|inline|eval/.test(v));
      must(!own.length, 'the page policy blocked the app itself: ' + own.join(' | '));
      must(!errors.length, errors.join(' | '));
      console.log('\nPAGE EDITION PASSED (empty store)');
      return;
    }
    // barcode: no camera in the page frame, straight to photo or typing
    await go('pos'); await see('#pscan'); await page.click('#pscan'); await see('#scm');
    await page.waitForFunction(() => /الكاميرا مش متاحة/.test(document.querySelector('#scm').textContent), null, { timeout: 4000 });
    must(await db(() => window.__cam) === 0, 'camera not asked for');
    await page.setInputFiles('#scp', path.join(__dirname, 'part1.jpg'));
    await page.waitForFunction(() => document.querySelectorAll('.pline, .pos-line, [data-pl]').length > 0 || /KI-26300/.test(document.body.innerText), null, { timeout: 6000 });
    log('barcode by photo in the page: camera never asked for, photo read as KI-26300');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // invoice photo read by Claude
    await go('receive'); await see('#rscan');
    const h0 = await db(() => window.__mockdb.products.find(x => x.sku === 'HY-58101').qty), k0 = await db(() => window.__mockdb.products.find(x => x.sku === 'KI-26300').qty);
    await page.setInputFiles('#rpf', path.join(__dirname, 'part1.jpg'));
    /* read by Claude, the invoice goes into stock by itself; taken back, its lines come back to check and enter by hand */
    await see('.readcard.done', 10000);
    const auto = await db(() => { const D = window.__mockdb; return [D.products.find(x => x.sku === 'HY-58101').qty, D.products.find(x => x.sku === 'KI-26300').qty, D.activity[D.activity.length - 1].detail.auto]; });
    must(auto[0] === h0 + 10 && auto[1] === k0 + 4 && auto[2] === true, 'entered by itself ' + JSON.stringify(auto));
    log('invoice photo read by Claude went into stock by itself; now taken back to check it by hand');
    await page.click('#rundo'); await see('[data-ok]'); await page.click('[data-ok]');
    await page.waitForFunction(() => document.querySelectorAll('.rline').length === 3 && !document.querySelector('.rl-state:not(.ok):not(.new)'), null, { timeout: 10000 });
    must(await db(() => window.__mockdb.products.find(x => x.sku === 'HY-58101').qty) === h0, 'taken back');
    const call = (await db(() => window.__calls))[0];
    must(call && call.images.length === 1 && call.images[0].startsWith('image/jpeg:') && call.tier === 'default' && call.prompt.startsWith('You are reading a photo'), 'asked Claude with the photo ' + JSON.stringify(call));
    must(await page.locator('.rline.ok').count() === 2 && await page.locator('.rline.new').count() === 1, 'two matched, one new');
    must((await page.inputValue('#rsup')) === 'شركة النور للتوريد', 'supplier');
    must((await page.locator('.rline.ok [data-f="qty"]').first().inputValue()) === '10', 'Arabic digits read');
    log('invoice photo read by Claude: ' + (await page.locator('.rl-state b').allInnerTexts()).join(' | '));
    await page.locator('.rline.new [data-f="price"]').fill('120');
    await shot('01-receive');
    await page.click('#rsave'); await page.waitForURL(/#purchases/, { timeout: 8000 }); await see('details.pur');
    const after = await db(() => { const D = window.__mockdb; return [D.products.find(x => x.sku === 'HY-58101').qty, (D.products.find(x => x.barcode === '8801234500017') || {}).qty, D.products.find(x => x.sku === 'KI-26300').qty, D.products.find(x => x.sku === 'KI-26300').cost]; });
    must(after[0] === h0 + 10 && after[1] === 2 && after[2] === k0 + 4 && +after[3] === 250, 'stock after receiving ' + JSON.stringify(after)); log('received into stock: brake pads +10, oil filters +4 at 250 (1,000 ÷ 4), new sensor ×2');
    // Claude not allowed: a clear message, nothing else breaks
    await db(() => { window.__sampleMode = 'not_granted'; });
    await go('receive'); await see('#rscan'); await page.setInputFiles('#rpf', path.join(__dirname, 'part2.jpg'));
    await page.waitForFunction(() => /ما سمحتش/.test((document.querySelector('.readcard small') || {}).textContent || ''), null, { timeout: 8000 });
    log('declined permission: "' + await text('.readcard small') + '"');
    await db(() => { window.__sampleMode = 'ok'; });
    // export through the Claude app's save sheet; Excel needs the Safari version
    await go('admin-sync'); await see('#exp'); await page.click('#exp');
    await page.waitForFunction(() => window.__saved.length > 0, null, { timeout: 8000 });
    const saved = (await db(() => window.__saved))[0];
    must(/^parts-\d{4}-\d\d-\d\d\.csv$/.test(saved.filename) && saved.head.charCodeAt(0) === 0xFEFF && saved.size > 200, 'saved ' + JSON.stringify(saved)); log('parts list saved through the save sheet: ' + saved.filename);
    await page.setInputFiles('#ifile', { name: 'parts.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK fake') });
    await page.waitForFunction(() => /CSV/.test(document.querySelector('#istat').textContent), null, { timeout: 5000 });
    log('Excel file: "' + await text('#istat') + '"');
    // invoice: WhatsApp is a real link, no print buttons (the page frame cannot print)
    await go('invoices'); await page.click('[data-r="all"]').catch(() => {}); await see('.inv-row'); await page.click('.inv-row'); await see('#ish');
    must((await page.getAttribute('#ish', 'href')).startsWith('https://wa.me/') && await page.locator('[onclick="window.print()"]').count() === 0, 'invoice actions in the page');
    await shot('02-invoice'); log('invoice: WhatsApp link, no print button');
    // the system tab is there; Face ID is not offered inside the page frame (WebAuthn is not allowed there)
    must((await page.locator('.tabs .tab').allInnerTexts()).map(x => x.trim())[1] === 'المنظومة', 'system tab in the page');
    await go('mine'); await see('.acct'); await page.waitForTimeout(400); must(await page.locator('#bioon').count() === 0, 'no Face ID card in the page');
    log('system tab next to home; no Face ID inside the Claude app page');
    const csp = await db(() => window.__csp), own = csp.filter(v => /page\.test|inline|eval/.test(v));
    must(!own.length, 'the page policy blocked the app itself: ' + own.join(' | '));
    must(!errors.length, errors.join(' | '));
    console.log('\nPAGE EDITION PASSED');
  } catch (e) {
    console.error('\nFAILED:', e.message); await shot('fail').catch(() => {}); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1;
  } finally { await browser.close(); fs.rmSync(PAGE, { recursive: true, force: true }); }
})();
