// Customer orders in the app (company edition): the customer orders from the basket (no WhatsApp); the order lands in the
// sales system «قيد التجهيز», then «قيد الاستلام», then «تم الاستلام» (a sale from then on), or «ملغي» with the parts back.
// Same set-up as run_company.js (in-browser demo backend, Chrome).
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
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'ord-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const login = async e => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } await go('login'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await see('#ae');
    await page.fill('#ae', e); await page.fill('#ap', e.startsWith('ali') ? 'secret777' : '123456'); await page.click('#ago'); await page.waitForURL(/#mine|#cart|#my-orders|#order-/); await page.waitForTimeout(500); };
  const part = sku => db(s => window.__mockdb.products.find(p => p.sku === s), sku);
  const lastOrder = () => db(() => window.__mockdb.invoices.filter(v => v.source === 'app').slice(-1)[0]);
  const addToCart = async (sku, times) => {
    const p = await part(sku); await go('p-' + p.id); await see('#padd');
    for (let i = 0; i < (times || 1); i++) { await page.click('#padd'); await page.waitForTimeout(120); }
    return p;
  };
  try {
    await page.goto(ORIGIN); await see('#gnew .card'); await page.waitForTimeout(500);

    // ----- a visitor: the basket, no WhatsApp -----
    const of0 = await addToCart('PT-OF-Y62', 2);
    must(await page.locator('.actionbar .btn-wa').count() === 0 && await page.locator('#pcart').isVisible(), 'the part page: add + checkout, no WhatsApp');
    await page.click('#pcart'); await page.waitForURL(/#cart/); await see('.crow');
    must(await page.locator('#cl .btn-wa').count() === 0 && await page.locator('.ord-signin').count() === 1, 'the basket asks to sign in, no WhatsApp');
    await shot('01-cart-visitor');
    log('a visitor: «أضف للطلب» then «كمّل الطلب»; the basket asks to sign in (no WhatsApp anywhere)');

    // ----- sign up, back to the basket, delivery -----
    await page.click('.ord-signin a[href="#signup"]'); await see('#anm');
    await page.fill('#ash', 'محل علي'); await page.fill('#anm', 'علي'); await page.fill('#aph', '0921234567'); await page.click('[data-by="email"]'); await page.fill('#ae', 'ali@test.ly'); await page.fill('#ap', 'secret777'); await page.click('#ago');
    await page.waitForURL(/#mine|#cart/); await page.waitForTimeout(500);
    if (!/#cart/.test(page.url())) await go('cart');
    await see('#of');
    must(await page.inputValue('#on') === 'محل علي' && (await page.inputValue('#op')).includes('921234567'), 'the shop name and phone filled in');
    must(await page.locator('#oaw').isHidden(), 'no address for pickup');
    await page.click('label.howopt:has(input[value="delivery"]) span'); await see('#oa');
    await page.fill('#oa', 'x'); await page.click('#ogo'); await page.waitForTimeout(200);
    must((await text('#oerr')).includes('العنوان'), 'the address is needed for delivery');
    await page.fill('#oa', 'طرابلس – حي الأندلس، قرب جامع الصحابة'); await page.fill('#ox', 'بعد العصر لو سمحتو');
    await shot('02-cart-form');
    await page.click('#ogo'); await page.waitForURL(/#order-/); await see('.ord-hero');
    let o = await lastOrder();
    must(o.status === 'preparing' && o.delivery === 'delivery' && o.address.includes('الأندلس') && o.note.includes('العصر') && o.paid === 0 && o.customer_name === 'محل علي', 'the order in the system (his shop) ' + JSON.stringify(o));
    must((await part('PT-OF-Y62')).qty === of0.qty - 2 && await db(() => window.SP.cart.count()) === 0, 'the parts are kept for it; the basket is empty');
    must(await page.locator('.osteps li.now').innerText().then(x => x.includes('قيد التجهيز')) && (await text('.oh-line')).includes('نجهزوه'), 'the order page: being prepared');
    await shot('03-order-preparing');
    log('signed up, back in the basket: name and phone filled, delivery needs an address; «أكّد الطلب» → order ' + o.no + ' «قيد التجهيز», 2 oil filters kept for it');
    await go('mine'); await see('a[href="#my-orders"]');
    await page.waitForFunction(() => (document.querySelector('[data-ordmine]') || {}).textContent === '1 مفتوحة', null, { timeout: 6000 }).catch(() => {});
    must((await text('a[href="#my-orders"]')).includes('1 مفتوحة'), 'my orders on the account page: ' + await text('a[href="#my-orders"]'));
    await page.click('a[href="#my-orders"]'); await see('.ocard');
    must(await page.locator('.ocard').count() === 1 && (await text('.ocard')).includes('قيد التجهيز'), 'my orders list');
    log('«طلباتي» on the account page: 1 open, and the list shows it «قيد التجهيز»');

    // ----- the manager: the count, the list, ready, received -----
    await login('owner@crossky.ly'); await go('');
    await page.waitForFunction(() => { const b = document.querySelector('#tabs a[href="#system"] .nbadge'); return b && b.textContent.trim() === '1'; }, null, { timeout: 8000 });
    await go('system'); await see('.pos-tile[href="#orders"]');
    must((await text('.pos-tile[href="#orders"]')).includes('الطلبات'), 'the orders tile');
    await shot('04-system-badge');
    await page.click('.pos-tile[href="#orders"]'); await page.waitForURL(/#orders$/); await see('.ord-row');
    must((await text('.ord-row')).includes('علي') && (await text('.ord-row')).includes('قيد التجهيز') && (await text('#otabs')).includes('1'), 'the order in the list');
    await shot('05-orders-list');
    log('the manager: a «1» on the System tab, the «الطلبات» tile, and the order in the list «قيد التجهيز»');
    await go('invoices'); await page.click('.chip[data-r="all"]'); await page.waitForTimeout(400); await see('.inv-row');
    must((await text('.inv-row')).includes('قيد التجهيز'), 'it is in the sales invoices too');
    await page.click('.inv-row'); await see('#invoice');
    must((await page.locator('.banner:has-text("طلب من التطبيق")').count()) === 1 && await page.locator('#iret').count() === 0, 'the invoice says it is an app order, no return yet');
    log('it is also in the sales invoices, marked «قيد التجهيز», with a link to the order (no return before it is received)');
    await page.click('.banner a[href^="#order-"]'); await see('[data-to="ready"]');
    must((await text('.ord-where')).includes('0921234567') || (await text('.ord-where')).includes('92 123 4567') || (await page.locator('.ord-where a[href^="tel:"]').count()) === 1, 'the customer to call');
    await page.click('[data-to="ready"]'); await page.waitForTimeout(500);
    o = await lastOrder();
    must(o.status === 'ready' && o.ready_at && await page.locator('.osteps li.now').innerText().then(x => x.includes('قيد الاستلام')), 'ready');
    log('«جاهز للاستلام» → «قيد الاستلام»');

    // ----- the customer sees it ready -----
    await login('ali@test.ly'); await go('');
    await page.waitForFunction(() => { const b = document.querySelector('#tabs a[href="#mine"] .nbadge'); return b && b.textContent.trim() === '1'; }, null, { timeout: 8000 });
    await go('order-' + o.id); await see('.ord-hero');
    must((await text('.oh-line')).includes('بيوصلك') && await page.locator('#ocx').count() === 0, 'ready: on its way; no cancelling now');
    await shot('06-order-ready');
    log('the customer: a «1» on the account tab, and the order says it is ready and on its way (no cancel now)');

    // ----- received, by card -----
    const rep0 = await db(() => window.__mockdb.invoices.filter(v => v.status === 'done').length);
    await login('owner@crossky.ly'); await go('order-' + o.id); await see('[data-to="done"]');
    await page.click('[data-to="done"]'); await see('.paychips');
    await page.click('[data-pay="card"]'); await shot('07-done-sheet'); await page.click('.sheet [data-ok]'); await page.waitForTimeout(600);
    o = await lastOrder();
    must(o.status === 'done' && o.payment === 'card' && o.paid === o.total && o.staff_name, 'received by card ' + JSON.stringify({ s: o.status, p: o.payment }));
    must(await db(() => window.__mockdb.invoices.filter(v => v.status === 'done').length) === rep0 + 1 && await page.locator('a[href^="#inv-"]').count() === 1, 'now a sale, with its invoice');
    await shot('08-order-done');
    log('«تم الاستلام» → paid by card: now a sale (with the staff name) and the invoice opens from the order');

    // ----- cancelled by the customer, cancelled by the shop -----
    const hl = (await db(() => window.__mockdb.products.filter(p => p.qty != null && p.qty >= 2 && p.qty <= 40 && p.status === 'active' && p.price != null)))[0];
    await login('ali@test.ly');
    await go('p-' + hl.id); await see('#padd'); await page.click('#padd'); await go('cart'); await see('#of');
    await page.click('label.howopt:has(input[value="pickup"]) span'); await page.click('#ogo'); await page.waitForURL(/#order-/); await see('#ocx');
    must((await part(hl.sku)).qty === hl.qty - 1, 'kept');
    await page.click('#ocx'); await page.click('.sheet [data-ok]'); await page.waitForTimeout(500);
    must((await lastOrder()).status === 'cancelled' && (await part(hl.sku)).qty === hl.qty && (await text('.ostat')).includes('لغيته انت'), 'cancelled by the customer, back in stock');
    log('the customer cancels while it is being prepared: «ملغي», the part back in stock');
    await go('p-' + hl.id); await see('#padd'); await page.click('#padd'); await go('cart'); await see('#of'); await page.click('#ogo'); await page.waitForURL(/#order-/);
    const o3 = await lastOrder();
    await login('owner@crossky.ly'); await go('order-' + o3.id); await see('[data-to="cancelled"]');
    await page.click('[data-to="cancelled"]'); await see('#ocr'); await page.fill('#ocr', 'الزبون ما ردش'); await page.click('.sheet [data-ok]'); await page.waitForTimeout(500);
    must((await lastOrder()).status === 'cancelled' && (await lastOrder()).cancel_reason === 'الزبون ما ردش' && (await part(hl.sku)).qty === hl.qty, 'cancelled by the shop');
    await login('ali@test.ly'); await go('order-' + o3.id); await see('.ostat');
    must((await text('.ostat')).includes('الزبون ما ردش'), 'the customer sees why');
    log('the shop cancels another with a reason; the customer sees «ملغي» and why');

    // ----- the assistant: the manager asks for the new orders and moves one on; the customer asks where it is -----
    await go('p-' + hl.id); await see('#padd'); await page.click('#padd'); await go('cart'); await see('#of'); await page.click('#ogo'); await page.waitForURL(/#order-/);
    const o4 = await lastOrder();
    const say = async q => { const k = await page.locator('#ailog .aimsg.ai').count(); await page.fill('#aiin', q); await page.press('#aiin', 'Enter');
      await page.waitForFunction(x => document.querySelectorAll('#ailog .aimsg.ai').length > x && !document.querySelector('#ailog .dots') && !document.querySelector('.ai-send.busy'), k, { timeout: 10000 });
      await page.waitForTimeout(200); return (await page.locator('#ailog .aimsg.ai').last().innerText()).trim(); };
    await db(() => { window.__mockdb.settings.ai_customers = true; window.SP.S.settings.ai_customers = true; });  /* the manager turned the assistant on for customers */
    await go('vin'); await go(''); await see('#aifab'); await page.click('#aifab'); await see('#aiin');
    let a = await say('وين طلبي؟');
    must(a.includes(String(o4.no)) && a.includes('قيد التجهيز'), 'the customer asks where the order is: ' + a);
    await page.click('#aibox [data-close]');
    await login('owner@crossky.ly'); await go(''); await see('#aifab'); await page.click('#aifab'); await see('#aiin');
    a = await say('شنو الطلبات الجديدة؟');
    must(a.includes(String(o4.no)) && a.includes('علي'), 'the manager asks for the new orders: ' + a);
    a = await say('الطلب ' + o4.no + ' جاهز');
    must(await page.locator('#ailog .aimsg.ai').last().locator('.ai-prop [data-go]').count() === 1 && (await lastOrder()).status === 'preparing', 'a card first: ' + a);
    await page.locator('#ailog .aimsg.ai').last().locator('.ai-prop [data-go]').click(); await page.waitForTimeout(600);
    must((await lastOrder()).status === 'ready', 'moved on after «نفّذ»');
    await page.click('#aibox [data-close]');
    log('the assistant: the customer asks «وين طلبي؟», the manager «شنو الطلبات الجديدة؟» and «الطلب ' + o4.no + ' جاهز» (a card, then «نفّذ»)');
    await login('ali@test.ly');

    // ----- more than in stock: the basket follows -----
    const low = (await db(() => window.__mockdb.products.filter(p => p.qty != null && p.qty >= 1 && p.qty <= 3 && p.status === 'active' && p.price != null)))[0]
      || await db(() => { const p = window.__mockdb.products.find(x => x.qty != null && x.status === 'active' && x.price != null && x.sku !== 'PT-OF-Y62'); p.qty = 2; return p; });
    await go('p-' + low.id); await see('#padd'); for (let i = 0; i < low.qty + 2; i++) { await page.click('#padd'); await page.waitForTimeout(80); }
    await go('cart'); await see('#of'); await page.click('#ogo'); await page.waitForTimeout(600);
    must((await text('#oerr')).includes('المتوفر') && await db(id => window.SP.cart.get().find(i => i.id === id).qty, low.id) === low.qty, 'the basket now has what is in stock: ' + await text('#oerr'));
    await shot('09-stock');
    log('ordering more than is in stock: it says how many there are and the basket is set to that');
    await db(() => window.SP.cart.clear());

    // ----- orders closed -----
    await db(() => { window.__mockdb.settings.shop_closed = true; const k = Object.keys(localStorage).find(x => x.startsWith('sp_demo_db_v') && !x.endsWith('_session')); localStorage.setItem(k, JSON.stringify(window.__mockdb)); });
    await page.reload(); await page.waitForTimeout(900);
    await go('p-' + of0.id); await page.waitForTimeout(300);
    must(await page.locator('#padd').count() === 0, 'closed: nothing to add');
    await db(id => window.SP.cart.add(id), of0.id); await go('cart'); await see('.ord-closed .banner.closed');
    must(await page.locator('#ogo').count() === 0, 'closed: no «أكّد الطلب»');
    log('orders closed by the owner: no «أضف للطلب», and the basket shows why instead of the button');

    // ----- English -----
    await db(() => { window.__mockdb.settings.shop_closed = false; window.SP.setLang('en'); }); await go('order-' + o.id); await see('.ord-hero');
    must((await text('.oh-no')).startsWith('Order') && await db(() => document.documentElement.dir) === 'ltr', 'English');
    await shot('10-english');
    log('English reads left to right');

    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' ORDER CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
