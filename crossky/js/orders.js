/* Customer orders in the app (طلبات الزبائن). The customer orders from the basket itself, not on WhatsApp. The order is an
   invoice in the sales system: «قيد التجهيز» (preparing), then «قيد الاستلام» (ready: waiting to be received), then
   «تم الاستلام» (received: a sale like any other from then on), or «ملغي» (cancelled: the parts go back to stock).
   Customers: «أكّد الطلب» in the basket (js/company.js calls SP.orderForm), «طلباتي», and each order's page showing where it
   stands. Staff: «الطلبات» in the System tab with a count on the tab, and the order page with its next step.
   The rules are in supabase/setup.sql section 15 (and the same in js/demo.js). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, shell, bar, empty, gate } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };

  Object.assign(window.SP_IC, {
    truck: window.SP_IC.truck || '<path d="M3 6h11v10H3z"/><path d="M14 9.5h3.8L21 13v3h-7"/><circle cx="7" cy="17.8" r="1.8"/><circle cx="17.2" cy="17.8" r="1.8"/>',
    pickup: '<path d="M4 9.5 12 4l8 5.5V20H4z"/><path d="M9.5 20v-6h5v6"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.2a2.2 2.2 0 0 0 4 0"/>'
  });
  Object.assign(SP.L.T, {
    ordT: ["الطلبات", "Orders"], ordMine: ["طلباتي", "My orders"], ordNo: ["طلب رقم {n}", "Order {n}"], ordGoCart: ["كمّل الطلب", "Checkout"],
    ordPreparing: ["قيد التجهيز", "Being prepared"], ordReady: ["قيد الاستلام", "Ready"], ordDone: ["تم الاستلام", "Received"], ordCancelled: ["ملغي", "Cancelled"],
    ordOpen: ["المفتوحة", "Open"], ordFromApp: ["طلب من التطبيق", "App order"],
    /* the basket */
    ordConfirmT: ["تأكيد الطلب", "Confirm the order"], ordGo: ["أكّد الطلب", "Place order"], ordHow: ["كيف تستلم طلبك؟", "How will you get it?"],
    ordPickup: ["استلام من الفرع", "Pick up at the branch"], ordPickupB: ["تستلمه بنفسك من {b}", "You collect it at {b}"], ordPickupB0: ["تستلمه بنفسك من الفرع", "You collect it at the branch"],
    ordDelivery: ["توصيل", "Delivery"], ordDeliveryB: ["نوصلوه لعنوانك", "We bring it to your address"],
    ordAddr: ["العنوان", "Address"], ordAddrPh: ["المدينة، الحي، أقرب نقطة دالة", "City, area, nearest landmark"],
    ordPay: ["الدفع عند الاستلام: كاش أو بطاقة.", "Pay when you receive it: cash or card."],
    ordSignInT: ["سجّل دخولك باش تأكد الطلب", "Sign in to place the order"], ordSignInB: ["طلبك يبقى محفوظ، وتتابعه خطوة بخطوة في «طلباتي».", "Your basket stays, and you follow the order step by step in My orders."],
    ordNewAcc: ["حساب جديد", "Create account"], ordPlaced: ["وصل طلبك رقم {n}", "Order {n} received"],
    ordNeedPhone: ["اكتب رقم هاتف صحيح نتواصلو معاك عليه.", "Enter a phone number we can reach you on."], ordNeedAddr: ["اكتب العنوان للتوصيل.", "Enter the delivery address."],
    ordNoStock: ["المتوفر من «{t}» {n} بس، وعدّلت الكمية في طلبك.", "Only {n} of “{t}” in stock; the basket has been updated."],
    ordNoStockH: ["الكمية المطلوبة من «{t}» مش متوفرة. نقّص العدد.", "Not enough “{t}” in stock. Lower the quantity."],
    ordGone: ["«{t}» ما عادتش متوفرة وتشالت من طلبك.", "“{t}” is no longer available and was removed."], ordGone0: ["قطعة في طلبك ما عادتش متوفرة.", "A part in your basket is no longer available."],
    ordNoPrice: ["«{t}» سعرها يتحدد مع الشركة. تواصل معاهم عليها.", "“{t}” is priced on request. Contact the company about it."],
    ordClosedErr: ["الطلبات مقفولة توا. جرّب بعدين.", "Orders are closed right now. Try later."], ordTooMany: ["عندك 5 طلبات مفتوحة. استنى لين تستلمهم.", "You have 5 open orders. Wait until they are received."],
    ordSignIn: ["سجّل دخولك باش تطلب.", "Sign in to order."], ordNoCancel: ["الطلب صار جاهز وما عادش ينلغى. تواصل مع الفرع.", "The order is ready and can no longer be cancelled. Contact the branch."],
    ordMoved: ["حالة الطلب تغيّرت. تحدّثت الصفحة.", "The order changed meanwhile. The page has been updated."],
    /* the customer's orders */
    ordNoneT: ["ما عندكش طلبات", "No orders yet"], ordNoneB: ["زيد القطع لطلبك وأكّده من السلة.", "Add parts to your basket and confirm it."],
    ordMineB: ["{n} مفتوحة", "{n} open"], ordMineB0: ["تابع طلباتك", "Follow your orders"],
    ordSinglePrep: ["وصل طلبك وقاعدين نجهزوه.", "We got your order and are preparing it."],
    ordSingleReadyP: ["طلبك جاهز. تقدر تستلمه من {b}.", "Your order is ready to collect at {b}."], ordSingleReadyP0: ["طلبك جاهز. تقدر تستلمه من الفرع.", "Your order is ready to collect at the branch."],
    ordSingleReadyD: ["طلبك جاهز وبيوصلك على عنوانك.", "Your order is ready and on its way to you."],
    ordSingleDone: ["استلمت طلبك. شكراً لتعاملك معانا!", "You received your order. Thank you!"], ordSingleCancelled: ["الطلب تلغى.", "This order was cancelled."],
    ordByCustomer: ["لغيته انت", "You cancelled it"], ordReason: ["السبب: {r}", "Reason: {r}"],
    ordStepAt: ["{d}", "{d}"], ordItems: ["القطع", "Parts"], ordTotal: ["المجموع", "Total"], ordTotalHidden: ["السعر يأكدهولك المحل", "The shop confirms the price"],
    ordWhere: ["الاستلام", "Getting it"], ordCustomer: ["الزبون", "Customer"], ordNote: ["ملاحظة", "Note"],
    ordCancelMine: ["إلغاء الطلب", "Cancel order"], ordCancelMineQ: ["تلغي الطلب رقم {n}؟", "Cancel order {n}?"], ordCancelledToast: ["تلغى الطلب", "Order cancelled"],
    ordCall: ["اتصل بالفرع", "Call the branch"], ordReadyNote: ["طلبك رقم {n} جاهز", "Order {n} is ready"],
    /* staff */
    ordNew: ["طلب جديد من التطبيق: رقم {n}", "New app order: {n}"], ordStaffPrep: ["جهّز القطع، وبعدها اضغط «جاهز».", "Prepare the parts, then tap Ready."],
    ordStaffReadyP: ["الزبون بيجي يستلمه من الفرع.", "The customer will collect it at the branch."], ordStaffReadyD: ["في الطريق للزبون.", "On its way to the customer."],
    ordStaffDone: ["تسلّم، وصار فاتورة بيع.", "Received; it is now a sale."],
    ordToReady: ["جاهز للاستلام", "Ready"], ordToDone: ["تم الاستلام", "Received"], ordCancel: ["إلغاء الطلب", "Cancel order"],
    ordHowPaid: ["كيف دفع الزبون؟", "How did the customer pay?"], ordDoneOk: ["تم الاستلام ودخلت في المبيعات: فاتورة رقم {n}", "Received and recorded as sale {n}"],
    ordReadyOk: ["الطلب رقم {n} جاهز للاستلام", "Order {n} is ready"], ordCancelQ: ["إلغاء الطلب رقم {n}؟ القطع ترجع للمخزن.", "Cancel order {n}? The parts go back to stock."],
    ordCancelReason: ["السبب (اختياري)", "Reason (optional)"], ordCancelReasonPh: ["مثلاً: الزبون ما ردش", "e.g. the customer didn’t answer"], ordCancelOk: ["تلغى الطلب ورجعت القطع للمخزن", "Order cancelled; the parts are back in stock"],
    ordOpenInv: ["افتح الفاتورة", "Open the invoice"], ordOpenOrder: ["افتح الطلب", "Open the order"],
    ordEmptyOpen: ["ما فيش طلبات مفتوحة", "No open orders"], ordEmptyB: ["الطلبات اللي يبعتوها الزبائن من التطبيق تطلع هني.", "Orders customers place in the app appear here."],
    ordAgo: ["{a}", "{a}"], ordWaCust: ["واتساب", "WhatsApp"], ordCallCust: ["اتصال", "Call"],
    ordInvBanner: ["{s}: هذي الفاتورة طلب من التطبيق، وتدخل في المبيعات لما يتسلم.", "{s}: this is an app order; it counts as a sale once received."]
  });

  /* ---------- the server ---------- */
  const O = {
    place: p => sb().rpc('place_order', { p }).then(chk),
    mine: () => sb().rpc('my_orders', { p_limit: 30 }).then(chk),
    one: id => sb().rpc('my_order', { p_id: id }).then(chk),
    cancelMine: id => sb().rpc('cancel_my_order', { p_id: id }).then(chk),
    list: (status, off, lim) => sb().rpc('list_orders', { p_status: status || null, p_limit: lim || 30, p_offset: off || 0 }).then(chk),
    set: (id, status, pay, reason) => sb().rpc('order_set', { p_id: id, p_status: status, p_payment: pay || null, p_reason: reason || null }).then(chk)
  };
  SP.orders = O;
  const ST = { preparing: 'ordPreparing', ready: 'ordReady', done: 'ordDone', cancelled: 'ordCancelled', returned: 'invReturned' };
  const OPEN = s => s === 'preparing' || s === 'ready';
  SP.ordPill = s => ST[s] ? `<span class="opill ${esc(s)}">${esc(t(ST[s]))}</span>` : '';
  const handles = () => !!(S.user && SP.isStaff && SP.isStaff() && (SP.can('sales') || SP.can('invoices')));
  const money = (v, c) => SP.priceText(+v, c || SP.currencyOf(S.country));
  const when = v => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(v)); } catch (e) { return String(v).slice(0, 16).replace('T', ' '); } };
  const ago = v => v ? SP.ago(new Date(v).getTime()) : '';

  SP.ordErr = e => {
    const m = String((e && e.message) || e || '');
    let x;
    if ((x = /not enough stock: (.+?) \(available (-?\d+)\)$/.exec(m))) return t('ordNoStock', { t: x[1], n: SP.fmtNum(Math.max(0, +x[2])) });
    if ((x = /not enough stock: (.+)$/.exec(m))) return t('ordNoStockH', { t: x[1] });
    if ((x = /part not available: (.*)$/.exec(m))) return x[1] ? t('ordGone', { t: x[1] }) : t('ordGone0');
    if ((x = /part has no price: (.+)$/.exec(m))) return t('ordNoPrice', { t: x[1] });
    if (/orders are closed/.test(m)) return t('ordClosedErr');
    if (/too many open orders/.test(m)) return t('ordTooMany');
    if (/order needs a name/.test(m)) return t('needCustName');
    if (/order needs a phone/.test(m)) return t('ordNeedPhone');
    if (/delivery needs an address/.test(m)) return t('ordNeedAddr');
    if (/order can no longer be cancelled/.test(m)) return t('ordNoCancel');
    if (/bad order status/.test(m)) return t('ordMoved');
    if (/sign in to order/.test(m)) return t('ordSignIn');
    return SP.errText(e);
  };

  /* ---------- the basket's «أكّد الطلب» (js/company.js draws the parts, this the form) ---------- */
  const DRAFT = 'sp_order_draft';
  const draft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT) || '{}') || {}; } catch (e) { return {}; } };
  const keepDraft = v => { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  SP.orderForm = list => {
    const closed = SP.shopClosed && SP.shopClosed();
    /* closed by the owner: say so to everyone, before any sign-in */
    if (closed) return `<div class="ord-closed">${SP.closedBanner()}<div class="form-actions"><button type="button" class="btn btn-ghost" id="oclr">${I('trash')} ${esc(t('clearCart'))}</button></div></div>`;
    if (!S.user) {
      return `<section class="mcard ord-signin">${I('user')}<div><h2>${esc(t('ordSignInT'))}</h2><p>${esc(t('ordSignInB'))}</p>
        <div class="form-actions"><a class="btn btn-signal" href="#login" data-after="cart">${esc(t('signIn'))}</a><a class="btn btn-ghost" href="#signup" data-after="cart">${esc(t('ordNewAcc'))}</a>
        <button type="button" class="btn btn-ghost" id="oclr">${I('trash')} ${esc(t('clearCart'))}</button></div></div></section>`;
    }
    const c = S.customer || {}, d = draft(), how = d.delivery === 'delivery' ? 'delivery' : 'pickup';
    const br = list[0] && list[0].p && list[0].p.shop && list[0].p.shop.name;
    return `<form class="form mcard ord-form" id="of" novalidate><h2 class="lbl">${esc(t('ordConfirmT'))}</h2>
      <div class="row2"><div class="field"><label for="on">${esc(t('custName'))}</label><input id="on" class="input" maxlength="80" autocomplete="name" value="${esc(d.name || c.name || '')}"></div>
        <div class="field"><label for="op">${esc(t('phoneNum'))}</label><input id="op" class="input" type="tel" dir="ltr" maxlength="30" autocomplete="tel" value="${esc(d.phone || c.phone || '')}"></div></div>
      <fieldset class="field ord-how"><legend>${esc(t('ordHow'))}</legend>
        <label class="howopt"><input type="radio" name="ohow" value="pickup"${how === 'pickup' ? ' checked' : ''}><span>${I('pickup')}<b>${esc(t('ordPickup'))}</b><small>${esc(br ? t('ordPickupB', { b: br }) : t('ordPickupB0'))}</small></span></label>
        <label class="howopt"><input type="radio" name="ohow" value="delivery"${how === 'delivery' ? ' checked' : ''}><span>${I('truck')}<b>${esc(t('ordDelivery'))}</b><small>${esc(t('ordDeliveryB'))}</small></span></label></fieldset>
      <div class="field" id="oaw"${how === 'delivery' ? '' : ' hidden'}><label for="oa">${esc(t('ordAddr'))}</label><textarea id="oa" class="input" rows="2" maxlength="300" placeholder="${esc(t('ordAddrPh'))}">${esc(d.address || c.city || '')}</textarea></div>
      <div class="field"><label for="ox">${esc(t('cartNote'))}</label><textarea id="ox" class="input" rows="2" maxlength="500" placeholder="${esc(t('cartNotePh'))}">${esc(d.note || '')}</textarea></div>
      <p class="ord-pay">${I('info')} ${esc(t('ordPay'))}</p>
      <p class="form-err" id="oerr" role="alert"></p>
      <div class="form-actions"><button class="btn btn-signal" id="ogo">${I('check')} ${esc(t('ordGo'))}</button>
        <button type="button" class="btn btn-ghost" id="oclr">${I('trash')} ${esc(t('clearCart'))}</button></div></form>`;
  };
  /* list: the basket's lines with their parts ({id, qty, p}); redraw: draws the basket again after a change */
  SP.orderWire = (list, redraw) => {
    $('#oclr').onclick = () => { SP.cart.clear(); keepDraft({}); SP.toast(t('cartCleared')); SP.render(); };
    $$('[data-after]').forEach(a => a.addEventListener('click', () => { S.after = a.dataset.after; }));
    const f = $('#of');
    if (!f) return;
    const val = () => ({ name: $('#on').value.trim(), phone: SP.digits($('#op').value).trim(), delivery: ($('input[name=ohow]:checked', f) || {}).value || 'pickup', address: $('#oa').value.trim(), note: $('#ox').value.trim() });
    f.addEventListener('input', e => { keepDraft(val()); if (e.target.classList.contains('invalid')) { e.target.classList.remove('invalid'); $('#oerr').textContent = ''; } });
    f.addEventListener('change', e => { if (e.target.name === 'ohow') { $('#oaw').hidden = e.target.value !== 'delivery'; if (e.target.value === 'delivery') $('#oa').focus(); } keepDraft(val()); });
    f.onsubmit = async e => {
      e.preventDefault();
      const v = val(), err = $('#oerr'), b = $('#ogo');
      if (!b) return;
      err.textContent = ''; $$('.invalid', f).forEach(x => x.classList.remove('invalid'));
      const bad = (id, k) => { err.textContent = t(k); $(id).classList.add('invalid'); $(id).focus(); };
      if (v.name.length < 2) return bad('#on', 'needCustName');
      if (v.phone.replace(/\D/g, '').length < 7) return bad('#op', 'ordNeedPhone');
      if (v.delivery === 'delivery' && v.address.length < 5) return bad('#oa', 'ordNeedAddr');
      b.classList.add('busy');
      try {
        const o = await O.place({ ...v, items: list.map(i => ({ id: i.id, qty: i.qty })) });
        SP.cart.clear(); keepDraft({});
        if (!S.customer && SP.api.saveMe) SP.api.saveMe({ name: v.name, phone: v.phone, city: '' }).catch(() => {});
        SP.toast(t('ordPlaced', { n: o.no }));
        watchSoon();
        SP.go('order-' + o.id);
      } catch (x) {
        const m = String((x && x.message) || '');
        let k;
        /* the basket follows what is really there */
        if ((k = /not enough stock: (.+?) \(available (-?\d+)\)$/.exec(m))) { const it = list.find(i => i.p.title === k[1]); if (it) SP.cart.qty(it.id, Math.max(0, +k[2])); }
        else if ((k = /part not available: (.+)$/.exec(m))) { const it = list.find(i => i.p.title === k[1]); if (it) SP.cart.qty(it.id, 0); }
        const msg = SP.ordErr(x);
        if (k && redraw) { redraw(); const e2 = $('#oerr'); if (e2) e2.textContent = msg; } else err.textContent = msg;
      } finally { const b2 = $('#ogo'); if (b2) b2.classList.remove('busy'); }
    };
  };

  /* ---------- an order: where it stands ---------- */
  const STEPS = [['preparing', 'ordPreparing', 'ordered_at'], ['ready', 'ordReady', 'ready_at'], ['done', 'ordDone', 'done_at']];
  function stepper(o) {
    if (o.status === 'cancelled') return `<div class="ostat cancelled">${I('close')}<div><b>${esc(t('ordCancelled'))}</b><small>${esc(o.cancel_reason === 'customer' ? t('ordByCustomer') : o.cancel_reason ? t('ordReason', { r: o.cancel_reason }) : when(o.cancelled_at))}</small></div></div>`;
    const at = Math.max(0, STEPS.findIndex(s => s[0] === (o.status === 'returned' ? 'done' : o.status)));
    return `<ol class="osteps" aria-label="${esc(t(ST[o.status] || 'ordPreparing'))}">${STEPS.map(([k, l, f], i) => `<li class="${i < at ? 'did' : i === at ? (k === 'done' ? 'did' : 'now') : ''}"${i === at ? ' aria-current="step"' : ''}>
      <span class="dot">${i < at || (i === at && k === 'done') ? I('check') : ''}</span><b>${esc(t(l))}</b><small>${o[f] ? esc(when(o[f])) : ''}</small></li>`).join('')}</ol>`;
  }
  function lineFor(o, staff) {
    const br = o.branch && o.branch.name;
    if (o.status === 'preparing') return staff ? t('ordStaffPrep') : t('ordSinglePrep');
    if (o.status === 'ready') return staff ? t(o.delivery === 'delivery' ? 'ordStaffReadyD' : 'ordStaffReadyP') : o.delivery === 'delivery' ? t('ordSingleReadyD') : br ? t('ordSingleReadyP', { b: br }) : t('ordSingleReadyP0');
    if (o.status === 'done' || o.status === 'returned') return staff ? t('ordStaffDone') : t('ordSingleDone');
    return t('ordSingleCancelled');
  }
  SP.route(/^order-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    if (!S.user) { S.after = SP.here(); shell(bar(t('ordMine')) + `<main class="wrap">${empty('lock', t('ordMine'), t('ordSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return SP.done(n); }
    shell(bar(t('ordMine')) + `<main class="wrap form-wrap"><div class="sk sk-block"></div></main>`);
    let o;
    try { o = await O.one(m[1]); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!o) { shell(bar(t('ordMine')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    const staff = handles(), act = staff && SP.can('sales');
    const draw = o => {
      const cur = o.currency, br = o.branch || {}, priced = o.total != null;
      const tel = SP.telHref(o.customer_phone, S.country), wa = SP.waLink(o.customer_phone, '', S.country), btel = SP.telHref(br.phone || br.whatsapp, S.country);
      shell(bar(t('ordNo', { n: o.no })) + `<main class="wrap form-wrap ord-page">
        <section class="mcard ord-hero st-${esc(o.status)}"><div class="oh-top"><span class="oh-no">${esc(t('ordNo', { n: o.no }))}</span>${SP.ordPill(o.status)}</div>
          <p class="oh-line">${esc(lineFor(o, staff))}</p>${stepper(o)}</section>
        ${act && OPEN(o.status) ? `<div class="ord-acts">${o.status === 'preparing' ? `<button type="button" class="btn btn-signal" data-to="ready">${I('bell')} ${esc(t('ordToReady'))}</button>` : ''}
            <button type="button" class="btn ${o.status === 'ready' ? 'btn-signal' : 'btn-ghost'}" data-to="done">${I('check')} ${esc(t('ordToDone'))}</button>
            <button type="button" class="btn btn-ghost danger-txt" data-to="cancelled">${esc(t('ordCancel'))}</button></div>` : ''}
        ${staff && (o.status === 'done' || o.status === 'returned') ? `<div class="ord-acts"><a class="btn btn-ink" href="#inv-${esc(o.id)}">${I('copy')} ${esc(t('ordOpenInv'))}</a></div>` : ''}
        <section class="mcard"><h2 class="lbl">${esc(t('ordItems'))}</h2><ul class="olines">${(o.items || []).map(it => `<li><span class="ol-q num">${esc(SP.fmtNum(it.qty))}×</span>
            <span class="ol-t">${it.product_id ? `<a href="#p-${esc(it.product_id)}">${esc(it.title)}</a>` : esc(it.title)}${it.sku ? `<small dir="ltr">${esc(it.sku)}</small>` : ''}</span>
            <span class="num">${it.line_total != null ? esc(money(it.line_total, cur)) : ''}</span></li>`).join('')}</ul>
          <p class="ol-tot"><span>${esc(t('ordTotal'))}</span><b class="num">${priced ? esc(money(o.total, cur)) : esc(t('ordTotalHidden'))}</b></p>
          ${o.payment && !OPEN(o.status) ? `<p class="hint">${esc(t('posPay'))}: ${esc(t('pay_' + o.payment))}</p>` : ''}</section>
        <section class="mcard ord-where"><h2 class="lbl">${esc(t('ordWhere'))}</h2>
          ${o.delivery === 'delivery' ? `<p>${I('truck')}<span><b>${esc(t('ordDelivery'))}</b><small>${esc(o.address)}</small></span></p>`
            : `<p>${I('pickup')}<span><b>${esc(t('ordPickup'))}</b><small>${esc([br.name, br.area, br.city].filter(Boolean).join(' · '))}</small></span>${!staff && btel ? `<a class="btn btn-ghost sm" href="${esc(btel)}">${I('phone')} ${esc(t('ordCall'))}</a>` : ''}</p>`}
          ${staff ? `<p>${I('user')}<span><b>${esc(o.customer_name)}</b><small dir="ltr">${esc(SP.prettyPhone(o.customer_phone, S.country))}</small></span>
              ${tel ? `<a class="iconbtn ink" href="${esc(tel)}" aria-label="${esc(t('ordCallCust'))}">${I('phone')}</a>` : ''}${wa ? `<a class="iconbtn ink" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="${esc(t('ordWaCust'))}">${I('chat')}</a>` : ''}</p>` : ''}
          ${o.note ? `<p>${I('info')}<span><b>${esc(t('ordNote'))}</b><small>${esc(o.note)}</small></span></p>` : ''}</section>
        ${!staff && o.status === 'preparing' ? `<div class="ord-acts"><button type="button" class="btn btn-ghost danger-txt" id="ocx">${esc(t('ordCancelMine'))}</button></div>` : ''}</main>`);
      if ($('#ocx')) $('#ocx').onclick = async () => {
        if (!await SP.confirmSheet({ title: t('ordCancelMine'), body: t('ordCancelMineQ', { n: o.no }), ok: t('ordCancelMine'), danger: true })) return;
        try { draw(await O.cancelMine(o.id)); SP.toast(t('ordCancelledToast')); watchSoon(); } catch (e) { SP.toast(SP.ordErr(e)); reload(); }
      };
      $$('[data-to]').forEach(b => b.onclick = () => step(o, b.dataset.to));
    };
    const reload = async () => { try { const x = await O.one(o.id); if (x && SP.alive(n)) { o = x; draw(o); } } catch (e) { /* stays */ } };
    async function step(o, to) {
      if (to === 'ready') {
        try { await O.set(o.id, 'ready'); SP.toast(t('ordReadyOk', { n: o.no })); } catch (e) { SP.toast(SP.ordErr(e)); }
        await reload(); watchSoon(); return;
      }
      if (to === 'done') {
        let pay = 'cash';
        const ok = await new Promise(res => {
          let yes = false;
          SP.openSheet(`<h2 class="sheet-title">${esc(t('ordToDone'))}</h2><p class="sheet-sub">${esc(t('ordNo', { n: o.no }))}${o.total != null ? ' · ' + esc(money(o.total, o.currency)) : ''}</p>
            <div class="field"><span class="flabel">${esc(t('ordHowPaid'))}</span><div class="chips light paychips">${['cash', 'card', 'transfer', 'credit'].map(p => `<button type="button" class="chip${p === pay ? ' on' : ''}" data-pay="${p}">${esc(t('pay_' + p))}</button>`).join('')}</div></div>
            <div class="sheet-actions"><button type="button" class="btn btn-signal" data-ok>${I('check')} ${esc(t('ordToDone'))}</button><button type="button" class="btn btn-ghost" data-close>${esc(t('no'))}</button></div>`, {
            onOpen: s => { $$('[data-pay]', s.el).forEach(c => c.onclick = () => { pay = c.dataset.pay; $$('[data-pay]', s.el).forEach(x => x.classList.toggle('on', x === c)); }); $('[data-ok]', s.el).onclick = () => { yes = true; s.close(); }; },
            onClose: () => res(yes)
          });
        });
        if (!ok) return;
        try { const v = await O.set(o.id, 'done', pay); SP.toast(t('ordDoneOk', { n: v.no })); } catch (e) { SP.toast(SP.ordErr(e)); }
        await reload(); watchSoon(); return;
      }
      if (to === 'cancelled') {
        let reason = '';
        const ok = await new Promise(res => {
          let yes = false;
          SP.openSheet(`<h2 class="sheet-title">${esc(t('ordCancel'))}</h2><p class="sheet-sub">${esc(t('ordCancelQ', { n: o.no }))}</p>
            <div class="field"><label for="ocr">${esc(t('ordCancelReason'))}</label><input id="ocr" class="input" maxlength="200" placeholder="${esc(t('ordCancelReasonPh'))}"></div>
            <div class="sheet-actions"><button type="button" class="btn btn-danger solid" data-ok>${esc(t('ordCancel'))}</button><button type="button" class="btn btn-ghost" data-close>${esc(t('no'))}</button></div>`, {
            onOpen: s => { $('[data-ok]', s.el).onclick = () => { reason = $('#ocr', s.el).value.trim(); yes = true; s.close(); }; },
            onClose: () => res(yes)
          });
        });
        if (!ok) return;
        try { await O.set(o.id, 'cancelled', null, reason); SP.toast(t('ordCancelOk')); } catch (e) { SP.toast(SP.ordErr(e)); }
        await reload(); watchSoon();
      }
    }
    draw(o);
    SP.done(n);
  });

  /* ---------- the customer's orders ---------- */
  const ocard = o => {
    const units = (o.items || []).reduce((k, i) => k + (+i.qty || 0), 0);
    const at = Math.max(0, STEPS.findIndex(s => s[0] === (o.status === 'returned' ? 'done' : o.status)));
    return `<a class="ocard st-${esc(o.status)}" href="#order-${esc(o.id)}"><span class="oc-top"><b>${esc(t('ordNo', { n: o.no }))}</b>${SP.ordPill(o.status)}</span>
      <small>${esc([when(o.ordered_at), SP.count(units, 'parts'), o.total != null ? money(o.total, o.currency) : ''].filter(Boolean).join(' · '))}</small>
      ${o.status !== 'cancelled' ? `<span class="oc-bar" aria-hidden="true">${STEPS.map((s, i) => `<i class="${i <= at ? 'on' : ''}"></i>`).join('')}</span>` : ''}</a>`;
  };
  SP.route(/^my-orders$/, async (m, n) => {
    if (gate(n)) return;
    if (!S.user) { S.after = 'my-orders'; shell(bar(t('ordMine')) + `<main class="wrap">${empty('lock', t('ordMine'), t('ordSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return SP.done(n); }
    shell(bar(t('ordMine')) + `<main class="wrap form-wrap"><div id="ol">${'<div class="sk sk-row"></div>'.repeat(3)}</div></main>`);
    let L;
    try { L = await O.mine(); } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    $('#ol').innerHTML = L.length ? `<div class="olist">${L.map(ocard).join('')}</div>` : empty('bag', t('ordNoneT'), t('ordNoneB'), `<a class="btn btn-ink" href="#search">${esc(t('findPart'))}</a>`);
    mineState(L);
    SP.done(n);
  });
  /* the account page's entry (js/company.js) */
  const mineLine = () => S.ordMineOpen ? t('ordMineB', { n: SP.fmtNum(S.ordMineOpen) }) : t('ordMineB0');
  SP.ordersLink = () => S.user && SP.company ? `<a class="admin-entry" href="#my-orders">${I('receipt')}<span><b>${esc(t('ordMine'))}</b><small data-ordmine>${esc(mineLine())}</small></span>${I('chevL', 'dirx')}</a>` : '';

  /* ---------- staff: the orders ---------- */
  const TABS = [['', 'ordOpen'], ['preparing', 'ordPreparing'], ['ready', 'ordReady'], ['done', 'ordDone'], ['cancelled', 'ordCancelled']];
  SP.route(/^orders$/, async (m, n) => {
    if (gate(n)) return;
    if (!handles()) { shell(bar(t('ordT')) + `<main class="wrap">${empty('lock', t('noPermT'), t('errPerm'))}</main>`); return SP.done(n); }
    const tab = S.ordTab || '';
    shell(bar(t('ordT')) + `<main class="wrap">
      <div class="chips light" id="otabs">${TABS.map(([k, l]) => `<button type="button" class="chip${tab === k ? ' on' : ''}" data-t="${k}">${esc(t(l))}<i class="cn num" data-c="${k}"></i></button>`).join('')}</div>
      <div id="ol"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    $$('[data-t]').forEach(b => b.onclick = () => { S.ordTab = b.dataset.t; SP.render(); });
    const row = o => `<a class="arow ord-row st-${esc(o.status)}" href="#order-${esc(o.id)}"><span class="inv-badge num">${esc(o.no)}</span>
      <span class="ar-main"><b>${esc(o.customer_name)} ${SP.ordPill(o.status)}</b><small>${esc([ago(OPEN(o.status) ? o.ordered_at : o.done_at || o.cancelled_at || o.ordered_at), SP.count(+o.units || 0, 'parts'),
        t(o.delivery === 'delivery' ? 'ordDelivery' : 'ordPickup')].filter(Boolean).join(' · '))}</small></span><b class="num">${esc(money(o.total, o.currency))}</b></a>`;
    await SP.pager(n, $('#ol'), $('#more'), off => O.list(tab, off), items => items.map(row).join(''), (r, first) => {
      if (!first) return;
      counts(r.counts);
      const c = r.counts || {};
      [['', (+c.preparing || 0) + (+c.ready || 0)], ['preparing', +c.preparing || 0], ['ready', +c.ready || 0]].forEach(([k, v]) => { const el = $(`[data-c="${k}"]`); if (el) el.textContent = v ? SP.fmtNum(v) : ''; });
      if (!r.total) $('#ol').innerHTML = empty('bag', t(tab ? ST[tab] : 'ordEmptyOpen'), t('ordEmptyB'));
    });
    SP.done(n);
  });

  /* ---------- the counts on the tabs, and a word when something happens ---------- */
  let TIMER = 0, LASTP = null, NOTIFIED = null;
  function counts(c) { if (c) { S.ordCounts = c; badges(); } }
  function badges() {
    const put = (el, v) => { if (!el) return; let b = el.querySelector('.nbadge'); if (!v) { if (b) b.remove(); return; } if (!b) { b = document.createElement('i'); b.className = 'nbadge'; el.appendChild(b); } b.textContent = SP.fmtNum(v); };
    const c = S.ordCounts || {};
    put($('#tabs a[href="#system"]'), handles() ? +c.preparing || 0 : 0);
    put($('.pos-tile[href="#orders"]'), handles() ? (+c.preparing || 0) + (+c.ready || 0) : 0);
    put($('#tabs a[href="#mine"]'), !handles() ? +S.ordMineReady || 0 : 0);
    put($('a.admin-entry[href="#my-orders"]'), !handles() ? +S.ordMineReady || 0 : 0);
    const ml = $('[data-ordmine]');
    if (ml) ml.textContent = mineLine();
  }
  function mineState(L) {
    S.ordMineOpen = L.filter(o => OPEN(o.status)).length;
    const ready = L.filter(o => o.status === 'ready');
    S.ordMineReady = ready.length;
    /* «طلبك جاهز» once per order */
    if (NOTIFIED === null) { try { NOTIFIED = new Set(JSON.parse(localStorage.getItem('sp_ord_told') || '[]')); } catch (e) { NOTIFIED = new Set(); } }
    const fresh = ready.filter(o => !NOTIFIED.has(o.id));
    if (fresh.length && SP.here() !== 'order-' + fresh[0].id) SP.toast(t('ordReadyNote', { n: fresh[0].no }));
    fresh.forEach(o => NOTIFIED.add(o.id));
    try { localStorage.setItem('sp_ord_told', JSON.stringify([...NOTIFIED].slice(-50))); } catch (e) { /* full */ }
    badges();
  }
  async function watch() {
    if (!S.user || document.hidden) return;
    try {
      if (handles()) {
        const r = await O.list('preparing', 0, 1), c = r.counts || {}, newest = r.items && r.items.length ? r.items : [];
        const p = +c.preparing || 0;
        if (LASTP != null && p > LASTP) {
          const last = await O.list('preparing', Math.max(0, p - 1), 1).catch(() => null);
          const no = last && last.items && last.items[0] ? last.items[0].no : newest[0] && newest[0].no;
          if (SP.here() !== 'orders') SP.toast(t('ordNew', { n: no || '' }));
          if (SP.here() === 'orders' || SP.here() === 'system') SP.render();
        }
        LASTP = p; S.ordCounts = c; badges();
      } else if (SP.company) {
        mineState(await O.mine());
      }
    } catch (e) { /* offline: next time */ }
  }
  function watchSoon() { setTimeout(watch, 300); }
  function arm() {
    if (S.user && !TIMER) { TIMER = setInterval(watch, handles() ? 45000 : 90000); watch(); }
    if (!S.user && TIMER) { clearInterval(TIMER); TIMER = 0; LASTP = null; S.ordCounts = null; S.ordMineOpen = 0; S.ordMineReady = 0; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watch(); });
  const prevAfter = SP.afterShell;
  SP.afterShell = o => { if (prevAfter) prevAfter(o); arm(); badges(); };
})();
