// node render.js preview|final [scene ...]  → out/prev-N.png (480x360) or out/full-N.png (1800x1350, downsized later)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
const MODE = process.argv[2] || 'preview', ONLY = process.argv.slice(3).map(Number);
// scene: target, azimuth (rad, 0 = from +z), elevation (rad), distance, vertical fov (deg)
const SHOTS = {
  0: { tgt: [1, 0.6, -0.5], az: 0.35, el: 0.62, d: 62, fov: 30, name: 'brake-pads' },
  1: { tgt: [0.5, 5, 0.5], az: 0.25, el: 0.35, d: 52, fov: 30, name: 'oil-filter' },
  2: { tgt: [0, 2, 0], az: 0.15, el: 0.55, d: 78, fov: 30, name: 'rear-shocks' },
  3: { tgt: [-1, 6, 0], az: 0.2, el: 0.42, d: 86, fov: 30, name: 'front-strut' },
  4: { tgt: [0, 20, 0], az: 0.15, el: 0.22, d: 150, fov: 30, name: 'radiator' },
  5: { tgt: [-1, 6, 1], az: 0.2, el: 0.3, d: 70, fov: 30, name: 'headlight' },
  6: { tgt: [0, 5, 0], az: 0.15, el: 0.35, d: 72, fov: 30, name: 'tail-lamp' },
  7: { tgt: [0, 6.6, 0], az: 0.35, el: 0.3, d: 58, fov: 30, name: 'ac-compressor' },
  8: { tgt: [1, 1.5, 0.5], az: 0.2, el: 0.75, d: 80, fov: 30, name: 'clutch-kit' },
  9: { tgt: [0, 0.9, 0], az: 0.35, el: 0.55, d: 36, fov: 30, name: 'spark-plugs' },
  10: { tgt: [0, 13, 0], az: 0.3, el: 0.25, d: 74, fov: 30, name: 'engine-oil' },
  11: { tgt: [0, 9, 0], az: 0.35, el: 0.38, d: 74, fov: 30, name: 'battery' },
  12: { tgt: [0, 2.2, 0], az: 0.3, el: 0.72, d: 58, fov: 30, name: 'air-filter' },
};
const over = fs.existsSync(path.join(__dirname, 'shots.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'shots.json'))) : {};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto('file://' + path.join(__dirname, 'parts.html'));
  const [w, h, bands] = MODE === 'final' ? [1800, 1350, 54] : [480, 360, 6];
  for (const k of Object.keys(SHOTS).map(Number)) {
    if (ONLY.length && !ONLY.includes(k)) continue;
    const s = { ...SHOTS[k], ...(over[k] || {}) };
    const cam = [s.tgt[0] + s.d * Math.sin(s.az) * Math.cos(s.el), s.tgt[1] + s.d * Math.sin(s.el), s.tgt[2] + s.d * Math.cos(s.az) * Math.cos(s.el)];
    const t0 = Date.now();
    const url = await page.evaluate(a => window.renderScene(...a), [k, w, h, cam, s.tgt, s.fov, bands]);
    fs.writeFileSync(path.join(__dirname, 'out', (MODE === 'final' ? 'full-' : 'prev-') + k + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(k, s.name, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
