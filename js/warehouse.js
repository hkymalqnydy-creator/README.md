/* The warehouse (المخزن), in the company edition: every new invoice (a sale at the till, an order from the app) waits in
   «تجهيز الفواتير» for the employee with the warehouse permission, each line with where the part is kept (a shelf, a bin),
   its codes, maker and car. He ticks each line as he takes it (or scans its barcode), then «تم التجهيز». A count on the
   System tab tells him when a new one comes. The rules are in supabase/setup.sql section 18 (and the same in js/demo.js). */
(function () {
  'use strict';
  const SP = window.SP;
  if (!SP || !SP.company) return;
  const { $, $$, esc, I, t, S, shell, bar, empty, gate } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a || {}));

  Object.assign(window.SP_IC, { print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>' });
  Object.assign(SP.L.T, {
    pkT: ["تجهيز الفواتير", "Preparing invoices"], pkSub: ["الفواتير اللي تتجهز من المخزن", "The invoices to prepare from the warehouse"],
    pkWait: ["تستنى", "Waiting"], pkDoneTab: ["تجهزت", "Prepared"], pkEmpty: ["ما فيش فواتير تستنى التجهيز.", "No invoice is waiting."],
    pkEmptyDone: ["ما فيش فواتير تجهزت بعد.", "No invoice has been prepared yet."], pkNo: ["فاتورة {n}", "Invoice {n}"],
    pkLines: ["{n} صنف · {u} قطعة", "{n} lines · {u} parts"], pkWalk: ["زبون في المحل", "Customer at the counter"], pkApp: ["طلب من التطبيق", "Order from the app"], pkSale: ["بيع", "Sale"],
    pkBy: ["جهّزها {p}", "Prepared by {p}"], pkProg: ["{a} من {b}", "{a} of {b}"], pkWhere: ["المكان", "Where"], pkNoWhere: ["ما عندهاش مكان", "No place set"],
    pkGot: ["جهزتها", "Got it"], pkDone: ["تم التجهيز", "Prepared"], pkDoneQ: ["فيه {n} صنف ما تعلّمش. تم التجهيز على كل حال؟", "{n} lines are not ticked. Mark it prepared anyway?"],
    pkDoneOk: ["تجهزت الفاتورة رقم {n}", "Invoice {n} prepared"], pkScan: ["امسح القطع", "Scan the parts"], pkScanHit: ["✓ {t}", "✓ {t}"],
    pkScanMiss: ["القطعة هذي مش في الفاتورة: {c}", "This part is not on the invoice: {c}"], pkNew: ["فاتورة جديدة للتجهيز رقم {n}", "A new invoice to prepare: {n}"],
    pkPrint: ["اطبع", "Print"], pkStock: ["في المخزن: {n}", "In stock: {n}"], pkNote: ["ملاحظة: {t}", "Note: {t}"], pkErrGone: ["الفاتورة هذي تجهزت أو تلغت.", "This invoice was prepared or cancelled."],
    pkInv_waiting: ["في المخزن: تستنى التجهيز", "In the warehouse: waiting"], pkInv_done: ["تجهزت في المخزن: {p}", "Prepared in the warehouse: {p}"],
    perm_warehouse: ["تجهيز الفواتير في المخزن", "Prepare invoices in the warehouse"], lk_picked: ["جهّز الفاتورة {no}", "Prepared invoice {no}"],
    /* an order from the app: what is on the shelf goes to the customer */
    pkAppHint: ["طلب من التطبيق: حدد كم موجود من كل صنف، والزبون يوصله الموجود.", "An order from the app: set how many of each are on the shelf; the customer gets what there is."],
    pkAvail: ["الموجود", "On the shelf"], pkShortD: ["ناقصة {n}", "{n} short"], pkNoneLine: ["مش موجودة", "Not on the shelf"], pkSend: ["جهّز وابعثه للزبون", "Prepare and send"],
    pkShortQ: ["ناقص: {l}. الطلب يمشي للزبون بالموجود، واللي ناقص يتشال منه.", "Short: {l}. The order goes to the customer with what there is; the rest comes off it."],
    pkNoneQ: ["ما فيش ولا قطعة من الطلب موجودة: الطلب يتلغى والزبون يشوف إن القطع مش موجودة.", "None of the order is on the shelf: it is cancelled and the customer is told."],
    pkSent: ["تجهز الطلب {n} وتبعت للزبون", "Order {n} prepared and sent to the customer"], pkCancelled: ["تلغى الطلب {n}: القطع مش موجودة", "Order {n} cancelled: the parts are not on the shelf"],
    pkShortDone: ["ما لقيناش {n}", "{n} not found"], lk_picked_short: ["جهّز الفاتورة {no} · ناقصة {n}", "Prepared invoice {no} · {n} short"]
  });

  const can = () => !!(S.user && (S.admin || (SP.can && SP.can('warehouse'))));
  /* the warehouse employee himself: the count on his System tab and a word for each new invoice (the owner has the count on the button) */
  const mine = () => !!(S.user && !S.admin && SP.can && SP.can('warehouse'));
  SP.pickCan = can; SP.pickMine = mine;
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  const mm = l => SP.makerModel ? SP.makerModel(l) : '';
  const errOf = e => /not waiting|not found/.test(String((e && e.message) || '')) ? t('pkErrGone') : SP.errText(e);

  /* ---------- the list: waiting (oldest first) and prepared ---------- */
  const card = v => {
    const n = (v.lines || []).length;
    return `<a class="pk-card${v.picked_at ? ' done' : ''}" href="#pick-${esc(v.id)}"><span class="pk-top"><b>${esc(t('pkNo', { n: v.no }))}</b>
        <span class="pill ${v.source === 'app' ? 'demo' : 'ok'}">${esc(t(v.source === 'app' ? 'pkApp' : 'pkSale'))}</span></span>
      <span class="pk-who">${esc(v.customer_name || t('pkWalk'))}</span>
      <small>${esc([t('pkLines', { n: SP.fmtNum(n), u: SP.fmtNum(+v.units || 0) }), v.picked_at ? t('pkBy', { p: v.picked_name || '' }) + ' · ' + when(v.picked_at) : when(v.created_at), v.branch_name].filter(Boolean).join(' · '))}</small>
      ${!v.picked_at && n ? `<span class="pk-bar" style="--p:${Math.round(100 * (+v.picked_n || 0) / n)}%"><i></i></span>` : ''}</a>`;
  };
  SP.route(/^picks$/, async (m, n) => {
    if (gate(n)) return;
    if (!can()) { shell(bar(t('pkT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    const tab = S.pkTab === 'done' ? 'done' : 'waiting';
    shell(bar(t('pkT')) + `<main class="wrap"><div class="chips light pk-tabs">${[['waiting', 'pkWait'], ['done', 'pkDoneTab']].map(([k, l]) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-pt="${k}">${esc(t(l))}${k === 'waiting' && S.pickWaiting ? ` <b class="num">${esc(SP.fmtNum(S.pickWaiting))}</b>` : ''}</button>`).join('')}</div>
      <div class="pk-list" id="pkl"><div class="sk sk-block"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    $$('[data-pt]').forEach(b => b.onclick = () => { S.pkTab = b.dataset.pt; SP.render(); });
    await SP.pager(n, $('#pkl'), $('#more'), async off => { const rows = await rpc('pick_list', { p_state: tab, p_limit: 30, p_offset: off }) || []; return { items: rows, total: rows.length ? +rows[0].total_count : 0 }; },
      items => items.map(card).join(''), (r, first) => { if (first && !r.total) $('#pkl').innerHTML = empty('box', t(tab === 'done' ? 'pkEmptyDone' : 'pkEmpty')); });
    SP.done(n);
  });

  /* ---------- one invoice: each line with where it is, ticked as it is taken ---------- */
  SP.route(/^pick-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    if (!can()) { shell(bar(t('pkT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    shell(bar(t('pkT')) + `<main class="wrap"><div class="sk sk-block"></div></main>`);
    let v = null;
    try {
      for (const st of ['waiting', 'done']) {
        for (let off = 0; off < 400 && !v; off += 100) { const rows = await rpc('pick_list', { p_state: st, p_limit: 100, p_offset: off }) || []; v = rows.find(x => x.id === m[1]) || null; if (rows.length < 100) break; }
        if (v) break;
      }
    } catch (e) { if (SP.alive(n)) $('main').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    if (!v) { shell(bar(t('pkT')) + `<main class="wrap">${empty('box', t('pkErrGone'), '', `<a class="btn btn-ink" href="#picks">${esc(t('pkT'))}</a>`)}</main>`); return SP.done(n); }
    const open = !v.picked_at, shelf = open && !!v.can_short;
    /* how many of each line are on the shelf (an app order only), kept while he goes back and forth */
    const AV = S.pkAv = S.pkAv || {}, av = AV[v.id] = AV[v.id] || {};
    const has = l => av[l.id] == null ? +l.qty : av[l.id];
    const line = l => `<div class="pk-line${l.picked && has(l) ? ' got' : ''}${shelf && has(l) < +l.qty ? ' short' : ''}${!open && !+l.qty ? ' none' : ''}" data-l="${esc(l.id)}">
        ${l.img ? `<span class="pk-img">${SP.imgTag(l.img, '', l.title, true)}</span>` : ''}
        <span class="pk-main"><b>${esc(l.title)}</b>
          <span class="pk-loc${l.location ? '' : ' none'}">${I('pin')} ${esc(l.location || t('pkNoWhere'))}</span>
          <small>${[l.sku, l.part_no && l.part_no !== l.sku ? l.part_no : '', l.barcode].filter(Boolean).map(x => `<bdi class="mono">${esc(x)}</bdi>`).join(' · ')}</small>
          ${mm(l) ? `<small>${esc(mm(l))}</small>` : ''}${l.stock != null ? `<small>${esc(t('pkStock', { n: SP.fmtNum(l.stock) }))}</small>` : ''}
          ${shelf ? `<span class="pk-av"><span>${esc(t('pkAvail'))}</span><span class="stepper"><button type="button" data-av="${esc(l.id)}" data-d="-1" aria-label="−">−</button><b class="num">${esc(SP.fmtNum(has(l)))}</b><button type="button" data-av="${esc(l.id)}" data-d="1" aria-label="+">+</button></span>${has(l) < +l.qty ? `<em>${esc(has(l) ? t('pkShortD', { n: SP.fmtNum(+l.qty - has(l)) }) : t('pkNoneLine'))}</em>` : ''}</span>` : ''}
          ${!open && +l.short ? `<em class="pk-sh">${esc(t('pkShortDone', { n: SP.fmtNum(l.short) }))}</em>` : ''}</span>
        <span class="pk-qty num">× ${esc(l.qty)}</span>
        ${open ? `<button type="button" class="pk-tick" data-tick="${esc(l.id)}" aria-pressed="${!!l.picked && !!has(l)}" aria-label="${esc(t('pkGot'))}"${has(l) ? '' : ' disabled'}>${I('check')}</button>` : (l.picked && +l.qty ? `<span class="pk-tick on" aria-hidden="true">${I('check')}</span>` : '')}</div>`;
    const draw = () => {
      const got = v.lines.filter(l => l.picked && has(l)).length, want = v.lines.filter(l => has(l)).length;
      shell(bar(t('pkNo', { n: v.no }), `<button type="button" class="iconbtn" id="pkpr" aria-label="${esc(t('pkPrint'))}">${I('print')}</button>`) + `<main class="wrap pk-page">
        <section class="mcard pk-head"><div class="pk-top"><b>${esc(v.customer_name || t('pkWalk'))}</b><span class="pill ${v.source === 'app' ? 'demo' : 'ok'}">${esc(t(v.source === 'app' ? 'pkApp' : 'pkSale'))}</span></div>
          <small>${esc([when(v.created_at), v.staff_name, v.branch_name].filter(Boolean).join(' · '))}</small>
          ${v.note ? `<p class="pk-note">${esc(t('pkNote', { t: v.note }))}</p>` : ''}${shelf ? `<p class="pk-note">${esc(t('pkAppHint'))}</p>` : ''}
          ${v.picked_at ? `<p class="banner note">${I('check')}<span>${esc(t('pkBy', { p: v.picked_name || '' }))} · ${esc(when(v.picked_at))}</span></p>` : ''}</section>
        <div class="pk-lines">${v.lines.map(line).join('')}</div>
        ${open ? `<div class="pk-foot"><span class="pk-prog num">${esc(t('pkProg', { a: SP.fmtNum(got), b: SP.fmtNum(want) }))}</span>
          <button type="button" class="btn btn-ghost" id="pkscan">${I('scan')} ${esc(t('pkScan'))}</button>
          <button type="button" class="btn btn-signal" id="pkdone">${I('check')} ${esc(t(shelf ? 'pkSend' : 'pkDone'))}</button></div>` : ''}</main>`);
      $('#pkpr').onclick = () => window.print();
      if (!open) return;
      $$('[data-tick]').forEach(b => b.onclick = () => tick(+b.dataset.tick));
      $$('[data-av]').forEach(b => b.onclick = () => { const l = v.lines.find(x => String(x.id) === b.dataset.av); av[l.id] = Math.min(Math.max(has(l) + +b.dataset.d, 0), +l.qty); draw(); });
      $('#pkscan').onclick = () => SP.scanCode({
        title: t('pkScan'),
        onCode: async code => {
          const k = String(code).replace(/[\s\-./]/g, '').toUpperCase();
          const l = v.lines.find(x => !x.picked && has(x) && [x.barcode, x.sku, x.part_no].some(c => c && String(c).replace(/[\s\-./]/g, '').toUpperCase() === k));
          if (!l) return t('pkScanMiss', { c: code });
          await tick(l.id, true);
          return t('pkScanHit', { t: l.title });
        }
      });
      $('#pkdone').onclick = async () => {
        const left = v.lines.filter(l => !l.picked && has(l)).length, short = shelf ? v.lines.filter(l => has(l) < +l.qty) : [];
        const lbl = t(shelf ? 'pkSend' : 'pkDone');
        if (shelf && short.length && !v.lines.some(l => has(l))) { if (!await SP.confirmSheet({ title: lbl, body: t('pkNoneQ'), ok: lbl, danger: true })) return; }
        else if (short.length) { if (!await SP.confirmSheet({ title: lbl, body: t('pkShortQ', { l: short.map(l => SP.fmtNum(+l.qty - has(l)) + ' × ' + l.title).join('، ') }), ok: lbl })) return; }
        else if (left && !await SP.confirmSheet({ title: lbl, body: t('pkDoneQ', { n: SP.fmtNum(left) }), ok: lbl })) return;
        const b = $('#pkdone'); b.classList.add('busy');
        try {
          const r = await rpc('pick_done', { p_invoice: v.id, p_avail: shelf ? v.lines.map(l => ({ id: l.id, qty: has(l) })) : null });
          delete AV[v.id];
          SP.toast(t(r.order === 'cancelled' ? 'pkCancelled' : r.order === 'ready' ? 'pkSent' : 'pkDoneOk', { n: r.no }), 5000);
          S.pkTab = 'waiting'; watchSoon(); SP.go('picks');
        } catch (e) { b.classList.remove('busy'); SP.toast(errOf(e), 5000); }
      };
    };
    async function tick(id, on) {
      const l = v.lines.find(x => +x.id === +id);
      if (!l) return;
      const want = on == null ? !l.picked : on;
      l.picked = want; if (SP.alive(n)) draw();
      try { await rpc('pick_line', { p_item: l.id, p_on: want }); }
      catch (e) { l.picked = !want; if (SP.alive(n)) draw(); SP.toast(errOf(e), 5000); }
    }
    draw();
    SP.done(n);
  });

  /* ---------- the count on the System tab, and a word when a new one comes ---------- */
  let TIMER = 0, LAST = null;
  function badges() {
    const put = (el, x) => { if (!el) return; let b = el.querySelector('.nbadge'); if (!x) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'nbadge'; el.appendChild(b); } b.textContent = SP.fmtNum(x); };
    $$('.pos-tile[href="#picks"], .sys-act[href="#picks"]').forEach(el => put(el, +S.pickWaiting || 0));
    if (SP.ordBadges) SP.ordBadges();
  }
  async function watch() {
    if (!can() || document.hidden) return;
    try {
      const x = +(await rpc('pick_waiting')) || 0;
      const fresh = LAST != null && x > LAST;
      LAST = x; S.pickWaiting = x; badges(); // the counts change in place
      if (fresh) {
        const h = SP.here();
        S.pkTab = 'waiting'; // the list opens on the new one
        if (h === 'picks') SP.render();
        else if (mine()) {
          const rows = await rpc('pick_list', { p_state: 'waiting', p_limit: 1, p_offset: Math.max(0, x - 1) }).catch(() => []);
          SP.toast(t('pkNew', { n: rows && rows[0] ? rows[0].no : '' }), 5000);
        }
      }
    } catch (e) { /* offline: next time */ }
  }
  function watchSoon() { setTimeout(watch, 300); }
  function arm() {
    if (can() && !TIMER) { TIMER = setInterval(watch, 40000); watch(); }
    if (!can() && TIMER) { clearInterval(TIMER); TIMER = 0; LAST = null; S.pickWaiting = 0; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watch(); });
  const prevAfter = SP.afterShell;
  SP.afterShell = o => { if (prevAfter) prevAfter(o); arm(); badges(); };
})();
