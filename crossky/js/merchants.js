/* Merchants (التجار), in the company edition. A merchant signs up with his shop and his phone number (js/company.js) and has
   «صادر ووارد»: الوارد, the invoices the company sends him and the orders he received; الصادر, his orders and his payments;
   and, once the company has approved his account, what he still owes. The staff send an invoice to a merchant from the
   invoice or the order page («ابعث الفاتورة للتاجر»), and find every merchant in «التجار» with the same «صادر ووارد».
   The rules are in supabase/setup.sql section 16 (and the same in js/demo.js). */
(function () {
  'use strict';
  const SP = window.SP;
  if (!SP || !SP.company) return;
  const { $, $$, esc, I, t, S, shell, bar, empty, gate } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a || {}));

  Object.assign(window.SP_IC, {
    inbox: '<path d="M3.5 13.5h4.8l1.4 2.6h4.6l1.4-2.6h4.8"/><path d="M5.6 5.5h12.8l2.1 8V19H3.5v-5.5z"/><path d="M12 3.6v7.2m-2.8-2.6L12 11l2.8-2.8"/>',
    outbox: '<path d="M3.5 13.5h4.8l1.4 2.6h4.6l1.4-2.6h4.8"/><path d="M7 5.5H5.6l-2.1 8V19h17v-5.5l-2.1-8H17"/><path d="M12 11V3.8m-2.8 2.6L12 3.6l2.8 2.8"/>',
    key: '<circle cx="7.8" cy="15.6" r="3.6"/><path d="m10.4 13 8.3-8.3m-2.6 2.6 2.4 2.4m-4.9 0 1.9 1.9"/>'
  });
  Object.assign(SP.L.T, {
    mrT: ["التجار", "Merchants"], mrBookT: ["صادر ووارد", "Statement"], mrBookSub: ["الفواتير اللي توصلك، وطلباتك ودفعاتك", "Invoices you get, your orders and payments"],
    mrIn: ["الوارد", "Received"], mrInH: ["الفواتير اللي وصلتك من الشركة، والطلبات اللي استلمتها.", "Invoices the company sent you, and the orders you received."],
    mrOut: ["الصادر", "Sent"], mrOutH: ["طلباتك اللي بعثتها، ودفعاتك.", "The orders you sent, and your payments."],
    mrOwe: ["الباقي عليك", "You owe"], mrCredit: ["ليك عند الشركة", "Your credit"], mrClear: ["ما عليكش حاجة", "You owe nothing"],
    mrBought: ["مجموع مشترياتك", "Total bought"], mrPaid: ["دفعت بعدها", "Paid later"], mrBoughtHim: ["مجموع مشترياته", "Total bought"], mrPaidHim: ["دفع بعدها", "Paid later"], mrBills: ["الفواتير", "Invoices"], mrOpen: ["طلبات مفتوحة", "Open orders"],
    mrNotYet: ["الباقي عليك ودفعاتك يطلعوا بعد ما الشركة تعتمد حسابك.", "What you owe and your payments show once the company approves your account."],
    mrNoBook: ["كمّل حسابك أول", "Complete your account first"], mrNoBookB: ["اكتب اسم المحل ورقم هاتفك في «حسابي».", "Add your shop name and phone number in Account."],
    mrInEmpty: ["ما وصلتكش فواتير بعد", "No invoices yet"], mrInEmptyB: ["الفواتير اللي تبعثهالك الشركة، والطلبات اللي تستلمها، يطلعوا هني.", "Invoices the company sends you, and the orders you receive, appear here."],
    mrOutEmpty: ["ما فيش طلبات ولا دفعات بعد", "No orders or payments yet"],
    mrNew: ["جديدة", "New"], mrPaidAll: ["مدفوعة", "Paid"], mrPayment: ["دفعة", "Payment"], mrOrderNo: ["طلب رقم {n}", "Order {n}"],
    mrNewBill: ["وصلتك فاتورة رقم {n}", "You got invoice {n}"], mrShare: ["شارك", "Share"], mrNoBill: ["الفاتورة هذي مش متاحة", "This invoice isn’t available"],
    /* the staff's side */
    mrSearchPh: ["دوّر باسم المحل أو رقم الهاتف", "Search by shop or phone number"], mrAll: ["الكل", "All"], mrPending: ["بانتظار الموافقة", "Waiting for approval"],
    mrWithOrders: ["عندهم طلبات", "With orders"], mrOwing: ["عليهم فلوس", "Owing"], mrNoHit: ["ما فيش تاجر هكي", "No merchant found"],
    mrEmpty: ["ما فيش تجار مسجلين بعد", "No merchants yet"], mrEmptyB: ["التجار اللي يسجلوا في التطبيق باسم محلاتهم يطلعوا هني.", "Merchants who sign up in the app with their shop appear here."],
mrOweHim: ["الباقي عليه", "Owes"], mrCreditHim: ["ليه عندنا", "In credit"], mrClearHim: ["ما عليهش حاجة", "Owes nothing"],
    mrToHim: ["صادر له", "Sent to him"], mrToHimH: ["الفواتير اللي بعثناهاله، والطلبات اللي استلمها.", "Invoices sent to him, and the orders he received."],
    mrFromHim: ["وارد منه", "From him"], mrFromHimH: ["طلباته ودفعاته.", "His orders and payments."],
    mrNotYetHim: ["بعد ما تعتمده، يتحسب عليه كل بيع برقمه، ويشوف الباقي عليه ودفعاته.", "Once approved, every sale under his number counts, and he sees what he owes and his payments."],
    mrPw: ["كلمة سر جديدة", "New password"], mrPwB: ["اعطيه كلمة السر هذي، ويقدر يبدلها من حسابه.", "Give him this password; he can change it from his account."],
    mrPwSave: ["احفظ كلمة السر", "Save the password"], mrPwDone: ["تم. ابعثها للتاجر.", "Done. Send it to the merchant."],
    mrPwWa: ["كلمة السر الجديدة لحسابك في {app}: {p}", "Your new {app} password: {p}"], mrPwSend: ["ابعثها على واتساب", "Send on WhatsApp"],
    /* «ابعث الفاتورة للتاجر» */
    mrSendT: ["ابعث الفاتورة للتاجر", "Send the invoice to the merchant"], mrSendH: ["توصله في التطبيق، في «صادر ووارد»، مع تنبيه.", "It reaches him in the app, in his statement, with a notice."],
    mrSendBtn: ["ابعثها لـ {s}", "Send to {s}"], mrSendPick: ["اختار التاجر", "Choose the merchant"], mrSendAgain: ["ابعثها مرة ثانية", "Send again"],
    mrSentTo: ["بعثتها لـ {s} · {d}", "Sent to {s} · {d}"], mrSentOk: ["وصلت الفاتورة للتاجر", "The invoice was sent to the merchant"],
    mrUnsend: ["ارجعها", "Take back"], mrUnsendQ: ["ترجع الفاتورة من حساب {s}؟", "Take the invoice back from {s}?"], mrUnsent: ["رجعت الفاتورة", "The invoice was taken back"],
    mrPickT: ["لمن تبعث الفاتورة؟", "Send the invoice to"], mrPickH: ["لازم يكون مسجّل في التطبيق. دوّر باسم المحل أو رقمه.", "He must have signed up in the app. Search by shop or number."],
    mrPickNone: ["ما لقيتش تاجر بالاسم أو الرقم هذا.", "No merchant with that name or number."], mrPickSame: ["نفس رقم الفاتورة", "Same number as the invoice"],
    mrPickQ: ["تبعث الفاتورة رقم {n} لـ {s}؟", "Send invoice {n} to {s}?"],
    mrErrCancelled: ["الفاتورة ملغية وما تنبعثش.", "A cancelled invoice can’t be sent."], mrErrOther: ["الفاتورة هذي متاعة تاجر ثاني.", "This invoice belongs to another merchant."],
    mrErrGone: ["التاجر هذا ما كمّلش حسابه في التطبيق.", "This merchant hasn’t completed his account in the app."]
  });

  const money = (v, c) => SP.priceText(+v || 0, c || SP.currencyOf(S.country));
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  const fmt = v => SP.fmtNum(+v || 0);
  const shopOf = m => (m && (String(m.shop_name || '').trim() || m.name)) || '';
  const stat = (k, v, cls) => `<div class="astat${cls ? ' ' + cls : ''}"><b class="num">${esc(v)}</b><small>${esc(t(k))}</small></div>`;
  const staffer = () => !!(SP.isStaff && SP.isStaff());
  SP.merchantsCan = () => !!(S.user && staffer() && (SP.can('customers') || SP.can('invoices') || SP.can('reports')));
  const canSend = () => !!(S.user && staffer() && (SP.can('sales') || SP.can('invoices')));
  const sendErr = e => {
    const m = String((e && e.message) || '');
    return /invoice cancelled/.test(m) ? t('mrErrCancelled') : /another merchant/.test(m) ? t('mrErrOther') : /merchant not found/.test(m) ? t('mrErrGone') : SP.errText(e);
  };

  /* ---------- the merchant's notices: invoices sent to him that he has not opened yet ---------- */
  const SEEN = 'sp_inbox_seen', TOLD = 'sp_inbox_told';
  let INBOX = [];
  const seen = () => SP.load(SEEN, {}) || {};
  const trim = m => { const k = Object.keys(m); if (k.length > 150) k.slice(0, k.length - 150).forEach(x => delete m[x]); return m; };
  const isNew = v => !!(v.sent_at && seen()[v.id] !== v.sent_at);
  function ledgerBadge() {
    const el = $('a.admin-entry[href="#ledger"]');
    if (!el) return;
    let b = el.querySelector('.nbadge');
    const v = +S.inboxNew || 0;
    if (!v) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('i'); b.className = 'nbadge'; el.insertBefore(b, el.lastElementChild); }
    b.textContent = SP.fmtNum(v);
  }
  function recount() {
    const m = seen();
    S.inboxNew = INBOX.filter(x => m[x.id] !== x.sent_at).length;
    if (SP.ordBadges) SP.ordBadges();
    ledgerBadge();
  }
  function markSeen(id, at) { const m = seen(); m[id] = at; SP.store(SEEN, trim(m)); recount(); }
  /* called by the orders' watcher (js/orders.js) every minute and a half for a signed-in customer */
  SP.inboxWatch = async () => {
    if (!S.user || staffer()) { INBOX = []; S.inboxNew = 0; return; }
    try { INBOX = (await rpc('my_inbox')) || []; } catch (e) { return; }
    const m = seen(), told = SP.load(TOLD, {}) || {};
    const fresh = INBOX.filter(x => m[x.id] !== x.sent_at && told[x.id] !== x.sent_at);
    if (fresh.length) {
      const here = SP.here();
      if (here !== 'ledger' && !/^bill-/.test(here)) SP.toast(t('mrNewBill', { n: fresh[0].no }));
      fresh.forEach(x => { told[x.id] = x.sent_at; });
      SP.store(TOLD, trim(told));
      if (here === 'ledger') SP.render();
    }
    recount();
  };
  const prevAfter = SP.afterShell;
  SP.afterShell = o => { if (prevAfter) prevAfter(o); ledgerBadge(); };

  /* the entry on the merchant's account page */
  SP.ledgerLink = () => S.user ? `<a class="admin-entry" href="#ledger">${I('inbox')}<span><b>${esc(t('mrBookT'))}</b><small>${esc(t('mrBookSub'))}</small></span>${I('chevL', 'dirx')}</a>` : '';

  /* ---------- «صادر ووارد»: the same page for the merchant and, from the other side, for the staff ---------- */
  function bookHead(b, staff) {
    const bal = b.balance == null ? null : +b.balance;
    const k = bal > 0 ? (staff ? 'mrOweHim' : 'mrOwe') : bal < 0 ? (staff ? 'mrCreditHim' : 'mrCredit') : (staff ? 'mrClearHim' : 'mrClear');
    const tel = staff && SP.telHref(b.phone, S.country), wa = staff && SP.waLink(b.phone, '', S.country);
    return `<section class="mcard led-head mr-head">
        <div class="mr-who"><span class="hexav"><span>${esc(SP.initial(shopOf(b)))}</span></span><span class="ar-main"><b>${esc(shopOf(b))}${staff ? ` <span class="pill${b.approved ? ' ok' : ' demo'}">${esc(t(b.approved ? 'custApproved' : 'custPending'))}</span>` : ''}</b>
          <small>${[b.shop_name ? b.name : '', b.city].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}${b.phone ? ` · <bdi class="ltr">${esc(b.phone)}</bdi>` : ''}</small></span>
          ${tel ? `<a class="iconbtn ink" href="${esc(tel)}" aria-label="${esc(t('call'))}">${I('phone')}</a>` : ''}${wa ? `<a class="iconbtn ink" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="${esc(t('whatsapp'))}">${I('chat')}</a>` : ''}</div>
        ${bal == null ? `<div class="banner note">${I('info')}<span>${esc(t(staff ? 'mrNotYetHim' : 'mrNotYet'))}</span></div>`
          : `<div class="led-bal ${bal > 0 ? 'owe' : bal < 0 ? 'cr' : 'zero'}"><small>${esc(t(k))}</small><b class="num">${esc(money(Math.abs(bal)))}</b></div>
            <div class="astats">${stat(staff ? 'mrBoughtHim' : 'mrBought', money(b.bought))}${stat(staff ? 'mrPaidHim' : 'mrPaid', money(b.paid_later))}${stat('mrBills', fmt(b.invoices.length))}${stat('mrOpen', fmt(b.open_orders), +b.open_orders ? 'warnstat' : '')}</div>`}
      </section>`;
  }
  const inRows = (L, staff) => L.map(v => {
    const done = v.status === 'done', left = done ? Math.max(+v.total - +v.paid, 0) : 0, fresh = !staff && isNew(v);
    const pill = v.status === 'returned' ? `<span class="pill">${esc(t('invReturned'))}</span>` : v.status === 'cancelled' ? `<span class="pill">${esc(t('ordCancelled'))}</span>`
      : v.status === 'preparing' || v.status === 'ready' ? SP.ordPill(v.status)
      /* a credit sale says «آجل» on its line: payments count against the whole account, so the total above is what he owes */
      : left > 0 ? '' : `<span class="pill ok">${esc(t('mrPaidAll'))}</span>`;
    return `<a class="arow inv-row${v.status === 'returned' || v.status === 'cancelled' ? ' ret' : ''}${fresh ? ' fresh' : ''}" href="#${staff ? 'inv-' : 'bill-'}${esc(v.id)}"><span class="inv-badge num">${esc(v.no)}</span>
      <span class="ar-main"><b><span class="num">${esc(money(v.total, v.currency))}</span> ${pill}${fresh ? ` <span class="pill new">${esc(t('mrNew'))}</span>` : ''}</b>
      <small>${[when(v.sent_at || v.created_at), done || v.status === 'returned' ? t('pay_' + v.payment) : '', SP.count(+v.units || 0, 'parts')].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>${I('chevL', 'dirx')}</a>`;
  }).join('');
  const outRows = b => b.orders.map(o => ({ at: o.ordered_at, h: `<a class="arow" href="#order-${esc(o.id)}"><span class="mr-ic">${I('bag')}</span><span class="ar-main"><b>${esc(t('mrOrderNo', { n: o.no }))} ${SP.ordPill(o.status)}</b>
      <small>${[when(o.ordered_at), SP.count(+o.units || 0, 'parts'), o.total != null ? money(o.total, o.currency) : ''].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span>${I('chevL', 'dirx')}</a>` }))
    .concat(b.payments.map(p => ({ at: p.created_at, h: `<div class="arow"><span class="mr-ic pay">${I('wallet')}</span><span class="ar-main"><b>${esc(t('mrPayment'))} <span class="num">${esc(money(p.amount))}</span></b>
      <small>${[when(p.created_at), p.note].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}</small></span></div>` })))
    .sort((x, y) => String(y.at || '').localeCompare(String(x.at || ''))).map(x => x.h).join('');
  function bookTabs(b, tab, staff) {
    const nIn = b.invoices.length, nOut = b.orders.length + b.payments.length;
    const K = staff ? { in: ['mrToHim', 'mrToHimH'], out: ['mrFromHim', 'mrFromHimH'] } : { in: ['mrIn', 'mrInH'], out: ['mrOut', 'mrOutH'] };
    const fresh = staff ? 0 : b.invoices.filter(isNew).length;
    return `<div class="chips light mr-tabs" role="tablist">
        <button type="button" class="chip${tab === 'in' ? ' on' : ''}" data-lt="in" role="tab" aria-selected="${tab === 'in'}">${I('inbox')} ${esc(t(K.in[0]))}<i class="cn num">${esc(fmt(nIn))}</i>${fresh ? `<i class="nbadge">${esc(fmt(fresh))}</i>` : ''}</button>
        <button type="button" class="chip${tab === 'out' ? ' on' : ''}" data-lt="out" role="tab" aria-selected="${tab === 'out'}">${I('outbox')} ${esc(t(K.out[0]))}<i class="cn num">${esc(fmt(nOut))}</i></button></div>
      <p class="hint mr-tabh">${esc(t(tab === 'in' ? K.in[1] : K.out[1]))}</p>
      <section class="mcard mr-list">${tab === 'in' ? (nIn ? inRows(b.invoices, staff) : empty('inbox', t('mrInEmpty'), staff ? '' : t('mrInEmptyB')))
        : (nOut ? outRows(b) : empty('outbox', t('mrOutEmpty'), ''))}</section>`;
  }

  /* the merchant's own page */
  SP.route(/^ledger$/, async (m, n) => {
    if (gate(n)) return;
    if (!S.user) { S.after = 'ledger'; shell(bar(t('mrBookT')) + `<main class="wrap">${empty('lock', t('mrBookT'), t('ordSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return SP.done(n); }
    shell(bar(t('mrBookT')) + `<main class="wrap mine"><div class="sk sk-block"></div></main>`);
    let b;
    try { b = await rpc('my_book'); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!b) { shell(bar(t('mrBookT')) + `<main class="wrap">${empty('store', t('mrNoBook'), t('mrNoBookB'), `<a class="btn btn-ink" href="#mine">${esc(t('tabAccount'))}</a>`)}</main>`); return SP.done(n); }
    /* the tab he chose stays for him (another account on the same phone starts on الوارد) */
    const tab = S.ledTab && S.ledTab.u === S.user.id && S.ledTab.t === 'out' ? 'out' : 'in';
    shell(bar(t('mrBookT')) + `<main class="wrap mine mr-page">${bookHead(b, false)}${bookTabs(b, tab, false)}</main>`);
    $$('[data-lt]').forEach(c => c.onclick = () => { S.ledTab = { u: S.user.id, t: c.dataset.lt }; SP.render(); });
    SP.done(n);
  });

  /* one of his invoices: the same printed page as the company's, to print, save as PDF or share */
  SP.route(/^bill-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    if (!S.user) { S.after = SP.here(); shell(bar(t('mrBookT')) + `<main class="wrap">${empty('lock', t('mrBookT'), t('ordSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return SP.done(n); }
    shell(bar(t('mrBookT')) + `<main class="wrap"><div class="sk sk-block"></div></main>`);
    let v;
    try { v = await rpc('my_bill', { p_id: m[1] }); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!v) { shell(bar(t('mrBookT')) + `<main class="wrap">${empty('lock', t('mrNoBill'), '', `<a class="btn btn-ink" href="#ledger">${esc(t('mrBookT'))}</a>`)}</main>`); return SP.done(n); }
    if (v.sent_at) markSeen(v.id, v.sent_at);
    const canPrint = !SP.CFG.embedded, app = (S.settings || {}).brand_name || SP.CFG.appName || t('app');
    shell(bar(t('invT', { n: v.no }), canPrint ? `<button type="button" class="iconbtn" onclick="window.print()" aria-label="${esc(t('invPrint'))}">${I('copy')}</button>` : '') + `<main class="wrap invoice-wrap">
      ${SP.invoiceDoc(v)}
      <div class="form-actions noprint">${canPrint ? `<button type="button" class="btn btn-ink" onclick="window.print()">${I('copy')} ${esc(t('invPrint'))}</button>` : ''}
        <button type="button" class="btn btn-ghost" id="bsh">${I('share')} ${esc(t('mrShare'))}</button>
        <a class="btn btn-ghost" href="#ledger">${I('inbox')} ${esc(t('mrBookT'))}</a></div></main>`);
    $('#bsh').onclick = () => {
      const items = (v.items || []).map(it => `• ${it.title} × ${it.qty} = ${money(it.line_total, v.currency)}`).join('\n');
      SP.share(t('invT', { n: v.no }), t('invMsg', { n: v.no, app, items, t: money(v.total, v.currency) }), SP.siteUrl());
    };
    SP.done(n);
  });

  /* ---------- the staff: «التجار» ---------- */
  SP.route(/^merchants$/, async (m, n) => {
    if (gate(n)) return;
    if (!SP.merchantsCan()) { shell(bar(t('mrT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    const f = S.mrF || '', q = S.mrQ || '';
    shell(bar(t('mrT')) + `<main class="wrap">
      <form class="searchbox flat" id="mrq" role="search">${I('search')}<input type="search" value="${esc(q)}" placeholder="${esc(t('mrSearchPh'))}" aria-label="${esc(t('search'))}" enterkeyhint="search"></form>
      <div class="chips light mr-filter">${[['', 'mrAll', 'all'], ['pending', 'mrPending', 'pending'], ['orders', 'mrWithOrders', 'orders'], ['owing', 'mrOwing', 'owing']]
        .map(([k, l, c]) => `<button type="button" class="chip${f === k ? ' on' : ''}" data-f="${k}">${esc(t(l))}<i class="cn num" data-c="${c}"></i></button>`).join('')}</div>
      <div id="ml"><div class="sk sk-row"></div><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    $$('[data-f]').forEach(b => b.onclick = () => { S.mrF = b.dataset.f; SP.render(); });
    $('#mrq').onsubmit = e => { e.preventDefault(); S.mrQ = $('input', e.target).value.trim(); SP.render(); };
    const row = r => {
      const bal = r.balance == null ? null : +r.balance;
      return `<a class="arow" href="#merchant-${esc(r.user_id)}"><span class="hexav"><span>${esc(SP.initial(shopOf(r)))}</span></span>
        <span class="ar-main"><b>${esc(shopOf(r))} ${r.approved ? '' : `<span class="pill demo">${esc(t('custPending'))}</span>`}${+r.open_orders ? ` <span class="opill preparing">${esc(t('mrOpen'))} ${esc(fmt(r.open_orders))}</span>` : ''}</b>
          <small>${[r.shop_name ? r.name : '', r.city].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}${r.phone ? ` · <bdi class="ltr">${esc(r.phone)}</bdi>` : ''}</small></span>
        ${bal ? `<b class="num ${bal > 0 ? 'owe-t' : 'cr-t'}">${esc(money(Math.abs(bal)))}</b>` : ''}${I('chevL', 'dirx')}</a>`;
    };
    await SP.pager(n, $('#ml'), $('#more'), off => rpc('list_merchants', { p_q: q || null, p_filter: f || null, p_limit: 30, p_offset: off }), items => items.map(row).join(''), (r, first) => {
      if (!first) return;
      const c = r.counts || {};
      ['all', 'pending', 'orders', 'owing'].forEach(k => { const el = $(`[data-c="${k}"]`); if (el) el.textContent = +c[k] ? SP.fmtNum(+c[k]) : ''; });
      if (!r.total) $('#ml').innerHTML = q || f ? empty('search', t('mrNoHit'), '') : empty('store', t('mrEmpty'), t('mrEmptyB'));
    });
    SP.done(n);
  });

  /* one merchant, as the staff see him: approve, a new password, a payment, his «صادر ووارد» */
  SP.route(/^merchant-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    if (!SP.merchantsCan()) { shell(bar(t('mrT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    shell(bar(t('mrT')) + `<main class="wrap mine"><div class="sk sk-block"></div></main>`);
    let b;
    try { b = await rpc('merchant_detail', { p_user: m[1] }); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!b) { shell(bar(t('mrT')) + `<main class="wrap">${empty('store', t('mrNoHit'), '', `<a class="btn btn-ink" href="#merchants">${esc(t('mrT'))}</a>`)}</main>`); return SP.done(n); }
    const reload = async () => { try { const x = await rpc('merchant_detail', { p_user: b.user_id }); if (x && SP.alive(n)) { b = x; draw(); } } catch (e) { SP.toast(SP.errText(e)); } };
    const draw = () => {
      const tab = S.mrTab && S.mrTab.u === b.user_id && S.mrTab.t === 'out' ? 'out' : 'in', canPay = SP.can('invoices') && b.approved && /^p:/.test(b.key || '') && b.invoices.length;
      shell(bar(shopOf(b)) + `<main class="wrap mine mr-page">${bookHead(b, true)}
        <div class="form-actions mr-acts">${SP.can('customers') ? `<button type="button" class="btn ${b.approved ? 'btn-ghost' : 'btn-signal'}" id="mapp">${I(b.approved ? 'close' : 'verified')} ${esc(t(b.approved ? 'unapproveBtn' : 'approveBtn'))}</button>` : ''}
          ${canPay ? `<button type="button" class="btn btn-ghost" id="mpay">${I('plus')} ${esc(t('buyPay'))}</button>` : ''}
          ${S.admin ? `<button type="button" class="btn btn-ghost" id="mpw">${I('key')} ${esc(t('mrPw'))}</button>` : ''}</div>
        ${bookTabs(b, tab, true)}</main>`);
      $$('[data-lt]').forEach(c => c.onclick = () => { S.mrTab = { u: b.user_id, t: c.dataset.lt }; draw(); });
      if ($('#mapp')) $('#mapp').onclick = async () => {
        const btn = $('#mapp'); btn.classList.add('busy');
        try { await SP.api.approve(b.user_id, !b.approved); SP.toast(t('custSaved')); await reload(); } catch (e) { SP.toast(SP.errText(e)); btn.classList.remove('busy'); }
      };
      if ($('#mpay') && SP.bk && SP.bk.paySheet) $('#mpay').onclick = () => SP.bk.paySheet({ title: t('buyPay'), name: shopOf(b), suggest: +b.balance || 0,
        save: (amt, note) => rpc('add_customer_payment', { p_key: b.key, p_amount: amt, p_note: note }), done: () => reload() });
      if ($('#mpw')) $('#mpw').onclick = () => passwordSheet(b);
    };
    draw();
    SP.done(n);
  });

  /* the owner gives a merchant a new password and sends it to him (a merchant who signs in with his phone has no email) */
  function passwordSheet(b) {
    const pw = String(100000 + Math.floor(Math.random() * 900000));
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('mrPw'))}</h2><p class="sheet-sub">${esc(shopOf(b))}</p>
      <form class="form" id="pwf" novalidate><div class="field"><label for="pwi">${esc(t('mrPw'))}</label><input id="pwi" class="input num" dir="ltr" maxlength="72" autocomplete="off" value="${esc(pw)}"><span class="hint">${esc(t('mrPwB'))}</span></div>
        <p class="form-err" id="pwe" role="alert"></p><div class="sheet-actions" id="pwa"><button class="btn btn-signal">${I('key')} ${esc(t('mrPwSave'))}</button></div></form>`, { label: t('mrPw') });
    $('#pwf', s.el).onsubmit = async e => {
      e.preventDefault();
      const v = $('#pwi', s.el).value.trim(), btn = $('#pwf button', s.el);
      if (v.length < 6) { $('#pwe', s.el).textContent = t('shortPass'); return; }
      btn.classList.add('busy');
      try {
        await rpc('set_customer_password', { p_user: b.user_id, p_pw: v });
        const app = (S.settings || {}).brand_name || SP.CFG.appName || t('app'), wa = SP.waLink(b.phone, t('mrPwWa', { app, p: v }), S.country);
        $('#pwi', s.el).readOnly = true; $('#pwe', s.el).textContent = '';
        $('#pwa', s.el).innerHTML = `<p class="hint ok-t">${I('check')} ${esc(t('mrPwDone'))}</p>${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('mrPwSend'))}</a>` : ''}
          <button type="button" class="btn btn-ghost" data-close>${esc(t('close'))}</button>`;
      } catch (x) { $('#pwe', s.el).textContent = SP.errText(x); btn.classList.remove('busy'); }
    };
  }

  /* ---------- «ابعث الفاتورة للتاجر» on the invoice (js/pos.js) and the order (js/orders.js) ---------- */
  SP.sendPanel = v => {
    if (!canSend() || !v || v.status === 'cancelled') return '';
    const to = v.merchant ? shopOf(v.merchant) : v.source === 'app' ? v.customer_name : '';
    const known = !!(v.customer_id || v.source === 'app');
    return `<section class="mcard send-card noprint"><div class="sc-head">${I('send')}<span><b>${esc(t('mrSendT'))}</b><small>${esc(t('mrSendH'))}</small></span></div>
      ${v.sent_at ? `<p class="sc-sent">${I('check')} ${esc(t('mrSentTo', { s: to || '—', d: when(v.sent_at) }))}</p>` : ''}
      <div class="form-actions"><button type="button" class="btn ${v.sent_at ? 'btn-ghost' : 'btn-signal'}" id="snd">${I('send')} ${esc(v.sent_at ? t('mrSendAgain') : known && to ? t('mrSendBtn', { s: to }) : t('mrSendPick'))}</button>
        ${v.sent_at ? `<button type="button" class="btn btn-ghost danger-txt" id="unsnd">${esc(t('mrUnsend'))}</button>` : ''}</div></section>`;
  };
  SP.wireSend = (v, redraw) => {
    const b = $('#snd'), u = $('#unsnd'), to = v.merchant ? shopOf(v.merchant) : v.customer_name || '';
    const send = async user => {
      if (b) b.classList.add('busy');
      try { const r = await rpc('send_invoice', { p_id: v.id, p_user: user || null }); SP.toast(t('mrSentOk')); redraw(r); }
      catch (e) { SP.toast(sendErr(e)); if (b) b.classList.remove('busy'); }
    };
    if (b) b.onclick = () => v.customer_id || v.source === 'app' ? send() : pick(v, send);
    if (u) u.onclick = async () => {
      if (!await SP.confirmSheet({ title: t('mrUnsend'), body: t('mrUnsendQ', { s: to }), ok: t('mrUnsend'), danger: true })) return;
      try { const r = await rpc('unsend_invoice', { p_id: v.id }); SP.toast(t('mrUnsent')); redraw(r); } catch (e) { SP.toast(sendErr(e)); }
    };
  };
  /* an invoice from the till: whose is it? Starts with the number written on the invoice */
  function pick(v, send) {
    const first = SP.digits(v.customer_phone || '').replace(/\D/g, '').slice(-9) || v.customer_name || '';
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('mrPickT'))}</h2><p class="sheet-sub">${esc(t('mrPickH'))}</p>
      <form class="searchbox flat" id="pkf" role="search">${I('search')}<input type="search" id="pkq" value="${esc(first)}" placeholder="${esc(t('mrSearchPh'))}" aria-label="${esc(t('search'))}" enterkeyhint="search"></form>
      <div id="pkl" class="pk-list"></div>`, { label: t('mrPickT') });
    const mine = SP.digits(v.customer_phone || '').replace(/\D/g, '').slice(-9);
    const find = async () => {
      const q = $('#pkq', s.el).value.trim(), box = $('#pkl', s.el);
      box.innerHTML = '<div class="sk sk-row"></div>';
      let L;
      try { L = await rpc('find_merchants', { p_q: q || null, p_limit: 20 }); } catch (e) { box.innerHTML = `<p class="form-err">${esc(SP.errText(e))}</p>`; return; }
      box.innerHTML = L.length ? L.map(c => `<button type="button" class="arow pk-row" data-u="${esc(c.user_id)}"><span class="hexav"><span>${esc(SP.initial(shopOf(c)))}</span></span>
          <span class="ar-main"><b>${esc(shopOf(c))}${mine && SP.digits(c.phone).replace(/\D/g, '').slice(-9) === mine ? ` <span class="pill ok">${esc(t('mrPickSame'))}</span>` : ''}</b>
          <small>${[c.shop_name ? c.name : '', c.city].filter(Boolean).map(x => `<bdi>${esc(x)}</bdi>`).join(' · ')}${c.phone ? ` · <bdi class="ltr">${esc(c.phone)}</bdi>` : ''}</small></span></button>`).join('')
        : `<p class="muted-p">${esc(t('mrPickNone'))}</p>`;
      $$('[data-u]', box).forEach(x => x.onclick = async () => {
        const c = L.find(y => y.user_id === x.dataset.u);
        s.close();
        if (await SP.confirmSheet({ title: t('mrSendT'), body: t('mrPickQ', { n: v.no, s: shopOf(c) }), ok: t('mrSendBtn', { s: shopOf(c) }) })) send(c.user_id);
      });
    };
    $('#pkf', s.el).onsubmit = e => { e.preventDefault(); find(); };
    $('#pkq', s.el).addEventListener('input', SP.debounce(find, 350));
    find();
  }
})();
