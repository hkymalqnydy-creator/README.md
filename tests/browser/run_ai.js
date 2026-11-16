// The AI assistant inside the app (company edition): the manager always has it; he gives it to an employee and picks what it
// may do for them (within their own permissions), and to signed-in customers if he wants. What it prepares to change runs
// only after «نفّذ», and goes in the activity log. Checked here: the on-device helper (the demo) with the manager, a seller
// and a customer; the manager's page; the employee sheet; the server engine (supabase/functions/assistant) and the Claude
// app engine (window.claude "sample" with page tools), both with stand-ins; English; a wide screen.
// Same set-up as run_company.js (in-browser demo backend, Chrome).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const ADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/ads.json'), 'utf8')).map(a => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))));
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoAds:${JSON.stringify(ADS)},demoExtra:${JSON.stringify(EXTRA)}};`;
const errors = [], served = []; let step = 0, server = 'ok';
const log = s => console.log(`${++step}. ${s}`);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block' });
  /* a stand-in for the company's server function: Claude finds the part, prepares the sale, then says so */
  const fn = async route => {
    const req = route.request(), body = JSON.parse(req.postData() || '{}');
    served.push({ auth: req.headers()['authorization'], apikey: req.headers()['apikey'], body });
    const json = (o, status) => route.fulfill({ status: status || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (server === 'limit') return json({ error: 'ai_limit' }, 429);
    if (server === 'gone') return json({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404);
    const last = body.messages[body.messages.length - 1], res = Array.isArray(last.content) ? last.content.find(b => b.type === 'tool_result') : null;
    if (!res) return json({ content: [{ type: 'text', text: 'ندوّرلك على فلتر الزيت.' }, { type: 'tool_use', id: 'tu_1', name: 'find_parts', input: { query: 'فلتر زيت باترول' } }], stop_reason: 'tool_use', left: 9 });
    if (res.tool_use_id === 'tu_1') { const r = JSON.parse(res.content); return json({ content: [{ type: 'tool_use', id: 'tu_2', name: 'prepare_sale', input: { items: [{ id: r.parts[0].id, qty: 3 }], payment: 'card' } }], stop_reason: 'tool_use', left: 9 }); }
    return json({ content: [{ type: 'text', text: 'جهزتلك فاتورة بـ 3 فلاتر زيت باترول بالبطاقة. راجعها واضغط «نفّذ».' }], stop_reason: 'end_turn', left: 9 });
  };
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' !== ORIGIN) return route.abort();
    if (u.pathname === '/sb/functions/v1/assistant') return fn(route);
    const p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    if (p === '/config.js' && !process.env.SITE) return route.fulfill({ contentType: 'text/javascript', body: CONFIG });
    const f = path.join(SITE, p);
    return fs.existsSync(f) ? route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'ai-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const gone = (sel, ms) => page.locator(sel).first().waitFor({ state: 'hidden', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(400); };
  const db = (f, a) => page.evaluate(f, a);
  const login = async e => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } await go('login'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await see('#ae');
    await page.fill('#ae', e); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/); await page.waitForTimeout(400); };
  const logout = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const open = async () => { await see('#aifab'); await page.click('#aifab'); await see('#aibox #aiin'); await page.waitForTimeout(150); };
  const fresh = async () => { await page.click('#aibox [data-new]'); await page.waitForTimeout(150); };
  const lastAi = () => page.locator('#ailog .aimsg.ai').last();
  /* type a request and wait for the whole answer */
  const answer = async n => {
    await page.waitForFunction(k => document.querySelectorAll('#ailog .aimsg.ai').length > k && !document.querySelector('#ailog .dots') && !document.querySelector('.ai-send.busy'), n, { timeout: 10000 });
    await page.waitForTimeout(200);
    return (await lastAi().innerText()).trim();
  };
  const say = async q => {
    const n = await page.locator('#ailog .aimsg.ai').count();
    await page.fill('#aiin', q); await page.press('#aiin', 'Enter');
    return answer(n);
  };
  /* invoice photos: a stand-in for the invoice reader (the server's scan-invoice, Claude in the app, or text recognition on the phone) */
  const PHOTO = path.join(__dirname, 'part1.jpg');
  const reader = inv => db(x => { window.__reads = 0; window.SP_SCAN_ENGINE = async (file, say) => { window.__reads++; say('ai'); await new Promise(r => setTimeout(r, 150)); return JSON.parse(x); }; }, JSON.stringify(inv));
  const attach = async () => { await page.setInputFiles('#aifile', PHOTO); await see('#aipic img', 12000); };
  const confirmLast = async () => {
    await lastAi().locator('.ai-prop [data-go]').click();
    await page.waitForFunction(() => { const a = [...document.querySelectorAll('#ailog .ai-prop')], l = a[a.length - 1]; return l && /st-(done|err)/.test(l.className); }, null, { timeout: 8000 });
    await page.waitForTimeout(300);
    return (await page.locator('#ailog .ai-prop').last().innerText()).trim();
  };
  const part = sku => db(s => window.__mockdb.products.find(p => p.sku === s), sku);
  const acts = kind => db(k => window.__mockdb.activity.filter(x => x.kind === k), kind);
  try {
    // ----- a visitor: no assistant (it needs a login); the auto-reply bubble stays -----
    await page.goto(ORIGIN); await see('#gnew .card'); await page.waitForTimeout(500);
    must(await page.locator('#aifab').count() === 0 && await page.locator('#botfab').count() === 1, 'visitor: auto-reply bubble, no assistant');
    log('a visitor sees the auto-reply bubble as before; the assistant needs a login');

    // ----- the manager: the button, the welcome, numbers -----
    await login('owner@crossky.ly'); await go('');
    await see('#aifab'); must(await page.locator('#botfab').count() === 0, 'one bubble only: the assistant replaces the auto-reply for the manager');
    await shot('01-owner-home');
    await open();
    must((await text('.ai-head b')) === 'مساعد CROSSKY' && (await text('#aisub')).includes('على الجهاز'), 'header ' + await text('.ai-head'));
    const hello = await text('#ailog .aimsg.hello');
    must(hello.includes('أهلاً') && hello.includes('«نفّذ»'), 'manager welcome: ' + hello);
    const chips = await page.locator('#aiq .chip').allInnerTexts();
    must(chips.includes('كم بعنا اليوم؟') && chips.includes('بيع فلتر زيت باترول') && chips.includes('كيف نعطي المساعد لموظف؟'), 'manager suggestions ' + chips.join('|'));
    log('the manager has the assistant button; it opens with a welcome and suggestions: ' + chips.join(' · '));
    await shot('02-owner-open');
    await page.click('#aiq .chip:has-text("كم بعنا اليوم؟")');
    await page.waitForFunction(() => document.querySelector('#ailog .ai-stats') && !document.querySelector('#ailog .dots'), null, { timeout: 8000 });
    const stats = await text('#ailog .ai-card');
    must(await page.locator('#ailog .ai-note').count() === 1 && stats.length > 10, 'sales today card ' + stats);
    log('«كم بعنا اليوم؟» → a card with today\'s sales (and a note that the demo helper runs on the phone)');
    let a = await say('شنو الناقص في المخزن؟');
    must(await lastAi().locator('.ai-card').count() === 1, 'low stock card: ' + a);
    a = await say('مين عليه ديون؟');
    must(await lastAi().locator('.ai-card').count() === 1, 'debts card: ' + a);
    a = await say('الأرباح هالشهر');
    must(await lastAi().locator('.ai-stats').count() === 1, 'profit card: ' + a);
    log('low stock, who owes us and this month\'s profit each come back as a card from the database');
    await shot('03-owner-numbers');

    // ----- the manager: a sale on credit, prepared then confirmed -----
    const of0 = await part('PT-OF-Y62'), inv0 = await db(() => window.__mockdb.invoices.length);
    a = await say('بيع 2 فلتر زيت باترول للزبون محمد بالدين');
    let card = await lastAi().locator('.ai-prop').innerText();
    must(card.includes('فلتر زيت نيسان باترول × 2') && card.includes('محمد') && card.includes('دين') && await lastAi().locator('[data-go]').count() === 1, 'sale card ' + card);
    must(await db(() => window.__mockdb.invoices.length) === inv0 && (await part('PT-OF-Y62')).qty === of0.qty, 'nothing sold before «نفّذ»');
    log('«بيع 2 فلتر زيت باترول للزبون محمد بالدين» → a card to check: the part × 2, the customer, on credit; nothing sold yet');
    await shot('04-sale-card');
    card = await confirmLast();
    const inv = await db(() => window.__mockdb.invoices[window.__mockdb.invoices.length - 1]);
    must(card.includes('فاتورة') && (await part('PT-OF-Y62')).qty === of0.qty - 2 && inv.customer_name === 'محمد' && inv.payment === 'credit', 'sold ' + JSON.stringify({ card, inv }));
    await page.waitForTimeout(300);
    let ai = await acts('ai');
    must(ai.length === 1 && ai[0].detail.tool === 'prepare_sale' && ai[0].detail.ask.includes('محمد') && ai[0].ref === String(inv.no), 'logged ' + JSON.stringify(ai));
    log('«نفّذ» → invoice ' + inv.no + ' on credit for محمد, stock ' + of0.qty + ' → ' + (of0.qty - 2) + ', and the activity log says the assistant did it and what was asked');
    await shot('05-sale-done');

    // ----- a price: cancelled, then done -----
    a = await say('غير سعر فلتر زيت باترول 45');
    must((await lastAi().locator('.ai-prop').innerText()).includes('45'), 'price card');
    await lastAi().locator('[data-no]').click(); await page.waitForTimeout(200);
    must(await lastAi().locator('.ai-prop.st-cancel').count() === 1 && (await part('PT-OF-Y62')).price === of0.price, 'cancel keeps the price');
    a = await say('غير سعر فلتر زيت باترول 45');
    await confirmLast();
    must((await part('PT-OF-Y62')).price === 45 && (await acts('ai')).length === 2, 'price changed and logged');
    log('a price change: «إلغاء» changes nothing; asked again and confirmed, the oil filter costs 45');

    // ----- questions and pages -----
    a = await say('كيف نعطي المساعد لموظف؟');
    must(a.includes('الموظفين') && await lastAi().locator('a.ai-pg[href="#staff"]').count() === 1, 'help answer ' + a);
    log('«كيف نعطي المساعد لموظف؟» → how, with a link to Staff');
    a = await say('افتح المخزن');
    await page.waitForURL(/#stock$/); await page.waitForTimeout(300);
    must(await page.locator('#aibox').isHidden(), 'the chat steps aside for the page');
    log('«افتح المخزن» → opens Stock and the chat steps aside');

    // ----- an invoice from its photo, exactly as on the paper -----
    const PAPER = { supplier: 'شركة الأمل للتوريد', invoice_no: '456', date: '2026-11-10', total: 3140, engine: 'ai', items: [
      { code: 'PT-OF-Y62', barcode: '', title: 'فلتر زيت باترول', qty: 10, unit_price: 28.5, total: 285 },
      { code: 'PT-FP-Y62', barcode: '', title: 'فحمات باترول', qty: 4, unit_price: 210, total: 840 },
      { code: 'NEW-AC-77', barcode: '8801234500077', title: 'حساس مكيف باترول', qty: 3, unit_price: 95, total: 285 },
      { code: '', barcode: '', title: 'رادياتير مياه باترول سوبر سفاري', qty: 2, unit_price: 865, total: 1730 }] };
    await reader(PAPER);
    await go(''); await open(); await fresh();
    const stockOf = () => db(() => { const D = window.__mockdb, q = k => D.products.find(p => p.sku === k); return { of: q('PT-OF-Y62').qty, fp: q('PT-FP-Y62').qty, rd: q('PT-RD-Y61').qty, pur: D.purchases.length }; });
    const b0 = await stockOf(), n0 = await page.locator('#ailog .aimsg.ai').count();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#aiq [data-photo]')]);
    await fc.setFiles(PHOTO);
    await answer(n0);
    const paperCard = await lastAi().locator('.ai-prop').innerText();
    must(await page.locator('#ailog .aimsg.me img').count() === 1 && (await text('#ailog .aimsg.me')).includes('نزّل الفاتورة'), 'the photo went with «نزّل الفاتورة»');
    must(await lastAi().locator('.ai-prop tr.ln').count() === 4 && await lastAi().locator('.ai-prop tr.ln.new').count() === 1, 'four lines, one new: ' + paperCard);
    must(['شركة الأمل للتوريد', '456', '2026-11-10', '3,140', 'حساس مكيف باترول', 'NEW-AC-77', '10 × ', 'جديدة'].every(x => paperCard.includes(x)) && await lastAi().locator('.ai-prop .banner').count() === 0, 'the card is the paper: ' + paperCard);
    must(await db(() => window.__reads) === 1 && (await stockOf()).pur === b0.pur, 'read once; nothing entered before «نفّذ»');
    await shot('05b-invoice-card');
    log('«نزّل فاتورة من صورة» → camera → the card is the paper: 4 lines (codes, 10 × 28.5…), one new item, supplier, invoice 456 of 2026-11-10, total 3,140 matching the paper');
    await confirmLast();
    const got = await db(() => { const D = window.__mockdb, P = D.purchases[D.purchases.length - 1], q = k => D.products.find(p => p.sku === k);
      return { of: q('PT-OF-Y62'), fp: q('PT-FP-Y62').qty, rd: q('PT-RD-Y61').qty, nw: D.products.find(p => p.part_no === 'NEW-AC-77'), pur: P, lines: D.purchase_items.filter(i => i.purchase_id === P.id).length }; });
    must(got.of.qty === b0.of + 10 && got.of.cost === 28.5 && got.fp === b0.fp + 4 && got.rd === b0.rd + 2, 'stock in as on the paper ' + JSON.stringify([b0, got.of.qty, got.fp, got.rd]));
    must(got.nw && got.nw.qty === 3 && got.nw.cost === 95 && got.nw.barcode === '8801234500077' && got.nw.title === 'حساس مكيف باترول', 'the new item added ' + JSON.stringify(got.nw));
    must(got.pur.supplier === 'شركة الأمل للتوريد' && got.pur.note.includes('456') && got.pur.total === 3140 && got.lines === 4, 'the receipt ' + JSON.stringify(got.pur));
    ai = await acts('ai');
    must(ai[ai.length - 1].detail.tool === 'invoice_from_photo' && ai[ai.length - 1].detail.ask === 'نزّل الفاتورة', 'logged as the assistant');
    log('«نفّذ» → receipt from شركة الأمل للتوريد (note: invoice 456): +10 oil filters at 28.5, +4 pads, +2 radiators, a new part «حساس مكيف باترول» × 3; logged');
    await shot('05c-invoice-done');
    await reader({ ...PAPER, total: 3000 });
    await attach(); a = await say('نزل الفاتورة');
    must((await lastAi().locator('.ai-prop .banner').innerText()).includes('والمكتوب في الفاتورة'), 'the printed total is checked: ' + a);
    await lastAi().locator('[data-alt]').click(); await page.waitForURL(/#receive/); await see('#rlines');
    await page.waitForTimeout(400);
    must(await page.locator('#rlines [data-k]').count() === 4 && await page.inputValue('#rsup') === 'شركة الأمل للتوريد', 'opened in Receive to edit');
    log('when the lines don\'t add up to the printed total it says so; «عدّلها في الاستلام» opens the same 4 lines and supplier in Receive');

    // ----- the manager's page -----
    await go('system'); await see('.pos-tile[href="#admin-ai"]'); await page.click('.pos-tile[href="#admin-ai"]');
    await page.waitForURL(/#admin-ai/); await see('#aisf');
    must(await page.locator('.admintabs a[href="#admin-ai"][aria-current="page"]').count() === 1, 'admin tab');
    await page.waitForFunction(() => document.querySelector('#aistaff ul, #aistaff p'));
    must((await text('#aistaff')).includes('أحمد (بائع)') && (await text('#aistaff')).includes('مقفول'), 'seller listed as off: ' + await text('#aistaff'));
    must((await text('#aisf')).includes('انت (المدير): دايماً'), 'the manager always');
    await shot('06-admin-ai');
    await page.click('label.switch:has(#aicu) span'); await page.fill('#ain', 'سبارك'); await page.fill('#air', 'الضمان 3 شهور على الأصلي.'); await page.fill('#aid', '3');
    await page.click('#aisave'); await page.waitForTimeout(300);
    must((await text('#aierr')).includes('5'), 'daily below 5 refused');
    await page.fill('#aid', '30'); await page.click('#aisave'); await page.waitForTimeout(500);
    let st = await db(() => window.__mockdb.settings);
    must(st.ai_customers === true && st.ai_name === 'سبارك' && st.ai_daily === 30 && st.ai_rules.includes('الضمان'), 'settings saved ' + JSON.stringify({ c: st.ai_customers, n: st.ai_name, d: st.ai_daily }));
    log('the manager\'s page (system tile and owner tab): who has it, customers on, name «سبارك», his instructions, 30 messages a day (3 refused)');

    // ----- giving it to the seller, only for selling -----
    await go('staff'); await see('.staff-row'); await page.locator('.staff-row:has-text("أحمد")').click(); await see('#sai');
    must(await page.locator('#saiw').isHidden(), 'AI choices hidden while off');
    await page.click('label.switch:has(#sai) span'); await see('#saip input');
    let offered = await page.locator('#saip input').evaluateAll(x => x.map(i => i.value));
    must(offered.join() === 'sales,returns,discounts', 'offered from his own permissions: ' + offered);
    await page.click('#saip label.switch:has(input[value="sales"]) span'); await page.click('#saip label.switch:has(input[value="returns"]) span');
    await page.click('.perm-list label.switch:has(input[value="returns"]) span'); await page.waitForTimeout(100);
    offered = await page.locator('#saip input').evaluateAll(x => x.map(i => i.value));
    must(offered.join() === 'sales,discounts', 'taking «returns» from him takes it from the assistant: ' + offered);
    await page.click('.perm-list label.switch:has(input[value="returns"]) span'); await page.waitForTimeout(100);
    must(await page.locator('#saip input[value="returns"]').isChecked(), 'given back, the assistant choice comes back');
    await page.click('#saip label.switch:has(input[value="returns"]) span');
    await shot('07-staff-ai');
    await page.click('#stf .btn-signal'); await page.waitForTimeout(500);
    const seller = await db(() => window.__mockdb.staff.find(x => x.email === 'seller@crossky.ly'));
    must(seller.ai_on === true && seller.ai_perms.join() === 'sales' && seller.perms.join() === 'sales,returns,discounts', 'seller saved ' + JSON.stringify(seller));
    must((await text('.staff-row:has-text("أحمد")')).includes('المساعد: البيع'), 'staff list shows it');
    log('Staff → أحمد: «يستعمل المساعد» with only «البيع» (his choices follow his own permissions); his permissions stay sales, returns, discounts');
    await go('admin-log'); await see('.log-row, .lrow, .act-row, #ll li, #ll .arow', 8000).catch(() => {});
    const logText = await page.locator('main').innerText();
    must(logText.includes('مقفول ← البيع') || logText.includes('البيع'), 'staff change in the log');

    // ----- the seller -----
    await login('seller@crossky.ly'); await go('');
    await open();
    must((await text('#ailog .aimsg.hello')).includes('البيع') && (await text('.ai-head b')) === 'سبارك', 'seller welcome ' + await text('#ailog .aimsg.hello'));
    must(await page.locator('#ailog .aimsg').count() === 1, 'his own conversation, not the manager\'s');
    const schips = await page.locator('#aiq .chip').allInnerTexts();
    must(!schips.includes('كم بعنا اليوم؟') && schips.includes('بيع فلتر زيت باترول'), 'seller suggestions ' + schips.join('|'));
    a = await say('كم بعنا اليوم؟');
    must(a.includes('المدير ما عطانيش صلاحية'), 'no reports for him: ' + a);
    a = await say('رجع فاتورة رقم ' + inv.no);
    must(a.includes('المدير ما عطانيش صلاحية'), 'no returns through the assistant: ' + a);
    const inv1 = await db(() => window.__mockdb.invoices.length);
    a = await say('بيع فلتر زيت باترول');
    await confirmLast();
    must(await db(() => window.__mockdb.invoices.length) === inv1 + 1, 'seller sold through the assistant');
    ai = await acts('ai');
    must(ai[ai.length - 1].actor_name.includes('أحمد') && ai[ai.length - 1].detail.tool === 'prepare_sale', 'his sale logged under his name ' + JSON.stringify(ai[ai.length - 1]));
    log('أحمد has it: «كم بعنا اليوم؟» and returns are refused (not given), selling works and is logged under his name');
    await shot('08-seller');
    await reader({ supplier: '', invoice_no: '77', date: '', total: null, engine: 'ai', items: [
      { code: 'PT-OF-Y62', title: 'فلتر زيت باترول', qty: 2, unit_price: 45 }, { code: 'PT-HL-Y62', title: 'فنار أمامي يمين باترول Y62', qty: 1, unit_price: 999 },
      { code: 'XX-999', title: 'قطعة مش عندنا', qty: 1, unit_price: 10 }] });
    must(await page.locator('#aiq [data-photo]').count() === 0 && await page.locator('#aifile').count() === 1, 'he can send a photo (sales), without the receiving suggestion');
    await attach(); a = await say('نزل فاتورة شراء');
    must(a.includes('المدير ما عطانيش صلاحية'), 'no receiving for him: ' + a);
    await attach(); a = await say('نزل الفاتورة');
    const sc = await lastAi().locator('.ai-prop').innerText();
    must(await lastAi().locator('.ai-prop tr.ln').count() === 2 && sc.includes('قطعة مش عندنا') && sc.includes('أسعار الورقة تختلف'), 'a sale from the photo: ' + sc);
    const invP = await db(() => window.__mockdb.invoices.length);
    await confirmLast();
    must(await db(() => window.__mockdb.invoices.length) === invP + 1, 'sold from the photo');
    log('أحمد\'s invoice photo becomes a sale (his permission): his 2 parts at the shop\'s prices, the unknown line named; a purchase photo is refused');

    // ----- the server engine (supabase/functions/assistant), with a stand-in -----
    await page.reload(); await page.waitForTimeout(800);
    await db(() => { Object.assign(window.SPARAT_CONFIG, { demo: false, supabaseUrl: location.origin + '/sb', supabaseKey: 'anon-key' }); });
    await go(''); await open(); await fresh();
    must((await text('#aisub')) === 'Claude', 'server engine shows Claude');
    server = 'limit';
    a = await say('السلام عليكم');
    must(a.includes('خلصت رسايلك'), 'daily limit message: ' + a);
    server = 'ok'; served.length = 0;
    const of1 = (await part('PT-OF-Y62')).qty;
    a = await say('بيع 3 فلتر زيت باترول بالبطاقة');
    must(a.includes('جهزتلك') && await lastAi().locator('.ai-prop').count() === 1 && await lastAi().locator('.ai-parts').count() === 1, 'server answer with parts and the card: ' + a);
    const turns = [...new Set(served.map(x => x.body.turn))], tools = served[0].body.tools.map(x => x.name).sort().join(',');
    must(served.length === 3 && turns.length === 1 && served[0].auth === 'Bearer demo' && served[0].apikey === 'anon-key', 'three steps of one turn with his login ' + JSON.stringify(served.map(x => x.auth)));
    must(tools === 'add_to_cart,find_invoices,find_orders,find_parts,invoice_from_photo,open_page,order_status,part_details,prepare_sale', 'only his tools go to the server: ' + tools);
    must(served[0].body.guide.includes('#pos') && served[0].body.currency && served[0].body.page.includes('#'), 'guide, currency and page');
    must(served[2].body.messages.some(m => Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result' && b.tool_use_id === 'tu_2')), 'the prepared sale went back as a tool result');
    must((await text('#aisub')).includes('باقيلك 9'), 'messages left ' + await text('#aisub'));
    await confirmLast();
    must((await part('PT-OF-Y62')).qty === of1 - 3, 'sold 3 by card');
    log('on the server: one turn = 3 calls with his own login (find the part, prepare the sale, the answer); only his 9 tools are sent; «نفّذ» sells 3');
    await shot('09-server');
    server = 'gone';
    a = await say('عندكم فحمات باترول؟');
    must(a.includes('لقيت') && (await text('#aisub')).includes('على الجهاز'), 'not set up → the helper on the phone answers: ' + a);
    log('when the function is not set up (404), the helper on the phone answers instead');

    // ----- the Claude app engine (window.claude "sample" with page tools), with a stand-in -----
    await page.addInitScript(() => {
      window.__sample = [];
      const sample = async (input, opts) => {
        window.__sample.push({ first: input[0].content, last: input[input.length - 1], tools: (opts.tools || []).map(x => x.name), tier: opts.modelTier, cache: opts.cache });
        if (window.__sampleMode === 'busy') throw { code: 'rate_limited', message: 'stand-in' };
        opts.onText && opts.onText({ text: 'لحظة…' });
        const find = opts.tools.find(x => x.name === 'find_parts'), sell = opts.tools.find(x => x.name === 'prepare_sale');
        const r = await find.execute({ query: 'فحمات باترول' });
        if (!sell) return { text: 'لقيت فحمات باترول Y62. تقدر تزيدها للسلة.', truncated: false };
        await sell.execute({ items: [{ id: r.parts[0].id, qty: 1 }] });
        return { text: 'لقيت فحمات باترول Y62 وجهزتلك فاتورتها. اضغط «نفّذ».', truncated: false };
      };
      sample.limits = async () => ({ images: { maxCount: 5 } });
      window.claude = { use: async n => n === 'sample' ? sample : null };
    });
    await page.reload(); await page.waitForTimeout(800);
    await db(() => { window.SPARAT_CONFIG.embedded = true; });
    await go(''); await open(); await fresh();
    a = await say('بيع فحمات باترول');
    const sm = await db(() => window.__sample[0]);
    must(sm.first.includes('an employee named أحمد') && sm.first.includes('only: sales') && sm.first.includes('الضمان 3 شهور') && sm.last.role === 'user' && sm.last.content.includes('بيع فحمات باترول'), 'what Claude is told ' + sm.first.slice(0, 300));
    must(sm.tools.sort().join() === 'add_to_cart,find_invoices,find_orders,find_parts,invoice_from_photo,open_page,order_status,part_details,prepare_sale' && sm.cache === undefined, 'his tools only (no cache with tools) ' + sm.tools);
    must(a.includes('جهزتلك') && await lastAi().locator('.ai-prop').count() === 1, 'Claude prepared the sale: ' + a);
    await confirmLast();
    log('inside the Claude app: Claude gets who he is and only his tools, finds the part and prepares the sale; «نفّذ» sells it');
    await db(() => { window.__sampleMode = 'busy'; });
    a = await say('شنو أحسن زيت؟');
    must(a.includes('Claude مشغول'), 'busy message ' + a);
    await db(() => { window.__sampleMode = ''; });

    // ----- a customer (on: the manager turned it on) -----
    await logout(); await go('signup'); await see('#anm');
    await page.fill('#ash', 'محل علي'); await page.fill('#anm', 'علي'); await page.fill('#aph', '0921234567'); await page.click('[data-by="email"]'); await page.fill('#ae', 'ali@test.ly'); await page.fill('#ap', 'secret777'); await page.click('#ago');
    await page.waitForURL(/#mine/); await go('');
    await open(); await fresh();
    must((await text('#ailog .aimsg.hello')).includes('قولي سيارتك'), 'customer welcome');
    a = await say('عندكم فحمات باترول؟');
    must(await lastAi().locator('.ai-part').count() >= 1 && (await lastAi().locator('.ai-part').first().innerText()).includes('باترول'), 'parts for the customer ' + a);
    must(!(await db(() => window.__sample[window.__sample.length - 1].tools)).includes('prepare_sale'), 'no selling tools for customers');
    log('a customer (the manager turned it on): Claude finds Patrol parts; customers get no shop tools');
    await page.reload(); await page.waitForTimeout(800); await go(''); await open(); await fresh();
    a = await say('عندكم فحمات باترول؟');
    must(a.includes('لقيت') && await lastAi().locator('[data-cart]').count() >= 1 && await page.locator('#ailog .ai-note').count() === 0, 'on the phone: parts with «للسلة», no staff note ' + a);
    await lastAi().locator('[data-cart]').first().click(); await page.waitForTimeout(200);
    must(await db(() => window.SP.cart.count()) === 1, 'in the cart');
    a = await say('عندكم توصيل؟');
    must(a.includes('التوصيل متاح لكل المدن'), 'the company\'s ready answer ' + a);
    log('on the phone too: parts with «للسلة» (it goes in the cart), and «عندكم توصيل؟» gets the company\'s own answer');
    await shot('10-customer');

    // ----- customers off again -----
    await db(() => { window.__mockdb.settings.ai_customers = false; const k = Object.keys(localStorage).find(x => x.startsWith('sp_demo_db_v') && !x.endsWith('_session')); localStorage.setItem(k, JSON.stringify(window.__mockdb)); });
    await page.reload(); await page.waitForTimeout(900); await go(''); await page.waitForTimeout(300);
    const off = await db(() => ({ ai: !!document.querySelector('#aifab'), bot: !!document.querySelector('#botfab') }));
    must(!off.ai && off.bot, 'customers off: back to the auto-reply ' + JSON.stringify(off));
    log('turned off for customers: they get the auto-reply bubble back');

    // ----- English, and a wide screen -----
    await login('owner@crossky.ly'); await go('');
    await db(() => window.SP.setLang('en')); await page.waitForTimeout(400);
    await open();
    must((await text('#ailog .aimsg.hello')).startsWith('Hi') && await db(() => getComputedStyle(document.querySelector('#aibox')).direction) === 'ltr', 'English, left to right');
    await shot('11-english');
    await page.click('#aibox [data-close]'); await db(() => window.SP.setLang('ar')); await go('vin'); await go('');
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300); await open();
    const w = await db(() => document.querySelector('#aibox').getBoundingClientRect().width);
    must(w > 380 && w < 460, 'side panel on a wide screen ' + w);
    await go('stock'); await page.waitForTimeout(300);
    must(await page.locator('#aibox').isVisible(), 'on a wide screen the side panel stays while pages change');
    await shot('12-desktop');
    log('English reads left to right; on a wide screen it is a side panel (' + Math.round(w) + 'px)');

    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' AI CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
