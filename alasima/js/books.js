/* Accounts inside the sales system: stock (المخزن), customers and what they owe (الشاري), suppliers and what is owed to them (البايع),
   expenses (المصروفات), and profit and loss (الأرباح والخسائر). The database checks every rule again (supabase/setup.sql section 11). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, opt, shell, bar, empty, gate } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a));

  Object.assign(window.SP_IC, {
    stack: '<path d="M4 8.2 12 4l8 4.2-8 4.2z"/><path d="m4 12.2 8 4.2 8-4.2"/><path d="m4 16.2 8 4.2 8-4.2"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2"/><path d="M15.4 5.5a3 3 0 0 1 0 6M17.2 14.6c1.8.7 2.9 2.3 3.3 4.9"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9.5h3.8L21 13v3h-7"/><circle cx="7" cy="17.8" r="1.8"/><circle cx="17.2" cy="17.8" r="1.8"/>',
    wallet: '<rect x="3.5" y="6.5" width="17" height="12.5" rx="2"/><path d="M6.5 6.5 15.5 3.8v2.7"/><path d="M15.5 12.8h2.5"/>',
    trend: '<path d="M4 19.5h16"/><path d="m5 15.5 4.5-4.5 3 3L19 7.5"/><path d="M15 7.5h4v4"/>'
  });
  Object.assign(SP.L.P, {
    invoices: [{ zero: 'فاتورة', one: 'فاتورة', two: 'فواتير', few: 'فواتير', many: 'فاتورة', other: 'فاتورة' }, { one: 'invoice', other: 'invoices' }, { one: 'facture', many: 'factures', other: 'factures' },
      { one: 'factura', many: 'facturas', other: 'facturas' }, { one: 'Rechnung', other: 'Rechnungen' }, { one: 'fatura', other: 'fatura' }, { one: 'счёт', few: 'счёта', many: 'счетов', other: 'счёта' }, { other: '张发票' }]
  });
  Object.assign(SP.L.T, {
    accT: ["الحسابات", "Accounts"], stkT: ["المخزن", "Stock"], buyT: ["الزبائن", "Customers"], supT: ["الموردين", "Suppliers"], expT: ["المصروفات", "Expenses"], pnlT: ["الأرباح والخسائر", "Profit and loss"],
    rangeLastMonth: ["الشهر اللي فات", "Last month"],
    stkParts: ["قطعة في القائمة", "Parts listed"], stkUnits: ["حبة في المخزن", "Units in stock"], stkValueCost: ["قيمة المخزن بالتكلفة", "Stock value at cost"],
    stkValuePrice: ["قيمة المخزن بسعر البيع", "Stock value at selling price"], stkExpected: ["لو انباع المخزن كله بسعر البيع، الربح {m}", "Sold at the selling price, the whole stock would make {m}"],
    stkCostMissing: ["{n} قطعة بدون سعر تكلفة، فالقيمة تقريبية.", "{n} parts have no cost price, so the value is approximate."],
    stkAll: ["الكل", "All"], stkLow: ["قرب يخلص", "Running low"], stkOut: ["خلصت", "Out of stock"],
    stkLeft: ["باقي", "left"], stkLowSee: ["شوف الكل ({n})", "See all ({n})"], stkOutNames: ["خلصت: {l}", "Out of stock: {l}"], stkAndMore: ["و{n} غيرهم", "and {n} more"],
    stkOutSee: ["شوف اللي خلصت", "See them"], stkAllGood: ["كل الأصناف متوفرة، وما فيش حاجة قرب تخلص.", "Everything is in stock; nothing is running low."],
    stkLowWhat: ["«قرب يخلص» = {n} حبات أو أقل", "“Running low” = {n} units or fewer"], stkTapAdd: ["اضغط على الصنف باش تزيد كميته.", "Tap an item to add stock."], stkEmpty: ["ما فيش قطع هني.", "No parts here."],
    stkCostIs: ["التكلفة {m}", "Cost {m}"], stkTapHint: ["اضغط على أي قطعة باش تنقّص التالف أو تزيد أو تجرد.", "Tap a part to remove damaged stock, add, or count."],
    stkAdjT: ["تعديل الكمية", "Adjust quantity"], stkNow: ["الموجود توا: {n}", "In stock now: {n}"], stkMinus: ["نقّص", "Remove"], stkPlus: ["زيد", "Add"], stkCount: ["جرد", "Count"],
    stkHowMany: ["كم حبة؟", "How many?"], stkCounted: ["الكمية الصحيحة بعد العد", "Quantity counted"], stkReason: ["السبب", "Reason"],
    reason_damaged: ["تالف", "Damaged"], reason_lost: ["ضايع أو ناقص", "Lost or missing"], reason_count: ["فرق جرد", "Stock count"], reason_other: ["سبب آخر", "Other"],
    stkAfter: ["بعد الحفظ: {n}", "After saving: {n}"], stkValueDown: ["تنقص قيمة المخزن {m}", "stock value down {m}"], stkValueUp: ["تزيد قيمة المخزن {m}", "stock value up {m}"], youLabel: ["أنت", "You"], stkSaved: ["تم: الموجود توا {n}", "Saved: {n} in stock now"],
    stkBadQty: ["اكتب عدد صحيح", "Enter a whole number"], stkBelowZero: ["ما ينفعش تنقّص أكثر من الموجود ({n})", "You can't remove more than the {n} in stock"],
    stkNoChange: ["نفس الكمية، ما فيش تغيير", "Same quantity, nothing changed"], stkMoves: ["آخر تعديلات المخزن", "Latest stock changes"],
    buyOwing: ["الديون على الزبائن", "Customers owe"], buyOwingN: ["زبون عليه دين", "Customers owing"], buyOnlyOwing: ["عليهم ديون", "Owing"],
    buySearchPh: ["اسم الزبون أو رقم هاتفه", "Customer name or phone"],
    buyEmpty: ["ما فيش زبائن بعد. اكتب اسم الزبون أو هاتفه في الفاتورة، ويظهر هني مع ديونه.", "No customers yet. Put the customer's name or phone on an invoice and they show here with what they owe."],
    balOwes: ["عليه {m}", "Owes {m}"], balClear: ["خالص", "Settled"], balCredit: ["ليه {m}", "{m} in credit"], balOwed: ["ليه {m}", "We owe {m}"],
    buyBalance: ["الباقي عليه", "Still owes"], buyCreditT: ["ليه عندنا", "In credit with us"], buyBought: ["مجموع مشترياته", "Total bought"], buyDue: ["الباقي من فواتيره", "Unpaid on invoices"],
    buyPaidLater: ["دفع بعدين", "Paid later"], buyInvoices: ["فواتيره", "Invoices"], buyPayments: ["الدفعات", "Payments"], buyPay: ["سجّل دفعة", "Record a payment"],
    buyRemind: ["ذكّره على واتساب", "Remind on WhatsApp"], buyRemindMsg: ["السلام عليكم {n}،\nنذكّروك بالباقي عليك عند {app}: {m}\nوشكراً.", "Hello {n},\na reminder of your balance with {app}: {m}\nThank you."],
    buyNone: ["ما لقيناش الزبون هذا.", "This customer was not found."], invLeft: ["باقي {m}", "{m} unpaid"],
    payAmount: ["المبلغ", "Amount"], payNotePh: ["كاش، تحويل…", "Cash, transfer…"], paySave: ["سجّل الدفعة", "Record payment"], paySaved: ["تم تسجيل الدفعة", "Payment recorded"],
    payDel: ["احذف الدفعة", "Delete payment"], payDelQ: ["تحذف دفعة {m}؟", "Delete the {m} payment?"], payDeleted: ["انحذفت الدفعة", "Payment deleted"], badAmount: ["اكتب مبلغ صحيح", "Enter a valid amount"],
    supOwing: ["ديون للموردين", "We owe suppliers"], supOwingN: ["مورّد ليه دين", "Suppliers owed"], supOnlyOwing: ["ليهم ديون", "Owed"], supSearchPh: ["اسم المورّد", "Supplier name"],
    supEmpty: ["ما فيش موردين بعد. اكتب اسم المورّد لما تستلم البضاعة، ويظهر هني مع ديونه.", "No suppliers yet. Enter the supplier's name when you receive stock and they show here."],
    supBalance: ["الباقي ليه", "We still owe"], supBought: ["مجموع اللي شريناه منه", "Total bought"], supDue: ["الباقي من فواتير الشراء", "Unpaid on receipts"], supPaidLater: ["دفعناله بعدين", "Paid later"],
    supReceipts: ["فواتير الشراء", "Receipts"], supPay: ["سجّل دفعة للمورّد", "Record a payment"], supNone: ["ما لقيناش المورّد هذا.", "This supplier was not found."],
    supNeedCosts: ["أرقام الموردين تبيّن أسعار التكلفة، فتحتاج صلاحية «رؤية التكلفة والأرباح».", "Supplier figures show cost prices, so they need the cost permission."],
    expAdd: ["أضف مصروف", "Add expense"], expCat: ["نوع المصروف", "Type"], exp_rent: ["إيجار", "Rent"], exp_salaries: ["رواتب", "Salaries"], exp_utilities: ["كهرباء وماء ونت", "Utilities"],
    exp_transport: ["نقل وشحن", "Transport"], exp_maintenance: ["صيانة", "Maintenance"], exp_other: ["أخرى", "Other"], expDay: ["التاريخ", "Date"], expNote: ["تفاصيل (اختياري)", "Details (optional)"],
    expSaved: ["تم حفظ المصروف", "Expense saved"], expEmpty: ["ما فيش مصروفات في الفترة هذي.", "No expenses in this period."], expSum: ["مجموع المصروفات", "Total expenses"],
    expCount: ["عدد المصروفات", "Entries"], expDelQ: ["تحذف المصروف هذا؟", "Delete this expense?"], expDel: ["احذف", "Delete"], ledNone: ["ما فيش نتائج.", "No results."], expDeleted: ["انحذف المصروف", "Expense deleted"], badDate: ["التاريخ مش صحيح", "That date is not valid"],
    pnlSales: ["المبيعات (بعد الخصم)", "Sales (after discounts)"], pnlCogs: ["تكلفة البضاعة المباعة", "Cost of the parts sold"], pnlGross: ["الربح من البيع", "Profit on sales"],
    pnlExp: ["المصروفات", "Expenses"], pnlStock: ["فرق المخزن (تالف، ضايع، جرد)", "Stock changes (damaged, lost, count)"], pnlNetProfit: ["صافي الربح", "Net profit"], pnlNetLoss: ["صافي الخسارة", "Net loss"],
    pnlFacts: ["{n} · خصومات {d}", "{n} · discounts {d}"], pnlReturned: ["المرتجعات: {n} بقيمة {m}، مش محسوبة في المبيعات.", "Returns: {n} worth {m}, not counted in sales."],
    pnlBySeller: ["حسب البايع", "By seller"], pnlSold: ["{n} · مبيعات {m}", "{n} · sales {m}"], pnlProfitOf: ["ربح {m}", "Profit {m}"], pnlLossOf: ["خسارة {m}", "Loss {m}"],
    pnlDebts: ["الديون (لحد اليوم)", "Debts (as of today)"], pnlReceivable: ["على الزبائن", "Customers owe us"], pnlPayable: ["علينا للموردين", "We owe suppliers"],
    pnlEmpty: ["ما فيش مبيعات ولا مصروفات في الفترة هذي.", "No sales or expenses in this period."],
    stkPhoto: ["صوّر فاتورة الشراء", "Photograph a purchase invoice"], stkPhotoSub: ["القطع تدخل بأسمائها وكمياتها وأرقام الأصناف", "Parts go in with names, quantities and codes"],
    stkScanSub: ["امسح القطع اللي وصلت", "Scan the parts that arrived"], stkLowIs: ["«قرب يخلص» = {n} حبات أو أقل.", "“Running low” = {n} units or fewer."],
    stkLowSet: ["تغيّر الرقم من لوحة الإدارة ← التحكم.", "Change it in Admin → Controls."]
  });

  const CATS = ['rent', 'salaries', 'utilities', 'transport', 'maintenance', 'other'];
  const RANGES = [['today', 'rangeToday'], ['7', 'range7'], ['month', 'rangeMonth'], ['lastmonth', 'rangeLastMonth'], ['all', 'rangeAll']];
  /* [from, to) as local dates; "to" is the start of tomorrow so all of today counts */
  function span(k) {
    const d = new Date(), day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()), end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    if (k === 'today') return [day0, end];
    if (k === '7') return [new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6), end];
    if (k === 'month') return [new Date(d.getFullYear(), d.getMonth(), 1), end];
    if (k === 'year') return [new Date(d.getFullYear(), 0, 1), end];
    if (k === 'lastmonth') return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 1)];
    return [new Date(2000, 0, 1), end];
  }
  const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tripoli'; } catch (e) { return 'Africa/Tripoli'; } };
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  const dayText = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium' }).format(new Date(v + 'T12:00:00')); } catch (e) { return String(v); } };
  const money = v => SP.priceText(Number(v || 0), SP.currencyOf(S.country));
  const amountOf = v => { const x = Number(SP.digits(String(v || '')).replace(/[٫,]/g, '.').replace(/\s/g, '')); return isFinite(x) ? x : NaN; };
  /* the person who did it; the signed-in person reads "You" (the owner has no staff name, so the database keeps the email) */
  const who = name => (S.user && name && name === S.user.email ? t('youLabel') : name || '');
  const stat = (k, v, cls) => `<div class="astat${cls ? ' ' + cls : ''}"><b class="num">${esc(v)}</b><small>${esc(t(k))}</small></div>`;
  const chips = (cur, list, attr) => `<div class="chips light">${list.map(([k, l]) => `<button type="button" class="chip${cur === k ? ' on' : ''}" data-${attr}="${k}">${esc(t(l))}<span class="cnum" data-c="${k}"></span></button>`).join('')}</div>`;
  /* a balance as words: owes (red), settled (grey) or in credit (green); "theirs" flips the wording for suppliers */
  const bal = (v, theirs) => { v = +v || 0; return `<b class="bal ${v > 0 ? 'owe' : v < 0 ? 'cr' : 'ok'} num">${esc(v > 0 ? t(theirs ? 'balOwed' : 'balOwes', { m: money(v) }) : v < 0 ? t('balCredit', { m: money(-v) }) : t('balClear'))}</b>`; };

  function bookErr(e) {
    const m = String((e && e.message) || '');
    const x = /stock cannot go below zero \(available (-?\d+)\)/.exec(m);
    if (x) return t('stkBelowZero', { n: x[1] });
    if (/nothing to change/.test(m)) return t('stkNoChange');
    if (/bad amount/.test(m)) return t('badAmount');
    if (/bad date/.test(m)) return t('badDate');
    if (/bad quantity/.test(m)) return t('stkBadQty');
    if (/not authorized/.test(m)) return t('errPerm');
    return SP.errText(e);
  }
  function guard(n, ok, title) {
    if (!S.user) { S.after = SP.here(); shell(bar(title) + `<main class="wrap">${empty('lock', t('needLoginT'), '', `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (!ok) { shell(bar(title) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return false; }
    return true;
  }
  SP.bk = { span, tz, when, dayText, money, amountOf, who, stat, chips, paySheet };
  const canStock = () => SP.can('products') || SP.can('purchases') || SP.can('reports');
  const canBuyers = () => SP.can('invoices') || SP.can('reports');

  /* Tiles under the sales system on the account page. */
  SP.booksEntry = () => {
    const tiles = [['stock', 'stack', 'stkT', canStock()], ['merchants', 'store', 'mrT', !!(SP.company && SP.merchantsCan && SP.merchantsCan())], ['buyers', 'users', 'buyT', canBuyers()], ['suppliers', 'truck', 'supT', SP.can('costs')],
      ['expenses', 'wallet', 'expT', SP.can('expenses') || SP.can('costs')], ['pnl', 'trend', 'pnlT', SP.can('costs')]]
      .filter(x => x[3]).map(([h, ic, k]) => `<a class="pos-tile" href="#${h}">${I(ic)}<span>${esc(t(k))}</span></a>`).join('');
    return tiles ? `<section class="mcard"><h2 class="lbl">${esc(t('accT'))}</h2><div class="pos-grid">${tiles}</div></section>` : '';
  };
  const posEntry = SP.posEntry;
  if (posEntry) SP.posEntry = () => posEntry() + SP.booksEntry();

  /* ---------- المخزن: what is in stock, what it is worth, and changes (damaged, lost, counted) ---------- */
  function adjustSheet(p, done, start) {
    const now = p.qty || 0, showCost = SP.can('costs') && p.cost != null;
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(p.title)}</h2><p class="muted-p sheet-sub">${esc(t('stkNow', { n: SP.fmtNum(now) }))}</p><form class="form" id="adj" novalidate>
      <div class="seg" role="radiogroup" aria-label="${esc(t('stkAdjT'))}">${[['out', 'stkMinus'], ['in', 'stkPlus'], ['count', 'stkCount']].map(([k, l], i) =>
        `<input type="radio" name="am" id="am${i}" value="${k}"${(start ? k === start : !i) ? ' checked' : ''}><label for="am${i}">${esc(t(l))}</label>`).join('')}</div>
      <div class="field"><label for="aq" id="aql">${esc(t('stkHowMany'))}</label><input id="aq" class="input num" dir="ltr" inputmode="numeric" maxlength="7" autocomplete="off"></div>
      <div class="field" id="arw"><label for="arn">${esc(t('stkReason'))}</label><select id="arn" class="input"></select></div>
      <div class="field"><label for="ant">${esc(t('posNote'))}</label><input id="ant" class="input" maxlength="300"></div>
      <p class="hint" id="aprev" aria-live="polite"></p><p class="form-err" id="aerr" role="alert"></p>
      <div class="sheet-actions"><button class="btn btn-signal">${I('check')} ${esc(t('saveChanges'))}</button></div></form>`, { label: t('stkAdjT') });
    const REASONS = { out: ['damaged', 'lost', 'other'], in: ['count', 'other'], count: ['count'] };
    const mode = () => $('input[name="am"]:checked', s.el).value;
    const qty = () => { const v = $('#aq', s.el).value.trim(); return v === '' ? NaN : amountOf(v); };
    const preview = () => {
      const v = qty(), md = mode();
      if (!Number.isInteger(v)) { $('#aprev', s.el).textContent = ''; return; }
      const nv = md === 'count' ? v : md === 'out' ? now - v : now + v;
      $('#aprev', s.el).textContent = t('stkAfter', { n: SP.fmtNum(nv) }) + (showCost && nv !== now ? ' · ' + t(nv < now ? 'stkValueDown' : 'stkValueUp', { m: money(Math.abs(nv - now) * p.cost) }) : '');
    };
    const sync = () => {
      const md = mode();
      $('#aql', s.el).textContent = t(md === 'count' ? 'stkCounted' : 'stkHowMany');
      $('#arn', s.el).innerHTML = REASONS[md].map(r => opt(r, t('reason_' + r), '')).join('');
      $('#arw', s.el).hidden = md === 'count';
      preview();
    };
    $$('input[name="am"]', s.el).forEach(x => { x.onchange = sync; });
    $('#aq', s.el).oninput = preview;
    sync();
    setTimeout(() => $('#aq', s.el).focus(), 60);
    $('#adj', s.el).onsubmit = async e => {
      e.preventDefault();
      const v = qty(), md = mode(), err = $('#aerr', s.el);
      if (!Number.isInteger(v) || v < 0 || (md !== 'count' && v === 0)) { err.textContent = t('stkBadQty'); $('#aq', s.el).focus(); return; }
      if (md === 'out' && v > now) { err.textContent = t('stkBelowZero', { n: SP.fmtNum(now) }); return; }
      const body = { id: p.id, reason: md === 'count' ? 'count' : $('#arn', s.el).value, note: $('#ant', s.el).value.trim() };
      if (md === 'count') body.set = v; else body.delta = md === 'out' ? -v : v;
      const b = $('#adj button', s.el); b.classList.add('busy');
      try { const r = await rpc('adjust_stock', { p: body }); SP.toast(t('stkSaved', { n: SP.fmtNum(r.qty) })); s.close(); done(); }
      catch (x) { err.textContent = bookErr(x); b.classList.remove('busy'); }
    };
  }
  SP.route(/^stock$/, async (m, n) => {
    if (gate(n) || !guard(n, canStock(), t('stkT'))) return;
    S.stkF = S.stkF || 'all';
    const costs = SP.can('costs'), edit = SP.can('products');
    shell(bar(t('stkT'), SP.can('purchases') ? `<a class="iconbtn" href="#receive" aria-label="${esc(t('rcvT'))}">${I('plus')}</a>` : '') + `<main class="wrap mine">
      <div id="slow"><div class="sk sk-block"></div></div>
      ${SP.can('purchases') ? `<div class="rcv-actions stk-actions"><label class="rcv-big" id="sphoto">${I('receipt')}<b>${esc(t('stkPhoto'))}</b><small>${esc(t('stkPhotoSub'))}</small><input type="file" accept="image/*" class="sr" id="spf"></label>
        <button type="button" class="rcv-big" id="sscan">${I('scan')}<b>${esc(t('rcvScan'))}</b><small>${esc(t('stkScanSub'))}</small></button></div>` : ''}
      <div id="ssum"><div class="sk sk-block"></div></div>
      ${chips(S.stkF, [['all', 'stkAll'], ['low', 'stkLow'], ['out', 'stkOut']], 'f')}
      <form class="searchbox flat" id="sqf" role="search">${I('search')}<input type="search" value="${esc(S.stkQ || '')}" placeholder="${esc(t('posSearchPh'))}" aria-label="${esc(t('search'))}"></form>
      ${edit ? `<p class="hint">${esc(t('stkTapHint'))}</p>` : ''}
      <div id="sll"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div>
      <div id="smv"></div></main>`);
    $$('[data-f]').forEach(b => { b.onclick = () => { S.stkF = b.dataset.f; SP.render(); }; });
    /* a photo or a scan from here continues on the receiving screen (js/scan.js) */
    if ($('#spf')) $('#spf').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) { SP.pendingInvoice = f; SP.go('receive'); } };
    if ($('#sscan')) $('#sscan').onclick = () => { SP.pendingScan = true; SP.go('receive'); };
    let low = 3;
    $('#sqf').onsubmit = e => { e.preventDefault(); S.stkQ = $('#sqf input').value.trim(); SP.render(); };
    const items = [];
    const row = p => {
      const q = p.qty, cls = q === 0 ? 'out' : q != null && q <= low ? 'low' : '';
      return `<button type="button" class="arow stk-row" data-id="${esc(p.id)}"${edit ? '' : ' disabled'}><span class="qty-chip ${cls} num" title="${esc(t('posQty'))}">${q == null ? '—' : esc(SP.fmtNum(q))}</span>
        <span class="ar-main"><b>${esc(p.title)}</b><small>${[p.sku || p.part_no, SP.makerModel(p), p.branch_name].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>
        <span class="stk-val">${p.price != null ? `<b class="num">${esc(money(p.price))}</b>` : ''}${costs && p.cost != null ? `<small class="num">${esc(t('stkCostIs', { m: money(p.cost) }))}</small>` : ''}</span></button>`;
    };
    /* first on the page: what is running low (the fewest left first, how many are left) and how many have run out */
    const drawLow = (s, L, O) => {
      const nl = +s.low || 0, no = +s.out || 0;
      if (!nl && !no) { $('#slow').innerHTML = `<p class="stk-good">${I('check')}<span>${esc(t('stkAllGood'))}</span></p>`; return; }
      $('#slow').innerHTML = `<section class="mcard stk-alert"><div class="sa-nums">
          <button type="button" class="sa-num low${nl ? '' : ' zero'}" data-goto="low"><b class="num">${esc(SP.fmtNum(nl))}</b><span>${esc(t('stkLow'))}</span></button>
          <button type="button" class="sa-num out${no ? '' : ' zero'}" data-goto="out"><b class="num">${esc(SP.fmtNum(no))}</b><span>${esc(t('stkOut'))}</span></button></div>
        ${L.length ? `<ul class="sa-list">${L.slice(0, 6).map(p => `<li><button type="button" class="sa-row" data-low="${esc(p.id)}"${edit ? '' : ' disabled'}>
            <span class="sa-left"><small>${esc(t('stkLeft'))}</small><b class="num">${esc(SP.fmtNum(p.qty))}</b></span>
            <span class="ar-main"><b>${esc(p.title)}</b><small>${[p.sku || p.part_no, p.maker, p.branch_name].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small>
              <span class="sa-bar" aria-hidden="true"><i style="width:${Math.max(8, Math.round(100 * p.qty / Math.max(1, low)))}%"></i></span></span>${edit ? I('plus', 'sa-add') : ''}</button></li>`).join('')}</ul>` : ''}
        <p class="sa-foot"><span>${esc(t('stkLowWhat', { n: SP.fmtNum(low) }))}${edit && L.length ? ' · ' + esc(t('stkTapAdd')) : ''}</span>${nl > 6 ? `<button type="button" class="linkbtn" data-goto="low">${esc(t('stkLowSee', { n: SP.fmtNum(nl) }))}</button>` : ''}</p>
        ${no ? `<p class="sa-out">${I('box')}<span>${esc(t('stkOutNames', { l: O.slice(0, 4).map(p => p.title).join('، ') + (no > 4 ? ' ' + t('stkAndMore', { n: SP.fmtNum(no - Math.min(4, O.length)) }) : '') }))}</span>
          <button type="button" class="linkbtn" data-goto="out">${esc(t('stkOutSee'))}</button></p>` : ''}</section>`;
      $$('[data-goto]', $('#slow')).forEach(b => b.onclick = () => { S.stkF = b.dataset.goto; S.stkJump = true; SP.render(); });
      $$('[data-low]', $('#slow')).forEach(b => b.onclick = () => { const p = L.find(x => x.id === b.dataset.low); if (p && edit) adjustSheet(p, () => SP.render(), 'in'); });
    };
    const drawSummary = s => {
      low = s.low_level != null ? +s.low_level : 3;
      $('#ssum').innerHTML = `<div class="astats">${stat('stkParts', SP.fmtNum(s.parts || 0))}${stat('stkUnits', SP.fmtNum(s.units || 0))}${costs ? stat('stkValueCost', money(s.value_cost)) : ''}${stat('stkValuePrice', money(s.value_price))}</div>
        ${costs ? `<p class="hint">${esc(t('stkExpected', { m: money((+s.value_price || 0) - (+s.value_cost || 0)) }))}${s.cost_missing ? ' ' + esc(t('stkCostMissing', { n: s.cost_missing })) : ''}</p>` : ''}
        ${S.stkF === 'low' ? `<p class="hint">${esc(t('stkLowIs', { n: SP.fmtNum(low) }))}${S.admin ? ' ' + esc(t('stkLowSet')) : ''}</p>` : ''}`;
      $$('[data-c]').forEach(x => { const v = x.dataset.c === 'low' ? s.low : x.dataset.c === 'out' ? s.out : 0; x.textContent = v ? SP.fmtNum(v) : ''; });
    };
    const drawMoves = list => {
      $('#smv').innerHTML = list.length ? `<details class="mcard moves"><summary class="lbl">${esc(t('stkMoves'))} <span class="cnum">${esc(SP.fmtNum(list.length))}</span></summary>
        ${list.map(x => `<div class="arow"><span class="qty-chip ${x.qty < 0 ? 'out' : 'in'} num">${x.qty > 0 ? '+' : '−'}${esc(SP.fmtNum(Math.abs(x.qty)))}</span>
          <span class="ar-main"><b>${esc(x.title)}</b><small>${[t('reason_' + x.reason), x.note, who(x.staff_name), when(x.created_at)].filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span>
          ${x.value != null ? `<b class="num ${x.value < 0 ? 'neg' : 'pos'}">${x.value < 0 ? '−' : '+'} ${esc(money(Math.abs(x.value)))}</b>` : ''}</div>`).join('')}</details>` : '';
    };
    await SP.pager(n, $('#sll'), $('#more'), async off => {
      const r = await rpc('stock_report', { p_q: S.stkQ || null, p_filter: S.stkF, p_limit: 50, p_offset: off });
      if (!off) {
        drawSummary(r.summary || {}); drawLow(r.summary || {}, r.low_items || [], r.out_items || []); drawMoves(r.moves || []);
        /* a number tapped at the top: the list below, on that filter */
        if (S.stkJump) { S.stkJump = false; setTimeout(() => { const c = $('[data-f="' + S.stkF + '"]'); if (c) c.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, 60); }
      }
      items.push(...r.items);
      return { items: r.items, total: +r.total || 0 };
    }, list => list.map(row).join(''), (r, first) => { if (first && !r.total) $('#sll').innerHTML = empty('box', t('stkEmpty')); });
    $('#sll').onclick = e => { const b = e.target.closest('[data-id]'); const p = b && edit && items.find(x => x.id === b.dataset.id); if (p) adjustSheet(p, () => SP.render()); };
    SP.done(n);
  });

  /* ---------- payments (customers and suppliers) ---------- */
  function paySheet(o) {
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(o.title)}</h2><p class="muted-p">${esc(o.name)}</p><form class="form" id="pyf" novalidate>
      <div class="field"><label for="pya">${esc(t('payAmount'))}</label><input id="pya" class="input num" dir="ltr" inputmode="decimal" maxlength="12" autocomplete="off" value="${o.suggest > 0 ? esc(String(o.suggest)) : ''}"></div>
      <div class="field"><label for="pyn">${esc(t('posNote'))}</label><input id="pyn" class="input" maxlength="300" placeholder="${esc(t('payNotePh'))}"></div>
      <p class="form-err" id="pye" role="alert"></p>
      <div class="sheet-actions"><button class="btn btn-signal">${I('check')} ${esc(t('paySave'))}</button></div></form>`, { label: o.title });
    setTimeout(() => $('#pya', s.el).select(), 60);
    $('#pyf', s.el).onsubmit = async e => {
      e.preventDefault();
      const amt = amountOf($('#pya', s.el).value);
      if (!(amt > 0)) { $('#pye', s.el).textContent = t('badAmount'); $('#pya', s.el).focus(); return; }
      const b = $('#pyf button', s.el); b.classList.add('busy');
      try { const d = await o.save(amt, $('#pyn', s.el).value.trim()); SP.toast(t('paySaved')); s.close(); o.done(d); }
      catch (x) { $('#pye', s.el).textContent = bookErr(x); b.classList.remove('busy'); }
    };
  }
  const payRows = (list, del) => list.map(p => `<div class="arow"><span class="ar-main"><b class="num">${esc(money(p.amount))}</b>
      <small>${[when(p.created_at), who(p.staff_name), p.note].filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span>
      ${del ? `<button type="button" class="iconbtn" data-del="${esc(p.id)}" aria-label="${esc(t('payDel'))}">${I('trash')}</button>` : ''}</div>`).join('');

  /* one list screen for both sides: customers (what they owe us) and suppliers (what we owe them) */
  function ledgerList(o) {
    return async (m, n) => {
      if (gate(n) || !guard(n, o.can(), t(o.title))) return;
      const F = o.key + 'F', Q = o.key + 'Q';
      S[F] = S[F] || 'all';
      shell(bar(t(o.title)) + `<main class="wrap mine"><div id="lsum"><div class="sk sk-block"></div></div>
        ${chips(S[F], [['all', 'stkAll'], ['owing', o.onlyOwing]], 'f')}
        <form class="searchbox flat" id="lqf" role="search">${I('search')}<input type="search" value="${esc(S[Q] || '')}" placeholder="${esc(t(o.searchPh))}" aria-label="${esc(t('search'))}"></form>
        <div id="lll"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
      $$('[data-f]').forEach(b => { b.onclick = () => { S[F] = b.dataset.f; SP.render(); }; });
      $('#lqf').onsubmit = e => { e.preventDefault(); S[Q] = $('#lqf input').value.trim(); SP.render(); };
      const row = x => `<a class="arow led-row" href="#${o.one}-${encodeURIComponent(x.key)}"><span class="hexav"><span>${esc(SP.initial(x.name))}</span></span>
        <span class="ar-main"><b>${esc(x.name)}</b><small>${[o.phone ? x.phone : '', SP.count(+x.count || 0, 'invoices'), when(x.last_at)].filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span>
        ${bal(x.balance, o.theirs)}${I('chevL', 'dirx')}</a>`;
      await SP.pager(n, $('#lll'), $('#more'), async off => {
        const r = await rpc(o.list, { p_q: S[Q] || null, p_owing: S[F] === 'owing', p_limit: 30, p_offset: off });
        if (!off) {
          $('#lsum').innerHTML = `<div class="astats">${stat(o.owing, money(r.owing_total), +r.owing_total > 0 ? 'warnstat' : '')}${stat(o.owingN, SP.fmtNum(+r.owing_count || 0))}</div>`;
          const c = $('[data-c="owing"]'); if (c) c.textContent = +r.owing_count ? SP.fmtNum(+r.owing_count) : '';
        }
        return { items: r.items, total: +r.total || 0 };
      }, list => list.map(row).join(''), (r, first) => { if (first && !r.total) $('#lll').innerHTML = empty(o.icon, t(S[F] === 'owing' || S[Q] ? 'ledNone' : o.empty)); });
      SP.done(n);
    };
  }
  SP.route(/^buyers$/, ledgerList({ key: 'buy', title: 'buyT', can: canBuyers, list: 'list_buyers', one: 'buyer', onlyOwing: 'buyOnlyOwing', searchPh: 'buySearchPh',
    owing: 'buyOwing', owingN: 'buyOwingN', empty: 'buyEmpty', icon: 'users', phone: true, theirs: false }));
  SP.route(/^suppliers$/, ledgerList({ key: 'sup', title: 'supT', can: () => SP.can('costs'), list: 'list_suppliers', one: 'supplier', onlyOwing: 'supOnlyOwing', searchPh: 'supSearchPh',
    owing: 'supOwing', owingN: 'supOwingN', empty: 'supEmpty', icon: 'truck', phone: false, theirs: true }));

  /* ---------- one customer: invoices, what is left, payments, a WhatsApp reminder ---------- */
  SP.route(/^buyer-(.+)$/, async (m, n) => {
    if (gate(n) || !guard(n, canBuyers(), t('buyT'))) return;
    const key = decodeURIComponent(m[1]);
    shell(bar(t('buyT')) + `<main class="wrap"><div class="sk sk-block"></div></main>`);
    let d;
    try { d = await rpc('buyer_detail', { p_key: key }); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!d) { shell(bar(t('buyT')) + `<main class="wrap">${empty('users', t('buyNone'), '', `<a class="btn btn-ink" href="#buyers">${esc(t('buyT'))}</a>`)}</main>`); return SP.done(n); }
    const draw = d => {
      const app = (S.settings || {}).brand_name || SP.CFG.appName || t('app'), b = +d.balance || 0;
      const wa = d.phone && b > 0 ? SP.waLink(d.phone, t('buyRemindMsg', { n: d.name, app, m: money(b) }), S.country) : '';
      shell(bar(d.name) + `<main class="wrap mine"><section class="mcard led-head">
          ${d.phone ? `<p class="muted-p"><bdi class="ltr">${esc(d.phone)}</bdi></p>` : ''}
          <div class="led-bal ${b > 0 ? 'owe' : b < 0 ? 'cr' : ''}"><small>${esc(t(b < 0 ? 'buyCreditT' : 'buyBalance'))}</small><b class="num">${esc(money(Math.abs(b)))}</b></div>
          <div class="astats">${stat('buyBought', money(d.total))}${stat('buyDue', money(d.due))}${stat('buyPaidLater', money(d.paid_later))}${stat('buyInvoices', SP.fmtNum(+d.count || 0))}</div>
          <div class="form-actions">${SP.can('invoices') ? `<button type="button" class="btn btn-signal" id="bpay">${I('plus')} ${esc(t('buyPay'))}</button>` : ''}
            ${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('buyRemind'))}</a>` : ''}</div></section>
        <section class="mcard"><h2 class="lbl">${esc(t('buyInvoices'))}</h2>${d.invoices.map(v => `<a class="arow inv-row${v.status === 'returned' ? ' ret' : ''}" href="#inv-${esc(v.id)}"><span class="inv-badge num">${esc(v.no)}</span>
            <span class="ar-main"><b><span class="num">${esc(money(v.total))}</span>${v.status === 'returned' ? ` <span class="pill">${esc(t('invReturned'))}</span>` : v.total - v.paid > 0 ? ` <span class="pill demo">${esc(t('invLeft', { m: money(v.total - v.paid) }))}</span>` : ''}</b>
            <small>${[when(v.created_at), t('pay_' + v.payment), who(v.staff_name)].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>${I('chevL', 'dirx')}</a>`).join('')}</section>
        ${d.payments.length ? `<section class="mcard"><h2 class="lbl">${esc(t('buyPayments'))}</h2>${payRows(d.payments, S.admin)}</section>` : ''}</main>`);
      if ($('#bpay')) $('#bpay').onclick = () => paySheet({ title: t('buyPay'), name: d.name, suggest: b, save: (amt, note) => rpc('add_customer_payment', { p_key: d.key, p_amount: amt, p_note: note }), done: draw });
      $$('[data-del]').forEach(x => { x.onclick = async () => {
        const p = d.payments.find(y => String(y.id) === x.dataset.del);
        if (!p || !await SP.confirmSheet({ title: t('payDelQ', { m: money(p.amount) }), ok: t('payDel'), danger: true })) return;
        try { await rpc('delete_customer_payment', { p_id: p.id }); SP.toast(t('payDeleted')); draw(await rpc('buyer_detail', { p_key: d.key })); } catch (e) { SP.toast(bookErr(e)); }
      }; });
    };
    draw(d);
    SP.done(n);
  });

  /* ---------- one supplier: receipts, what is left, payments ---------- */
  SP.route(/^supplier-(.+)$/, async (m, n) => {
    if (gate(n) || !guard(n, SP.can('costs'), t('supT'))) return;
    const key = decodeURIComponent(m[1]);
    shell(bar(t('supT')) + `<main class="wrap"><div class="sk sk-block"></div></main>`);
    let d;
    try { d = await rpc('supplier_detail', { p_key: key }); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!d) { shell(bar(t('supT')) + `<main class="wrap">${empty('truck', t('supNone'), '', `<a class="btn btn-ink" href="#suppliers">${esc(t('supT'))}</a>`)}</main>`); return SP.done(n); }
    const draw = d => {
      const b = +d.balance || 0;
      shell(bar(d.name) + `<main class="wrap mine"><section class="mcard led-head">
          <div class="led-bal ${b > 0 ? 'owe' : b < 0 ? 'cr' : ''}"><small>${esc(t(b < 0 ? 'buyCreditT' : 'supBalance'))}</small><b class="num">${esc(money(Math.abs(b)))}</b></div>
          <div class="astats">${stat('supBought', money(d.total))}${stat('supDue', money(d.due))}${stat('supPaidLater', money(d.paid_later))}${stat('supReceipts', SP.fmtNum(+d.count || 0))}</div>
          ${SP.can('purchases') ? `<div class="form-actions"><button type="button" class="btn btn-signal" id="spay">${I('plus')} ${esc(t('supPay'))}</button></div>` : ''}</section>
        <section class="mcard"><h2 class="lbl">${esc(t('supReceipts'))}</h2>${d.receipts.map(v => `<a class="arow inv-row" href="#pur-${esc(v.id)}"><span class="inv-badge num">${esc(v.no)}</span>
            <span class="ar-main"><b><span class="num">${esc(money(v.total))}</span>${v.total - v.paid > 0 ? ` <span class="pill demo">${esc(t('invLeft', { m: money(v.total - v.paid) }))}</span>` : ''}</b>
            <small>${[when(v.created_at), SP.count(+v.items_count || 0, 'parts'), v.branch_name].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>${I('chevL', 'dirx')}</a>`).join('')}</section>
        ${d.payments.length ? `<section class="mcard"><h2 class="lbl">${esc(t('buyPayments'))}</h2>${payRows(d.payments, S.admin)}</section>` : ''}</main>`);
      if ($('#spay')) $('#spay').onclick = () => paySheet({ title: t('supPay'), name: d.name, suggest: b, save: (amt, note) => rpc('add_supplier_payment', { p_key: d.key, p_amount: amt, p_note: note }), done: draw });
      $$('[data-del]').forEach(x => { x.onclick = async () => {
        const p = d.payments.find(y => String(y.id) === x.dataset.del);
        if (!p || !await SP.confirmSheet({ title: t('payDelQ', { m: money(p.amount) }), ok: t('payDel'), danger: true })) return;
        try { await rpc('delete_supplier_payment', { p_id: p.id }); SP.toast(t('payDeleted')); draw(await rpc('supplier_detail', { p_key: d.key })); } catch (e) { SP.toast(bookErr(e)); }
      }; });
    };
    draw(d);
    SP.done(n);
  });

  /* ---------- المصروفات ---------- */
  function expenseSheet(done) {
    const today = new Date();
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('expAdd'))}</h2><form class="form" id="exf" novalidate>
      <fieldset class="field"><legend>${esc(t('expCat'))}</legend><div class="seg">${CATS.map((c, i) => `<input type="radio" name="exc" id="exc${i}" value="${c}"${i ? '' : ' checked'}><label for="exc${i}">${esc(t('exp_' + c))}</label>`).join('')}</div></fieldset>
      <div class="row2"><div class="field"><label for="exa">${esc(t('payAmount'))}</label><input id="exa" class="input num" dir="ltr" inputmode="decimal" maxlength="12" autocomplete="off"></div>
        <div class="field"><label for="exd">${esc(t('expDay'))}</label><input id="exd" class="input" type="date" value="${dayStr(today)}" max="${dayStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))}"></div></div>
      <div class="field"><label for="exn">${esc(t('expNote'))}</label><input id="exn" class="input" maxlength="300"></div>
      <p class="form-err" id="exe" role="alert"></p>
      <div class="sheet-actions"><button class="btn btn-signal">${I('check')} ${esc(t('saveChanges'))}</button></div></form>`, { label: t('expAdd') });
    $('#exf', s.el).onsubmit = async e => {
      e.preventDefault();
      const amt = amountOf($('#exa', s.el).value);
      if (!(amt > 0)) { $('#exe', s.el).textContent = t('badAmount'); $('#exa', s.el).focus(); return; }
      const b = $('#exf button', s.el); b.classList.add('busy');
      try {
        await rpc('add_expense', { p: { cat: $('input[name="exc"]:checked', s.el).value, amount: amt, spent_on: $('#exd', s.el).value || null, note: $('#exn', s.el).value.trim() } });
        SP.toast(t('expSaved')); s.close(); done();
      } catch (x) { $('#exe', s.el).textContent = bookErr(x); b.classList.remove('busy'); }
    };
  }
  SP.route(/^expenses$/, async (m, n) => {
    if (gate(n) || !guard(n, SP.can('expenses') || SP.can('costs'), t('expT'))) return;
    S.expR = S.expR || 'month';
    const add = SP.can('expenses');
    shell(bar(t('expT'), add ? `<button type="button" class="iconbtn" id="exadd" aria-label="${esc(t('expAdd'))}">${I('plus')}</button>` : '') + `<main class="wrap mine">
      ${chips(S.expR, RANGES, 'r')}<div id="exl"><div class="sk sk-block"></div></div>
      ${add ? `<button type="button" class="btn btn-signal" id="exadd2">${I('plus')} ${esc(t('expAdd'))}</button>` : ''}</main>`);
    $$('[data-r]').forEach(b => { b.onclick = () => { S.expR = b.dataset.r; SP.render(); }; });
    if (add) $('#exadd').onclick = $('#exadd2').onclick = () => expenseSheet(() => SP.render());
    const [from, to] = span(S.expR);
    let r;
    try { r = await rpc('list_expenses', { p_from: dayStr(from), p_to: dayStr(to), p_limit: 100, p_offset: 0 }); } catch (e) { if (SP.alive(n)) $('#exl').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    const cats = Object.entries(r.by_cat || {}).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...cats.map(x => +x[1]));
    $('#exl').innerHTML = `<div class="astats">${stat('expSum', money(r.sum))}${stat('expCount', SP.fmtNum(+r.total || 0))}</div>
      ${cats.length > 1 ? `<section class="mcard">${cats.map(([c, v]) => `<div class="rbar"><span>${esc(t('exp_' + c))}</span><i style="--w:${Math.round(v / max * 100)}%"></i><b class="num">${esc(money(v))}</b></div>`).join('')}</section>` : ''}
      ${r.items.length ? `<section class="mcard">${r.items.map(x => `<div class="arow"><span class="ar-main"><b>${esc(t('exp_' + x.cat))}</b>
          <small>${[x.note, dayText(x.spent_on), who(x.staff_name), x.branch_name].filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span><b class="num">${esc(money(x.amount))}</b>
          ${add && (S.admin || x.mine) ? `<button type="button" class="iconbtn" data-del="${esc(x.id)}" aria-label="${esc(t('expDelQ'))}">${I('trash')}</button>` : ''}</div>`).join('')}</section>` : empty('wallet', t('expEmpty'))}`;
    $$('[data-del]', $('#exl')).forEach(b => { b.onclick = async () => {
      if (!await SP.confirmSheet({ title: t('expDelQ'), ok: t('expDel'), danger: true })) return;
      try { await rpc('delete_expense', { p_id: +b.dataset.del }); SP.toast(t('expDeleted')); SP.render(); } catch (e) { SP.toast(bookErr(e)); }
    }; });
    SP.done(n);
  });

  /* ---------- الأرباح والخسائر ---------- */
  SP.route(/^pnl$/, async (m, n) => {
    if (gate(n) || !guard(n, SP.can('costs'), t('pnlT'))) return;
    S.pnlR = S.pnlR || 'month';
    shell(bar(t('pnlT')) + `<main class="wrap mine">${chips(S.pnlR, RANGES, 'r')}<div id="pnl"><div class="sk sk-block"></div></div></main>`);
    $$('[data-r]').forEach(b => { b.onclick = () => { S.pnlR = b.dataset.r; SP.render(); }; });
    const [from, to] = span(S.pnlR);
    let r;
    try { r = await rpc('pnl_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: tz() }); } catch (e) { if (SP.alive(n)) $('#pnl').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    const line = (label, v, cls, sign) => `<div class="pl-row${cls ? ' ' + cls : ''}"><span>${esc(label)}</span><b class="num">${sign ? sign + ' ' : ''}${esc(money(Math.abs(+v || 0)))}</b></div>`;
    const net = +r.net || 0, adj = +r.stock_adj || 0, cats = Object.entries(r.by_cat || {}).sort((a, b) => b[1] - a[1]);
    const nothing = !+r.count && !+r.expenses && !adj;
    $('#pnl').innerHTML = `<section class="mcard pl">
        ${line(t('pnlSales'), r.sales)}${line(t('pnlCogs'), r.cogs, 'sub', '−')}${line(t('pnlGross'), r.gross, 'tot', +r.gross < 0 ? '−' : '')}
        ${line(t('pnlExp'), r.expenses, 'sub', '−')}${cats.map(([c, v]) => line(t('exp_' + c), v, 'pl-cat')).join('')}
        ${adj ? line(t('pnlStock'), adj, 'sub', adj < 0 ? '−' : '+') : ''}
        <div class="pl-net ${net < 0 ? 'loss' : 'gain'}"><span>${esc(t(net < 0 ? 'pnlNetLoss' : 'pnlNetProfit'))}</span><b class="num">${esc(money(Math.abs(net)))}</b></div></section>
      ${nothing ? `<p class="hint">${esc(t('pnlEmpty'))}</p>` : `<p class="hint">${esc(t('pnlFacts', { n: SP.count(+r.count || 0, 'invoices'), d: money(r.discount) }))}${+r.returned_count ? ' ' + esc(t('pnlReturned', { n: SP.count(+r.returned_count, 'invoices'), m: money(r.returned_total) })) : ''}</p>`}
      ${+r.cost_missing ? `<p class="hint warnt">${esc(t('repCostMissing', { n: r.cost_missing }))}</p>` : ''}
      ${(r.by_staff || []).length ? `<section class="mcard"><h2 class="lbl">${esc(t('pnlBySeller'))}</h2>${r.by_staff.map(x => `<div class="arow"><span class="hexav"><span>${esc(SP.initial(who(x.name)))}</span></span>
          <span class="ar-main"><b>${esc(who(x.name))}</b><small>${esc(t('pnlSold', { n: SP.count(+x.count || 0, 'invoices'), m: money(x.total) }))}</small></span>
          <b class="num ${+x.profit < 0 ? 'neg' : 'pos'}">${esc(t(+x.profit < 0 ? 'pnlLossOf' : 'pnlProfitOf', { m: money(Math.abs(+x.profit || 0)) }))}</b></div>`).join('')}</section>` : ''}
      <section class="mcard"><h2 class="lbl">${esc(t('pnlDebts'))}</h2>
        ${canBuyers() ? `<a class="arow" href="#buyers">${I('users')}<span class="ar-main"><b>${esc(t('pnlReceivable'))}</b></span><b class="num">${esc(money(r.receivable))}</b>${I('chevL', 'dirx')}</a>` : ''}
        <a class="arow" href="#suppliers">${I('truck')}<span class="ar-main"><b>${esc(t('pnlPayable'))}</b></span><b class="num">${esc(money(r.payable))}</b>${I('chevL', 'dirx')}</a></section>`;
    SP.done(n);
  });
})();
