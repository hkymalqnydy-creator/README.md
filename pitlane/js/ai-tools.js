/* The AI assistant's tools (js/ai.js runs them): what it can look up and do in the app, each with the permission it needs.
   A tool that changes something never changes it here: it puts a card in the chat and the person taps «نفّذ» to do it
   (js/ai.js runs it then, through the same database functions as the screens, with the person's own permissions).
   Also here: the app guide the assistant answers "how do I…" from, and the on-device helper used when no AI is reachable. */
(function () {
  'use strict';
  const SP = window.SP;
  const { t, S } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a));
  const cur = () => SP.currencyOf(S.country);
  const money = (n, c) => SP.priceText(Number(n || 0), c || cur());
  const num = n => SP.fmtNum(Number(n || 0));
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Tripoli'; } catch (e) { return 'Africa/Tripoli'; } };
  const dayStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const posNum = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

  Object.assign(SP.L.T, {
    aiPer_today: ["اليوم", "today"], aiPer_yesterday: ["امس", "yesterday"], aiPer_week: ["آخر 7 أيام", "the last 7 days"], aiPer_month: ["هالشهر", "this month"],
    aiPer_last_month: ["الشهر اللي فات", "last month"], aiPer_year: ["هالسنة", "this year"],
    aiPSale: ["فاتورة بيع", "Sale"], aiPReturn: ["ترجيع فاتورة رقم {n}", "Return invoice no. {n}"], aiPStock: ["تعديل كمية", "Change stock"], aiPPrice: ["تغيير سعر", "Change a price"],
    aiPBulk: ["تغيير الأسعار بالجملة", "Change prices in bulk"], aiPRecv: ["فاتورة شراء", "Purchase invoice"], aiPPay: ["دفعة من زبون", "Payment from a customer"],
    aiPSupPay: ["دفعة لمورّد", "Payment to a supplier"], aiPExp: ["مصروف", "Expense"], aiPShop: ["إعدادات المحل", "Shop settings"], aiPAd: ["إعلان جديد في الرئيسية", "New home screen ad"],
    aiGoSell: ["نفّذ البيع", "Make the sale"], aiGoDo: ["نفّذ", "Do it"], aiGoReturn: ["نفّذ الترجيع", "Return it"], aiEditPos: ["عدّلها في نقطة البيع", "Edit in point of sale"],
    aiRCustomer: ["الزبون", "Customer"], aiRPay: ["الدفع", "Payment"], aiRPaid: ["المدفوع توا", "Paid now"], aiRDisc: ["تخفيض", "Discount"], aiRTotal: ["المجموع", "Total"], aiRNote: ["ملاحظة", "Note"],
    aiRQty: ["الكمية", "Quantity"], aiRWhy: ["السبب", "Reason"], aiRPrice: ["السعر", "Price"], aiROwes: ["عليه توا", "Owes now"], aiRAfter: ["يقعد عليه", "Left to pay"], aiRAmount: ["المبلغ", "Amount"],
    aiRSupplier: ["المورّد", "Supplier"], aiRCat: ["النوع", "Category"], aiRDate: ["التاريخ", "Date"], aiROrders: ["الطلبات", "Orders"], aiRNotice: ["تنبيه للزبائن", "Notice to customers"],
    aiRParts: ["القطع", "Parts"], aiRWill: ["يتغير سعر {n}", "{n} will change"], aiROpen: ["مفتوحة", "Open"], aiRClosed: ["مقفولة", "Closed"], aiRNone: ["بدون", "None"],
    aiNew: ["جديدة", "new"], aiItems: ["{n} قطعة", "{n} items"],
    aiDSold: ["تمت الفاتورة رقم {n} بـ {m}", "Invoice no. {n} done, {m}"], aiDReturned: ["ترجعت الفاتورة رقم {n} والقطع رجعت للمخزن", "Invoice no. {n} returned; the parts are back in stock"],
    aiDStock: ["الكمية توا {n}", "Stock is now {n}"], aiDPrice: ["السعر توا {m}", "The price is now {m}"], aiDBulk: ["تغير سعر {n} قطعة. تقدر ترجعها من «الأسعار»", "{n} prices changed. You can undo it in Prices"],
    aiDRecv: ["تحفظت فاتورة الشراء رقم {n}: {u} قطعة زادت و{a} جديدة", "Purchase invoice {n}: {u} updated, {a} new"], aiDPay: ["تسجلت الدفعة", "Payment recorded"],
    aiDExp: ["تسجل المصروف", "Expense recorded"], aiDShop: ["تحفظت الإعدادات", "Settings saved"], aiDAd: ["الإعلان طلع في الرئيسية", "The ad is on the home screen"],
    aiLOpenInv: ["افتح الفاتورة", "Open the invoice"], aiLOpenPart: ["افتح القطعة", "Open the part"], aiLOpenCust: ["افتح حساب الزبون", "Open the customer"], aiLOpenRecv: ["افتح فاتورة الشراء", "Open the purchase invoice"],
    aiLHome: ["شوف الرئيسية", "See the home screen"], aiLCart: ["افتح السلة", "Open the cart"], aiLPrices: ["افتح الأسعار", "Open Prices"],
    aiSRep: ["المبيعات: {p}", "Sales: {p}"], aiSInv: ["فواتير", "Invoices"], aiSSum: ["المبيعات", "Sales"], aiSCredit: ["دين", "On credit"], aiSRet: ["مرجّعة", "Returned"],
    aiSProfit: ["الربح", "Profit"], aiSTop: ["الأكثر بيعاً", "Best sellers"], aiSPnl: ["الأرباح والخسائر: {p}", "Profit and loss: {p}"], aiSCogs: ["تكلفة البضاعة", "Cost of goods"],
    aiSGross: ["الربح قبل المصروفات", "Gross profit"], aiSExp: ["المصروفات", "Expenses"], aiSNet: ["الصافي", "Net"], aiSStock: ["المخزن", "Stock"], aiSParts: ["أصناف", "Parts"],
    aiSUnits: ["قطع", "Units"], aiSLow: ["ناقصة", "Low"], aiSOut: ["خالصة", "Out"], aiSValue: ["قيمتها بسعر البيع", "Value at selling price"], aiSValueCost: ["قيمتها بالتكلفة", "Value at cost"],
    aiSOwing: ["عليهم ديون: {n} بمجموع {m}", "{n} owe {m} in total"], aiSSupOwing: ["ليهم عليك: {n} بمجموع {m}", "You owe {n} suppliers {m}"],
    aiSExpT: ["المصروفات: {p}", "Expenses: {p}"], aiSLog: ["آخر الحركات", "Latest activity"], aiSInvT: ["الفواتير", "Invoices"], aiSStockT: ["المخزن", "Stock"],
    aiStatusRet: ["مرجّعة", "returned"], aiOwes: ["عليه {m}", "owes {m}"], aiOwed: ["ليه {m}", "owed {m}"], aiInStock: ["في المخزن: {n}", "In stock: {n}"], aiAvail: ["متوفرة", "Available"], aiNoStock: ["خالصة", "Out of stock"],
    aiWStock: ["المخزن فيه {n} بس من «{t}»", "Only {n} of “{t}” in stock"], aiWBelow: ["أقل من التكلفة ({m})", "Below cost ({m})"], aiWBelowN: ["{n} قطعة يطلع سعرها أقل من التكلفة", "{n} would sell below cost"],
    aiReason_count: ["جرد", "Count"], aiReason_damaged: ["تالف", "Damaged"], aiReason_lost: ["ضايع", "Lost"], aiReason_other: ["أخرى", "Other"],
    aiPay_cash: ["كاش", "Cash"], aiPay_card: ["بطاقة", "Card"], aiPay_transfer: ["تحويل", "Transfer"], aiPay_credit: ["دين", "On credit"]
  });

  /* ---------- periods ---------- */
  const PERIODS = ['today', 'yesterday', 'week', 'month', 'last_month', 'year'];
  function span(p) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
    const day0 = new Date(y, m, dd), end = new Date(y, m, dd + 1);
    switch (p) {
      case 'yesterday': return [new Date(y, m, dd - 1), day0];
      case 'week': return [new Date(y, m, dd - 6), end];
      case 'month': return [new Date(y, m, 1), end];
      case 'last_month': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
      case 'year': return [new Date(y, 0, 1), end];
      default: return [day0, end];
    }
  }
  const period = v => PERIODS.includes(v) ? v : 'today';

  /* ---------- permissions: what the assistant may do for this person ---------- */
  const ALL = ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings', 'warehouse'];
  SP.aiPerms = () => S.admin ? ALL.slice() : (S.perms && S.perms.ai && Array.isArray(S.perms.ai_perms) ? S.perms.ai_perms.filter(p => (S.perms.perms || []).includes(p)) : []);
  SP.aiStaff = () => !!(S.admin || (S.perms && S.perms.staff && S.perms.ai));
  SP.aiAllowed = perm => {
    if (!perm) return true;
    if (perm === 'admin') return !!S.admin;
    if (perm === 'staff') return SP.aiStaff();
    const mine = SP.aiPerms();
    if (Array.isArray(perm)) return perm.some(p => mine.includes(p));
    if (perm.all) return perm.all.every(p => mine.includes(p));
    return mine.includes(perm);
  };

  /* ---------- the tools ---------- */
  const TOOLS = [];
  const tool = o => TOOLS.push(o);
  const str = (d, more) => Object.assign({ type: 'string', description: d }, more || {});
  const int = (d, more) => Object.assign({ type: 'integer', description: d }, more || {});
  const numb = (d, more) => Object.assign({ type: 'number', description: d }, more || {});
  const per = { type: 'string', enum: PERIODS, description: 'today, yesterday, week (last 7 days), month (this month), last_month, year' };
  const partCard = (p, staff) => ({
    id: p.id, title: p.title, img: p.imgs && p.imgs[0] || '', cat: p.cat, code: p.sku || p.part_no || '', fits: SP.fitText ? SP.fitText(p) : '',
    price: p.price_hidden ? null : p.price, hidden: !!p.price_hidden, cur: (p.shop && p.shop.currency) || cur(),
    qty: staff || !(S.settings && S.settings.hide_qty) ? p.qty : null, staff: !!staff
  });
  const partFact = (p, staff) => ({
    id: p.id, title: p.title, code: p.sku || p.part_no || '', maker: p.maker || '', fits: SP.fitText ? SP.fitText(p) : '', condition: p.cond,
    price: p.price_hidden ? 'hidden (' + (S.user ? 'not shown to this customer' : 'sign in to see') + ')' : p.price, currency: (p.shop && p.shop.currency) || cur(),
    stock: staff ? p.qty : p.qty == null ? 'ask' : p.qty > 0 ? 'available' : 'out of stock', branch: p.shop && p.shop.name
  });
  const getPart = async id => {
    if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) throw Object.assign(new Error('part not found'), { code: 'P0001' });
    const p = await SP.api.product(id);
    if (!p) throw Object.assign(new Error('part not found'), { code: 'P0001' });
    return p;
  };

  /* ----- for everyone who has the assistant ----- */
  tool({
    name: 'find_parts', perm: null,
    desc: 'Search the shop\'s spare parts by words (part name, part number, barcode, car) and/or car make, model and year. Returns up to 8 parts with price and stock, and shows them as cards the person can tap.',
    props: { query: str('words to search, in the user\'s words: part name and/or number, e.g. "فحمات باترول" or "58101-1RA00"'), make: str('car make id, e.g. toyota, nissan, hyundai, kia'),
      model: str('car model, e.g. Patrol'), year: int('car year'), limit: int('how many, 1-8') },
    async run(a, ctx) {
      const staff = SP.aiStaff(), f = { ...SP.FDEF, q: clip(a.query, 80), make: clip(a.make, 30).toLowerCase(), model: clip(a.model, 40), year: a.year ? String(a.year) : '' };
      const extra = staff ? { p_country: null, p_city: null, p_include_sold: true } : {};
      let r = await SP.api.search({ ...SP.searchArgs(f, { limit: Math.min(Math.max(+a.limit || 6, 1), 8) }), ...extra });
      if (!r.total && f.model && f.q) r = await SP.api.search({ ...SP.searchArgs({ ...f, model: '' }, { limit: 6 }), ...extra });
      if (r.items.length) ctx.card({ type: 'parts', items: r.items.map(p => partCard(p, staff)), q: f.q });
      return { total: r.total, parts: r.items.map(p => partFact(p, staff)) };
    }
  });
  tool({
    name: 'part_details', perm: null,
    desc: 'Everything about one part by its id (from find_parts): description, fitting cars, price, stock, branch.',
    props: { id: str('the part id') }, req: ['id'],
    async run(a, ctx) {
      const p = await getPart(a.id), staff = SP.aiStaff();
      ctx.card({ type: 'parts', items: [partCard(p, staff)] });
      return { ...partFact(p, staff), description: clip(p.descr, 600), make: p.make, model: p.model, years: [p.y_from, p.y_to] };
    }
  });
  tool({
    name: 'add_to_cart', perm: null, company: true, customer: true,
    desc: 'Put a part in the customer\'s order basket. The customer then confirms the order in the basket (#cart) in the app: it goes to the company\'s system «قيد التجهيز» (no WhatsApp). Use for customers who want to order.',
    props: { id: str('the part id'), qty: int('how many, default 1') }, req: ['id'],
    async run(a, ctx) {
      const p = await getPart(a.id), n = Math.min(Math.max(parseInt(a.qty, 10) || 1, 1), 99);
      SP.cart.add(p.id, n);
      ctx.card({ type: 'done', text: t('aiCartAdded', { n, t: p.title }), links: [{ href: '#cart', label: t('aiLCart') }] });
      return { in_cart: SP.cart.count(), added: { title: p.title, qty: n } };
    }
  });
  /* ----- customer orders from the app (js/orders.js) ----- */
  const OPAYS = ['cash', 'card', 'transfer', 'credit'];
  const OST = { preparing: 'ordPreparing', ready: 'ordReady', done: 'ordDone', cancelled: 'ordCancelled' };
  const orderRow = o => ({ t: t('ordNo', { n: o.no }) + ' · ' + (o.customer_name || ''), s: [t(OST[o.status] || 'ordPreparing'), SP.count(+o.units || (o.items || []).reduce((k, i) => k + (+i.qty || 0), 0), 'parts'),
    t(o.delivery === 'delivery' ? 'ordDelivery' : 'ordPickup')].join(' · '), v: o.total != null ? money(o.total, o.currency) : '', href: '#order-' + o.id });
  const orderFact = o => ({ id: o.id, no: o.no, status: o.status, customer: o.customer_name, phone: o.customer_phone, delivery: o.delivery, address: o.address || undefined, total: o.total, units: o.units, ordered: dayStr(new Date(o.ordered_at)) });
  tool({
    name: 'find_orders', perm: ['sales', 'invoices'], company: true,
    desc: 'The customers\' orders placed in the app. status: open (preparing and ready, the default), preparing («قيد التجهيز»), ready («قيد الاستلام»), done (received) or cancelled. Or one order by its number.',
    props: { status: { type: 'string', enum: ['open', 'preparing', 'ready', 'done', 'cancelled'] }, number: int('an order number') },
    async run(a, ctx) {
      if (a.number) {
        const r = await SP.orders.list('all', 0, 100), o = (r.items || []).find(x => +x.no === +a.number);
        if (!o) return { error: 'no order with that number' };
        ctx.card({ type: 'list', title: t('ordNo', { n: o.no }), rows: [orderRow(o)] });
        return { order: orderFact(o) };
      }
      const st = a.status && a.status !== 'open' ? a.status : '', r = await SP.orders.list(st, 0, 20), c = r.counts || {};
      ctx.card({ type: 'list', title: t('ordT') + ' · ' + t(st ? OST[st] : 'ordOpen') + ' (' + num(r.total) + ')', rows: (r.items || []).slice(0, 10).map(orderRow), more: r.total > 10 ? { href: '#orders', label: t('aiMore') } : null });
      return { preparing: +c.preparing || 0, ready: +c.ready || 0, shown: (r.items || []).slice(0, 20).map(orderFact) };
    }
  });
  tool({
    name: 'order_status', perm: 'sales', company: true,
    desc: 'Move a customer order on: ready («قيد الاستلام»: prepared, waiting to be received), done («تم الاستلام»: received; it becomes a sale, with how the customer paid), or cancelled (the parts go back to stock). Prepares a card to confirm.',
    props: { number: int('the order number'), to: { type: 'string', enum: ['ready', 'done', 'cancelled'] }, payment: { type: 'string', enum: OPAYS, description: 'for done: how the customer paid (default cash)' }, reason: str('for cancelled: why') },
    req: ['number', 'to'],
    async run(a, ctx) {
      const r = await SP.orders.list('', 0, 100), o = (r.items || []).find(x => +x.no === +a.number);
      if (!o) return { error: 'no open order with that number (only orders being prepared or ready can move on)' };
      if (a.to === 'ready' && o.status !== 'preparing') return { error: 'this order is already ready' };
      const pay = OPAYS.includes(a.payment) ? a.payment : 'cash', reason = clip(a.reason, 200);
      ctx.propose({
        title: t(a.to === 'ready' ? 'ordToReady' : a.to === 'done' ? 'ordToDone' : 'ordCancel') + ' · ' + t('ordNo', { n: o.no }), tool: 'order_status',
        go: t(a.to === 'ready' ? 'ordToReady' : a.to === 'done' ? 'ordToDone' : 'ordCancel'),
        rows: [[t('ordCustomer'), o.customer_name], [t('ordWhere'), t(o.delivery === 'delivery' ? 'ordDelivery' : 'ordPickup')], [t('ordItems'), SP.count(+o.units || 0, 'parts')],
          ...(a.to === 'done' ? [[t('posPay'), t('pay_' + pay)]] : []), ...(a.to === 'cancelled' && reason ? [[t('ordCancelReason'), reason]] : [])],
        total: [t('ordTotal'), money(o.total, o.currency)],
        warn: a.to === 'cancelled' ? [t('ordCancelQ', { n: o.no })] : [],
        alt: { label: t('ordOpenOrder'), run: () => '#order-' + o.id },
        async run() {
          const v = await SP.orders.set(o.id, a.to, a.to === 'done' ? pay : null, a.to === 'cancelled' ? reason : null);
          const text = a.to === 'ready' ? t('ordReadyOk', { n: o.no }) : a.to === 'done' ? t('ordDoneOk', { n: v.no }) : t('ordCancelOk');
          return { text, links: [{ href: '#order-' + o.id, label: t('ordOpenOrder') }], what: text, ref: String(o.no) };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, order: orderFact(o), to: a.to };
    }
  });
  tool({
    name: 'my_orders', perm: null, company: true, mine: true,
    desc: 'The signed-in customer\'s own orders and where each stands: «قيد التجهيز» (being prepared), «قيد الاستلام» (ready), «تم الاستلام» (received) or «ملغي» (cancelled).',
    props: {},
    async run(a, ctx) {
      const L = await SP.orders.mine();
      if (!L.length) return { orders: [], note: 'no orders yet: add parts to the basket and confirm the order there (#cart)' };
      ctx.card({ type: 'list', title: t('ordMine'), rows: L.slice(0, 8).map(o => ({ t: t('ordNo', { n: o.no }), s: t(OST[o.status] || 'ordPreparing') + ' · ' + dayStr(new Date(o.ordered_at)), v: o.total != null ? money(o.total, o.currency) : '', href: '#order-' + o.id })),
        more: { href: '#my-orders', label: t('aiMore') } });
      return { orders: L.slice(0, 10).map(o => ({ no: o.no, status: o.status, ordered: dayStr(new Date(o.ordered_at)), delivery: o.delivery, total: o.total, items: (o.items || []).map(i => i.title + ' × ' + i.qty) })) };
    }
  });
  const PAGES = {
    home: [''], search: ['search'], cart: ['cart', null, true], vin: ['vin'], branches: ['shops'], favorites: ['favs'], account: ['mine'], brands: ['brands'], about: ['about', null, true],
    system: ['system', 'staff'], pos: ['pos', 'sales'], receive: ['receive', 'purchases'], invoices: ['invoices', ['sales', 'invoices']], purchases: ['purchases', ['purchases', 'reports']],
    reports: ['reports', 'reports'], stock: ['stock', ['products', 'purchases', 'reports']], customers: ['buyers', ['invoices', 'reports']], suppliers: ['suppliers', 'costs'],
    expenses: ['expenses', ['expenses', 'reports']], profit: ['pnl', { all: ['reports', 'costs'] }], staff: ['staff', 'admin'], admin: ['admin', 'admin'],
    controls: ['admin-control', 'admin'], activity: ['admin-log', 'admin'], bulk_prices: ['admin-prices', 'admin'], ads: ['admin-ads', 'admin'], company_settings: ['admin-company', 'admin'],
    customer_approvals: ['admin-customers', 'admin'], auto_reply: ['admin-bot', 'admin'], sync: ['admin-sync', 'admin'], assistant_settings: ['admin-ai', 'admin'],
    orders: ['orders', ['sales', 'invoices'], true], my_orders: ['my-orders', null, true], lookup: ['lookup', 'staff'], shops: ['mshops', null, true],
    picks: ['picks', 'warehouse']
  };
  tool({
    name: 'open_page', perm: null,
    desc: 'Open a page of the app for the person (the chat stays one tap away). page: ' + Object.keys(PAGES).join(', ') + ', part (with id), invoice (with id), purchase (a purchase invoice, with id), brand (with id like toyota), customer (with key). For search, give query.',
    props: { page: str('which page'), id: str('for part, invoice, purchase, brand or customer'), query: str('for search: the words') }, req: ['page'],
    async run(a, ctx) {
      const pg = String(a.page || ''), id = clip(a.id, 120);
      let hash = null;
      if (pg === 'part' && /^[0-9a-f-]{36}$/i.test(id)) hash = 'p-' + id;
      else if (pg === 'invoice' && /^[0-9a-f-]{36}$/i.test(id) && SP.aiAllowed(['sales', 'invoices'])) hash = 'inv-' + id;
      else if (pg === 'purchase' && /^[0-9a-f-]{36}$/i.test(id) && SP.aiAllowed(['purchases', 'reports'])) hash = 'pur-' + id;
      else if (pg === 'brand' && SP.BRAND.has(id)) hash = 'b-' + id;
      else if (pg === 'customer' && id && SP.aiAllowed(['invoices', 'reports'])) hash = 'buyer-' + encodeURIComponent(id);
      else if (pg === 'search') { S.f = { ...SP.FDEF, q: clip(a.query, 80) }; hash = 'search'; }
      else if (PAGES[pg] && SP.aiAllowed(PAGES[pg][1]) && (!PAGES[pg][2] || SP.company)) hash = PAGES[pg][0];
      if (hash == null) return { opened: false, reason: 'not a page this person can open' };
      ctx.open(hash);
      return { opened: true, page: pg };
    }
  });

  /* ----- sales ----- */
  const PAYS = ['cash', 'card', 'transfer', 'credit'];
  tool({
    name: 'prepare_sale', perm: 'sales',
    desc: 'Prepare a sale invoice (point of sale) for parts by their ids from find_parts, with quantities, optional customer name/phone, payment (cash, card, transfer, credit) and discount. Shows a card; the sale is made only when the person taps to confirm.',
    props: {
      items: { type: 'array', description: 'the parts to sell', items: { type: 'object', properties: { id: str('part id'), qty: int('how many'), price: numb('a different unit price (only if the person asked for it)') }, required: ['id', 'qty'] } },
      customer_name: str('customer name'), customer_phone: str('customer phone'), payment: { type: 'string', enum: PAYS }, paid: numb('for credit: what is paid now'),
      discount: numb('amount off the whole invoice'), note: str('a note on the invoice')
    }, req: ['items'],
    async run(a, ctx) {
      const lines = [];
      for (const it of (Array.isArray(a.items) ? a.items : []).slice(0, 20)) {
        const p = await getPart(it.id), qty = Math.min(Math.max(parseInt(it.qty, 10) || 1, 1), 9999);
        const own = it.price != null && SP.can('prices') && posNum(it.price) >= 0 ? posNum(it.price) : null;
        const price = own != null ? own : p.price;
        if (price == null) return { error: 'this part has no price: ' + p.title + '. Ask the person for the price, or open the point of sale.' };
        lines.push({ id: p.id, title: p.title, sku: p.sku || p.part_no || '', qty, price, base: p.price, own: own != null, stock: p.qty, cur: (p.shop && p.shop.currency) || cur() });
      }
      if (!lines.length) return { error: 'no parts given' };
      const c = lines[0].cur, sub = lines.reduce((k, l) => k + l.price * l.qty, 0);
      const disc = SP.can('discounts') ? Math.min(Math.max(posNum(a.discount) || 0, 0), sub) : 0, total = Math.round((sub - disc) * 100) / 100;
      const pay = PAYS.includes(a.payment) ? a.payment : 'cash', paid = pay === 'credit' ? Math.min(Math.max(posNum(a.paid) || 0, 0), total) : null;
      const name = clip(a.customer_name, 80), phone = clip(a.customer_phone, 30), note = clip(a.note, 300);
      const warn = lines.filter(l => l.stock != null && l.stock < l.qty).map(l => t('aiWStock', { n: num(l.stock), t: l.title }));
      const rows = lines.map(l => [l.title + ' × ' + num(l.qty), money(l.price * l.qty, c)]);
      if (disc) rows.push([t('aiRDisc'), '− ' + money(disc, c)]);
      if (name || phone) rows.push([t('aiRCustomer'), [name, phone].filter(Boolean).join(' · ')]);
      rows.push([t('aiRPay'), t('aiPay_' + pay) + (paid != null ? ' · ' + t('aiRPaid') + ' ' + money(paid, c) : '')]);
      if (note) rows.push([t('aiRNote'), note]);
      ctx.propose({
        title: t('aiPSale'), rows, total: [t('aiRTotal'), money(total, c)], warn, tool: 'prepare_sale', go: t('aiGoSell'),
        alt: { label: t('aiEditPos'), run: () => { SP.posLoad(lines, { cname: name, cphone: phone, pay, discount: disc || '', paid: paid != null ? paid : '', note }); return '#pos'; } },
        async run() {
          const inv = await rpc('create_invoice', { p: { branch: (S.perms && S.perms.branch) || null, payment: pay, discount: disc, paid, customer_name: name, customer_phone: phone, note,
            items: lines.map(l => ({ id: l.id, qty: l.qty, price: l.own ? l.price : undefined })) } });
          return { text: t('aiDSold', { n: inv.no, m: money(inv.total, inv.currency || c) }), links: [{ href: '#inv-' + inv.id, label: t('aiLOpenInv') }], what: t('aiLogSale', { n: inv.no, m: money(inv.total, inv.currency || c) }), ref: String(inv.no) };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, total, currency: c, lines: lines.length, stock_warnings: warn };
    }
  });
  tool({
    name: 'find_invoices', perm: ['sales', 'invoices'],
    desc: 'List sale invoices: by invoice number, customer name or phone (query), and/or a period. Shows them as a list.',
    props: { query: str('invoice number, customer name or phone'), period: per },
    async run(a, ctx) {
      const [from, to] = a.period ? span(period(a.period)) : [null, null];
      const rows = await rpc('list_invoices', { p_from: from && from.toISOString(), p_to: to && to.toISOString(), p_branch: null, p_q: clip(a.query, 60) || null, p_limit: 8, p_offset: 0 }) || [];
      if (rows.length) ctx.card({ type: 'list', title: t('aiSInvT'), rows: rows.map(x => ({ t: '#' + x.no + (x.customer_name ? ' · ' + x.customer_name : ''), s: when(x.created_at) + (x.status === 'returned' ? ' · ' + t('aiStatusRet') : ''), v: money(x.total, x.currency), href: '#inv-' + x.id })) });
      return { count: rows.length ? +rows[0].total_count : 0, invoices: rows.map(x => ({ id: x.id, no: x.no, date: x.created_at, customer: x.customer_name, total: x.total, payment: x.payment, status: x.status, items: x.items_count })) };
    }
  });
  tool({
    name: 'return_invoice', perm: 'returns',
    desc: 'Prepare returning a whole sale invoice by its number (the parts go back to stock). Shows a card to confirm.',
    props: { number: int('the invoice number') }, req: ['number'],
    async run(a, ctx) {
      const no = parseInt(a.number, 10);
      if (!(no > 0)) return { error: 'give the invoice number' };
      const rows = await rpc('list_invoices', { p_from: null, p_to: null, p_branch: null, p_q: String(no), p_limit: 5, p_offset: 0 }) || [];
      const inv = rows.find(x => +x.no === no);
      if (!inv) return { error: 'no invoice with this number' };
      if (inv.status === 'returned') return { error: 'this invoice was already returned' };
      ctx.propose({
        title: t('aiPReturn', { n: no }), tool: 'return_invoice', go: t('aiGoReturn'),
        rows: [[t('aiRDate'), when(inv.created_at)], ...(inv.customer_name ? [[t('aiRCustomer'), inv.customer_name]] : []), [t('aiRParts'), t('aiItems', { n: num(inv.items_count) })]],
        total: [t('aiRTotal'), money(inv.total, inv.currency)],
        async run() {
          await rpc('return_invoice', { p_id: inv.id });
          return { text: t('aiDReturned', { n: no }), links: [{ href: '#inv-' + inv.id, label: t('aiLOpenInv') }], what: t('aiLogReturn', { n: no }), ref: String(no) };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, invoice: { no, total: inv.total, customer: inv.customer_name } };
    }
  });

  /* ----- numbers ----- */
  tool({
    name: 'sales_report', perm: 'reports',
    desc: 'Sales for a period: number of invoices, total, discounts, on credit, returns, best sellers, by employee; and profit when the person may see costs.',
    props: { period: per },
    async run(a, ctx) {
      const pr = period(a.period), [from, to] = span(pr);
      const r = await rpc('sales_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: tz() }) || {};
      const rows = [[t('aiSInv'), num(r.count)], [t('aiSSum'), money(r.total)]];
      if (+r.discount) rows.push([t('aiRDisc'), money(r.discount)]);
      if (+r.credit) rows.push([t('aiSCredit'), money(r.credit)]);
      if (+r.returned) rows.push([t('aiSRet'), num(r.returned)]);
      if (r.profit != null) rows.push([t('aiSProfit'), money(r.profit)]);
      const top = (r.top || []).slice(0, 3);
      ctx.card({ type: 'stats', title: t('aiSRep', { p: t('aiPer_' + pr) }), rows, foot: top.length ? t('aiSTop') + ': ' + top.map(x => x.title + ' (' + num(x.qty) + ')').join('، ') : '', href: '#reports' });
      return { period: pr, invoices: r.count, total: r.total, discount: r.discount, credit: r.credit, returned: r.returned, profit: r.profit, currency: cur(), top: top, by_staff: (r.by_staff || []).slice(0, 5) };
    }
  });
  tool({
    name: 'profit_report', perm: { all: ['reports', 'costs'] },
    desc: 'Profit and loss for a period: sales, cost of goods, gross profit, expenses and net.',
    props: { period: per },
    async run(a, ctx) {
      const pr = period(a.period), [from, to] = span(pr);
      const r = await rpc('pnl_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: tz() }) || {};
      ctx.card({ type: 'stats', title: t('aiSPnl', { p: t('aiPer_' + pr) }), href: '#pnl',
        rows: [[t('aiSSum'), money(r.sales)], [t('aiSCogs'), money(r.cogs)], [t('aiSGross'), money(r.gross)], [t('aiSExp'), money(r.expenses)], [t('aiSNet'), money(r.net)]] });
      return { period: pr, sales: r.sales, cost_of_goods: r.cogs, gross: r.gross, expenses: r.expenses, net: r.net, cost_missing: r.cost_missing, currency: cur() };
    }
  });
  tool({
    name: 'stock_status', perm: ['products', 'purchases', 'reports'],
    desc: 'Stock: totals (parts, units, low, out, value) and a list, filtered by words and/or low (running out) or out (none left).',
    props: { query: str('words, part number or barcode'), filter: { type: 'string', enum: ['all', 'low', 'out'] } },
    async run(a, ctx) {
      const f = ['low', 'out'].includes(a.filter) ? a.filter : 'all';
      const r = await rpc('stock_report', { p_q: clip(a.query, 60) || null, p_filter: f, p_limit: 8, p_offset: 0 }) || {}, s = r.summary || {};
      const rows = [[t('aiSParts'), num(s.parts)], [t('aiSUnits'), num(s.units)], [t('aiSLow'), num(s.low)], [t('aiSOut'), num(s.out)], [t('aiSValue'), money(s.value_price)]];
      if (s.value_cost != null) rows.push([t('aiSValueCost'), money(s.value_cost)]);
      if (f === 'all' && !a.query) ctx.card({ type: 'stats', title: t('aiSStock'), rows, href: '#stock' });
      const items = r.items || [];
      if (items.length && (f !== 'all' || a.query)) ctx.card({ type: 'list', title: t('aiSStockT'), rows: items.map(x => ({ t: x.title, s: [x.sku || x.part_no, x.branch_name].filter(Boolean).join(' · '), v: t('aiInStock', { n: num(x.qty) }), href: '#p-' + x.id })), more: { href: '#stock', label: t('aiSStock') } });
      return { summary: s, matching: r.total, items: items.map(x => ({ id: x.id, title: x.title, code: x.sku || x.part_no, maker: x.maker || '', qty: x.qty, price: x.price, cost: x.cost })) };
    }
  });
  tool({
    name: 'find_customers', perm: ['invoices', 'reports'],
    desc: 'Customers from the sale invoices with what they owe: by name or phone, or only those who owe money.',
    props: { query: str('name or phone'), owing: { type: 'boolean', description: 'only customers who owe money' } },
    async run(a, ctx) {
      const r = await rpc('list_buyers', { p_q: clip(a.query, 60) || null, p_owing: !!a.owing, p_limit: 8, p_offset: 0 }) || {};
      const items = r.items || [];
      if (items.length) ctx.card({ type: 'list', title: t('aiSOwing', { n: num(r.owing_count), m: money(r.owing_total) }), rows: items.map(x => ({ t: x.name || x.phone, s: x.phone && x.name ? x.phone : '', v: +x.balance > 0 ? t('aiOwes', { m: money(x.balance) }) : '', href: '#buyer-' + encodeURIComponent(x.key) })), more: { href: '#buyers', label: t('aiLOpenCust') } });
      return { owing_total: r.owing_total, owing_count: r.owing_count, matching: r.total, customers: items.map(x => ({ key: x.key, name: x.name, phone: x.phone, invoices: x.count, balance: x.balance })) };
    }
  });
  tool({
    name: 'record_customer_payment', perm: 'invoices',
    desc: 'Prepare recording money a customer paid toward what they owe (find them by name or phone). Shows a card to confirm.',
    props: { customer: str('the customer name or phone'), amount: numb('the amount paid'), note: str('a note') }, req: ['customer', 'amount'],
    async run(a, ctx) {
      const amt = posNum(a.amount);
      if (!(amt > 0)) return { error: 'give the amount' };
      const r = await rpc('list_buyers', { p_q: clip(a.customer, 60), p_owing: false, p_limit: 6, p_offset: 0 }) || {}, items = r.items || [];
      const exact = items.filter(x => SP.norm(x.name) === SP.norm(a.customer) || (x.phone && x.phone.replace(/\D/g, '').endsWith(String(a.customer).replace(/\D/g, '').slice(-9)) && String(a.customer).replace(/\D/g, '').length >= 7));
      const pick = exact.length === 1 ? exact[0] : items.length === 1 ? items[0] : null;
      if (!pick) return items.length ? { need: 'which customer', options: items.map(x => ({ name: x.name, phone: x.phone, balance: x.balance })) } : { error: 'no customer with this name or phone in the invoices' };
      const bal = +pick.balance || 0, note = clip(a.note, 300);
      ctx.propose({
        title: t('aiPPay'), tool: 'record_customer_payment', go: t('aiGoDo'),
        rows: [[t('aiRCustomer'), pick.name || pick.phone], [t('aiROwes'), money(bal)], [t('aiRAfter'), money(Math.max(bal - amt, 0))], ...(note ? [[t('aiRNote'), note]] : [])],
        total: [t('aiRAmount'), money(amt)],
        async run() {
          await rpc('add_customer_payment', { p_key: pick.key, p_amount: amt, p_note: note });
          return { text: t('aiDPay'), links: [{ href: '#buyer-' + encodeURIComponent(pick.key), label: t('aiLOpenCust') }], what: t('aiLogPay', { m: money(amt), t: pick.name || pick.phone }), ref: pick.key };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, customer: pick.name, owes: bal };
    }
  });
  tool({
    name: 'find_suppliers', perm: 'costs',
    desc: 'Suppliers and what is owed to them: by name, or only those still owed money.',
    props: { query: str('supplier name'), owing: { type: 'boolean', description: 'only suppliers still owed money' } },
    async run(a, ctx) {
      const r = await rpc('list_suppliers', { p_q: clip(a.query, 60) || null, p_owing: !!a.owing, p_limit: 8, p_offset: 0 }) || {};
      const items = r.items || [];
      if (items.length) ctx.card({ type: 'list', title: t('aiSSupOwing', { n: num(r.owing_count), m: money(r.owing_total) }), rows: items.map(x => ({ t: x.name, s: '', v: +x.balance > 0 ? t('aiOwed', { m: money(x.balance) }) : '', href: '#supplier-' + encodeURIComponent(x.key) })), more: { href: '#suppliers', label: t('supT') } });
      return { owing_total: r.owing_total, owing_count: r.owing_count, suppliers: items.map(x => ({ key: x.key, name: x.name, balance: x.balance })) };
    }
  });
  tool({
    name: 'record_supplier_payment', perm: { all: ['costs', 'purchases'] },
    desc: 'Prepare recording money paid to a supplier (find them by name). Shows a card to confirm.',
    props: { supplier: str('the supplier name'), amount: numb('the amount paid'), note: str('a note') }, req: ['supplier', 'amount'],
    async run(a, ctx) {
      const amt = posNum(a.amount);
      if (!(amt > 0)) return { error: 'give the amount' };
      const r = await rpc('list_suppliers', { p_q: clip(a.supplier, 60), p_owing: false, p_limit: 6, p_offset: 0 }) || {}, items = r.items || [];
      const exact = items.filter(x => SP.norm(x.name) === SP.norm(a.supplier)), pick = exact.length === 1 ? exact[0] : items.length === 1 ? items[0] : null;
      if (!pick) return items.length ? { need: 'which supplier', options: items.map(x => ({ name: x.name, balance: x.balance })) } : { error: 'no supplier with this name in the receipts' };
      const bal = +pick.balance || 0, note = clip(a.note, 300);
      ctx.propose({
        title: t('aiPSupPay'), tool: 'record_supplier_payment', go: t('aiGoDo'),
        rows: [[t('aiRSupplier'), pick.name], [t('aiROwes'), money(bal)], [t('aiRAfter'), money(Math.max(bal - amt, 0))], ...(note ? [[t('aiRNote'), note]] : [])],
        total: [t('aiRAmount'), money(amt)],
        async run() {
          await rpc('add_supplier_payment', { p_key: pick.key, p_amount: amt, p_note: note });
          return { text: t('aiDPay'), links: [{ href: '#supplier-' + encodeURIComponent(pick.key), label: t('supT') }], what: t('aiLogSupPay', { m: money(amt), t: pick.name }), ref: pick.key };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, supplier: pick.name, owed: bal };
    }
  });
  const EXP = ['rent', 'salaries', 'utilities', 'transport', 'maintenance', 'other'];
  tool({
    name: 'record_expense', perm: 'expenses',
    desc: 'Prepare recording an expense: category (rent, salaries, utilities, transport, maintenance, other), amount, note, date. Shows a card to confirm.',
    props: { category: { type: 'string', enum: EXP }, amount: numb('the amount'), note: str('what it was for'), date: str('YYYY-MM-DD, default today') }, req: ['amount'],
    async run(a, ctx) {
      const amt = posNum(a.amount);
      if (!(amt > 0)) return { error: 'give the amount' };
      const cat = EXP.includes(a.category) ? a.category : 'other', day = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : dayStr(new Date()), note = clip(a.note, 300);
      ctx.propose({
        title: t('aiPExp'), tool: 'record_expense', go: t('aiGoDo'),
        rows: [[t('aiRCat'), t('exp_' + cat)], [t('aiRDate'), day], ...(note ? [[t('aiRNote'), note]] : [])], total: [t('aiRAmount'), money(amt)],
        async run() {
          await rpc('add_expense', { p: { cat, amount: amt, spent_on: day, note } });
          return { text: t('aiDExp'), links: [{ href: '#expenses', label: t('aiSExp') }], what: t('aiLogExp', { m: money(amt), t: t('exp_' + cat) }), ref: '' };
        }
      });
      return { prepared: true, waiting_for_confirmation: true };
    }
  });
  tool({
    name: 'expenses_report', perm: ['expenses', 'reports'],
    desc: 'Expenses for a period: the total and the latest ones.',
    props: { period: per },
    async run(a, ctx) {
      const pr = period(a.period), [from, to] = span(pr);
      const r = await rpc('list_expenses', { p_from: dayStr(from), p_to: dayStr(new Date(to.getTime() - 864e5)), p_limit: 8, p_offset: 0 }) || {};
      const items = r.items || [];
      ctx.card({ type: 'list', title: t('aiSExpT', { p: t('aiPer_' + pr) }) + ' · ' + money(r.sum), rows: items.map(x => ({ t: t('exp_' + x.cat), s: [x.note, x.spent_on].filter(Boolean).join(' · '), v: money(x.amount) })), more: { href: '#expenses', label: t('aiSExp') } });
      return { period: pr, total: r.sum, count: r.total, latest: items.map(x => ({ category: x.cat, amount: x.amount, note: x.note, date: x.spent_on })) };
    }
  });

  /* ----- stock and prices ----- */
  const REASONS = ['count', 'damaged', 'lost', 'other'];
  tool({
    name: 'change_stock', perm: 'products',
    desc: 'Prepare changing a part\'s stock quantity: add (a positive or negative number) or set (the counted number), with a reason (count, damaged, lost, other). Shows a card to confirm. For goods bought from a supplier use receive_stock instead.',
    props: { id: str('the part id'), add: int('units to add (negative to take out)'), set: int('the new quantity after counting'), reason: { type: 'string', enum: REASONS }, note: str('a note') }, req: ['id'],
    async run(a, ctx) {
      const p = await getPart(a.id), old = +p.qty || 0;
      const set = a.set != null && Number.isInteger(+a.set) ? +a.set : null, add = a.add != null && Number.isInteger(+a.add) ? +a.add : null;
      if (set == null && !add) return { error: 'give how many to add or the counted quantity' };
      const now = set != null ? set : old + add;
      if (now < 0) return { error: 'stock cannot go below zero (there are ' + old + ')' };
      if (now === old) return { error: 'nothing changes: the stock is already ' + old };
      const reason = REASONS.includes(a.reason) ? a.reason : set != null ? 'count' : 'other', note = clip(a.note, 300);
      ctx.propose({
        title: t('aiPStock') + ': ' + p.title, tool: 'change_stock', go: t('aiGoDo'),
        rows: [[t('aiRQty'), num(old) + ' ← ' + num(now)], [t('aiRWhy'), t('aiReason_' + reason)], ...(note ? [[t('aiRNote'), note]] : [])],
        async run() {
          const r = await rpc('adjust_stock', { p: set != null ? { id: p.id, set: now, reason, note } : { id: p.id, delta: now - old, reason, note } });
          return { text: t('aiDStock', { n: num(r.qty) }), links: [{ href: '#p-' + p.id, label: t('aiLOpenPart') }], what: t('aiLogStock', { t: p.title, a: num(old), b: num(r.qty) }), ref: p.id };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, part: p.title, from: old, to: now };
    }
  });
  tool({
    name: 'set_price', perm: 'products',
    desc: 'Prepare changing one part\'s selling price. Shows a card to confirm.',
    props: { id: str('the part id'), price: numb('the new selling price') }, req: ['id', 'price'],
    async run(a, ctx) {
      const p = await getPart(a.id), price = posNum(a.price);
      if (!(price >= 0) || price > 99999999) return { error: 'give a valid price' };
      if (p.price != null && +p.price === price) return { error: 'the price is already ' + price };
      const c = (p.shop && p.shop.currency) || cur(), below = p.cost != null && price < +p.cost;
      ctx.propose({
        title: t('aiPPrice') + ': ' + p.title, tool: 'set_price', go: t('aiGoDo'), warn: below ? [t('aiWBelow', { m: money(p.cost, c) })] : [],
        rows: [[t('aiRPrice'), (p.price != null ? money(p.price, c) : '—') + ' ← ' + money(price, c)]],
        async run() {
          const r = chk(await sb().from('products').update({ price }).eq('id', p.id).select('id, price').single());
          S.pcache && S.pcache.delete && S.pcache.delete(p.id);
          return { text: t('aiDPrice', { m: money(r.price, c) }), links: [{ href: '#p-' + p.id, label: t('aiLOpenPart') }], what: t('aiLogPrice', { t: p.title, m: money(r.price, c) }), ref: p.id };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, part: p.title, from: p.price, to: price };
    }
  });
  tool({
    name: 'bulk_prices', perm: 'admin',
    desc: 'Prepare changing many prices at once (manager only): by percent (pct, e.g. 10 or -5), by an amount (add), or a margin over cost (margin, percent); for all parts or those matching words (q), a category or a make; round up to 0, 0.25, 0.5, 1, 5 or 10. Shows how many change and examples; applied only after confirming, and can be undone in Prices.',
    props: { mode: { type: 'string', enum: ['pct', 'add', 'margin'] }, value: numb('the percent or amount'), round: numb('round up to: 0, 0.25, 0.5, 1, 5 or 10'), q: str('only parts matching these words'),
      category: str('only this category id'), make: str('only this make id') }, req: ['mode', 'value'],
    async run(a, ctx) {
      const mode = ['pct', 'add', 'margin'].includes(a.mode) ? a.mode : 'pct', v = posNum(a.value);
      if (!Number.isFinite(v) || v === 0 || (mode === 'margin' && v < 0) || (mode === 'pct' && v <= -100)) return { error: 'give a valid value' };
      const p = { mode, value: v, round: [0, 0.25, 0.5, 1, 5, 10].includes(+a.round) ? +a.round : 0, make: clip(a.make, 30) || null, cat: clip(a.category, 30) || null, shop: null, q: clip(a.q, 60) || null };
      const r = await rpc('bulk_price', { p: { ...p, dry: true } }) || {};
      if (!r.count) return { count: 0, note: 'no part matches' };
      const c = cur();
      ctx.propose({
        title: t('aiPBulk'), tool: 'bulk_prices', go: t('aiGoDo'), warn: r.below ? [t('aiWBelowN', { n: num(r.below) })] : [],
        rows: (r.sample || []).slice(0, 5).map(x => [x.title, money(x.old, c) + ' ← ' + money(x.new, c)]), total: [t('aiRWill', { n: num(r.count) }), ''],
        async run() {
          const x = await rpc('bulk_price', { p });
          return { text: t('aiDBulk', { n: num(x.count) }), links: [{ href: '#admin-prices', label: t('aiLPrices') }], what: t('aiLogBulk', { n: num(x.count) }), ref: '' };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, will_change: r.count, below_cost: r.below };
    }
  });
  tool({
    name: 'receive_stock', perm: 'purchases',
    desc: 'Prepare receiving goods from a supplier into stock: existing parts by id (from find_parts), or new parts by title and code, with quantities and unit cost; supplier name, and paid (0 for all on credit, or the amount paid now; leave out when paid in full). Shows a card to confirm.',
    props: {
      items: { type: 'array', items: { type: 'object', properties: { id: str('existing part id'), title: str('for a new part: its name'), code: str('for a new part: its part number'), qty: int('how many'), cost: numb('unit cost') }, required: ['qty'] } },
      supplier: str('the supplier name'), paid: numb('0 when all on credit, or what was paid now'), note: str('a note')
    }, req: ['items'],
    async run(a, ctx) {
      const lines = [];
      for (const it of (Array.isArray(a.items) ? a.items : []).slice(0, 30)) {
        const qty = Math.min(Math.max(parseInt(it.qty, 10) || 0, 0), 99999), cost = it.cost != null && posNum(it.cost) >= 0 ? posNum(it.cost) : null;
        if (!qty) continue;
        if (it.id) { const p = await getPart(it.id); lines.push({ product_id: p.id, title: p.title, qty, cost }); }
        else if (clip(it.title, 120)) lines.push({ title: clip(it.title, 120), part_no: clip(it.code, 60), qty, cost, cat: 'other', isNew: true });
      }
      if (!lines.length) return { error: 'no lines with a part and a quantity' };
      const supplier = clip(a.supplier, 120), paid = a.paid != null && posNum(a.paid) >= 0 ? posNum(a.paid) : null, note = clip(a.note, 300);
      if (paid != null && !supplier) return { error: 'on credit or part paid needs the supplier name' };
      const total = lines.reduce((k, l) => k + (l.cost || 0) * l.qty, 0);
      ctx.propose({
        title: t('aiPRecv'), tool: 'receive_stock', go: t('aiGoDo'),
        rows: [...lines.map(l => [l.title + ' × ' + num(l.qty) + (l.isNew ? ' (' + t('aiNew') + ')' : ''), l.cost != null ? money(l.cost * l.qty) : '—']),
          ...(supplier ? [[t('aiRSupplier'), supplier]] : []), ...(paid != null ? [[t('aiRPaid'), money(paid)]] : []), ...(note ? [[t('aiRNote'), note]] : [])],
        total: total ? [t('aiRTotal'), money(total)] : null,
        async run() {
          const r = await rpc('receive_stock', { p: { branch: (S.perms && S.perms.branch) || null, supplier, note, ...(paid != null ? { paid } : {}), source: 'manual',
            items: lines.map(l => l.product_id ? { product_id: l.product_id, qty: l.qty, cost: l.cost } : { part_no: l.part_no, barcode: '', title: l.title, qty: l.qty, cost: l.cost, price: null, cat: l.cat }) } });
          return { text: t('aiDRecv', { n: r.no, u: num(r.updated), a: num(r.new) }), links: [{ href: r.id ? '#pur-' + r.id : '#purchases', label: t('aiLOpenRecv') }], what: t('aiLogRecv', { n: r.no }), ref: String(r.no) };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, lines: lines.length };
    }
  });

  /* ----- an invoice from its photo, exactly as on the paper: every line with its code, name, quantity and price ----- */
  const toN = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let x = SP.digits(String(v == null ? '' : v)).replace(/٫/g, '.').replace(/[٬\s]/g, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) x = x.replace(/,/g, '');
    const n = parseFloat(x.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  /* the shop's part for a line: by barcode or code (as the Receive page does), else by the very same name */
  async function partOf(l) {
    const br = (S.perms && S.perms.branch) || null;
    for (const c of [l.barcode, l.code]) {
      if (!c) continue;
      const p = await SP.findByCode(c, br).catch(() => null);
      if (p) return p;
    }
    if (String(l.title || '').length < 3) return null;
    const r = await SP.api.search({ ...SP.searchArgs({ ...SP.FDEF, q: l.title }, { limit: 6 }), p_country: null, p_city: null, p_include_sold: true }).catch(() => ({ items: [] }));
    const k = SP.norm(l.title);
    return (r.items || []).find(x => SP.norm(x.title) === k) || null;
  }
  tool({
    name: 'invoice_from_photo', perm: ['purchases', 'sales'],
    desc: 'Enter an invoice from the photo the person attached (in this message, or the last photo they sent), exactly as on the paper: every line with its code, name, quantity and unit price, the supplier, the invoice number and date. kind "purchase": a supplier\'s invoice, the goods come into stock (lines that are not parts yet are added as new parts). kind "sale": a sales invoice to a customer, from the shop\'s own parts. It reads the photo itself, checks the lines against the shop\'s parts and the printed total, and shows one card to confirm. Use it whenever someone sends an invoice photo and asks to enter it (نزّل / دخّل / سجّل الفاتورة); never retype the lines yourself.',
    props: {
      kind: { type: 'string', enum: ['purchase', 'sale'], description: 'purchase = a supplier invoice (stock comes in); sale = selling to a customer' },
      supplier: str('purchase: the supplier, if the person names one (else the name printed on the invoice)'), paid: numb('purchase: 0 when all on credit, or the amount paid now; leave out when paid in full'),
      customer_name: str('sale: the customer'), payment: { type: 'string', enum: PAYS, description: 'sale: how the customer paid' }, note: str('a note')
    }, req: ['kind'],
    async run(a, ctx) {
      const kind = a.kind === 'sale' ? 'sale' : 'purchase';
      if (!SP.aiAllowed(kind === 'sale' ? 'sales' : 'purchases')) return { error: 'not allowed: the manager has not given this permission to this person', user: t('aiErrNoPerm') };
      if (!ctx.photo) return { error: 'no photo: ask the person to send the invoice photo with the camera button', user: t('aiNeedPhoto') };
      if (ctx.status) ctx.status(t('aiReadingInv'));
      let r;
      try { r = await SP.readInvoice(ctx.photo, () => {}); }
      catch (e) { const m = (e && e.userMsg) || SP.errText(e); return { error: 'could not read the photo: ' + m, user: t('aiInvNoRead', { e: m }) }; }
      const read = (r && Array.isArray(r.items) ? r.items : []).slice(0, 300).map(x => {
        x = x || {};
        const q = toN(x.qty), unit = toN(x.unit_price != null ? x.unit_price : x.cost), tot = toN(x.total);
        const c = unit != null ? unit : (tot != null && q ? Math.round(tot / q * 1000) / 1000 : null);
        return { code: clip(x.code, 60).toUpperCase(), barcode: String(x.barcode || '').replace(/\D/g, '').slice(0, 20), title: clip(x.title, 120),
          qty: q != null && q >= 1 ? Math.round(q) : null, cost: c != null && c >= 0 ? c : null };
      }).filter(l => l.title || l.code || l.barcode);
      if (!read.length) return { error: 'no item lines could be read: ask for a clear, straight photo of the whole invoice', user: t('aiInvEmpty') };
      if (ctx.status) ctx.status(t('aiCheckingInv', { n: num(read.length) }));
      const queue = read.slice();
      await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) { const l = queue.shift(); l.p = await partOf(l); } }));
      const unread = read.filter(l => l.qty == null).length;
      read.forEach(l => { l.qty = l.qty || 1; });
      const paper = toN(r.total), invNo = clip(r.invoice_no, 40), date = clip(r.date, 20), warn = [];
      if (unread) warn.push(t('aiWQty', { n: num(unread) }));
      if (r.engine === 'device') warn.push(t('aiWDevice'));
      const sub = l => [l.code || l.barcode, num(l.qty) + ' × ' + (l.cost != null ? money(l.cost) : '—')].filter(Boolean).join(' · ');

      if (kind === 'purchase') {
        const supplier = clip(a.supplier, 120) || clip(r.supplier, 120), paid = a.paid != null && posNum(a.paid) >= 0 ? posNum(a.paid) : null;
        const note = [invNo ? t('aiInvNo', { n: invNo }) : '', date, clip(a.note, 200)].filter(Boolean).join(' · ');
        const total = Math.round(read.reduce((k, l) => k + (l.cost || 0) * l.qty, 0) * 1000) / 1000, fresh = read.filter(l => !l.p).length;
        const noCost = read.filter(l => l.cost == null).length;
        if (noCost) warn.push(t('aiWNoCost', { n: num(noCost) }));
        if (paper != null && Math.abs(paper - total) > 0.01) warn.push(t('aiWTotal', { a: money(total), b: money(paper) }));
        if (paid != null && paid < total && !supplier) return { error: 'on credit needs the supplier name: ask for it', user: t('aiNeedSupplier') };
        ctx.propose({
          title: t('aiPInvBuy'), tool: 'invoice_from_photo', go: t('aiGoRecv'), warn,
          rows: [...read.map(l => [l.title || l.code || l.barcode, l.cost != null ? money(l.cost * l.qty) : '—', sub(l) + (l.p ? '' : ' · ' + t('aiNew')), l.p ? 'ok' : 'new']),
            ...(supplier ? [[t('aiRSupplier'), supplier]] : []), ...(invNo || date ? [[t('aiRInvNo'), [invNo, date].filter(Boolean).join(' · ')]] : []),
            [t('aiRLines'), t('aiRLinesV', { l: num(read.length), u: num(read.reduce((k, l) => k + l.qty, 0)), a: num(fresh) })],
            ...(paid != null ? [[t('aiRPaid'), money(paid)]] : [])],
          total: [t('aiRTotal'), money(total)],
          alt: { label: t('aiEditRecv'), run: () => { SP.rcvLoad(read, { supplier, supplier_no: invNo, note }); return '#receive'; } },
          async run() {
            const res = await rpc('receive_stock', { p: { branch: (S.perms && S.perms.branch) || null, supplier, supplier_no: invNo, note, ...(paid != null ? { paid } : {}), source: 'photo',
              items: read.map(l => l.p ? { product_id: l.p.id, qty: l.qty, cost: l.cost } : { part_no: l.code, barcode: l.barcode, title: l.title || l.code || l.barcode, qty: l.qty, cost: l.cost, price: null, cat: 'other' }) } });
            return { text: t('aiDRecvPhoto', { n: res.no, l: num(read.length), a: num(res.new) }), links: [{ href: res.id ? '#pur-' + res.id : '#purchases', label: t('aiLOpenRecv') }],
              what: t('aiLogRecvPhoto', { n: res.no, s: supplier || '—' }), ref: String(res.no) };
          }
        });
        return { prepared: true, waiting_for_confirmation: true, kind, lines: read.length, new_parts: fresh, total, printed_total: paper, unread_quantities: unread, supplier, invoice_no: invNo };
      }

      /* a sale: the shop's own parts only; the paper's prices when the person may set prices */
      const mine = read.filter(l => l.p), miss = read.filter(l => !l.p);
      if (!mine.length) return { error: 'none of the lines are parts of the shop', user: t('aiInvNoneSale') };
      if (mine.length > 200) return { error: 'a sale takes up to 200 lines', user: t('aiInvMany') };
      const own = SP.can('prices'), c = (mine[0].p.shop && mine[0].p.shop.currency) || cur();
      const lines = mine.map(l => {
        const usePaper = own && l.cost != null;
        return { id: l.p.id, title: l.p.title, sku: l.p.sku || l.p.part_no || '', qty: l.qty, price: usePaper ? l.cost : l.p.price, base: l.p.price, own: usePaper && l.cost !== l.p.price, stock: l.p.qty, cur: c, code: l.code };
      });
      if (lines.some(l => l.price == null)) return { error: 'a part has no price: ' + lines.filter(l => l.price == null).map(l => l.title).join('; '), user: t('aiInvNoPrice', { t: lines.filter(l => l.price == null).map(l => l.title).join('، ') }) };
      if (miss.length) warn.push(t('aiWNotFound', { n: num(miss.length), l: miss.slice(0, 6).map(l => l.title || l.code).join('، ') }));
      if (!own && mine.some(l => l.cost != null && l.cost !== l.p.price)) warn.push(t('aiWPrice'));
      lines.filter(l => l.stock != null && l.stock < l.qty).forEach(l => warn.push(t('aiWStock', { n: num(l.stock), t: l.title })));
      const total = Math.round(lines.reduce((k, l) => k + l.price * l.qty, 0) * 100) / 100;
      if (paper != null && !miss.length && Math.abs(paper - total) > 0.01) warn.push(t('aiWTotal', { a: money(total, c), b: money(paper, c) }));
      const pay = PAYS.includes(a.payment) ? a.payment : 'cash', name = clip(a.customer_name, 80), note = [invNo ? t('aiInvSaleNo', { n: invNo }) : '', clip(a.note, 200)].filter(Boolean).join(' · ');
      ctx.propose({
        title: t('aiPInvSell'), tool: 'invoice_from_photo', go: t('aiGoSell'), warn,
        rows: [...lines.map(l => [l.title, money(l.price * l.qty, c), [l.sku, num(l.qty) + ' × ' + money(l.price, c)].filter(Boolean).join(' · '), 'ok']),
          ...(name ? [[t('aiRCustomer'), name]] : []), [t('aiRPay'), t('aiPay_' + pay)]],
        total: [t('aiRTotal'), money(total, c)],
        alt: { label: t('aiEditPos'), run: () => { SP.posLoad(lines, { cname: name, pay, note }); return '#pos'; } },
        async run() {
          const inv = await rpc('create_invoice', { p: { branch: (S.perms && S.perms.branch) || null, payment: pay, discount: 0, paid: pay === 'credit' ? 0 : null, customer_name: name, customer_phone: '', note,
            items: lines.map(l => ({ id: l.id, qty: l.qty, price: l.own ? l.price : undefined })) } });
          return { text: t('aiDSold', { n: inv.no, m: money(inv.total, inv.currency || c) }), links: [{ href: '#inv-' + inv.id, label: t('aiLOpenInv') }], what: t('aiLogSale', { n: inv.no, m: money(inv.total, inv.currency || c) }), ref: String(inv.no) };
        }
      });
      return { prepared: true, waiting_for_confirmation: true, kind, lines: lines.length, not_in_shop: miss.map(l => l.title || l.code), total, printed_total: paper };
    }
  });

  /* ----- the shop (settings) ----- */
  tool({
    name: 'shop_settings', perm: 'settings',
    desc: 'Prepare opening or closing customer orders for a while (with a message shown to customers), and/or setting the notice line at the top of the home screen (empty text removes it). Shows a card to confirm.',
    props: { orders: { type: 'string', enum: ['open', 'closed'] }, closed_message: str('the message customers see while orders are closed'), notice: str('the notice line; empty to remove') },
    async run(a, ctx) {
      const v = {}, rows = [];
      if (a.orders === 'open' || a.orders === 'closed') { v.shop_closed = a.orders === 'closed'; rows.push([t('aiROrders'), t(v.shop_closed ? 'aiRClosed' : 'aiROpen')]); }
      if (v.shop_closed && a.closed_message != null) { v.closed_msg = clip(a.closed_message, 200); rows.push([t('aiRNote'), v.closed_msg || t('aiRNone')]); }
      if (a.notice != null) { v.notice = clip(a.notice, 300); rows.push([t('aiRNotice'), v.notice || t('aiRNone')]); }
      if (!rows.length) return { error: 'nothing to change' };
      ctx.propose({
        title: t('aiPShop'), tool: 'shop_settings', go: t('aiGoDo'), rows,
        async run() { await SP.api.saveSettings(v); return { text: t('aiDShop'), links: [{ href: '#', label: t('aiLHome') }], what: t('aiLogShop'), ref: '' }; }
      });
      return { prepared: true, waiting_for_confirmation: true };
    }
  });
  tool({
    name: 'create_ad', perm: 'admin',
    desc: 'Prepare a new ad at the top of the home screen (manager only): a title, a line under it, the button text, and the words it searches when tapped. No picture (the manager adds one in Ads). Shows a card to confirm.',
    props: { title: str('the title, up to 60 letters'), line: str('a line under it, up to 120'), button: str('button text, up to 24'), search: str('the words to search when tapped') }, req: ['title'],
    async run(a, ctx) {
      const ads = Array.isArray(S.settings && S.settings.ads) ? S.settings.ads : [];
      if (ads.length >= 5) return { error: 'there are already 5 ads' };
      const ad = { id: Math.random().toString(36).slice(2, 10), img: '', title: clip(a.title, 60), sub: clip(a.line, 120), cta: clip(a.button, 24), go: clip(a.search, 60) ? 'q' : '', to: clip(a.search, 60), pos: '', until: '', on: true };
      if (!ad.title) return { error: 'give a title' };
      ctx.propose({
        title: t('aiPAd'), tool: 'create_ad', go: t('aiGoDo'), rows: [[ad.title, ad.sub || ''], ...(ad.to ? [[t('aiRSearch'), ad.to]] : [])],
        async run() {
          await SP.api.saveSettings({ ads: [...(Array.isArray(S.settings.ads) ? S.settings.ads : []), ad].slice(0, 5) });
          return { text: t('aiDAd'), links: [{ href: '#', label: t('aiLHome') }, { href: '#admin-ads', label: t('adsT') }], what: t('aiLogAd', { t: ad.title }), ref: ad.id };
        }
      });
      return { prepared: true, waiting_for_confirmation: true };
    }
  });
  tool({
    name: 'recent_activity', perm: 'admin',
    desc: 'The latest things done in the app (manager only): who did what and when, from the activity log; optionally only words (a name, an invoice number).',
    props: { query: str('words: a name, a part, an invoice number') },
    async run(a, ctx) {
      const r = await rpc('list_activity', { p_group: null, p_actor: null, p_from: null, p_to: null, p_q: clip(a.query, 60) || null, p_limit: 10, p_offset: 0 }) || {};
      const items = r.items || [];
      if (items.length) ctx.card({ type: 'list', title: t('aiSLog'), rows: items.map(x => ({ t: x.actor_name + ' · ' + (x.title || x.kind), s: when(x.created_at), v: x.amount != null ? money(Math.abs(+x.amount)) : '' })), more: { href: '#admin-log', label: t('logT') } });
      return { total: r.total, latest: items.map(x => ({ who: x.actor_name, kind: x.kind, what: x.title, amount: x.amount, when: x.created_at })) };
    }
  });

  Object.assign(SP.L.T, {
    aiCartAdded: ["زدت {n} من «{t}» للسلة", "Added {n} × “{t}” to the cart"], aiRSearch: ["يبحث عن", "Searches"],
    aiLogSale: ["فاتورة بيع رقم {n} ({m})", "Sale no. {n} ({m})"], aiLogReturn: ["ترجيع الفاتورة رقم {n}", "Returned invoice no. {n}"], aiLogPay: ["دفعة {m} من {t}", "Payment of {m} from {t}"],
    aiLogSupPay: ["دفعة {m} لـ {t}", "Payment of {m} to {t}"], aiLogExp: ["مصروف {m} ({t})", "Expense of {m} ({t})"], aiLogStock: ["كمية «{t}»: {a} ← {b}", "Stock of “{t}”: {a} → {b}"],
    aiLogPrice: ["سعر «{t}» توا {m}", "Price of “{t}” is now {m}"], aiLogBulk: ["تغيير أسعار {n} قطعة", "Changed {n} prices"], aiLogRecv: ["فاتورة شراء رقم {n}", "Purchase invoice {n}"],
    aiLogShop: ["إعدادات المحل", "Shop settings"], aiLogAd: ["إعلان «{t}»", "Ad “{t}”"]
  });

  /* what the assistant may use for this person, in this edition */
  SP.aiTools = () => TOOLS.filter(x => SP.aiAllowed(x.perm) && (!x.company || SP.company) && (!x.customer || !SP.aiStaff() || SP.company) && (!x.mine || !SP.aiStaff()));
  SP.aiToolPerm = name => { const x = TOOLS.find(y => y.name === name); return x ? x.perm : undefined; };
  SP.aiSchemas = () => SP.aiTools().map(x => ({ name: x.name, description: x.desc, input_schema: { type: 'object', properties: x.props || {}, required: x.req || [] } }));

  /* ---------- the app guide: what the assistant knows about using the app ---------- */
  const HELP = [
    ['pos', 'sales', 'بيع فاتورة نقطة كاشير فاتورة بيع اكتب فاتورة', 'فاتورة بيع (#pos، أول زر في تبويب المنظومة): دوّر على القطعة بالاسم أو الرقم أو صوّر الباركود وتتزاد للفاتورة، حدد الكمية والزبون وطريقة الدفع (كاش، بطاقة، تحويل، دين) واضغط «احفظ الفاتورة». بعدها تطبعها أو تبعتها على واتساب.', 'Sales invoice (#pos, the first button on the System tab): find the part by name, number or barcode photo, set quantities, customer and payment (cash, card, transfer, credit), then Save. Print it or send it on WhatsApp.'],
    ['invoices', ['sales', 'invoices'], 'فواتير فاتورة طباعة اطبع فواتير البيع', 'فواتير البيع (#invoices): كل فواتير البيع، تدوّر برقمها أو اسم الزبون أو رقمه، وتفتح أي واحدة تطبعها أو تبعتها.', 'Invoices (#invoices): every sale; search by number, customer name or phone; open one to print or send it.'],
    ['returns', 'returns', 'ترجيع ترجع مرتجع رجع', 'ترجيع فاتورة: افتحها من «الفواتير» واضغط «ترجيع»؛ القطع ترجع للمخزن والفاتورة تتعلّم مرجّعة.', 'Returns: open the invoice and tap Return; the parts go back to stock.'],
    ['invphoto', ['purchases', 'sales'], 'صورة صوره فاتورة فاتوره نزل نزّل دخل سجل طبق الاصل', 'فاتورة من صورة: في المساعد اضغط زر الكاميرا وصوّر الفاتورة وقول «نزّل الفاتورة». يقراها سطر سطر (الأصناف والأرقام والعدد والأسعار والمورّد ورقم الفاتورة) ويوريك بطاقة طبق الأصل ويقارن المجموع بالمكتوب في الورقة؛ تضغط «نفّذ» وتدخل للمخزن، واللي مش موجود يتزاد قطعة جديدة. ولو هي فاتورة بيع قول «فاتورة بيع».', 'An invoice from its photo: in the assistant tap the camera, photograph the invoice and say “enter this invoice”. It reads it line by line (items, codes, quantities, prices, supplier, invoice number), shows a card just like the paper and checks the total; tap Do it and it goes into stock, new items as new parts. For a sales invoice say “sales invoice”.'],
    ['receive', 'purchases', 'استلام بضاعة مورد فاتورة شراء صور مشتريات يدوي', 'فاتورة شراء (#receive، الزر الثاني في تبويب المنظومة): دخّل المشتريات يدوي (دوّر على الصنف بالاسم أو رقم الصنف أو الباركود أو الشركة، أو «صنف جديد» للصنف الجديد)، أو صوّر فاتورة المورّد وتدخل الأصناف للمخزن وحدها، أو امسح الباركود. حدد المورّد ورقم فاتورته والدفع (كاش، دين، جزء). بعد الحفظ تفتح الفاتورة في صفحتها (#pur-…): المورّد ورقم فاتورته، ختم «وارد» (أزرق مدفوعة، أحمر لو باقي)، الأصناف والإجمالي والمدفوع والباقي، وحساب المورّد، وتطبعها أو تشاركها أو تلغيها من نفس الصفحة. كل الفواتير في «فواتير الشراء»، وتلقى وحدة برقمها أو رقم فاتورة المورّد أو اسمه أو أي قطعة فيها.', 'Purchase invoice (#receive, the second button on the System tab): enter purchases by hand (find the part by name, item code, barcode or maker, or «New item» for a new one), or photograph the supplier invoice and the lines go into stock by themselves, or scan barcodes; set the supplier, his invoice number and payment. Once saved it opens on its own page (#pur-…): supplier and his number, a «Received» stamp (blue when paid, red while something is owed), the lines, total, paid and owed, the supplier account; print, share or cancel it there. All of them are in Purchase invoices, found by number, the supplier invoice number, the supplier or any part on them.'],
    ['stock', ['products', 'purchases', 'reports'], 'مخزن كمية جرد تالف ضايع ناقص خالص', 'المخزن (#stock): الكميات وقيمتها، الناقص والخالص، وتعديل الكمية (جرد، تالف، ضايع) من زر التعديل جنب القطعة.', 'Stock (#stock): quantities and value, low and out of stock; change a quantity (count, damaged, lost) with the edit button.'],
    ['addpart', 'products', 'اضيف قطعة جديدة صنف', 'قطعة جديدة: من «حسابي» افتح الفرع واضغط «أضف قطعة» (الاسم، الرقم، السيارة، السعر، الكمية، الصور)، أو تتزاد وحدها لما تستلم بضاعة جديدة.', 'New part: in Account open the branch and tap Add part, or it is created when you receive new goods.'],
    ['buyers', ['invoices', 'reports'], 'زبائن ديون دين عليه حساب دفعة', 'الزبائن والديون (#buyers): كل زبون وفواتيره وكم عليه، وتسجل دفعة من صفحته.', 'Customers (#buyers): each customer, their invoices and what they owe; record a payment on their page.'],
    ['suppliers', 'costs', 'موردين مورد ليهم دفعة', 'الموردين (#suppliers): كم ليهم عليك من فواتير الشراء بالدين، وتسجل الدفعات.', 'Suppliers (#suppliers): what you owe them from receipts on credit; record payments.'],
    ['expenses', ['expenses', 'reports'], 'مصروف مصروفات ايجار رواتب كهرباء', 'المصروفات (#expenses): إيجار، رواتب، كهرباء وماء، نقل، صيانة، وأخرى.', 'Expenses (#expenses): rent, salaries, utilities, transport, maintenance, other.'],
    ['pnl', { all: ['reports', 'costs'] }, 'ارباح خسائر ربح صافي', 'الأرباح والخسائر (#pnl): المبيعات ناقص تكلفة البضاعة والمصروفات = الصافي، لأي فترة.', 'Profit and loss (#pnl): sales minus cost of goods and expenses = net, for any period.'],
    ['reports', 'reports', 'تقارير تقرير مبيعات', 'التقارير (#reports): مبيعات اليوم والأسبوع والشهر، حسب البايع والفرع وطريقة الدفع، والأكثر بيعاً.', 'Reports (#reports): sales by day, week and month, by seller, branch and payment, and best sellers.'],
    ['staff', 'admin', 'موظفين موظف صلاحيات صلاحية بايع', 'الموظفين (#staff، للمدير): زيد موظف بإيميله، حدد صلاحياته وفرعه وأقصى تخفيض، وتقدر تعطيه المساعد الذكي وتختار شنو يعمل عنه.', 'Staff (#staff, manager): add an employee by email, set permissions, branch and discount limit, and give them the assistant with what it may do.'],
    ['ai', 'staff', 'مساعد ذكي ذكاء صلاحية المساعد', 'المساعد الذكي: للمدير دايماً. يعطيه لموظف من «الموظفين» (#staff): افتح الموظف، شغّل «يستعمل المساعد» واختار شنو يقدر يعمل عنه (من صلاحيات الموظف نفسه). وللزبائن من «لوحة الإدارة ← المساعد» (#admin-ai). أي تغيير ما يصيرش إلا لما تضغط «نفّذ» على البطاقة، ويتسجل في سجل الحركة.', 'The assistant: the manager always has it. He gives it to an employee in Staff (#staff): open the employee, turn on “Can use the assistant” and pick what it may do for them (from their own permissions). For customers: Owner panel → Assistant (#admin-ai). Nothing changes until you tap Do it on the card, and it goes in the activity log.'],
    ['hideprices', 'admin', 'اخفاء الاسعار سعر مخفي', 'إظهار الأسعار (#admin-company): للكل، للمسجّلين، للمعتمدين، أو بالتواصل؛ وكل قطعة تقدر تخفي سعرها.', 'Price visibility (#admin-company): everyone, signed-in, approved, or on request; and per part.'],
    ['bulk', 'admin', 'اسعار بالجملة زيادة نسبة هامش', 'الأسعار بالجملة (#admin-prices، للمدير): نسبة أو مبلغ أو هامش على التكلفة، لكل القطع أو لقطع معينة؛ تشوف قبل ما تطبّق وتقدر ترجع.', 'Bulk prices (#admin-prices, manager): by percent, amount or margin, for all or some parts; preview first, undo later.'],
    ['control', 'admin', 'تحكم قفل الطلبات اخفاء الكميات الفروع تحت التكلفة', 'التحكم (#admin-control): قفل الطلبات مؤقتاً برسالة، إخفاء الكميات والفروع عن الزبائن، منع البيع تحت التكلفة، مستوى النقص، وتذييل الفاتورة.', 'Controls (#admin-control): close orders for a while, hide quantities and branches, no selling below cost, low-stock level, invoice footer.'],
    ['log', 'admin', 'سجل الحركة مين عمل', 'سجل الحركة (#admin-log): كل شي صار، مين عمله ووقتاش، وما يتمسحش ولا يتعدّل.', 'Activity log (#admin-log): everything done, who and when; it cannot be edited or deleted.'],
    ['ads', 'admin', 'اعلان اعلانات الرئيسية', 'الإعلانات (#admin-ads): لحد 5 إعلانات فوق في الرئيسية، بصورة وعنوان وزر، ويوقف وحده في يوم تحدده.', 'Ads (#admin-ads): up to 5 ads at the top of the home screen with a picture, title and button, ending on a set day.'],
    ['faceid', null, 'فيس بصمة face id دخول', 'Face ID أو البصمة: من «حسابي» فعّله مرة، وبعدها تدخل بضغطة من صفحة الدخول.', 'Face ID or fingerprint: turn it on once in Account, then sign in with one tap.'],
    ['vin', null, 'شاصي vin هيكل سيارتي', 'رقم الشاصي (#vin): اكتب رقم الشاصي ونعرفو السيارة والقطع اللي تركب عليها.', 'VIN (#vin): enter the VIN to identify the car and the parts that fit.'],
    ['order', null, 'طلب اطلب سلة توصيل استلام طلبي طلباتي', 'الطلب من التطبيق: زيد القطع لطلبك، وافتح السلة (#cart) واختار استلام من الفرع أو توصيل، واضغط «أكّد الطلب». يوصل للشركة «قيد التجهيز»، وبعدها «قيد الاستلام» لما يكون جاهز، وتتابعه في «طلباتي» (#my-orders). الدفع عند الاستلام، وتقدر تلغيه وهو قيد التجهيز.', 'Ordering in the app: add parts, open the basket (#cart), choose pickup or delivery and tap Place order. The company gets it “being prepared”, then “ready”; follow it in My orders (#my-orders). Pay when you receive it; you can cancel while it is being prepared.'],
    ['orders', ['sales', 'invoices'], 'طلبات الزبائن التطبيق جاهز تجهيز استلام سلم', 'طلبات الزبائن (#orders): الطلب يوصل «قيد التجهيز» ويطلع رقم على تبويب المنظومة. جهّز القطع واضغط «جاهز للاستلام»، ولما الزبون يستلم اضغط «تم الاستلام» واختار كيف دفع: تولي فاتورة بيع في المبيعات. «إلغاء الطلب» يرجّع القطع للمخزن.', 'Customer orders (#orders): an order arrives “being prepared” with a count on the System tab. Prepare it and tap Ready; when the customer receives it tap Received and choose how they paid: it becomes a sale. Cancel puts the parts back in stock.'],
    ['lookup', 'staff', 'استعلام سعر قطعه كم سعر معلومات باركود رقم صنف', 'استعلام سعر قطعة (#lookup، تحت زرّي «فاتورة بيع» و«فاتورة شراء» في المنظومة): امسح الباركود أو اكتب رقم الصنف أو اسم القطعة، وتطلعلك بسعرها والموجود منها وفرعها وشركتها، وسعر الشراء والربح لصاحب الصلاحية، و«بيعها» يفتح فاتورة بيع.', 'Look up a part (#lookup, under the sales and purchase invoice buttons on the System tab): scan the barcode or type the item code or name to see its price, stock, branch and maker, the cost and profit for those allowed, and «Sell it» starts a sales invoice.'],
    ['invoices', 'staff', 'مرتجع ارجاع رجع قطعه وحده جزء من الفاتوره ترجيع بعض القطع', 'المرتجع (من «فواتير البيع» افتح الفاتورة): «رجّع قطع» تحدد كم ترجع من كل صنف والسبب، والقطع ترجع للمخزن والفاتورة تقعد بالباقي، والخصم ينقص على قدها، وترجّع للزبون الفرق كاش أو ينقص من دينه لو آجل. «رجّعها كاملة» ترجع الفاتورة كلها. يحتاج صلاحية «المرتجعات».', 'Returns (open the invoice from «Sales invoices»): «Return parts» picks how many of each come back and why; they go back to stock, the invoice keeps the rest with its discount in proportion, and the difference goes back to the customer (or off his debt on credit). «Return it all» returns the whole invoice. Needs the «returns» permission.'],
    ['picks', 'staff', 'تجهيز الفواتير المخزن موظف المخزن مكان القطعه رف خانه جهز الموجود ناقص', 'تجهيز الفواتير (#picks): كل فاتورة بيع أو طلب من التطبيق يوصل لموظف المخزن في «تستنى»، وفيه كل قطعة بمكانها في المخزن (الرف والخانة) وكميتها وأرقامها، مرتبة بالمكان. يعلّم على كل قطعة لما ياخذها (أو يمسح باركودها) ويضغط «تم التجهيز»، وتطلع في الفاتورة «تجهزت في المخزن» باسمه. ولطلب الزبون يحدد «الموجود» من كل صنف ويضغط «جهّز وابعثه للزبون»: الناقص يتشال والطلب يمشي «قيد الاستلام» بالموجود، والزبون يشوف اللي ما لقيناهوش. مكان القطعة يتحط من صفحة القطعة («مكان القطعة في المخزن»)، أو في فاتورة الشراء للقطعة الجديدة، أو عمود «المكان» في ملف الإكسل. الصلاحية «تجهيز الفواتير في المخزن» يعطيها المدير من صفحة الموظفين.', 'Preparing invoices (#picks): every sale or app order waits for the warehouse employee with the shelf and bin of each part, its quantity and codes, sorted by place. He ticks each part as he takes it (or scans its barcode) and taps «Prepared»; the invoice then says who prepared it. A part\'s place is set on the part page, on a purchase invoice for a new part, or in a «location» column of the Excel import. The manager gives the permission «Prepare invoices in the warehouse» on the staff page.'],
    ['shops', null, 'محلات التجار محل تاجر المحلات', 'المحلات (#mshops، في الشاشة الرئيسية تحت «وصل حديثاً»): محلات التجار اللي تظهرهم الشركة، كل محل بمدينته وصفحته، والرقم لو التاجر اختار يظهره.', 'Shops (#mshops, on the home screen under New arrivals): the merchants’ shops the company shows, each with its city and page, and the number when the merchant shows it.'],
    ['barcode', 'staff', 'باركود كاميرا', 'الباركود: في فاتورة البيع وفاتورة الشراء زر الكاميرا يقرا الباركود، أو استعمل جهاز باركود (يكتب الرقم ويضغط Enter).', 'Barcodes: the camera button in the sales and purchase invoices reads them, or use a scanner.'],
    ['settings', 'admin', 'اعدادات الشركة الشعار الالوان', 'إعدادات الشركة (#admin-company): الاسم والشعار والألوان والنصوص وأرقام التواصل والتنبيه.', 'Company settings (#admin-company): name, logo, colours, texts, contacts and notice.'],
    ['sync', 'admin', 'ربط مزامنة اكسل excel منظومة', 'الربط مع منظومة ثانية (#admin-sync): ملف Excel/CSV أو برنامج المزامنة.', 'Sync with another system (#admin-sync): Excel/CSV or the sync program.']
  ];
  SP.aiGuide = () => {
    const ar = SP.LANG === 'ar';
    return HELP.filter(h => SP.aiAllowed(h[1]) && !(h[1] === 'staff' && !SP.aiStaff())).map(h => '- ' + (ar ? h[3] : h[4])).join('\n');
  };
  SP.aiHelpFind = q => {
    const w = SP.norm(q).split(' ').filter(x => x.length > 2);
    let best = null, score = 0;
    HELP.forEach(h => { if (!SP.aiAllowed(h[1])) return; const keys = SP.norm(h[2]).split(' '); const s = w.filter(x => keys.some(k => k.startsWith(x) || x.startsWith(k))).length; if (s > score) { score = s; best = h; } });
    return best ? { text: SP.LANG === 'ar' ? best[3] : best[4], page: (/#([a-z-]+)/.exec(best[3]) || [])[1] || '' } : null;
  };

  Object.assign(SP.L.T, {
    aiPInvBuy: ["فاتورة شراء من الصورة", "Purchase invoice from the photo"], aiPInvSell: ["فاتورة بيع من الصورة", "Sales invoice from the photo"],
    aiGoRecv: ["نفّذ ودخّلها للمخزن", "Enter it into stock"], aiEditRecv: ["عدّلها في فاتورة الشراء", "Edit as a purchase invoice"],
    aiReadingInv: ["نقرا في الفاتورة…", "Reading the invoice…"], aiCheckingInv: ["قريت {n} سطر، نطابقهم مع القطع…", "Read {n} lines, matching them with the parts…"],
    aiNeedPhoto: ["ابعتلي صورة الفاتورة بزر الكاميرا اللي جنب الكتابة، وقولي «نزّل الفاتورة».", "Send me the invoice photo with the camera button next to the text box, and say “enter this invoice”."],
    aiInvNoRead: ["ما قدرتش نقرا الصورة: {e}", "I couldn’t read the photo: {e}"],
    aiInvEmpty: ["ما لقيتش أسطر أصناف في الصورة. صوّر الفاتورة كاملة ومستقيمة وفي ضو كويس.", "I couldn’t find item lines in the photo. Photograph the whole invoice, straight and well lit."],
    aiInvNoneSale: ["ولا صنف في الفاتورة موجود عندنا، فما تنباعش. لو هي فاتورة شراء قولي «فاتورة شراء».", "None of the lines are parts of the shop, so they can’t be sold. If it is a purchase invoice, say so."],
    aiInvNoPrice: ["هالقطع ما عندهاش سعر بيع: {t}. حط سعرها أول.", "These parts have no selling price: {t}. Set it first."],
    aiInvMany: ["فاتورة البيع لحد 200 صنف. قسّمها على فاتورتين.", "A sale takes up to 200 lines. Split it in two."],
    aiNeedSupplier: ["بالدين يحتاج اسم المورّد. شنو اسمه؟", "On credit needs the supplier’s name. What is it?"],
    aiWQty: ["{n} أسطر ما انقراش عددها وحطيتها 1. قارنها بالورقة.", "{n} lines had no readable quantity and were set to 1. Check them against the paper."],
    aiWNoCost: ["{n} أسطر بدون سعر. تقدر تكمّلها من «عدّلها في فاتورة الشراء».", "{n} lines have no price. You can fill them in “Edit as a purchase invoice”."],
    aiWTotal: ["مجموع الأسطر {a} والمكتوب في الفاتورة {b}. راجع الأسطر أو الخصم.", "The lines add up to {a}; the invoice says {b}. Check the lines or a discount."],
    aiWDevice: ["انقرت على الجهاز بدون Claude: قارن الأسطر بالورقة قبل ما تنفّذ.", "Read on the device without Claude: check the lines against the paper before confirming."],
    aiWNotFound: ["{n} أصناف مش موجودة عندنا وما تنباعش: {l}", "{n} lines are not parts of the shop and can’t be sold: {l}"],
    aiWPrice: ["أسعار الورقة تختلف على أسعارنا، وحطيت أسعار المنظومة (تعديل السعر مش من صلاحياتك).", "The paper’s prices differ; the shop’s prices are used (changing prices isn’t among your permissions)."],
    aiInvNo: ["فاتورة المورّد رقم {n}", "Supplier invoice no. {n}"], aiInvSaleNo: ["من فاتورة ورقية رقم {n}", "From paper invoice no. {n}"],
    aiRInvNo: ["رقم الفاتورة", "Invoice no."], aiRLines: ["الأصناف", "Lines"], aiRLinesV: ["{l} صنف · {u} حبة · {a} جديدة", "{l} lines · {u} units · {a} new"],
    aiDRecvPhoto: ["دخلت الفاتورة للمخزن: فاتورة شراء رقم {n}، {l} صنف ({a} جديدة).", "Entered into stock: purchase invoice {n}, {l} lines ({a} new)."],
    aiLogRecvPhoto: ["دخّل فاتورة «{s}» من الصورة: فاتورة شراء رقم {n}", "Entered the “{s}” invoice from its photo: purchase invoice {n}"]
  });

  SP.aiTimeSpan = span;
})();
