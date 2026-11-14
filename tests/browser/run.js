const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const SITE = process.env.SITE || path.resolve(__dirname, '../..'), ORIGIN = 'https://sparat.test/';
const MOCK = 'window.supabase={createClient:()=>window.SPARAT_DEMO.create({seed:false,persist:false})};';
const JPG = fs.readFileSync(path.join(__dirname, 'part1.jpg'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
let vpicMode = 'ok', step = 0;
const errors = [];
function log(s) { console.log(`${++step}. ${s}`); }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin + '/' === ORIGIN) {
      let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
      if (p === '/config.js') return route.fulfill({ contentType: 'text/javascript', body: "window.SPARAT_CONFIG={supabaseUrl:'https://test.supabase.co',supabaseKey:'anon',siteUrl:'https://sparat.test/',defaultCountry:'LY',noServiceWorker:true};" });
      const f = path.join(SITE, p);
      if (!f.startsWith(SITE) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
      return route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (u.hostname === 'cdn.jsdelivr.net') return route.fulfill({ contentType: 'text/javascript', body: MOCK });
    if (u.hostname === 'test.supabase.co' && u.pathname.includes('/storage/v1/object/public/')) return route.fulfill({ contentType: 'image/jpeg', body: JPG });
    if (u.hostname === 'vpic.nhtsa.dot.gov') {
      if (vpicMode === 'down') return route.abort('internetdisconnected');
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ Count: 1, Results: [{ Make: 'HYUNDAI', Model: 'Accent', ModelYear: '2014', Trim: 'GLS', BodyClass: 'Sedan/Saloon', DisplacementL: '1.6', EngineCylinders: '4', EngineHP: '138', FuelTypePrimary: 'Gasoline', DriveType: 'FWD/Front-Wheel Drive', TransmissionStyle: 'Automatic', PlantCountry: 'SOUTH KOREA', PlantCity: 'ULSAN', Manufacturer: 'HYUNDAI MOTOR COMPANY', ErrorCode: '0' }] }) });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', n + '.png') });
  const see = async (sel, ms) => { await page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 }); };
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const pick = async sel => { const id = await page.getAttribute(sel, 'id'); await page.click(`label[for="${id}"]`); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(250); };
  try {
    await page.goto(ORIGIN);
    await see('.hero h1'); log('home renders in Arabic, dir=' + await page.evaluate(() => document.documentElement.dir));
    must(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'rtl');
    await see('#gnew .empty'); must((await text('#gnew .empty h3')).length > 3, 'empty store message'); log('empty store state shown');
    must(await page.locator('.btile').count() >= 10, 'brand tiles'); must(await page.locator('.cats .cat').count() === 8, '8 category tiles');
    await shot('01-home-empty');

    await go('mine'); await see('.onb'); await shot('02-mine-signed-out');
    await page.click('a[href="#signup"]'); await see('#ae');
    await page.fill('#ae', 'owner@test.ly'); await page.fill('#ap', '123'); await page.click('#ago');
    must((await text('#aerr')).length > 0, 'short password error'); log('password validation works');
    await page.fill('#ap', 'secret123'); await page.click('#ago');
    await see('.admin-entry'); log('first account is admin');
    await page.click('a[href="#new-shop"]'); await see('#sn');
    await page.setInputFiles('#lgf', path.join(__dirname, 'part2.jpg')); await page.waitForFunction(() => document.querySelector('#lgi img'));
    await page.setInputFiles('#cvf', path.join(__dirname, 'part1.jpg')); await page.waitForFunction(() => document.querySelector('#cvp img'));
    await page.fill('#sn', 'الأمانة لقطع الغيار الكورية'); await page.fill('#sp', 'محمد');
    await page.click('#sgo'); must((await text('#serr')).length > 0, 'whatsapp required'); log('shop validation: ' + await text('#serr'));
    await page.fill('#sw', '0912345678'); await page.fill('#sc', 'طرابلس'); await page.fill('#sa', 'سوق الثلاثاء');
    await pick('#makes input[value="hyundai"]'); await pick('#makes input[value="kia"]');
    await page.selectOption('#mkmore', 'ssangyong'); await page.waitForTimeout(100);
    must(await page.locator('#makes input[value="ssangyong"]:checked').count() === 1, 'extra brand added and checked');
    must(await page.locator('#makes input[value="hyundai"]:checked').count() === 1, 'checked brands survive redraw');
    await shot('03-shop-form');
    await page.click('#sgo'); await page.waitForURL(/#new-item-/); await see('#it'); log('shop saved, now on the add-part form');
    const shopId = page.url().split('#new-item-')[1];
    const shopRow = await page.evaluate(id => window.__mockdb.shops.find(s => s.id === id), shopId);
    must(shopRow.country === 'LY' && shopRow.currency === 'LYD' && shopRow.makes.join() === 'hyundai,kia,ssangyong' && shopRow.logo && shopRow.cover, 'shop row ' + JSON.stringify(shopRow));

    await page.setInputFiles('#phf', [path.join(__dirname, 'part1.jpg'), path.join(__dirname, 'part2.jpg')]);
    await page.waitForFunction(() => document.querySelectorAll('#ph .ph img').length === 2 && !document.querySelector('#ph .busy'), null, { timeout: 8000 });
    await page.fill('#it', 'فحمات فرامل أمامية'); await page.selectOption('#ic', 'brakes'); await pick('#cd0');
    await page.fill('#ip', '١٥٠'); await page.selectOption('#imake', 'hyundai'); await page.selectOption('#imodel', 'Accent');
    await page.selectOption('#iyf', '2011'); await page.selectOption('#iyt', '2017'); await page.fill('#ipn', '58101-1ra00');
    must((await text('#iprod')).length > 0, 'production years hint');
    await shot('04-item-form');
    await page.click('#iadd'); await page.waitForFunction(() => document.querySelector('#it').value === '' && !document.querySelector('#ph img'), null, { timeout: 6000 });
    log('saved and ready for the next part (arabic digits price accepted)');
    const p1 = await page.evaluate(() => window.__mockdb.products[0]);
    must(p1.price === 150 && p1.model === 'Accent' && p1.y_from === 2011 && p1.part_no === '58101-1RA00' && p1.imgs.length === 2, 'product row ' + JSON.stringify(p1));
    must(p1.search_text.includes('hyundai') && p1.search_text.includes('هيونداي'), 'search text has brand names: ' + p1.search_text.slice(0, 120));
    await page.fill('#it', 'بطارية 70 أمبير'); await page.selectOption('#ic', 'electrical'); await pick('#cd1');
    await page.fill('#ip', '520'); await page.selectOption('#imake', 'any'); await page.click('#igo');
    await page.waitForURL(/#p-/); await see('.pd-title'); must((await text('.pd-title')) === 'بطارية 70 أمبير', 'product title');
    log('second part published, product page: ' + (await text('.pd-price')).replace(/\s+/g, ' '));
    await shot('05-product');

    await go(''); await see('#gnew .card'); must(await page.locator('#gnew .card').count() === 2, 'two cards on home'); await shot('06-home-filled');
    await page.fill('#hs input', 'تيل'); await page.press('#hs input', 'Enter'); await page.waitForURL(/#search/);
    await page.waitForFunction(() => document.querySelector('#rc') && /1/.test(document.querySelector('#rc').textContent));
    must((await text('#grid .card-title')) === 'فحمات فرامل أمامية', 'synonym search'); log('synonym search "تيل" finds brake pads');
    await page.fill('#sq input', 'battery'); await page.press('#sq input', 'Enter'); await page.waitForTimeout(400);
    must((await text('#grid .card-title')) === 'بطارية 70 أمبير', 'cross-language search'); log('English "battery" finds the Arabic battery listing');
    await page.fill('#sq input', 'accent 2020'); await page.press('#sq input', 'Enter'); await page.waitForTimeout(400);
    must(await page.locator('#grid .card').count() === 0, 'year outside range filtered'); log('"accent 2020" excluded (fits 2011-2017)');
    await shot('07-search-empty');

    await go(''); await see('.plate'); await page.click('.plate'); await see('#cvin');
    await page.fill('#cvin', 'kmhct41dbeu123456'); await page.click('#cvgo');
    await page.waitForFunction(() => document.querySelector('#cmodel').value === 'Accent', null, { timeout: 6000 });
    must(await page.inputValue('#cmake') === 'hyundai' && await page.inputValue('#cyear') === '2014', 'VIN filled the car');
    log('VIN in car sheet -> ' + await text('#cvmsg'));
    await shot('08-car-sheet-vin');
    await page.click('#carf .btn-signal'); await page.waitForTimeout(300);
    await see('#gfit .card'); must((await text('#gfit .card-title')) === 'فحمات فرامل أمامية', 'fits section'); log('"fits your car" shows the Accent pads');
    await page.click('#gfit .card-link'); await see('.fitbox em.ok');
    const wa = await page.getAttribute('.actionbar .btn-wa', 'href');
    must(wa.includes('wa.me/218912345678') && decodeURIComponent(wa).includes('KMHCT41DBEU123456'), 'whatsapp link ' + wa);
    log('WhatsApp link uses +218 and includes the VIN');
    await page.click('.fav-top'); await page.waitForTimeout(200);

    await go('admin'); await see('.astat'); await see('.arow');
    await page.click('.arow [data-v]'); await see('.arow .vb'); log('admin verified the shop');
    await page.fill('#snt', 'التسجيل مجاني للمحلات'); await page.click('#stgo'); await page.waitForTimeout(300);
    await shot('09-admin');

    await go('mine'); await see('#lo'); await shot('10-mine-owner'); await page.click('#lo'); await page.waitForTimeout(400); await see('.onb');
    await go('signup'); await see('#ae'); await page.fill('#ae', 'second@test.ly'); await page.fill('#ap', 'secret456'); await page.click('#ago');
    await see('.onb a[href="#new-shop"]'); must(await page.locator('.admin-entry').count() === 0, 'second user not admin'); log('second account is not admin');
    await go('admin'); await see('.empty'); log('admin page refused: ' + await text('.empty h3'));
    await go('edit-shop-' + shopId); await see('.empty'); log('edit other shop refused: ' + await text('.empty h3'));
    await go('new-item-' + shopId); await see('.empty'); log('add part to other shop refused');

    await go('favs'); await see('#grid .card'); log('favourites list has the saved part');
    await go(''); await see('.banner.note'); must((await text('.banner.note')).includes('مجاني'), 'notice banner'); log('admin notice shows on home');

    await page.click('[data-act="lang"]'); await see('[data-l="en"]'); await page.click('[data-l="en"]'); await see('.hero h1');
    must(await page.evaluate(() => document.documentElement.dir) === 'ltr', 'ltr'); log('English: ' + await text('.hero h1'));
    await shot('11-home-en');
    await page.click('[data-act="lang"]'); await page.click('[data-l="zh"]'); await see('.hero h1'); log('Chinese: ' + await text('.hero h1'));
    await page.click('[data-act="lang"]'); await page.click('[data-l="ar"]'); await see('.hero h1');

    await page.click('[data-act="loc"]'); await see('#chcc'); await page.click('#chcc'); await see('#ccq');
    await page.fill('#ccq', 'مصر'); await page.waitForTimeout(250); await page.click('#cclist [data-c="EG"]'); await see('#gnew .empty');
    must((await text('.citypill')).includes('مصر'), 'country pill'); log('switched to Egypt: store empty there'); await shot('12-egypt');
    await page.click('[data-act="loc"]'); await page.click('#chcc'); await page.fill('#ccq', 'libya'); await page.waitForTimeout(250); await page.click('#cclist [data-c="LY"]');
    await see('#gnew .card'); log('back to Libya');

    await go('brands'); await see('.bl .catrow'); await page.fill('#bq input', 'تويوتا'); await page.waitForTimeout(250);
    must(await page.locator('.bl .catrow:visible').count() === 1, 'brand search'); await page.click('.bl .catrow:visible'); await see('.ml .catrow');
    log('Toyota models listed: ' + await page.locator('.ml .catrow').count()); await shot('13-brand');
    await page.click('.ml .catrow >> nth=0'); await page.waitForURL(/#search/); await see('.chips.light .chip'); log('model tap opens filtered search: ' + await text('.chips.light .chip'));

    vpicMode = 'down';
    await go('vin'); await see('#vin'); await page.fill('#vin', 'JTDKN3DU0A0000000'); await page.click('#vgo'); await see('.vincard');
    log('VIN offline: ' + (await text('.vin-head b')) + ' | ' + (await text('.vincard .banner')).slice(0, 60));
    await page.fill('#vin', 'ZVW30-1234567'); await page.click('#vgo'); await see('#vres .banner.warn'); log('JDM frame number explained');
    await page.fill('#vin', 'WDD2050461F0O0000'); await page.click('#vgo'); await see('.vincard'); log('O->0 fix + Mercedes: ' + await text('.vin-head b'));
    await shot('14-vin');

    await go('cats'); await see('.catrow .cr-n'); await go('shops'); await see('.shop-row'); log('shops list: ' + await text('.shop-row .sr-name'));
    await page.click('.shop-row'); await see('.sp-name'); await shot('15-shop');
    await page.emulateMedia({ colorScheme: 'dark' }); await go(''); await see('#gnew .card'); await shot('16-home-dark'); await page.emulateMedia({ colorScheme: 'light' });

    if (errors.length) throw new Error('browser errors:\n' + errors.join('\n'));
    console.log('\nALL PASSED (' + step + ' checks)');
  } catch (e) {
    console.error('\nFAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-failure').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
