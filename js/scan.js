/* Barcode scanning with the phone camera (or a USB / Bluetooth scanner, which types the code and Enter),
   reading a photographed paper invoice, receiving stock (#receive) and its history (#purchases).
   The database checks every rule again (receive_stock, list_purchases). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, api, opt, shell, bar, empty, gate, CFG, D } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };

  Object.assign(window.SP_IC, {
    scan: '<path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><path d="M7.5 9v6M10 9v6M12.5 9v6M16.5 9v6"/>',
    receipt: '<path d="M6 3.5h12v17l-2.4-1.5-2.1 1.5-1.5-1.5-1.5 1.5-2.1-1.5L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>'
  });

  Object.assign(SP.L.T, {
    scanT: ["امسح الباركود", "Scan a barcode"], scanHint: ["وجّه الكاميرا على الباركود وخليه داخل الإطار", "Point the camera at the barcode and keep it inside the frame"],
    scanLoading: ["جاري تشغيل الكاميرا…", "Starting the camera…"], scanManualPh: ["أو اكتب الكود هنا…", "…or type the code"], scanPhoto: ["صوّر الباركود بدل الكاميرا", "Use a photo of the barcode"],
    scanDone: ["خلصت", "Done"], scanCancel: ["إلغاء", "Cancel"], scanReading: ["جاري قراءة الصورة…", "Reading the photo…"],
    scanNoCam: ["الكاميرا مش متاحة هنا. اكتب الكود، أو صوّر الباركود.", "The camera isn't available here. Type the code or use a photo of the barcode."],
    scanDenied: ["ما فيش إذن للكاميرا. فعّله من إعدادات المتصفح، أو صوّر الباركود.", "Camera access was denied. Allow it in the browser settings, or use a photo of the barcode."],
    scanNotFound: ["ما لقيناش باركود في الصورة. قرّب أكثر وخلي الإضاءة كويسة.", "No barcode found in the photo. Move closer and use good light."],
    scanGot: ["تمت القراءة: {c}", "Read: {c}"], scanUnknown: ["الكود {c} مش موجود في الكتالوج", "Code {c} isn't in the catalog"], scanAdded: ["أضيفت: {t}", "Added: {t}"],
    scanBtn: ["مسح بالكاميرا", "Scan with the camera"], barcodeL: ["الباركود", "Barcode"],
    barcodeHint: ["امسحه بالكاميرا أو بجهاز الباركود، باش تلقى القطعة بسرعة في البيع والاستلام.", "Scan it with the camera or a barcode scanner to find the part fast when selling and receiving."],
    rcvT: ["استلام بضاعة", "Receive stock"], rcvPhoto: ["صوّر فاتورة المورّد", "Photograph the supplier invoice"], rcvPhotoSub: ["يقرا الأصناف والكميات والأسعار", "Reads items, quantities and prices"],
    rcvScan: ["امسح باركود القطع", "Scan part barcodes"], rcvScanSub: ["قطعة قطعة بالكاميرا", "One by one with the camera"], rcvSearchPh: ["أضف قطعة بالاسم أو الكود أو الباركود…", "Add a part by name, code or barcode…"],
    rcvSupplier: ["المورّد", "Supplier"], rcvNote: ["ملاحظة", "Note"],
    rcvPayT: ["الدفع للمورّد", "Paying the supplier"], rcvPaidFull: ["دفعت كاملة", "Paid in full"], rcvCredit: ["آجل (دين للمورّد)", "On credit"], rcvPart: ["دفعت جزء", "Part paid"],
    rcvPaidNow: ["المدفوع توا", "Paid now"], purOwed: ["باقي للمورّد {m}", "{m} still owed"], rcvNeedSupplier: ["اكتب اسم المورّد باش يتسجّل الدين عليه.", "Enter the supplier's name so the debt is recorded."], rcvReading: ["جاري قراءة الفاتورة…", "Reading the invoice…"],
    rcvLoadingOcr: ["تحميل أداة القراءة (أول مرة فقط)…", "Downloading the reader (first time only)…"], rcvAi: ["قراءة بالذكاء الاصطناعي…", "Reading with AI…"],
    rcvReadAi: ["قريناها بالذكاء الاصطناعي: {n} صنف. راجعهم قبل الإدخال.", "Read with AI: {n} items. Check them before saving."],
    rcvReadLocal: ["قريناها على الجهاز: {n} صنف. الدقة متوسطة، فراجع الأرقام كويس.", "Read on this device: {n} items. Accuracy is moderate, so check the numbers carefully."],
    rcvReadNone: ["ما قدرناش نقرا أصناف من الصورة. صوّرها من فوق وفي إضاءة كويسة، أو أضف الأصناف بالباركود.", "No items could be read. Photograph it straight on in good light, or add the items by barcode."],
    rcvReadFail: ["تعذرت قراءة الصورة: {e}", "Couldn't read the photo: {e}"], rcvOffline: ["محتاج إنترنت لتحميل أداة القراءة أول مرة.", "An internet connection is needed to download the reader the first time."],
    rcvLines: ["الأصناف ({n})", "Items ({n})"], rcvEmpty: ["صوّر الفاتورة أو امسح الباركود أو ابحث عن قطعة، والأصناف تظهر هنا للمراجعة.", "Photograph the invoice, scan barcodes or search for a part; the lines show up here for review."],
    rcvMatched: ["موجودة في الكتالوج · المخزون {n}", "In the catalog · stock {n}"], rcvNew: ["قطعة جديدة: تنضاف للكتالوج", "New part: will be added to the catalog"], rcvChecking: ["جاري البحث في الكتالوج…", "Checking the catalog…"],
    rcvNeedName: ["اكتب اسم القطعة الجديدة", "Enter a name for the new part"], rcvBadQty: ["الكمية لازم تكون رقم صحيح أكبر من صفر", "Quantity must be a whole number above zero"],
    rcvCode: ["الكود / الباركود", "Code / barcode"], rcvName: ["اسم الصنف", "Item name"], rcvCost: ["سعر الشراء", "Unit cost"], rcvSell: ["سعر البيع", "Selling price"],
    rcvChange: ["غيّر القطعة", "Change part"], rcvPick: ["اختر القطعة من الكتالوج", "Pick the part from the catalog"], rcvAsNew: ["خليها قطعة جديدة", "Keep it as a new part"], rcvDel: ["احذف السطر", "Remove line"],
    rcvTotal: ["إجمالي الشراء", "Purchase total"], rcvUnits: ["عدد القطع", "Units"], rcvSave: ["أدخلها للمخزون", "Add to stock"], rcvToPos: ["افتحها كفاتورة بيع", "Open as a sale"],
    rcvSaved: ["تم الاستلام رقم {n}: زادت كمية {u} صنف، وانضاف {a} صنف جديد", "Receipt {n} saved: {u} restocked, {a} new"],
    rcvAuto: ["أدخلها للمخزن بروحها بعد ما تتقرا", "Put it into stock by itself once read"],
    rcvAutoHint: ["تصوّر الفاتورة والقطع تدخل بأسمائها وكمياتها وأرقام الأصناف، وتقدر تتراجع لو فيه غلط.", "Photograph the invoice and the parts go in with their names, quantities and codes; you can take it back if something is wrong."],
    rcvAutoDone: ["دخلت للمخزن بروحها", "In stock, entered by itself"], rcvAutoSum: ["استلام رقم {n} · زادت {u}، وجديدة {a}", "Receipt {n} · {u} restocked, {a} new"],
    rcvUndo: ["تراجع عن الإدخال", "Take it back"], rcvUndoQ: ["ترجّع الاستلام رقم {n}؟", "Take back receipt {n}?"],
    rcvUndoB: ["القطع تطلع من المخزن، وسعر التكلفة يرجع كيف كان، والقطع الجديدة اللي انضافت معاه تنحذف.", "The parts come out of stock, costs go back to what they were, and new parts it added are removed."],
    rcvUndone: ["رجّعنا الاستلام {n}. السطور قدامك تصلحها وتدخلها.", "Receipt {n} taken back. The lines are here to fix and enter again."],
    rcvUndoneList: ["رجّعنا الاستلام {n}", "Receipt {n} taken back"], rcvUndoSold: ["ما نقدروش نرجّعوه: انباع من «{t}»", "Can’t take it back: some of “{t}” was already sold"],
    rcvUndoOld: ["الموظف يقدر يرجّع استلامه بس، وفي نفس اليوم.", "Staff can take back only their own receipts, within a day."],
    rcvAnother: ["صوّر فاتورة ثانية", "Photograph another invoice"], rcvSeeList: ["شوف الاستلامات", "See receipts"],
    rcvWaitFix: ["ما دخلتش بروحها: {n} سطر يحتاج تكمّله (الاسم أو الكمية). صلّحه واضغط «أدخلها للمخزون».", "Not entered: {n} lines need a name or quantity. Fix them and tap Add to stock."],
    rcvWaitDevice: ["ما دخلتش بروحها: القراية على الجهاز وفيه قطع مش معروفة عندنا. راجعها واضغط «أدخلها للمخزون».", "Not entered: it was read on this device and has parts we don’t know. Check them and tap Add to stock."],
    rcvWaitPaid: ["ما دخلتش بروحها: اكتب كم دفعت للمورّد، واضغط «أدخلها للمخزون».", "Not entered: enter what you paid the supplier, then tap Add to stock."],
    rcvWaitSupplier: ["ما دخلتش بروحها: الدين يحتاج اسم المورّد. اكتبه واضغط «أدخلها للمخزون».", "Not entered: a credit receipt needs the supplier name. Enter it and tap Add to stock."],
    purUndo: ["رجّع الاستلام", "Take back"], rcvNewShort: ["جديدة", "New"], rcvToPosSkip: ["{n} صنف مش في الكتالوج ما انضافش للبيع", "{n} lines not in the catalog were left out of the sale"],
    rcvClear: ["امسح القائمة", "Clear the list"], rcvClearQ: ["تمسح كل الأصناف من القائمة؟", "Remove all lines from the list?"], rcvFromPhoto: ["من الصورة", "From the photo"],
    rcvNeedLines: ["ما فيش أصناف للإدخال", "There are no lines to save"], rcvMany: ["الحد 300 صنف في الاستلام الواحد", "A receipt can have up to 300 lines"],
    purT: ["سجل الاستلام", "Receiving history"], purEmpty: ["ما فيش استلام بضاعة بعد.", "No stock has been received yet."], purNo: ["استلام {n}", "Receipt {n}"],
    perm_purchases: ["استلام البضاعة وإدخال فواتير الموردين", "Receive stock and enter supplier invoices"]
  });

  /* ---------- shared helpers ---------- */
  const key = v => String(v || '').toUpperCase().replace(/[\s\-./_]/g, '');
  const toNum = v => {
    let s = SP.digits(String(v == null ? '' : v)).replace(/[٫]/g, '.').replace(/[٬\s]/g, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    s = s.replace(',', '.');
    return s !== '' && isFinite(+s) ? +s : null;
  };
  const LIBS = {
    ZXing: ['https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js'],
    Tesseract: ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js']
  };
  const loading = {};
  function lib(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!loading[name]) loading[name] = (async () => {
      for (const src of LIBS[name]) {
        try {
          await new Promise((ok, no) => {
            const s = document.createElement('script');
            s.src = src; s.async = true; s.onload = ok; s.onerror = () => { s.remove(); no(new Error('load')); };
            document.head.appendChild(s);
          });
          if (window[name]) return window[name];
        } catch (e) { /* try the next CDN */ }
      }
      loading[name] = null;
      throw Object.assign(new Error('offline'), { offline: true });
    })();
    return loading[name];
  }
  /* A photo drawn on a canvas, at most `max` pixels on its long side (optionally grey with more contrast, for text reading). */
  function toCanvas(file, max, forText) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        if (forText) {
          try {
            const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
            for (let i = 0; i < p.length; i += 4) { const y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2], v = Math.max(0, Math.min(255, (y - 128) * 1.35 + 140)); p[i] = p[i + 1] = p[i + 2] = v; }
            g.putImageData(d, 0, 0);
          } catch (e) { /* keep colour */ }
        }
        res(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
      img.src = url;
    });
  }

  /* ---------- barcode scanner ---------- */
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'];
  const CAM = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };
  const stopStream = v => { const st = v && v.srcObject; if (st && st.getTracks) st.getTracks().forEach(tr => tr.stop()); if (v) v.srcObject = null; };
  async function nativeFormats() {
    if (!('BarcodeDetector' in window)) return [];
    try { const f = await window.BarcodeDetector.getSupportedFormats(); return FORMATS.filter(x => f.includes(x)); } catch (e) { return []; }
  }
  const ENGINES = {
    /* Android Chrome and others with the built-in detector */
    native(formats) {
      const det = new window.BarcodeDetector({ formats });
      return {
        name: 'native',
        async start(video, onCode) {
          video.srcObject = await navigator.mediaDevices.getUserMedia(CAM);
          await video.play().catch(() => {});
          let on = true, busy = false;
          (function tick() {
            if (!on) return;
            if (!busy && video.readyState >= 2) {
              busy = true;
              det.detect(video).then(r => { if (on && r && r.length) onCode(r[0].rawValue); }).catch(() => {}).then(() => { busy = false; });
            }
            setTimeout(tick, 130);
          })();
          return () => { on = false; stopStream(video); };
        },
        async still(canvas) { const r = await det.detect(canvas); return r && r.length ? r[0].rawValue : null; }
      };
    },
    /* iPhone (Safari has no built-in detector) and every other browser: ZXing */
    async zxing() {
      const Z = await lib('ZXing'), hints = new Map();
      try {
        const F = Z.BarcodeFormat;
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX].filter(x => x != null));
        hints.set(Z.DecodeHintType.TRY_HARDER, true);
      } catch (e) { /* library defaults */ }
      const reader = new Z.BrowserMultiFormatReader(hints, 180);
      const text = r => (r && (typeof r.getText === 'function' ? r.getText() : r.text)) || '';
      return {
        name: 'zxing',
        async start(video, onCode) {
          const cb = r => { const v = text(r); if (v) onCode(v); };
          const ctl = typeof reader.decodeFromConstraints === 'function' ? await reader.decodeFromConstraints(CAM, video, cb) : await reader.decodeFromVideoDevice(undefined, video, cb);
          return () => { try { if (ctl && typeof ctl.stop === 'function') ctl.stop(); if (typeof reader.reset === 'function') reader.reset(); } catch (e) { /* stopped */ } stopStream(video); };
        },
        async still(canvas) { try { return text(await reader.decodeFromImageUrl(canvas.toDataURL('image/png'))) || null; } catch (e) { return null; } }
      };
    }
  };
  let enginePromise = null;
  function engine() {
    if (window.SP_BARCODE_ENGINE) return Promise.resolve(window.SP_BARCODE_ENGINE);
    if (!enginePromise) enginePromise = (async () => {
      const f = await nativeFormats();
      return f.some(x => x !== 'qr_code') ? ENGINES.native(f) : ENGINES.zxing();
    })().catch(e => { enginePromise = null; throw e; });
    return enginePromise;
  }
  let actx = null;
  function beep() {
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* no vibration */ }
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = 1800; g.gain.value = 0.03;
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.07);
    } catch (e) { /* no sound */ }
  }
  /* Opens the scanner. Without o.onCode it resolves with the first code read (null when closed).
     With o.onCode it stays open for many codes; onCode(code) may return a short message to show. */
  SP.scanCode = (o = {}) => new Promise(resolve => {
    let stop = null, closed = false, last = '', lastAt = 0, eng = null;
    const multi = typeof o.onCode === 'function';
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(o.title || t('scanT'))}</h2>
      <div class="scanbox" id="scb"><video id="scv" playsinline muted autoplay></video><i class="scan-frame" aria-hidden="true"></i><i class="scan-laser" aria-hidden="true"></i>
        <p class="scan-msg" id="scm" aria-live="polite">${esc(t('scanLoading'))}</p></div>
      ${multi ? '<p class="scan-last" id="scl" aria-live="polite"></p>' : ''}
      <form class="scan-manual" id="scf"><input id="sci" class="input mono" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="${esc(t('scanManualPh'))}" aria-label="${esc(t('scanManualPh'))}">
        <button class="btn btn-ink" aria-label="${esc(t('scanGot', { c: '' }))}">${I('check')}</button></form>
      <div class="sheet-actions"><label class="btn btn-ghost">${I('camera')} ${esc(t('scanPhoto'))}<input type="file" accept="image/*" class="sr" id="scp"></label>
        <button type="button" class="btn ${multi ? 'btn-signal' : 'btn-ghost'}" data-close>${esc(t(multi ? 'scanDone' : 'scanCancel'))}</button></div>`,
      { label: o.title || t('scanT'), onClose: () => { closed = true; if (stop) stop(); resolve(null); } });
    const el = s.el, msg = $('#scm', el);
    function got(raw, again) {
      const code = String(raw || '').trim().slice(0, 60);
      if (!code || closed) return;
      const now = Date.now();
      if (!again && code === last && now - lastAt < 2000) return; /* the same label is still in front of the camera */
      last = code; lastAt = now; beep();
      if (!multi) { resolve(code); s.close(); return; }
      const l = $('#scl', el);
      if (l) l.textContent = t('scanGot', { c: code });
      Promise.resolve(o.onCode(code)).then(m => { if (m && l && !closed) l.textContent = m; }).catch(() => {});
    }
    function noCam(m) { const b = $('#scb', el); if (b) b.classList.add('off'); msg.textContent = m; }
    $('#scf', el).onsubmit = e => { e.preventDefault(); const i = $('#sci', el), v = i.value; i.value = ''; got(v, true); };
    $('#scp', el).onchange = async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const before = msg.textContent;
      msg.textContent = t('scanReading');
      try {
        const en = eng || await engine();
        for (const max of [1600, 2600]) {
          const code = await en.still(await toCanvas(f, max));
          if (code) { msg.textContent = before; got(code, true); return; }
        }
        msg.textContent = t('scanNotFound');
      } catch (x) { msg.textContent = t(x && x.offline ? 'rcvOffline' : 'scanNotFound'); }
    };
    (async () => {
      /* the Claude app's page frame has no camera: go straight to the photo and typing options */
      if (CFG.embedded || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || window.isSecureContext === false) { noCam(t('scanNoCam')); return; }
      try {
        eng = await engine();
        if (closed) return;
        const st = await eng.start($('#scv', el), got);
        if (closed) { st(); return; }
        stop = st;
        $('#scb', el).classList.add('live');
        msg.textContent = t('scanHint');
      } catch (x) {
        noCam(t(x && (x.name === 'NotAllowedError' || x.name === 'SecurityError') ? 'scanDenied' : x && x.offline ? 'rcvOffline' : 'scanNoCam'));
      }
    })();
  });

  /* The part whose item code, barcode or part number is exactly this code (staff see every branch; the given branch first). */
  SP.findByCode = async (code, branch) => {
    const c = String(code || '').trim(), k = key(c);
    if (k.length < 2) return null;
    const r = await api.search({ ...SP.searchArgs({ ...SP.FDEF, q: c }, { limit: 20 }), p_country: null, p_city: null, p_include_sold: true });
    const pick = list => list.find(p => branch && p.shop_id === branch) || list[0];
    return pick(r.items.filter(p => p.sku && key(p.sku) === k)) || pick(r.items.filter(p => p.barcode && key(p.barcode) === k)) || pick(r.items.filter(p => p.part_no && key(p.part_no) === k)) || null;
  };

  /* ---------- reading a photographed invoice ---------- */
  /* Best-effort reading of recognised text: one item per line that has a name or a code and a quantity or a price. */
  const SKIP = /(الاجمالي|اجمالي|المجموع|الصافي|المبلغ|الخصم|خصم|الضريبه|ضريبه|المدفوع|الباقي|المتبقي|التاريخ|تاريخ|فاتوره|هاتف|تلفون|جوال|العنوان|العميل|الزبون|السيد|الساده|توقيع|المستلم|البائع|صفحه|نقدا|كاش|\b(total|subtotal|sub-total|grand|amount|balance|discount|tax|vat|invoice|date|tel|phone|fax|mobile|address|customer|signature|page|cash|paid|due)\b)/i;
  const QTYW = /(الكميه|كميه|العدد|\b(qty|quantity|qnty|pcs)\b)/i, PRICEW = /(السعر|سعر|الافرادي|\b(price|unit|rate)\b)/i;
  SP.parseInvoiceText = text => {
    const rows = String(text || '').split(/\r?\n/), items = [];
    let supplier = '', qtyFirst = true;
    /* column order from the header row (quantity before unit price, or the other way round) */
    for (const r of rows) {
      const h = SP.norm(SP.digits(r)), q = h.search(QTYW), p = h.search(PRICEW);
      if (q >= 0 && p >= 0 && !/\d{2,}/.test(h)) { qtyFirst = q < p; break; }
    }
    rows.forEach((raw, idx) => {
      const line = SP.digits(raw).replace(/[٫]/g, '.').replace(/[٬]/g, ',').replace(/[|¦\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line) return;
      const tokens = line.split(' ').map(w => w.replace(/^[()[\]{}«»"'“”‘’:;*#،,.]+|[()[\]{}«»"'“”‘’:;*#،,]+$/g, '').replace(/\.$/, '')).filter(Boolean);
      const nums = [], codes = [], words = [];
      let barcode = '';
      for (const w of tokens) {
        if (/^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/.test(w) || /^\d{1,2}:\d{2}(:\d{2})?$/.test(w)) continue; /* dates and times */
        if (/^\d{8,14}$/.test(w)) { if (!barcode) barcode = w; else codes.push(w); continue; }
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(w) || /^-?\d{1,7}([.,]\d{1,3})?$/.test(w)) { nums.push(toNum(w)); continue; }
        if (w.length >= 4 && /\d/.test(w) && /^[A-Za-z0-9][A-Za-z0-9\-./]*[A-Za-z0-9]$/.test(w)) { codes.push(w.toUpperCase()); continue; }
        if (/[A-Za-z؀-ۿ]{2,}/.test(w)) words.push(w);
      }
      const skip = SKIP.test(SP.norm(line)) && !codes.length; /* totals, dates, phone numbers… unless the line carries a part code */
      if (!supplier && idx < 5 && !nums.length && !codes.length && !barcode && words.length >= 2 && !skip) supplier = words.join(' ').slice(0, 120);
      if (skip || (!nums.length && !barcode) || (!words.length && !codes.length && !barcode)) return;
      codes.sort((a, b) => b.length - a.length);
      const code = codes[0] || '', extra = codes.slice(1).filter(c => c.length < 8);
      let qty = null, cost = null, best = null;
      for (let i = 0; i < nums.length; i++) for (let j = 0; j < nums.length; j++) for (let k = 0; k < nums.length; k++) {
        if (i === j || j === k || i === k) continue;
        const q = nums[i], p = nums[j], tt = nums[k];
        if (!Number.isInteger(q) || q < 1 || q > 100000 || !(p > 0) || !(tt > 0)) continue;
        if (Math.abs(q * p - tt) <= Math.max(tt * 0.011, 0.05)) {
          const score = (k === nums.length - 1 ? 4 : 0) + (k > i && k > j ? 2 : 0) + ((i < j) === qtyFirst ? 2 : 0) + (q <= p ? 0.5 : 0);
          if (!best || score > best.score) best = { q, p, score };
        }
      }
      if (best) { qty = best.q; cost = best.p; }
      else {
        const ns = nums.slice(-2), okQ = v => Number.isInteger(v) && v >= 1 && v <= 100000;
        if (ns.length === 2) {
          let [a, b] = qtyFirst ? ns : [ns[1], ns[0]];
          if (!okQ(a) && okQ(b)) [a, b] = [b, a];
          if (okQ(a)) { qty = a; cost = b; } else cost = ns[1];
        } else if (ns.length === 1) {
          if (okQ(ns[0]) && ns[0] <= 500) qty = ns[0]; else cost = ns[0];
        }
      }
      const title = words.concat(extra).join(' ').slice(0, 120) || code || barcode;
      if (qty == null && cost == null) return;
      items.push({ code, barcode, title, qty: qty == null ? 1 : qty, cost: cost != null && cost > 0 ? Math.round(cost * 1000) / 1000 : null });
    });
    return { supplier, items: items.slice(0, 300) };
  };
  const NOAI = 'sp_noai';
  const noAi = () => { try { return sessionStorage.getItem(NOAI) === '1'; } catch (e) { return false; } };
  const aiReady = () => !SP.demo && !!(SP.sb && SP.sb.functions) && CFG.aiScan !== false && !noAi();
  /* 1) the company's AI reader (Supabase function "scan-invoice"; needs an Anthropic API key on the server);
     2) otherwise text recognition on this device (Tesseract), then the best-effort parse above.
     SP.invoiceEngine(file, progress), when set, replaces both (the in-app page edition reads with Claude: js/embed.js). */
  SP.readInvoice = async (file, progress) => {
    const say = progress || (() => {});
    if (window.SP_SCAN_ENGINE) return window.SP_SCAN_ENGINE(file, say);
    if (typeof SP.invoiceEngine === 'function') return SP.invoiceEngine(file, say);
    if (aiReady()) {
      try {
        say('ai');
        const c = await toCanvas(file, 1600);
        const r = await sb().functions.invoke('scan-invoice', { body: { image: c.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' } });
        if (r.error) throw r.error;
        if (r.data && Array.isArray(r.data.items)) return { supplier: r.data.supplier || '', items: r.data.items, engine: 'ai' };
      } catch (e) {
        const st = e && e.context && e.context.status;
        if (st === 404 || st === 503 || (e && e.name === 'FunctionsRelayError')) try { sessionStorage.setItem(NOAI, '1'); } catch (x) { /* private mode */ }
      }
    }
    say('load', 0);
    const T = await lib('Tesseract');
    const c = await toCanvas(file, 2200, true);
    const worker = await T.createWorker('ara+eng', 1, { logger: m => { if (m && m.status === 'recognizing text') say('read', m.progress || 0); else if (m) say('load', m.progress || 0); } });
    try {
      const out = await worker.recognize(c);
      return { ...SP.parseInvoiceText(out && out.data && out.data.text), engine: 'device' };
    } finally { Promise.resolve(worker.terminate()).catch(() => {}); }
  };

  /* ---------- receiving stock ---------- */
  const RCV = 'sp_rcv';
  const loadR = () => { try { return JSON.parse(sessionStorage.getItem(RCV) || 'null') || { lines: [], supplier: '', note: '' }; } catch (e) { return { lines: [], supplier: '', note: '' }; } };
  const saveR = v => { try { sessionStorage.setItem(RCV, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const lid = () => Math.random().toString(36).slice(2, 10);
  const money = (v, cur) => SP.priceText(Number(v || 0), cur || SP.currencyOf(S.country));
  const matchOf = p => ({ id: p.id, title: p.title, qty: p.qty, sku: p.sku || '', part_no: p.part_no || '', barcode: p.barcode || '', price: p.price, cost: p.cost, cur: p.shop && p.shop.currency });
  function rcvErr(e) {
    const m = String((e && e.message) || '');
    if (/new item needs a name/.test(m)) return t('rcvNeedName');
    if (/bad quantity/.test(m)) return t('rcvBadQty');
    if (/1 to 300/.test(m)) return t('rcvMany');
    if (/supplier needed for credit/.test(m)) return t('rcvNeedSupplier');
    if (/not authorized/.test(m)) return t('errPerm');
    return SP.errText(e);
  }
  function undoErr(e) {
    const m = String((e && e.message) || ''), x = /already sold: (.+)$/.exec(m);
    if (x) return t('rcvUndoSold', { t: x[1] });
    if (/not authorized/.test(m)) return t('rcvUndoOld');
    return SP.errText(e);
  }
  function guard(perm, title) {
    if (!S.user) { S.after = SP.here(); shell(bar(title) + `<main class="wrap">${empty('lock', t('needLoginT'), '', `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (!perm.some(p => SP.can(p))) { shell(bar(title) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return false; }
    return true;
  }

  /* entering a read invoice by itself: on unless switched off on this device */
  const AUTO = 'sp_rcv_auto';
  const autoOn = () => { try { return localStorage.getItem(AUTO) !== '0'; } catch (e) { return true; } };
  SP.route(/^receive$/, async (m, n) => {
    if (gate(n) || !guard(['purchases'], t('rcvT'))) return;
    const st = loadR(), fixedBranch = S.perms && S.perms.branch, canPrice = SP.can('products');
    shell(bar(t('rcvT'), `<a class="iconbtn" href="#purchases" aria-label="${esc(t('purT'))}">${I('copy')}</a>`) + `<main class="wrap pos rcv">
      <div class="rcv-actions"><label class="rcv-big" id="rphoto">${I('receipt')}<b>${esc(t('rcvPhoto'))}</b><small>${esc(t('rcvPhotoSub'))}</small><input type="file" accept="image/*" class="sr" id="rpf"></label>
        <button type="button" class="rcv-big" id="rscan">${I('scan')}<b>${esc(t('rcvScan'))}</b><small>${esc(t('rcvScanSub'))}</small></button></div>
      <label class="switch rcv-auto"><input type="checkbox" id="rauto"${autoOn() ? ' checked' : ''}><span></span>${esc(t('rcvAuto'))}</label><span class="hint">${esc(t('rcvAutoHint'))}</span>
      <div id="rread"></div>
      <form class="field" id="rsf" role="search"><label for="rq" class="sr">${esc(t('search'))}</label><div class="inrow"><input id="rq" class="input" autocomplete="off" placeholder="${esc(t('rcvSearchPh'))}" enterkeyhint="search"></div></form>
      <div id="rres" class="pres"></div>
      <div class="row2"><div class="field"><label for="rsup">${esc(t('rcvSupplier'))}</label><input id="rsup" class="input" maxlength="120" value="${esc(st.supplier || '')}"></div>
        <div class="field"><label for="rbr">${esc(t('posBranch'))}</label><select id="rbr" class="input"${fixedBranch ? ' disabled' : ''}></select></div></div>
      <div id="rpayb"></div>
      <h2 class="lbl" id="rhead"></h2><div id="rlines" class="plines"></div><div id="rsum"></div></main>`);
    try {
      const sh = (await api.shops({ p_limit: 100 })).items;
      if (!SP.alive(n)) return;
      const cur = fixedBranch || st.branch || (sh[0] && sh[0].id) || '';
      $('#rbr').innerHTML = sh.map(s => opt(s.id, s.name + ' · ' + s.city, cur)).join('');
      st.branch = $('#rbr').value; saveR(st);
    } catch (e) { /* branch list optional: the database picks the main branch */ }
    $('#rbr').onchange = e => { st.branch = e.target.value; saveR(st); };
    $('#rauto').onchange = e => { try { localStorage.setItem(AUTO, e.target.checked ? '1' : '0'); } catch (x) { /* private mode */ } };
    /* paying the supplier: chosen before the photo, so an invoice that goes in by itself is recorded right */
    function drawPay() {
      $('#rpayb').innerHTML = `<fieldset class="field"><legend>${esc(t('rcvPayT'))}</legend><div class="seg">${[['full', 'rcvPaidFull'], ['credit', 'rcvCredit'], ['part', 'rcvPart']].map(([k, l], i) =>
          `<input type="radio" name="rpay" id="rpay${i}" value="${k}"${(st.pay || 'full') === k ? ' checked' : ''}><label for="rpay${i}">${esc(t(l))}</label>`).join('')}</div></fieldset>
        ${st.pay === 'part' ? `<div class="prow"><label for="rpaid">${esc(t('rcvPaidNow'))}</label><input id="rpaid" class="input num" inputmode="decimal" dir="ltr" maxlength="12" value="${esc(st.paid || '')}"></div>` : ''}`;
      $$('input[name=rpay]').forEach(r => r.onchange = () => { st.pay = r.value; saveR(st); drawPay(); });
      if ($('#rpaid')) $('#rpaid').oninput = e => { st.paid = SP.digits(e.target.value); e.target.classList.remove('invalid'); saveR(st); };
    }
    drawPay();
    $('#rsup').oninput = e => { st.supplier = e.target.value; e.target.classList.remove('invalid'); saveR(st); };

    /* catalog matching */
    async function check(l) {
      const code = l.barcode || l.code;
      if (!code) { l.state = 'new'; return; }
      l.state = 'checking';
      try {
        let p = await SP.findByCode(code, st.branch);
        if (!p && l.barcode && l.code) p = await SP.findByCode(l.code, st.branch);
        l.match = p ? matchOf(p) : null;
        if (p && l.cost == null && p.cost != null) l.cost = p.cost;
      } catch (e) { l.match = null; }
      l.state = l.match ? 'ok' : 'new';
    }
    async function checkAll(list) {
      const queue = list.slice();
      await Promise.all([0, 1, 2].map(async () => { while (queue.length) { await check(queue.shift()); if (SP.alive(n)) { saveR(st); draw(); } } }));
    }
    function addLine(v, at) {
      const l = { k: lid(), code: v.code || '', barcode: v.barcode || '', title: v.title || '', qty: v.qty || 1, cost: v.cost == null ? null : v.cost, price: null, cat: 'other', src: v.src || '', match: v.match || null, state: v.match ? 'ok' : 'checking' };
      if (at === 'top') st.lines.unshift(l); else st.lines.push(l);
      return l;
    }
    function addPart(p, qty) {
      const ex = st.lines.find(l => l.match && l.match.id === p.id);
      if (ex) { ex.qty += qty || 1; saveR(st); draw(); return ex; }
      const l = addLine({ code: p.sku || p.part_no || p.barcode || '', barcode: p.barcode || '', title: p.title, qty: qty || 1, cost: p.cost, match: matchOf(p), src: 'search' }, 'top');
      saveR(st); draw(); return l;
    }
    /* search box: a scanner gun types the code and Enter */
    async function find(q) {
      q = q.trim();
      if (!SP.alive(n) || !$('#rres')) return;
      if (!q) { $('#rres').innerHTML = ''; return; }
      try {
        const r = await api.search({ ...SP.searchArgs({ ...SP.FDEF, q }, { limit: 8 }), p_country: null, p_city: null, p_include_sold: true });
        if (!SP.alive(n) || !$('#rres')) return;
        const k = key(q), exact = r.items.filter(p => (p.sku && key(p.sku) === k) || (p.barcode && key(p.barcode) === k) || (p.part_no && key(p.part_no) === k));
        if (exact.length === 1) { addPart(exact[0]); $('#rq').value = ''; $('#rres').innerHTML = ''; return; }
        const asNew = k.length >= 4 && !/\s/.test(q) ? `<button type="button" class="pres-row" data-new="1"><span><b>${esc(t('rcvAsNew'))}</b><small class="mono">${esc(q)}</small></span>${I('plus')}</button>` : '';
        $('#rres').innerHTML = r.items.map(p => `<button type="button" class="pres-row" data-id="${p.id}"><span><b>${esc(p.title)}</b><small>${esc([p.sku || p.part_no, p.barcode, p.qty != null ? t('posInStock', { n: p.qty }) : ''].filter(Boolean).join(' · '))}</small></span>${I('plus')}</button>`).join('') + asNew
          || `<p class="muted-p">${esc(t('noResT'))}</p>`;
        $('#rres').onclick = e => {
          const b = e.target.closest('[data-id],[data-new]');
          if (!b) return;
          if (b.dataset.id) addPart(r.items.find(p => p.id === b.dataset.id));
          else { const isBar = /^\d{8,14}$/.test(q); addLine({ code: isBar ? '' : q.toUpperCase(), barcode: isBar ? q : '', src: 'search' }, 'top').state = 'new'; saveR(st); draw(); }
          $('#rq').value = ''; $('#rres').innerHTML = ''; $('#rq').focus();
        };
      } catch (e) { if ($('#rres')) $('#rres').innerHTML = `<p class="form-err">${esc(SP.errText(e))}</p>`; }
    }
    $('#rsf').onsubmit = e => { e.preventDefault(); find($('#rq').value); };
    $('#rq').oninput = SP.debounce(e => find(e.target.value), 350);
    /* camera scanning: several parts in a row */
    $('#rscan').onclick = () => SP.scanCode({
      title: t('rcvScan'),
      onCode: async code => {
        const p = await SP.findByCode(code, st.branch).catch(() => null);
        if (!SP.alive(n)) return '';
        if (p) { addPart(p); return t('scanAdded', { t: p.title }); }
        const k = key(code), ex = st.lines.find(l => !l.match && (key(l.code) === k || l.barcode === code));
        if (ex) ex.qty++; else addLine({ code: /^\d{8,14}$/.test(code) ? '' : code.toUpperCase(), barcode: /^\d{8,14}$/.test(code) ? code : '', src: 'scan' }, 'top').state = 'new';
        saveR(st); draw();
        return t('scanUnknown', { c: code });
      }
    });
    /* invoice photo */
    $('#rpf').onchange = e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) readPhoto(f);
    };
    async function readPhoto(f) {
      const box = $('#rread'), url = URL.createObjectURL(f);
      const status = (txt, pct) => { const s = $('#rrs'); if (s) s.textContent = txt + (pct ? ' ' + Math.round(pct * 100) + '%' : ''); };
      box.innerHTML = `<div class="readcard busy"><img src="${url}" alt=""><span class="ar-main"><b>${esc(t('rcvReading'))}</b><small id="rrs" aria-live="polite"></small></span><span class="spin dark"></span></div>`;
      $('#rphoto').classList.add('busy');
      try {
        const r = await SP.readInvoice(f, (stage, pct) => status(t(stage === 'ai' ? 'rcvAi' : stage === 'read' ? 'rcvReading' : 'rcvLoadingOcr'), stage === 'ai' ? 0 : pct));
        if (!SP.alive(n)) return;
        const items = (r.items || []).slice(0, 300).map(x => ({
          code: String(x.code || '').trim().toUpperCase().slice(0, 60), barcode: String(x.barcode || '').replace(/\D/g, '').slice(0, 20),
          title: String(x.title || '').trim().slice(0, 120), qty: Math.max(1, Math.round(toNum(x.qty) || 1)), cost: toNum(x.cost != null ? x.cost : x.unit_price), src: 'photo'
        })).filter(x => x.title || x.code || x.barcode);
        if (r.supplier && !st.supplier) { st.supplier = String(r.supplier).slice(0, 120); $('#rsup').value = st.supplier; }
        const added = items.map(x => addLine(x));
        saveR(st); draw();
        box.innerHTML = `<div class="readcard ${items.length ? 'ok' : 'warn'}"><img src="${url}" alt=""><span class="ar-main"><b>${esc(t('rcvFromPhoto'))}</b>
          <small>${esc(items.length ? t(r.engine === 'ai' ? 'rcvReadAi' : 'rcvReadLocal', { n: items.length }) : t('rcvReadNone'))}</small><small class="rcv-wait" id="rwait" hidden></small></span></div>`;
        await checkAll(added);
        if (items.length && SP.alive(n) && $('#rauto') && $('#rauto').checked) await autoEnter(r.engine, url);
      } catch (x) {
        if (SP.alive(n)) box.innerHTML = `<div class="readcard warn"><img src="${url}" alt=""><span class="ar-main"><b>${esc(t('rcvFromPhoto'))}</b><small>${esc(x && x.userMsg ? x.userMsg : x && x.offline ? t('rcvOffline') : t('rcvReadFail', { e: SP.errText(x) }))}</small></span></div>`;
      } finally { const b = $('#rphoto'); if (b) b.classList.remove('busy'); }
    }
    /* A read invoice goes in by itself when every line is complete and can be trusted: read by the AI reader, or every part known
       by its code. Otherwise it waits on screen with the reason, and "Add to stock" enters it as before. */
    const lineOk = l => Number.isInteger(Number(l.qty)) && Number(l.qty) >= 1 && (l.match || String(l.title || '').trim().length >= 2);
    async function autoEnter(engine, url) {
      const wait = k => { const w = $('#rwait'); if (w) { w.textContent = t(k, { n: SP.fmtNum(st.lines.filter(l => !lineOk(l)).length) }); w.hidden = false; } };
      const bad = st.lines.filter(l => !lineOk(l));
      if (bad.length) {
        bad.forEach(l => { const row = $(`[data-k="${l.k}"]`); if (row) $$(!l.match && String(l.title || '').trim().length < 2 ? '[data-f="title"]' : '[data-f="qty"]', row).forEach(x => x.classList.add('invalid')); });
        return wait('rcvWaitFix');
      }
      if (engine !== 'ai' && !st.lines.every(l => l.match)) return wait('rcvWaitDevice');
      if (st.pay === 'part' && !(Number(String(st.paid || '').replace(',', '.')) > 0)) { if ($('#rpaid')) $('#rpaid').classList.add('invalid'); return wait('rcvWaitPaid'); }
      if (st.pay && st.pay !== 'full' && !(st.supplier || '').trim()) { $('#rsup').classList.add('invalid'); return wait('rcvWaitSupplier'); }
      await save({ auto: true, url });
    }

    /* the lines */
    const curOf = () => { const l = st.lines.find(x => x.match && x.match.cur); return (l && l.match.cur) || SP.currencyOf(S.country); };
    function draw() {
      if (!SP.alive(n) || !$('#rlines')) return;
      const a = document.activeElement, row = a && a.closest && a.closest('#rlines [data-k]');
      const keep = row && a.dataset.f ? { k: row.dataset.k, f: a.dataset.f, pos: a.selectionStart } : null;
      paint();
      if (keep) {
        const el = $(`#rlines [data-k="${keep.k}"] [data-f="${keep.f}"]`);
        if (el) { el.focus({ preventScroll: true }); try { if (keep.pos != null) el.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* not a text field */ } }
      }
    }
    function paint() {
      const cur = curOf(), units = st.lines.reduce((k, l) => k + (Number(l.qty) || 0), 0), total = st.lines.reduce((k, l) => k + (Number(l.cost) || 0) * (Number(l.qty) || 0), 0);
      $('#rhead').textContent = st.lines.length ? t('rcvLines', { n: st.lines.length }) : '';
      $('#rlines').innerHTML = st.lines.length ? st.lines.map(l => {
        const state = l.state === 'checking' ? `<span class="rl-state">${esc(t('rcvChecking'))}</span>`
          : l.match ? `<span class="rl-state ok">${I('check')}<span><b>${esc(l.match.title)}</b><small>${esc([l.match.sku || l.match.part_no, t('rcvMatched', { n: l.match.qty == null ? '—' : l.match.qty })].filter(Boolean).join(' · '))}</small></span></span>`
          : `<span class="rl-state new">${I('plus')}<span><b>${esc(t('rcvNew'))}</b>${l.src === 'photo' && l.title ? `<small>${esc(l.title)}</small>` : ''}</span></span>`;
        return `<div class="rline ${l.match ? 'ok' : l.state === 'checking' ? '' : 'new'}" data-k="${l.k}">
          <div class="rl-head">${state}<button type="button" class="iconbtn sm" data-a="pick" aria-label="${esc(t('rcvChange'))}">${I('edit')}</button><button type="button" class="iconbtn sm" data-a="del" aria-label="${esc(t('rcvDel'))}">${I('trash')}</button></div>
          <div class="rl-grid"><label>${esc(t('rcvCode'))}<input class="input mono" dir="ltr" data-f="code" maxlength="60" spellcheck="false" value="${esc(l.barcode && !l.code ? l.barcode : l.code)}"></label>
            <label>${esc(t('posQty'))}<input class="input num" dir="ltr" inputmode="numeric" data-f="qty" maxlength="7" value="${esc(l.qty)}"></label>
            <label>${esc(t('rcvCost'))}<input class="input num" dir="ltr" inputmode="decimal" data-f="cost" maxlength="12" value="${l.cost == null ? '' : esc(l.cost)}"></label></div>
          ${!l.match && l.state !== 'checking' ? `<div class="rl-new"><label class="wide"><span>${esc(t('rcvName'))} <span class="req">*</span></span><input class="input" data-f="title" maxlength="120" value="${esc(l.title)}"></label>
            <label>${esc(t('category'))}<select class="input" data-f="cat">${D.CATS.map(c => opt(c.id, SP.catName(c.id), l.cat || 'other')).join('')}</select></label>
            ${canPrice ? `<label>${esc(t('rcvSell'))}<input class="input num" dir="ltr" inputmode="decimal" data-f="price" maxlength="12" value="${l.price == null ? '' : esc(l.price)}"></label>` : ''}</div>` : ''}
        </div>`;
      }).join('') : `<p class="muted-p pos-empty">${esc(t('rcvEmpty'))}</p>`;
      $('#rsum').innerHTML = st.lines.length ? `<div class="mcard psum"><div class="prow"><span>${esc(t('rcvUnits'))}</span><b class="num">${esc(SP.fmtNum(units))}</b></div>
          <div class="prow big"><span>${esc(t('rcvTotal'))}</span><b class="num" id="rtot">${esc(money(total, cur))}</b></div>
          <div class="field"><label for="rnote">${esc(t('rcvNote'))}</label><input id="rnote" class="input" maxlength="500" value="${esc(st.note || '')}"></div>
          <p class="form-err" id="rerr" role="alert"></p>
          <div class="form-actions"><button type="button" class="btn btn-signal" id="rsave">${I('check')} ${esc(t('rcvSave'))}</button>
            ${SP.can('sales') ? `<button type="button" class="btn btn-ink" id="rpos">${I('tag')} ${esc(t('rcvToPos'))}</button>` : ''}
            <button type="button" class="btn btn-ghost" id="rclr">${I('trash')} ${esc(t('rcvClear'))}</button></div></div>` : '';
      if ($('#rnote')) $('#rnote').oninput = e => { st.note = e.target.value; saveR(st); };
      if ($('#rsave')) $('#rsave').onclick = save;
      if ($('#rpos')) $('#rpos').onclick = toPos;
      if ($('#rclr')) $('#rclr').onclick = async () => { if (await SP.confirmSheet({ title: t('rcvClearQ'), ok: t('rcvClear'), danger: true })) { st.lines = []; st.note = ''; st.supplier = ''; st.pay = 'full'; st.paid = ''; $('#rsup').value = ''; drawPay(); saveR(st); $('#rread').innerHTML = ''; draw(); } };
    }
    const lineOf = el => st.lines.find(l => l.k === (el.closest('[data-k]') || {}).dataset.k);
    $('#rlines').addEventListener('input', e => {
      const f = e.target.dataset.f, l = f && lineOf(e.target);
      if (!l) return;
      const v = e.target.value;
      if (f === 'qty') { const q = toNum(v); l.qty = q == null ? '' : q; }
      else if (f === 'cost' || f === 'price') l[f] = toNum(v);
      else if (f === 'code') { const s = v.trim(); if (/^\d{8,14}$/.test(s)) { l.barcode = s; l.code = ''; } else { l.code = s.toUpperCase(); l.barcode = l.match ? l.barcode : ''; } }
      else l[f] = v;
      saveR(st);
      if (f === 'qty' || f === 'cost') { const tot = st.lines.reduce((k, x) => k + (Number(x.cost) || 0) * (Number(x.qty) || 0), 0); if ($('#rtot')) $('#rtot').textContent = money(tot, curOf()); }
    });
    $('#rlines').addEventListener('change', async e => {
      if (e.target.dataset.f !== 'code') return;
      const l = lineOf(e.target);
      if (!l) return;
      l.match = null; l.state = 'checking'; draw();
      await check(l); saveR(st); draw();
    });
    $('#rlines').addEventListener('click', async e => {
      const b = e.target.closest('[data-a]'), l = b && lineOf(b);
      if (!l) return;
      if (b.dataset.a === 'del') { st.lines.splice(st.lines.indexOf(l), 1); saveR(st); draw(); return; }
      const p = await pickPart(l.title || l.code || l.barcode);
      if (p === undefined) return;
      if (p) { l.match = matchOf(p); l.state = 'ok'; if (l.cost == null && p.cost != null) l.cost = p.cost; } else { l.match = null; l.state = 'new'; }
      saveR(st); draw();
    });
    function pickPart(q) {
      return new Promise(res => {
        let val;
        const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('rcvPick'))}</h2><form class="searchbox flat" id="ppf" role="search">${I('search')}<input type="search" id="ppq" value="${esc(q || '')}" autofocus></form>
          <div id="ppr" class="pres"></div><div class="sheet-actions"><button type="button" class="btn btn-ghost" id="ppn">${I('plus')} ${esc(t('rcvAsNew'))}</button></div>`,
          { label: t('rcvPick'), onClose: () => res(val) });
        let items = [];
        const go = async () => {
          const v = $('#ppq', s.el).value.trim();
          if (!v) { $('#ppr', s.el).innerHTML = ''; return; }
          try {
            items = (await api.search({ ...SP.searchArgs({ ...SP.FDEF, q: v }, { limit: 10 }), p_country: null, p_city: null, p_include_sold: true })).items;
            $('#ppr', s.el).innerHTML = items.map(p => `<button type="button" class="pres-row" data-id="${p.id}"><span><b>${esc(p.title)}</b><small>${esc([p.sku || p.part_no, p.barcode, p.qty != null ? t('posInStock', { n: p.qty }) : ''].filter(Boolean).join(' · '))}</small></span>${I('check')}</button>`).join('') || `<p class="muted-p">${esc(t('noResT'))}</p>`;
          } catch (x) { $('#ppr', s.el).innerHTML = `<p class="form-err">${esc(SP.errText(x))}</p>`; }
        };
        $('#ppf', s.el).onsubmit = e => { e.preventDefault(); go(); };
        $('#ppq', s.el).oninput = SP.debounce(go, 300);
        $('#ppr', s.el).onclick = e => { const b = e.target.closest('[data-id]'); if (b) { val = items.find(p => p.id === b.dataset.id) || undefined; s.close(); } };
        $('#ppn', s.el).onclick = () => { val = null; s.close(); };
        if (q) go();
      });
    }
    async function save(o) {
      o = o && o.auto ? o : {};
      const b = $('#rsave'), err = $('#rerr');
      if (!b || !err) return;
      err.textContent = '';
      $$('.invalid', $('#rlines')).forEach(x => x.classList.remove('invalid'));
      if (!st.lines.length) { err.textContent = t('rcvNeedLines'); return; }
      if (st.lines.length > 300) { err.textContent = t('rcvMany'); return; }
      for (const l of st.lines) {
        const row = $(`[data-k="${l.k}"]`);
        if (!Number.isInteger(Number(l.qty)) || Number(l.qty) < 1) { err.textContent = t('rcvBadQty'); const i = row && $('[data-f="qty"]', row); if (i) { i.classList.add('invalid'); i.focus(); } return; }
        if (!l.match && String(l.title || '').trim().length < 2) { err.textContent = t('rcvNeedName'); const i = row && $('[data-f="title"]', row); if (i) { i.classList.add('invalid'); i.focus(); } return; }
      }
      /* on credit or part paid: what was paid now (the rest is owed to the supplier, so the name is needed) */
      const paid = st.pay === 'credit' ? 0 : st.pay === 'part' ? Number(String(st.paid || '').replace(',', '.')) || 0 : null;
      if (paid != null && !(st.supplier || '').trim()) { err.textContent = t('rcvNeedSupplier'); $('#rsup').classList.add('invalid'); $('#rsup').focus(); return; }
      b.classList.add('busy');
      const source = st.lines.some(l => l.src === 'photo') ? 'photo' : st.lines.some(l => l.src === 'scan') ? 'scan' : 'manual';
      try {
        const r = await chk(await sb().rpc('receive_stock', { p: {
          branch: st.branch || null, supplier: (st.supplier || '').trim(), note: (st.note || '').trim(), ...(paid != null ? { paid } : {}), source, auto: !!o.auto,
          items: st.lines.map(l => l.match ? { product_id: l.match.id, qty: Number(l.qty), cost: l.cost }
            : { part_no: l.code || '', barcode: l.barcode || '', title: l.title.trim(), qty: Number(l.qty), cost: l.cost, price: canPrice ? l.price : null, cat: l.cat || 'other' })
        } }));
        sessionStorage.removeItem(RCV);
        if (o.auto) return entered(r, o.url);
        SP.toast(t('rcvSaved', { n: r.no, u: r.updated, a: r.new }));
        SP.go('purchases');
      } catch (x) { err.textContent = rcvErr(x); b.classList.remove('busy'); }
    }
    /* entered by itself: what went in, and a way to take it back (the lines come back to fix) */
    function entered(r, url) {
      const was = JSON.parse(JSON.stringify(st.lines)), cur = curOf();
      st.lines = []; st.note = ''; saveR(st); draw();
      $('#rread').innerHTML = `<div class="readcard ok done">${url ? `<img src="${url}" alt="">` : ''}<span class="ar-main"><b>${I('check')} ${esc(t('rcvAutoDone'))}</b>
          <small>${esc(t('rcvAutoSum', { n: r.no, u: SP.fmtNum(r.updated), a: SP.fmtNum(r.new) }))}${r.total ? ' · ' + esc(money(r.total, cur)) : ''}</small></span></div>
        <table class="inv-items rcv-done"><tbody>${was.map(l => `<tr><td>${esc(l.match ? l.match.title : l.title)}${l.code || l.barcode ? `<small class="mono">${esc(l.code || l.barcode)}</small>` : ''}</td>
          <td class="num">× ${esc(SP.fmtNum(+l.qty))}</td><td>${l.match ? '' : `<span class="pill">${esc(t('rcvNewShort'))}</span>`}</td></tr>`).join('')}</tbody></table>
        <div class="form-actions"><button type="button" class="btn btn-ghost" id="rundo">${I('undo')} ${esc(t('rcvUndo'))}</button><a class="btn btn-ghost" href="#purchases">${I('copy')} ${esc(t('rcvSeeList'))}</a>
          <label class="btn btn-signal" for="rpf">${I('camera')} ${esc(t('rcvAnother'))}</label></div>`;
      $('#rundo').onclick = async () => {
        if (!await SP.confirmSheet({ title: t('rcvUndoQ', { n: r.no }), body: t('rcvUndoB'), ok: t('rcvUndo'), danger: true })) return;
        const b = $('#rundo'); if (b) b.classList.add('busy');
        try {
          await chk(await sb().rpc('undo_receipt', { p_id: r.id }));
          SP.toast(t('rcvUndone', { n: r.no }), 5000);
          /* the lines come back as they were read; the known parts are looked up again for their stock now */
          st.lines = was; st.lines.forEach(l => { if (l.match) l.state = 'checking'; });
          saveR(st); $('#rread').innerHTML = ''; draw(); checkAll(st.lines.filter(l => l.state === 'checking'));
        } catch (x) { if (b) b.classList.remove('busy'); SP.toast(undoErr(x), 5000); }
      };
    }
    function toPos() {
      const ok = st.lines.filter(l => l.match), skipped = st.lines.length - ok.length;
      if (!ok.length) { $('#rerr').textContent = t('rcvToPosSkip', { n: skipped }); return; }
      SP.posLoad(ok.map(l => ({ id: l.match.id, title: l.match.title, sku: l.match.sku || l.match.part_no, price: l.match.price, qty: Math.max(1, Math.round(Number(l.qty) || 1)), stock: l.match.qty, cur: l.match.cur })));
      if (skipped) SP.toast(t('rcvToPosSkip', { n: skipped }));
      SP.go('pos');
    }
    draw();
    checkAll(st.lines.filter(l => l.state === 'checking'));
    /* a photo or a scan started from the stock page */
    if (SP.pendingInvoice) { const f = SP.pendingInvoice; SP.pendingInvoice = null; readPhoto(f); }
    else if (SP.pendingScan) { SP.pendingScan = false; $('#rscan').click(); }
    SP.done(n);
  });

  /* ---------- receiving history ---------- */
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  SP.route(/^purchases$/, async (m, n) => {
    if (gate(n) || !guard(['purchases', 'reports'], t('purT'))) return;
    shell(bar(t('purT'), SP.can('purchases') ? `<a class="iconbtn" href="#receive" aria-label="${esc(t('rcvT'))}">${I('plus')}</a>` : '') + `<main class="wrap"><div id="pl"><div class="sk sk-row"></div></div>
      <div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    const cur = SP.currencyOf(S.country);
    const row = v => `<details class="pur"><summary class="arow"><span class="inv-badge num">${esc(v.no)}</span><span class="ar-main"><b>${esc(v.supplier || t('purNo', { n: v.no }))}${v.total != null && v.paid != null && +v.paid < +v.total ? ` <span class="pill demo">${esc(t('purOwed', { m: money(v.total - v.paid, cur) }))}</span>` : ''}</b>
        <small>${[when(v.created_at), v.staff_name, v.branch_name, SP.count(+v.items_count || 0, 'parts')].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>${v.total != null ? `<b class="num">${esc(money(v.total, cur))}</b>` : ''}</summary>
      <table class="inv-items pur-items"><tbody>${(v.items || []).map(it => `<tr><td>${esc(it.title)}${it.code ? `<small class="mono">${esc(it.code)}</small>` : ''}</td><td class="num">× ${esc(it.qty)}</td>${it.cost != null ? `<td class="num">${esc(money(it.cost, cur))}</td>` : ''}</tr>`).join('')}</tbody></table>
      ${canUndo(v) ? `<div class="form-actions"><button type="button" class="btn btn-ghost sm" data-undo="${esc(v.id)}" data-no="${esc(v.no)}">${I('undo')} ${esc(t('purUndo'))}</button></div>` : ''}</details>`;
    /* taking a receipt back: the owner any receipt, staff their own on the same day (the database checks again) */
    const canUndo = v => SP.can('purchases') && (S.admin || (S.user && v.staff_id === S.user.id && Date.now() - Date.parse(v.created_at) < 864e5));
    $('#pl').addEventListener('click', async e => {
      const b = e.target.closest('[data-undo]');
      if (!b || !await SP.confirmSheet({ title: t('rcvUndoQ', { n: b.dataset.no }), body: t('rcvUndoB'), ok: t('purUndo'), danger: true })) return;
      b.classList.add('busy');
      try { await chk(await sb().rpc('undo_receipt', { p_id: b.dataset.undo })); SP.toast(t('rcvUndoneList', { n: b.dataset.no })); SP.render(); }
      catch (x) { b.classList.remove('busy'); SP.toast(undoErr(x), 5000); }
    });
    await SP.pager(n, $('#pl'), $('#more'), async off => { const rows = chk(await sb().rpc('list_purchases', { p_limit: 30, p_offset: off })) || []; return { items: rows, total: rows.length ? +rows[0].total_count : 0 }; },
      items => items.map(row).join(''), (r, first) => { if (first && !r.total) $('#pl').innerHTML = empty('box', t('purEmpty'), '', SP.can('purchases') ? `<a class="btn btn-signal" href="#receive">${I('plus')} ${esc(t('rcvT'))}</a>` : ''); });
    SP.done(n);
  });
})();
