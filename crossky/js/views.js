/* Sparat pages, part 1: shell, browsing, sheets (location, country, language, car, filters, share), brands, VIN. */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, api, D, BRAND, opt } = SP;

  /* Extra interface text. Order: ar, en, fr, es, de, tr, ru, zh. */
  Object.assign(SP.L.T, {
    allCountries: ["كل الدول", "All countries", "Tous les pays", "Todos los países", "Alle Länder", "Tüm ülkeler", "Все страны", "所有国家/地区"],
    suggested: ["مقترحة", "Suggested", "Suggérés", "Sugeridos", "Vorgeschlagen", "Önerilen", "Рекомендуемые", "推荐"],
    popularBrands: ["ماركات شائعة", "Popular brands", "Marques populaires", "Marcas populares", "Beliebte Marken", "Popüler markalar", "Популярные марки", "热门品牌"],
    searchModel: ["ابحث عن موديل…", "Search models…", "Chercher un modèle…", "Buscar modelo…", "Modell suchen…", "Model ara…", "Поиск модели…", "搜索车型…"],
    shopCountry: ["دولة المحل", "Shop country", "Pays du magasin", "País de la tienda", "Land des Ladens", "Dükkân ülkesi", "Страна магазина", "店铺所在国家"],
    prefsT: ["التفضيلات", "Preferences", "Préférences", "Preferencias", "Einstellungen", "Tercihler", "Настройки", "偏好设置"],
    newBadge: ["جديد", "New", "Nouveau", "Nuevo", "Neu", "Yeni", "Новый", "新"],
    otherModel: ["موديل آخر…", "Other model…", "Autre modèle…", "Otro modelo…", "Anderes Modell…", "Diğer model…", "Другая модель…", "其他车型…"],
    resultsFor: ["نتائج «{q}»", "Results for “{q}”", "Résultats pour « {q} »", "Resultados de «{q}»", "Ergebnisse für „{q}“", "“{q}” sonuçları", "Результаты: «{q}»", "“{q}”的结果"]
  });

  const FDEF = { q: '', cat: '', make: '', model: '', year: '', cond: '', fit: false, sort: 'new' };
  SP.FDEF = FDEF;
  try { const f = JSON.parse(sessionStorage.getItem('sp_f') || 'null'); if (f) S.f = { ...FDEF, ...f }; } catch (e) { /* first visit */ }
  const saveF = () => { try { sessionStorage.setItem('sp_f', JSON.stringify(S.f)); } catch (e) { /* private mode */ } };
  SP.saveF = saveF;

  /* ---------- shell ---------- */
  function tabs() {
    let nav = $('#tabs');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'tabs'; nav.className = 'tabs'; document.body.appendChild(nav); }
    nav.setAttribute('aria-label', t('nav'));
    const T = [['home', '', 'home', 'tabHome'], ['cats', 'cats', 'grid', 'tabCats'], ['shops', 'shops', 'store', SP.company ? 'tabBranches' : 'tabShops'], ['favs', 'favs', 'heart', 'tabFavs'], ['mine', 'mine', 'user', SP.company ? 'tabAccount' : 'tabMine']];
    nav.innerHTML = `<div class="tabs-in">${T.map(([id, h, ic, k]) => `<a class="tab${SP.tab === id ? ' on' : ''}" href="#${h}"${SP.tab === id ? ' aria-current="page"' : ''}>${I(ic)}<span>${esc(t(k))}</span></a>`).join('')}</div>`;
  }
  function shell(html, o = {}) {
    document.body.classList.toggle('has-actionbar', !!o.actionbar);
    $('#app').innerHTML = html;
    tabs();
    if (SP.afterShell) SP.afterShell(o);
  }
  const bar = (title, actions, o = {}) => `<header class="topbar"><div class="wrap">${o.noBack ? '' : `<button type="button" class="iconbtn" data-act="back" aria-label="${esc(t('back'))}">${I('back', 'dirx')}</button>`}<h1 class="tb-title">${esc(title)}</h1><div class="tb-actions">${actions || ''}</div></div></header>`;
  function homeBar() {
    const st = S.settings || {}, wm = !st.logo && SP.CFG.logo;
    /* the owner's uploaded logo with the name; else the edition's wordmark (it is the name); else the mark and the name */
    const brand = st.logo ? `<img class="brand-logo" src="${esc(st.logo)}" alt=""><span>${esc(t('app'))}</span>`
      : wm ? `<img class="brand-wm" src="${esc(wm)}" alt="${esc(t('app'))}">` : `<span class="brand-mark">${I('nut')}</span><span>${esc(t('app'))}</span>`;
    return `<header class="topbar"><div class="wrap"><a class="brand" href="#">${brand}</a>
      <button type="button" class="citypill" data-act="loc" aria-label="${esc(t('country'))}"><span class="fl" aria-hidden="true">${SP.flag(S.country)}</span><span>${esc(S.city || SP.countryName(S.country))}</span>${I('chevD')}</button>
      ${SP.cartBtn ? SP.cartBtn() : ''}<button type="button" class="iconbtn" data-act="lang" aria-label="${esc(t('language'))}">${I('globe')}</button></div></header>`;
  }
  const skel = k => Array.from({ length: k }, () => '<div class="sk sk-card"></div>').join('');
  const empty = (icon, title, body, btn) => `<div class="empty">${I(icon)}<h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${btn || ''}</div>`;
  const errBox = e => empty('warn', t('loadFailT'), SP.errText(e), `<button type="button" class="btn btn-ghost" data-act="retry">${esc(t('retry'))}</button>`);
  const initial = s => { const v = String(s || '').trim().replace(/^(محل|مركز|شركة|معرض)\s+/, '').replace(/^ال(?=\S{2})/, ''); return (v[0] || '?').toUpperCase(); };
  const avatar = (s, cls) => `<span class="hexav ${cls || ''}">${s.logo ? SP.imgTag(s.logo, '', s.name) : ''}<span>${esc(initial(s.name))}</span></span>`;
  const vb = s => s.verified ? `<span class="vb">${I('verified')}<span class="sr">${esc(t('verified'))}</span></span>` : '';
  const catIcon = id => (D.CATS.find(c => c.id === id) || {}).icon || 'box';
  const sf = o => `href="#search" data-sf="${esc(JSON.stringify(o))}"`;

  function gate(n) {
    if (!S.err) return false;
    shell(homeBar() + `<main class="wrap">${S.err === 'lib'
      ? empty('warn', t('loadFailT'), t('libFail'), `<button type="button" class="btn btn-ink" onclick="location.reload()">${esc(t('retry'))}</button>`)
      : empty('wrench', t('setupT'), t('setupB'))}</main>`);
    return true;
  }
  function failView(e, n) {
    if (!SP.alive(n)) return;
    shell(bar(t('loadFailT')) + `<main class="wrap">${errBox(e)}</main>`);
  }
  SP.fail = failView;

  function card(p) {
    const on = S.favs.has(p.id), fits = S.car && p.make !== 'any' && SP.fitsCar(p, S.car);
    const cur = p.shop ? p.shop.currency : SP.currencyOf(S.country);
    return `<article class="card${p.status === 'sold' ? ' sold' : ''}"><a class="card-link" href="#p-${p.id}">
      <div class="media">${p.imgs[0] ? SP.imgTag(p.imgs[0], '', p.title, true) : I(catIcon(p.cat))}
        <div class="ribbons">${p.status === 'sold' ? `<span class="ribbon sold">${esc(t('soldOut'))}</span>` : ''}${fits ? `<span class="ribbon">${esc(t('fitsYourCar'))}</span>` : ''}</div>
        <span class="cond ${esc(p.cond)}">${esc(SP.condName(p.cond, true))}</span></div>
      <div class="card-body">${p.part_no ? `<span class="pn">${esc(p.part_no)}</span>` : ''}<h3 class="card-title">${esc(p.title)}</h3>
        <p class="fit">${esc(SP.fitText(p))}</p>${SP.priceHTML(p.price, cur, p.price_hidden)}${p.shop ? `<p class="card-shop">${esc(p.shop.name)} · ${esc(p.shop.city)}</p>` : ''}</div></a>
      <button type="button" class="fav${on ? ' on' : ''}" data-act="fav" data-id="${p.id}" aria-pressed="${on}" aria-label="${esc(t(on ? 'favRemove' : 'favAdd'))}">${I('heart', on ? 'f' : '')}</button></article>`;
  }
  const cards = items => items.map(card).join('');
  function shopRow(s) {
    return `<a class="shop-row" href="#s-${s.id}">${avatar(s)}<span class="sr-main"><span class="sr-name">${esc(s.name)}${vb(s)}</span>
      <span class="sr-meta">${I('pin')} ${esc(s.city)}${s.area ? ' · ' + esc(s.area) : ''}</span>
      ${s.makes.length ? `<span class="mk">${s.makes.slice(0, 4).map(m => `<span>${esc(SP.brandName(m))}</span>`).join('')}</span>` : ''}</span>
      <span class="sr-count"><b class="num">${esc(SP.fmtNum(s.product_count))}</b><small>${esc(SP.plural('parts', s.product_count))}</small></span></a>`;
  }
  const shopTile = s => `<a class="shop-tile" href="#s-${s.id}">${avatar(s)}<span class="st-name">${esc(s.name)}${vb(s)}</span><span class="st-meta">${esc(s.city)} · ${esc(SP.count(s.product_count, 'parts'))}</span></a>`;

  /* "Show more" paging over any list endpoint. */
  async function pager(n, grid, more, fetchPage, draw, onPage) {
    let off = 0, busy = false;
    async function next(first) {
      if (busy) return;
      busy = true; more.classList.add('busy');
      try {
        const r = await fetchPage(off);
        if (!SP.alive(n)) return;
        off += r.items.length;
        if (first) grid.innerHTML = draw(r.items); else grid.insertAdjacentHTML('beforeend', draw(r.items));
        const left = r.total - off;
        more.hidden = !(left > 0 && r.items.length);
        more.textContent = t('showMore', { n: SP.fmtNum(left) });
        if (onPage) onPage(r, first);
      } catch (e) {
        if (!SP.alive(n)) return;
        if (first) grid.innerHTML = errBox(e); else SP.toast(SP.errText(e));
      } finally { busy = false; more.classList.remove('busy'); }
    }
    more.onclick = () => next(false);
    await next(true);
  }

  /* ---------- option lists ---------- */
  function brandOptions(cur, first, extra) {
    const P = SP.popularIds(), pop = P.map(id => BRAND.get(id)).filter(Boolean);
    const rest = SP.brandsList().filter(b => !P.includes(b.id)).sort((a, b) => SP.brandName(a.id).localeCompare(SP.brandName(b.id), SP.LANG));
    return (first != null ? opt('', first, cur) : '') + (extra || '') +
      `<optgroup label="${esc(t('popularBrands'))}">${pop.map(b => opt(b.id, SP.brandName(b.id), cur)).join('')}</optgroup>` +
      `<optgroup label="${esc(t('allBrandsT'))}">${rest.map(b => opt(b.id, SP.brandName(b.id), cur)).join('')}</optgroup>`;
  }
  function modelOptions(make, cur, first, withOther) {
    const b = BRAND.get(make);
    let h = opt('', first, cur);
    if (b) h += b.models.map(m => opt(m.en, SP.LANG === 'ar' && m.ar ? m.ar : m.en, cur)).join('');
    if (cur && (!b || !b.models.some(m => m.en === cur))) h += opt(cur, cur, cur);
    if (withOther) h += opt('__other', t('otherModel'), '');
    return h;
  }
  function yearOptions(make, model, cur, first) {
    const m = SP.modelObj(make, model), now = new Date().getFullYear() + 1;
    const from = m ? m.from : 1980, to = m ? (m.to >= now - 1 ? now : m.to) : now;
    let h = opt('', first, cur);
    for (let y = to; y >= from; y--) h += opt(y, y, cur);
    if (cur && (+cur < from || +cur > to)) h += opt(cur, cur, cur);
    return h;
  }
  Object.assign(SP, { shell, bar, empty, errBox, avatar, vb, card, cards, shopRow, pager, skel, brandOptions, modelOptions, yearOptions, gate, catIcon, initial });

  /* ---------- global actions ---------- */
  SP.navs = 0;
  window.addEventListener('hashchange', () => { SP.navs++; });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-sf]');
    if (s) {
      try { S.f = { ...FDEF, ...JSON.parse(s.dataset.sf) }; } catch (er) { S.f = { ...FDEF }; }
      saveF();
      if (SP.here() === 'search') { e.preventDefault(); SP.render(); }
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') { e.preventDefault(); if (SP.navs > 0 && history.length > 1) history.back(); else SP.go(''); }
    else if (act === 'fav') {
      e.preventDefault();
      const on = SP.toggleFav(a.dataset.id);
      a.classList.toggle('on', on); a.setAttribute('aria-pressed', on); a.setAttribute('aria-label', t(on ? 'favRemove' : 'favAdd'));
      a.innerHTML = I('heart', on ? 'f' : '');
      SP.toast(t(on ? 'favSaved' : 'favRemoved'));
      if (!on && SP.tab === 'favs') { const c = a.closest('.card'); if (c) c.remove(); }
    }
    else if (act === 'loc') locSheet();
    else if (act === 'country') countrySheet();
    else if (act === 'lang') langSheet();
    else if (act === 'car') carSheet();
    else if (act === 'retry') SP.render();
  });

  /* ---------- sheets ---------- */
  async function locSheet() {
    const cc = S.country;
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('chooseCity'))}</h2><p class="sheet-sub">${esc(t('cityHint'))}</p>
      <button type="button" class="opt" id="chcc"><span><span aria-hidden="true">${SP.flag(cc)}</span> ${esc(SP.countryName(cc))}</span><span class="opt-n">${esc(t('change'))} ${I('chevL', 'dirx')}</span></button>
      <div class="opt-list" id="cities"><div class="sk sk-row"></div></div>`, { label: t('chooseCity') });
    $('#chcc', s.el).onclick = () => { s.close(); countrySheet(); };
    let list = S.cities.get(cc) || [];
    try { list = await api.cities(cc); } catch (e) { /* keep cached */ }
    list = list.slice();
    if (cc === 'LY') { const have = new Set(list.map(x => x.city)); D.LIBYA_CITIES.forEach(c => { if (!have.has(c)) list.push({ city: c, shops: 0 }); }); }
    const box = $('#cities', s.el);
    if (!box) return;
    const rows = [{ city: '', shops: 0 }, ...list];
    box.innerHTML = rows.map(x => `<button type="button" class="opt${S.city === x.city ? ' on' : ''}" data-city="${esc(x.city)}"><span>${esc(x.city || t('allCities'))}</span><span class="opt-n">${x.shops > 0 ? esc(SP.count(x.shops, 'shops')) : ''}${S.city === x.city ? I('check') : ''}</span></button>`).join('')
      + (list.length ? '' : `<p class="muted-p">${esc(t('noCities'))}</p>`);
    box.onclick = e => { const b = e.target.closest('[data-city]'); if (!b) return; SP.setCity(b.dataset.city); s.close(); SP.render(); };
  }
  SP.locSheet = locSheet;

  function countrySheet(onPick) {
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('chooseCountry'))}</h2><p class="sheet-sub">${esc(t('countryHint'))}</p>
      <div class="searchbox flat">${I('search')}<input type="search" id="ccq" placeholder="${esc(t('searchCountry'))}" autocomplete="off" aria-label="${esc(t('searchCountry'))}"></div>
      <div class="opt-list" id="cclist"></div>`, { label: t('chooseCountry') });
    let en = null;
    try { en = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* old browser */ }
    const all = D.COUNTRIES.map(c => ({ ...c, name: SP.countryName(c.code), alt: en ? en.of(c.code) : c.code })).sort((a, b) => a.name.localeCompare(b.name, SP.LANG));
    const pinned = D.PINNED.map(cc => all.find(c => c.code === cc)).filter(Boolean);
    const row = c => {
      const st = S.cstats && S.cstats.get(c.code), on = c.code === S.country;
      return `<button type="button" class="opt${on ? ' on' : ''}" data-c="${c.code}"><span><span class="fl" aria-hidden="true">${SP.flag(c.code)}</span> ${esc(c.name)}</span><span class="opt-n">${st && st.shops ? esc(SP.count(st.shops, 'shops')) + ' · ' : ''}<span class="ltr">${esc(c.currency)}</span>${on ? I('check') : ''}</span></button>`;
    };
    function draw(q) {
      const nq = SP.norm(q);
      const list = nq ? all.filter(c => SP.norm(c.name).includes(nq) || SP.norm(c.alt).includes(nq) || c.code.toLowerCase() === nq) : null;
      $('#cclist', s.el).innerHTML = list
        ? (list.map(row).join('') || `<p class="muted-p">${esc(t('noResT'))}</p>`)
        : `<p class="lbl optg">${esc(t('suggested'))}</p>${pinned.map(row).join('')}<p class="lbl optg">${esc(t('allCountries'))}</p>${all.map(row).join('')}`;
    }
    draw('');
    $('#ccq', s.el).oninput = SP.debounce(e => draw(e.target.value), 120);
    $('#cclist', s.el).onclick = e => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      s.close();
      if (onPick) { onPick(b.dataset.c); return; }
      SP.setCountry(b.dataset.c); SP.render();
    };
    if (!S.cstats && SP.sb) api.countryStats().then(() => { if ($('#ccq', s.el)) draw($('#ccq', s.el).value); }).catch(() => { /* counts are optional */ });
  }
  SP.countrySheet = countrySheet;

  function langSheet() {
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('language'))}</h2><div class="opt-list">${SP.L.LANGS.map(l => `<button type="button" class="opt${l.code === SP.LANG ? ' on' : ''}" data-l="${l.code}" lang="${l.code}" dir="${l.dir}"><span>${esc(l.name)}</span>${l.code === SP.LANG ? I('check') : ''}</button>`).join('')}</div>`, { label: t('language') });
    s.el.onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; SP.setLang(b.dataset.l); s.close(); SP.render(); };
  }
  SP.langSheet = langSheet;

  /* Brand / model / year pickers that keep each other consistent. */
  function wireCarSelects(mk, md, yr, other, o = {}) {
    const fill = () => {
      md.innerHTML = modelOptions(mk.value, md.dataset.cur || '', o.modelFirst || t('chooseModel'), !!other);
      yr.innerHTML = yearOptions(mk.value, md.value, yr.dataset.cur || '', o.yearFirst || t('yearL'));
      md.disabled = !mk.value || mk.value === 'any';
      if (other) other.hidden = true;
    };
    mk.onchange = () => { md.dataset.cur = ''; fill(); };
    md.onchange = () => {
      if (md.value === '__other' && other) { other.hidden = false; other.focus(); yr.innerHTML = yearOptions('', '', yr.value, o.yearFirst || t('yearL')); return; }
      if (other) other.hidden = true;
      yr.innerHTML = yearOptions(mk.value, md.value, yr.value, o.yearFirst || t('yearL'));
    };
    fill();
    return {
      set(make, model, year) {
        mk.value = BRAND.has(make) ? make : ''; md.dataset.cur = model || ''; yr.dataset.cur = year || ''; fill();
        if (model && md.value !== model && other) { md.value = '__other'; other.hidden = false; other.value = model; }
      },
      model() { return md.value === '__other' ? (other ? other.value.trim() : '') : md.value; }
    };
  }
  SP.wireCarSelects = wireCarSelects;

  function vinMessage(r) {
    if (!r.valid) {
      if (r.jdm) return ['warn', t('vinJdm')];
      if (r.vin.length !== 17) return ['warn', t('vinLen', { n: r.vin.length }) + ' ' + t('vinBad')];
      return ['warn', t('vinBad')];
    }
    if (!r.brandId && !r.maker) return ['warn', t('vinUnknown')];
    const notes = [];
    if (r.fixed) notes.push(t('vinFixed'));
    if (r.checkRequired && r.checkOk === false) notes.push(t('vinCheck'));
    notes.push(r.online ? t('vinFull') : (r.onlineTried && !navigator.onLine ? t('vinOff') : t('vinBasic')));
    return [r.checkRequired && r.checkOk === false ? 'warn' : 'note', notes.join(' ')];
  }
  SP.vinMessage = vinMessage;

  function carSheet() {
    const c = S.car || {};
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('carQ'))}</h2><p class="sheet-sub">${esc(t('carHint'))}</p>
      <form class="form" id="carf" novalidate>
        <div class="field"><label for="cvin">${esc(t('vin'))}</label>
          <div class="vinrow"><input id="cvin" class="input mono" value="${esc(c.vin || '')}" maxlength="24" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" dir="ltr" placeholder="KMHCT41DBEU123456">
          <button type="button" class="btn btn-ink sm" id="cvgo">${I('barcode')} ${esc(t('vinBtn'))}</button></div>
          <span class="hint" id="cvmsg">${esc(t('vinWhere'))}</span></div>
        <p class="lbl or"><span>${esc(t('vinOr'))}</span></p>
        <div class="field"><label for="cmake">${esc(t('brand'))}</label><select id="cmake" class="input">${brandOptions(c.make || '', t('chooseBrand'))}</select></div>
        <div class="row2"><div class="field"><label for="cmodel">${esc(t('model'))}</label><select id="cmodel" class="input"></select></div>
          <div class="field"><label for="cyear">${esc(t('yearL'))}</label><select id="cyear" class="input"></select></div></div>
        <input id="cmodelx" class="input" placeholder="${esc(t('modelOther'))}" aria-label="${esc(t('model'))}" maxlength="60" hidden>
        <p class="form-err" id="cerr" role="alert"></p>
        <div class="sheet-actions"><button class="btn btn-signal">${I('check')} ${esc(t('saveCar'))}</button>${S.car ? `<button type="button" class="btn btn-ghost" id="cdel">${esc(t('removeCar'))}</button>` : ''}</div>
      </form>`, { label: t('carQ') });
    const el = s.el, mk = $('#cmake', el), md = $('#cmodel', el), yr = $('#cyear', el), other = $('#cmodelx', el), msg = $('#cvmsg', el);
    md.dataset.cur = c.model || ''; yr.dataset.cur = c.year || '';
    const sel = wireCarSelects(mk, md, yr, other);
    if (c.make) sel.set(c.make, c.model, c.year);
    let vin = c.vin || '';
    $('#cvgo', el).onclick = async () => {
      const b = $('#cvgo', el);
      b.classList.add('busy'); msg.textContent = t('vinReading'); msg.className = 'hint';
      const r = await SP.VIN.decode($('#cvin', el).value);
      b.classList.remove('busy');
      const [kind, text] = vinMessage(r);
      msg.textContent = text; msg.className = 'hint ' + (kind === 'warn' ? 'warnt' : 'okt');
      if (!r.valid) return;
      $('#cvin', el).value = r.vin; vin = r.vin;
      if (r.brandId) sel.set(r.brandId, r.model ? r.model.en : (r.modelText || ''), r.year || '');
      else if (r.year) { yr.innerHTML = yearOptions('', '', r.year, t('yearL')); }
    };
    $('#cvin', el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#cvgo', el).click(); } });
    if ($('#cdel', el)) $('#cdel', el).onclick = () => { SP.setCar(null); s.close(); SP.render(); };
    $('#carf', el).onsubmit = e => {
      e.preventDefault();
      if (!mk.value) { $('#cerr', el).textContent = t('brandNeeded'); mk.focus(); return; }
      const typed = SP.VIN.clean($('#cvin', el).value).vin;
      SP.setCar({ make: mk.value, model: sel.model(), year: yr.value ? +yr.value : '', vin: SP.VIN.validFormat(typed) ? typed : (typed === vin ? vin : '') });
      s.close(); SP.toast(t('carSaved'));
      if (!S.f.fit) { S.f.fit = true; saveF(); }
      SP.render();
    };
  }
  SP.carSheet = carSheet;

  function filtersSheet() {
    const f = S.f;
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t('filterTitle'))}</h2><form class="form" id="ff">
      <div class="field"><label for="fcat">${esc(t('category'))}</label><select id="fcat" class="input">${opt('', t('allCats'), f.cat)}${D.CATS.map(c => opt(c.id, SP.catName(c.id), f.cat)).join('')}</select></div>
      <div class="field"><label for="fmake">${esc(t('brand'))}</label><select id="fmake" class="input">${brandOptions(f.make, t('allBrands'))}</select></div>
      <div class="row2"><div class="field"><label for="fmodel">${esc(t('model'))}</label><select id="fmodel" class="input"></select></div>
        <div class="field"><label for="fyear">${esc(t('year'))}</label><select id="fyear" class="input"></select></div></div>
      <fieldset class="field"><legend>${esc(t('condition'))}</legend><div class="seg">${['', ...D.CONDS].map((c, i) => `<input type="radio" name="cond" id="fc${i}" value="${c}"${(f.cond || '') === c ? ' checked' : ''}><label for="fc${i}">${esc(c ? SP.condName(c) : t('all'))}</label>`).join('')}</div></fieldset>
      <div class="sheet-actions"><button class="btn btn-signal">${esc(t('showResults'))}</button><button type="button" class="btn btn-ghost" id="fclr">${esc(t('clearFilters'))}</button></div></form>`, { label: t('filterTitle') });
    const el = s.el, mk = $('#fmake', el), md = $('#fmodel', el), yr = $('#fyear', el);
    md.dataset.cur = f.model || ''; yr.dataset.cur = f.year || '';
    wireCarSelects(mk, md, yr, null, { modelFirst: t('allModelsCap'), yearFirst: t('anyYear') });
    $('#fclr', el).onclick = () => { S.f = { ...FDEF, q: f.q, fit: f.fit, sort: f.sort }; saveF(); s.close(); SP.render(); };
    $('#ff', el).onsubmit = e => {
      e.preventDefault();
      Object.assign(S.f, { cat: $('#fcat', el).value, make: mk.value, model: mk.value ? md.value : '', year: yr.value, cond: (el.querySelector('input[name=cond]:checked') || {}).value || '' });
      saveF(); s.close(); SP.render();
    };
  }

  async function share(title, text, url) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const full = text + '\n' + url;
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(title)}</h2><pre class="share-pre">${esc(full)}</pre>
      <div class="sheet-actions"><a class="btn btn-wa" href="https://wa.me/?text=${encodeURIComponent(full)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('sendWA'))}</a>
      <button type="button" class="btn btn-ghost" id="cp">${I('copy')} ${esc(t('copyText'))}</button></div>`, { label: title });
    $('#cp', s.el).onclick = async () => {
      try { await navigator.clipboard.writeText(full); SP.toast(t('copied')); s.close(); }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('.share-pre', s.el)); const g = getSelection(); g.removeAllRanges(); g.addRange(r); SP.toast(t('selectCopy')); }
    };
  }
  SP.share = share;

  /* ---------- home ---------- */
  function installBanner() {
    if (SP.standalone() || Date.now() - (SP.load('sp_inst_x', 0) || 0) < 30 * 864e5) return '';
    if (SP.canInstall) return `<div class="banner note inst">${I('download')}<span><b>${esc(t('installB'))}</b></span><button type="button" class="btn btn-ink sm" id="instgo">${esc(t('install'))}</button><button type="button" class="iconbtn ink" id="instx" aria-label="${esc(t('close'))}">${I('close')}</button></div>`;
    if (SP.isIOS) return `<div class="banner note inst">${I('download')}<span>${esc(t('iosInstall'))}</span><button type="button" class="iconbtn ink" id="instx" aria-label="${esc(t('close'))}">${I('close')}</button></div>`;
    return '';
  }
  function wireInstall(root) {
    const go = $('#instgo', root), x = $('#instx', root);
    if (go) go.onclick = async () => { await SP.install(); const b = go.closest('.banner'); if (b) b.remove(); };
    if (x) x.onclick = () => { SP.store('sp_inst_x', Date.now()); const b = x.closest('.banner'); if (b) b.remove(); };
  }
  document.addEventListener('sp:install', () => { if (SP.tab === 'home' && !$('.inst')) { const h = $('#home'); if (h) { h.insertAdjacentHTML('afterbegin', installBanner()); wireInstall(h); } } });

  SP.route(/^$/, async (m, n) => {
    if (gate(n)) return;
    const car = S.car, notice = (S.settings && S.settings.notice) || '';
    const brands = SP.popularIds().slice(0, 16).map(id => BRAND.get(id)).filter(Boolean);
    shell(homeBar() + `<section class="hero"><div class="wrap">
        ${S.settings.hero_title ? `<h1>${esc(S.settings.hero_title)}</h1>` : `<h1>${esc(t('heroA'))} <em>${esc(t('heroB'))}</em></h1>`}<p>${esc(S.settings.hero_sub || t('heroSub'))}</p>
        <form class="searchbox" role="search" id="hs">${I('search')}<input type="search" name="q" placeholder="${esc(t('searchPh'))}" enterkeyhint="search" aria-label="${esc(t('search'))}"><button class="go">${esc(t('search'))}</button></form>
        <div class="hero-row"><button type="button" class="plate" data-act="car"><span class="plate-band">${I('car')}</span>
          <span class="plate-main"><small>${esc(t('myCar'))}</small><strong>${esc(car ? SP.carText(car) : t('setCar'))}</strong></span>
          <span class="plate-edit">${car ? esc(t('change')) : I('plus')}</span></button>
          <div class="pulse" id="pulse" aria-live="polite"></div></div>${SP.CFG.heroCar ? `<img class="hero-car" src="${esc(SP.CFG.heroCar)}" alt="" aria-hidden="true">` : ''}</div></section><div class="hazard"></div>
      <main class="wrap" id="home">${SP.demo ? `<a class="banner warn demo-b" href="#mine">${I('info')}<span>${esc(t('demoB', { e: SP.CFG.demoEmail || 'owner@demo.app' }))}</span></a>` : ''}${installBanner()}
        ${notice ? `<div class="banner note">${I('megaphone')}<span>${esc(notice)}</span></div>` : ''}
        <a class="banner vinb" href="#vin">${I('barcode')}<span><b>${esc(t('vinCta'))}</b><small>${esc(t('vinSub'))}</small></span>${I('chevL', 'dirx')}</a>
        <section class="sec"><div class="sec-h"><h2>${esc(t('cats'))}</h2><a class="more" href="#cats">${esc(t('seeAll'))} ${I('chevL', 'dirx')}</a></div>
          <div class="cats">${D.CATS.slice(0, 7).map(c => `<a class="cat" ${sf({ cat: c.id })}><span class="hex">${I(c.icon)}</span><span>${esc(SP.catName(c.id, true))}</span></a>`).join('')}
          <a class="cat" href="#cats"><span class="hex dark">${I('grid')}</span><span>${esc(t('allCats'))}</span></a></div></section>
        <section class="sec"><div class="sec-h"><h2>${esc(t('brands'))}</h2><a class="more" href="#brands">${esc(t('seeAll'))} ${I('chevL', 'dirx')}</a></div>
          <div class="hscroll">${brands.map(b => `<a class="btile" href="#b-${b.id}"><span class="fl" aria-hidden="true">${SP.flag(b.origin)}</span><span>${esc(SP.brandName(b.id))}</span></a>`).join('')}</div></section>
        ${car ? `<section class="sec"><div class="sec-h"><h2>${esc(t('fitsYourCar'))} <small>${esc(SP.carText(car))}</small></h2><a class="more" ${sf({ fit: true })}>${esc(t('seeAll'))} ${I('chevL', 'dirx')}</a></div><div class="grid" id="gfit">${skel(4)}</div></section>` : ''}
        <section class="sec"><div class="sec-h"><h2>${esc(t('newArrivals'))}</h2><a class="more" ${sf({})}>${esc(t('seeAll'))} ${I('chevL', 'dirx')}</a></div><div class="grid" id="gnew">${skel(8)}</div></section>
        <section class="sec" id="secshops"><div class="sec-h"><h2>${esc(t('shops'))}</h2><a class="more" href="#shops">${esc(t('allShops'))} ${I('chevL', 'dirx')}</a></div><div class="hscroll" id="hshops"></div></section>
        ${SP.company && SP.contactCta ? SP.contactCta() : `<section class="cta"><h2>${esc(t('ctaT'))}</h2><p>${esc(t('ctaB'))}</p><a class="btn btn-signal" href="#mine">${I('store')} ${esc(t('ctaBtn'))}</a></section>`}
      </main>`);
    wireInstall($('#home'));
    $('#hs').onsubmit = e => { e.preventDefault(); S.f = { ...FDEF, q: e.target.q.value.trim(), fit: !!S.car && S.f.fit }; saveF(); SP.go('search'); };
    const cc = S.country;
    api.stats({ country: cc, city: S.city }).then(st => {
      if (!SP.alive(n)) return;
      $('#pulse').innerHTML = `<span><b class="num">${esc(SP.fmtNum(st.shops))}</b>${esc(SP.plural('shops', st.shops || 0))}</span><span><b class="num">${esc(SP.fmtNum(st.products))}</b>${esc(SP.plural('parts', st.products || 0))}</span>${S.city ? '' : `<span><b class="num">${esc(SP.fmtNum(st.cities))}</b>${esc(SP.plural('cities', st.cities || 0))}</span>`}`;
    }).catch(() => { /* the pulse is decorative */ });
    if (car) {
      api.search(SP.searchArgs({ ...FDEF, fit: true }, { limit: 4, strict: true })).then(r => {
        if (!SP.alive(n)) return;
        $('#gfit').innerHTML = r.items.length ? cards(r.items) : `<p class="muted-p wide">${esc(t('noFitParts', { car: SP.carText(car) }))}</p>`;
      }).catch(e => { if (SP.alive(n)) $('#gfit').innerHTML = errBox(e); });
    }
    try {
      const [r, sh] = await Promise.all([api.search(SP.searchArgs(FDEF, { limit: 8 })), api.shops({ p_country: cc, p_city: S.city || null, p_limit: 12 })]);
      if (!SP.alive(n)) return;
      $('#gnew').innerHTML = r.items.length ? cards(r.items) : empty('store', t('emptyStoreT'), t('emptyStoreB', { c: SP.countryName(cc) }), `<a class="btn btn-signal" href="#mine">${esc(t('firstShop'))}</a>`);
      if (sh.items.length) $('#hshops').innerHTML = sh.items.map(shopTile).join(''); else $('#secshops').remove();
    } catch (e) { if (SP.alive(n)) $('#gnew').innerHTML = errBox(e); }
    SP.done(n);
  }, { tab: 'home' });

  /* ---------- categories ---------- */
  const catRow = (c, k) => `<a class="catrow" ${sf({ cat: c.id })}><span class="hex">${I(c.icon)}</span><span class="cr-name">${esc(SP.catName(c.id))}</span><span class="cr-n num">${k == null ? '' : esc(SP.fmtNum(k))}</span>${I('chevL', 'dirx')}</a>`;
  SP.route(/^cats$/, async (m, n) => {
    if (gate(n)) return;
    shell(bar(t('cats'), '', { noBack: true }) + `<main class="wrap"><div class="catlist" id="cl">${D.CATS.map(c => catRow(c, null)).join('')}</div></main>`);
    try {
      const st = await api.stats({ country: S.country, city: S.city });
      if (SP.alive(n)) $('#cl').innerHTML = D.CATS.map(c => catRow(c, (st.cats || {})[c.id] || 0)).join('');
    } catch (e) { /* counts are optional */ }
    SP.done(n);
  }, { tab: 'cats' });

  /* ---------- search ---------- */
  function activeChips(f) {
    const L = [];
    if (S.city) L.push(['city', '📍 ' + S.city]);
    if (f.make) L.push(['make', SP.brandName(f.make) + (f.model ? ' ' + SP.modelName(f.make, f.model) : '')]);
    if (f.year) L.push(['year', t('modelYear', { y: f.year })]);
    if (f.cond) L.push(['cond', SP.condName(f.cond)]);
    return L.length ? `<div class="chips light">${L.map(([k, v]) => `<button type="button" class="chip" data-rm="${k}" aria-label="${esc(t('removeX', { x: v }))}">${esc(v)} ${I('close')}</button>`).join('')}</div>` : '';
  }
  SP.route(/^search$/, async (m, n) => {
    if (gate(n)) return;
    const f = S.f, nf = [f.make, f.year, f.cond].filter(Boolean).length;
    const title = f.q ? t('resultsFor', { q: f.q }) : (f.cat ? SP.catName(f.cat) : t('results'));
    shell(bar(title, `<button type="button" class="iconbtn" id="fbtn" aria-label="${esc(t('filters'))}">${I('filter')}<span class="badge"${nf ? '' : ' hidden'}>${nf}</span></button>`) +
      `<div class="searchbar"><div class="wrap"><form class="searchbox" id="sq" role="search">${I('search')}<input type="search" name="q" value="${esc(f.q)}" placeholder="${esc(t('searchPh2'))}" enterkeyhint="search" aria-label="${esc(t('search'))}"><button class="go">${esc(t('search'))}</button></form>
        <div class="chips" id="cchips">${S.car ? `<button type="button" class="chip${f.fit ? ' on' : ''}" id="cfit" aria-pressed="${!!f.fit}">${I('car')} ${esc(t('fitMine'))}</button>` : ''}<button type="button" class="chip${!f.cat ? ' on' : ''}" data-c="">${esc(t('all'))}</button>${D.CATS.map(c => `<button type="button" class="chip${f.cat === c.id ? ' on' : ''}" data-c="${c.id}">${esc(SP.catName(c.id, true))}</button>`).join('')}</div></div></div>
      <main class="wrap"><div class="res-head"><span class="rcount" id="rc" aria-live="polite">${esc(t('loading'))}</span>
        <label class="sortsel">${I('sort')}<span class="sr">${esc(t('sortBy'))}</span><select id="sort">${opt('new', t('sortNew'), f.sort)}${opt('cheap', t('sortCheap'), f.sort)}${opt('exp', t('sortExp'), f.sort)}</select></label></div>
        ${activeChips(f)}<div class="grid" id="grid">${skel(8)}</div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    const on = $('#cchips .chip.on:not(#cfit)');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    const again = () => { saveF(); SP.render(); };
    $('#sq').onsubmit = e => { e.preventDefault(); f.q = e.target.q.value.trim(); e.target.q.blur(); again(); };
    $('#cchips').onclick = e => { const b = e.target.closest('[data-c]'); if (b) { f.cat = b.dataset.c; again(); } };
    if ($('#cfit')) $('#cfit').onclick = () => { f.fit = !f.fit; again(); };
    $('#sort').onchange = e => { f.sort = e.target.value; again(); };
    $('#fbtn').onclick = filtersSheet;
    $$('[data-rm]').forEach(b => b.onclick = () => {
      const k = b.dataset.rm;
      if (k === 'city') SP.setCity(''); else if (k === 'make') { f.make = ''; f.model = ''; } else f[k] = '';
      again();
    });
    await pager(n, $('#grid'), $('#more'), off => api.search(SP.searchArgs(f, { offset: off })), cards, (r, first) => {
      if (!first) return;
      $('#rc').textContent = SP.count(r.total, 'results');
      if (!r.total) $('#grid').innerHTML = empty('search', t('noResT'), t('noResB'), (nf || f.cat || f.fit || S.city) ? `<button type="button" class="btn btn-ghost" id="clrall">${esc(t('clearAll'))}</button>` : '');
      const c = $('#clrall');
      if (c) c.onclick = () => { S.f = { ...FDEF, q: f.q }; SP.setCity(''); again(); };
    });
    SP.done(n);
  }, { tab: '' });

  /* ---------- product ---------- */
  function waText(p, cur) {
    const car = S.car ? t('waCar', { car: SP.carText(S.car) }) + (S.car.vin ? t('vinMsg', { v: S.car.vin }) : '') : '';
    const pn = p.part_no || p.sku ? t('waPn', { pn: p.part_no || p.sku }) : '';
    return (p.price == null ? t('waMsgNoPrice', { title: p.title, pn, car }) : t('waMsg', { title: p.title, pn, price: SP.priceText(p.price, cur), car })) + '\n' + SP.siteUrl() + '#p-' + p.id;
  }
  function drawProduct(p, n) {
    const sh = p.shop || {}, cur = sh.currency || SP.currencyOf(S.country), on = S.favs.has(p.id);
    const mine = S.user && (S.user.id === p.owner_id || S.admin || (SP.can && SP.can('products')));
    const fit = SP.fitsCar(p, S.car);
    const imgs = p.imgs.length ? p.imgs.map((u, i) => `<div class="slide">${SP.imgTag(u, '', p.title + ' ' + (i + 1))}</div>`).join('') : `<div class="slide noimg">${I(catIcon(p.cat))}<span>${esc(t('noImgs'))}</span></div>`;
    const wa = SP.waLink(sh.whatsapp || sh.phone, waText(p, cur), sh.country), tel = SP.telHref(sh.phone || sh.whatsapp, sh.country);
    shell(bar(sh.name || t('details'), `<button type="button" class="iconbtn" id="psh" aria-label="${esc(t('share'))}">${I('share')}</button>
        <button type="button" class="iconbtn fav-top${on ? ' on' : ''}" data-act="fav" data-id="${p.id}" aria-pressed="${on}" aria-label="${esc(t(on ? 'favRemove' : 'favAdd'))}">${I('heart', on ? 'f' : '')}</button>`) +
      `<div class="pd-grid wrap-lg"><div class="gallery"><div class="gal-track" id="gt">${imgs}</div>${p.imgs.length > 1 ? `<span class="gal-count" id="gc">1/${p.imgs.length}</span>` : ''}
        <div class="ribbons">${p.status === 'sold' ? `<span class="ribbon sold">${esc(t('soldOut'))}</span>` : ''}</div></div>
      <div class="pd-info wrap"><div class="pd-tags"><span class="cchip ${esc(p.cond)}">${esc(SP.condName(p.cond))}</span><span class="cchip">${esc(SP.catName(p.cat))}</span>${p.part_no ? `<span class="pn">${esc(p.part_no)}</span>` : ''}</div>
        <h1 class="pd-title">${esc(p.title)}</h1>
        <div class="pd-price">${SP.priceHTML(p.price, cur, p.price_hidden)}${p.nego ? `<span class="nego">${esc(t('nego'))}</span>` : ''}</div>
        <div class="fitbox">${I('car')}<span><small>${esc(t('fitsOn'))}</small><strong>${esc(SP.fitText(p))}</strong>
          ${fit === true ? `<em class="ok">${I('check')} ${esc(t('fitsYours', { car: SP.carText(S.car) }))}</em>` : fit === false ? `<em class="no">${I('warn')} ${esc(t('notYours', { car: SP.carText(S.car) }))}</em>` : ''}</span></div>
        <dl class="specs"><div><dt>${esc(t('qty'))}</dt><dd>${p.qty == null ? esc(t('inStock')) : esc(SP.fmtNum(p.qty))}</dd></div>
          <div><dt>${esc(t('partNo'))}</dt><dd class="mono">${esc(p.part_no || '—')}</dd></div>
          <div><dt>${esc(t('listed'))}</dt><dd>${esc(SP.ago(p.created_at))}</dd></div>
          <div><dt>${esc(t('city'))}</dt><dd>${esc(sh.city || '—')}</dd></div></dl>
        ${p.descr ? `<section class="pd-desc"><h2>${esc(t('fromShop'))}</h2><p>${esc(p.descr)}</p></section>` : ''}
        ${sh.id ? `<a class="pd-shop" href="#s-${sh.id}">${avatar(sh)}<span class="ps-main"><span class="ps-name">${esc(sh.name)}${vb(sh)}</span><span class="ps-meta">${I('pin')} ${esc(sh.city)}${sh.area ? ' · ' + esc(sh.area) : ''}</span></span>${I('chevL', 'dirx')}</a>` : ''}
        ${mine ? `<div class="manage"><span class="manage-t">${I('shield')} ${esc(t('youPart'))}</span>
          <a class="btn btn-ghost sm" href="#edit-item-${p.id}">${I('edit')} ${esc(t('edit'))}</a>
          <button type="button" class="btn btn-ghost sm" id="psold">${I(p.status === 'sold' ? 'check' : 'box')} ${esc(t(p.status === 'sold' ? 'markAvail' : 'markSold'))}</button>
          <button type="button" class="btn btn-danger sm" id="pdel">${I('trash')} ${esc(t('del'))}</button></div>` : ''}
        <section class="pd-more" id="pmore" hidden><h2>${esc(t('moreShop'))}</h2><div class="grid" id="pmg"></div></section>
      </div></div>
      <div class="actionbar"><div class="wrap">${p.status === 'sold' ? `<p class="note">${esc(t('soldNote'))}</p>` : (S.settings.orders_enabled ? `<button type="button" class="btn btn-signal" id="padd">${I('plus')} ${esc(t('addCart'))}</button>` : '') + (wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('whatsapp'))}</a>` : '') + (tel ? `<a class="btn btn-ghost" href="${esc(tel)}">${I('phone')} ${esc(t('call'))}</a>` : '') + (!wa && !tel ? `<p class="note">${esc(t('noNumber'))}</p>` : '')}</div></div>`, { actionbar: true });
    const gt = $('#gt'), gc = $('#gc');
    if (gc) gt.addEventListener('scroll', SP.debounce(() => { gc.textContent = (Math.round(Math.abs(gt.scrollLeft) / gt.clientWidth) + 1) + '/' + p.imgs.length; }, 60), { passive: true });
    if ($('#padd')) $('#padd').onclick = () => { SP.cart.add(p.id); SP.toast(t('addedCart')); };
    $('#psh').onclick = () => share(t('sharePart'), [p.title, t('shPrice', { p: SP.priceText(p.price, cur, p.price_hidden) }), t('shFits', { f: SP.fitText(p) }), sh.name ? t('shAt', { s: sh.name + ' · ' + sh.city }) : '', t('shVia')].filter(Boolean).join('\n'), SP.siteUrl() + '#p-' + p.id);
    if (mine) {
      $('#psold').onclick = async () => {
        const b = $('#psold'); b.classList.add('busy');
        try { const q = await api.setStatus(p.id, p.status === 'sold' ? 'active' : 'sold'); q.shop = p.shop; SP.toast(t(q.status === 'sold' ? 'soldToast' : 'availToast')); drawProduct(q, n); }
        catch (e) { b.classList.remove('busy'); SP.toast(SP.errText(e)); }
      };
      $('#pdel').onclick = async () => {
        if (!await SP.confirmSheet({ title: t('delPartQ', { t: p.title }), body: t('delPartB'), ok: t('delPartOk'), danger: true })) return;
        try { await api.deleteProduct(p); S.favs.delete(p.id); SP.toast(t('partDeleted')); SP.go(sh.id ? 's-' + sh.id : 'mine'); } catch (e) { SP.toast(SP.errText(e)); }
      };
    }
  }
  SP.route(/^p-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    const id = m[1];
    let p = S.pcache.get(id);
    if (p) drawProduct(p, n); else shell(bar(t('details')) + `<div class="wrap"><div class="sk sk-hero"></div><div class="sk sk-block"></div></div>`);
    try { p = await api.product(id); } catch (e) { if (!S.pcache.get(id)) { failView(e, n); return; } p = S.pcache.get(id); }
    if (!SP.alive(n)) return;
    if (!p) { shell(bar(t('details')) + `<main class="wrap">${empty('box', t('partMissingT'), t('partMissingB'), `<a class="btn btn-ink" href="#">${esc(t('backHome'))}</a>`)}</main>`); return; }
    drawProduct(p, n);
    SP.done(n);
    try {
      const r = await api.search({ p_shop: p.shop_id, p_limit: 9 });
      const items = r.items.filter(x => x.id !== p.id).slice(0, 8);
      if (SP.alive(n) && items.length) { $('#pmg').innerHTML = cards(items); $('#pmore').hidden = false; }
    } catch (e) { /* optional */ }
  });

  /* ---------- shops ---------- */
  SP.route(/^shops$/, async (m, n) => {
    if (gate(n)) return;
    shell(bar(t(SP.company ? 'branches' : 'shops'), `<button type="button" class="iconbtn" data-act="loc" aria-label="${esc(t('chooseCity'))}">${I('pin')}</button>`, { noBack: true }) +
      `<main class="wrap"><form class="searchbox flat" id="shq" role="search" style="margin-top:16px">${I('search')}<input type="search" name="q" value="${esc(S.shq || '')}" placeholder="${esc(t('shopsPh'))}" aria-label="${esc(t('search'))}"></form>
      <div class="res-head"><span class="rcount" id="rc"></span><span class="rcount">${SP.flag(S.country)} ${esc(S.city || SP.countryName(S.country))}</span></div>
      <div class="shops" id="sl">${'<div class="sk sk-row"></div>'.repeat(4)}</div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></main>`);
    const q = S.shq || '';
    const inp = $('#shq input');
    inp.oninput = SP.debounce(() => { S.shq = inp.value.trim(); SP.render(); }, 450);
    $('#shq').onsubmit = e => { e.preventDefault(); S.shq = inp.value.trim(); SP.render(); };
    const mk = SP.VIN.matchBrand(q);
    await pager(n, $('#sl'), $('#more'), off => api.shops({ p_country: S.country, p_city: S.city || null, p_q: mk ? null : (q || null), p_make: mk || null, p_limit: 30, p_offset: off }),
      items => items.map(shopRow).join(''), (r, first) => {
        if (!first) return;
        $('#rc').textContent = SP.count(r.total, 'shops');
        if (!r.total) $('#sl').innerHTML = empty('store', t('noShopsT'), t('noShopsB'), `<a class="btn btn-signal" href="#mine">${esc(t('registerShop'))}</a>`);
      });
    if (document.activeElement === document.body && q) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
    SP.done(n);
  }, { tab: 'shops' });

  SP.route(/^s-([0-9a-f-]{36})$/, async (m, n) => {
    if (gate(n)) return;
    const id = m[1];
    let s = S.scache.get(id);
    if (!s) shell(bar(t('shop')) + `<div class="sk" style="height:150px;border-radius:0"></div><div class="wrap"><div class="sk sk-block"></div></div>`);
    try { s = await api.shop(id); } catch (e) { if (!s) { failView(e, n); return; } }
    if (!SP.alive(n)) return;
    if (!s) { shell(bar(t('shop')) + `<main class="wrap">${empty('store', t('shopMissingT'), t('shopMissingB'), `<a class="btn btn-ink" href="#shops">${esc(t('allShops'))}</a>`)}</main>`); return; }
    const mine = S.user && (S.user.id === s.owner_id || S.admin || (SP.can && SP.can('products')));
    const wa = SP.waLink(s.whatsapp || s.phone, t('waShop', { name: s.name }), s.country), tel = SP.telHref(s.phone || s.whatsapp, s.country);
    shell(bar(s.name, `<button type="button" class="iconbtn" id="ssh" aria-label="${esc(t('shareShop'))}">${I('share')}</button>`) +
      `<div class="sp-cover">${s.cover ? SP.imgTag(s.cover, '', s.name) : ''}</div>
      <div class="wrap sp-info"><div class="sp-head"><span class="hexring">${avatar(s, 'lg')}</span><div class="sp-titles"><h1 class="sp-name">${esc(s.name)}${vb(s)}</h1>${s.person ? `<span class="muted-p">${esc(s.person)}</span>` : ''}</div></div>
        <div class="sp-meta"><span>${I('pin')} ${esc(s.city)}${s.area ? ' · ' + esc(s.area) : ''}</span>${s.hours ? `<span>${I('clock')} ${esc(s.hours)}</span>` : ''}<span><span aria-hidden="true">${SP.flag(s.country)}</span> ${esc(SP.countryName(s.country))}</span></div>
        ${s.makes.length ? `<div class="mk">${s.makes.map(x => `<span>${esc(SP.brandName(x))}</span>`).join('')}</div>` : ''}
        ${s.about ? `<p class="sp-about">${esc(s.about)}</p>` : ''}
        <div class="sp-contact">${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('whatsapp'))}</a>` : ''}${tel ? `<a class="btn btn-ghost" href="${esc(tel)}">${I('phone')} <span class="ltr">${esc(SP.prettyPhone(s.phone || s.whatsapp, s.country))}</span></a>` : ''}</div>
        ${mine ? `<div class="manage"><span class="manage-t">${I('shield')} ${esc(t('youShop'))}</span><a class="btn btn-signal sm" href="#new-item-${s.id}">${I('plus')} ${esc(t('addPart'))}</a><a class="btn btn-ghost sm" href="#edit-shop-${s.id}">${I('edit')} ${esc(t('editShop'))}</a></div>` : ''}
        <section class="sec"><div class="sec-h"><h2>${esc(t('stock'))} <small id="stn"></small></h2></div>
          <form class="searchbox flat" id="spq" role="search">${I('search')}<input type="search" name="q" value="${esc(S.spId === id ? S.spq || '' : '')}" placeholder="${esc(t('searchShopPh'))}" aria-label="${esc(t('search'))}"></form>
          <div class="grid sp-grid" id="grid">${skel(4)}</div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></section></div>`);
    $('#ssh').onclick = () => share(t('shareShop'), [s.name, s.city + (s.area ? ' · ' + s.area : ''), t('shVia')].join('\n'), SP.siteUrl() + '#s-' + s.id);
    if (S.spId !== id) { S.spId = id; S.spq = ''; }
    $('#spq').onsubmit = e => { e.preventDefault(); S.spq = e.target.q.value.trim(); SP.render(); };
    await pager(n, $('#grid'), $('#more'), off => api.search({ ...SP.searchArgs({ ...FDEF, q: S.spq }, { offset: off, shop: id }), p_country: null, p_include_sold: !!mine }), cards, (r, first) => {
      if (!first) return;
      $('#stn').textContent = SP.count(r.total, 'parts');
      if (!r.total) $('#grid').innerHTML = S.spq ? empty('search', t('notInShop'), t('tryOther')) : (mine ? empty('camera', t('shopEmptyT'), t('shopEmptyB'), `<a class="btn btn-signal" href="#new-item-${s.id}">${I('plus')} ${esc(t('addFirst'))}</a>`) : empty('box', t('shopEmptyT')));
    });
    SP.done(n);
  });

  /* ---------- favourites ---------- */
  SP.route(/^favs$/, async (m, n) => {
    if (gate(n)) return;
    const ids = [...S.favs];
    shell(bar(t('favs'), '', { noBack: true }) + `<main class="wrap"><div class="res-head"><span class="rcount">${esc(SP.count(ids.length, 'parts'))} · ${esc(t('savedHere'))}</span></div><div class="grid" id="grid">${ids.length ? skel(Math.min(ids.length, 8)) : ''}</div></main>`);
    if (!ids.length) { $('#grid').outerHTML = empty('heart', t('favsEmptyT'), t('favsEmptyB'), `<a class="btn btn-ink" ${sf({})}>${esc(t('findPart'))}</a>`); return; }
    try {
      const items = await api.byIds(ids);
      if (!SP.alive(n)) return;
      const order = new Map(ids.map((id, i) => [id, i]));
      items.sort((a, b) => order.get(b.id) - order.get(a.id));
      $('#grid').innerHTML = items.length ? cards(items) : '';
      if (!items.length) $('#grid').outerHTML = empty('heart', t('favsEmptyT'), t('favsEmptyB'));
    } catch (e) { if (SP.alive(n)) $('#grid').innerHTML = errBox(e); }
    SP.done(n);
  }, { tab: 'favs' });

  /* ---------- brands ---------- */
  SP.route(/^brands$/, (m, n) => {
    const ALL = SP.brandsList(), P = SP.popularIds();
    const total = ALL.reduce((k, b) => k + b.models.length, 0);
    const pop = P.map(id => BRAND.get(id)).filter(Boolean);
    const rest = ALL.filter(b => !P.includes(b.id)).sort((a, b) => SP.brandName(a.id).localeCompare(SP.brandName(b.id), SP.LANG));
    const row = b => `<a class="catrow" href="#b-${b.id}" data-k="${esc(SP.norm(b.en + ' ' + b.ar + ' ' + b.id))}"><span class="hex bfl"><span aria-hidden="true">${SP.flag(b.origin)}</span></span><span class="cr-name">${esc(SP.brandName(b.id))}${SP.LANG === 'ar' ? ` <small class="ltr">${esc(b.en)}</small>` : ''}</span><span class="cr-n">${esc(t('modelsN', { n: SP.fmtNum(b.models.length) }))}</span>${I('chevL', 'dirx')}</a>`;
    shell(bar(t('allBrandsT')) + `<main class="wrap"><p class="muted-p" style="margin-top:14px">${esc(t('brandsSub', { b: SP.fmtNum(ALL.length), m: SP.fmtNum(total) }))}</p>
      <form class="searchbox flat" id="bq" role="search" style="margin-top:12px">${I('search')}<input type="search" placeholder="${esc(t('searchBrand'))}" aria-label="${esc(t('searchBrand'))}"></form>
      <h2 class="lbl optg">${esc(t('popularBrands'))}</h2><div class="catlist bl">${pop.map(row).join('')}</div>
      <h2 class="lbl optg">${esc(t('allBrandsT'))}</h2><div class="catlist bl">${rest.map(row).join('')}</div></main>`);
    $('#bq').onsubmit = e => e.preventDefault();
    $('#bq input').oninput = SP.debounce(e => {
      const q = SP.norm(e.target.value);
      $$('.bl .catrow').forEach(a => { a.hidden = !!q && !a.dataset.k.includes(q); });
      $$('.optg').forEach(h => { h.hidden = !!q; });
    }, 100);
    SP.done(n);
  });
  SP.route(/^b-([a-z0-9]+)$/, (m, n) => {
    const b = BRAND.get(m[1]);
    if (!b) { SP.go('brands'); return; }
    const row = x => `<a class="catrow" ${sf({ make: b.id, model: x.en })} data-k="${esc(SP.norm(x.en + ' ' + (x.ar || '')))}"><span class="cr-name">${esc(SP.LANG === 'ar' && x.ar ? x.ar : x.en)}${SP.LANG === 'ar' && x.ar && x.ar !== x.en ? ` <small class="ltr">${esc(x.en)}</small>` : ''}</span><span class="cr-n num">${x.from}–${x.to}</span>${I('chevL', 'dirx')}</a>`;
    shell(bar(SP.brandName(b.id)) + `<main class="wrap"><div class="bhead"><span class="bflag" aria-hidden="true">${SP.flag(b.origin)}</span><span><b>${esc(SP.brandName(b.id))}</b><small>${esc(t('madeIn', { c: SP.countryName(b.origin) }))} · ${esc(t('modelsN', { n: SP.fmtNum(b.models.length) }))}</small></span></div>
      <div class="mactions"><a class="btn btn-signal" ${sf({ make: b.id })}>${I('search')} ${esc(t('partsFor', { b: SP.brandName(b.id) }))}</a><a class="btn btn-ghost" href="#shops" id="bshops">${I('store')} ${esc(t('shops'))}</a></div>
      <h2 class="lbl optg">${esc(t('modelsOf', { b: SP.brandName(b.id) }))}</h2>
      <form class="searchbox flat" id="mq" role="search">${I('search')}<input type="search" placeholder="${esc(t('searchModel'))}" aria-label="${esc(t('searchModel'))}"></form>
      <div class="catlist ml">${b.models.map(row).join('')}</div></main>`);
    $('#bshops').onclick = () => { S.shq = b.en; };
    $('#mq').onsubmit = e => e.preventDefault();
    $('#mq input').oninput = SP.debounce(e => { const q = SP.norm(e.target.value); $$('.ml .catrow').forEach(a => { a.hidden = !!q && !a.dataset.k.includes(q); }); }, 100);
    SP.done(n);
  });

  /* ---------- VIN page ---------- */
  function vinCard(r) {
    const [kind, note] = vinMessage(r);
    if (!r.valid || (!r.brandId && !r.maker)) return `<div class="banner warn">${I('warn')}<span>${esc(note)}</span></div>`;
    const sp = r.specs || {}, bn = r.brandId ? SP.brandName(r.brandId) : r.maker;
    const model = r.model ? (SP.LANG === 'ar' && r.model.ar ? r.model.ar : r.model.en) : (r.modelText || '');
    const rows = [];
    const add = (k, v, cls) => { if (v) rows.push(`<div><dt>${esc(t(k))}</dt><dd${cls ? ` class="${cls}"` : ''}>${esc(v)}</dd></div>`); };
    add('vinMaker', r.maker && r.maker !== bn ? r.maker : bn);
    add('vinMade', r.country ? SP.flag(r.country) + ' ' + SP.countryName(r.country) : '');
    add('vinYear', r.year ? r.year + (r.yearSure ? '' : ' (' + t('vinApprox') + ')') : '');
    add('vinTrim', sp.trim);
    add('vinBody', sp.bodyKey ? t('body' + sp.bodyKey[0].toUpperCase() + sp.bodyKey.slice(1)) : sp.body);
    add('vinEngine', [sp.liters ? sp.liters + ' ' + t('unitL') : '', sp.cyl ? sp.cyl + ' ' + t('unitCyl') : '', sp.hp ? sp.hp + ' ' + t('unitHp') : ''].filter(Boolean).join(' · '));
    add('vinFuel', sp.fuelKey ? t(sp.fuelKey) : sp.fuel);
    add('vinDrive', sp.drive);
    add('vinTrans', sp.transKey ? (sp.transKey.startsWith('trans') ? t(sp.transKey) : sp.transKey) : sp.trans);
    add('vinPlant', [sp.plantCity, sp.plantCountry].filter(Boolean).join(', '));
    return `<section class="vincard"><div class="vin-head"><span class="bflag" aria-hidden="true">${SP.flag(r.country)}</span><span><b>${esc([bn, model, r.year].filter(Boolean).join(' '))}</b><small class="ltr mono">${esc(r.vin)}</small></span></div>
      <dl class="specs">${rows.join('')}</dl><div class="banner ${kind}">${I(kind === 'warn' ? 'warn' : 'info')}<span>${esc(note)}</span></div>
      ${r.brandId ? `<div class="sheet-actions"><button type="button" class="btn btn-signal" id="vuse">${I('car')} ${esc(t('vinUse'))}</button><a class="btn btn-ghost" ${sf({ fit: true })} id="vparts">${I('search')} ${esc(t('vinParts'))}</a></div>` : ''}</section>`;
  }
  SP.route(/^vin$/, (m, n) => {
    shell(bar(t('vinShort')) + `<main class="wrap form-wrap"><h2 class="pd-title">${esc(t('vinT'))}</h2><p class="muted-p">${esc(t('vinSub'))}</p>
      <form class="form" id="vf" style="margin-top:16px" novalidate><div class="field"><label for="vin">${esc(t('vin'))}</label>
        <input id="vin" class="input mono vin-in" maxlength="24" value="${esc((S.car && S.car.vin) || '')}" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" dir="ltr" placeholder="KMHCT41DBEU123456" enterkeyhint="go">
        <span class="hint">${esc(t('vinWhere'))}</span></div>
        <button class="btn btn-signal block" id="vgo">${I('barcode')} ${esc(t('vinBtn'))}</button></form>
      <div id="vres" aria-live="polite"></div><p class="hint" style="margin-top:18px">${esc(t('vinSource'))}</p></main>`);
    let last = null;
    $('#vf').onsubmit = async e => {
      e.preventDefault();
      const b = $('#vgo'); b.classList.add('busy');
      $('#vres').innerHTML = `<p class="muted-p" style="margin-top:14px">${esc(t('vinReading'))}</p>`;
      last = await SP.VIN.decode($('#vin').value);
      b.classList.remove('busy');
      if (!SP.alive(n)) return;
      if (last.valid) $('#vin').value = last.vin;
      $('#vres').innerHTML = vinCard(last);
      const use = () => SP.setCar({ make: last.brandId, model: last.model ? last.model.en : (last.modelText || ''), year: last.year || '', vin: last.vin });
      if ($('#vuse')) $('#vuse').onclick = () => { use(); SP.toast(t('carSaved')); };
      if ($('#vparts')) $('#vparts').addEventListener('click', use, true);
    };
    if ($('#vin').value) $('#vf').requestSubmit ? $('#vf').requestSubmit() : $('#vf').onsubmit(new Event('submit'));
    SP.done(n);
  });
})();
