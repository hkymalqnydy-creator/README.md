// Merchants (company edition): sign up with the shop and the phone number, sign in with the phone or an email, «صادر ووارد»
// (الوارد: invoices sent to him; الصادر: his orders and payments; what he owes once approved), «ابعث الفاتورة للتاجر» from the
// invoice and the order, «التجار» for the staff, a new password from the owner. Same set-up as run_orders.js.
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
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'mr-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  const out = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const signIn = async (by, who, pw) => {
    await out(); await go('login'); await see('#ap');
    await page.click(`[data-by="${by}"]`);
    await page.fill(by === 'phone' ? '#alp' : '#ae', who); await page.fill('#ap', pw || '123456'); await page.click('#ago');
  };
  const toast = async re => { for (let i = 0; i < 30; i++) { const tx = await page.locator('.toast').allInnerTexts().catch(() => []); if (tx.some(x => re.test(x))) return true; await page.waitForTimeout(100); } return false; };
  try {
    await page.goto(ORIGIN); await see('#gnew .card'); await page.waitForTimeout(400);
    must(/0925551234/.test(await text('.demo-b')), 'the demo banner gives the merchant sign-in');

    // ----- a merchant signs up with his phone number and his shop -----
    await go('signup'); await see('#ash');
    must(await page.locator('[data-by="phone"].on').count() === 1 && await page.locator('#aew').isHidden(), 'sign-up: the phone number is the default sign-in, no email field');
    await page.click('#ago');
    must(/المحل/.test(await text('#aerr')), 'the shop name is required');
    await page.fill('#ash', 'محل الأمل لقطع الغيار'); await page.fill('#anm', 'سالم'); await page.fill('#act', 'مصراتة'); await page.fill('#aph', '091-222-3344'); await page.fill('#ap', 'secret777');
    await shot('01-signup');
    await page.click('#ago'); await page.waitForURL(/#mine/); await page.waitForTimeout(500);
    const acct = await db(() => ({ email: window.__mockdb.users.slice(-1)[0].email, c: window.__mockdb.customers.slice(-1)[0] }));
    must(acct.email === '218912223344@phone.invalid' && acct.c.shop_name === 'محل الأمل لقطع الغيار' && acct.c.phone === '091-222-3344' && !acct.c.approved, 'the account signs in with his number; the shop is saved: ' + JSON.stringify(acct));
    must(/محل الأمل/.test(await text('.acct .mc-head b')) && /\+218912223344/.test(await text('.acct .mc-head small')), 'the account page: the shop, the number (not an address)');
    must(await page.locator('a.admin-entry[href="#ledger"]').count() === 1 && await page.inputValue('#psh') === 'محل الأمل لقطع الغيار', 'the «صادر ووارد» entry, and the shop in the profile');
    log('sign-up: shop name (required), name, city, phone; the phone number is the sign-in; the account page shows the shop and «صادر ووارد»');

    await go('ledger'); await see('.mr-head');
    must(await page.locator('.mr-head .banner.note').count() === 1 && await page.locator('.led-bal').count() === 0, 'not approved yet: no total, a note');
    must(await page.locator('.mr-list .empty').count() === 1 && /الوارد/.test(await text('[data-lt="in"]')) && /الصادر/.test(await text('[data-lt="out"]')), 'empty الوارد, the two tabs');
    await shot('02-ledger-new');
    log('his «صادر ووارد»: الوارد and الصادر, empty; what he owes shows after the company approves him');

    // ----- sign in by phone: a wrong password, the forgotten password, then in -----
    await signIn('phone', '0912223344', 'nope000');
    await page.waitForTimeout(400);
    must(/رقم الهاتف أو كلمة السر غلط/.test(await text('#aerr')), 'a wrong password names the phone number');
    // the forgotten password: a code (by SMS on the server; shown on screen in the demo), 90 seconds, then a new password
    await page.click('#afg'); await page.waitForURL(/#reset/); await see('#rp');
    must(await page.inputValue('#rp') === '0912223344', 'the code page starts with his number');
    await page.click('#rsgo'); await see('#rc');
    const code = (await text('#rsdemo')).replace(/\D/g, '').slice(-6);
    must(code.length === 6 && /\+218912223344/.test(await text('#rsto')) && /1:(29|30)/.test(await text('#rst')), 'a code to his number, 1:30 to use it: ' + await text('#rst'));
    await page.fill('#rc', code === '111111' ? '222222' : '111111'); await page.fill('#rn', 'newpass9'); await page.click('#rcgo'); await page.waitForTimeout(400);
    must(/الكود غلط/.test(await text('#rcerr')), 'a wrong code is refused');
    await shot('03-reset-code');
    // a minute and a half later (the page's clock moved on)
    await db(() => { window.__realNow = Date.now; Date.now = () => window.__realNow() + 91000; });
    await page.waitForTimeout(1200);
    must(/خلص وقت الكود/.test(await text('#rst')) && await page.locator('#rsagain').isVisible(), 'the timer runs out and offers a new code');
    await page.fill('#rc', code); await page.click('#rcgo'); await page.waitForTimeout(400);
    must(/خلص وقت الكود/.test(await text('#rcerr')), 'after 90 seconds the code no longer works');
    await page.click('#rsagain'); await page.waitForTimeout(400);
    const code2 = (await text('#rsdemo')).replace(/\D/g, '').slice(-6);
    await page.fill('#rc', code2); await page.fill('#rn', 'newpass9'); await page.click('#rcgo'); await page.waitForURL(/#mine/);
    await db(() => { Date.now = window.__realNow; });
    await signIn('phone', '+218 91 222 3344', 'newpass9'); await page.waitForURL(/#mine/);
    log('sign-in by phone (091… or +218…, the same account); a wrong password says so; «نسيت كلمة السر»: a code for 1:30, a wrong or late code refused, a new code, a new password');

    // ----- the demo merchant: approved, an invoice sent to him -----
    await signIn('phone', '0925551234'); await page.waitForURL(/#mine/); await page.waitForTimeout(400);
    await db(() => window.SP.inboxWatch()); await page.waitForTimeout(300);
    must(await text('#tabs a[href="#mine"] .nbadge') === '1' && await text('a.admin-entry[href="#ledger"] .nbadge') === '1', 'the notice: 1 on the account tab and on «صادر ووارد»');
    await go('ledger'); await see('.mr-head');
    const want = await db(() => { const d = window.__mockdb, k = 'p:925551234', inv = d.invoices.filter(v => v.status === 'done' && (v.customer_phone || '').replace(/\D/g, '').endsWith('925551234'));
      return inv.reduce((a, v) => a + Math.max(v.total - v.paid, 0), 0) - d.customer_payments.filter(p => p.cust_key === k).reduce((a, p) => a + p.amount, 0); });
    must((await text('.led-bal b')).replace(/[^\d]/g, '') === String(want), 'approved: what he owes ' + want + ' / ' + await text('.led-bal b'));
    must(await page.locator('.mr-list .inv-row.fresh .pill.new').count() === 1, 'the sent invoice is marked new');
    await shot('04-ledger-merchant');
    const billHref = await page.getAttribute('.mr-list .inv-row.fresh', 'href');
    await page.click('.mr-list .inv-row.fresh'); await see('#invoice');
    must(await page.locator('#invoice .inv-items tbody tr').count() === 2 && /ورشة النور/.test(await text('#invoice .inv-meta')), 'his invoice: the lines, his shop');
    must(await page.locator('#bsh').count() === 1 && await page.locator('.send-card').count() === 0, 'share, and no sending (he is not staff)');
    await shot('05-bill');
    await go('ledger'); await see('.mr-head');
    must(await page.locator('.inv-row.fresh').count() === 0 && await page.locator('#tabs a[href="#mine"] .nbadge').count() === 0, 'opened: no longer new, the notice is gone');
    await page.click('[data-lt="out"]'); await page.waitForTimeout(300);
    must(await page.locator('.mr-list .mr-ic.pay').count() === 1 && /150/.test(await text('.mr-list')), 'الصادر: his payment of 150');
    log('the demo merchant (0925551234): a notice for the invoice sent to him; what he owes; the invoice opens like the printed one; الصادر has his payment');

    // ----- the owner sends a sale from the till to the new merchant -----
    await signIn('email', 'owner@crossky.ly'); await page.waitForURL(/#mine/); await page.waitForTimeout(300);
    const inv = await db(async () => { const p = window.__mockdb.products.find(x => x.price != null && x.status === 'active' && (x.qty == null || x.qty > 3));
      const r = await window.SP.sb.rpc('create_invoice', { p: { payment: 'credit', customer_name: 'محل الأمل', customer_phone: '0912223344', items: [{ id: p.id, qty: 2 }] } }); return r.data; });
    await go('inv-' + inv.id); await see('.send-card');
    must(/اختار التاجر/.test(await text('#snd')), 'a sale at the till: choose the merchant');
    await page.click('#snd'); await see('.pk-row');
    must(await page.inputValue('#pkq') === '912223344' && /نفس رقم الفاتورة/.test(await text('.pk-row')), 'the picker starts with the invoice\'s number and marks the same number');
    await shot('06-pick');
    await page.click('.pk-row'); await page.waitForTimeout(400); await see('.sheet [data-ok]'); await page.click('.sheet [data-ok]');
    must(await toast(/وصلت الفاتورة للتاجر/), 'sent');
    await see('.sc-sent');
    must(/محل الأمل/.test(await text('.sc-sent')) && await page.locator('#unsnd').count() === 1, 'the invoice says to whom and when, and can be taken back');
    await shot('07-sent');
    log('the owner sends a sale from the till: the picker starts with the invoice\'s phone number, a confirmation, then «بعثتها لـ محل الأمل»');

    // ----- «التجار» and one merchant -----
    await go('system'); await see('.pos-tile[href="#merchants"]');
    await page.click('.pos-tile[href="#merchants"]'); await see('#ml .arow');
    must(await page.locator('#ml .arow').count() === 6 && await text('[data-c="pending"]') === '3', 'the merchants: 6, 3 waiting for approval');
    await shot('08-merchants');
    await page.fill('#mrq input', '2223344'); await page.press('#mrq input', 'Enter'); await page.waitForTimeout(500);
    must(await page.locator('#ml .arow').count() === 1, 'found by his number');
    await page.click('#ml .arow'); await see('.mr-head');
    must(await page.locator('#mapp').count() === 1 && await page.locator('.led-bal').count() === 0 && await page.locator('.mr-list .inv-row').count() === 1, 'not approved: no total; the invoice sent to him');
    await page.click('#mapp'); await see('.led-bal');
    must((await text('.led-bal b')).replace(/[^\d]/g, '') === String(inv.total), 'approved: he owes the credit sale ' + inv.total);
    await page.click('#mpw'); await see('#pwi');
    const pw = await page.inputValue('#pwi');
    await page.click('#pwf .btn-signal'); await see('#pwa .btn-wa');
    must(decodeURIComponent(await page.getAttribute('#pwa .btn-wa', 'href')).includes(pw), 'the new password goes to him on WhatsApp');
    await shot('09-merchant-owner');
    await page.click('#pwa [data-close]'); await page.waitForTimeout(300);
    await go('admin-log'); await page.waitForTimeout(600);
    const logText = await text('main');
    must(/بعث الفاتورة/.test(logText) && /كلمة سر جديدة/.test(logText), 'the activity log names both');
    log('«التجار» on the System tab: 6 merchants, 3 waiting; search by number; approve; a new password sent on WhatsApp; both in the activity log');

    // ----- the new merchant signs in with the new password and gets it -----
    await signIn('phone', '0912223344', pw); await page.waitForURL(/#mine/); await page.waitForTimeout(300);
    await db(() => window.SP.inboxWatch());
    must(await toast(/وصلتك فاتورة رقم/), 'a word when the invoice arrives');
    await go('ledger'); await see('.led-bal');
    const nf = await page.locator('.mr-list .inv-row.fresh').count(), lb = await text('.led-bal b');
    must(nf === 1 && lb.replace(/[^\d]/g, '') === String(inv.total), 'approved now: the invoice and what he owes ' + JSON.stringify({ nf, lb, total: inv.total }));
    log('the new merchant signs in with the password the owner gave him; a word for the invoice; approved, he sees what he owes');

    // ----- an order: the seller sends its invoice from the order page -----
    const orders = await db(() => !!window.__mockdb.settings.orders_enabled);
    if (orders) {
      const p = await db(() => window.__mockdb.products.find(x => x.price != null && x.status === 'active' && !x.hide_price && (x.qty == null || x.qty > 5)));
      const o = await db(async id => (await window.SP.orders.place({ items: [{ id, qty: 1 }] })), p.id);
      must(o && o.customer_name === 'محل الأمل لقطع الغيار', 'the order carries his shop: ' + (o && o.customer_name));
      await signIn('email', 'seller@crossky.ly'); await page.waitForURL(/#mine/);
      await go('order-' + o.id); await see('.send-card');
      must(/محل الأمل/.test(await text('#snd')), 'the order page: send to him by name');
      await page.click('#snd'); must(await toast(/وصلت الفاتورة/), 'sent from the order'); await see('.sc-sent');
      await signIn('phone', '0912223344', pw); await page.waitForURL(/#mine/);
      await go('order-' + o.id); await see('a[href="#bill-' + o.id + '"]');
      log('an order: the seller sends its invoice from the order page; the merchant\'s order page opens the invoice');
    }

    // ----- «المحلات»: the merchants' shops on the home screen, each with its page -----
    await out(); await go('vin'); await go(''); await see('#secms .scard');
    const shops = await page.locator('#hms .scard b').allInnerTexts();
    must(shops.length === 5 && shops[0] === 'ورشة النور للصيانة' && !shops.includes('محل الأمل لقطع الغيار'), 'five shop cards on the home screen, not the new merchant\'s: ' + shops.join('|'));
    must(await page.locator('#hms .scard').first().locator('img.sc-cover').count() === 1 && await page.locator('#hms .scard[data-bg="b3"]').count() === 1, 'a card on its photo, another on its colour');
    must(await page.locator('#gnew .card').count() === 2 && await page.locator('main .cats').count() === 0 && await page.locator('main .btile').count() === 0, 'the home screen: two new parts, no sections, no brands');
    await shot('10-home-shops');
    await page.click('#hms .scard'); await see('.ms-head');
    must((await text('.scard.big .sc-text b')) === 'ورشة النور للصيانة' && /218925551234/.test(await page.getAttribute('.ms-acts .btn-wa', 'href')) && await page.locator('.ms-acts a[href^="tel:"]').count() === 1, 'his page: WhatsApp and call (he shows his number)');
    await go('mshops'); await see('#msl .scard');
    must(await page.locator('#msl .scard').count() === 5, 'every shop shown: 5');
    await page.fill('#msf input', 'سبها'); await page.press('#msf input', 'Enter'); await page.waitForTimeout(500);
    must(await page.locator('#msl .scard').count() === 1 && (await text('#msl .scard b')) === 'مركز البركة لقطع الغيار', 'found by the city');
    await page.click('#msl .scard'); await see('.ms-head');
    must(await page.locator('.ms-acts').count() === 0 && (await text('.ms-head')).includes('ما حطّش رقمه'), 'a shop that keeps its number to itself');
    await shot('11-shop-page');
    log('«المحلات» under «وصل حديثاً» (two parts, no sections or brands): cards on a photo or a colour, each with its page; WhatsApp and call only when the merchant shows his number; all of them, found by city');
    // the owner shows the new merchant's shop; the merchant shows his number; or the owner lets every merchant show his shop
    await signIn('email', 'owner@crossky.ly'); await page.waitForURL(/#mine/);
    const amal = await db(() => window.__mockdb.customers.find(c => c.shop_name === 'محل الأمل لقطع الغيار').user_id);
    await go('merchant-' + amal); await see('.mr-shop');
    must(await page.locator('#mshow').isChecked() === false && (await text('.mr-shop')).includes('رقمه مخفي'), 'his shop is not shown, his number hidden');
    await page.click('label:has(#mshow)'); await page.waitForTimeout(600);
    must(await db(id => window.__mockdb.customers.find(c => c.user_id === id).shop_on, amal) && await page.locator('.mr-shop a[href="#mshop-' + amal + '"]').count() === 1, 'the owner shows it');
    await signIn('phone', '0912223344', pw); await page.waitForURL(/#mine/); await see('#myc');
    // his card: a colour, then a photo of his shop
    await page.click('#myc .swatch[data-bg="b4"]'); await page.waitForTimeout(500); await see('#myc .swatch[data-bg="b4"][aria-pressed="true"]');
    must(await db(id => window.__mockdb.customers.find(c => c.user_id === id).shop_bg, amal) === 'b4' && await page.locator('#mycv .scard[data-bg="b4"]').count() === 1, 'his card on the colour he picked');
    await page.setInputFiles('#mycf', path.join(SITE, 'icons/icon-192.png')); await see('#mycv img.sc-cover', 8000);
    must(/^data:image\//.test(await db(id => window.__mockdb.customers.find(c => c.user_id === id).shop_cover, amal)) && await page.locator('#mycr').count() === 1, 'his card on his photo');
    await shot('12-my-card');
    await see('#ppub');
    await page.click('label:has(#ppub)'); await page.click('#pgo'); await page.waitForTimeout(500);
    must(await db(id => window.__mockdb.customers.find(c => c.user_id === id).phone_public, amal), 'he shows his number');
    await out(); await go('mshop-' + amal); await see('.ms-head');
    must((await text('.scard.big .sc-text b')) === 'محل الأمل لقطع الغيار' && /218912223344/.test(await page.getAttribute('.ms-acts .btn-wa', 'href')) && await page.locator('.scard.big img.sc-cover').count() === 1, 'his page: his card and his number');
    await signIn('email', 'owner@crossky.ly'); await page.waitForURL(/#mine/);
    await go('merchant-' + amal); await see('#mcvr'); await page.click('#mcvr'); await page.waitForTimeout(500);
    must(!(await db(id => window.__mockdb.customers.find(c => c.user_id === id).shop_cover, amal)) && await page.locator('.mr-card .scard[data-bg="b4"] img').count() === 0, 'the owner can take a photo off: back to his colour');
    await signIn('email', 'owner@crossky.ly'); await page.waitForURL(/#mine/);
    await db(() => { window.__mockdb.customers.forEach(c => { c.shop_on = false; }); window.SP.S.msQ = ''; });
    await out(); await go('mshops'); await page.waitForTimeout(500);
    must(await page.locator('#msl .scard').count() === 0, 'none shown');
    await signIn('email', 'owner@crossky.ly'); await page.waitForURL(/#mine/);
    await go('admin-control'); await see('#kms'); await page.click('label:has(#kms)'); await page.click('#kgo'); await page.waitForTimeout(600);
    await out(); await go('mshops'); await see('#msl .scard');
    must(await page.locator('#msl .scard').count() === 6, '«السماح لأي تاجر يظهر محله»: every merchant with a shop shows');
    log('the owner shows a merchant\'s shop from his page; the merchant picks his card\'s colour or puts a photo, and shows his number; the owner can take a photo off; or «السماح لأي تاجر يظهر محله» shows them all');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`MERCHANTS OK (${step} checks)`);
  } catch (e) {
    await shot('ERR').catch(() => {});
    console.error('FAILED at step', step + 1, e.message, errors);
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
