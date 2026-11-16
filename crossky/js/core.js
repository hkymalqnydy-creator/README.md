/* Sparat core: helpers, translations, state, Supabase data layer, images, sheets, router. */
(function () {
  'use strict';
  const CFG = window.SPARAT_CONFIG || {};
  const D = window.SP_DATA, L = window.SP_I18N, VIN = window.SP_VIN, I = window.SP_I;
  const SP = window.SP = { CFG, D, L, VIN, I };
  if (/^[a-z]+$/.test(CFG.skin || '')) document.documentElement.setAttribute('data-skin', CFG.skin);

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const arr = v => Array.isArray(v) ? v : [];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function debounce(fn, ms) { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; }
  function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function digits(s) {
    return String(s == null ? '' : s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0)
      .replace(/٫/g, '.').replace(/٬/g, ',');
  }
  /* Same folding as public.norm_ar on the server, plus punctuation removal. */
  function norm(s) {
    return digits(s).toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .normalize('NFD').replace(/([a-z])[̀-ͯ]+/g, '$1').normalize('NFC')
      .replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ı/g, 'i').replace(/ß/g, 'ss')
      .replace(/[^\p{L}\p{N}\s\-\/.]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function opt(v, label, cur) { return `<option value="${esc(v)}"${String(cur == null ? '' : cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`; }

  /* ---------- countries, brands ---------- */
  const COUNTRY = new Map(D.COUNTRIES.map(c => [c.code, c]));
  const BRAND = new Map(D.BRANDS.map(b => [b.id, b]));
  const flag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '';
  const currencyOf = cc => (COUNTRY.get(cc) || {}).currency || 'USD';
  const dialOf = cc => (COUNTRY.get(cc) || {}).dial || '';

  /* ---------- language ---------- */
  let LANG = 'ar', LI = 0, PR = null, RTF = null, NF = null, DN = null;
  function setLang(code) {
    let i = L.LANGS.findIndex(l => l.code === code);
    if (i < 0) i = 0;
    LI = i; LANG = L.LANGS[i].code; PR = RTF = NF = DN = null;
    const h = document.documentElement;
    h.lang = LANG; h.dir = L.LANGS[i].dir;
    store('sp_lang', LANG);
    SP.LANG = LANG; SP.LI = LI; SP.dir = L.LANGS[i].dir;
  }
  function guessLang() {
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ar']);
    for (const l of list) { const b = String(l).slice(0, 2).toLowerCase(); if (L.LANGS.some(x => x.code === b)) return b; }
    return CFG.defaultLang || 'ar';
  }
  function t(key, vars) {
    const row = L.T[key];
    let s = row ? (row[LI] != null ? row[LI] : row[1]) : key;
    const bn = (S.settings && S.settings.brand_name) || CFG.appName;
    if (bn && row) s = s.replace(/سبيرات|Sparat/g, bn);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : '');
    return s;
  }
  function fmtNum(n) { try { NF = NF || new Intl.NumberFormat(LANG + '-u-nu-latn'); return NF.format(n || 0); } catch (e) { return String(n || 0); } }
  function plural(word, n) {
    try { PR = PR || new Intl.PluralRules(LANG); } catch (e) { PR = { select: () => 'other' }; }
    const forms = (L.P[word] || [])[LI] || {};
    return forms[PR.select(n)] || forms.other || '';
  }
  const count = (n, word) => fmtNum(n) + ' ' + plural(word, n);
  function countryName(cc) {
    if (!cc) return '';
    try { DN = DN || new Intl.DisplayNames([LANG], { type: 'region' }); return DN.of(cc) || cc; } catch (e) { return cc; }
  }
  function priceParts(v, cur) {
    try {
      return new Intl.NumberFormat(LANG + '-u-nu-latn', { style: 'currency', currency: cur || 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: v % 1 ? 2 : 0 }).formatToParts(v);
    } catch (e) { return [{ type: 'integer', value: fmtNum(v) }, { type: 'literal', value: ' ' }, { type: 'currency', value: cur || '' }]; }
  }
  /* Why a price is not shown: owner hid it, or the customer must sign in / be approved first. */
  function hiddenLabel() {
    const m = (S.settings && S.settings.price_mode) || 'all';
    if ((m === 'members' || m === 'approved') && !S.user) return t('loginPrice');
    if (m === 'approved' && S.user && !(S.customer && S.customer.approved)) return t('approvedPrice');
    return t('callPrice');
  }
  function priceHTML(v, cur, hidden) {
    if (v == null) return hidden ? `<span class="price call locked">${I('lock')} ${esc(hiddenLabel())}</span>` : `<span class="price call">${esc(t('callPrice'))}</span>`;
    return '<span class="price num">' + priceParts(v, cur).map(p => p.type === 'currency' ? `<small>${esc(p.value)}</small>` : esc(p.value)).join('') + '</span>';
  }
  const priceText = (v, cur, hidden) => v == null ? (hidden ? hiddenLabel() : t('callPrice')) : priceParts(v, cur).map(p => p.value).join('');
  function ago(ms) {
    if (!ms) return '';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    try {
      RTF = RTF || new Intl.RelativeTimeFormat(LANG, { numeric: 'auto' });
      for (const [u, sec] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
        if (s >= sec) return RTF.format(-Math.floor(s / sec), u);
      }
      return RTF.format(0, 'second');
    } catch (e) { return new Date(ms).toISOString().slice(0, 10); }
  }

  const brandName = id => {
    if (!id || id === 'any') return '';
    if (id === 'other') return t('otherBrand');
    const b = BRAND.get(id);
    return b ? (LANG === 'ar' ? b.ar : b.en) : id;
  };
  /* A brand's mark, shown where the country flag used to be: the logo the company uploaded for it (settings.brand_logos,
     or the map given while editing), otherwise the brand's initials on a hexagon in one of the app's own tones. */
  const MARK_TONES = ['#2f54e6', '#1b2a6b', '#0e7c86', '#6b3fa0', '#3b4566', '#1f6f43', '#24539c', '#4a3a8c'];
  function brandInitials(b) {
    const en = String(b.en || b.id || '').split(' / ')[0].replace(/\(.*?\)/g, '').trim();
    if (/^[A-Z0-9]{2,4}$/.test(en)) return en;
    const w = en.split(/[\s\-&]+/).filter(x => /^\p{L}/u.test(x));
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || en || '?')[0]).toUpperCase();
  }
  function brandMark(id, logos) {
    const b = BRAND.get(id);
    if (!b) return '';
    const map = logos || (S.settings && S.settings.brand_logos) || {}, logo = typeof map[id] === 'string' ? map[id] : '';
    if (logo) return `<span class="bmark img" aria-hidden="true"><img src="${esc(logo)}" alt="" decoding="async"></span>`;
    const ini = brandInitials(b);
    return `<span class="bmark${ini.length === 3 ? ' sm' : ini.length > 3 ? ' xs' : ''}" style="--bm:${MARK_TONES[toneOf(id)]}" aria-hidden="true">${esc(ini)}</span>`;
  }
  /* each brand keeps one tone; brands with the same initials (Honda, Hyundai) get different tones */
  let markTone = null;
  function toneOf(id) {
    if (!markTone) {
      markTone = new Map(); const seen = {};
      BRAND.forEach(b => { const k = brandInitials(b), n = seen[k] = (seen[k] || 0) + 1; let h = 0;
        for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        markTone.set(b.id, (h + n - 1) % MARK_TONES.length); });
    }
    return markTone.get(id) || 0;
  }
  const modelObj = (make, model) => { const b = BRAND.get(make); return b && model ? b.models.find(m => m.en === model) || null : null; };
  const modelName = (make, model) => { if (!model) return ''; const m = modelObj(make, model); return m ? (LANG === 'ar' && m.ar ? m.ar : m.en) : model; };
  const carText = c => c && c.make ? [brandName(c.make), modelName(c.make, c.model), c.year].filter(Boolean).join(' ') : '';
  const catName = (id, short) => { const r = L.CAT[id]; return r ? r[LI][short ? 1 : 0] : id; };
  const condName = (id, short) => { const r = L.COND[id]; return r ? r[LI][short ? 1 : 0] : id; };
  function fitText(p) {
    if (!p.make || p.make === 'any') return t('universal');
    let s = brandName(p.make) + ' ' + (p.model ? modelName(p.make, p.model) : '(' + t('allModels') + ')');
    if (p.y_from && p.y_to) s += ' ' + (p.y_from === p.y_to ? p.y_from : p.y_from + '–' + p.y_to);
    else if (p.y_from) s += ' ' + t('yearsFrom', { y: p.y_from });
    else if (p.y_to) s += ' ' + t('yearsTo', { y: p.y_to });
    return s;
  }
  function fitsCar(p, c) {
    if (!c || !c.make) return null;
    if (p.make === 'any') return true;
    if (p.make !== c.make) return false;
    if (p.model && c.model && p.model !== c.model) return false;
    const y = +c.year;
    if (y && ((p.y_from && y < p.y_from) || (p.y_to && y > p.y_to))) return false;
    return true;
  }
  /* WhatsApp numbers: local numbers get the shop country's dial code. */
  function waNum(raw, cc) {
    let d = digits(raw).replace(/[^\d+]/g, '');
    if (!d) return '';
    if (d.startsWith('+')) d = d.slice(1);
    else if (d.startsWith('00')) d = d.slice(2);
    else {
      const dial = dialOf(cc || S.country);
      if (dial && d.startsWith('0')) d = dial + d.slice(1);
      else if (dial && !d.startsWith(dial) && d.length <= 10) d = dial + d;
    }
    d = d.replace(/\D/g, '');
    return d.length >= 8 && d.length <= 15 ? d : '';
  }
  const waLink = (n, text, cc) => { const w = waNum(n, cc); return w ? `https://wa.me/${w}?text=${encodeURIComponent(text)}` : ''; };
  const telHref = (n, cc) => { const w = waNum(n, cc); return w ? `tel:+${w}` : ''; };
  const prettyPhone = (raw, cc) => { const w = waNum(raw, cc); return w ? '+' + w : String(raw || ''); };
  /* Signing in with a phone number (company edition): the number becomes the account's sign-in address,
     <international number>@<phoneDomain>, read with the company's home country so 091… and +21891… are the same account.
     No email is sent to it: on the server «Confirm email» is off (docs/دليل-نسخة-الشركة.md). */
  const phoneDomain = () => String(CFG.phoneDomain || 'phone.invalid').toLowerCase();
  const phoneLogin = raw => { const w = waNum(raw, CFG.defaultCountry || 'LY'); return w ? w + '@' + phoneDomain() : ''; };
  const isPhoneLogin = e => { e = String(e || '').toLowerCase(); return /^\d{8,15}@/.test(e) && e.slice(e.indexOf('@') + 1) === phoneDomain(); };
  /* how a sign-in reads on screen: +218912345678 for a phone account, the email otherwise */
  const loginShown = e => isPhoneLogin(e) ? '+' + String(e).split('@')[0] : String(e || '');

  /* ---------- state ---------- */
  const S = SP.S = {
    country: 'LY', city: '', car: null, favs: new Set(), user: null, admin: false, myShops: null, settings: {},
    cities: new Map(), cstats: null, err: '',
    f: { q: '', cat: '', make: '', model: '', year: '', cond: '', fit: false, sort: 'new' },
    pcache: new Map(), scache: new Map()
  };
  function setCountry(cc) {
    if (!COUNTRY.has(cc)) cc = CFG.defaultCountry || 'LY';
    if (cc !== S.country) { S.city = ''; store('sp_city', ''); }
    S.country = cc; store('sp_country', cc);
  }
  function setCity(c) { S.city = c || ''; store('sp_city', S.city); }
  function setCar(c) { S.car = c && c.make ? { make: c.make, model: c.model || '', year: c.year ? +c.year : '', vin: c.vin || '' } : null; store('sp_car', S.car); }
  function toggleFav(id) {
    if (S.favs.has(id)) S.favs.delete(id); else S.favs.add(id);
    store('sp_favs', [...S.favs].slice(-300));
    return S.favs.has(id);
  }

  /* ---------- toast and sheets ---------- */
  let toastTimer;
  function toast(msg, ms) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms || 2800);
  }
  function openSheet(html, o = {}) {
    const prev = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" tabindex="-1"${o.label ? ` aria-label="${esc(o.label)}"` : ''}><div class="grab" aria-hidden="true"></div>${html}</div>`;
    document.body.appendChild(scrim);
    document.body.classList.add('locked');
    const el = $('.sheet', scrim);
    let closed = false;
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close(val) {
      if (closed) return;
      closed = true; scrim.remove();
      if (!$('.scrim')) document.body.classList.remove('locked');
      document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) { /* element gone */ }
      if (o.onClose) o.onClose(val);
    }
    scrim.addEventListener('click', e => { if (e.target === scrim || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => { const f = $('[autofocus]', el) || el; try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 40);
    const api = { el, close };
    if (o.onOpen) o.onOpen(api);
    return api;
  }
  function confirmSheet(o) {
    return new Promise(res => {
      let ok = false;
      openSheet(`<h2 class="sheet-title">${esc(o.title)}</h2>${o.body ? `<p class="sheet-sub">${esc(o.body)}</p>` : ''}
        <div class="sheet-actions"><button type="button" class="btn ${o.danger ? 'btn-danger solid' : 'btn-ink'}" data-ok>${esc(o.ok)}</button>
        <button type="button" class="btn btn-ghost" data-close>${esc(o.cancel || t('no'))}</button></div>`, {
        onOpen: s => { $('[data-ok]', s.el).onclick = () => { ok = true; s.close(); }; },
        onClose: () => res(ok)
      });
    });
  }

  /* ---------- backend (Supabase) ---------- */
  let sb = null;
  /* The database library loads only when a server is set (the demo never needs it), and gives up after a while,
     so a slow or blocked connection shows the retry screen instead of holding the app on its splash screen. */
  /* 2.105+ has passkeys (Face ID sign-in); if that file ever fails, the previous one still runs everything else */
  const SUPABASE_JS = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.1', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.97.0'];
  const scripts = {};
  function loadScript(src, ms = 20000) {
    if (!scripts[src]) scripts[src] = new Promise((ok, no) => {
      const el = document.createElement('script');
      let tm = 0;
      const end = (fail, why) => {
        clearTimeout(tm); el.onload = el.onerror = null;
        if (!fail) return ok();
        delete scripts[src];
        no(Object.assign(new Error(why + ': ' + src), { timeout: why === 'timeout' }));
      };
      el.src = src; el.async = true;
      el.onload = () => end(false); el.onerror = () => { el.remove(); end(true, 'load failed'); };
      tm = setTimeout(() => end(true, 'timeout'), ms);
      document.head.appendChild(el);
    });
    return scripts[src];
  }
  async function initBackend() {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) {
      if (CFG.demo && window.SPARAT_DEMO) { sb = SP.sb = window.SPARAT_DEMO.create({ seed: true, persist: true }); SP.demo = true; return ''; }
      return 'config';
    }
    for (const src of SUPABASE_JS) {
      if (window.supabase && typeof window.supabase.createClient === 'function') break;
      try { await loadScript(src); } catch (e) { console.warn(e.message); }
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return 'lib';
    sb = SP.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, experimental: { passkey: true } }
    });
    return '';
  }
  function chk(r) { if (r && r.error) throw r.error; return r ? r.data : null; }
  function errText(e) {
    const m = String((e && (e.message || e.error_description || e.msg)) || e || ''), code = e && (e.code || e.status || e.statusCode);
    if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|timed out|fetch/i.test(m)) return t('errNet');
    if (/Invalid login credentials/i.test(m)) return t('errLogin');
    if (/already registered|already been registered|User already exists/i.test(m)) return t('errExists');
    if (/Email not confirmed/i.test(m)) return t('errConfirm');
    if (/Password should be at least|weak password/i.test(m)) return t('shortPass');
    if (/validate email|invalid email|email address .*invalid/i.test(m)) return t('badEmail');
    if (code === 429 || code === '429' || /rate limit|too many/i.test(m)) return t('errRate');
    if (code === '42501' || /row-level security|permission denied|not authorized|JWT/i.test(m)) return t('errPerm');
    if (code === 413 || code === '413' || /Payload too large|maximum allowed size/i.test(m)) return t('errBigImg');
    if (/mime type|invalid_mime|unsupported/i.test(m)) return t('errImgType');
    if (code === '23505' || /duplicate key/i.test(m)) return /sku/i.test(m) ? t('dupSku') : t('errData');
    if (['23514', '22P02', '23502', '22001', '22003'].includes(code) || /violates check|invalid input/i.test(m)) return t('errData');
    return t('errGeneric');
  }
  const ms = v => v ? (Date.parse(v) || 0) : 0;
  function normShop(r, embedded) {
    if (!r) return null;
    const s = {
      id: r.id, owner_id: r.owner_id, name: r.name || '', person: r.person || '', whatsapp: r.whatsapp || '', phone: r.phone || '',
      city: r.city || '', area: r.area || '', hours: r.hours || '', about: r.about || '', kinds: arr(r.kinds), makes: arr(r.makes),
      logo: r.logo || '', cover: r.cover || '', verified: !!r.verified, country: r.country || 'LY',
      currency: r.currency || currencyOf(r.country || 'LY'), created_at: ms(r.created_at),
      product_count: +r.product_count || 0, sold_count: +r.sold_count || 0, noimg_count: +r.noimg_count || 0, last_at: ms(r.last_at)
    };
    if (!embedded) S.scache.set(s.id, s);
    return s;
  }
  function normProduct(r) {
    const p = {
      id: r.id, shop_id: r.shop_id, owner_id: r.owner_id, title: r.title || '', cat: r.cat || 'other', cond: r.cond || 'aftermarket',
      price: r.price == null ? null : Number(r.price), price_hidden: !!r.price_hidden, hide_price: !!r.hide_price, cost: r.cost == null ? null : Number(r.cost), sku: r.sku || '', barcode: r.barcode || '', nego: !!r.nego, qty: r.qty == null ? null : +r.qty,
      make: r.make || 'any', model: r.model || '', y_from: r.y_from || null, y_to: r.y_to || null, part_no: r.part_no || '', maker: r.maker || '',
      descr: r.descr || '', imgs: arr(r.imgs), status: r.status || 'active', created_at: ms(r.created_at),
      shop: r.shop ? normShop(r.shop, true) : (S.scache.get(r.shop_id) || null)
    };
    S.pcache.set(p.id, p);
    return p;
  }
  /* the company that made a part and the car it fits («موبيس · هيونداي أكسنت»), for the sales system's lists */
  const makerModel = p => [p && p.maker, p && p.make && p.make !== 'any' && p.make !== 'other' ? carText({ make: p.make, model: p.model }) : p && p.model].filter(Boolean).join(' · ');
  /* Words for the search index: title, numbers, brand and model in Arabic and Latin, category and condition in all languages. */
  function searchText(p) {
    const b = BRAND.get(p.make), m = modelObj(p.make, p.model);
    const parts = [p.title, p.part_no, p.part_no ? p.part_no.replace(/[\s\-./]/g, '') : '', p.sku, p.sku ? String(p.sku).replace(/[\s\-./]/g, '') : '', p.barcode, p.maker, p.model, m && m.ar, b && b.en, b && b.ar, p.descr];
    (L.CAT[p.cat] || []).forEach(r => parts.push(r[0]));
    (L.COND[p.cond] || []).forEach(r => parts.push(r[1]));
    return norm(parts.filter(Boolean).join(' ')).slice(0, 3000);
  }
  const SYN = (D.SYN || []).map(g => g.map(norm).filter(Boolean));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function queryParts(q) {
    const pats = [], years = [];
    for (const w of norm(q).split(' ')) {
      if (!w) continue;
      if (/^(19[5-9]\d|20[0-4]\d)$/.test(w)) { years.push(+w); continue; }
      if (w.length < 2 && !/\d/.test(w)) continue;
      const g = SYN.find(grp => grp.some(x => x === w || (w.length >= 3 && x.startsWith(w)) || (x.length >= 3 && w.startsWith(x))));
      pats.push(g ? '(' + [...new Set([w, ...g])].map(reEsc).join('|') + ')' : reEsc(w));
    }
    return { pats: pats.slice(0, 8), years: years.slice(0, 2) };
  }
  function searchArgs(f, o = {}) {
    const qp = queryParts(f.q || '');
    const a = {
      p_country: S.country, p_city: S.city || null, p_patterns: qp.pats.length ? qp.pats : null, p_years: qp.years.length ? qp.years : null,
      p_cat: f.cat || null, p_cond: f.cond || null, p_make: f.make || null, p_model: f.model || null, p_year: f.year ? +f.year : null,
      p_sort: f.sort || 'new', p_limit: o.limit || 24, p_offset: o.offset || 0
    };
    if (f.fit && S.car && S.car.make) { a.p_fit_make = S.car.make; a.p_fit_model = S.car.model || null; a.p_fit_year = S.car.year ? +S.car.year : null; a.p_fit_strict = !!o.strict; }
    if (o.shop) { a.p_shop = o.shop; a.p_city = null; }
    return a;
  }

  const api = {
    async search(args) {
      const rows = chk(await sb.rpc('search_products', args)) || [];
      return { items: rows.map(normProduct), total: rows.length ? (+rows[0].total_count || rows.length) : 0 };
    },
    async product(id) { return (await api.search({ p_ids: [id], p_include_sold: true, p_limit: 1 })).items[0] || null; },
    async byIds(ids) { return ids.length ? (await api.search({ p_ids: ids.slice(-60), p_include_sold: true, p_limit: 60 })).items : []; },
    async shops(args) {
      const rows = chk(await sb.rpc('list_shops', args)) || [];
      return { items: rows.map(r => normShop(r)), total: rows.length ? (+rows[0].total_count || rows.length) : 0 };
    },
    async shop(id) { const d = chk(await sb.from('shops').select('*').eq('id', id).maybeSingle()); return d ? normShop(d) : null; },
    async stats(o) { return chk(await sb.rpc('store_stats', { p_city: o.city || null, p_shop: o.shop || null, p_country: o.country || null })) || {}; },
    async cities(cc) {
      const rows = chk(await sb.rpc('list_cities', { p_country: cc })) || [];
      const list = rows.map(r => ({ city: r.city, shops: +r.shops || 0 }));
      S.cities.set(cc, list);
      return list;
    },
    async countryStats() {
      const rows = chk(await sb.rpc('country_stats')) || [];
      const m = new Map(); rows.forEach(r => m.set(r.country, { shops: +r.shops || 0, products: +r.products || 0 }));
      S.cstats = m;
      return m;
    },
    async settings() { const d = chk(await sb.from('settings').select('*').eq('id', 1).maybeSingle()); S.settings = d || {}; return S.settings; },
    async saveSettings(v) { S.settings = chk(await sb.from('settings').update(v).eq('id', 1).select().maybeSingle()) || S.settings; applyBranding(); return S.settings; },
    async saveShop(v, id) {
      const q = id ? sb.from('shops').update(v).eq('id', id) : sb.from('shops').insert(v);
      const s = normShop(chk(await q.select().single()));
      S.myShops = null;
      return s;
    },
    async deleteShop(s) {
      const imgs = [s.logo, s.cover];
      for (let off = 0; off < 5000; off += 60) {
        const r = await api.search({ p_shop: s.id, p_include_sold: true, p_limit: 60, p_offset: off });
        r.items.forEach(p => imgs.push(...p.imgs));
        if (r.items.length < 60) break;
      }
      chk(await sb.from('shops').delete().eq('id', s.id));
      S.scache.delete(s.id); S.myShops = null;
      await removePhotos(imgs.filter(Boolean));
    },
    async saveProduct(v, id) {
      v.search_text = searchText(v);
      const q = id ? sb.from('products').update(v).eq('id', id) : sb.from('products').insert(v);
      return normProduct(chk(await q.select().single()));
    },
    async setStatus(id, status) { return normProduct(chk(await sb.from('products').update({ status }).eq('id', id).select().single())); },
    async deleteProduct(p) { chk(await sb.from('products').delete().eq('id', p.id)); S.pcache.delete(p.id); await removePhotos(p.imgs); },
    async verify(id, on) { return normShop(chk(await sb.from('shops').update({ verified: on }).eq('id', id).select().single())); },
    async isAdmin() { try { return !!chk(await sb.rpc('is_admin')); } catch (e) { return false; } },
    async me() {
      if (!S.user) { S.customer = null; return null; }
      S.customer = chk(await sb.from('customers').select('*').eq('user_id', S.user.id).maybeSingle()) || null;
      return S.customer;
    },
    async saveMe(v) {
      const q = S.customer ? sb.from('customers').update(v).eq('user_id', S.user.id) : sb.from('customers').insert(v);
      S.customer = chk(await q.select().single());
      return S.customer;
    },
    async customers() { return chk(await sb.from('customers').select('*').order('created_at', { ascending: false }).limit(1000)) || []; },
    async approve(id, on) { return chk(await sb.from('customers').update({ approved: on }).eq('user_id', id).select().single()); },
    async importRows(rows, shop) { return chk(await sb.rpc('import_products', { p_rows: rows, p_shop: shop || null })) || {}; },
    async rotateKey() { return chk(await sb.rpc('rotate_sync_key')); },
    async myShops() {
      if (!S.user) return [];
      S.myShops = (await api.shops({ p_owner: S.user.id, p_limit: 100 })).items;
      return S.myShops;
    }
  };

  const siteUrl = () => (CFG.siteUrl || (location.origin + location.pathname)).replace(/[#?].*$/, '');
  const auth = {
    async signUp(email, password) { const r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } }); if (r.error) throw r.error; return r.data; },
    async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; return r.data; },
    async signOut() { try { await sb.auth.signOut(); } catch (e) { /* offline: local session is cleared anyway */ } },
    async reset(email) { const r = await sb.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() }); if (r.error) throw r.error; },
    async setPassword(pw) { const r = await sb.auth.updateUser({ password: pw }); if (r.error) throw r.error; }
  };
  async function refreshUser(session) {
    const u = session && session.user;
    S.user = u ? { id: u.id, email: u.email || '' } : null;
    S.admin = S.user ? await api.isAdmin() : false;
    if (SP.loadPerms) await SP.loadPerms();
    S.myShops = null;
    if (S.user) await api.myShops().catch(() => { S.myShops = []; });
    S.customer = null;
    if (S.user) {
      await api.me().catch(() => {});
      const pend = load('sp_pending_profile', null);
      if (!S.customer && pend && pend.name) { try { await api.saveMe(pend); store('sp_pending_profile', null); } catch (e) { /* retried next sign-in */ } }
    }
  }

  /* ---------- company edition: brands shown, branding, cart ---------- */
  function brandIds() { const s = arr(S.settings && S.settings.brands); return s.length ? s : arr(CFG.brands); }
  function brandsList() { const ids = brandIds(); return ids.length ? D.BRANDS.filter(b => ids.includes(b.id)) : D.BRANDS; }
  function popularIds() {
    const ok = brandsList().map(b => b.id), pop = D.POPULAR.filter(id => ok.includes(id));
    return pop.length >= 8 ? pop : [...new Set([...pop, ...ok])].slice(0, 24);
  }
  function applyBranding() {
    const st = S.settings || {}, root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(st.accent || '')) root.style.setProperty('--signal', st.accent); else root.style.removeProperty('--signal');
    const name = st.brand_name || CFG.appName;
    if (name) document.title = name + (st.tagline ? ' · ' + st.tagline : '');
  }
  const cart = {
    get() { return arr(load('sp_cart', [])).filter(x => x && x.id && x.qty > 0); },
    set(c) { store('sp_cart', c.slice(0, 100)); document.dispatchEvent(new Event('sp:cart')); },
    add(id, n) { const c = cart.get(), x = c.find(i => i.id === id); if (x) x.qty = Math.min(999, x.qty + (n || 1)); else c.push({ id, qty: n || 1 }); cart.set(c); },
    qty(id, q) { cart.set(cart.get().map(i => i.id === id ? { id, qty: Math.max(0, Math.min(999, q)) } : i).filter(i => i.qty > 0)); },
    count() { return cart.get().reduce((k, i) => k + i.qty, 0); },
    clear() { cart.set([]); }
  };

  /* ---------- images ---------- */
  function drawScaled(file, maxDim) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxDim / Math.max(w, h));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); resolve(c);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unsupported image type')); };
      img.src = url;
    });
  }
  const toBlob = (c, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode failed')), 'image/jpeg', q));
  const thumbUrl = u => /\/photos\/[^?#]+\.jpg$/.test(u || '') ? u.replace(/\.jpg$/, '_t.jpg') : u;
  /* kind: 'item' (1400px + 480px thumb), 'cover' (1400px), 'logo' (400px). Returns the public URL. */
  async function uploadPhoto(file, kind) {
    if (!S.user) throw new Error('not authorized');
    const big = await toBlob(await drawScaled(file, kind === 'logo' ? 400 : 1400), kind === 'logo' ? 0.86 : 0.82);
    const path = `${S.user.id}/${uid()}.jpg`, bucket = sb.storage.from('photos');
    const opts = { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false };
    chk(await bucket.upload(path, big, opts));
    if (kind === 'item') {
      try { const small = await toBlob(await drawScaled(file, 480), 0.74); await bucket.upload(path.replace(/\.jpg$/, '_t.jpg'), small, opts); } catch (e) { /* the card falls back to the full photo */ }
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }
  function photoPath(u) { const m = /\/object\/public\/photos\/([^?#]+)$/.exec(u || ''); return m ? decodeURIComponent(m[1]) : null; }
  async function removePhotos(urls) {
    const paths = [];
    arr(urls).forEach(u => { const p = photoPath(u); if (p) { paths.push(p); if (/\.jpg$/.test(p) && !/_t\.jpg$/.test(p)) paths.push(p.replace(/\.jpg$/, '_t.jpg')); } });
    if (paths.length) try { await sb.storage.from('photos').remove(paths); } catch (e) { /* leftover files are harmless */ }
  }
  /* <img> with its backup: a thumbnail falls back to the full photo, a real photo of a bundled demo picture to the bundled file;
     hidden if the backup fails too. */
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    const back = img.dataset.full || img.dataset.local;
    if (back && img.getAttribute('src') !== back) img.src = back;
    else img.classList.add('broken');
  }, true);
  /* bundled demo pictures (img/parts/…) show a real photo when there is one; not inside the Claude app, which blocks outside photos */
  const realPhoto = (url, w) => !CFG.embedded && CFG.realPhotos !== false && window.SPARAT_DEMO && window.SPARAT_DEMO.realPhoto ? window.SPARAT_DEMO.realPhoto(url, w) : '';
  const imgTag = (url, cls, alt, thumb) => {
    if (!url) return '';
    const real = realPhoto(url, thumb ? 480 : 1200);
    const back = real ? ` data-local="${esc(url)}"` : thumb ? ` data-full="${esc(url)}"` : '';
    return `<img src="${esc(real || (thumb ? thumbUrl(url) : url))}"${back} alt="${esc(alt || '')}" loading="lazy" decoding="async"${cls ? ` class="${cls}"` : ''}>`;
  };

  /* ---------- router ---------- */
  const ROUTES = [];
  let tok = 0, lastHash = null;
  const scrollMem = new Map();
  const route = (re, fn, o) => ROUTES.push({ re, fn, o: o || {} });
  const here = () => { try { return decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { return ''; } };
  const alive = n => n === tok;
  function done(n) { if (n !== tok) return; const y = scrollMem.get(here()) || 0; window.scrollTo(0, y); }
  async function render() {
    const h = here();
    if (/(^|&)(access_token|error|error_code)=/.test(h)) return;
    if (lastHash !== null) scrollMem.set(lastHash, window.scrollY);
    if (lastHash !== h) window.scrollTo(0, 0);
    lastHash = h;
    const n = ++tok;
    for (const r of ROUTES) {
      const m = h.match(r.re);
      if (m) {
        /* the system's screens light up the system tab */
        SP.tab = r.o.tab != null ? r.o.tab : /^(system|pos|receive|invoices|inv-|purchases|reports|staff|stock|buyers?|buyer-|suppliers?|supplier-|expenses|pnl|admin)/.test(h) ? 'system' : '';
        try { await r.fn(m, n); } catch (e) { console.error(e); if (SP.fail) SP.fail(e, n); } return;
      }
    }
    location.replace('#');
  }
  const go = h => { if (here() === h) render(); else location.hash = h; };

  /* ---------- install (PWA) ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; SP.canInstall = true; document.dispatchEvent(new Event('sp:install')); });
  window.addEventListener('appinstalled', () => { installEvt = null; SP.canInstall = false; toast(t('installed')); });
  async function install() {
    if (!installEvt) return false;
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; SP.canInstall = false;
    return !!(r && r.outcome === 'accepted');
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  /* the in-app page edition (CFG.embedded) runs inside the Claude app: nothing to install */
  const standalone = () => !!CFG.embedded || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !CFG.noServiceWorker) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* app works without offline cache */ }));
  }
  window.addEventListener('offline', () => toast(t('offlineToast')));

  /* ---------- files ---------- */
  /* Offers a generated text file to the user (a CSV gets a byte-order mark, so Excel shows Arabic correctly).
     The in-app page edition swaps in the Claude app's save sheet (js/embed.js). Resolves true when handed over. */
  async function saveFile(name, text) {
    const csv = /\.csv$/i.test(name), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([(csv ? '\uFEFF' : '') + text], { type: (csv ? 'text/csv' : 'text/plain') + ';charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return true;
  }

  /* ---------- boot ---------- */
  async function boot() {
    setLang(load('sp_lang', null) || guessLang());
    S.country = COUNTRY.has(load('sp_country', '')) ? load('sp_country', '') : (CFG.defaultCountry || 'LY');
    S.city = load('sp_city', '') || '';
    S.car = load('sp_car', null);
    S.favs = new Set(arr(load('sp_favs', [])));
    S.err = await initBackend();
    window.addEventListener('hashchange', render);
    if (!S.err) {
      try { const r = await sb.auth.getSession(); await refreshUser(r && r.data && r.data.session); } catch (e) { /* signed out */ }
      sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { setTimeout(() => refreshUser(session).then(() => go('new-password')), 0); return; }
        if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') {
          const was = S.user && S.user.id, now = session && session.user && session.user.id;
          if (was === now && ev !== 'USER_UPDATED') return;
          setTimeout(() => refreshUser(session).then(() => render()), 0);
        }
      });
      await Promise.race([api.settings().catch(() => { /* defaults */ }), sleep(2500)]);
      applyBranding();
      const h = location.hash;
      if (/error_description=/.test(h)) {
        const m = /error_description=([^&]+)/.exec(h);
        toast(m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : t('errGeneric'), 5000);
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    render();
  }

  Object.assign(SP, {
    $, $$, esc, sleep, arr, uid, debounce, load, store, digits, norm, opt,
    COUNTRY, BRAND, flag, currencyOf, dialOf, setLang, t, fmtNum, plural, count, countryName, priceHTML, priceText, ago,
    brandName, brandMark, modelObj, modelName, carText, catName, condName, fitText, fitsCar, waNum, waLink, telHref, prettyPhone, phoneLogin, isPhoneLogin, loginShown,
    setCountry, setCity, setCar, toggleFav, toast, openSheet, confirmSheet, errText, api, auth, refreshUser, searchArgs, queryParts, searchText,
    hiddenLabel, brandsList, popularIds, applyBranding, cart, company: CFG.mode === 'company', makerModel,
    uploadPhoto, removePhotos, thumbUrl, imgTag, route, render, go, here, alive, done, install, isIOS, standalone, boot, siteUrl, loadScript, saveFile
  });
})();
