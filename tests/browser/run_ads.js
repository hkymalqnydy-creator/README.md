// Ads at the top of the home screen (company edition): the edition's ad (a Nissan Patrol photo that opens the Patrol parts),
// the owner's page to add, edit, order, hide, end and delete ads, the turns between several ads, where a tap goes, the checks
// on links, staff without the right, phones that had the demo before the ads, reduced motion and English (left to right).
// Same set-up as run_company.js (in-browser demo backend, Chrome); images.pexels.com is answered with a local picture or blocked.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const ROOT = path.resolve(__dirname, '../..'), SITE = process.env.SITE || ROOT, ORIGIN = 'https://crossky.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
const ADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/ads.json'), 'utf8')).map(a => Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))));
const EXTRA = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding/crossky/demo.json'), 'utf8'));
const CONFIG = `window.SPARAT_CONFIG={mode:'company',appName:'CROSSKY',demo:true,demoEmail:'owner@crossky.ly',defaultCountry:'LY',noServiceWorker:true,skin:'royal',siteUrl:'https://crossky.test/',demoAds:${JSON.stringify(ADS)},demoExtra:${JSON.stringify(EXTRA)}};`;
const errors = []; let step = 0, photo = true;
const log = s => console.log(`${++step}. ${s}`);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-LY', serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'images.pexels.com') return photo ? route.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(ROOT, 'img/parts/radiator.jpg')) }) : route.abort();
    if (u.origin + '/' !== ORIGIN) return route.abort();
    const p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
    if (p === '/config.js' && !process.env.SITE) return route.fulfill({ contentType: 'text/javascript', body: CONFIG });
    const f = path.join(SITE, p);
    return fs.existsSync(f) ? route.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'ad-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const text = async sel => (await page.locator(sel).first().innerText()).trim();
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(400); };
  const home = async () => { await go('vin'); await go(''); await see('#gnew .card'); await page.waitForTimeout(300); };
  const db = (f, a) => page.evaluate(f, a);
  const login = async e => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } await go('login'); await see('#ae');
    await page.fill('#ae', e); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/); await page.waitForTimeout(300); };
  const logout = async () => { await go('mine'); if (await page.locator('#lo').count()) { await page.click('#lo'); await page.waitForTimeout(400); } };
  const current = () => page.evaluate(() => [...document.querySelectorAll('.ads-dots button')].findIndex(b => b.getAttribute('aria-current') === 'true'));
  const ads = () => db(() => window.__mockdb.settings.ads);
  const openAd = async i => { await go('admin-ads'); await see('#adl'); await page.click(`[data-edit="${i}"]`); await see('#adf'); };
  const saveAd = async () => { await page.click('#adsave'); await page.locator('#adf').waitFor({ state: 'detached', timeout: 6000 }); await page.waitForTimeout(300); };
  try {
    // ----- a customer sees the Patrol ad first, and it opens the Patrol parts -----
    await page.goto(ORIGIN); await see('#gnew .card'); await page.waitForTimeout(500);
    must(await db(() => document.querySelector('.hero .wrap').firstElementChild.classList.contains('ads')), 'the ad opens the hero, above the headline and the search');
    must(await page.locator('.ad').count() === 1 && await page.locator('.ads-dots').count() === 0 && await page.locator('.ads-edit').count() === 0, 'one ad, no dots, no pencil for a customer');
    must(await text('.ad-t') === 'قطع غيار نيسان باترول' && (await text('.ad-cta')).includes('تسوّق قطع الباترول'), 'the ad words');
    const img = await db(() => { const i = document.querySelector('.ad-img'); return { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 && !i.classList.contains('broken'), alt: i.alt }; });
    must(img.src.startsWith('https://images.pexels.com/photos/12138615/') && img.ok && img.alt === '', 'the Patrol photo loads ' + JSON.stringify(img));
    log('a customer opens the app: the Nissan Patrol ad is the first thing at the top, with its photo, title and button'); await shot('01-home');
    await page.click('.ad'); await page.waitForURL(/#search/); await see('#grid .card');
    const res = await db(() => [...document.querySelectorAll('#grid .card')].map(c => c.innerText));
    must(res.length === 5 && res.every(x => x.includes('باترول')) && (await text('#rc')).includes('5'), 'the ad opens the 5 Patrol parts ' + JSON.stringify(res.length));
    log('tapping the ad searches for «باترول»: the 5 Patrol parts (pads, oil filter, shocks, radiator, headlight)'); await shot('02-patrol-parts');

    // ----- without the photo (offline, or blocked) the card keeps the brand look -----
    photo = false; await go(''); await page.reload(); await see('#gnew .card'); await page.waitForTimeout(600);
    const off = await db(() => { const a = document.querySelector('.ad'); return { broken: a.querySelector('.ad-img').classList.contains('broken'), stripe: getComputedStyle(a, '::after').content, text: a.innerText }; });
    must(off.broken && off.stripe !== 'none' && off.text.includes('قطع غيار نيسان باترول'), 'no photo: gradient, stripe and words ' + JSON.stringify(off));
    log('when the photo can\'t load, the ad stays readable on the brand gradient with the red stripe'); await shot('03-no-photo');
    photo = true;

    // ----- the owner: pencil on the banner, the ads page, a second ad with a photo from the phone -----
    await login('owner@crossky.ly');
    await home(); await see('.ads-edit');
    await page.click('.ads-edit'); await page.waitForURL(/#admin-ads/); await see('#adl .adrow');
    must(await page.locator('.admintabs a[href="#admin-ads"][aria-current="page"]').count() === 1 && await page.locator('#adl .adrow').count() === 1, 'ads page from the pencil, one ad');
    await go('system'); await see('.pos-tile[href="#admin-ads"]');
    log('the owner sees a pencil on the ad, the «الإعلانات» tab in the owner panel and a tile on the System tab');
    await go('admin-ads'); await see('#adnew'); await page.click('#adnew'); await see('#adf');
    must(await page.locator('#adpv .ad.noimg').count() === 1 && await page.locator('#adposw').isHidden(), 'empty preview, no text position without a photo');
    await page.click('#adsave'); must((await text('#aderr')).length > 0, 'needs a title or a picture');
    await page.fill('#adt', 'تخفيضات فحمات كيا'); await page.fill('#ads2', 'خصم 15٪ على فحمات سبورتاج وسيراتو');
    await page.click('#adsave'); must((await text('#aderr')) === 'اكتب كلمة يبحث عليها', 'search needs words');
    await page.setInputFiles('#adfile', path.join(ROOT, 'img/parts/brake-pads.jpg'));
    await page.waitForFunction(() => { const i = document.querySelector('#adpv .ad-img'); return i && i.src.startsWith('data:image/'); }, null, { timeout: 8000 });
    must(await page.locator('#adposw').isVisible() && (await text('#adplt')) === 'بدّل الصورة', 'with a photo: text position and change picture');
    await page.click('label[for="adgo-b"]'); await page.selectOption('#adto', 'kia');
    await page.click('label[for="adpos-bottom"]');
    must(await page.locator('#adpv .ad.pos-bottom').count() === 1 && (await text('#adpv .ad-t')) === 'تخفيضات فحمات كيا', 'live preview follows the form');
    await shot('04-editor');
    await saveAd();
    let A = await ads();
    must(A.length === 2 && A[1].title === 'تخفيضات فحمات كيا' && A[1].go === 'b' && A[1].to === 'kia' && A[1].pos === 'bottom' && A[1].img.startsWith('data:image/') && A[1].on === true, 'second ad saved ' + JSON.stringify(A[1]).slice(0, 200));
    must(await page.locator('#adl .adrow').count() === 2, 'two rows');
    log('the owner adds a second ad: title, line, a photo from the phone, opens the Kia brand, words at the bottom; the preview follows every change'); await shot('05-list');

    // ----- two ads take turns, the dots follow, a dot jumps -----
    await home();
    must(await page.locator('.ad').count() === 2 && await page.locator('.ads-dots button').count() === 2 && await current() === 0, 'two slides, two dots');
    await page.mouse.move(5, 830); await page.waitForTimeout(6700);
    must(await current() === 1, 'turned to the second ad by itself');
    log('with two ads they take turns by themselves every 6 seconds and the dots follow'); await shot('06-second-ad');
    await page.click('.ads-dots button >> nth=0'); await page.waitForTimeout(900); must(await current() === 0, 'dot goes back to the first');
    await page.click('.ads-dots button >> nth=1'); await page.waitForTimeout(900);
    await page.click('.ad >> nth=1'); await page.waitForURL(/#b-kia/);
    log('a dot jumps to its ad, and the second ad opens the Kia brand page');

    // ----- hide, end, order -----
    await openAd(1); await page.click('label.switch:has(#adon) span'); must(!(await page.isChecked('#adon')), 'switch off'); await saveAd();
    must(await page.locator('.adrow.off').count() === 1 && (await text('.adrow.off .pill')) === 'مخفي', 'hidden in the list');
    await home(); must(await page.locator('.ad').count() === 1 && await page.locator('.ads-dots').count() === 0, 'hidden ad not on home');
    log('hiding an ad takes it off the home screen; the list says «مخفي»');
    const yday = await db(() => { const d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    await openAd(1); await page.click('label.switch:has(#adon) span'); must(await page.isChecked('#adon'), 'switch on'); await page.fill('#adu', yday); await saveAd();
    must((await text('.adrow.off .pill')) === 'خلص وقته', 'ended in the list');
    await home(); must(await page.locator('.ad').count() === 1, 'ended ad not on home');
    log('an ad whose last day has passed stops by itself; the list says «خلص وقته»');
    await openAd(1); await page.fill('#adu', ''); await saveAd();
    await page.click('[data-up="1"]'); await page.waitForTimeout(500);
    A = await ads(); must(A[0].title === 'تخفيضات فحمات كيا' && A[1].id === 'patrol', 'moved up');
    await home(); must((await text('.ad-t')) === 'تخفيضات فحمات كيا' && await page.locator('.ad').count() === 2, 'order on home');
    log('moving an ad up changes the order on the home screen');

    // ----- where a tap goes: WhatsApp, a web page, and nothing unsafe -----
    await openAd(0); await page.click('label[for="adgo-wa"]'); await page.fill('#adto', 'السلام عليكم، نبي فحمات كيا'); await saveAd();
    await home(); const wa = await page.getAttribute('.ad >> nth=0', 'href');
    must(wa.startsWith('https://wa.me/218912345678?text=') && decodeURIComponent(wa).includes('نبي فحمات كيا') && await page.getAttribute('.ad >> nth=0', 'target') === '_blank', 'WhatsApp link ' + wa);
    await openAd(0); await page.click('label[for="adgo-url"]'); await page.fill('#adto', 'javascript:alert(1)'); await page.click('#adsave');
    must((await text('#aderr')) === 'الرابط لازم يبدا بـ https://', 'refuses a link that isn\'t https');
    await page.fill('#adto', 'https://example.com/kia'); await saveAd();
    await home(); must(await page.getAttribute('.ad >> nth=0', 'href') === 'https://example.com/kia' && await page.getAttribute('.ad >> nth=0', 'rel') === 'noopener', 'web link');
    await db(() => { const S = window.SP.S; S.settings.ads = S.settings.ads.map((a, i) => i ? a : { ...a, go: 'url', to: 'javascript:alert(1)', img: 'javascript:alert(2)', title: '<img src=x onerror=alert(3)>' }); });
    await go('vin'); await go(''); await see('.ad');
    const bad = await db(() => { const a = document.querySelector('.ad'); return { tag: a.tagName, href: a.getAttribute('href'), imgs: a.querySelectorAll('img').length, t: a.querySelector('.ad-t').textContent, html: a.innerHTML.includes('onerror=') && !a.innerHTML.includes('&lt;img') }; });
    must(bad.tag === 'DIV' && bad.href === null && bad.imgs === 0 && bad.t === '<img src=x onerror=alert(3)>' && !bad.html, 'unsafe link and picture are not used ' + JSON.stringify(bad));
    const chk = await db(async () => { const r = []; for (const v of [[{ go: 'url', to: 'javascript:alert(1)' }], { a: 1 }, Array.from({ length: 6 }, (x, i) => ({ id: 'x' + i, title: 't' }))]) {
      const x = await window.SP.sb.from('settings').update({ ads: v }).eq('id', 1).select().maybeSingle(); r.push(x.error && x.error.code); } return r; });
    must(JSON.stringify(chk) === '["23514","23514","23514"]', 'the demo refuses what the database refuses ' + JSON.stringify(chk));
    await page.reload(); await see('#gnew .card');
    log('a tap can open WhatsApp with a written message or an https page; a "javascript:" link or picture is never used, words are shown as text, and the backend refuses bad ads like the database does');

    // ----- delete, and the log -----
    await openAd(0); await page.click('#addel'); await see('[data-ok]'); await page.click('[data-ok]'); await page.locator('#adf').waitFor({ state: 'detached', timeout: 6000 });
    A = await ads(); must(A.length === 1 && A[0].id === 'patrol', 'deleted');
    const L = await db(() => window.__mockdb.activity.filter(x => x.kind === 'settings' && x.detail.keys.includes('ads')));
    must(L.length >= 7 && L.every(x => !('ads' in (x.detail.changes || {}))), 'log names the change without copying the ads ' + L.length);
    await go('admin-log'); await see('.log-row, .lg-row, #lgl'); await page.waitForTimeout(500);
    must((await text('#lgl')).includes('إعلانات الرئيسية'), 'log reads «إعلانات الرئيسية»');
    log('deleting asks first; every change shows in the activity log as «إعلانات الرئيسية» without copying the ads');

    // ----- staff without the right, phones that had the demo before -----
    await login('seller@crossky.ly'); await home();
    must(await page.locator('.ad').count() === 1 && await page.locator('.ads-edit').count() === 0, 'seller sees the ad, no pencil');
    await go('admin-ads'); must(await page.locator('#adl').count() === 0 && (await text('main')).includes('للإدارة فقط'), 'seller can\'t open the ads page');
    log('a seller sees the ad but has no pencil and no ads page');
    await logout(); await go('');
    await db(() => { const k = Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)), D = JSON.parse(localStorage.getItem(k)); delete D.settings.ads; D.products = D.products.filter(p => !/^PT-/.test(p.sku)); localStorage.setItem(k, JSON.stringify(D)); });
    await page.reload(); await see('#gnew .card');
    const mig = await db(() => ({ ads: window.__mockdb.settings.ads.map(a => a.id), pt: window.__mockdb.products.filter(p => /^PT-/.test(p.sku)).length, saved: !!JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)))).settings.ads }));
    must(JSON.stringify(mig.ads) === '["patrol"]' && mig.pt === 5 && mig.saved && await page.locator('.ad').count() === 1, 'old demo gets the ad and the Patrol parts ' + JSON.stringify(mig));
    await db(() => { const k = Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)), D = JSON.parse(localStorage.getItem(k)); D.settings.ads = []; localStorage.setItem(k, JSON.stringify(D)); });
    await page.reload(); await see('#gnew .card');
    must(await page.locator('.ads').count() === 0 && (await ads()).length === 0, 'an owner who deleted every ad keeps none');
    log('a phone that had the demo before the ads gets the Patrol ad and its 5 parts once; an owner who deleted all ads keeps none');

    // ----- reduced motion, English -----
    await db(a => { localStorage.setItem(Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)), JSON.stringify({ ...JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)))), settings: { ...JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => /^sp_demo_db_v\d+_crossky$/.test(x)))).settings, ads: a } })); },
      [ADS[0], { id: 'b2', img: '', title: 'Delivery to every city', sub: 'Order from home, we bring it to you', cta: 'Order now', go: 'q', to: 'pads', pos: '', until: '', on: true }]);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); await see('.ads-dots');
    await page.mouse.move(5, 830); await page.waitForTimeout(6800); must(await current() === 0, 'no turns with reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    log('with «reduce motion» on the phone, the ads never move by themselves');
    await db(() => { localStorage.setItem('sp_lang', JSON.stringify('en')); }); await page.reload(); await see('.ad');
    const side = i => db(k => { const a = document.querySelectorAll('.ad')[k], r = a.getBoundingClientRect(), c = a.querySelector('.ad-copy').getBoundingClientRect(), ar = a.querySelector('.ad-cta .ic').getBoundingClientRect();
      return { dir: a.getAttribute('dir'), side: c.left - r.left < r.right - c.right ? 'left' : 'right', arrow: ar.left > a.querySelector('.ad-cta').getBoundingClientRect().left + 20 ? 'after-text-right' : 'after-text-left' }; }, i);
    const en0 = await side(0), en1 = await side(1);
    must(await db(() => document.documentElement.dir) === 'ltr' && en0.dir === 'rtl' && en0.side === 'right' && en1.dir === 'ltr' && en1.side === 'left', 'each ad reads in its own direction ' + JSON.stringify([en0, en1]));
    log('in the English app an Arabic ad still reads right to left, and an ad written in English reads left to right'); await shot('07-english');
    await db(() => { localStorage.setItem('sp_lang', JSON.stringify('ar')); });

    must(!errors.length, errors.join(' | '));
    console.log(`\nALL ${step} ADS CHECKS PASSED`);
  } catch (e) {
    console.error('\nFAILED:', e.message); await shot('fail').catch(() => {}); if (errors.length) console.error(errors.join('\n')); process.exitCode = 1;
  }
  await browser.close();
})();
