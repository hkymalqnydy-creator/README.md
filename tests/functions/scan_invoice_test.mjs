// Run: node --experimental-strip-types tests/functions/scan_invoice_test.mjs   (Node 22.6 or newer)
// Runs the scan-invoice function with fake Supabase and Anthropic endpoints.
let handler = null, env = {}, calls = [], anthropicReplies = [], perms = { admin: true, staff: false, perms: [] };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith('/rest/v1/rpc/my_perms')) return new Response(JSON.stringify(perms), { status: init.headers.Authorization === 'Bearer good' ? 200 : 401 });
  if (String(url) === 'https://api.anthropic.com/v1/messages') { const r = anthropicReplies.shift(); return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status || 200 }); }
  throw new Error('unexpected fetch ' + url);
};
await import(new URL('../../supabase/functions/scan-invoice/index.ts', import.meta.url).href);
const post = (body, auth = 'Bearer good') => handler(new Request('https://x/functions/v1/scan-invoice', { method: 'POST', headers: { Authorization: auth, apikey: 'anon', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const img = 'A'.repeat(200);
let ok = 0; const check = (name, cond, extra) => { if (!cond) { console.log('FAIL', name, extra || ''); process.exitCode = 1; } else { ok++; console.log('ok', name); } };

let r = await handler(new Request('https://x', { method: 'OPTIONS' }));
check('options cors', r.status === 200 && r.headers.get('access-control-allow-origin') === '*');
r = await post({ image: img });
check('no key -> 503', r.status === 503);
env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_ANON_KEY: 'anon' };
r = await post({ image: img }, 'Bearer bad');
check('bad login -> 403', r.status === 403);
perms = { admin: false, staff: true, perms: ['returns'] };
r = await post({ image: img });
check('staff without purchases/sales -> 403', r.status === 403);
perms = { admin: false, staff: true, perms: ['purchases'] };
r = await post({ image: '' });
check('empty image -> 400', r.status === 400);
anthropicReplies.push({ body: { content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: 'Here you go:\n```json\n{"supplier":"شركة الأمل","invoice_no":"456","date":"2026-11-10","currency":"د.ل","total":"٣٦٥","items":[{"code":"58101-1ra00","barcode":"","title":"فحمات فرامل أمامية","qty":"١٠","unit_price":"٢٨٫٥","total":285},{"code":"","barcode":"880 123 456 7890","title":"فلتر هواء","qty":4,"unit_price":null,"total":"80.00"},{"code":"","barcode":"","title":"","qty":1,"unit_price":1,"total":1}]}\n```' }], usage: { input_tokens: 2900, output_tokens: 700 } } });
r = await post({ image: 'data:image/jpeg;base64,' + img, mime: 'image/jpeg' });
const j = await r.json();
check('reads invoice', r.status === 200 && j.items.length === 2, JSON.stringify(j));
check('arabic digits and code', j.items[0].qty === 10 && j.items[0].unit_price === 28.5 && j.items[0].code === '58101-1RA00', JSON.stringify(j.items[0]));
check('unit price from total', j.items[1].unit_price === 20 && j.items[1].barcode === '8801234567890', JSON.stringify(j.items[1]));
check('supplier', j.supplier === 'شركة الأمل' && j.model === 'claude-sonnet-5-5');
check('invoice number, date and the printed total', j.invoice_no === '456' && j.date === '2026-11-10' && j.total === 365, JSON.stringify([j.invoice_no, j.date, j.total]));
const sent = JSON.parse(calls.filter(c => c.url.includes('anthropic')).pop().init.body);
check('request shape', sent.model === 'claude-sonnet-5-5' && sent.output_config.effort === 'low' && sent.messages[0].content[0].source.data === img && sent.temperature === undefined && sent.tool_choice === undefined, JSON.stringify(sent).slice(0, 200));
const hdr = calls.filter(c => c.url.includes('anthropic')).pop().init.headers;
check('headers', hdr['x-api-key'] === 'sk-test' && hdr['anthropic-version'] === '2023-06-01');
// a model without effort support: retried without output_config
env.SCAN_MODEL = 'claude-haiku-4-5';
anthropicReplies.push({ status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.effort: this model does not support effort' } } });
anthropicReplies.push({ body: { content: [{ type: 'text', text: '{"items":[{"code":"MR968245","title":"Clutch kit","qty":2,"unit_price":480}]}' }] } });
r = await post({ image: img });
const j2 = await r.json();
const last2 = calls.filter(c => c.url.includes('anthropic')).slice(-2).map(c => JSON.parse(c.init.body));
check('retry without effort', r.status === 200 && j2.items[0].code === 'MR968245' && last2[0].output_config && !last2[1].output_config, JSON.stringify(j2));
anthropicReplies.push({ status: 529, body: 'overloaded' });
r = await post({ image: img });
check('api error -> 502', r.status === 502);
anthropicReplies.push({ body: { content: [{ type: 'text', text: 'sorry, I cannot read this' }] } });
r = await post({ image: img });
check('no json -> 422', r.status === 422);
console.log(ok + ' checks passed');
