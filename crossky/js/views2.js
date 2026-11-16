/* Sparat pages, part 2: seller account, sign-in, shop and part forms, admin panel, start-up. */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, api, D, BRAND, opt } = SP;
  const { shell, bar, empty, avatar, vb, gate } = SP;
  const okEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  function needLogin(n) {
    if (S.user) return false;
    S.after = SP.here();
    shell(bar(t('needLoginT')) + `<main class="wrap">${empty('lock', t('needLoginT'), t('needLoginB'), `<div class="form-actions"><a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a><a class="btn btn-ghost" href="#signup">${esc(t('createAcct'))}</a></div>`)}</main>`);
    return true;
  }
  const noPerm = (body) => shell(bar(t('noPermT')) + `<main class="wrap">${empty('lock', t('noPermT'), body)}</main>`);

  /* ---------- my shop / account ---------- */
  function prefs() {
    const lang = SP.L.LANGS.find(l => l.code === SP.LANG);
    const inst = !SP.standalone() && (SP.canInstall || SP.isIOS);
    return `<section class="mcard"><h2 class="lbl">${esc(t('prefsT'))}</h2><div class="opt-list">
      <button type="button" class="opt" data-act="lang"><span>${I('globe')} ${esc(t('language'))}</span><span class="opt-n">${esc(lang ? lang.name : '')} ${I('chevL', 'dirx')}</span></button>
      <button type="button" class="opt" data-act="country"><span>${I('flag')} ${esc(t('country'))}</span><span class="opt-n"><span aria-hidden="true">${SP.flag(S.country)}</span> ${esc(SP.countryName(S.country))} ${I('chevL', 'dirx')}</span></button>
      <button type="button" class="opt" data-act="car"><span>${I('car')} ${esc(t('myCar'))}</span><span class="opt-n">${esc(S.car ? SP.carText(S.car) : t('setCar'))} ${I('chevL', 'dirx')}</span></button>
      <a class="opt" href="#vin"><span>${I('barcode')} ${esc(t('vin'))}</span><span class="opt-n">${esc(S.car && S.car.vin ? S.car.vin : '')} ${I('chevL', 'dirx')}</span></a>
      <a class="opt" href="#brands"><span>${I('tag')} ${esc(t('allBrandsT'))}</span><span class="opt-n">${esc(SP.fmtNum(D.BRANDS.length))} ${I('chevL', 'dirx')}</span></a>
      ${inst ? `<button type="button" class="opt" id="minst"><span>${I('download')} ${esc(t('install'))}</span><span class="opt-n">${I('chevL', 'dirx')}</span></button>` : ''}
    </div></section>`;
  }
  function wirePrefs() {
    const b = $('#minst');
    if (b) b.onclick = async () => { if (SP.canInstall) await SP.install(); else SP.toast(t('iosInstall'), 7000); };
  }
  SP.prefs = prefs; SP.wirePrefs = wirePrefs;
  const mcard = s => `<section class="mcard"><a class="mc-head" href="#s-${s.id}">${avatar(s)}<span><b>${esc(s.name)}${vb(s)}</b>
      <small><span aria-hidden="true">${SP.flag(s.country)}</span> ${esc(s.city)}${s.last_at ? ' · ' + esc(t('lastPart', { ago: SP.ago(s.last_at) })) : ''}</small></span></a>
    <div class="mstats"><div class="mstat"><b class="num">${esc(SP.fmtNum(s.product_count))}</b><small>${esc(t('statParts'))}</small></div>
      <div class="mstat"><b class="num">${esc(SP.fmtNum(s.sold_count))}</b><small>${esc(t('statSold'))}</small></div>
      <div class="mstat"><b class="num">${esc(SP.fmtNum(s.noimg_count))}</b><small>${esc(t('noPhotos'))}</small></div></div>
    <div class="mactions"><a class="btn btn-signal wide" href="#new-item-${s.id}">${I('camera')} ${esc(t('addNewPart'))}</a>
      <a class="btn btn-ghost sm" href="#s-${s.id}">${I('store')} ${esc(t('shopPage'))}</a><a class="btn btn-ghost sm" href="#edit-shop-${s.id}">${I('edit')} ${esc(t('editShop'))}</a></div></section>`;

  SP.route(/^mine$/, async (m, n) => {
    if (gate(n)) return;
    if (SP.company && SP.customerView && !S.admin && !(S.myShops && S.myShops.length)) return SP.customerView(m, n);
    if (!S.user) {
      shell(bar(t('mine'), '', { noBack: true }) + `<main class="wrap mine"><section class="onb"><h2>${esc(t('sellT'))}</h2>
        <ol class="steps">${[1, 2, 3].map(i => `<li><span><b>${esc(t('step' + i + 'T'))}</b><small>${esc(t('step' + i + 'B'))}</small></span></li>`).join('')}</ol>
        <div class="form-actions"><a class="btn btn-signal" href="#signup">${I('store')} ${esc(t('signupBtn'))}</a><a class="btn btn-ghost" href="#login">${esc(t('haveAcct'))}</a></div></section>${prefs()}</main>`);
      wirePrefs();
      return SP.done(n);
    }
    if (S.myShops == null) { shell(bar(t('mine'), '', { noBack: true }) + `<main class="wrap mine"><div class="sk sk-block"></div></main>`); await api.myShops().catch(() => { S.myShops = []; }); }
    if (!SP.alive(n)) return;
    const shops = S.myShops || [];
    shell(bar(t('mine'), '', { noBack: true }) + `<main class="wrap mine">
      <section class="mcard acct"><div class="mc-head">${I('user')}<span><b>${esc(t('signedInT'))}</b><small class="ltr">${esc(SP.loginShown(S.user.email))}</small></span>
        <button type="button" class="btn btn-ghost sm" id="lo">${I('logout', 'dirx')} ${esc(t('logout'))}</button></div></section>
      ${SP.bioCard ? SP.bioCard() : ''}${SP.eyeRow ? SP.eyeRow() : ''}
      ${SP.systemLink ? SP.systemLink() : ''}
      ${S.admin ? `<a class="admin-entry" href="#admin">${I('shield')}<span><b>${esc(t('admin'))}</b><small>${esc(t('adminB'))}</small></span>${I('chevL', 'dirx')}</a>` : ''}
      ${shops.length ? `<div class="sec-h"><h2>${esc(t(shops.length > 1 ? 'yourShops' : 'yourShop'))}</h2></div>${shops.map(mcard).join('')}<a class="btn btn-ghost" href="#new-shop">${I('plus')} ${esc(t('anotherShop'))}</a>`
        : `<section class="onb"><h2>${esc(t('registerT'))}</h2><p>${esc(t('ctaB'))}</p><a class="btn btn-signal" href="#new-shop">${I('store')} ${esc(t('registerShop'))}</a></section>`}
      ${prefs()}</main>`);
    wirePrefs();
    if (SP.wireBio) SP.wireBio(n);
    if (SP.wireEyeRow) SP.wireEyeRow(n);
    $('#lo').onclick = async () => { await SP.auth.signOut(); await SP.refreshUser(null); SP.toast(t('loggedOut')); SP.render(); };
    SP.done(n);
  }, { tab: 'mine' });

  /* the usual companies for Korean and Japanese parts, offered while typing the manufacturer (anything else can be typed) */
  const MAKERS = ['موبيس', 'دنسو', 'ماندو', 'سانغ شين', 'إن جي كي', 'كيه واي بي', 'إكسيدي', 'كويتو', 'أيسين', 'بوش', 'فاليو', 'فارتا',
    'تويوتا أصلي', 'نيسان أصلي', 'هيونداي أصلي', 'كيا أصلي', 'ميتسوبيشي أصلي', 'هوندا أصلي', 'مازدا أصلي'];
  SP.MAKERS = MAKERS; // also offered on the receiving screen (js/scan.js)

  /* ---------- sign in / sign up ---------- */
  SP.route(/^(login|signup)$/, (m, n) => {
    if (gate(n)) return;
    const up = m[1] === 'signup';
    if (S.user) { shell(bar(t('signedInT')) + `<main class="wrap">${empty('check', t('signedInT'), t('signedAs', { e: SP.loginShown(S.user.email) }), `<a class="btn btn-ink" href="#mine">${esc(t('mine'))}</a>`)}</main>`); return; }
    /* the company edition: merchants sign up with their shop and phone, and sign in with the phone or an email (js/company.js) */
    if (SP.company && SP.authCompany) return SP.authCompany(up, n);
    shell(bar(t(up ? 'signupT' : 'loginT')) + `<main class="wrap form-wrap">
      <div class="chips light authtabs"><a class="chip${up ? '' : ' on'}" href="#login"${up ? '' : ' aria-current="page"'}>${esc(t('tabIn'))}</a><a class="chip${up ? ' on' : ''}" href="#signup"${up ? ' aria-current="page"' : ''}>${esc(t('tabUp'))}</a></div>
      ${up ? '' : '<div id="abio" class="bio-login" hidden></div>'}
      <form class="form" id="af" novalidate style="margin-top:18px">
        ${up && SP.company ? `<div class="field"><label for="anm">${esc(t('custName'))} <span class="req">*</span></label><input id="anm" class="input" maxlength="80" autocomplete="name" required></div>
        <div class="row2"><div class="field"><label for="aph">${esc(t('phoneNum'))} <span class="req">*</span></label><input id="aph" class="input" type="tel" inputmode="tel" dir="ltr" maxlength="30" autocomplete="tel"></div>
          <div class="field"><label for="act">${esc(t('city'))}</label><input id="act" class="input" maxlength="40" autocomplete="address-level2"></div></div>` : ''}
        <div class="field"><label for="ae">${esc(t('email'))}</label><input id="ae" class="input" type="email" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" dir="ltr" required></div>
        <div class="field"><label for="ap">${esc(t('password'))}</label><input id="ap" class="input" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" dir="ltr" required>${up ? `<span class="hint">${esc(t('passHint'))}</span>` : ''}</div>
        <p class="form-err" id="aerr" role="alert"></p>
        <div class="form-actions"><button class="btn btn-signal" id="ago">${esc(t(up ? 'createAcct' : 'signIn'))}</button>${up ? '' : `<button type="button" class="btn btn-ghost" id="afg">${esc(t('forgot'))}</button>`}</div>
      </form></main>`);
    const err = $('#aerr'), btn = $('#ago'), label = t(up ? 'createAcct' : 'signIn');
    $('#af').onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const email = $('#ae').value.trim(), pw = $('#ap').value;
      if (!okEmail(email)) { err.textContent = t('badEmail'); $('#ae').focus(); return; }
      if (pw.length < 6) { err.textContent = t('shortPass'); $('#ap').focus(); return; }
      const prof = $('#anm') ? { name: $('#anm').value.trim(), phone: SP.digits($('#aph').value).trim(), city: $('#act').value.trim() } : null;
      if (prof && prof.name.length < 2) { err.textContent = t('needCustName'); $('#anm').focus(); return; }
      if (prof && !SP.waNum(prof.phone)) { err.textContent = t('badPhone'); $('#aph').focus(); return; }
      if (prof) SP.store('sp_pending_profile', prof);
      btn.classList.add('busy'); btn.textContent = t('wait');
      try {
        const d = up ? await SP.auth.signUp(email, pw) : await SP.auth.signIn(email, pw);
        if (!d.session) {
          shell(bar(t('signupT')) + `<main class="wrap">${empty('mail', t('signupT'), t('confirmSent'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`);
          return;
        }
        await SP.refreshUser(d.session);
        SP.toast(t('welcome'));
        const to = S.after || 'mine'; S.after = '';
        SP.go(to);
      } catch (x) { err.textContent = SP.errText(x); btn.classList.remove('busy'); btn.textContent = label; }
    };
    /* Face ID / fingerprint (js/passkey.js): same landing as the password */
    if (!up && SP.wireBioLogin) SP.wireBioLogin(n, async session => {
      await SP.refreshUser(session);
      SP.toast(t('welcome'));
      const to = S.after || 'mine'; S.after = '';
      SP.go(to);
    });
    if ($('#afg')) $('#afg').onclick = async () => {
      const email = $('#ae').value.trim();
      if (!okEmail(email)) { err.textContent = t('emailFirst'); $('#ae').focus(); return; }
      try { await SP.auth.reset(email); err.textContent = ''; SP.toast(t('resetSent'), 6000); } catch (x) { err.textContent = SP.errText(x); }
    };
  });

  SP.route(/^new-password$/, (m, n) => {
    if (gate(n)) return;
    shell(bar(t('newPassT')) + `<main class="wrap form-wrap"><form class="form" id="npf" novalidate>
      <div class="field"><label for="np">${esc(t('newPassT'))}</label><input id="np" class="input" type="password" autocomplete="new-password" minlength="6" dir="ltr"><span class="hint">${esc(t('passHint'))}</span></div>
      <p class="form-err" id="nperr" role="alert"></p><button class="btn btn-signal">${esc(t('savePass'))}</button></form></main>`);
    $('#npf').onsubmit = async e => {
      e.preventDefault();
      const pw = $('#np').value, er = $('#nperr');
      if (pw.length < 6) { er.textContent = t('shortPass'); return; }
      if (!S.user) { er.textContent = t('openReset'); return; }
      try { await SP.auth.setPassword(pw); SP.toast(t('passSaved')); SP.go('mine'); } catch (x) { er.textContent = SP.errText(x); }
    };
  });

  /* ---------- photo pickers ---------- */
  function wirePick(input, kind, onUrl, busyEl) {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      busyEl.classList.add('busy-pick');
      try { onUrl(await SP.uploadPhoto(f, kind)); } catch (e) { SP.toast(SP.errText(e)); }
      finally { busyEl.classList.remove('busy-pick'); }
    };
  }

  /* ---------- shop form ---------- */
  SP.route(/^(new-shop|edit-shop-([0-9a-f-]{36}))$/, async (m, n) => {
    if (gate(n) || needLogin(n)) return;
    const id = m[2];
    let s = null;
    if (id) {
      s = S.scache.get(id) || null;
      try { s = await api.shop(id); } catch (e) { if (!s) return SP.fail(e, n); }
      if (!SP.alive(n)) return;
      if (!s) return shell(bar(t('shopEdit')) + `<main class="wrap">${empty('store', t('shopMissingT'), t('shopMissingB'))}</main>`);
      if (s.owner_id !== S.user.id && !S.admin) return noPerm(t('noPermShop'));
    }
    const v = s ? { ...s } : { name: '', person: '', whatsapp: '', phone: '', city: S.city || '', area: '', hours: '', about: '', kinds: ['original', 'aftermarket'], makes: [], logo: '', cover: '', country: S.country };
    let cc = v.country;
    const dialHint = () => `+${SP.dialOf(cc)} …`;
    const pop = SP.popularIds().slice(0, 18);
    const makeSet = new Set(v.makes);
    const makeChips = () => [...new Set([...pop, ...v.makes])].map((b, i) => `<input type="checkbox" id="mk${i}" value="${esc(b)}"${makeSet.has(b) ? ' checked' : ''}><label for="mk${i}">${esc(SP.brandName(b))}</label>`).join('');
    shell(bar(t(id ? 'shopEdit' : 'shopNew')) + `<main class="wrap form-wrap"><form class="form" id="sf" novalidate>
      <div class="brand-pick"><label class="cover-pick" id="cvp">${v.cover ? SP.imgTag(v.cover, '', '') : ''}<input type="file" accept="image/*" class="sr" id="cvf"><span class="lbl-ov">${I('camera')} <span id="cvt">${esc(t(v.cover ? 'changeCover' : 'coverPhoto'))}</span></span></label>
        <label class="logo-pick" id="lgp" aria-label="${esc(t('logo'))}"><span class="logo-in" id="lgi">${v.logo ? SP.imgTag(v.logo, '', '') : `${I('camera')}<span>${esc(t('logo'))}</span>`}</span><input type="file" accept="image/*" class="sr" id="lgf"></label></div>
      <div class="field"><label for="sn">${esc(t('shopName'))} <span class="req">*</span></label><input id="sn" class="input" value="${esc(v.name)}" maxlength="80" placeholder="${esc(t('shopNamePh'))}" required></div>
      <div class="field"><label for="sp">${esc(t('owner'))}</label><input id="sp" class="input" value="${esc(v.person)}" maxlength="60" autocomplete="name"></div>
      <div class="field"><span class="lbl">${esc(t('shopCountry'))}</span><button type="button" class="input ccbtn" id="scc"></button></div>
      <div class="row2"><div class="field"><label for="sw">${esc(t('waNum'))} <span class="req">*</span></label><input id="sw" class="input" type="tel" inputmode="tel" dir="ltr" value="${esc(v.whatsapp)}" maxlength="30" autocomplete="tel"></div>
        <div class="field"><label for="sph">${esc(t('phoneNum'))}</label><input id="sph" class="input" type="tel" inputmode="tel" dir="ltr" value="${esc(v.phone)}" maxlength="30" placeholder="${esc(t('phonePh'))}"></div></div>
      <div class="row2"><div class="field"><label for="sc">${esc(t('city'))} <span class="req">*</span></label><input id="sc" class="input" value="${esc(v.city)}" maxlength="40" list="cityl" placeholder="${esc(t('cityPh'))}" autocomplete="address-level2"><datalist id="cityl"></datalist></div>
        <div class="field"><label for="sa">${esc(t('area'))}</label><input id="sa" class="input" value="${esc(v.area)}" maxlength="80"></div></div>
      <div class="field"><label for="sh">${esc(t('hours'))}</label><input id="sh" class="input" value="${esc(v.hours)}" maxlength="80" placeholder="${esc(t('hoursPh'))}"></div>
      <fieldset class="field"><legend>${esc(t('kinds'))}</legend><div class="seg" id="kinds">${D.CONDS.map((c, i) => `<input type="checkbox" id="kd${i}" value="${c}"${v.kinds.includes(c) ? ' checked' : ''}><label for="kd${i}">${esc(SP.condName(c))}</label>`).join('')}</div></fieldset>
      <fieldset class="field"><legend>${esc(t('makesL'))}</legend><span class="hint">${esc(t('makesHint'))}</span><div class="seg" id="makes">${makeChips()}</div>
        <select class="input" id="mkmore" aria-label="${esc(t('moreBrands'))}">${SP.brandOptions('', '+ ' + t('moreBrands'))}</select></fieldset>
      <div class="field"><label for="sab">${esc(t('about'))}</label><textarea id="sab" class="input" maxlength="600" placeholder="${esc(t('aboutPh'))}">${esc(v.about)}</textarea></div>
      <p class="form-err" id="serr" role="alert"></p>
      <div class="form-actions"><button class="btn btn-signal" id="sgo">${I('check')} ${esc(t(id ? 'saveChanges' : 'saveShop'))}</button>${id ? `<button type="button" class="btn btn-danger" id="sdel">${I('trash')} ${esc(t('deleteShop'))}</button>` : ''}</div>
    </form></main>`);
    const drawCC = () => {
      $('#scc').innerHTML = `<span><span aria-hidden="true">${SP.flag(cc)}</span> ${esc(SP.countryName(cc))}</span><span class="opt-n ltr">${esc(SP.currencyOf(cc))} · +${esc(SP.dialOf(cc))}</span>`;
      $('#sw').placeholder = dialHint();
      const list = (S.cities.get(cc) || []).map(x => x.city);
      if (cc === 'LY') D.LIBYA_CITIES.forEach(c => { if (!list.includes(c)) list.push(c); });
      $('#cityl').innerHTML = list.map(c => `<option value="${esc(c)}">`).join('');
    };
    drawCC();
    if (!S.cities.has(cc)) api.cities(cc).then(drawCC).catch(() => { /* suggestions only */ });
    $('#scc').onclick = () => SP.countrySheet(code => { cc = code; drawCC(); if (!S.cities.has(cc)) api.cities(cc).then(drawCC).catch(() => {}); });
    wirePick($('#cvf'), 'cover', url => { v.cover = url; $('#cvp').insertAdjacentHTML('afterbegin', SP.imgTag(url, '', '')); const old = $$('#cvp > img'); if (old.length > 1) old[1].remove(); $('#cvt').textContent = t('changeCover'); }, $('#cvp'));
    wirePick($('#lgf'), 'logo', url => { v.logo = url; $('#lgi').innerHTML = SP.imgTag(url, '', ''); }, $('#lgp'));
    $('#mkmore').onchange = e => {
      const b = e.target.value; e.target.value = '';
      if (!b) return;
      makeSet.add(b); v.makes = [...new Set([...v.makes, b])];
      $$('#makes input').forEach(x => { if (x.checked) makeSet.add(x.value); else makeSet.delete(x.value); });
      makeSet.add(b);
      $('#makes').innerHTML = makeChips();
    };
    const err = $('#serr');
    $('#sf').onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const val = {
        name: $('#sn').value.trim(), person: $('#sp').value.trim(), whatsapp: SP.digits($('#sw').value).trim(), phone: SP.digits($('#sph').value).trim(),
        city: $('#sc').value.trim(), area: $('#sa').value.trim(), hours: $('#sh').value.trim(), about: $('#sab').value.trim(),
        kinds: $$('#kinds input:checked').map(x => x.value), makes: $$('#makes input:checked').map(x => x.value).slice(0, 40),
        logo: v.logo || null, cover: v.cover || null, country: cc, currency: SP.currencyOf(cc)
      };
      const bad = (msg, el) => { err.textContent = msg; if (el) { el.focus(); el.classList.add('invalid'); } };
      $$('.invalid', $('#sf')).forEach(x => x.classList.remove('invalid'));
      if (val.name.length < 2) return bad(t('needName'), $('#sn'));
      if (!SP.waNum(val.whatsapp, cc)) return bad(t('needWa', { ex: dialHint() }), $('#sw'));
      if (val.phone && !SP.waNum(val.phone, cc)) return bad(t('badPhone'), $('#sph'));
      if (val.city.length < 2) return bad(t('needCity'), $('#sc'));
      if ($('.busy-pick')) return bad(t('waitPhotos'));
      const b = $('#sgo'); b.classList.add('busy');
      try {
        const saved = await api.saveShop(val, id);
        SP.cstats = null; S.cstats = null; S.cities.delete(cc);
        if (id) { SP.toast(t('saved')); SP.go('s-' + saved.id); }
        else { SP.toast(t('shopCreated'), 4000); SP.go('new-item-' + saved.id); }
      } catch (x) { b.classList.remove('busy'); bad(SP.errText(x)); }
    };
    if (id) $('#sdel').onclick = async () => {
      if (!await SP.confirmSheet({ title: t('delShopQ', { t: s.name }), body: t('delShopB'), ok: t('delShopOk'), danger: true })) return;
      const b = $('#sdel'); b.classList.add('busy'); b.textContent = t('deleting');
      try { await api.deleteShop(s); SP.toast(t('shopDeleted')); SP.go('mine'); } catch (x) { b.classList.remove('busy'); b.textContent = t('deleteShop'); SP.toast(SP.errText(x)); }
    };
    SP.done(n);
  });

  /* ---------- part form ---------- */
  SP.route(/^(new-item-([0-9a-f-]{36})|edit-item-([0-9a-f-]{36}))$/, async (m, n) => {
    if (gate(n) || needLogin(n)) return;
    const editId = m[3];
    let p = null, shopId = m[2];
    shell(bar(t(editId ? 'itemEdit' : 'itemNew')) + `<main class="wrap form-wrap"><div class="sk sk-block"></div></main>`);
    try {
      if (editId) { p = await api.product(editId); if (!p) return shell(bar(t('itemEdit')) + `<main class="wrap">${empty('box', t('partMissingT'), t('partMissingB'))}</main>`); shopId = p.shop_id; }
      var s = S.scache.get(shopId) || await api.shop(shopId);
    } catch (e) { return SP.fail(e, n); }
    if (!SP.alive(n)) return;
    if (!s) return shell(bar(t('itemNew')) + `<main class="wrap">${empty('store', t('shopMissingT'), t('shopMissingB'))}</main>`);
    if (s.owner_id !== S.user.id && !S.admin && !(SP.can && SP.can('products'))) return noPerm(t('noPermPart'));
    const v = p ? { ...p } : { title: '', cat: '', cond: '', price: null, nego: false, qty: null, make: 'any', model: '', y_from: null, y_to: null, part_no: '', maker: '', descr: '', imgs: [], sku: '', barcode: '', hide_price: false };
    let imgs = v.imgs.slice(), pending = 0;
    const cur = s.currency || SP.currencyOf(s.country);
    shell(bar(t(editId ? 'itemEdit' : 'itemNew')) + `<main class="wrap form-wrap">
      <a class="form-shop" href="#s-${s.id}">${avatar(s, 'sm')}<span><small>${esc(t(editId ? 'partIn' : 'listedIn'))}</small><b>${esc(s.name)}</b></span></a>
      <form class="form" id="itf" novalidate>
        <fieldset class="field"><legend>${esc(t('photos'))} <small class="hint">${esc(t('photosHint'))}</small></legend><div class="photos" id="ph"></div></fieldset>
        <div class="field"><label for="it">${esc(t('partName'))} <span class="req">*</span></label><input id="it" class="input" maxlength="120" value="${esc(v.title)}" placeholder="${esc(t('partNamePh'))}" required></div>
        <div class="field"><label for="ic">${esc(t('category'))} <span class="req">*</span></label><select id="ic" class="input">${opt('', t('chooseCat'), v.cat)}${D.CATS.map(c => opt(c.id, SP.catName(c.id), v.cat)).join('')}</select></div>
        <fieldset class="field"><legend>${esc(t('condition'))} <span class="req">*</span></legend><div class="seg" id="icond">${D.CONDS.map((c, i) => `<input type="radio" name="cond" id="cd${i}" value="${c}"${v.cond === c ? ' checked' : ''}><label for="cd${i}">${esc(SP.condName(c))}</label>`).join('')}</div></fieldset>
        <div class="row2"><div class="field"><label for="ip">${esc(t('priceCur', { cur }))}</label><input id="ip" class="input num" inputmode="decimal" dir="ltr" value="${v.price == null ? '' : esc(v.price)}" maxlength="12"><span class="hint">${esc(t('priceHint'))}</span></div>
          <div class="field"><label for="iq">${esc(t('qty'))}</label><input id="iq" class="input num" inputmode="numeric" dir="ltr" value="${v.qty == null ? '' : esc(v.qty)}" maxlength="6"></div></div>
        <label class="switch"><input type="checkbox" id="ing"${v.nego ? ' checked' : ''}><span></span>${esc(t('negoL'))}</label>
        ${SP.company ? `<label class="switch"><input type="checkbox" id="ihp"${v.hide_price ? ' checked' : ''}><span></span>${esc(t('hidePriceL'))}</label>
        ${S.admin || (SP.can && SP.can('costs')) ? `<div class="field"><label for="icost">${esc(t('costL'))}</label><input id="icost" class="input num" inputmode="decimal" dir="ltr" maxlength="12" value="${v.cost == null ? '' : esc(v.cost)}"><span class="hint">${esc(t('costHint'))}</span></div>` : ''}
        <div class="field"><label for="isku">${esc(t('skuL'))}</label><input id="isku" class="input mono" dir="ltr" maxlength="60" value="${esc(v.sku || '')}" spellcheck="false"><span class="hint">${esc(t('skuHint'))}</span></div>
        <div class="field"><label for="ibar">${esc(t('barcodeL'))}</label><div class="inrow"><input id="ibar" class="input mono" dir="ltr" maxlength="60" value="${esc(v.barcode || '')}" spellcheck="false" autocomplete="off">
          <button type="button" class="btn btn-ink sq" id="ibarscan" aria-label="${esc(t('scanBtn'))}" title="${esc(t('scanBtn'))}">${I('scan')}</button></div><span class="hint">${esc(t('barcodeHint'))}</span></div>` : ''}
        <fieldset class="field fitset"><legend>${esc(t('fitsQ'))}</legend>
          <select id="imake" class="input" aria-label="${esc(t('brand'))}">${SP.brandOptions(v.make, null, opt('any', t('anyCar'), v.make) + opt('other', t('otherBrand'), v.make))}</select>
          <select id="imodel" class="input" aria-label="${esc(t('model'))}"></select>
          <input id="imodelx" class="input" maxlength="60" placeholder="${esc(t('modelOther'))}" aria-label="${esc(t('model'))}" hidden>
          <div class="row2"><div class="field"><label for="iyf">${esc(t('fromYear'))}</label><select id="iyf" class="input"></select></div><div class="field"><label for="iyt">${esc(t('toYear'))}</label><select id="iyt" class="input"></select></div></div>
          <span class="hint" id="iprod"></span></fieldset>
        <div class="field"><label for="ipn">${esc(t('partNo'))}</label><input id="ipn" class="input mono" dir="ltr" maxlength="60" value="${esc(v.part_no)}" autocapitalize="characters" spellcheck="false"><span class="hint">${esc(t('partNoHint'))}</span></div>
        <div class="field"><label for="imk">${esc(t('makerL'))}</label><input id="imk" class="input" maxlength="60" value="${esc(v.maker || '')}" list="imkl" autocomplete="off" placeholder="${esc(t('makerPh'))}">
          <datalist id="imkl">${MAKERS.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist></div>
        <div class="field"><label for="id">${esc(t('moreDetails'))}</label><textarea id="id" class="input" maxlength="1200" placeholder="${esc(t('moreDetailsPh'))}">${esc(v.descr)}</textarea></div>
        <p class="form-err" id="ierr" role="alert"></p>
        <div class="form-actions"><button class="btn btn-signal" id="igo">${I('check')} ${esc(t(editId ? 'saveChanges' : 'publish'))}</button>
          ${editId ? `<button type="button" class="btn btn-danger" id="idel">${I('trash')} ${esc(t('del'))}</button>` : `<button type="button" class="btn btn-ghost" id="iadd">${I('plus')} ${esc(t('saveAdd'))}</button>`}</div>
      </form></main>`);
    /* photos */
    function drawPhotos() {
      const box = $('#ph');
      if (!box) return;
      box.className = 'photos' + (imgs.length || pending ? '' : ' solo');
      box.innerHTML = imgs.map((u, i) => `<div class="ph">${SP.imgTag(u, '', '', true)}<button type="button" class="x" data-x="${i}" aria-label="${esc(t('removePhoto', { n: i + 1 }))}">${I('close')}</button>${i === 0 ? `<span class="tag">${esc(t('cover'))}</span>` : `<button type="button" class="mkcover" data-c="${i}">${esc(t('makeCover'))}</button>`}</div>`).join('')
        + Array.from({ length: pending }, () => `<div class="ph busy" role="img" aria-label="${esc(t('uploading'))}"><span class="spin"></span></div>`).join('')
        + (imgs.length + pending < 6 ? `<label class="ph ph-add">${I('camera')}<span>${esc(t(imgs.length || pending ? 'addPhoto' : 'firstPhoto'))}</span><input type="file" accept="image/*" multiple class="sr" id="phf"></label>` : '');
      const f = $('#phf');
      if (f) f.onchange = () => {
        const files = Array.from(f.files || []);
        f.value = '';
        const room = 6 - imgs.length - pending;
        if (files.length > room) SP.toast(t('maxPhotos'));
        files.slice(0, Math.max(0, room)).forEach(async file => {
          pending++; drawPhotos();
          try { const url = await SP.uploadPhoto(file, 'item'); imgs.push(url); } catch (e) { SP.toast(SP.errText(e)); }
          pending--; drawPhotos();
        });
      };
      box.onclick = e => {
        const x = e.target.closest('[data-x]'), c = e.target.closest('[data-c]');
        if (x) { const [gone] = imgs.splice(+x.dataset.x, 1); if (!p || !p.imgs.includes(gone)) SP.removePhotos([gone]); drawPhotos(); }
        else if (c) { const i = +c.dataset.c; imgs.unshift(imgs.splice(i, 1)[0]); drawPhotos(); }
      };
    }
    drawPhotos();
    if ($('#ibarscan')) $('#ibarscan').onclick = async () => { const c = await SP.scanCode({ title: t('barcodeL') }); if (c) { $('#ibar').value = c; $('#ibar').focus(); } };
    /* car fit */
    const mk = $('#imake'), md = $('#imodel'), mx = $('#imodelx'), yf = $('#iyf'), yt = $('#iyt');
    const modelVal = () => md.value === '__other' ? mx.value.trim() : md.value;
    function fillModels(curModel) {
      const any = mk.value === 'any';
      md.innerHTML = SP.modelOptions(mk.value, curModel, t('allModelsCap'), true);
      md.disabled = any; md.hidden = any || mk.value === 'other';
      mx.hidden = !(mk.value === 'other' || (md.value === '__other'));
      if (mk.value === 'other') mx.value = curModel || mx.value;
    }
    function fillYears(f0, t0) {
      const any = mk.value === 'any', mm = md.value === '__other' ? '' : md.value;
      yf.innerHTML = SP.yearOptions(mk.value, mm, f0 != null ? f0 : yf.value, '—');
      yt.innerHTML = SP.yearOptions(mk.value, mm, t0 != null ? t0 : yt.value, '—');
      yf.disabled = yt.disabled = any;
      const mo = SP.modelObj(mk.value, mm);
      $('#iprod').textContent = mo ? t('produced', { f: mo.from, t: mo.to }) : '';
    }
    fillModels(v.model); fillYears(v.y_from || '', v.y_to || '');
    mk.onchange = () => { fillModels(''); fillYears('', ''); };
    md.onchange = () => { mx.hidden = md.value !== '__other'; if (!mx.hidden) mx.focus(); fillYears(); };
    /* save */
    const err = $('#ierr');
    async function save(addAnother) {
      err.textContent = '';
      $$('.invalid', $('#itf')).forEach(x => x.classList.remove('invalid'));
      const bad = (msg, el) => { err.textContent = msg; if (el) { el.classList.add('invalid'); el.focus(); } return false; };
      const title = $('#it').value.trim(), cat = $('#ic').value, cond = ($('#icond input:checked') || {}).value || '';
      const ps = SP.digits($('#ip').value).replace(/[\s,]/g, '').trim(), qs = SP.digits($('#iq').value).trim();
      const price = ps === '' ? null : Number(ps), qty = qs === '' ? null : Number(qs);
      if (title.length < 2) return bad(t('needTitle'), $('#it'));
      if (!cat) return bad(t('needCat'), $('#ic'));
      if (!cond) return bad(t('needCond'), $('#cd0'));
      if (ps !== '' && (!isFinite(price) || price < 0 || price > 99999999)) return bad(t('badPrice'), $('#ip'));
      if (qs !== '' && (!Number.isInteger(qty) || qty < 0 || qty > 999999)) return bad(t('badQty'), $('#iq'));
      if (pending) return bad(t('waitPhotos'));
      const make = mk.value || 'any';
      let yFrom = make === 'any' || !yf.value ? null : +yf.value, yTo = make === 'any' || !yt.value ? null : +yt.value;
      const val = {
        shop_id: s.id, title, cat, cond, price, qty, nego: $('#ing').checked, make,
        model: make === 'any' ? '' : (make === 'other' ? mx.value.trim() : modelVal()).slice(0, 60),
        y_from: yFrom, y_to: yTo, part_no: $('#ipn').value.trim().toUpperCase(), maker: $('#imk').value.trim().slice(0, 60), descr: $('#id').value.trim(), imgs: imgs.slice(0, 6)
      };
      if ($('#isku')) { val.sku = $('#isku').value.trim() || null; val.barcode = $('#ibar').value.trim() || null; val.hide_price = $('#ihp').checked; }
      if ($('#icost')) { const c = SP.digits($('#icost').value).replace(/[\s,]/g, '').trim(); val.cost = c === '' ? null : Number(c); if (val.cost != null && !(val.cost >= 0)) return bad(t('badPrice'), $('#icost')); }
      const b = addAnother ? $('#iadd') : $('#igo');
      b.classList.add('busy');
      try {
        const saved = await api.saveProduct(val, editId);
        S.myShops = null;
        if (addAnother) {
          SP.toast(t('publishedNext'));
          imgs = []; drawPhotos();
          ['#it', '#ip', '#iq', '#ipn', '#id', '#isku', '#ibar', '#icost'].forEach(q => { if ($(q)) $(q).value = ''; });
          $('#ing').checked = false;
          b.classList.remove('busy');
          window.scrollTo(0, 0); $('#it').focus({ preventScroll: true });
        } else { SP.toast(t(editId ? 'saved' : 'published')); SP.go('p-' + saved.id); }
      } catch (x) { b.classList.remove('busy'); bad(SP.errText(x)); }
      return true;
    }
    $('#itf').onsubmit = e => { e.preventDefault(); save(false); };
    if ($('#iadd')) $('#iadd').onclick = () => save(true);
    if ($('#idel')) $('#idel').onclick = async () => {
      if (!await SP.confirmSheet({ title: t('delPartQ', { t: p.title }), body: t('delPartB'), ok: t('delPartOk'), danger: true })) return;
      try { await api.deleteProduct(p); SP.toast(t('partDeleted')); SP.go('s-' + s.id); } catch (x) { SP.toast(SP.errText(x)); }
    };
    SP.done(n);
  });

  /* ---------- admin ---------- */
  const arow = s => `<div class="arow" data-row="${s.id}">${avatar(s)}<span class="ar-main"><b>${esc(s.name)}${vb(s)}${s.verified ? '' : ` <span class="pill demo">${esc(t('newBadge'))}</span>`}</b>
      <small><span aria-hidden="true">${SP.flag(s.country)}</span> ${esc(s.city)} · ${esc(SP.count(s.product_count, 'parts'))} · ${esc(SP.ago(s.created_at))}</small></span>
    <button type="button" class="btn ${s.verified ? 'btn-ghost' : 'btn-ink'} sm" data-v="${s.id}" data-on="${s.verified ? 0 : 1}">${esc(t(s.verified ? 'unverify' : 'verify'))}</button>
    <a class="iconbtn ink" href="#edit-shop-${s.id}" aria-label="${esc(t('edit'))}">${I('edit')}</a></div>`;
  SP.route(/^admin$/, async (m, n) => {
    if (gate(n)) return;
    if (!S.user) { S.after = 'admin'; return shell(bar(t('admin')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('adminSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); }
    if (!S.admin) return shell(bar(t('admin')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('notAdmin'))}</main>`);
    const st = S.settings || {};
    S.acc = S.acc || '';
    shell(bar(t('admin')) + `<main class="wrap mine">${SP.adminTabs ? SP.adminTabs('admin') : ''}${SP.company ? '<div id="atoday"></div>' : ''}<div class="astats" id="ast">${'<div class="sk" style="height:74px"></div>'.repeat(4)}</div>
      <section class="mcard"><h2 class="lbl">${esc(t('settingsT'))}</h2><form class="form" id="stf">
        <div class="field"><label for="saw">${esc(t('adminWa'))}</label><input id="saw" class="input" type="tel" dir="ltr" value="${esc(st.admin_wa || '')}" maxlength="30"><span class="hint">${esc(t('adminWaHint'))}</span></div>
        <div class="field"><label for="snt">${esc(t('notice'))}</label><textarea id="snt" class="input" maxlength="300" placeholder="${esc(t('noticePh'))}">${esc(st.notice || '')}</textarea></div>
        <button class="btn btn-ink" id="stgo">${esc(t('saveSettings'))}</button></form></section>
      <section><div class="sec-h"><h2>${esc(t('shops'))} <small id="acn"></small></h2><select class="input acc" id="acc" aria-label="${esc(t('country'))}">${opt('', t('allCountries'), S.acc)}</select></div>
        <div id="al"><div class="sk sk-row"></div></div><div class="center"><button type="button" class="btn btn-ghost more-btn" id="more" hidden></button></div></section></main>`);
    $('#stf').onsubmit = async e => {
      e.preventDefault();
      const b = $('#stgo'); b.classList.add('busy');
      try { await api.saveSettings({ admin_wa: SP.digits($('#saw').value).trim(), notice: $('#snt').value.trim() }); SP.toast(t('settingsSaved')); }
      catch (x) { SP.toast(SP.errText(x)); } finally { b.classList.remove('busy'); }
    };
    if (SP.adminToday) SP.adminToday($('#atoday'), n);
    api.stats({ country: S.acc || null }).then(x => {
      if (!SP.alive(n)) return;
      $('#ast').innerHTML = [['statShops', x.shops], ['statParts', x.products], ['statSold', x.sold], ['statNoImg', x.noimg], ['statCountries', x.countries]]
        .map(([k, v]) => `<div class="astat"><b class="num">${esc(SP.fmtNum(v || 0))}</b><small>${esc(t(k))}</small></div>`).join('');
    }).catch(() => { $('#ast').innerHTML = ''; });
    api.countryStats().then(cs => {
      if (!SP.alive(n)) return;
      $('#acc').innerHTML = opt('', t('allCountries'), S.acc) + [...cs.keys()].map(c => opt(c, SP.flag(c) + ' ' + SP.countryName(c) + ' (' + cs.get(c).shops + ')', S.acc)).join('');
    }).catch(() => { /* filter optional */ });
    $('#acc').onchange = e => { S.acc = e.target.value; SP.render(); };
    $('#al').onclick = async e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      b.classList.add('busy');
      try {
        const s = await api.verify(b.dataset.v, b.dataset.on === '1');
        const old = S.scache.get(s.id);
        if (old) s.product_count = old.product_count;
        b.closest('.arow').outerHTML = arow(s);
        SP.toast(t(s.verified ? 'verifiedToast' : 'unverifiedToast'));
      } catch (x) { b.classList.remove('busy'); SP.toast(SP.errText(x)); }
    };
    await SP.pager(n, $('#al'), $('#more'), off => api.shops({ p_country: S.acc || null, p_limit: 30, p_offset: off }), items => items.map(arow).join(''), (r, first) => {
      if (first) $('#acn').textContent = SP.fmtNum(r.total);
      if (first && !r.total) $('#al').innerHTML = empty('store', t('noShopsT'), t('noShopsB'));
    });
    SP.done(n);
  });

  SP.L.T.noPermT = SP.L.T.noPermT || ["ليست لديك صلاحية", "You don’t have permission", "Accès non autorisé", "No tienes permiso", "Keine Berechtigung", "Yetkiniz yok", "Нет доступа", "没有权限"];
  SP.L.T.negoL = SP.L.T.negoL || SP.L.T.negoL;

})();
