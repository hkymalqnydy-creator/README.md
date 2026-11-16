/* Sales system inside the app: point of sale, invoices (print / WhatsApp / return), reports, staff and permissions.
   Every rule is enforced again by the database functions (create_invoice, return_invoice, sales_report, save_staff). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, api, opt, shell, bar, empty, gate } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };

  Object.assign(SP.L.T, {
    posT: ["منظومة المبيعات", "Sales system"], posSale: ["فاتورة بيع", "Sales invoice"], sysSellSub: ["اكتب فاتورة للزبون", "Write an invoice for a customer"], sysBuySub: ["دخّل المشتريات يدوي أو بتصوير الفاتورة", "Enter purchases by hand or from a photo"], posSearchPh: ["اسم، رقم صنف، باركود أو شركة…", "Name, item code, barcode or maker…"], posClearQ: ["امسح البحث", "Clear the search"],
    posPickH: ["اضغط على الأصناف اللي تبيها تنضاف للفاتورة، وكمّل دوّر. اضغط مرة ثانية تشيلها.", "Tap the parts you want and they go on the invoice; keep searching. Tap again to take one off."],
    posPicked: ["{n} صنف في الفاتورة", "{n} parts on the invoice"],
    posNoItems: ["ابحث عن قطعة وأضفها للفاتورة.", "Search for a part and add it to the invoice."], posPrice: ["السعر", "Price"], posQty: ["الكمية", "Qty"],
    posSubtotal: ["المجموع", "Subtotal"], posDiscount: ["الخصم", "Discount"], posTotal: ["الإجمالي", "Total"], posPaid: ["المدفوع", "Paid"], posRemain: ["المتبقي", "Balance due"],
    posCustomer: ["اسم الزبون (اختياري)", "Customer name (optional)"], posPhone: ["هاتف الزبون", "Customer phone"], posPay: ["طريقة الدفع", "Payment"],
    pay_cash: ["كاش", "Cash"], pay_card: ["بطاقة", "Card"], pay_transfer: ["تحويل", "Transfer"], pay_credit: ["آجل", "On credit"],
    posSave: ["احفظ الفاتورة", "Save invoice"], posSaved: ["تم حفظ الفاتورة رقم {n}", "Invoice {n} saved"], posStock: ["الكمية غير كافية: {t} (المتوفر {n})", "Not enough stock: {t} ({n} available)"],
    posNoPrice: ["القطعة بدون سعر: {t}", "This part has no price: {t}"], posBranch: ["الفرع", "Branch"], posClear: ["فاتورة جديدة", "New invoice"], posInStock: ["متوفر {n}", "{n} in stock"],
    posNote: ["ملاحظة", "Note"], posRemove: ["احذف", "Remove"],
    invT: ["فاتورة رقم {n}", "Invoice {n}"], invDate: ["التاريخ", "Date"], invStaff: ["البائع", "Seller"], invPrint: ["طباعة", "Print"], invShare: ["إرسال للزبون", "Send to customer"],
    invReturn: ["مرتجع", "Return"], invReturned: ["مرتجعة", "Returned"], invReturnQ: ["ترجيع الفاتورة كاملة للمخزون؟", "Return the whole invoice to stock?"],
    invReturnDone: ["تم المرتجع ورجعت الكميات للمخزون", "Returned; quantities are back in stock"], invList: ["فواتير البيع", "Sales invoices"], invEmpty: ["لا توجد فواتير في هذه الفترة", "No invoices in this period"],
    rangeToday: ["اليوم", "Today"], range7: ["آخر 7 أيام", "Last 7 days"], rangeMonth: ["هذا الشهر", "This month"], rangeAll: ["الكل", "All"],
    invSearchPh: ["رقم الفاتورة أو اسم الزبون", "Invoice number or customer"], invExport: ["تصدير Excel", "Export to Excel"], invItem: ["الصنف", "Item"],
    invMsg: ["فاتورة رقم {n} من {app}\n{items}\nالإجمالي: {t}\nشكراً لتعاملكم معنا.", "Invoice {n} from {app}\n{items}\nTotal: {t}\nThank you for your business."],
    repT: ["التقارير", "Reports"], repSales: ["المبيعات", "Sales"], repCount: ["عدد الفواتير", "Invoices"], repAvg: ["متوسط الفاتورة", "Average invoice"],
    repDiscount: ["الخصومات", "Discounts"], repCredit: ["ديون آجلة", "Credit due"], repReturned: ["مرتجعات", "Returns"], repProfit: ["الربح التقريبي", "Approx. profit"],
    repCostMissing: ["{n} قطعة مباعة بدون سعر تكلفة، فالربح تقريبي.", "{n} sold items have no cost price, so profit is approximate."],
    repByPay: ["حسب طريقة الدفع", "By payment"], repByStaff: ["حسب الموظف", "By staff"], repByBranch: ["حسب الفرع", "By branch"], repByDay: ["حسب اليوم", "By day"], repTop: ["الأكثر مبيعاً", "Best sellers"],
    staffT: ["الموظفين والصلاحيات", "Staff and permissions"], staffAdd: ["أضف موظفاً", "Add staff"], staffEdit: ["تعديل الموظف", "Edit staff"], staffEmail: ["بريد الموظف", "Staff email"],
    staffEmailHint: ["الموظف يسجّل في التطبيق بنفس البريد، فيتفعل حسابه بالصلاحيات تلقائياً.", "The employee signs up in the app with this email and gets these permissions automatically."],
    staffName: ["اسم الموظف", "Staff name"], staffAllBranches: ["كل الفروع", "All branches"], staffPerms: ["الصلاحيات", "Permissions"], staffActive: ["الحساب فعّال", "Account active"],
    staffSaved: ["تم حفظ الموظف", "Staff saved"], staffDel: ["احذف الموظف", "Delete staff"], staffDelQ: ["حذف {n} من الموظفين؟", "Remove {n} from staff?"], staffDeleted: ["حُذف الموظف", "Staff removed"],
    staffWaiting: ["لم يسجّل بعد", "Not signed up yet"], staffOff: ["موقوف", "Disabled"], noStaff: ["لا يوجد موظفون بعد. أضف أول موظف وحدد صلاحياته.", "No staff yet. Add the first employee and choose their permissions."],
    perm_sales: ["البيع وإنشاء الفواتير", "Sell and create invoices"], perm_invoices: ["رؤية كل الفواتير", "See all invoices"], perm_returns: ["المرتجعات", "Returns"],
    perm_discounts: ["إعطاء خصم", "Give discounts"], perm_prices: ["تعديل سعر البيع في الفاتورة", "Change prices on invoices"], perm_products: ["إضافة وتعديل القطع والأسعار والكميات", "Add and edit parts, prices and stock"],
    perm_customers: ["اعتماد وإدارة الزبائن", "Approve and manage customers"], perm_reports: ["التقارير", "Reports"], perm_costs: ["رؤية التكلفة والأرباح", "See cost prices and profit"],
    perm_expenses: ["تسجيل المصروفات", "Record expenses"], perm_settings: ["إعدادات الشركة", "Company settings"], costL: ["سعر التكلفة", "Cost price"], costHint: ["لا يظهر إلا للمالك ومن عنده صلاحية التكلفة.", "Visible only to the owner and staff allowed to see costs."]
  });
  Object.assign(SP.L.T, {
    posOverLimit: ["التخفيض أكبر من المسموح ليك: {n}٪ من سعر البيع.", "That’s more off than you’re allowed: {n}% of the list price."],
    posBelowCost: ["ما ينفعش تبيع «{t}» بأقل من سعر التكلفة.", "“{t}” can’t be sold below its cost."],
    posBelowCostInv: ["الفاتورة بعد التخفيض أقل من التكلفة. قلّل التخفيض.", "After the discount the invoice is below cost. Give less off."],
    posLimitHint: ["أقصى تخفيض ليك {n}٪ (لحد {m})", "You can take off up to {n}% ({m})"],
    staffMaxDisc: ["أقصى تخفيض ٪", "Most off, %"], staffMaxDiscHint: ["فاضي = بدون حد. يحسب التخفيض وتنزيل سعر القطعة مع بعض.", "Empty = no limit. Counts the discount and lower line prices together."],
    staffBadLimit: ["اكتب نسبة من 0 لـ 100، أو خليه فاضي", "Enter 0 to 100, or leave it empty"], staffLimitShort: ["لحد {n}٪ تخفيض", "up to {n}% off"]
  });
  const PERMS = ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings', 'warehouse'];
  const PAYS = ['cash', 'card', 'transfer', 'credit'];

  /* ---------- permissions ---------- */
  SP.can = p => !!(S.admin || (S.perms && S.perms.staff && (S.perms.perms || []).includes(p)));
  SP.isStaff = () => !!(S.admin || (S.perms && S.perms.staff));
  SP.loadPerms = async () => {
    S.perms = null;
    if (!S.user || !SP.sb) return;
    try { S.perms = chk(await sb().rpc('my_perms')); } catch (e) { S.perms = null; }
  };
  const P = {
    create: async v => chk(await sb().rpc('create_invoice', { p: v })),
    ret: async id => chk(await sb().rpc('return_invoice', { p_id: id })),
    get: async id => chk(await sb().rpc('get_invoice', { p_id: id })),
    list: async a => { const rows = chk(await sb().rpc('list_invoices', a)) || []; return { items: rows, total: rows.length ? +rows[0].total_count : 0 }; },
    report: async a => chk(await sb().rpc('sales_report', a)) || {},
    staff: async () => chk(await sb().from('staff').select('*').order('created_at', { ascending: true })) || [],
    saveStaff: async a => chk(await sb().rpc('save_staff', a)),
    delStaff: async id => chk(await sb().rpc('delete_staff', { p_id: id }))
  };
  function posErr(e) {
    const m = String((e && e.message) || '');
    let x = /not enough stock: (.+) \(available (-?\d+)\)/.exec(m);
    if (x) return t('posStock', { t: x[1], n: x[2] });
    x = /part has no price: (.+)$/.exec(m);
    if (x) return t('posNoPrice', { t: x[1] });
    /* the owner's rules (supabase/setup.sql section 12) */
    x = /discount over limit: ([\d.]+)/.exec(m);
    if (x) return t('posOverLimit', { n: SP.fmtNum(+x[1]) });
    x = /below cost: (.+)$/.exec(m);
    if (x) return t('posBelowCost', { t: x[1] });
    if (/below cost/.test(m)) return t('posBelowCostInv');
    if (/not authorized/.test(m)) return t('errPerm');
    return SP.errText(e);
  }
  const money = (v, cur) => SP.priceText(Number(v || 0), cur || SP.currencyOf(S.country));
  function guard(n, perm) {
    if (!S.user) { S.after = SP.here(); shell(bar(t('posT')) + `<main class="wrap">${empty('lock', t('needLoginT'), '', `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (perm && !(perm === 'staffadmin' ? S.admin : SP.can(perm))) { shell(bar(t('posT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return false; }
    return true;
  }

  /* Entry tiles on the account page for the owner and staff. */
  /* ---------- the system, on its own tab next to home (staff and the owner) ---------- */
  Object.assign(window.SP_IC, { sys: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2"/><path d="M8.5 20h7M12 16v4"/><path d="m7.5 12.3 2.6-2.9 2.4 1.9 3.9-4"/>' });
  Object.assign(SP.L.T, {
    tabSystem: ["المنظومة", "System"], sysB: ["البيع والمخزن والحسابات", "Sales, stock and accounts"],
    sysSignIn: ["ادخل بحساب الموظف أو صاحب الشركة باش تفتح المنظومة.", "Sign in with a staff or owner account to open the system."],
    sysStaffOnly: ["المنظومة للموظفين وصاحب الشركة بس.", "The system is for staff and the owner only."],
    sysAdminT: ["تحكم المالك", "Owner controls"],
    /* «استعلام سعر»: a part's price and details, by its barcode, item code or name */
    pqT: ["استعلام سعر قطعة", "Look up a part"], pqBar: ["استعلم عن سعر قطعة: باركود، رقم صنف أو اسم", "Look up a part: barcode, item code or name"],
    pqPh: ["باركود، رقم صنف أو اسم القطعة…", "Barcode, item code or part name…"], pqScan: ["امسح الباركود", "Scan the barcode"],
    pqHint: ["اكتب أو امسح، وتطلعلك القطعة بسعرها والموجود منها.", "Type or scan to see the part with its price and what is in stock."],
    pqNone: ["ما لقيناش قطعة بـ «{q}».", "No part matches «{q}»."], pqPrice: ["سعر البيع", "Selling price"], pqNoPrice: ["بدون سعر", "No price"],
    pqHidden: ["السعر مخفي على الزبائن", "Price hidden from customers"], pqSku: ["رقم الصنف", "Item code"], pqLoc: ["المكان في المخزن", "Where it is kept"], pqPart: ["رقم القطعة", "Part number"],
    pqBarcode: ["الباركود", "Barcode"], pqStock: ["الموجود", "In stock"], pqStockN: ["{n} قطعة · {b}", "{n} · {b}"], pqOut: ["خلصت", "Out of stock"],
    pqCat: ["القسم", "Section"], pqCond: ["الحالة", "Condition"], pqCost: ["سعر الشراء", "Cost"], pqGain: ["الربح في القطعة", "Profit per part"],
    pqSell: ["بيعها", "Sell it"], pqOpen: ["صفحة القطعة", "Part page"], pqEdit: ["عدّلها", "Edit"], pqAgain: ["استعلم عن قطعة ثانية", "Look up another part"]
  });
  /* the invoices waiting in the warehouse, on their button (js/warehouse.js keeps the count) */
  const pickBadge = h => h === 'picks' && +S.pickWaiting ? `<i class="nbadge">${esc(SP.fmtNum(+S.pickWaiting))}</i>` : '';
  SP.systemLink = () => SP.isStaff() ? `<a class="admin-entry sys-entry" href="#system">${I('sys')}<span><b>${esc(t('tabSystem'))}</b><small>${esc(t('sysB'))}</small></span>${I('chevL', 'dirx')}</a>` : '';
  SP.route(/^system$/, (m, n) => {
    if (gate(n)) return;
    const head = bar(t('tabSystem'), '', { noBack: true });
    if (!S.user) { S.after = 'system'; shell(head + `<main class="wrap">${empty('lock', t('tabSystem'), t('sysSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return SP.done(n); }
    if (!SP.isStaff()) { shell(head + `<main class="wrap">${empty('lock', t('tabSystem'), t('sysStaffOnly'))}</main>`); return SP.done(n); }
    const own = S.admin ? [['admin', 'shield', 'admin'], ['admin-control', 'lock', 'ctlT'], ['admin-log', 'history', 'logT'], ['admin-prices', 'percent', 'bpT'], ['admin-ads', 'megaphone', 'adsT'], ['admin-ai', 'spark', 'aiSetT']]
      .filter(([h]) => h === 'admin' || SP.company).map(([h, ic, k]) => `<a class="pos-tile" href="#${h}">${I(ic)}<span>${esc(t(k))}</span></a>`).join('') : '';
    shell(head + `<main class="wrap mine sys">${SP.sysActs()}${S.admin && SP.company && SP.adminToday ? '<div id="atoday"></div>' : ''}${SP.posEntry()}
      ${own ? `<section class="mcard"><h2 class="lbl">${esc(t('sysAdminT'))}</h2><div class="pos-grid">${own}</div></section>` : ''}</main>`);
    if ($('#sysvoice')) $('#sysvoice').onclick = () => SP.aiVoice();
    /* the owner's windows: today, profit and loss, the total balance (js/sysview.js) */
    if ($('#atoday')) { if (SP.adminPanels) SP.adminPanels($('#atoday'), n); else SP.adminToday($('#atoday'), n, { compact: true }); }
    SP.done(n);
  }, { tab: 'system' });

  /* the two things done most, first on the System tab: a sales invoice for a customer, a purchase invoice for what came in */
  SP.sysActs = () => {
    if (!SP.isStaff()) return '';
    const a = [['pos', 'tag', 'posSale', 'sysSellSub', SP.can('sales')], ['receive', 'receipt', 'rcvT', 'sysBuySub', SP.can('purchases')],
      ['picks', 'box', 'pkT', 'pkSub', !!SP.pickCan && SP.pickCan() && !SP.can('sales') && !SP.can('purchases')]].filter(x => x[4]);
    return (a.length ? `<nav class="sys-acts${a.length === 1 ? ' one' : ''}" aria-label="${esc(t('posT'))}">${a.map(([h, ic, k, sub], i) =>
      `<a class="sys-act${i ? '' : ' main'}" href="#${h}"><span class="sa-ic">${I(ic)}</span><b>${esc(t(k))}</b><small>${esc(t(sub))}</small>${pickBadge(h)}</a>`).join('')}</nav>` : '')
      + `<a class="sys-look" href="#lookup">${I('search')}<span>${esc(t('pqBar'))}</span>${I('scan')}</a>`
      + (SP.aiVoiceOk && SP.aiVoiceOk() ? `<button type="button" class="sys-look sys-voice" id="sysvoice">${I('mic')}<span>${esc(t('aiVoiceBar'))}</span>${I('spark')}</button>` : '');
  };
  SP.posEntry = () => {
    if (!SP.isStaff()) return '';
    const tiles = [['orders', 'bag', 'ordT', SP.company && !!SP.ordPill && (SP.can('sales') || SP.can('invoices'))], ['invoices', 'copy', 'invList', SP.can('sales') || SP.can('invoices')],
      ['picks', 'box', 'pkT', !!SP.pickCan && SP.pickCan() && (SP.can('sales') || SP.can('purchases'))],
      ['purchases', 'box', 'purT', SP.can('purchases') || SP.can('reports')], ['reports', 'grid', 'repT', SP.can('reports')], ['staff', 'user', 'staffT', S.admin]]
      .filter(x => x[3]).map(([h, ic, k]) => `<a class="pos-tile" href="#${h}">${I(ic)}<span>${esc(t(k))}</span>${pickBadge(h)}</a>`).join('');
    return tiles ? `<section class="mcard"><h2 class="lbl">${esc(t('posT'))}</h2><div class="pos-grid">${tiles}</div></section>` : '';
  };

  /* ---------- «استعلام سعر»: any staff looks up a part by its barcode (camera or scanner), item code or name ---------- */
  SP.route(/^lookup$/, async (m, n) => {
    if (gate(n) || !guard(n)) return;
    if (!SP.isStaff()) { shell(bar(t('pqT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('sysStaffOnly'))}</main>`); return SP.done(n); }
    shell(bar(t('pqT')) + `<main class="wrap pos pq">
      <form class="field" id="pqf" role="search"><label for="pqq" class="sr">${esc(t('pqT'))}</label><div class="inrow">
        <input id="pqq" class="input" autocomplete="off" enterkeyhint="search" placeholder="${esc(t('pqPh'))}" value="${esc(S.pqQ || '')}">
        <button type="button" class="btn btn-ink" id="pqscan" aria-label="${esc(t('pqScan'))}">${I('scan')}</button></div></form>
      <div id="pqres" class="pres"></div><div id="pqcard"><p class="muted-p pq-hint">${esc(t('pqHint'))}</p></div></main>`);
    const costs = SP.can('costs');
    let shown = [];
    const card = p => {
      const cur = p.shop && p.shop.currency, mm = SP.makerModel(p), out = p.qty != null && p.qty <= 0, gain = p.price != null && p.cost != null ? p.price - p.cost : null;
      const rowv = (k, v, cls) => v == null || v === '' ? '' : `<div class="pl-row${cls ? ' ' + cls : ''}"><span>${esc(t(k))}</span><b${/^pq(Sku|Part|Barcode)$/.test(k) ? ' class="mono" dir="ltr"' : ''}>${esc(v)}</b></div>`;
      const sell = SP.can('sales') && p.price != null && !out;
      return `<section class="mcard pq-card"><div class="pq-head">${p.imgs && p.imgs[0] ? `<span class="pq-img">${SP.imgTag(p.imgs[0], '', p.title, true)}</span>` : ''}
          <span class="pq-name"><b>${esc(p.title)}</b>${mm ? `<small>${esc(mm)}</small>` : ''}</span></div>
        <div class="pq-price"><small>${esc(t('pqPrice'))}</small><b class="num">${esc(p.price == null ? t('pqNoPrice') : money(p.price, cur))}</b>${p.hide_price ? `<span class="pill demo">${esc(t('pqHidden'))}</span>` : ''}</div>
        <div class="pq-rows">${rowv('pqStock', p.qty == null ? '' : out ? t('pqOut') : t('pqStockN', { n: SP.fmtNum(p.qty), b: (p.shop && p.shop.name) || '' }), out ? 'bad' : '')}
          ${rowv('pqLoc', p.location)}${rowv('pqSku', p.sku)}${p.part_no && codeKey(p.part_no) !== codeKey(p.sku) ? rowv('pqPart', p.part_no) : ''}${rowv('pqBarcode', p.barcode)}
          ${rowv('pqCat', p.cat ? SP.catName(p.cat) : '')}${rowv('pqCond', p.cond ? SP.condName(p.cond) : '')}
          ${costs && p.cost != null && !(SP.sysHidden && SP.sysHidden()) ? rowv('pqCost', money(p.cost, cur)) + (gain != null ? rowv('pqGain', (gain < 0 ? '− ' : '') + money(Math.abs(gain), cur) + (p.price ? ' (' + Math.round(100 * gain / p.price) + '٪)' : ''), gain < 0 ? 'bad' : 'good') : '') : ''}</div>
        <div class="form-actions pq-acts">${sell ? `<button type="button" class="btn btn-signal" id="pqsell">${I('tag')} ${esc(t('pqSell'))}</button>` : ''}
          <a class="btn btn-ghost" href="#p-${esc(p.id)}">${I('eye')} ${esc(t('pqOpen'))}</a>${SP.can('products') ? `<a class="btn btn-ghost" href="#edit-item-${esc(p.id)}">${I('edit')} ${esc(t('pqEdit'))}</a>` : ''}</div>
        <button type="button" class="btn btn-ghost sm pq-again" id="pqagain">${I('search')} ${esc(t('pqAgain'))}</button></section>`;
    };
    const show = p => {
      $('#pqres').innerHTML = ''; $('#pqcard').innerHTML = card(p);
      if ($('#pqsell')) $('#pqsell').onclick = () => { SP.posLoad([{ id: p.id, title: p.title, sku: p.sku || p.part_no || '', mm: SP.makerModel(p), price: p.price, base: p.price, qty: 1, stock: p.qty, cur: p.shop && p.shop.currency }]); SP.go('pos'); };
      $('#pqagain').onclick = () => { S.pqQ = ''; $('#pqq').value = ''; $('#pqcard').innerHTML = ''; $('#pqq').focus(); };
    };
    const find = async (q, exactOnly) => {
      q = q.trim(); S.pqQ = q;
      if (!SP.alive(n) || !$('#pqres')) return;
      if (!q) { $('#pqres').innerHTML = ''; return; }
      try {
        const r = await api.search({ ...SP.searchArgs({ ...SP.FDEF, q }, { limit: 10 }), p_country: null, p_city: null, p_include_sold: true });
        if (!SP.alive(n) || !$('#pqres') || S.pqQ !== q) return;
        shown = r.items;
        const k = codeKey(q), exact = r.items.filter(p => [p.sku, p.barcode, p.part_no].some(c => c && codeKey(c) === k));
        if (exact.length === 1 || (r.items.length === 1 && exactOnly)) return show(exact[0] || r.items[0]);
        $('#pqcard').innerHTML = '';
        $('#pqres').innerHTML = r.items.length ? r.items.map(p => `<button type="button" class="pres-row" data-id="${esc(p.id)}"><span><b>${esc(p.title)}</b><small>${esc([p.sku || p.part_no, SP.makerModel(p), p.qty != null ? (p.qty > 0 ? t('posInStock', { n: p.qty }) : t('pqOut')) : ''].filter(Boolean).join(' · '))}</small></span><b class="num pq-p">${esc(p.price == null ? '—' : money(p.price, p.shop && p.shop.currency))}</b></button>`).join('')
          : `<p class="muted-p">${esc(t('pqNone', { q }))}</p>`;
      } catch (e) { if ($('#pqres')) $('#pqres').innerHTML = `<p class="form-err">${esc(SP.errText(e))}</p>`; }
    };
    $('#pqres').onclick = e => { const b = e.target.closest('[data-id]'); if (b) { const p = shown.find(x => x.id === b.dataset.id); if (p) show(p); } };
    $('#pqf').onsubmit = e => { e.preventDefault(); find($('#pqq').value, true); };
    $('#pqq').oninput = SP.debounce(e => find(e.target.value), 300);
    $('#pqscan').onclick = async () => { const c = await SP.scanCode({ title: t('pqScan') }); if (c && SP.alive(n)) { $('#pqq').value = c; find(c, true); } };
    if (S.pqQ) find(S.pqQ); else $('#pqq').focus();
    SP.done(n);
  });

  /* ---------- point of sale ---------- */
  const POS_KEY = 'sp_pos';
  const loadPos = () => { try { return JSON.parse(sessionStorage.getItem(POS_KEY) || 'null') || { lines: [], pay: 'cash' }; } catch (e) { return { lines: [], pay: 'cash' }; } };
  const savePos = v => { try { sessionStorage.setItem(POS_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  /* Puts parts on the open sale (used by "open as a sale" when receiving, and by the assistant), with the customer and payment if given. */
  SP.posLoad = (items, extra) => {
    const st = loadPos();
    items.forEach(p => {
      const ex = st.lines.find(l => l.id === p.id);
      if (ex) ex.qty += p.qty || 1;
      else st.lines.push({ id: p.id, title: p.title, sku: p.sku || '', mm: p.mm || SP.makerModel(p), price: p.price, base: p.base != null ? p.base : p.price, qty: p.qty || 1, stock: p.stock, cur: p.cur });
    });
    if (extra) ['cname', 'cphone', 'pay', 'discount', 'paid', 'note'].forEach(k => { if (extra[k] != null && extra[k] !== '') st[k] = extra[k]; });
    savePos(st);
  };
  const codeKey = v => String(v || '').toUpperCase().replace(/[\s\-./_]/g, '');
  SP.route(/^pos$/, async (m, n) => {
    if (gate(n) || !guard(n, 'sales')) return;
    const st = loadPos(), fixedBranch = S.perms && S.perms.branch;
    shell(bar(t('posSale'), `<a class="iconbtn" href="#invoices" aria-label="${esc(t('invList'))}">${I('copy')}</a>`) + `<main class="wrap pos">
      <div class="pos-top"><div class="field"><label for="pbr">${esc(t('posBranch'))}</label><select id="pbr" class="input"${fixedBranch ? ' disabled' : ''}></select></div>
        <form class="field" id="psf" role="search"><label for="pq">${esc(t('search'))}</label><div class="inrow"><span class="inx"><input id="pq" class="input" autocomplete="off" placeholder="${esc(t('posSearchPh'))}" enterkeyhint="search">
          <button type="button" class="inx-b" id="pqx" aria-label="${esc(t('posClearQ'))}" hidden>${I('close')}</button></span>
          <button type="button" class="btn btn-ink sq" id="pscan" aria-label="${esc(t('scanBtn'))}" title="${esc(t('scanBtn'))}">${I('scan')}</button></div></form></div>
      <div id="pres" class="pres"></div><div id="plines" class="plines"></div><div id="psum"></div></main>`);
    try {
      const sh = (await api.shops({ p_limit: 100 })).items;
      if (!SP.alive(n)) return;
      const cur = fixedBranch || st.branch || (sh[0] && sh[0].id) || '';
      $('#pbr').innerHTML = sh.map(s => opt(s.id, s.name + ' · ' + s.city, cur)).join('');
      st.branch = $('#pbr').value; savePos(st);
    } catch (e) { /* branch list optional */ }
    $('#pbr').onchange = e => { st.branch = e.target.value; savePos(st); };
    const curOf = l => l.cur || SP.currencyOf(S.country);
    /* a code that is typed or scanned whole goes on the invoice and clears the search, ready for the next one */
    function add(p, quiet) {
      if (p.price == null && !SP.can('prices')) { SP.toast(t('posNoPrice', { t: p.title })); return false; }
      const ex = st.lines.find(l => l.id === p.id);
      if (ex) ex.qty++; else st.lines.push({ id: p.id, title: p.title, sku: p.sku || p.part_no, mm: SP.makerModel(p), price: p.price, base: p.price, qty: 1, stock: p.qty, cur: p.shop && p.shop.currency });
      savePos(st); draw(); found = []; $('#pres').innerHTML = ''; $('#pq').value = ''; $('#pqx').hidden = true;
      if (!quiet) $('#pq').focus();
      return true;
    }
    /* picking from the results: each tap puts the part on the invoice (or takes it off), and the results stay for the next one */
    let found = [];
    const resRow = p => {
      const l = st.lines.find(x => x.id === p.id);
      return `<button type="button" class="pres-row pick${l ? ' on' : ''}" data-id="${p.id}" aria-pressed="${!!l}"><span class="pk-box">${I('check')}</span><span><b>${esc(p.title)}</b><small>${esc([p.sku || p.part_no, SP.makerModel(p), p.qty != null ? t('posInStock', { n: p.qty }) : ''].filter(Boolean).join(' · '))}</small></span>${l ? `<span class="pk-n num">× ${l.qty}</span>` : ''}${SP.priceHTML(p.price, p.shop && p.shop.currency, p.price_hidden)}</button>`;
    };
    function paintRes() {
      if (!$('#pres') || !found.length) return;
      const n = st.lines.filter(l => found.some(p => p.id === l.id)).length;
      $('#pres').innerHTML = `<p class="hint pk-hint">${esc(st.lines.length ? t('posPicked', { n: SP.fmtNum(st.lines.length) }) : t('posPickH'))}</p>` + found.map(resRow).join('');
      return n;
    }
    function toggle(p) {
      const i = st.lines.findIndex(l => l.id === p.id);
      if (i >= 0) st.lines.splice(i, 1);
      else {
        if (p.price == null && !SP.can('prices')) { SP.toast(t('posNoPrice', { t: p.title })); return; }
        st.lines.push({ id: p.id, title: p.title, sku: p.sku || p.part_no, mm: SP.makerModel(p), price: p.price, base: p.price, qty: 1, stock: p.qty, cur: p.shop && p.shop.currency });
      }
      savePos(st); draw();
    }
    async function find(q) {
      q = q.trim();
      if (!SP.alive(n) || !$('#pres')) return;
      if (!q) { $('#pres').innerHTML = ''; return; }
      try {
        const r = await api.search({ ...SP.searchArgs({ ...SP.FDEF, q }, { limit: 8 }), p_country: null, p_city: null, p_include_sold: true });
        if (!SP.alive(n) || !$('#pres')) return;
        /* the box has changed since (the code went on the invoice from Enter, or more was typed): this answer is old. Without it a
           scanner's code + Enter went on twice, once from Enter and once from the search that follows typing */
        if ($('#pq').value.trim() !== q) return;
        /* a barcode scanner types the full code and Enter: an exact item code, barcode or part number goes straight on the invoice */
        const k = codeKey(q), exact = r.items.filter(p => (p.sku && codeKey(p.sku) === k) || (p.barcode && codeKey(p.barcode) === k) || (p.part_no && codeKey(p.part_no) === k));
        if (exact.length === 1) return add(exact[0]);
        found = r.items;
        if (r.items.length) paintRes(); else $('#pres').innerHTML = `<p class="muted-p">${esc(t('noResT'))}</p>`;
      } catch (e) { if ($('#pres')) $('#pres').innerHTML = `<p class="form-err">${esc(SP.errText(e))}</p>`; }
    }
    $('#pres').onclick = e => { const b = e.target.closest('[data-id]'); const p = b && found.find(x => x.id === b.dataset.id); if (p) toggle(p); };
    $('#pqx').onclick = () => { $('#pq').value = ''; $('#pqx').hidden = true; found = []; $('#pres').innerHTML = ''; $('#pq').focus(); };
    $('#psf').onsubmit = e => { e.preventDefault(); find($('#pq').value); };
    $('#pscan').onclick = () => SP.scanCode({
      title: t('posSale'),
      onCode: async code => {
        const p = await SP.findByCode(code).catch(() => null);
        if (!SP.alive(n)) return '';
        if (!p) return t('scanUnknown', { c: code });
        return add(p, true) ? t('scanAdded', { t: p.title }) : t('posNoPrice', { t: p.title });
      }
    });
    const findSoon = SP.debounce(v => find(v), 350);
    $('#pq').oninput = e => { $('#pqx').hidden = !e.target.value; if (!e.target.value.trim()) found = []; findSoon(e.target.value); };
    function totals() {
      const sub = st.lines.reduce((k, l) => k + (Number(l.price) || 0) * l.qty, 0), disc = Math.min(Number(st.discount) || 0, sub);
      return { sub, disc, total: sub - disc };
    }
    /* this employee's discount limit (the owner has none); it counts what is taken off the list prices */
    const limit = () => !S.admin && S.perms && S.perms.max_discount != null ? +S.perms.max_discount : null;
    const listSum = () => st.lines.reduce((k, l) => k + (Number(l.base != null ? l.base : l.price) || 0) * l.qty, 0);
    function draw() {
      const cur = st.lines[0] ? curOf(st.lines[0]) : SP.currencyOf(S.country), tt = totals();
      $('#plines').innerHTML = st.lines.length ? st.lines.map((l, i) => `<div class="pline" data-i="${i}"><span class="pl-main"><b>${esc(l.title)}</b><small>${esc([l.sku, l.mm, l.stock != null ? t('posInStock', { n: l.stock }) : ''].filter(Boolean).join(' · '))}</small></span>
          ${SP.can('prices') ? `<input class="input num pl-price" inputmode="decimal" dir="ltr" value="${l.price == null ? '' : esc(l.price)}" aria-label="${esc(t('posPrice'))}">` : `<span class="num pl-p">${esc(money(l.price, cur))}</span>`}
          <span class="stepper"><button type="button" data-d="-1" aria-label="−">−</button><b class="num">${l.qty}</b><button type="button" data-d="1" aria-label="+">+</button></span></div>`).join('')
        : `<p class="muted-p pos-empty">${esc(t('posNoItems'))}</p>`;
      $('#psum').innerHTML = st.lines.length ? `<div class="mcard psum"><div class="prow"><span>${esc(t('posSubtotal'))}</span><b class="num">${esc(money(tt.sub, cur))}</b></div>
        ${SP.can('discounts') ? `<div class="prow"><label for="pdisc">${esc(t('posDiscount'))}</label><input id="pdisc" class="input num" inputmode="decimal" dir="ltr" value="${esc(st.discount || '')}"></div>` : ''}
        ${limit() != null && (SP.can('discounts') || SP.can('prices')) ? `<p class="hint pos-limit" id="plim">${esc(t('posLimitHint', { n: SP.fmtNum(limit()), m: money(listSum() * limit() / 100, cur) }))}</p>` : ''}
        <div class="prow big"><span>${esc(t('posTotal'))}</span><b class="num">${esc(money(tt.total, cur))}</b></div>
        <fieldset class="field"><legend>${esc(t('posPay'))}</legend><div class="seg">${PAYS.map((k, i) => `<input type="radio" name="pp" id="pp${i}" value="${k}"${(st.pay || 'cash') === k ? ' checked' : ''}><label for="pp${i}">${esc(t('pay_' + k))}</label>`).join('')}</div></fieldset>
        ${st.pay === 'credit' ? `<div class="prow"><label for="ppaid">${esc(t('posPaid'))}</label><input id="ppaid" class="input num" inputmode="decimal" dir="ltr" value="${esc(st.paid || '')}"></div>` : ''}
        <div class="row2"><div class="field"><label for="pcn">${esc(t('posCustomer'))}</label><input id="pcn" class="input" maxlength="80" value="${esc(st.cname || '')}"></div>
          <div class="field"><label for="pcp">${esc(t('posPhone'))}</label><input id="pcp" class="input" type="tel" dir="ltr" maxlength="30" value="${esc(st.cphone || '')}"></div></div>
        <div class="field"><label for="pnote">${esc(t('posNote'))}</label><input id="pnote" class="input" maxlength="500" value="${esc(st.note || '')}"></div>
        <p class="form-err" id="perr" role="alert"></p>
        <div class="form-actions"><button type="button" class="btn btn-signal" id="psave">${I('check')} ${esc(t('posSave'))}</button><button type="button" class="btn btn-ghost" id="pnew">${I('trash')} ${esc(t('posClear'))}</button></div></div>` : '';
      const keep = (id, k, numeric) => { const el = $(id); if (el) el.oninput = () => { st[k] = numeric ? SP.digits(el.value) : el.value; savePos(st); if (numeric) redrawTotals(); }; };
      keep('#pdisc', 'discount', true); keep('#ppaid', 'paid', true); keep('#pcn', 'cname'); keep('#pcp', 'cphone'); keep('#pnote', 'note');
      $$('input[name=pp]').forEach(r => r.onchange = () => { st.pay = r.value; savePos(st); draw(); });
      $$('.pl-price').forEach(inp => inp.oninput = () => { const l = st.lines[+inp.closest('.pline').dataset.i]; const v = SP.digits(inp.value).replace(',', '.'); l.price = v === '' ? null : Number(v); savePos(st); redrawTotals(); });
      if ($('#psave')) $('#psave').onclick = save;
      if ($('#pnew')) $('#pnew').onclick = () => { st.lines = []; st.discount = st.paid = st.cname = st.cphone = st.note = ''; st.pay = 'cash'; savePos(st); draw(); };
      if (st.lines.length) redrawTotals();
      paintRes();
    }
    function redrawTotals() {
      const cur = st.lines[0] ? curOf(st.lines[0]) : SP.currencyOf(S.country), tt = totals(), rows = $$('#psum .prow b');
      if (rows[0]) rows[0].textContent = money(tt.sub, cur);
      if (rows[rows.length - 1]) rows[rows.length - 1].textContent = money(tt.total, cur);
      const lim = limit(), pl = $('#plim');
      if (pl && lim != null) pl.classList.toggle('over', listSum() - tt.total > listSum() * lim / 100 + 0.004);
    }
    $('#plines').onclick = e => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      const i = +b.closest('.pline').dataset.i, l = st.lines[i];
      l.qty += +b.dataset.d;
      if (l.qty <= 0) st.lines.splice(i, 1);
      savePos(st); draw();
    };
    async function save() {
      const b = $('#psave'), err = $('#perr');
      err.textContent = ''; b.classList.add('busy');
      try {
        const inv = await P.create({
          branch: st.branch || null, payment: st.pay || 'cash', discount: Number(st.discount) || 0, paid: st.pay === 'credit' ? (Number(st.paid) || 0) : null,
          customer_name: (st.cname || '').trim(), customer_phone: (st.cphone || '').trim(), note: (st.note || '').trim(),
          items: st.lines.map(l => ({ id: l.id, qty: l.qty, price: SP.can('prices') ? l.price : undefined }))
        });
        sessionStorage.removeItem(POS_KEY);
        SP.toast(t('posSaved', { n: inv.no }));
        SP.go('inv-' + inv.id);
      } catch (e) { err.textContent = posErr(e); b.classList.remove('busy'); }
    }
    draw();
    SP.done(n);
  });

  /* ---------- one invoice ---------- */
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  /* one invoice as a printed page: the staff's invoice here, and the merchant's own copy in his «صادر ووارد» (js/merchants.js) */
  SP.invoiceDoc = v => {
    const st = S.settings || {}, cur = v.currency, br = v.branch || {}, app = st.brand_name || SP.CFG.appName || t('app');
    return `<article class="invoice${v.status === 'returned' || v.status === 'cancelled' ? ' returned' : ''}" id="invoice">
          <header class="inv-head">${st.logo ? `<img src="${esc(st.logo)}" alt="">` : SP.CFG.logoInk ? '' : `<span class="brand-mark">${I('nut')}</span>`}<div>${!st.logo && SP.CFG.logoInk ? `<img class="inv-wm" src="${esc(SP.CFG.logoInk)}" alt="${esc(app)}">` : `<b>${esc(app)}</b>`}<small>${esc([br.name, br.city, br.phone ? SP.prettyPhone(br.phone, S.country) : ''].filter(Boolean).join(' · '))}</small></div>
            <div class="inv-no"><small>${esc(t('invT', { n: '' }).trim())}</small><b class="num">${esc(v.no)}</b></div></header>
          ${v.status === 'returned' ? `<p class="inv-stamp">${esc(t('invReturned'))}</p>` : ''}${v.status === 'cancelled' ? `<p class="inv-stamp">${esc(t('ordCancelled'))}</p>` : ''}
          <dl class="inv-meta"><div><dt>${esc(t('invDate'))}</dt><dd>${esc(when(v.created_at))}</dd></div><div><dt>${esc(t('invStaff'))}</dt><dd>${esc(v.staff_name || '—')}</dd></div>
            ${v.customer_name || v.customer_phone ? `<div><dt>${esc(t('custName'))}</dt><dd>${esc([v.customer_name, v.customer_phone].filter(Boolean).join(' · '))}</dd></div>` : ''}<div><dt>${esc(t('posPay'))}</dt><dd>${esc(t('pay_' + v.payment))}</dd></div></dl>
          <table class="inv-items"><thead><tr><th>${esc(t('invItem'))}</th><th>${esc(t('posQty'))}</th><th>${esc(t('posPrice'))}</th><th>${esc(t('posTotal'))}</th></tr></thead>
            <tbody>${(v.items || []).map(it => `<tr><td>${esc(it.title)}${it.sku ? `<small class="mono">${esc(it.sku)}</small>` : ''}${it.maker ? `<small class="inv-mk">${esc(it.maker)}</small>` : ''}</td><td class="num">${it.qty}</td><td class="num">${esc(money(it.price, cur))}</td><td class="num">${esc(money(it.line_total, cur))}</td></tr>`).join('')}</tbody></table>
          <dl class="inv-tot">${+v.discount ? `<div><dt>${esc(t('posSubtotal'))}</dt><dd class="num">${esc(money(v.subtotal, cur))}</dd></div><div><dt>${esc(t('posDiscount'))}</dt><dd class="num">− ${esc(money(v.discount, cur))}</dd></div>` : ''}
            <div class="big"><dt>${esc(t('posTotal'))}</dt><dd class="num">${esc(money(v.total, cur))}</dd></div>
            ${v.payment === 'credit' ? `<div><dt>${esc(t('posPaid'))}</dt><dd class="num">${esc(money(v.paid, cur))}</dd></div><div><dt>${esc(t('posRemain'))}</dt><dd class="num">${esc(money(v.total - v.paid, cur))}</dd></div>` : ''}</dl>
          ${v.note ? `<p class="inv-note">${esc(v.note)}</p>` : ''}${st.invoice_footer ? `<p class="inv-foot">${esc(st.invoice_footer)}</p>` : ''}</article>`;
  };
  SP.route(/^inv-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n) || !guard(n)) return;
    shell(bar(t('invList')) + `<main class="wrap"><div class="sk sk-block"></div></main>`);
    let inv;
    try { inv = await P.get(m[1]); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!inv) return shell(bar(t('invList')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`);
    const st = S.settings || {}, cur = inv.currency, br = inv.branch || {}, app = st.brand_name || SP.CFG.appName || t('app');
    /* printing needs the browser (the Claude app's page frame cannot print); WhatsApp is a real link, which works everywhere */
    const canPrint = !SP.CFG.embedded;
    const waHref = v => {
      const items = (v.items || []).map(it => `• ${it.title} × ${it.qty} = ${money(it.line_total, cur)}`).join('\n');
      const text = t('invMsg', { n: v.no, app, items, t: money(v.total, cur) });
      return SP.waLink(v.customer_phone, text, S.country) || 'https://wa.me/?text=' + encodeURIComponent(text);
    };
    const draw = v => {
      shell(bar(t('invT', { n: v.no }), canPrint ? `<button type="button" class="iconbtn" onclick="window.print()" aria-label="${esc(t('invPrint'))}">${I('copy')}</button>` : '') + `<main class="wrap invoice-wrap">
        ${SP.invoiceDoc(v)}
        ${v.pick_state && v.status !== 'returned' && v.status !== 'cancelled' ? `<div class="banner ${v.pick_state === 'done' ? 'note' : 'warn'} noprint">${I('box')}<span>${esc(t(v.pick_state === 'done' ? 'pkInv_done' : 'pkInv_waiting', { p: v.picked_name || '' }))}</span></div>` : ''}
        ${v.source === 'app' && SP.ordPill ? `<div class="banner note noprint">${I('bag')}<span>${esc(t('ordFromApp'))} ${SP.ordPill(v.status)}${v.status !== 'done' && v.status !== 'returned' ? `<small>${esc(t('ordInvBanner', { s: t('ordFromApp') }).split(': ').slice(1).join(': '))}</small>` : ''}</span><a class="btn btn-ghost sm" href="#order-${esc(v.id)}">${esc(t('ordOpenOrder'))}</a></div>` : ''}
        ${SP.sendPanel ? SP.sendPanel(v) : ''}
        <div class="form-actions noprint">${canPrint ? `<button type="button" class="btn btn-ink" onclick="window.print()">${I('copy')} ${esc(t('invPrint'))}</button>` : ''}
          <a class="btn btn-wa" id="ish" href="${esc(waHref(v))}" target="_blank" rel="noopener">${I('chat')} ${esc(t('invShare'))}</a>
          ${SP.can('returns') && v.status === 'done' ? `<button type="button" class="btn btn-danger" id="iret">${I('back', 'dirx')} ${esc(t('invReturn'))}</button>` : ''}
          ${SP.can('sales') ? `<a class="btn btn-ghost" href="#pos">${I('plus')} ${esc(t('posClear'))}</a>` : ''}</div></main>`);
      if (SP.wireSend) SP.wireSend(v, draw);
      if ($('#iret')) $('#iret').onclick = async () => {
        if (!await SP.confirmSheet({ title: t('invReturn'), body: t('invReturnQ'), ok: t('invReturn'), danger: true })) return;
        try { const r = await P.ret(v.id); SP.toast(t('invReturnDone')); draw(r); } catch (e) { SP.toast(posErr(e)); }
      };
    };
    draw(inv);
    SP.done(n);
  });

  /* ---------- invoices list ---------- */
  function range(k) {
    const d = new Date(), start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (k === 'today') return [start, null];
    if (k === '7') return [new Date(start - 6 * 864e5), null];
    if (k === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1), null];
    return [null, null];
  }
  const RANGES = [['today', 'rangeToday'], ['7', 'range7'], ['month', 'rangeMonth'], ['all', 'rangeAll']];
  SP.route(/^invoices$/, async (m, n) => {
    if (gate(n) || !guard(n)) return;
    if (!(SP.can('sales') || SP.can('invoices'))) return guard(n, 'invoices');
    S.invRange = S.invRange || 'today';
    shell(bar(t('invList'), SP.can('sales') ? `<a class="iconbtn" href="#pos" aria-label="${esc(t('posSale'))}">${I('plus')}</a>` : '') + `<main class="wrap">
      <div class="chips light">${RANGES.map(([k, l]) => `<button type="button" class="chip${S.invRange === k ? ' on' : ''}" data-r="${k}">${esc(t(l))}</button>`).join('')}</div>
      <form class="searchbox flat" id="iq" role="search">${I('search')}<input type="search" value="${esc(S.invQ || '')}" placeholder="${esc(t('invSearchPh'))}"></form>
      <div class="res-head"><span class="rcount" id="rc"></span><button type="button" class="btn btn-ghost sm" id="iexp">${I('download')} ${esc(t('invExport'))}</button></div>
      <div id="il"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    $$('[data-r]').forEach(b => b.onclick = () => { S.invRange = b.dataset.r; SP.render(); });
    $('#iq').onsubmit = e => { e.preventDefault(); S.invQ = $('#iq input').value.trim(); SP.render(); };
    const [from, to] = range(S.invRange);
    const args = off => ({ p_from: from ? from.toISOString() : null, p_to: to ? to.toISOString() : null, p_q: S.invQ || null, p_limit: 30, p_offset: off });
    const row = v => `<a class="arow inv-row${v.status === 'returned' || v.status === 'cancelled' ? ' ret' : ''}" href="#inv-${v.id}"><span class="inv-badge num">${esc(v.no)}</span><span class="ar-main"><b>${v.source === 'app' ? I('bag', 'inv-app') + ' ' : ''}${esc(v.customer_name || t('pay_' + v.payment))}${v.status === 'returned' ? ` <span class="pill demo">${esc(t('invReturned'))}</span>` : v.status !== 'done' && SP.ordPill ? ' ' + SP.ordPill(v.status) : ''}</b>
      <small>${esc(when(v.created_at))} · ${esc(v.staff_name || '')} · ${esc(SP.count(+v.items_count || 0, 'parts'))}</small></span><b class="num">${esc(money(v.total, v.currency))}</b></a>`;
    await SP.pager(n, $('#il'), $('#more'), off => P.list(args(off)), items => items.map(row).join(''), (r, first) => {
      if (!first) return;
      $('#rc').textContent = SP.fmtNum(r.total) + ' · ' + t('invList');
      if (!r.total) $('#il').innerHTML = empty('copy', t('invEmpty'));
    });
    $('#iexp').onclick = async () => {
      const b = $('#iexp'); b.classList.add('busy');
      try {
        const all = [];
        for (let off = 0; off < 5000; off += 100) { const r = await P.list({ ...args(off), p_limit: 100 }); all.push(...r.items); if (r.items.length < 100) break; }
        const cell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const lines = ['no,date,branch,staff,customer,phone,payment,subtotal,discount,total,paid,status'].concat(all.map(v => [v.no, v.created_at, v.branch_name, v.staff_name, v.customer_name, v.customer_phone, v.payment, v.subtotal, v.discount, v.total, v.paid, v.status].map(cell).join(',')));
        await SP.saveFile('invoices-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\r\n'));
      } catch (e) { SP.toast(SP.errText(e)); } finally { b.classList.remove('busy'); }
    };
    SP.done(n);
  });

  /* ---------- reports ---------- */
  SP.route(/^reports$/, async (m, n) => {
    if (gate(n) || !guard(n, 'reports')) return;
    S.repRange = S.repRange || 'today';
    shell(bar(t('repT')) + `<main class="wrap mine"><div class="chips light">${RANGES.map(([k, l]) => `<button type="button" class="chip${S.repRange === k ? ' on' : ''}" data-r="${k}">${esc(t(l))}</button>`).join('')}</div><div id="rep"><div class="sk sk-block"></div></div></main>`);
    $$('[data-r]').forEach(b => b.onclick = () => { S.repRange = b.dataset.r; SP.render(); });
    const [from] = range(S.repRange);
    let r;
    try { r = await P.report({ p_from: (from || new Date(2000, 0, 1)).toISOString(), p_to: new Date(Date.now() + 864e5).toISOString(), p_branch: null, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tripoli' }); }
    catch (e) { if (SP.alive(n)) $('#rep').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    const cur = SP.currencyOf(S.country), cnt = +r.count || 0;
    const stat = (k, v) => `<div class="astat"><b class="num">${esc(v)}</b><small>${esc(t(k))}</small></div>`;
    const bars = (list, label, val) => { const max = Math.max(1, ...list.map(val)); return list.map(x => `<div class="rbar"><span>${esc(label(x))}</span><i style="--w:${Math.round(val(x) / max * 100)}%"></i><b class="num">${esc(money(val(x), cur))}</b></div>`).join(''); };
    const pays = Object.entries(r.by_payment || {});
    $('#rep').innerHTML = `<div class="astats">${stat('repSales', money(r.total, cur))}${stat('repCount', SP.fmtNum(cnt))}${stat('repAvg', money(cnt ? r.total / cnt : 0, cur))}${r.profit != null ? stat('repProfit', money(r.profit, cur)) : ''}${stat('repDiscount', money(r.discount, cur))}${stat('repCredit', money(r.credit, cur))}${stat('repReturned', SP.fmtNum(+r.returned || 0))}</div>
      ${r.cost_missing ? `<p class="hint">${esc(t('repCostMissing', { n: r.cost_missing }))}</p>` : ''}
      ${pays.length ? `<section class="mcard"><h2 class="lbl">${esc(t('repByPay'))}</h2>${bars(pays, x => t('pay_' + x[0]), x => +x[1])}</section>` : ''}
      ${(r.by_staff || []).length ? `<section class="mcard"><h2 class="lbl">${esc(t('repByStaff'))}</h2>${bars(r.by_staff, x => x.name || '—', x => +x.total)}</section>` : ''}
      ${(r.by_branch || []).length > 1 ? `<section class="mcard"><h2 class="lbl">${esc(t('repByBranch'))}</h2>${bars(r.by_branch, x => x.name, x => +x.total)}</section>` : ''}
      ${(r.by_day || []).length > 1 ? `<section class="mcard"><h2 class="lbl">${esc(t('repByDay'))}</h2>${bars(r.by_day, x => x.day, x => +x.total)}</section>` : ''}
      ${(r.top || []).length ? `<section class="mcard"><h2 class="lbl">${esc(t('repTop'))}</h2>${(r.top || []).map(x => `<div class="rbar"><span>${esc(x.title)}</span><small class="num">× ${esc(x.qty)}</small><b class="num">${esc(money(x.total, cur))}</b></div>`).join('')}</section>` : ''}
      ${cnt ? '' : empty('grid', t('invEmpty'))}`;
    SP.done(n);
  });

  /* ---------- staff and permissions (owner only) ---------- */
  function staffSheet(v, branches, onSaved) {
    v = v || { email: '', name: '', perms: ['sales'], branch_id: null, active: true };
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t(v.id ? 'staffEdit' : 'staffAdd'))}</h2><form class="form" id="stf" novalidate>
      <div class="field"><label for="se">${esc(t('staffEmail'))}</label><input id="se" class="input" type="email" dir="ltr" autocapitalize="off" value="${esc(v.email)}"${v.id ? ' readonly' : ''}><span class="hint">${esc(t('staffEmailHint'))}</span></div>
      <div class="row2"><div class="field"><label for="sn2">${esc(t('staffName'))}</label><input id="sn2" class="input" maxlength="80" value="${esc(v.name)}"></div>
        <div class="field"><label for="sbr">${esc(t('posBranch'))}</label><select id="sbr" class="input">${opt('', t('staffAllBranches'), v.branch_id || '')}${branches.map(b => opt(b.id, b.name, v.branch_id || '')).join('')}</select></div></div>
      <fieldset class="field"><legend>${esc(t('staffPerms'))}</legend><div class="perm-list">${PERMS.map(p => `<label class="switch"><input type="checkbox" value="${p}"${(v.perms || []).includes(p) ? ' checked' : ''}><span></span>${esc(t('perm_' + p))}</label>`).join('')}</div></fieldset>
      ${SP.aiStaffBox ? SP.aiStaffBox(v) : ''}
      <div class="field"><label for="smd">${esc(t('staffMaxDisc'))}</label><input id="smd" class="input num" dir="ltr" inputmode="decimal" maxlength="6" value="${v.max_discount == null ? '' : esc(+v.max_discount)}"><span class="hint">${esc(t('staffMaxDiscHint'))}</span></div>
      <label class="switch"><input type="checkbox" id="sac"${v.active !== false ? ' checked' : ''}><span></span>${esc(t('staffActive'))}</label>
      <p class="form-err" id="serr2" role="alert"></p>
      <div class="sheet-actions"><button class="btn btn-signal">${I('check')} ${esc(t('saveChanges'))}</button>${v.id ? `<button type="button" class="btn btn-danger" id="sdel2">${I('trash')} ${esc(t('staffDel'))}</button>` : ''}</div></form>`, { label: t('staffT') });
    if (SP.aiStaffWire) SP.aiStaffWire(s.el, v);
    $('#stf', s.el).onsubmit = async e => {
      e.preventDefault();
      const email = $('#se', s.el).value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { $('#serr2', s.el).textContent = t('badEmail'); return; }
      const lr = SP.digits($('#smd', s.el).value).replace(/[٫,]/g, '.').replace(/[\s٪%]/g, ''), lim = lr === '' ? null : Number(lr);
      if (lim != null && !(lim >= 0 && lim <= 100)) { $('#serr2', s.el).textContent = t('staffBadLimit'); $('#smd', s.el).classList.add('invalid'); $('#smd', s.el).focus(); return; }
      try {
        await P.saveStaff({ p_email: email, p_name: $('#sn2', s.el).value.trim(), p_perms: $$('.perm-list input:checked', s.el).map(x => x.value), p_branch: $('#sbr', s.el).value || null,
          p_active: $('#sac', s.el).checked, p_max_discount: lim, ...(SP.aiStaffValue ? SP.aiStaffValue(s.el) : {}) });
        SP.toast(t('staffSaved')); s.close(); onSaved();
      } catch (x) { $('#serr2', s.el).textContent = SP.errText(x); }
    };
    if ($('#sdel2', s.el)) $('#sdel2', s.el).onclick = async () => {
      s.close();
      if (!await SP.confirmSheet({ title: t('staffDelQ', { n: v.name || v.email }), ok: t('staffDel'), danger: true })) return;
      try { await P.delStaff(v.id); SP.toast(t('staffDeleted')); onSaved(); } catch (x) { SP.toast(SP.errText(x)); }
    };
  }
  SP.route(/^staff$/, async (m, n) => {
    if (gate(n) || !guard(n, 'staffadmin')) return;
    shell(bar(t('staffT'), `<button type="button" class="iconbtn" id="sadd" aria-label="${esc(t('staffAdd'))}">${I('plus')}</button>`) + `<main class="wrap mine"><div id="sl"><div class="sk sk-row"></div></div>
      <button type="button" class="btn btn-signal" id="sadd2">${I('plus')} ${esc(t('staffAdd'))}</button></main>`);
    let list = [], branches = [];
    try { [list, branches] = await Promise.all([P.staff(), api.shops({ p_limit: 100 }).then(r => r.items)]); } catch (e) { if (SP.alive(n)) $('#sl').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    const bname = id => (branches.find(b => b.id === id) || {}).name || t('staffAllBranches');
    $('#sl').innerHTML = list.length ? list.map((v, i) => `<button type="button" class="arow staff-row" data-i="${i}"><span class="hexav"><span>${esc(SP.initial(v.name || v.email))}</span></span>
        <span class="ar-main"><b>${esc(v.name || v.email)} ${!v.active ? `<span class="pill demo">${esc(t('staffOff'))}</span>` : !v.user_id ? `<span class="pill demo">${esc(t('staffWaiting'))}</span>` : ''}</b>
        <small class="ltr">${esc(v.email)}</small><small>${esc([bname(v.branch_id), (v.perms || []).map(p => t('perm_' + p)).join('، ') || '—', v.max_discount != null ? t('staffLimitShort', { n: SP.fmtNum(+v.max_discount) }) : ''].filter(Boolean).join(' · '))}</small>${v.ai_on && SP.aiStaffShort ? `<small class="ai-short">${I('spark')} ${esc(SP.aiStaffShort(v))}</small>` : ''}</span>${I('chevL', 'dirx')}</button>`).join('')
      : empty('user', t('staffT'), t('noStaff'));
    const again = () => SP.render();
    $('#sl').onclick = e => { const b = e.target.closest('[data-i]'); if (b) staffSheet(list[+b.dataset.i], branches, again); };
    $('#sadd').onclick = $('#sadd2').onclick = () => staffSheet(null, branches, again);
    SP.done(n);
  });
})();
