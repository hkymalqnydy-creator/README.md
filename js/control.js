/* Owner controls in the admin panel (company edition): what customers can see and closing orders for a while, rules for the
   staff (no selling below cost, a discount limit each), the running-low level, the invoice footer, the activity log (سجل كل حركة),
   prices in bulk, and a "today" card on the main tab. The database checks every rule again (supabase/setup.sql section 12). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, opt, shell, bar, empty, gate } = SP;
  const D = window.SP_DATA;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a));
  const BK = SP.bk;

  Object.assign(window.SP_IC, {
    history: '<path d="M4.6 12.4A7.5 7.5 0 1 0 6.8 6.7"/><path d="M4.6 4.6v3.6h3.6"/><path d="M12 8.2v4.2l2.9 1.8"/>',
    percent: '<path d="m6 18 12-12"/><circle cx="7.6" cy="7.6" r="2.3"/><circle cx="16.4" cy="16.4" r="2.3"/>',
    undo: '<path d="M9.4 5.8 5 10.2l4.4 4.4"/><path d="M5.6 10.2h8.1a5 5 0 0 1 0 10H10.5"/>',
    eyeoff: '<path d="M4 12s3-5.6 8-5.6 8 5.6 8 5.6-3 5.6-8 5.6S4 12 4 12z"/><circle cx="12" cy="12" r="2.3"/><path d="M5 19 19 5"/>'
  });
  Object.assign(SP.L.T, {
    ctlT: ["التحكم", "Controls"], logT: ["سجل الحركة", "Activity log"], bpT: ["الأسعار", "Prices"],
    /* controls */
    ctlCustT: ["قفل وإخفاء للزبائن", "Lock and hide for customers"], ctlCustB: ["الموظفين وانت تشوفو كل شي دايماً. اللي هني يخص الزبائن بس.", "You and your staff always see everything. These only change what customers see."],
    ctlClosed: ["قفل الطلبات مؤقتاً", "Close orders for now"], ctlClosedMsg: ["الرسالة اللي يشوفها الزبون", "Message customers see"],
    ctlClosedPh: ["مسكرين اليوم، نرجعو بكرة الصبح إن شاء الله", "Closed today, back tomorrow morning"],
    ctlClosedDef: ["الطلبات مقفلة توا. تقدر تتصل بينا أو تكتبلنا على واتساب.", "Orders are closed for now. You can call us or message us on WhatsApp."],
    ctlHideQty: ["إخفاء الكميات", "Hide quantities"], ctlHideQtyH: ["الزبون يشوف «متوفر» بدل عدد الحبات.", "Customers see “In stock” instead of how many."],
    ctlHideBr: ["إخفاء الفروع", "Hide branches"], ctlHideBrH: ["الزبون ما يشوفش أسماء الفروع وعناوينها، ويتواصل على رقم الشركة.", "Customers don’t see branch names or addresses and contact the company number."],
    ctlStaffT: ["قواعد للموظفين", "Rules for staff"], ctlNoBelow: ["منع البيع بأقل من سعر التكلفة", "No selling below cost"],
    ctlNoBelowH: ["لا بسعر أقل ولا بتخفيض يطيّح الفاتورة تحت التكلفة. انت كمالك مش داخل في القاعدة.", "Neither a lower price nor a discount that takes the invoice under cost. This doesn’t apply to you as the owner."],
    ctlLimits: ["حد التخفيض لكل موظف", "Discount limit per employee"], ctlNoLimit: ["بدون حد", "No limit"], ctlLimitIs: ["أقصى تخفيض {n}٪", "Up to {n}% off"],
    ctlNoDisc: ["ما عندهش صلاحية تخفيض", "Can’t give discounts"], ctlLimitsH: ["الحد يحسب كل اللي ينقص من سعر البيع: التخفيض على الفاتورة وتنزيل سعر القطعة.", "The limit counts everything taken off the list price: the invoice discount and lower line prices."],
    ctlStaffBtn: ["الموظفين والصلاحيات", "Staff and permissions"], ctlNoStaff: ["ما فيش موظفين بعد.", "No staff yet."],
    ctlStockT: ["المخزن", "Stock"], ctlLow: ["القطعة «قرب يخلص» لما توصل", "A part is “running low” at"], ctlLowH: ["حبات أو أقل. يبان في المخزن وفي ملخص اليوم.", "units or fewer. Shown in stock and in today’s summary."],
    ctlInvT: ["الفاتورة", "Invoice"], ctlFooter: ["كلام في آخر الفاتورة", "Text at the bottom of invoices"], ctlFooterPh: ["البضاعة المباعة ما ترجعش بعد 7 أيام. شكراً لتعاملكم معانا.", "Goods can be returned within 7 days. Thank you."],
    ctlSaved: ["تم حفظ التحكم", "Controls saved"], ctlBadLow: ["اكتب رقم من 0 لـ 1000", "Enter a number from 0 to 1000"],
    /* customers see */
    closedT: ["الطلبات مقفلة توا", "Orders are closed for now"], branchesHiddenT: ["تواصل معانا", "Contact us"],
    ctlMoved: ["إظهار الأسعار والطلبات والتسجيل صاروا في «التحكم» مع القفل والإخفاء", "Price visibility, orders and sign-up are now under Controls, with locking and hiding"],
    /* activity log */
    logIntro: ["كل حركة في المنظومة: مين عملها ووقتاش. السجل ما يتعدّلش ولا ينمسح.", "Every action in the system: who did it and when. The log can’t be edited or deleted."],
    logAll: ["الكل", "All"], logSales: ["البيع", "Sales"], logStock: ["المخزن", "Stock"], logPrices: ["الأسعار", "Prices"], logMoney: ["الفلوس", "Money"], logAdmin: ["الموظفين والإعدادات", "Staff and settings"],
    logEveryone: ["كل الناس", "Everyone"], logSearchPh: ["اسم، مورّد، أو رقم فاتورة", "Name, supplier or invoice number"], logEmpty: ["ما فيش حركات في الفترة هذي.", "Nothing in this period."],
    logToday: ["اليوم", "Today"], logYesterday: ["امس", "Yesterday"], logSystem: ["المنظومة", "The system"], logAuto: ["دخلت بروحها من صورة فاتورة", "Entered by itself from an invoice photo"],
    logMore: ["التفاصيل", "Details"], logExport: ["نزّل السجل Excel", "Download as Excel"], logCount: ["{n} حركة", "{n} entries"], logSeeAll: ["شوف السجل كامل", "See the full log"], logLatest: ["آخر الحركات", "Latest activity"],
    lk_order: ["طلب من التطبيق رقم {no}: {t}", "App order {no}: {t}"], lk_order_ready: ["جهّز الطلب {no}", "Prepared order {no}"], lk_order_done: ["سلّم الطلب {no}", "Handed over order {no}"],
    lk_order_cancelled: ["لغى الطلب {no}", "Cancelled order {no}"], lk_order_cancelled_c: ["الزبون لغى طلبه {no}", "The customer cancelled order {no}"],
    lk_invoice_sent: ["بعث الفاتورة {no} لـ {t}", "Sent invoice {no} to {t}"], lk_invoice_sent_again: ["بعث الفاتورة {no} مرة ثانية لـ {t}", "Sent invoice {no} again to {t}"],
    lk_invoice_unsent: ["رجّع الفاتورة {no} من حساب {t}", "Took invoice {no} back from {t}"], lk_customer_password: ["عطا كلمة سر جديدة لـ {t}", "Gave {t} a new password"],
    lk_sale: ["باع فاتورة {no}", "Sold invoice {no}"], lk_saleTo: ["باع فاتورة {no} لـ {t}", "Sold invoice {no} to {t}"], lk_return: ["رجّع فاتورة {no}", "Returned invoice {no}"],
    lk_receive: ["استلم بضاعة (استلام {no})", "Received stock (receipt {no})"], lk_receiveFrom: ["استلم بضاعة من {t} (استلام {no})", "Received stock from {t} (receipt {no})"],
    lk_receipt_undo: ["ألغى الاستلام {no}", "Took back receipt {no}"], lk_stockOut: ["نقّص {n} من «{t}»", "Took {n} out of “{t}”"], lk_stockIn: ["زاد {n} على «{t}»", "Added {n} to “{t}”"],
    lk_stockCount: ["جرد «{t}»: من {a} لـ {b}", "Counted “{t}”: {a} to {b}"], lk_product_add: ["أضاف قطعة «{t}»", "Added the part “{t}”"], lk_product_del: ["حذف القطعة «{t}»", "Deleted the part “{t}”"],
    lk_product_edit: ["عدّل «{t}»", "Edited “{t}”"], lk_bulk_price: ["غيّر أسعار {n}", "Changed prices of {n}"], lk_bulk_undo: ["رجّع الأسعار كيف كانت ({n})", "Put prices back ({n})"],
    lk_pay_in: ["استلم دفعة من {t}", "Payment received from {t}"], lk_pay_in_del: ["حذف دفعة {t}", "Deleted a payment of {t}"], lk_pay_out: ["دفع للمورّد {t}", "Paid the supplier {t}"],
    lk_pay_out_del: ["حذف دفعة للمورّد {t}", "Deleted a payment to {t}"], lk_expense: ["سجّل مصروف: {t}", "Expense: {t}"], lk_expense_del: ["حذف مصروف: {t}", "Deleted an expense: {t}"],
    lk_staffNew: ["أضاف الموظف {t}", "Added the employee {t}"], lk_staff: ["عدّل الموظف {t}", "Changed the employee {t}"], lk_staff_del: ["حذف الموظف {t}", "Removed the employee {t}"],
    lk_settings: ["غيّر الإعدادات: {t}", "Changed settings: {t}"], lk_customerOk: ["وافق على الزبون {t}", "Approved the customer {t}"], lk_customerNo: ["وقّف الزبون {t}", "Stopped the customer {t}"],
    lk_sync: ["منظومة المبيعات حدّثت القطع", "The sales system updated parts"], lk_import: ["رفع ملف قطع", "Uploaded a parts file"],
    lgUnits: ["{n} حبة", "{n} units"], lgDisc: ["تخفيض {m}", "{m} off"], lgOffList: ["تحت سعر البيع بـ {m}", "{m} under list prices"], lgCredit: ["آجل", "On credit"],
    lgPrice: ["السعر", "Price"], lgCost: ["التكلفة", "Cost"], lgQty: ["الكمية", "Quantity"], lgName: ["الاسم", "Name"], lgHidePrice: ["إخفاء السعر", "Price hidden"], lgStatus: ["الحالة", "Status"],
    lgYes: ["نعم", "Yes"], lgNo: ["لا", "No"], lgNew: ["{n} جديدة", "{n} new"], lgRemoved: ["انحذفت {n} قطعة جديدة كانت جايّة معاه", "{n} new parts it had made were removed"],
    lgPartsBack: ["طلعت {n} قطعة من المخزن", "{n} parts taken back out of stock"], lgStopped: ["موقوف", "Disabled"], lgActive: ["فعّال", "Active"], lgLimit: ["حد التخفيض", "Discount limit"],
    lgAdded: ["زادت: {p}", "Added: {p}"], lgRemovedP: ["نقصت: {p}", "Removed: {p}"], lgSynced: ["{a} جديدة، {u} محدّثة", "{a} new, {u} updated"], lgKept: ["{n} تغيّر سعرها من بعدها فخليناه", "{n} changed again since and were kept"],
    sk_price_mode: ["إظهار الأسعار", "Price visibility"], sk_orders_enabled: ["الطلبات", "Orders"], sk_open_signup: ["التسجيل", "Sign-up"], sk_shop_closed: ["قفل الطلبات", "Closing orders"],
    sk_closed_msg: ["رسالة القفل", "Closed message"], sk_hide_qty: ["إخفاء الكميات", "Hiding quantities"], sk_hide_branches: ["إخفاء الفروع", "Hiding branches"], sk_no_below_cost: ["البيع تحت التكلفة", "Selling below cost"],
    sk_low_stock: ["حد «قرب يخلص»", "Running-low level"], sk_invoice_footer: ["آخر الفاتورة", "Invoice footer"], sk_notice: ["الإعلان", "Notice"], sk_contact_wa: ["رقم الواتساب", "WhatsApp number"],
    sk_bot_rules: ["الرد الآلي", "Auto-reply"], sk_bot_enabled: ["الرد الآلي", "Auto-reply"], sk_bot_welcome: ["ترحيب الرد الآلي", "Auto-reply welcome"], sk_brands: ["الماركات", "Brands"], sk_brand_logos: ["شعارات الماركات", "Brand logos"], sk_ads: ["إعلانات الرئيسية", "Home screen ads"], sk_ai_customers: ["المساعد للزبائن", "Assistant for customers"],
    sk_ai_name: ["اسم المساعد", "Assistant’s name"], sk_ai_rules: ["تعليمات المساعد", "Assistant instructions"], sk_ai_daily: ["رسايل المساعد في اليوم", "Assistant messages a day"],
    sk_other: ["إعدادات الشركة", "Company settings"],
    /* bulk prices */
    bpHow: ["كيف يتغير السعر", "How prices change"], bpModePct: ["نسبة ٪", "By %"], bpModeAdd: ["مبلغ", "By amount"], bpModeMargin: ["التكلفة + ربح", "Cost + margin"],
    bpPct: ["النسبة ٪", "Percent"], bpAdd: ["المبلغ", "Amount"], bpMargin: ["نسبة الربح على التكلفة ٪", "Margin on cost %"],
    bpPctH: ["10 تزيد 10٪، و ‎-5 تنقّص 5٪.", "10 adds 10%, -5 takes off 5%."], bpAddH: ["5 تزيد 5 على كل سعر، و ‎-5 تنقّص 5.", "5 adds 5 to every price, -5 takes 5 off."],
    bpMarginH: ["سعر البيع يصير التكلفة وعليها النسبة هذي. القطع اللي ما عندهاش تكلفة ما تتغيرش.", "The price becomes the cost plus this margin. Parts without a cost don’t change."],
    bpRound: ["تقريب السعر لفوق", "Round prices up to"], bpRound0: ["بدون تقريب", "No rounding"], bpWhich: ["أي قطع", "Which parts"], bpAllBrands: ["كل الماركات", "All brands"],
    bpAllCats: ["كل الأنواع", "All categories"], bpAllBranches: ["كل الفروع", "All branches"], bpQ: ["كلمة من الاسم أو بداية رقم الصنف", "A word from the name or the start of the code"],
    bpTry: ["جرّب قبل ما تغيّر", "Preview first"], bpWill: ["حيتغير سعر {n}", "{n} will change"], bpSame: ["{n} سعرها يبقى نفسه", "{n} keep the same price"],
    bpBelow: ["{n} حيصير سعرها أقل من التكلفة", "{n} will end up below cost"], bpApply: ["غيّر الأسعار", "Change the prices"], bpApplyQ: ["تغيّر سعر {n}؟", "Change the price of {n}?"],
    bpApplyB: ["تقدر ترجّعها بعدين من «آخر التغييرات».", "You can put them back later from “Latest changes”."], bpDone: ["تغيّرت أسعار {n}", "Prices of {n} changed"],
    bpNone: ["ما فيش قطع تتغير بالاختيار هذا.", "No parts would change with this choice."], bpBadValue: ["اكتب رقم صحيح (مش صفر)", "Enter a valid number (not zero)"],
    bpLast: ["آخر التغييرات", "Latest changes"], bpUndo: ["رجّعها", "Put back"], bpUndoQ: ["ترجّع الأسعار كيف كانت قبل التغيير هذا؟", "Put the prices back as they were before this change?"],
    bpUndone: ["رجعت أسعار {n}", "{n} prices put back"], bpNoneUndo: ["التغيير هذا رجع من قبل", "This change was already put back"], bpOld: ["قبل", "Before"], bpNew: ["بعد", "After"],
    bpBy: ["بواسطة {w}", "by {w}"], bpOnly: ["القطع اللي عندها سعر بيع بس", "Only parts with a selling price"],
    /* today */
    tdT: ["اليوم", "Today"], tdSales: ["مبيعات اليوم", "Sales today"], tdProfit: ["ربح اليوم", "Profit today"], tdExp: ["مصروفات اليوم", "Expenses today"],
    tdLow: ["قطع قرب تخلص", "Parts running low"], tdOut: ["قطع خالصة", "Out of stock"], tdOwed: ["ديون على الزبائن", "Customers owe"], tdNet: ["صافي اليوم", "Net today"],
    tdInvoices: ["{n}", "{n}"]
  });

  function guard(n, title) {
    if (!S.user) { S.after = SP.here(); shell(bar(title) + `<main class="wrap">${empty('lock', t('adminOnly'), t('adminSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (!S.admin) { shell(bar(title) + `<main class="wrap">${empty('lock', t('adminOnly'), t('notAdmin'))}</main>`); return false; }
    return true;
  }
  const money = v => SP.priceText(Number(v || 0), SP.currencyOf(S.country));
  const num = v => SP.fmtNum(v);
  const parts = n => SP.count(+n || 0, 'parts');

  /* ---------- what customers see (used by the home page, part page, cart and tabs) ---------- */
  const forCustomers = () => !(S.admin || (SP.isStaff && SP.isStaff()));
  SP.hideBranches = () => !!(SP.company && S.settings && S.settings.hide_branches) && forCustomers();
  SP.shopClosed = () => !!(SP.company && S.settings && S.settings.shop_closed);
  SP.closedBanner = () => SP.shopClosed() ? `<div class="banner closed" role="status">${I('lock')}<span><b>${esc(t('closedT'))}</b><small>${esc((S.settings.closed_msg || '').trim() || t('ctlClosedDef'))}</small></span></div>` : '';
  /* branches hidden: the branch pages show how to reach the company instead */
  SP.branchesHidden = n => {
    shell(bar(t('branchesHiddenT'), '', { noBack: true }) + `<main class="wrap">${SP.contactCta ? SP.contactCta() : ''}</main>`);
    SP.done(n);
  };

  /* ---------- the log as sentences ---------- */
  const GROUP = { sale: 'sales', return: 'sales', receive: 'stock', receipt_undo: 'stock', stock: 'stock', product_add: 'stock', product_del: 'stock', sync: 'stock', import: 'stock',
    bulk_price: 'prices', bulk_undo: 'prices', pay_in: 'money', pay_in_del: 'money', pay_out: 'money', pay_out_del: 'money', expense: 'money', expense_del: 'money',
    staff: 'admin', staff_del: 'admin', settings: 'admin', customer: 'admin', ai: 'ai', order: 'sales', order_ready: 'sales', order_done: 'sales', order_cancelled: 'sales',
    invoice_sent: 'sales', invoice_unsent: 'sales', customer_password: 'admin' };
  const ICON = { sale: 'tag', return: 'undo', receive: 'receipt', receipt_undo: 'undo', stock: 'stack', product_add: 'plus', product_del: 'trash', product_edit: 'edit', sync: 'copy', import: 'download',
    bulk_price: 'percent', bulk_undo: 'undo', pay_in: 'wallet', pay_in_del: 'trash', pay_out: 'truck', pay_out_del: 'trash', expense: 'wallet', expense_del: 'trash',
    staff: 'users', staff_del: 'users', settings: 'shield', customer: 'user', ai: 'spark', order: 'bag', order_ready: 'bell', order_done: 'check', order_cancelled: 'close',
    invoice_sent: 'send', invoice_unsent: 'undo', customer_password: 'key' };
  const groupOf = x => x.kind === 'product_edit' ? (x.detail && (x.detail.price || x.detail.cost || x.detail.hide_price) ? 'prices' : 'stock') : GROUP[x.kind] || 'admin';
  const v2 = v => v == null || v === '' ? '—' : typeof v === 'boolean' ? t(v ? 'lgYes' : 'lgNo') : typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? num(+v) : String(v);
  const moneyOrDash = v => v == null ? '—' : money(v);
  const brandName = id => id ? (SP.brandName ? SP.brandName(id) : id) : '';
  function bulkText(d) {
    d = d || {};
    const how = d.mode === 'margin' ? t('bpModeMargin') + ' ' + num(d.value) + '٪' : d.mode === 'add' ? (d.value > 0 ? '+' : '−') + money(Math.abs(d.value)) : (d.value > 0 ? '+' : '−') + num(Math.abs(d.value)) + '٪';
    const where = [d.make && brandName(d.make), d.cat && SP.catName(d.cat), d.q && '«' + d.q + '»'].filter(Boolean);
    return [how].concat(where).join(' · ');
  }
  function sentence(x) {
    const d = x.detail || {}, tt = x.title || '';
    switch (x.kind) {
      case 'sale': return t(tt ? 'lk_saleTo' : 'lk_sale', { no: d.no, t: tt });
      case 'return': return t('lk_return', { no: d.no }) + (tt ? ' · ' + tt : '');
      case 'receive': return t(tt ? 'lk_receiveFrom' : 'lk_receive', { no: d.no, t: tt });
      case 'receipt_undo': return t('lk_receipt_undo', { no: d.no }) + (tt ? ' · ' + tt : '');
      case 'stock': return d.reason === 'count' ? t('lk_stockCount', { t: tt, a: num(d.from), b: num(d.to) })
        : t(d.to < d.from ? 'lk_stockOut' : 'lk_stockIn', { n: num(Math.abs(d.to - d.from)), t: tt }) + ' · ' + t('reason_' + d.reason);
      case 'bulk_price': return t('lk_bulk_price', { n: parts(d.count) }) + ' · ' + bulkText(d);
      case 'bulk_undo': return t('lk_bulk_undo', { n: parts(d.count) });
      case 'expense': case 'expense_del': return t('lk_' + x.kind, { t: t('exp_' + tt) }) + (d.note ? ' · ' + d.note : '');
      case 'staff': return t(d.new ? 'lk_staffNew' : 'lk_staff', { t: tt });
      case 'settings': {
        const keys = (d.keys || []).map(k => SP.L.T['sk_' + k] ? t('sk_' + k) : t('sk_other'));
        return t('lk_settings', { t: [...new Set(keys)].join('، ') });
      }
      case 'customer': return t(d.approved ? 'lk_customerOk' : 'lk_customerNo', { t: tt });
      case 'order': return t('lk_order', { no: d.no, t: tt });
      case 'order_ready': case 'order_done': return t('lk_' + x.kind, { no: d.no }) + (tt ? ' · ' + tt : '');
      case 'order_cancelled': return t(d.by === 'customer' ? 'lk_order_cancelled_c' : 'lk_order_cancelled', { no: d.no }) + (tt && d.by !== 'customer' ? ' · ' + tt : '');
      case 'invoice_sent': return t(d.again ? 'lk_invoice_sent_again' : 'lk_invoice_sent', { no: d.no, t: tt });
      case 'invoice_unsent': return t('lk_invoice_unsent', { no: d.no, t: tt || '—' });
      default: return SP.L.T['lk_' + x.kind] ? t('lk_' + x.kind, { t: tt }) : x.kind;
    }
  }
  /* the small facts under the sentence */
  function facts(x) {
    const d = x.detail || {}, f = [];
    if (x.kind === 'sale') { if (d.units) f.push(t('lgUnits', { n: num(d.units) })); if (+d.discount) f.push(t('lgDisc', { m: money(d.discount) })); if (+d.off_list) f.push(t('lgOffList', { m: money(d.off_list) })); if (d.payment === 'credit') f.push(t('lgCredit')); }
    if (x.kind === 'receive') { if (d.units) f.push(t('lgUnits', { n: num(d.units) })); if (d.new) f.push(t('lgNew', { n: num(d.new) })); if (d.auto) f.push(t('logAuto')); }
    if (x.kind === 'receipt_undo') { if (d.parts) f.push(t('lgPartsBack', { n: num(d.parts) })); if (d.removed) f.push(t('lgRemoved', { n: num(d.removed) })); }
    if (x.kind === 'bulk_undo' && d.kept) f.push(t('lgKept', { n: num(d.kept) }));
    if ((x.kind === 'sync' || x.kind === 'import') && d) f.push(t('lgSynced', { a: num(d.inserted || 0), u: num(d.updated || 0) }));
    if ((x.kind === 'pay_in' || x.kind === 'pay_out' || x.kind.endsWith('_del')) && d.note && !x.kind.startsWith('expense')) f.push(d.note);
    if (x.kind === 'stock' && d.note) f.push(d.note);
    if (x.kind === 'ai' && d.ask) f.push('«' + d.ask + '»');
    if (x.kind === 'order') { if (d.units) f.push(t('lgUnits', { n: num(d.units) })); f.push(t(d.delivery === 'delivery' ? 'ordDelivery' : 'ordPickup')); }
    if (x.kind === 'order_done' && d.payment) f.push(t('pay_' + d.payment));
    if (x.kind === 'order_cancelled' && d.reason) f.push(d.reason);
    return f;
  }
  /* what opens under "details": the lines of a receipt, old → new values, permissions */
  function more(x) {
    const d = x.detail || {};
    if ((x.kind === 'receive' || x.kind === 'receipt_undo') && Array.isArray(d.lines) && d.lines.length)
      return `<table class="inv-items log-lines"><tbody>${d.lines.map(([title, q, c]) => `<tr><td>${esc(title)}</td><td class="num">× ${esc(num(q))}</td><td class="num">${c != null ? esc(money(c)) : ''}</td></tr>`).join('')}</tbody></table>`;
    if (x.kind === 'product_edit') {
      const L = [['price', 'lgPrice', moneyOrDash], ['cost', 'lgCost', moneyOrDash], ['qty', 'lgQty', v2], ['title', 'lgName', v2], ['hide_price', 'lgHidePrice', v2], ['status', 'lgStatus', v => v === 'sold' ? t('soldOut') : t('inStock')]];
      return `<dl class="log-ch">${L.filter(([k]) => d[k]).map(([k, l, f]) => `<div><dt>${esc(t(l))}</dt><dd><bdi>${esc(f(d[k][0]))}</bdi> ← <bdi><b>${esc(f(d[k][1]))}</b></bdi></dd></div>`).join('')}</dl>`;
    }
    if (x.kind === 'settings' && d.changes) {
      const rows = Object.keys(d.changes).filter(k => SP.L.T['sk_' + k]).map(k => { const [a, b] = d.changes[k], f = k === 'price_mode' ? (v => t('pm_' + v)) : v2;
        return `<div><dt>${esc(t('sk_' + k))}</dt><dd><bdi>${esc(f(a))}</bdi> ← <bdi><b>${esc(f(b))}</b></bdi></dd></div>`; });
      return rows.length ? `<dl class="log-ch">${rows.join('')}</dl>` : '';
    }
    if (x.kind === 'staff' || x.kind === 'staff_del') {
      const w = d.was || {}, now = d.perms || [], before = w.perms || [], add = now.filter(p => !before.includes(p)), rem = before.filter(p => !now.includes(p)), rows = [];
      if (d.new || x.kind === 'staff_del') rows.push(`<div><dt>${esc(t('staffPerms'))}</dt><dd>${esc(now.map(p => t('perm_' + p)).join('، ') || '—')}</dd></div>`);
      else {
        if (add.length) rows.push(`<div><dt>${esc(t('staffPerms'))}</dt><dd>${esc(t('lgAdded', { p: add.map(p => t('perm_' + p)).join('، ') }))}</dd></div>`);
        if (rem.length) rows.push(`<div><dt>${esc(t('staffPerms'))}</dt><dd>${esc(t('lgRemovedP', { p: rem.map(p => t('perm_' + p)).join('، ') }))}</dd></div>`);
        if (w.active !== undefined && w.active !== d.active) rows.push(`<div><dt>${esc(t('lgStatus'))}</dt><dd>${esc(t(w.active ? 'lgActive' : 'lgStopped'))} ← <b>${esc(t(d.active ? 'lgActive' : 'lgStopped'))}</b></dd></div>`);
      }
      /* the AI assistant given, taken, or what it may do changed */
      const aiTxt = (on, ps) => on ? (ps && ps.length ? ps.map(p => t('perm_' + p)).join('، ') : t('aiSetStaffAsk')) : t('aiSetStaffOff');
      if (d.ai_on !== undefined && (d.new ? d.ai_on : (w.ai_on !== undefined && (w.ai_on !== d.ai_on || JSON.stringify(w.ai_perms || []) !== JSON.stringify(d.ai_perms || [])))))
        rows.push(`<div><dt>${esc(t('aiStaffT'))}</dt><dd>${d.new ? '' : esc(aiTxt(w.ai_on, w.ai_perms)) + ' ← '}<b>${esc(aiTxt(d.ai_on, d.ai_perms))}</b></dd></div>`);
      const lim = v => v == null ? t('ctlNoLimit') : num(v) + '٪';
      if (d.new ? d.max_discount != null : (w.max_discount !== undefined && String(w.max_discount) !== String(d.max_discount))) rows.push(`<div><dt>${esc(t('lgLimit'))}</dt><dd>${d.new ? '' : esc(lim(w.max_discount)) + ' ← '}<b>${esc(lim(d.max_discount))}</b></dd></div>`);
      return rows.length ? `<dl class="log-ch">${rows.join('')}</dl>` : '';
    }
    return '';
  }
  const timeOf = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { hour: 'numeric', minute: '2-digit' }).format(new Date(v)); } catch (e) { return String(v).slice(11, 16); } };
  const dayKey = v => { const d = new Date(v); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
  function dayLabel(v) {
    const d = new Date(v), today = new Date(), y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (dayKey(d) === dayKey(today)) return t('logToday');
    if (dayKey(d) === dayKey(y)) return t('logYesterday');
    try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); } catch (e) { return String(v).slice(0, 10); }
  }
  function logRow(x, compact) {
    const g = groupOf(x), extra = compact ? '' : more(x), fs = facts(x), by = x.actor_id ? BK.who(x.actor_name) : t('logSystem');
    const out = /_del$|undo|return/.test(x.kind) || +x.amount < 0;
    const amount = x.amount != null && !['product_edit', 'customer', 'staff'].includes(x.kind) ? `<b class="num log-amt${out ? ' neg' : ''}">${+x.amount < 0 ? '− ' : ''}${esc(money(Math.abs(+x.amount)))}</b>` : '';
    const head = `<span class="log-ic g-${g}">${I(ICON[x.kind] || 'info')}</span><span class="ar-main"><b>${esc(sentence(x))}</b>
      <small>${[by, timeOf(x.created_at)].concat(fs).filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span>${amount}`;
    return extra ? `<details class="log-row"><summary class="arow">${head}</summary><div class="log-more">${extra}</div></details>` : `<div class="arow log-row">${head}</div>`;
  }
  SP.logRow = logRow;

  /* ---------- the activity log ---------- */
  const GROUPS = [['', 'logAll'], ['sales', 'logSales'], ['stock', 'logStock'], ['prices', 'logPrices'], ['money', 'logMoney'], ['admin', 'logAdmin'], ['ai', 'logAi']];
  const RANGES = [['today', 'rangeToday'], ['7', 'range7'], ['month', 'rangeMonth'], ['all', 'rangeAll']];
  SP.route(/^admin-log$/, async (m, n) => {
    if (gate(n) || !guard(n, t('logT'))) return;
    const f = S.logF = S.logF || { g: '', r: '7', who: '', q: '' };
    shell(bar(t('logT')) + `<main class="wrap mine">${SP.adminTabs('admin-log')}<p class="hint">${esc(t('logIntro'))}</p>
      <div class="chips light" id="lgg">${GROUPS.map(([k, l]) => `<button type="button" class="chip${f.g === k ? ' on' : ''}" data-g="${k}">${esc(t(l))}</button>`).join('')}</div>
      <div class="chips light" id="lgr">${RANGES.map(([k, l]) => `<button type="button" class="chip${f.r === k ? ' on' : ''}" data-r="${k}">${esc(t(l))}</button>`).join('')}</div>
      <div class="row2 log-filters"><select id="lgw" class="input" aria-label="${esc(t('logEveryone'))}">${opt('', t('logEveryone'), f.who)}</select>
        <form class="searchbox flat" id="lgq" role="search">${I('search')}<input type="search" value="${esc(f.q)}" placeholder="${esc(t('logSearchPh'))}" aria-label="${esc(t('search'))}"></form></div>
      <div class="res-head"><span class="rcount" id="lgc"></span><button type="button" class="btn btn-ghost sm" id="lgx">${I('download')} ${esc(t('logExport'))}</button></div>
      <div id="lgl" class="log-list"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    $('#lgg').onclick = e => { const b = e.target.closest('[data-g]'); if (b) { f.g = b.dataset.g; SP.render(); } };
    $('#lgr').onclick = e => { const b = e.target.closest('[data-r]'); if (b) { f.r = b.dataset.r; SP.render(); } };
    $('#lgw').onchange = e => { f.who = e.target.value; SP.render(); };
    $('#lgq').onsubmit = e => { e.preventDefault(); f.q = $('#lgq input').value.trim(); SP.render(); };
    const [from, to] = BK.span(f.r);
    const args = (off, lim) => ({ p_group: f.g || null, p_actor: f.who || null, p_from: f.r === 'all' ? null : from.toISOString(), p_to: f.r === 'all' ? null : to.toISOString(),
      p_q: f.q || null, p_limit: lim || 50, p_offset: off });
    /* the log as it is filtered, to open in Excel */
    $('#lgx').onclick = async () => {
      const b = $('#lgx'); b.classList.add('busy');
      try {
        const all = [];
        for (let off = 0; off < 5000; off += 100) { const r = await rpc('list_activity', args(off, 100)); all.push(...r.items); if (r.items.length < 100) break; }
        const cell = v => { const x = v == null ? '' : String(v); return /[",\n;]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
        const rows = ['date,time,person,action,details,amount'].concat(all.map(x => { const d = new Date(x.created_at);
          return [BK.dayText(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')), timeOf(x.created_at),
            x.actor_id ? x.actor_name : t('logSystem'), sentence(x), facts(x).join(' · '), x.amount].map(cell).join(','); }));
        await SP.saveFile('activity-' + new Date().toISOString().slice(0, 10) + '.csv', rows.join('\r\n'));
      } catch (e) { SP.toast(SP.errText(e)); } finally { b.classList.remove('busy'); }
    };
    let last = '';
    await SP.pager(n, $('#lgl'), $('#more'), async off => {
      const r = await rpc('list_activity', args(off));
      if (!off) {
        $('#lgc').textContent = t('logCount', { n: num(+r.total || 0) });
        last = '';
        const ws = r.actors || [];
        $('#lgw').innerHTML = opt('', t('logEveryone'), f.who) + ws.map(a => opt(a.id, BK.who(a.name) + ' (' + num(a.count) + ')', f.who)).join('');
      }
      return { items: r.items, total: +r.total || 0 };
    }, list => list.map(x => { const k = dayKey(x.created_at), h = k !== last ? `<h3 class="log-day">${esc(dayLabel(x.created_at))}</h3>` : ''; last = k; return h + logRow(x); }).join(''),
    (r, first) => { if (first && !r.total) $('#lgl').innerHTML = empty('history', t('logEmpty')); });
    SP.done(n);
  });

  /* ---------- controls: customers, staff rules, running low, invoice footer ---------- */
  SP.route(/^admin-control$/, async (m, n) => {
    if (gate(n) || !guard(n, t('ctlT'))) return;
    const st = S.settings || {}, mode = st.price_mode || 'all';
    shell(bar(t('ctlT')) + `<main class="wrap mine">${SP.adminTabs('admin-control')}<form class="form" id="ctf" novalidate>
      <section class="mcard"><h2 class="lbl">${esc(t('ctlCustT'))}</h2><p class="hint">${esc(t('ctlCustB'))}</p>
        <label class="switch"><input type="checkbox" id="kcl"${st.shop_closed ? ' checked' : ''}><span></span>${esc(t('ctlClosed'))}</label>
        <div class="field" id="kcmw"${st.shop_closed ? '' : ' hidden'}><label for="kcm">${esc(t('ctlClosedMsg'))}</label><input id="kcm" class="input" maxlength="300" value="${esc(st.closed_msg || '')}" placeholder="${esc(t('ctlClosedPh'))}"></div>
        <label class="switch"><input type="checkbox" id="kor"${st.orders_enabled ? ' checked' : ''}><span></span>${esc(t('ordersL'))}</label>
        <label class="switch"><input type="checkbox" id="khq"${st.hide_qty ? ' checked' : ''}><span></span>${esc(t('ctlHideQty'))}</label><span class="hint">${esc(t('ctlHideQtyH'))}</span>
        <label class="switch"><input type="checkbox" id="khb"${st.hide_branches ? ' checked' : ''}><span></span>${esc(t('ctlHideBr'))}</label><span class="hint">${esc(t('ctlHideBrH'))}</span>
        <p class="lbl optg">${esc(t('priceModeL'))}</p><div class="radios" id="cpm">${['all', 'members', 'approved', 'hidden'].map(k => `<label class="radio"><input type="radio" name="pm" value="${k}"${mode === k ? ' checked' : ''}><span>${esc(t('pm_' + k))}</span></label>`).join('')}</div>
        <span class="hint">${esc(t('pmHint'))}</span>
        <label class="switch"><input type="checkbox" id="csu"${st.open_signup !== false ? ' checked' : ''}><span></span>${esc(t('signupL'))}</label><span class="hint">${esc(t('signupHint'))}</span></section>
      <section class="mcard"><h2 class="lbl">${esc(t('ctlStaffT'))}</h2>
        <label class="switch"><input type="checkbox" id="knb"${st.no_below_cost ? ' checked' : ''}><span></span>${esc(t('ctlNoBelow'))}</label><span class="hint">${esc(t('ctlNoBelowH'))}</span>
        <p class="lbl optg">${esc(t('ctlLimits'))}</p><div id="kst"><div class="sk sk-row"></div></div><span class="hint">${esc(t('ctlLimitsH'))}</span>
        <div class="form-actions"><a class="btn btn-ghost sm" href="#staff">${I('users')} ${esc(t('ctlStaffBtn'))}</a></div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('ctlStockT'))}</h2>
        <div class="field"><label for="klw">${esc(t('ctlLow'))}</label><div class="inrow low-row"><input id="klw" class="input num" inputmode="numeric" dir="ltr" maxlength="4" value="${esc(st.low_stock == null ? 3 : st.low_stock)}"><span class="hint">${esc(t('ctlLowH'))}</span></div></div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('ctlInvT'))}</h2>
        <div class="field"><label for="kft">${esc(t('ctlFooter'))}</label><textarea id="kft" class="input" maxlength="300" rows="2" placeholder="${esc(t('ctlFooterPh'))}">${esc(st.invoice_footer || '')}</textarea></div></section>
      <p class="form-err" id="kerr" role="alert"></p><button class="btn btn-signal block" id="kgo">${I('check')} ${esc(t('saveSettings'))}</button></form></main>`);
    $('#kcl').onchange = e => { $('#kcmw').hidden = !e.target.checked; };
    /* each employee and their discount limit (set in the staff sheet) */
    sb().from('staff').select('*').order('created_at', { ascending: true }).then(r => {
      if (!SP.alive(n) || !$('#kst')) return;
      const list = (r && r.data) || [];
      $('#kst').innerHTML = list.length ? list.map(v => `<a class="arow" href="#staff"><span class="hexav"><span>${esc(SP.initial(v.name || v.email))}</span></span><span class="ar-main"><b>${esc(v.name || v.email)}</b>
        <small>${esc(!(v.perms || []).includes('discounts') && !(v.perms || []).includes('prices') ? t('ctlNoDisc') : v.max_discount == null ? t('ctlNoLimit') : t('ctlLimitIs', { n: num(+v.max_discount) }))}</small></span>${I('chevL', 'dirx')}</a>`).join('')
        : `<p class="muted-p">${esc(t('ctlNoStaff'))}</p>`;
    });
    $('#ctf').onsubmit = async e => {
      e.preventDefault();
      const low = BK.amountOf($('#klw').value);
      if (!Number.isInteger(low) || low < 0 || low > 1000) { $('#kerr').textContent = t('ctlBadLow'); $('#klw').classList.add('invalid'); $('#klw').focus(); return; }
      const v = { shop_closed: $('#kcl').checked, closed_msg: $('#kcm').value.trim(), orders_enabled: $('#kor').checked, hide_qty: $('#khq').checked, hide_branches: $('#khb').checked,
        price_mode: ($('#cpm input:checked') || {}).value || 'all', open_signup: $('#csu').checked, no_below_cost: $('#knb').checked, low_stock: low, invoice_footer: $('#kft').value.trim() };
      const b = $('#kgo'); b.classList.add('busy');
      try { await SP.api.saveSettings(v); SP.toast(t('ctlSaved')); SP.render(); } catch (x) { $('#kerr').textContent = SP.errText(x); } finally { b.classList.remove('busy'); }
    };
    SP.done(n);
  });

  /* ---------- prices in bulk ---------- */
  const ROUNDS = [0, 0.25, 0.5, 1, 5, 10];
  function bpErr(e) {
    const m = String((e && e.message) || '');
    if (/bad value/.test(m)) return t('bpBadValue');
    if (/nothing to change/.test(m)) return t('bpNone');
    if (/nothing to undo/.test(m)) return t('bpNoneUndo');
    if (/not authorized/.test(m)) return t('errPerm');
    return SP.errText(e);
  }
  SP.route(/^admin-prices$/, async (m, n) => {
    if (gate(n) || !guard(n, t('bpT'))) return;
    const f = S.bpF = S.bpF || { mode: 'pct', value: '', round: 0, make: '', cat: '', shop: '', q: '' };
    const brands = (SP.brandsList ? SP.brandsList() : D.BRANDS).slice().sort((a, b) => SP.brandName(a.id).localeCompare(SP.brandName(b.id), SP.LANG));
    shell(bar(t('bpT')) + `<main class="wrap mine">${SP.adminTabs('admin-prices')}<form class="form mcard" id="bpf" novalidate>
      <h2 class="lbl">${esc(t('bpHow'))}</h2>
      <div class="seg" role="radiogroup" aria-label="${esc(t('bpHow'))}">${[['pct', 'bpModePct'], ['add', 'bpModeAdd'], ['margin', 'bpModeMargin']].map(([k, l], i) =>
        `<input type="radio" name="bpm" id="bpm${i}" value="${k}"${f.mode === k ? ' checked' : ''}><label for="bpm${i}">${esc(t(l))}</label>`).join('')}</div>
      <div class="row2"><div class="field"><label for="bpv" id="bpvl"></label><input id="bpv" class="input num" dir="ltr" inputmode="decimal" maxlength="9" autocomplete="off" value="${esc(f.value)}"></div>
        <div class="field"><label for="bpr">${esc(t('bpRound'))}</label><select id="bpr" class="input">${ROUNDS.map(r => opt(String(r), r ? num(r) : t('bpRound0'), String(f.round))).join('')}</select></div></div>
      <span class="hint" id="bph"></span>
      <h2 class="lbl">${esc(t('bpWhich'))}</h2>
      <div class="row2"><div class="field"><label for="bpb" class="sr">${esc(t('bpAllBrands'))}</label><select id="bpb" class="input">${opt('', t('bpAllBrands'), f.make)}${brands.map(b => opt(b.id, SP.brandName(b.id), f.make)).join('')}</select></div>
        <div class="field"><label for="bpc" class="sr">${esc(t('bpAllCats'))}</label><select id="bpc" class="input">${opt('', t('bpAllCats'), f.cat)}${D.CATS.map(c => opt(c.id, SP.catName(c.id), f.cat)).join('')}</select></div></div>
      <div class="row2"><div class="field"><label for="bps" class="sr">${esc(t('bpAllBranches'))}</label><select id="bps" class="input">${opt('', t('bpAllBranches'), f.shop)}</select></div>
        <div class="field"><label for="bpq" class="sr">${esc(t('bpQ'))}</label><input id="bpq" class="input" maxlength="60" value="${esc(f.q)}" placeholder="${esc(t('bpQ'))}"></div></div>
      <p class="form-err" id="bperr" role="alert"></p>
      <div class="form-actions"><button class="btn btn-ink" id="bptry">${I('search')} ${esc(t('bpTry'))}</button></div></form>
      <div id="bpres" aria-live="polite"></div><section id="bpold"></section></main>`);
    const label = () => { const md = ($('input[name=bpm]:checked') || {}).value || 'pct';
      $('#bpvl').textContent = t(md === 'add' ? 'bpAdd' : md === 'margin' ? 'bpMargin' : 'bpPct'); $('#bph').textContent = t(md === 'add' ? 'bpAddH' : md === 'margin' ? 'bpMarginH' : 'bpPctH'); };
    label();
    SP.api.shops({ p_limit: 100 }).then(r => { if (SP.alive(n) && $('#bps')) $('#bps').innerHTML = opt('', t('bpAllBranches'), f.shop) + r.items.map(s => opt(s.id, s.name, f.shop)).join(''); }).catch(() => {});
    const read = () => {
      const raw = SP.digits($('#bpv').value).replace(/[٫,]/g, '.').replace(/\s/g, '').replace(/[−–]/g, '-');
      Object.assign(f, { mode: ($('input[name=bpm]:checked') || {}).value || 'pct', value: $('#bpv').value.trim(), round: +$('#bpr').value, make: $('#bpb').value, cat: $('#bpc').value, shop: $('#bps').value, q: $('#bpq').value.trim() });
      const v = raw === '' ? NaN : Number(raw);
      return { mode: f.mode, value: v, round: f.round, make: f.make || null, cat: f.cat || null, shop: f.shop || null, q: f.q || null };
    };
    $$('input[name=bpm]').forEach(x => { x.onchange = () => { label(); $('#bpres').innerHTML = ''; }; });
    ['#bpv', '#bpr', '#bpb', '#bpc', '#bps', '#bpq'].forEach(id => { $(id).addEventListener('input', () => { $('#bpres').innerHTML = ''; $('#bperr').textContent = ''; }); });
    const cur = SP.currencyOf(S.country);
    $('#bpf').onsubmit = async e => {
      e.preventDefault();
      const p = read(), err = $('#bperr');
      err.textContent = '';
      if (!isFinite(p.value) || p.value === 0 || (p.mode === 'margin' && p.value < 0) || (p.mode === 'pct' && p.value <= -100)) { err.textContent = t('bpBadValue'); $('#bpv').classList.add('invalid'); $('#bpv').focus(); return; }
      $('#bpv').classList.remove('invalid');
      const b = $('#bptry'); b.classList.add('busy');
      try {
        const r = await rpc('bulk_price', { p: { ...p, dry: true } });
        if (!SP.alive(n)) return;
        $('#bpres').innerHTML = !r.count ? `<div class="banner note">${I('info')}<span>${esc(t('bpNone'))}</span></div>` : `<section class="mcard bp-res">
          <p class="bp-will"><b>${esc(t('bpWill', { n: parts(r.count) }))}</b>${r.same ? `<small>${esc(t('bpSame', { n: parts(r.same) }))}</small>` : ''}</p>
          ${r.below ? `<div class="banner warn">${I('warn')}<span>${esc(t('bpBelow', { n: parts(r.below) }))}</span></div>` : ''}
          <table class="inv-items bp-sample"><thead><tr><th>${esc(t('invItem'))}</th><th>${esc(t('bpOld'))}</th><th>${esc(t('bpNew'))}</th></tr></thead><tbody>
            ${r.sample.map(x => `<tr><td>${esc(x.title)}</td><td class="num">${esc(SP.priceText(+x.old, cur))}</td><td class="num"><b>${esc(SP.priceText(+x.new, cur))}</b></td></tr>`).join('')}</tbody></table>
          <div class="form-actions"><button type="button" class="btn btn-signal" id="bpgo">${I('check')} ${esc(t('bpApply'))}</button></div></section>`;
        if ($('#bpgo')) $('#bpgo').onclick = async () => {
          if (!await SP.confirmSheet({ title: t('bpApplyQ', { n: parts(r.count) }), body: t('bpApplyB'), ok: t('bpApply') })) return;
          const g = $('#bpgo'); if (g) g.classList.add('busy');
          try { const x = await rpc('bulk_price', { p }); SP.toast(t('bpDone', { n: parts(x.count) })); $('#bpres').innerHTML = ''; batches(); }
          catch (y) { if (g) g.classList.remove('busy'); SP.toast(bpErr(y)); }
        };
      } catch (x) { err.textContent = bpErr(x); } finally { b.classList.remove('busy'); }
    };
    /* the last changes, each can be put back once */
    async function batches() {
      let list = [];
      try { list = await rpc('price_batches') || []; } catch (e) { list = []; }
      if (!SP.alive(n) || !$('#bpold')) return;
      $('#bpold').innerHTML = list.length ? `<h2 class="lbl">${esc(t('bpLast'))}</h2>${list.map(x => `<div class="arow"><span class="log-ic g-prices">${I('percent')}</span><span class="ar-main"><b>${esc(bulkText(x.detail || {}))}</b>
          <small>${[parts(x.count), x.by && t('bpBy', { w: BK.who(x.by) }), x.created_at && BK.when(x.created_at)].filter(Boolean).map(v => `<bdi>${esc(v)}</bdi>`).join(' · ')}</small></span>
          <button type="button" class="btn btn-ghost sm" data-undo="${esc(x.batch)}">${I('undo')} ${esc(t('bpUndo'))}</button></div>`).join('')}` : '';
    }
    $('#bpold').onclick = async e => {
      const b = e.target.closest('[data-undo]');
      if (!b || !await SP.confirmSheet({ title: t('bpUndoQ'), ok: t('bpUndo'), danger: true })) return;
      b.classList.add('busy');
      try { const r = await rpc('undo_bulk_price', { p_batch: +b.dataset.undo }); SP.toast(t('bpUndone', { n: parts(r.count) }) + (r.kept ? ' · ' + t('lgKept', { n: num(r.kept) }) : ''), 5000); batches(); }
      catch (x) { b.classList.remove('busy'); SP.toast(bpErr(x)); }
    };
    batches();
    SP.done(n);
  });

  /* ---------- today, on the main admin tab ---------- */
  /* compact (the system tab): the numbers only, without the latest activity */
  SP.adminToday = async (el, n, o) => {
    if (!el || !SP.company) return;
    const compact = !!(o && o.compact);
    el.innerHTML = `<section class="mcard today"><h2 class="lbl">${esc(t('tdT'))}</h2><div class="astats">${'<div class="sk" style="height:74px"></div>'.repeat(4)}</div></section>`;
    const [from, to] = BK.span('today');
    const [p, s, l] = await Promise.all([
      rpc('pnl_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: BK.tz() }).catch(() => null),
      rpc('stock_report', { p_limit: 1 }).catch(() => null),
      compact ? null : rpc('list_activity', { p_limit: 6 }).catch(() => null)]);
    if (!SP.alive(n) || !el.isConnected) return;
    const sum = (s && s.summary) || {}, stat = (k, v, href, cls, f) => `<a class="astat${cls ? ' ' + cls : ''}" href="#${href}"${f ? ` data-stk="${f}"` : ''}><b class="num">${esc(v)}</b><small>${esc(t(k))}</small></a>`;
    el.innerHTML = `<section class="mcard today"><h2 class="lbl">${esc(t('tdT'))}</h2><div class="astats">
        ${p ? stat('tdSales', money(p.sales), 'invoices') + stat('tdProfit', money(p.gross), 'pnl') + stat('tdExp', money(p.expenses), 'expenses') : ''}
        ${s ? stat('tdLow', num(sum.low || 0), 'stock', sum.low ? 'warnstat' : '', 'low') + (sum.out ? stat('tdOut', num(sum.out), 'stock', 'warnstat', 'out') : '') : ''}
        ${p && +p.receivable ? stat('tdOwed', money(p.receivable), 'buyers') : ''}</div>
      ${l && l.items && l.items.length ? `<p class="lbl optg">${esc(t('logLatest'))}</p><div class="log-list">${l.items.map(x => logRow(x, true)).join('')}</div>
        <div class="form-actions"><a class="btn btn-ghost sm" href="#admin-log">${I('history')} ${esc(t('logSeeAll'))}</a></div>` : ''}</section>`;
    /* the low / out tiles open the stock list on that filter */
    $$('[data-stk]', el).forEach(a => { a.onclick = () => { S.stkF = a.dataset.stk; }; });
  };
})();
