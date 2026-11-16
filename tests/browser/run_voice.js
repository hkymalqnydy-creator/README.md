// Talking to the assistant (a stand-in for the phone's speech recognition and voice): the System tab's voice bar listens,
// what is said goes by itself, the answer is read out, «نفّذ» said back makes the sales invoice; «زوز» counts as two.
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
  // the phone's speech recognition and voice, played by the test: each start() hears the next phrase in window.__said
  await ctx.addInitScript(() => {
    window.__said = []; window.__spoken = [];
    class FakeSR { start() { const txt = window.__said.shift() || ''; setTimeout(() => { if (txt && this.onresult) this.onresult({ results: [[{ transcript: txt }]] }); if (this.onend) this.onend(); }, 250); } stop() { if (this.onend) this.onend(); } }
    window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { if (u.text && u.text.trim()) window.__spoken.push({ text: u.text, lang: u.lang }); }, cancel() {}, getVoices() { return [{ lang: 'ar-SA', name: 'ar' }]; } } });
    window.SpeechSynthesisUtterance = function (x) { this.text = x; };
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  const shot = n => page.screenshot({ path: path.join(__dirname, 'shots', 'voice-' + n + '.png') });
  const see = (sel, ms) => page.locator(sel).first().waitFor({ state: 'visible', timeout: ms || 6000 });
  const must = (c, m) => { if (!c) throw new Error('assert: ' + m); };
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(450); };
  const db = (f, a) => page.evaluate(f, a);
  try {
    await page.goto(ORIGIN); await page.waitForTimeout(1200);
    await go('login'); await see('#ap'); await page.click('[data-by="email"]'); await page.fill('#ae', 'owner@crossky.ly'); await page.fill('#ap', '123456'); await page.click('#ago'); await page.waitForURL(/#mine/);
    await go('system'); await see('#sysvoice');
    const before = await db(() => window.__mockdb.invoices.length);
    await db(() => window.__said.push('بيع زوز فلتر زيت باترول كاش'));
    await page.click('#sysvoice'); await see('.aibox:not([hidden])'); await page.waitForTimeout(1500);
    const msgs = await page.locator('#ailog .aimsg.me').allInnerTexts();
    must(msgs.some(x => x.includes('بيع زوز فلتر زيت باترول')), 'what was said went by itself: ' + JSON.stringify(msgs));
    await see('#ailog [data-go]', 8000);
    const card = await page.locator('#ailog .aimsg.ai').last().innerText();
    must(/باترول/.test(card) && /2/.test(card), 'a sales invoice for two Patrol oil filters, waiting for «نفّذ»: ' + card.replace(/\s+/g, ' ').slice(0, 160));
    const spoken = await db(() => window.__spoken.map(x => x.text).join(' | '));
    must(/نفّذ/.test(spoken), 'the answer read out, with how to go ahead: ' + spoken.slice(0, 200));
    await shot('01-proposed');
    log('the voice bar on the System tab: «بيع زوز فلتر زيت باترول كاش» goes by itself; a sales invoice for 2 is proposed and read out');
    await db(() => window.__said.push('نفّذ'));
    await page.click('#aimic'); await page.waitForTimeout(1800);
    const after = await db(() => window.__mockdb.invoices.length), last = await db(() => { const v = window.__mockdb.invoices[window.__mockdb.invoices.length - 1]; const it = window.__mockdb.invoice_items.filter(x => x.invoice_id === v.id); return { payment: v.payment, lines: it.map(x => x.title + ' × ' + x.qty) }; });
    must(after === before + 1 && last.payment === 'cash' && last.lines.length === 1 && /باترول/.test(last.lines[0]) && / × 2$/.test(last.lines[0]), 'saying «نفّذ» made it: ' + JSON.stringify(last));
    must((await db(() => window.__spoken.length)) >= 2, 'and said it was done');
    await shot('02-done');
    log('«نفّذ» said back: the sales invoice is made (2 × Patrol oil filter, cash) and the assistant says so');
    if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
    console.log('\nALL ' + step + ' VOICE CHECKS PASSED');
  } catch (e) {
    console.error('FAILED at step ' + (step + 1) + ': ' + e.message);
    if (errors.length) console.error(errors.join('\n'));
    await shot('zz-fail').catch(() => {});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
