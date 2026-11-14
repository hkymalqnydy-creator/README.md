/* In-app page edition (config.js: embedded: true). The app then runs as a page inside the Claude app, whose page
   frame has no camera, no service worker and no outside servers. There, a photographed invoice is read by Claude
   (the viewer's own Claude, after they allow it once), and exported files are offered through the Claude app's save
   sheet. Everywhere else this file does nothing.
   Keep PROMPT and the clean-up below in step with supabase/functions/scan-invoice/index.ts. */
(function () {
  'use strict';
  const SP = window.SP;
  if (!SP || !SP.CFG || !SP.CFG.embedded) return;
  const { t } = SP;

  Object.assign(SP.L.T, {
    rcvAi: ['Claude يقرا الفاتورة… (أول مرة يطلب إذنك)', 'Claude is reading the invoice… (it asks your permission the first time)'],
    embNoClaude: ['قراءة الصور بـ Claude مش متاحة هنا. زيد الأصناف بالكود أو بالباركود.', 'Reading photos with Claude isn\'t available here. Add the lines by code or barcode.'],
    embDenied: ['ما سمحتش لـ Claude يقرا الصورة. تقدر تسمحله في المرة الجاية، أو تزيد الأصناف بإيدك.', 'Claude wasn\'t allowed to read the photo. Allow it next time, or add the lines by hand.'],
    embBusy: ['Claude مشغول توا. جرّب بعد شوية.', 'Claude is busy right now. Try again in a little while.'],
    embSignIn: ['سجّل دخولك في Claude من جديد وجرّب.', 'Sign in to Claude again, then try once more.'],
    embBadImg: ['الصورة هذي ما تنقراش. صوّر الفاتورة من جديد في ضو كويس.', 'This photo can\'t be read. Take it again in good light.'],
    embFail: ['ما قدرش Claude يقرا الفاتورة. جرّب صورة أوضح.', 'Claude couldn\'t read the invoice. Try a clearer photo.'],
    embSaveNo: ['حفظ الملفات مش متاح هنا. افتح التطبيق من رابطه في Safari.', 'Saving files isn\'t available here. Open the app from its Safari link.'],
    xlsxEmbedded: ['ملفات Excel تتقرا في نسخة Safari. هنا احفظ الملف بصيغة CSV واختاره.', 'Excel files are read in the Safari version. Here, save the file as CSV and choose it.']
  });

  /* window.claude.use(name) resolves a capability, or null where this view cannot run it */
  const use = name => {
    try {
      return window.claude && typeof window.claude.use === 'function' ? Promise.resolve(window.claude.use(name)).catch(() => null) : Promise.resolve(null);
    } catch (e) { return Promise.resolve(null); }
  };
  const fail = key => Object.assign(new Error(key), { userMsg: t(key) });

  /* ---------- reading a photographed invoice with Claude ---------- */
  const PROMPT = `You are reading a photo of a supplier invoice or delivery note for car spare parts. It may be in Arabic or English, printed or handwritten.
Reply with ONLY one JSON object and no other text, in exactly this shape:
{"supplier":"","invoice_no":"","date":"","currency":"","items":[{"code":"","barcode":"","title":"","qty":0,"unit_price":0,"total":0}]}
Rules:
- One entry in "items" for every item line, in the printed order. Skip column headers, subtotals, totals, taxes, discounts, payments, notes and signatures.
- code: the part number or item code exactly as printed (keep letters, digits and dashes). Empty when there is none.
- barcode: only a printed barcode number (8 to 14 digits). Empty when there is none.
- title: the item description as written, in its original language.
- qty: the number of units. unit_price: the price of one unit. total: the line total. Use null for any number you cannot read; never guess.
- Numbers are plain JSON numbers with a dot for decimals: convert Arabic-Indic digits and drop thousands separators.
- supplier: the seller's name from the letterhead. date: YYYY-MM-DD when readable, else empty. currency: as printed (for example LYD, د.ل, USD), else empty.
- If the photo is not an invoice, reply {"items":[]}.`;
  const DIGITS = {};
  '٠١٢٣٤٥٦٧٨٩'.split('').forEach((d, i) => { DIGITS[d] = String(i); });
  '۰۱۲۳۴۵۶۷۸۹'.split('').forEach((d, i) => { DIGITS[d] = String(i); });
  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    let s = v.replace(/[٠-٩۰-۹]/g, d => DIGITS[d]).replace(/٫/g, '.').replace(/[٬\s]/g, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    s = s.replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');

  /* the photo as a JPEG no larger than 2000 px (Claude gets it downsized anyway; iPhone photos can be large) */
  async function asJpeg(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return (await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9))) || file;
    } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
  }
  const CODE_MSG = {
    not_granted: 'embDenied', sampling_disabled: 'embNoClaude', not_declared: 'embNoClaude', capability_disabled: 'embNoClaude',
    capability_removed: 'embNoClaude', images_unavailable: 'embNoClaude', rate_limited: 'embBusy', session_expired: 'embSignIn', image_rejected: 'embBadImg'
  };
  SP.invoiceEngine = async (file, say) => {
    const sample = await use('sample');
    const lim = sample && await sample.limits().catch(() => null);
    if (!lim || !lim.images) throw fail('embNoClaude');
    say('ai');
    let data;
    try {
      data = await sample.json(PROMPT, { images: [await asJpeg(file)], modelTier: 'default' });
    } catch (e) { throw fail(CODE_MSG[e && e.code] || 'embFail'); }
    const items = (data && Array.isArray(data.items) ? data.items : []).slice(0, 300).map(x => {
      x = x || {};
      const qty = num(x.qty), unit = num(x.unit_price), total = num(x.total);
      const price = unit != null ? unit : (total != null && qty ? Math.round((total / qty) * 1000) / 1000 : null);
      return {
        code: str(x.code, 60).toUpperCase(), barcode: str(x.barcode, 20).replace(/\D/g, ''), title: str(x.title, 120),
        qty: qty != null && qty > 0 ? Math.max(1, Math.round(qty)) : null,
        unit_price: price != null && price >= 0 ? price : null, total: total != null && total >= 0 ? total : null
      };
    }).filter(l => l.title || l.code || l.barcode);
    return { supplier: str(data && data.supplier, 120), items, engine: 'ai' };
  };

  /* ---------- exported files: the Claude app's save sheet ---------- */
  SP.saveFile = async (name, text) => {
    const d = await use('downloads');
    if (!d) { SP.toast(t('embSaveNo'), 6000); return false; }
    try {
      await d.save({ filename: name, data: (/\.csv$/i.test(name) ? '﻿' : '') + text });
      return true;
    } catch (e) {
      if (!(e && e.code === 'declined')) SP.toast(t(e && e.code === 'rate_limited' ? 'embBusy' : 'embSaveNo'), 6000);
      return false;
    }
  };
})();
