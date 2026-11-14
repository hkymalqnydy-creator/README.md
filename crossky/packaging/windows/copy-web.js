const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'app');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const k of ['index.html', 'privacy.html', 'config.js', 'manifest.webmanifest', 'css', 'js', 'icons']) fs.cpSync(path.join(root, k), path.join(out, k), { recursive: true });
console.log('copied to', out);
