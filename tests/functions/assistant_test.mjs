// Run: node --experimental-strip-types tests/functions/assistant_test.mjs   (Node 22.6 or newer)
// Runs the assistant function with fake Supabase and Anthropic endpoints.
let handler = null, env = {}, calls = [], replies = [], gate = null, gateErr = null, access = { ok: true, role: 'admin' }, modelsOk = true;
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push({ url, init });
  const good = init.headers && init.headers.Authorization === 'Bearer good';
  if (url.endsWith('/rest/v1/rpc/ai_gate')) {
    if (!good) return new Response(JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }), { status: 401 });
    if (gateErr) return new Response(JSON.stringify(gateErr.body), { status: gateErr.status });
    return new Response(JSON.stringify(gate), { status: 200 });
  }
  if (url.endsWith('/rest/v1/rpc/ai_access')) return good ? new Response(JSON.stringify(access), { status: 200 }) : new Response('{}', { status: 401 });
  if (url.startsWith('https://api.anthropic.com/v1/models')) return new Response('{}', { status: modelsOk ? 200 : 401 });
  if (url === 'https://api.anthropic.com/v1/messages') { const r = replies.shift(); return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status || 200 }); }
  throw new Error('unexpected fetch ' + url);
};
await import(new URL('../../supabase/functions/assistant/index.ts', import.meta.url).href);
const post = (body, auth = 'Bearer good') => handler(new Request('https://x/functions/v1/assistant', { method: 'POST', headers: { Authorization: auth, apikey: 'anon', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const TURN = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b';
const TOOLS = ['find_parts', 'open_page', 'prepare_sale', 'sales_report', 'profit_report', 'set_price', 'bulk_prices', 'create_ad', 'invoice_from_photo', 'evil_tool']
  .map(name => ({ name, description: 'does ' + name, input_schema: { type: 'object', properties: { q: { type: 'string' } } } }));
const ask = (text, extra) => ({ turn: TURN, messages: [{ role: 'user', content: text }], tools: TOOLS, guide: 'GUIDE TEXT', page: 'The person is now on: #pos', lang: 'ar', currency: 'د.ل', ...extra });
const lastClaude = () => JSON.parse(calls.filter(c => c.url === 'https://api.anthropic.com/v1/messages').pop().init.body);
let ok = 0; const check = (name, cond, extra) => { if (!cond) { console.log('FAIL', name, extra || ''); process.exitCode = 1; } else { ok++; console.log('ok', name); } };

let r = await handler(new Request('https://x', { method: 'OPTIONS' }));
check('options cors', r.status === 200 && r.headers.get('access-control-allow-origin') === '*');
r = await post(ask('مرحبا'));
check('no key -> 503 (the app uses the helper on the device)', r.status === 503 && (await r.json()).error === 'not_set_up');
env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_ANON_KEY: 'anon' };
r = await post(ask('مرحبا'), '');
check('no login -> 401 signin', r.status === 401 && (await r.json()).error === 'signin');
r = await post(ask('مرحبا'), 'Bearer bad');
check('expired login -> 401 signin', r.status === 401 && (await r.json()).error === 'signin');
r = await post(ask('مرحبا', { turn: 'not-a-uuid' }));
check('bad turn -> 400', r.status === 400);
r = await post({ turn: TURN, messages: [] });
check('no messages -> 400', r.status === 400);
r = await post({ turn: TURN, messages: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] });
check('must end on the person -> 400', r.status === 400);
r = await post({ turn: TURN, messages: [{ role: 'user', content: [{ type: 'document', source: {} }] }] });
check('unknown block -> 400', r.status === 400);
r = await post({ turn: TURN, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://evil' } }, { type: 'text', text: 'x' }] }] });
check('image by url refused', r.status === 400);
r = await post({ turn: TURN, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A'.repeat(2_200_000) } }] }] });
check('image too large -> 413', r.status === 413);
const im = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A'.repeat(500) } };
r = await post({ turn: TURN, messages: [{ role: 'user', content: [im, im, im, { type: 'text', text: 'x' }] }] });
check('three photos refused', r.status === 400);
const claudeCalls = () => calls.filter(c => c.url === 'https://api.anthropic.com/v1/messages').length;
check('nothing reached Claude yet', claudeCalls() === 0);

// the database says no
gateErr = { status: 403, body: { code: '42501', message: 'ai not allowed' } };
r = await post(ask('مرحبا'));
check('not given the assistant -> 403', r.status === 403 && (await r.json()).error === 'ai_not_allowed');
gateErr = { status: 400, body: { code: 'P0001', message: 'ai daily limit' } };
r = await post(ask('مرحبا'));
check('daily limit -> 429 ai_limit', r.status === 429 && (await r.json()).error === 'ai_limit');
gateErr = { status: 400, body: { code: 'P0001', message: 'ai too many steps' } };
r = await post(ask('مرحبا'));
check('too many steps -> 429 ai_steps', r.status === 429 && (await r.json()).error === 'ai_steps');
check('still nothing reached Claude', claudeCalls() === 0);
gateErr = null;

// a seller the manager gave sales and reports (not costs, not products)
gate = { ok: true, role: 'staff', perms: ['sales', 'reports'], left: 37, me: 'سالم', branch: 'فرع طرابلس', name: 'مساعد كروسكاي', rules: 'الضمان 3 شهور على الأصلي.',
  bot_rules: [{ k: 'التوصيل', a: 'نوصلو لكل ليبيا خلال يومين.' }], company: 'CROSSKY', about: 'قطع كورية ويابانية', contact: '+218910000000', address: 'طرابلس', price_mode: 'all', orders: true };
replies.push({ body: { content: [{ type: 'text', text: 'ندوّرلك.' }, { type: 'tool_use', id: 'tu_1', name: 'find_parts', input: { query: 'فلتر زيت باترول' } }], stop_reason: 'tool_use', usage: { input_tokens: 3000, output_tokens: 40 } } });
r = await post(ask('بيع فلتر زيت باترول'));
let j = await r.json();
check('answers with the tool call', r.status === 200 && j.stop_reason === 'tool_use' && j.content[1].name === 'find_parts' && j.left === 37, JSON.stringify(j));
let sent = lastClaude();
const names = (sent.tools || []).map(x => x.name).sort().join(',');
check('only the tools the manager allowed', names === 'find_parts,invoice_from_photo,open_page,prepare_sale,sales_report', names);
const sys = sent.system[0].text;
check('who it is talking with', /employee named سالم \(branch: فرع طرابلس\)/.test(sys) && /only: sales, reports/.test(sys), sys.slice(0, 400));
check('the manager\'s words and ready answers', sys.includes('الضمان 3 شهور على الأصلي.') && sys.includes('نوصلو لكل ليبيا خلال يومين.') && sys.includes('مساعد كروسكاي'));
check('guide, page and currency', sys.includes('GUIDE TEXT') && sys.includes('#pos') && sys.includes('Currency: د.ل'));
check('confirm rule in the instructions', /only prepares a card/.test(sys) && /Libyan Arabic/.test(sys) && /invoice_from_photo/.test(sys));
check('request shape', sent.model === 'claude-sonnet-5-5' && sent.output_config.effort === 'low' && sent.system[0].cache_control.type === 'ephemeral' && sent.max_tokens === 8000 && sent.messages[0].content[0].text === 'بيع فلتر زيت باترول');
const gateCall = calls.filter(c => c.url.endsWith('/rpc/ai_gate')).pop();
check('the gate gets the turn with the caller\'s own login', JSON.parse(gateCall.init.body).p_turn === TURN && gateCall.init.headers.Authorization === 'Bearer good');
const hdr = calls.filter(c => c.url === 'https://api.anthropic.com/v1/messages').pop().init.headers;
check('Claude headers', hdr['x-api-key'] === 'sk-test' && hdr['anthropic-version'] === '2023-06-01');

// the next step of the same turn: the app ran the tool and sends the result
replies.push({ body: { content: [{ type: 'text', text: 'جهزتلك الفاتورة، راجعها واضغط «نفّذ».' }], stop_reason: 'end_turn' } });
r = await post({ ...ask('x'), messages: [
  { role: 'user', content: [{ type: 'text', text: 'بيع فلتر زيت باترول' }] },
  { role: 'assistant', content: [{ type: 'thinking', thinking: '…', signature: 'sig' }, { type: 'text', text: 'ندوّرلك.' }, { type: 'tool_use', id: 'tu_1', name: 'find_parts', input: { query: 'فلتر زيت باترول' } }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: '{"total":1}' }] }] });
j = await r.json();
sent = lastClaude();
check('tool result round trip', r.status === 200 && j.stop_reason === 'end_turn' && sent.messages.length === 3 && sent.messages[2].content[0].type === 'tool_result' && sent.messages[1].content[0].signature === 'sig', JSON.stringify(sent.messages).slice(0, 300));

// two from the person in a row become one; a photo goes along
replies.push({ body: { content: [{ type: 'text', text: 'هذي فحمات.' }], stop_reason: 'end_turn' } });
r = await post({ ...ask('x'), messages: [{ role: 'user', content: 'السلام' }, { role: 'user', content: [im, { type: 'text', text: 'شنو هذي؟' }] }] });
sent = lastClaude();
check('merged and photo kept', r.status === 200 && sent.messages.length === 1 && sent.messages[0].content.length === 3 && sent.messages[0].content[1].type === 'image');

// the manager: every tool except unknown ones, no limit
gate = { ok: true, role: 'admin', perms: ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings'], left: null, me: 'المدير', company: 'CROSSKY' };
replies.push({ body: { content: [{ type: 'text', text: 'تمام' }], stop_reason: 'end_turn' } });
r = await post(ask('كم بعنا اليوم؟'));
j = await r.json();
sent = lastClaude();
check('manager gets all known tools', sent.tools.length === 9 && !sent.tools.some(x => x.name === 'evil_tool') && j.left === null, sent.tools.map(x => x.name).join(','));
check('manager prompt', /the manager \(owner\)/.test(sent.system[0].text));

// a customer: only finding parts and pages
gate = { ok: true, role: 'customer', perms: [], left: 12, me: 'علي', company: 'CROSSKY', orders: false };
replies.push({ body: { content: [{ type: 'text', text: 'نعم' }], stop_reason: 'end_turn' } });
r = await post(ask('عندكم فحمات باترول؟'));
sent = lastClaude();
check('customer tools', sent.tools.map(x => x.name).sort().join(',') === 'find_parts,open_page', sent.tools.map(x => x.name).join(','));
check('customer prompt', /signed-in customer named علي/.test(sent.system[0].text) && /Ordering is closed right now/.test(sent.system[0].text));

// a model without effort support: asked again without it
env.ASSISTANT_MODEL = 'claude-haiku-4-5';
replies.push({ status: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.effort: this model does not support effort' } } });
replies.push({ body: { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' } });
r = await post(ask('x'));
const last2 = calls.filter(c => c.url === 'https://api.anthropic.com/v1/messages').slice(-2).map(c => JSON.parse(c.init.body));
check('retry without effort', r.status === 200 && last2[0].output_config && !last2[1].output_config && last2[1].model === 'claude-haiku-4-5');
replies.push({ status: 529, body: 'overloaded' });
r = await post(ask('x'));
check('Claude busy -> 429 busy', r.status === 429 && (await r.json()).error === 'busy');
replies.push({ status: 500, body: 'boom' });
r = await post(ask('x'));
check('Claude error -> 502', r.status === 502);

// the manager's "Test the connection"
const before = calls.filter(c => c.url.endsWith('/rpc/ai_gate')).length;
r = await post({ ping: true });
check('ping ok', r.status === 200 && (await r.json()).ok === true);
check('ping does not count a message', calls.filter(c => c.url.endsWith('/rpc/ai_gate')).length === before);
modelsOk = false;
r = await post({ ping: true });
check('ping with a wrong key -> 502', r.status === 502 && (await r.json()).error === 'key');
access = { ok: false, role: 'staff' };
r = await post({ ping: true });
check('ping without the assistant -> 403', r.status === 403);
console.log(ok + ' checks passed');
