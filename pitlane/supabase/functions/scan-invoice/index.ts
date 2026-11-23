// Reads a photographed supplier invoice with Claude (vision) and returns its item lines as JSON.
// The app calls it from "Receive stock" (#receive). When it is not deployed, the app reads the photo on the phone instead.
//
// Set up once (Supabase CLI, inside the project folder):
//   supabase functions deploy scan-invoice
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional secrets: SCAN_MODEL (default claude-sonnet-5-5; claude-haiku-5-5 costs less), SCAN_EFFORT (default low).
// Only the owner and staff with the "purchases" or "sales" permission can use it (checked with the caller's own login).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROMPT = `You are reading a photo of a supplier invoice or delivery note for car spare parts. It may be in Arabic or English, printed or handwritten.
Reply with ONLY one JSON object and no other text, in exactly this shape:
{"supplier":"","invoice_no":"","date":"","currency":"","total":null,"items":[{"code":"","barcode":"","title":"","qty":0,"unit_price":0,"total":0}]}

Rules:
- One entry in "items" for every item line, in the printed order. Skip column headers, subtotals, totals, taxes, discounts, payments, notes and signatures.
- code: the part number or item code exactly as printed (keep letters, digits and dashes). Empty when there is none.
- barcode: only a printed barcode number (8 to 14 digits). Empty when there is none.
- title: the item description as written, in its original language.
- qty: the number of units. unit_price: the price of one unit. total: the line total. Use null for any number you cannot read; never guess.
- Numbers are plain JSON numbers with a dot for decimals: convert Arabic-Indic digits and drop thousands separators.
- supplier: the seller's name from the letterhead. invoice_no: the invoice number as printed. date: YYYY-MM-DD when readable, else empty. currency: as printed (for example LYD, د.ل, USD), else empty.
- The top-level total: the invoice's grand total as printed (the amount to pay, after any discount), or null when it is not printed or not readable.
- If the photo is not an invoice, reply {"items":[]}.`;

const DIGITS: Record<string, string> = {};
'٠١٢٣٤٥٦٧٨٩'.split('').forEach((d, i) => { DIGITS[d] = String(i); });
'۰۱۲۳۴۵۶۷۸۹'.split('').forEach((d, i) => { DIGITS[d] = String(i); });

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/٫/g, '.').replace(/[٬\s]/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  s = s.replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
const str = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');

// The first JSON object in the model's text (it may wrap it in a code fence).
function firstJson(text: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const src = fenced ? fenced[1] : text;
  const a = src.indexOf('{'), b = src.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(src.slice(a, b + 1)); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405);
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return reply({ error: 'invoice reading is not set up' }, 503);

  // Who is calling: ask the database with the caller's own login.
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  if (!base || !auth) return reply({ error: 'not authorized' }, 401);
  const pr = await fetch(`${base}/rest/v1/rpc/my_perms`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const me = pr.ok ? await pr.json() : null;
  const perms: string[] = Array.isArray(me?.perms) ? me.perms : [];
  if (!me || !(me.admin || (me.staff && (perms.includes('purchases') || perms.includes('sales'))))) {
    return reply({ error: 'not authorized' }, 403);
  }

  let body: { image?: unknown; mime?: unknown };
  try { body = await req.json(); } catch { return reply({ error: 'bad request' }, 400); }
  const image = String(body.image ?? '').replace(/^data:[^,]+,/, '');
  const mime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(body.mime)) ? String(body.mime) : 'image/jpeg';
  if (image.length < 100) return reply({ error: 'no image' }, 400);
  if (image.length > 9_000_000) return reply({ error: 'image too large' }, 413);

  const model = Deno.env.get('SCAN_MODEL') || 'claude-sonnet-5-5';
  const effort = Deno.env.get('SCAN_EFFORT') ?? 'low';
  const payload: Record<string, unknown> = {
    model,
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
        { type: 'text', text: PROMPT },
      ],
    }],
  };
  if (effort) payload.output_config = { effort };
  const call = () => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let res = await call();
  if (res.status === 400 && payload.output_config) {
    const msg = await res.text();
    if (!/effort|output_config/i.test(msg)) return reply({ error: 'reader error', status: 400, detail: msg.slice(0, 300) }, 502);
    delete payload.output_config; // a model without the effort setting: ask again without it
    res = await call();
  }
  if (!res.ok) return reply({ error: 'reader error', status: res.status, detail: (await res.text()).slice(0, 300) }, 502);

  const out = await res.json();
  const text = (Array.isArray(out.content) ? out.content : [])
    .filter((b: { type?: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('\n');
  const data = firstJson(text);
  if (!data) return reply({ error: 'could not read the invoice' }, 422);

  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 300).map((x: Record<string, unknown>) => {
    const qty = num(x.qty), unit = num(x.unit_price), total = num(x.total);
    const price = unit ?? (total != null && qty ? Math.round((total / qty) * 1000) / 1000 : null);
    return {
      code: str(x.code, 60).toUpperCase(),
      barcode: str(x.barcode, 20).replace(/\D/g, ''),
      title: str(x.title, 120),
      qty: qty != null && qty > 0 ? Math.max(1, Math.round(qty)) : null,
      unit_price: price != null && price >= 0 ? price : null,
      total: total != null && total >= 0 ? total : null,
    };
  }).filter((l: { title: string; code: string; barcode: string }) => l.title || l.code || l.barcode);

  return reply({
    supplier: str(data.supplier, 120), invoice_no: str(data.invoice_no, 40), date: str(data.date, 20), currency: str(data.currency, 12),
    total: ((v) => (v != null && v >= 0 ? v : null))(num(data.total)), items, model, usage: out.usage ?? null,
  });
});
