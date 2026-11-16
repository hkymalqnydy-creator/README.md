/* The System tab (المنظومة) for the owner: windows at the top to swipe between, «اليوم», «المبيعات» (a day, a week, the month
   or the year: day by day, how it was paid, what sold most, who sold), «الأرباح والخسائر» (the same periods) and «الرصيد الكلي»
   (the stock, what customers owe, what is owed to suppliers, the money in and out);
   and a Face ID lock: once turned on for this phone, the sales system opens only after Face ID (or the password), again
   after the app has been away for a minute. The numbers come from sales_report, pnl_report and stock_report (supabase/setup.sql). */
(function () {
  'use strict';
  const SP = window.SP;
  if (!SP || !SP.company) return;
  const { $, $$, esc, I, t, S, shell, bar } = SP;
  const sb = () => SP.sb;
  const chk = r => { if (r && r.error) throw r.error; return r ? r.data : null; };
  const rpc = async (name, a) => chk(await sb().rpc(name, a || {}));

  Object.assign(SP.L.T, {
    spToday: ["اليوم", "Today"], spPnl: ["الأرباح والخسائر", "Profit and loss"], spBal: ["الرصيد الكلي", "Total balance"],
    spP_today: ["اليوم", "Today"], spP_7: ["أسبوع", "Week"], spP_month: ["الشهر", "Month"], spP_year: ["السنة", "Year"],
    spSales: ["المبيعات", "Sales"], spInvN: ["{n} فاتورة", "{n} invoices"], spAvg: ["متوسط الفاتورة {m}", "Average invoice {m}"],
    spByDay: ["المبيعات يوم بيوم", "Sales day by day"], spByMonth: ["المبيعات شهر بشهر", "Sales month by month"],
    spTblDay: ["الأرقام يوم بيوم", "The numbers day by day"], spTblMonth: ["الأرقام شهر بشهر", "The numbers month by month"],
    spBestDay: ["أحسن يوم كان {d}: {m}", "The best day was {d}: {m}"], spBestMonth: ["أحسن شهر كان {d}: {m}", "The best month was {d}: {m}"],
    spPayT: ["كيف تخلّصت", "How it was paid"], spCreditLeft: ["{m} منها ما تخلّصش وقت البيع (آجل).", "{m} of it was not paid at the sale (on credit)."],
    spTopT: ["الأكثر مبيعاً", "Best sellers"], spStaffT: ["مين باع", "Who sold"],
    spNoSales: ["ما فيش مبيعات في الفترة هذي.", "No sales in this period."], spSell: ["بيع جديد", "New sale"],
    spRepL: ["التقارير", "Reports"], spInvL: ["الفواتير", "Invoices"], spDisc: ["منها خصومات", "Discounts given"], spRet: ["مرتجعات", "Returns"],
    spCogs: ["تكلفة البضاعة المبيوعة", "Cost of goods sold"], spGross: ["الربح الإجمالي", "Gross profit"], spMargin: ["{p}٪ من المبيعات", "{p}% of sales"],
    spExp: ["المصروفات", "Expenses"], spAdj: ["تالف ونواقص المخزن", "Damaged and missing stock"],
    spNet: ["صافي الربح", "Net profit"], spLoss: ["صافي الخسارة", "Net loss"], spMore: ["التفاصيل", "Details"],
    spNoCost: ["فيه {n} سطر مبيوع بدون تكلفة، فالربح مش دقيق.", "{n} sold lines have no cost, so the profit is not exact."],
    spTotal: ["الرصيد الكلي", "Total balance"], spTotalH: ["البضاعة بالتكلفة + ديون لينا − ديون علينا", "Stock at cost + owed to us − what we owe"],
    spStockCost: ["البضاعة في المخزن (بالتكلفة)", "Stock (at cost)"], spStockPrice: ["بسعر البيع: {m}", "At selling price: {m}"],
    spStockNoCost: ["{n} قطعة بدون تكلفة ما تنحسبش", "{n} parts without a cost are not counted"],
    spOwedUs: ["ديون لينا على الزبائن", "Owed to us by customers"], spWeOwe: ["ديون علينا للموردين", "We owe suppliers"],
    spIn: ["الفلوس اللي دخلت هالشهر", "Money in this month"], spOut: ["الفلوس اللي طلعت هالشهر", "Money out this month"], spCash: ["الصافي هالشهر", "Net this month"],
    spInH: ["البيع الكاش ودفعات الزبائن", "Cash sales and customers’ payments"], spOutH: ["المشتريات ودفعات الموردين والمصروفات والمرتجعات", "Purchases, payments to suppliers, expenses and refunds"],
    spErr: ["ما قدرناش نجيبو الأرقام. جرّب مرة ثانية.", "Couldn’t load the numbers. Try again."],
    /* the lock */
    lkT: ["المنظومة مقفولة", "The system is locked"], lkB: ["افتحها بـ {b}.", "Open it with {b}."], lkGo: ["افتح بـ {b}", "Open with {b}"],
    lkPw: ["افتح بكلمة السر", "Use the password"], lkPwT: ["افتح المنظومة بكلمة السر", "Open the system with the password"], lkPwGo: ["افتح", "Open"],
    lkWrongPw: ["كلمة السر غلط.", "Wrong password."],
    lkCardT: ["قفل المنظومة", "System lock"], lkCardOn: ["المنظومة تتحل بـ {b} على التليفون هذا.", "The system opens with {b} on this phone."],
    lkCardOff: ["خلي المنظومة تتحل بـ {b}، باش حد ما يشوف أرقامك من تليفونك.", "Make the system open with {b}, so nobody sees your numbers on your phone."],
    lkOn: ["شغّل القفل", "Turn on"], lkOff: ["طفّي القفل", "Turn off"], lkDone: ["تمام: المنظومة تتحل بـ {b}", "Done: the system opens with {b}"],
    lkOffDone: ["تطفّى قفل المنظومة", "System lock turned off"], lkReg: ["فعّل {b} للتليفون هذا", "Set up {b} on this phone"]
  });

  const BK = () => SP.bk;
  const money = v => SP.priceText(Number(v || 0), SP.currencyOf(S.country));
  const num = v => SP.fmtNum(+v || 0);
  const pnl = per => { const [from, to] = BK().span(per); return rpc('pnl_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: BK().tz() }); };
  const line = (label, v, o) => {
    o = o || {};
    const tag = o.href ? 'a' : 'div';
    return `<${tag} class="pl-row${o.cls ? ' ' + o.cls : ''}"${o.href ? ` href="#${o.href}"` : ''}><span>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span><b class="num${o.tone ? ' ' + o.tone : ''}">${esc(v)}</b>${o.href ? I('chevL', 'dirx') : ''}</${tag}>`;
  };
  const row = (k, v, o) => line(t(k, (o || {}).a), v, o);
  // the big number on top: green for a gain, red for a loss, plain ink for an amount that is neither (tone 'flat')
  const head = (net, k, sub, tone) => `<div class="pl-net ${tone || (net < 0 ? 'down' : 'up')}"><small>${esc(t(k))}</small><b class="num">${esc(money(Math.abs(net)))}</b>${sub ? `<span class="hint">${esc(sub)}</span>` : ''}</div>`;
  const oops = () => `<p class="form-err">${esc(t('spErr'))}</p>`;

  /* a window with the period chips on top. Another period keeps the numbers on screen, faded, until the new ones come */
  const PERS = ['today', '7', 'month', 'year'];
  function perCard(box, n, key, def, redraw) {
    const per = PERS.includes(S[key]) ? S[key] : def;
    let body = $('.pl-body', box);
    if (!body) {
      box.innerHTML = `<section class="mcard sysp-card"><div class="chips light sysp-per">${PERS.map(p => `<button type="button" class="chip" data-per="${p}">${esc(t('spP_' + p))}</button>`).join('')}</div>
        <div class="pl-body"><div class="sk sk-block"></div></div></section>`;
      body = $('.pl-body', box);
      $$('[data-per]', box).forEach(b => b.onclick = () => { if (b.classList.contains('on')) return; S[key] = b.dataset.per; redraw(box, n); });
    } else body.classList.add('stale');
    $$('[data-per]', box).forEach(b => { b.classList.toggle('on', b.dataset.per === per); b.setAttribute('aria-pressed', b.dataset.per === per ? 'true' : 'false'); });
    const tok = box.dataset.tok = String(Math.random());
    const mine = () => box.isConnected && box.dataset.tok === tok;
    return {
      per, body, ok: () => SP.alive(n) && mine(),
      put: html => { body.classList.remove('stale'); body.innerHTML = html; },
      fail: () => { if (mine()) { body.classList.remove('stale'); body.innerHTML = oops(); } }
    };
  }

  /* «المبيعات»: how much was sold, day by day (month by month for the year), how it was paid, what sold most and who sold it */
  const pad = x => String(x).padStart(2, '0');
  const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const fmtD = (d, o) => { try { return new Intl.DateTimeFormat(SP.LANG + '-u-nu-latn', o).format(d); } catch (e) { return dkey(d); } };
  const dayName = d => fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const monthName = d => fmtD(d, { month: 'long', year: 'numeric' });
  const short = v => { if (v < 10000) return num(v); try { return new Intl.NumberFormat(SP.LANG + '-u-nu-latn', { notation: 'compact', maximumFractionDigits: 1 }).format(v); } catch (e) { return num(v); } };
  const nice = v => { if (!(v > 0)) return 0; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  // every day of the period (every month of the year), the days with no sale included
  function series(per, r) {
    const [from, to] = BK().span(per), year = per === 'year', got = {}, out = [];
    (r.by_day || []).forEach(x => { const k = String(x.day).slice(0, year ? 7 : 10); got[k] = (got[k] || 0) + (+x.total || 0); });
    if (year) for (let m = 0; m <= new Date().getMonth(); m++) { const d = new Date(from.getFullYear(), m, 1), k = d.getFullYear() + '-' + pad(m + 1); out.push({ d, v: got[k] || 0, name: monthName(d), x: String(m + 1) }); }
    else for (let d = new Date(from); d < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const day = d.getDate();
      out.push({ d, v: got[dkey(d)] || 0, name: dayName(d), x: per === 'month' && !(day === 1 || day % 5 === 0) ? '' : String(day) });
    }
    return out;
  }
  // one column a day, the latest one darker; tap (or slide a finger along) to read a day
  function chart(per, list) {
    const top = nice(Math.max(0, ...list.map(x => x.v))), year = per === 'year', last = list.length - 1;
    const h = v => !top || !v ? 0 : Math.max(1.5, v / top * 100).toFixed(1);
    return `<div class="sc">
      <p class="sc-read" aria-live="polite"><b class="num"></b><small></small></p>
      <div class="sc-plot">
        <div class="sc-grid" aria-hidden="true">${top ? `<span style="bottom:100%"><em class="num">${esc(short(top))}</em></span><span style="bottom:50%"><em class="num">${esc(short(top / 2))}</em></span>` : ''}</div>
        <div class="sc-cols" role="group" aria-label="${esc(t(year ? 'spByMonth' : 'spByDay'))}">${list.map((x, i) =>
          `<button type="button" class="sc-col${i === last ? ' cur' : ''}" data-i="${i}" tabindex="${i === last ? 0 : -1}" aria-label="${esc(x.name + ': ' + money(x.v))}"><i style="height:${h(x.v)}%"></i></button>`).join('')}</div>
      </div>
      <div class="sc-x" aria-hidden="true">${list.map(x => `<span>${esc(x.x)}</span>`).join('')}</div>
      <details class="sc-tbl"><summary>${esc(t(year ? 'spTblMonth' : 'spTblDay'))}</summary><table><tbody>${list.slice().reverse().map(x =>
        `<tr><td>${esc(x.name)}</td><td class="num">${esc(money(x.v))}</td></tr>`).join('')}</tbody></table></details>
    </div>`;
  }
  function wireChart(box, list) {
    const sc = $('.sc', box);
    if (!sc) return;
    const cols = $$('.sc-col', sc), rd = $('.sc-read', sc), area = $('.sc-cols', sc);
    let sel = list.length - 1;
    const show = i => { $('b', rd).textContent = money(list[i].v); $('small', rd).textContent = list[i].name; cols.forEach((c, j) => c.classList.toggle('sel', j === i)); };
    const pick = (i, focus) => { sel = Math.max(0, Math.min(list.length - 1, i)); cols.forEach((c, j) => { c.tabIndex = j === sel ? 0 : -1; }); show(sel); if (focus) cols[sel].focus(); };
    const at = e => { const r = area.getBoundingClientRect(); let f = (e.clientX - r.left) / Math.max(1, r.width); if (getComputedStyle(area).direction === 'rtl') f = 1 - f; return Math.floor(Math.max(0, Math.min(0.9999, f)) * list.length); };
    let down = false;
    area.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button) return; down = true; try { area.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } pick(at(e)); });
    area.addEventListener('pointermove', e => { if (down) pick(at(e)); else if (e.pointerType === 'mouse') show(at(e)); });
    const up = () => { down = false; };
    area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up);
    area.addEventListener('pointerleave', e => { if (!down && e.pointerType === 'mouse') show(sel); });
    cols.forEach((c, i) => { c.addEventListener('focus', () => { if (sel !== i) pick(i); }); c.addEventListener('click', () => pick(i)); });
    area.addEventListener('keydown', e => {
      const rtl = getComputedStyle(area).direction === 'rtl', k = e.key;
      const d = k === 'ArrowLeft' ? (rtl ? 1 : -1) : k === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
      if (d) { e.preventDefault(); pick(sel + d, true); } else if (k === 'Home' || k === 'End') { e.preventDefault(); pick(k === 'Home' ? 0 : list.length - 1, true); }
    });
    show(sel);
  }
  async function drawSales(box, n) {
    const c = perCard(box, n, 'sysSalesPer', '7', drawSales);
    const [from, to] = BK().span(c.per);
    let r;
    try { r = await rpc('sales_report', { p_from: from.toISOString(), p_to: to.toISOString(), p_branch: null, p_tz: BK().tz() }); } catch (e) { return c.fail(); }
    if (!c.ok()) return;
    const cnt = +r.count || 0, total = +r.total || 0;
    const acts = `<div class="form-actions sp-acts"><a class="btn btn-ghost sm" href="#reports">${I('grid')} ${esc(t('spRepL'))}</a><a class="btn btn-ghost sm" href="#invoices">${I('copy')} ${esc(t('spInvL'))}</a></div>`;
    if (!cnt) return c.put(head(0, 'spSales', '', 'flat') + `<p class="hint sp-none">${esc(t('spNoSales'))}</p><div class="form-actions sp-acts"><a class="btn btn-signal sm" href="#pos">${I('tag')} ${esc(t('spSell'))}</a></div>`);
    const list = c.per === 'today' ? null : series(c.per, r);
    const best = list && list.filter(x => x.v > 0).length > 1 ? list.reduce((a, x) => x.v > a.v ? x : a, list[0]) : null;
    const pays = Object.entries(r.by_payment || {}).map(([k, v]) => [k, +v || 0]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const pmax = Math.max(1, ...pays.map(x => x[1]));
    const top = (r.top || []).slice(0, 5), staff = (r.by_staff || []).slice(0, 4);
    c.put(head(total, 'spSales', t('spInvN', { n: num(cnt) }) + ' · ' + t('spAvg', { m: money(total / cnt) }), 'flat')
      + (list ? chart(c.per, list) + (best ? `<p class="hint sp-best">${esc(t(c.per === 'year' ? 'spBestMonth' : 'spBestDay', { d: best.name, m: money(best.v) }))}</p>` : '') : '')
      + (pays.length ? `<h3 class="lbl sp-h">${esc(t('spPayT'))}</h3>${pays.map(([k, v]) => `<div class="rbar"><span>${esc(t('pay_' + k))}</span><i style="--w:${Math.round(v / pmax * 100)}%"></i><b class="num">${esc(money(v))}</b></div>`).join('')}`
        + (+r.credit > 0 ? `<p class="hint">${esc(t('spCreditLeft', { m: money(r.credit) }))}</p>` : '') : '')
      + (top.length ? `<h3 class="lbl sp-h">${esc(t('spTopT'))}</h3>${top.map(x => line(x.title, money(x.total), { sub: '× ' + num(x.qty) })).join('')}` : '')
      + (staff.length > 1 ? `<h3 class="lbl sp-h">${esc(t('spStaffT'))}</h3>${staff.map(x => line(x.name || '—', money(x.total), { sub: t('spInvN', { n: num(x.count) }) })).join('')}` : '')
      + acts);
    if (list) wireChart(c.body, list);
  }

  /* «الأرباح والخسائر»: the period's sales down to the net profit */
  async function drawPnl(box, n) {
    const c = perCard(box, n, 'sysPer', 'month', drawPnl);
    let p;
    try { p = await pnl(c.per); } catch (e) { return c.fail(); }
    if (!c.ok()) return;
    const net = +p.net, sales = +p.sales, margin = sales ? Math.round(100 * (+p.gross) / sales) : 0;
    c.put(head(net, net < 0 ? 'spLoss' : 'spNet')
      + row('spSales', money(sales), { sub: t('spInvN', { n: num(p.count) }) + (+p.discount ? ' · ' + t('spDisc') + ' ' + money(p.discount) : '') + (+p.returned_count ? ' · ' + t('spRet') + ' ' + money(p.returned_total) : '') })
      + row('spCogs', '− ' + money(p.cogs), { tone: 'down-t' })
      + row('spGross', money(p.gross), { cls: 'sum', sub: sales ? t('spMargin', { p: num(margin) }) : '' })
      + row('spExp', '− ' + money(p.expenses), { tone: 'down-t' })
      + (+p.stock_adj ? row('spAdj', (+p.stock_adj < 0 ? '− ' : '+ ') + money(Math.abs(+p.stock_adj)), { tone: +p.stock_adj < 0 ? 'down-t' : 'up-t' }) : '')
      + (+p.cost_missing ? `<p class="hint">${esc(t('spNoCost', { n: num(p.cost_missing) }))}</p>` : '')
      + `<div class="form-actions"><a class="btn btn-ghost sm" href="#pnl">${I('trend')} ${esc(t('spMore'))}</a></div>`);
  }
  /* «الرصيد الكلي»: what the business has (stock, what customers owe) less what it owes, and this month's money in and out */
  async function drawBal(box, n) {
    box.innerHTML = `<section class="mcard sysp-card"><div class="sk sk-block"></div></section>`;
    let p, s;
    try { [p, s] = await Promise.all([pnl('month'), rpc('stock_report', { p_limit: 1 })]); } catch (e) { if (box.isConnected) box.firstElementChild.innerHTML = oops(); return; }
    if (!SP.alive(n) || !box.isConnected) return;
    const sum = (s && s.summary) || {}, stock = +sum.value_cost || 0, total = stock + (+p.receivable) - (+p.payable), cash = (+p.cash_in) - (+p.cash_out);
    box.firstElementChild.innerHTML = head(total, 'spTotal', t('spTotalH'))
      + row('spStockCost', money(stock), { href: 'stock', sub: t('spStockPrice', { m: money(sum.value_price) }) + (+sum.cost_missing ? ' · ' + t('spStockNoCost', { n: num(sum.cost_missing) }) : '') })
      + row('spOwedUs', '+ ' + money(p.receivable), { href: 'buyers', tone: 'up-t' })
      + row('spWeOwe', '− ' + money(p.payable), { href: 'suppliers', tone: 'down-t' })
      + '<div class="pl-sep"></div>'
      + row('spIn', '+ ' + money(p.cash_in), { tone: 'up-t', sub: t('spInH') })
      + row('spOut', '− ' + money(p.cash_out), { tone: 'down-t', sub: t('spOutH') })
      + row('spCash', (cash < 0 ? '− ' : '') + money(Math.abs(cash)), { cls: 'sum', tone: cash < 0 ? 'down-t' : '' });
  }

  /* the windows: tabs on top, swiped sideways, the last one seen opens again. A window is drawn when it is shown
     or is next to the one shown, so opening the System asks the server only for what can be seen */
  const PANES = [['spToday', (b, n) => SP.adminToday && SP.adminToday(b, n, { compact: true })], ['spSales', drawSales], ['spPnl', drawPnl], ['spBal', drawBal]];
  SP.adminPanels = (el, n) => {
    if (!el || !S.admin) return;
    const k = Math.min(PANES.length - 1, Math.max(0, +S.sysPanel || 0));
    el.innerHTML = `<section class="sysp"><div class="chips light sysp-tabs" role="tablist">${PANES.map(([x], i) =>
        `<button type="button" class="chip${i === k ? ' on' : ''}" role="tab" aria-selected="${i === k}" aria-controls="sp${i}" data-sp="${i}">${esc(t(x))}</button>`).join('')}</div>
      <div class="sysp-track" id="spt">${PANES.map((x, i) => `<div class="sysp-pane" id="sp${i}" role="tabpanel"></div>`).join('')}</div></section>`;
    const track = $('#spt', el), tabs = $$('[data-sp]', el), calm = matchMedia('(prefers-reduced-motion: reduce)'), drawn = {};
    const draw = i => { if (i < 0 || i >= PANES.length || drawn[i]) return; drawn[i] = 1; PANES[i][1]($('#sp' + i, el), n); };
    // the track is as tall as the window being shown, so a short one leaves no empty space under it
    const fit = () => { const p = $('#sp' + (+S.sysPanel || 0), el); if (p && p.offsetHeight) track.style.height = p.offsetHeight + 'px'; };
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!track.isConnected) ro.disconnect(); else fit(); }); $$('.sysp-pane', el).forEach(p => ro.observe(p)); }
    const mark = i => {
      S.sysPanel = i; draw(i); draw(i + 1); draw(i - 1);
      tabs.forEach((b, x) => { b.classList.toggle('on', x === i); b.setAttribute('aria-selected', x === i ? 'true' : 'false'); });
      const tb = tabs[i], row = tb.parentElement; // keep the tab in sight when the row of tabs is wider than the screen
      if (row.scrollWidth > row.clientWidth + 2) { const a = tb.getBoundingClientRect(), r = row.getBoundingClientRect(); if (a.left < r.left || a.right > r.right) row.scrollBy({ left: a.left < r.left ? a.left - r.left - 12 : a.right - r.right + 12, behavior: 'auto' }); }
      fit();
    };
    const go = (i, quick) => { const rtl = getComputedStyle(track).direction === 'rtl'; track.scrollTo({ left: (rtl ? -1 : 1) * i * track.clientWidth, behavior: quick || calm.matches ? 'auto' : 'smooth' }); mark(i); };
    tabs.forEach(b => b.onclick = () => go(+b.dataset.sp));
    track.addEventListener('scroll', () => { const i = Math.round(Math.abs(track.scrollLeft) / Math.max(1, track.clientWidth)); if (i !== +S.sysPanel && i >= 0 && i < PANES.length) mark(i); }, { passive: true });
    draw(k);
    requestAnimationFrame(() => go(k, true));
  };

  /* ---------- the Face ID lock (on this phone, for this account) ---------- */
  const LOCK = 'sp_sys_lock';
  const SYS = /^(system|pos|orders|order-|receive|invoices|inv-|purchases|reports|staff|stock|merchants|merchant-|buyers|buyer-|suppliers|supplier-|expenses|pnl|admin)/;
  const staffer = () => !!(S.user && SP.isStaff && SP.isStaff());
  const lockOn = () => staffer() && SP.load(LOCK, null) === S.user.id;
  let openAt = 0, hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (openAt && hiddenAt && Date.now() - hiddenAt > 60000) { openAt = 0; if (lockOn() && SYS.test(SP.here())) SP.render(); }
  });
  /* called by every page before it draws (js/views.js gate) */
  SP.sysGate = n => {
    if (openAt || !lockOn() || !SYS.test(SP.here())) return false;
    drawLock(n);
    return true;
  };
  const opened = async sess => {
    if (sess && sess.user && sess.user.id !== (S.user && S.user.id)) await SP.refreshUser(sess);
    openAt = Date.now(); SP.render();
  };
  function drawLock(n) {
    const b = SP.bioName();
    if (SP.passkeyPrefetch) SP.passkeyPrefetch('login');
    shell(bar(t('tabSystem'), '', { noBack: true }) + `<main class="wrap lockv"><section class="lock-card">
        <span class="lock-ic">${I('faceid')}</span><h2>${esc(t('lkT'))}</h2><p>${esc(t('lkB', { b }))}</p>
        <div class="form-actions"><button type="button" class="btn btn-signal" id="lkgo">${I('faceid')} ${esc(t('lkGo', { b }))}</button>
          <button type="button" class="btn btn-ghost" id="lkpw">${I('lock')} ${esc(t('lkPw'))}</button></div>
        <p class="form-err" id="lkerr" role="alert"></p></section></main>`);
    $('#lkgo').onclick = async () => {
      $('#lkerr').textContent = '';
      try { await opened(await SP.passkeySignIn()); } catch (e) { if ($('#lkerr')) $('#lkerr').textContent = SP.bioErr(e); if (SP.passkeyPrefetch) SP.passkeyPrefetch('login'); }
    };
    $('#lkpw').onclick = () => {
      const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('lkPwT'))}</h2><form class="form" id="lpf" novalidate>
          <div class="field"><label for="lpi">${esc(t('password'))}</label><input id="lpi" class="input" type="password" autocomplete="current-password" dir="ltr"></div>
          <p class="form-err" id="lpe" role="alert"></p><div class="sheet-actions"><button class="btn btn-signal">${I('lock')} ${esc(t('lkPwGo'))}</button></div></form>`, { label: t('lkPwT') });
      setTimeout(() => { const i = $('#lpi', s.el); if (i) i.focus(); }, 60);
      $('#lpf', s.el).onsubmit = async e => {
        e.preventDefault();
        const btn = $('#lpf button', s.el); btn.classList.add('busy');
        try { const d = await SP.auth.signIn(S.user.email, $('#lpi', s.el).value); s.close(); await opened(d && d.session); }
        catch (x) { $('#lpe', s.el).textContent = /Invalid login/i.test(String((x && x.message) || '')) ? t('lkWrongPw') : SP.errText(x); btn.classList.remove('busy'); }
      };
    };
    SP.done(n);
  }
  /* the switch on the System tab; turning it on asks for Face ID once, so the lock never shuts anyone out */
  SP.lockCard = () => staffer() ? '<div id="lkc"></div>' : '';
  SP.wireLockCard = async n => {
    const box = $('#lkc');
    if (!box) return;
    const ok = SP.passkeyReady ? await SP.passkeyReady() : false;
    if (!SP.alive(n) || !box.isConnected) return;
    if (!ok) { box.remove(); return; }
    const b = SP.bioName();
    const draw = (reg, msg) => {
      const on = lockOn();
      box.innerHTML = `<section class="mcard lock-row"><span class="lock-ic sm">${I('faceid')}</span><span class="lr-main"><b>${esc(t('lkCardT'))}</b><small>${esc(t(on ? 'lkCardOn' : 'lkCardOff', { b }))}</small>
          ${msg ? `<small class="form-err">${esc(msg)}</small>` : ''}</span>
        <span class="lr-acts"><button type="button" class="btn ${on ? 'btn-ghost' : 'btn-ink'} sm" id="lkt">${esc(t(on ? 'lkOff' : 'lkOn'))}</button>
          ${reg && !on ? `<button type="button" class="btn btn-signal sm" id="lkreg">${I('faceid')} ${esc(t('lkReg', { b }))}</button>` : ''}</span></section>`;
      $('#lkt').onclick = async () => {
        if (lockOn()) { SP.store(LOCK, null); SP.toast(t('lkOffDone')); return draw(); }
        try {
          const sess = await SP.passkeySignIn();
          if (!sess || !sess.user || sess.user.id !== S.user.id) throw Object.assign(new Error('not this account'), { code: 'webauthn_credential_not_found' });
          SP.store(LOCK, S.user.id); openAt = Date.now(); SP.toast(t('lkDone', { b })); draw();
        } catch (e) { if (SP.passkeyPrefetch) SP.passkeyPrefetch('reg'); draw(true, SP.bioErr(e)); }
      };
      if ($('#lkreg')) $('#lkreg').onclick = async () => {
        try { await SP.passkeyRegister(); SP.store(LOCK, S.user.id); openAt = Date.now(); SP.toast(t('lkDone', { b })); draw(); }
        catch (e) { draw(true, SP.bioErr(e)); }
      };
    };
    if (SP.passkeyPrefetch) SP.passkeyPrefetch('login');
    draw();
  };
})();
