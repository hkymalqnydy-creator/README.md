// Owner controls (company edition): an invoice photo that goes into stock by itself and can be taken back, receipts taken back
// from the list, closing orders and hiding quantities and branches from customers, staff discount limits, prices in bulk,
// the activity log and the invoice footer. Same set-up as run_company.js (in-browser demo backend, Chrome).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const SITE = process.env.SITE || path.resolve(__dirname, '../..'), ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const CONFIG = "window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/'};";
const errors = []; let step = 0;
const log = s => console.log(`${++step}. ${s}`);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' !== ORIGIN) return route.abort();
    const p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    if (p === '/config.js' && !process.env.SITE) return route.fulfill({ contentType: 'text/javascript', body: CONFIG });
    const f = path.join(SITE, p);
    return fs.existsSync(f) ? route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  /* Face ID stand-in: Chrome's virtual platform authenticator (resident keys, user verified) */
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'k-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(350); };
  const db = f => page.evaluate(f);
  const login = async e => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } await go('login'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await see('#ae');
    await page.fill('#ae', e); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/); await page.waitForTimeout(300); };
  const logout = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const confirm = async () => { await see('[data-ok]'); await page.click('[data-ok]'); await page.waitForTimeout(350); };
  const PHOTO = path.join(SITE, 'img/parts/battery.jpg');
  /* the invoice reader stand-in: what the AI reader returns for a supplier invoice */
  const reader = (items, engine) => page.evaluate(([its, eng]) => { window.SP_SCAN_ENGINE = async (f, say) => { say('ai'); await new Promise(r => setTimeout(r, 120)); return { supplier: 'مورد الصورة', engine: eng, items: its }; }; }, [items, engine || 'ai']);
  try {
    await page.goto(ORIGIN); await see('#gnew .card');
    await login('owner@crossky.ly');

    // ----- an invoice photo goes into stock by itself -----
    const k0 = await db(() => { const D = window.__mockdb, a = D.products.find(p => p.sku === 'KI-26300'), b = D.products.find(p => p.sku === 'HY-58101'); return { a: a.qty, b: b.qty, bc: b.cost, n: D.products.length, pu: D.purchases.length }; });
    await go('receive'); await see('#rauto');
    must(await page.isChecked('#rauto'), 'entering by itself is on by default');
    await reader([{ code: 'KI-26300', title: 'فلتر زيت', qty: 6, unit_price: 20 }, { code: 'HY-58101', title: 'فحمات', qty: 4, unit_price: 111 }, { code: 'NEW-7788', title: 'حساس سرعة جديد', qty: 2, unit_price: 95 }]);
    await page.setInputFiles('#rpf', PHOTO);
    await see('.readcard.done', 8000);
    const k1 = await db(() => { const D = window.__mockdb, a = D.products.find(p => p.sku === 'KI-26300'), b = D.products.find(p => p.sku === 'HY-58101'), c = D.products.find(p => p.part_no === 'NEW-7788'), v = D.purchases[D.purchases.length - 1], l = D.activity[D.activity.length - 1];
      return { a: a.qty, b: b.qty, bc: b.cost, c: c && [c.title, c.qty, c.cost], pu: D.purchases.length, sup: v.supplier, kind: l.kind, src: l.detail.source, auto: l.detail.auto }; });
    must(k1.a === k0.a + 6 && k1.b === k0.b + 4 && k1.bc === 111 && JSON.stringify(k1.c) === JSON.stringify(['حساس سرعة جديد', 2, 95]) && k1.pu === k0.pu + 1 && k1.sup === 'مورد الصورة', 'stock after the photo ' + JSON.stringify([k0, k1]));
    must(k1.kind === 'receive' && k1.src === 'photo' && k1.auto === true, 'the log says photo, by itself');
    must(await page.locator('.rcv-done tr').count() === 3 && await page.locator('.rline').count() === 0 && (await text('.readcard.done')).includes('بروحها'), 'result card with the 3 parts, lines cleared');
    log('invoice photo: 3 parts went into stock by themselves (KI-26300 +6, HY-58101 +4 at the new cost 111, a new sensor ×2), no tap needed'); await shot('01-auto');
    await page.click('#rundo'); await confirm(); await see('.rline');
    const k2 = await db(() => { const D = window.__mockdb, a = D.products.find(p => p.sku === 'KI-26300'), b = D.products.find(p => p.sku === 'HY-58101'); return { a: a.qty, b: b.qty, bc: b.cost, n: D.products.length, c: D.products.some(p => p.part_no === 'NEW-7788'), pu: D.purchases.length }; });
    must(k2.a === k0.a && k2.b === k0.b && k2.bc === k0.bc && k2.n === k0.n && !k2.c && k2.pu === k0.pu, 'taken back: ' + JSON.stringify([k0, k2]));
    await page.waitForFunction(() => document.querySelectorAll('.rline').length === 3 && !document.querySelector('.rl-state:not(.ok):not(.new)'));
    must(await page.locator('.rline.ok').count() === 2 && await page.locator('.rline.new').count() === 1, 'the lines are back on screen to fix');
    log('taken back: quantities and cost as before, the new part removed, the 3 lines back on screen to fix');
    await page.locator('.rline.ok [data-f="qty"]').first().fill('5'); await page.click('#rsave'); await page.waitForURL(/#purchases/); await see('details.pur');
    must(await db(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').qty) === k0.a + 5, 'fixed and entered by the button');
    log('fixed one quantity and entered it with the button');

    // ----- taking a receipt back from the list -----
    await page.click('details.pur summary'); await see('details.pur [data-undo]');
    const pu1 = await db(() => window.__mockdb.purchases.length);
    await page.click('details.pur [data-undo]'); await confirm(); await page.waitForTimeout(400);
    must(await db(() => window.__mockdb.purchases.length) === pu1 - 1 && await db(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').qty) === k0.a, 'receipt taken back from the list');
    log('receipt taken back from the receipts list: stock as before'); await shot('02-receipts');

    // ----- not by itself: read on the device with an unknown part, or on credit without a supplier -----
    await go('receive'); await see('#rauto');
    await reader([{ code: 'KI-26300', title: 'فلتر', qty: 1 }, { code: 'ZZ-0001', title: 'قطعة غريبة', qty: 1 }], 'device');
    await page.setInputFiles('#rpf', PHOTO); await see('#rwait:not([hidden])', 8000);
    must((await text('#rwait')).includes('على الجهاز') && await page.locator('.rline').count() === 2 && await db(() => window.__mockdb.purchases.length) === pu1 - 1, 'device reading with an unknown part waits: ' + await text('#rwait'));
    log('read on the device with a part we do not know: it waits on screen with the reason');
    await page.click('#rclr'); await confirm();
    await page.click('label[for="rpay1"]'); await reader([{ code: 'KI-26300', title: 'فلتر', qty: 1, unit_price: 20 }]);
    await page.evaluate(() => { const f = window.SP_SCAN_ENGINE; window.SP_SCAN_ENGINE = async (x, s) => ({ ...(await f(x, s)), supplier: '' }); });
    await page.setInputFiles('#rpf', PHOTO); await see('#rwait:not([hidden])', 8000);
    must((await text('#rwait')).includes('المورّد'), 'credit without a supplier waits: ' + await text('#rwait'));
    await page.fill('#rsup', 'مورد آجل'); await page.click('#rsave'); await page.waitForURL(/#purchases/);
    log('on credit with no supplier name on the invoice: it waits for the name, then enters');
    // switched off on this device: the lines wait for the button
    await go('receive'); await page.click('label.rcv-auto'); must(!(await page.isChecked('#rauto')), 'switched off');
    await reader([{ code: 'KI-26300', title: 'فلتر', qty: 1 }]); await page.setInputFiles('#rpf', PHOTO);
    await page.waitForFunction(() => document.querySelectorAll('.rline.ok').length === 1); await page.waitForTimeout(400);
    must(await page.locator('.readcard.done').count() === 0, 'switched off: waits for the button');
    await page.click('label.rcv-auto'); await page.click('#rclr'); await confirm();
    log('the switch turns it off on this device');
    // from the stock page: the photo continues on the receiving screen and goes in
    const pu2 = await db(() => window.__mockdb.purchases.length);
    await go('stock'); await see('#sphoto'); await page.click('label[for="rpay0"]').catch(() => {});
    await reader([{ code: 'HY-58101', title: 'فحمات', qty: 3, unit_price: 100 }]);
    await page.setInputFiles('#spf', PHOTO); await page.waitForURL(/#receive/); await see('.readcard.done', 8000);
    must(await db(() => window.__mockdb.purchases.length) === pu2 + 1, 'photo from the stock page entered');
    log('photo taken from the stock page: entered by itself');

    // ----- the owner closes orders and hides quantities and branches -----
    await go('admin-control'); await see('#kcl');
    await page.click('label:has(#kcl)'); await see('#kcm'); await page.fill('#kcm', 'مسكرين للجرد، نرجعو الأحد');
    await page.click('label:has(#khq)'); await page.click('label:has(#khb)'); await page.fill('#klw', '5'); await page.fill('#kft', 'البضاعة المباعة ما ترجعش بعد 7 أيام');
    await page.click('#kgo'); await page.waitForTimeout(500);
    const st = await db(() => { const s = window.__mockdb.settings; return [s.shop_closed, s.closed_msg, s.hide_qty, s.hide_branches, s.low_stock, s.invoice_footer]; });
    must(JSON.stringify(st) === JSON.stringify([true, 'مسكرين للجرد، نرجعو الأحد', true, true, 5, 'البضاعة المباعة ما ترجعش بعد 7 أيام']), 'controls saved ' + JSON.stringify(st));
    log('controls saved: orders closed with a message, quantities and branches hidden, running low at 5, invoice footer'); await shot('03-controls');
    await logout(); await go(''); await see('.banner.closed');
    must((await text('.banner.closed')).includes('مسكرين للجرد'), 'closed banner on home');
    must(!(await page.locator('.tabs .tab').allInnerTexts()).join('|').includes('الفروع') && await page.locator('#secshops:not([hidden])').count() === 0 && await page.locator('.card-shop').count() === 0, 'no branches tab, section or card lines');
    await shot('04-closed-home');
    const pid = await db(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').id);
    await go('p-' + pid); await see('.pd-title');
    must(await page.locator('#padd').count() === 0 && await page.locator('.pd-info .banner.closed').count() === 1, 'no basket button, closed note');
    must(await page.locator('.pd-shop').count() === 0 && (await text('.specs')).includes('متوفر'), 'no branch block, quantity hidden');
    must(((await page.getAttribute('.actionbar .btn-wa', 'href')) || '').includes('218912345678'), 'WhatsApp goes to the company number');
    log('customer: closed banner, no branches tab, part page without branch or quantity, WhatsApp to the company'); await shot('05-closed-part');
    await go('shops'); await see('.cta'); must(await page.locator('.shops').count() === 0, 'branches page shows the contact card');
    await page.evaluate(id => window.SP.cart.add(id), pid); await go('cart'); await see('.banner.closed');
    must(await page.locator('#ogo').count() === 0, 'basket: nothing to send while closed');
    log('branches page shows how to reach the company; the basket cannot send while closed');
    await login('owner@crossky.ly');
    await go(''); await see('#secshops'); must((await page.locator('.tabs .tab').allInnerTexts()).join('|').includes('الفروع'), 'the owner still sees the branches');

    // ----- staff limits -----
    await go('staff'); await see('.staff-row'); await page.locator('.staff-row').first().click(); await see('#smd');
    must((await page.inputValue('#smd')) === '10', 'the seller has a 10% limit');
    await page.fill('#smd', '150'); await page.click('#stf .btn-signal'); await page.waitForTimeout(200); must((await text('#serr2')).includes('100'), 'limit over 100 refused');
    await page.fill('#smd', '5'); await page.click('#stf .btn-signal'); await page.waitForTimeout(500);
    must((await text('.staff-row')).includes('5٪'), 'staff list shows the limit');
    await login('seller@crossky.ly');
    await go('pos'); await page.fill('#pq', 'KI-26300'); await page.press('#pq', 'Enter'); await see('.pline'); await see('#plim');
    const price = await db(() => window.__mockdb.products.find(p => p.sku === 'KI-26300').price);
    await page.fill('#pdisc', String(Math.ceil(price * 0.2))); await page.waitForTimeout(200);
    must(await page.locator('#plim.over').count() === 1, 'the limit line turns red');
    await page.click('#psave'); await page.waitForFunction(() => document.querySelector('#perr').textContent.length > 3);
    must((await text('#perr')).includes('5٪'), 'over the limit refused: ' + await text('#perr'));
    log('seller limited to 5%: the hint turns red and the sale is refused (' + await text('#perr') + ')'); await shot('06-limit');
    await page.fill('#pdisc', ''); await page.click('#psave'); await page.waitForURL(/#inv-/); await see('.inv-foot');
    must((await text('.inv-foot')).includes('7 أيام'), 'invoice footer printed');
    log('without the discount the sale goes through; the invoice shows the owner footer');

    // ----- prices in bulk -----
    await login('owner@crossky.ly');
    await go('admin-prices'); await see('#bpv');
    const before = await db(() => window.__mockdb.products.filter(p => p.make === 'kia' && p.price != null).map(p => [p.id, p.price]));
    await page.fill('#bpv', '10'); await page.selectOption('#bpr', '5'); await page.selectOption('#bpb', 'kia'); await page.click('#bptry'); await see('#bpgo');
    must((await text('.bp-will b')).includes(String(before.length)), 'preview counts the KIA parts');
    await page.click('#bpgo'); await confirm(); await see('#bpold [data-undo]');
    const after = await db(() => window.__mockdb.products.filter(p => p.make === 'kia' && p.price != null).map(p => [p.id, p.price]));
    must(after.every(([id, v], i) => v === Math.ceil(Math.round(before[i][1] * 110) / 100 / 5 - 1e-9) * 5), 'KIA prices +10% rounded up to 5 ' + JSON.stringify([before, after]));
    log('prices: KIA +10% rounded up to 5 (' + before.map(x => x[1]).join(',') + ' → ' + after.map(x => x[1]).join(',') + ')'); await shot('07-prices');
    await page.click('#bpold [data-undo]'); await confirm(); await page.waitForTimeout(300);
    must(JSON.stringify(await db(() => window.__mockdb.products.filter(p => p.make === 'kia' && p.price != null).map(p => [p.id, p.price]))) === JSON.stringify(before), 'put back');
    log('put back with one tap');

    // ----- the activity log -----
    await go('admin-log'); await see('.log-row');
    const rows = await page.locator('.log-row').allInnerTexts(), all = rows.join('\n');
    must(['بروحها', 'ألغى الاستلام', 'غيّر أسعار', 'رجّع الأسعار', 'غيّر الإعدادات', 'عدّل الموظف', 'باع فاتورة'].every(w => all.includes(w)), 'log lines: ' + rows.slice(0, 12).join(' | '));
    await page.click('[data-g="sales"]'); await page.waitForTimeout(400);
    must((await page.locator('.log-row').allInnerTexts()).every(r => /باع|رجّع فاتورة/.test(r)), 'sales filter');
    await page.click('[data-g="stock"]'); await page.waitForTimeout(400);
    await page.locator('details.log-row summary').first().click(); await see('.log-more');
    log('activity log: ' + rows.length + ' lines on the first page; filters and details work'); await shot('08-log');
    await page.click('[data-g=""]'); await page.waitForTimeout(400);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#lgx')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    must(/^\uFEFFdate,time,person,action,details,amount/.test(csv) && csv.includes('ألغى الاستلام') && csv.split('\n').length > 10, 'log download: ' + csv.slice(0, 200));
    log('the log downloads for Excel (' + (csv.split('\n').length - 1) + ' rows)');
    await go('admin'); await see('.today .astat'); must(await page.locator('.today .log-row').count() > 0, 'today card with the latest activity');
    log('main admin tab: today card and the latest activity'); await shot('09-today');
    await go('admin-company'); await see('#csf'); must(await page.locator('#cpm').count() === 0 && await page.locator('a[href="#admin-control"]').count() > 0, 'price visibility moved to Controls');
    log('company settings point to Controls for price visibility, orders and sign-up');

    // ----- brand marks instead of flags, and a logo picture the company uploads for a brand -----
    must(await page.locator('#blg .blogo').count() >= 10 && (await text('#blg .blogo[data-id="kia"] .bmark')) === 'K', 'a tile per brand shown, with its initials');
    await page.setInputFiles('#blg input[data-up="kia"]', path.join(SITE, 'icons/icon-192.png')); await see('#blg .blogo[data-id="kia"] .bmark.img img');
    await page.click('#cgo'); await page.waitForTimeout(500);
    must(/^data:image\/|^https?:/.test(await db(() => (window.__mockdb.settings.brand_logos || {}).kia || '')), 'logo saved for kia');
    await go(''); await see('.btile .bmark');
    must(await page.locator('.btile .fl').count() === 0 && await page.locator('.btile[href="#b-kia"] .bmark.img img').count() === 1
      && (await text('.btile[href="#b-hyundai"] .bmark')) === 'H', 'home: no flags; kia shows its picture, hyundai its initials');
    await go('brands'); await see('.catrow .bmark'); must(await page.locator('.catrow .bfl').count() === 0, 'brands page without flags');
    await go('b-kia'); await see('.bhead .bmark.img'); await shot('10-brands');
    await go('admin-company'); await see('#blg'); await page.click('#blg [data-rm="kia"]'); await page.click('#cgo'); await page.waitForTimeout(500);
    await go(''); await see('.btile .bmark'); must((await text('.btile[href="#b-kia"] .bmark')) === 'K', 'logo removed: back to the initials');
    log('brands: initials on a hexagon instead of the flag; a logo uploaded for KIA shows everywhere, and removing it brings the initials back');


    // ----- the system on its own tab next to home -----
    const tabs = async () => (await page.locator('.tabs .tab').allInnerTexts()).map(x => x.trim());
    must((await tabs())[1] === 'المنظومة', 'system tab second for the owner: ' + (await tabs()).join('|'));
    await page.click('.tabs a[href="#system"]'); await page.waitForURL(/#system/); await see('.pos-tile'); await see('.today .astat');
    must(await page.locator('.today .log-row').count() === 0 && await page.locator('.pos-tile[href="#pos"]').count() === 1 && await page.locator('.pos-tile[href="#admin-log"]').count() === 1, 'system page: today, sales, accounts, owner tiles');
    await go('pos'); must(await page.locator('.tabs .tab.on').innerText() === 'المنظومة', 'the system tab stays lit on the point of sale');
    await shot('11-system');
    await logout(); await go('');
    must(!(await tabs()).includes('المنظومة'), 'customers have no system tab: ' + (await tabs()).join('|'));
    await go('system'); await see('.empty'); must((await text('.empty')).includes('ادخل'), 'system asks to sign in');
    await page.click('.empty a[href="#login"]'); await see('#ap'); if (await page.locator('[data-by="email"]').count()) await page.click('[data-by="email"]'); await see('#ae'); await page.fill('#ae', 'seller@crossky.ly'); await page.fill('#ap', '123456'); await page.click('#ago');
    await page.waitForURL(/#system/); await see('.pos-tile');
    must((await tabs())[1] === 'المنظومة' && await page.locator('.pos-tile[href="#pos"]').count() === 1 && await page.locator('.pos-tile[href="#admin-log"]').count() === 0, 'the seller: system tab, own tiles, no owner tiles');
    log('system tab next to home for the owner and staff (today, sales, accounts, owner tiles); customers do not see it; signing in from it comes back to it');

    // ----- Face ID (passkeys) -----
    await login('owner@crossky.ly'); await see('#bioon', 8000);
    await page.click('#bioon'); await see('.bio-card.on', 8000);
    must(await db(() => window.__mockdb.passkeys.length) === 1 && (await text('.bio-list')).length > 0, 'passkey saved and listed');
    await logout(); await go('login'); await see('#abg', 8000);
    await page.click('#abg'); await page.waitForURL(/#mine/, { timeout: 8000 }); await see('.acct');
    must((await text('.acct')).includes('owner@crossky.ly'), 'signed in with the passkey');
    const used = await db(() => window.__mockdb.passkeys[0].last_used_at);
    must(!!used, 'last use recorded');
    log('Face ID: turned on from the account page, then signed in with one tap (no email or password)'); await shot('12-faceid');
    await page.click('.bio-list [data-del]'); await confirm(); await see('#bioon:not(.btn-ghost)', 6000);
    must(await db(() => window.__mockdb.passkeys.length) === 0, 'removed');
    await logout(); await go('login'); await see('#abg', 8000); await page.click('#abg');
    await page.waitForFunction(() => document.querySelector('#aerr').textContent.length > 5);
    must((await text('#aerr')).includes('كلمة السر'), 'removed passkey no longer signs in: ' + await text('#aerr'));
    log('removed it from the account page: that passkey no longer signs in, and the page says to use the password');

    if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'));
    console.log('\nCONTROLS PASSED (' + step + ' checks)');
  } catch (e) {
    console.error('\nFAILED at step ' + (step + 1) + ': ' + e.message); if (errors.length) console.error(errors.join('\n'));
    await shot('zz-failure').catch(() => {}); process.exitCode = 1;
  } finally { await browser.close(); }
})();
