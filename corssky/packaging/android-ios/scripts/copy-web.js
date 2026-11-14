/* Copies the web app (two folders up) into www/ for Capacitor. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../../..'), out = path.resolve(__dirname, '../www');
const keep = ['index.html', 'privacy.html', 'config.js', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const k of keep) fs.cpSync(path.join(root, k), path.join(out, k), { recursive: true });
console.log('web app copied to', out);
