/* Ads at the top of the home screen (إعلانات الرئيسية): the company's own banners, each with a photo, a title, a line and a
   button, and where a tap goes (search words, a brand, a WhatsApp message to the company or a web page). Several ads take
   turns by themselves and customers can swipe them. The owner adds, edits, orders, hides and deletes them (#admin-ads, or the
   pencil on the banner), and an ad can stop by itself after a given day. They are saved in settings.ads and the database
   checks them again (supabase/setup.sql section 13). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, shell, bar, empty, gate } = SP;
  const CFG = window.SPARAT_CONFIG || {};
  const MAX = 5, EVERY = 6000;

  Object.assign(window.SP_IC, {
    eye: '<path d="M2.6 12S6.1 5.8 12 5.8 21.4 12 21.4 12 17.9 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.7"/>',
    up: '<path d="M12 18.5V5.5"/><path d="m6.5 11 5.5-5.5 5.5 5.5"/>',
    down: '<path d="M12 5.5v13"/><path d="m6.5 13 5.5 5.5 5.5-5.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17.5 5-4.5 3.5 3 3-2.5 4.5 4"/>'
  });
  Object.assign(SP.L.T, {
    adsT: ["الإعلانات", "Ads"], adsHead: ["إعلانات الرئيسية", "Home screen ads"],
    adsH: ["تطلع فوق في الرئيسية لكل الزبائن. لو فيه أكثر من إعلان يتبدلو وحدهم كل كم ثانية، والزبون يقدر يقلّبهم بصباعه. اضغط على الإعلان باش تعدّله.",
      "Shown at the top of the home screen to every customer. With more than one, they take turns by themselves and customers can swipe them. Tap an ad to edit it."],
    adsNew: ["إعلان جديد", "New ad"], adsMax: ["وصلت للحد: {n} إعلانات. امسح واحد باش تزيد غيره.", "That’s the most: {n} ads. Delete one to add another."],
    adsEmptyT: ["ما فيش إعلانات", "No ads yet"], adsEmptyB: ["حط أول إعلان بصورة وكلمتين، ويطلع فوق في الرئيسية.", "Add a first ad with a picture and a few words, and it shows at the top of the home screen."],
    adsLabel: ["إعلانات", "Ads"], adsDot: ["إعلان {n} من {k}", "Ad {n} of {k}"], adsEdit: ["عدّل", "Edit"],
    adNewT: ["إعلان جديد", "New ad"], adEditT: ["عدّل الإعلان", "Edit ad"], adPreview: ["كيف يشوفه الزبون", "What customers see"],
    adPhoto: ["الصورة", "Picture"], adPhotoPick: ["اختار صورة", "Choose a picture"], adPhotoChange: ["بدّل الصورة", "Change picture"], adPhotoDel: ["شيل الصورة", "Remove picture"],
    adPhotoH: ["الأحسن صورة بالعرض، والشي المهم فيها في النص. الكلام يطلع فوق الصورة على جنب.", "A wide picture works best, with the main thing in the middle. The words sit over one side of it."],
    adTitle: ["العنوان", "Title"], adTitlePh: ["كل قطع الباترول عندنا", "Every Patrol part, in stock"],
    adSub: ["سطر تحته", "Line under it"], adSubPh: ["فلاتر، فحمات، مساعدات ورادياتيرات. أصلي وتجاري.", "Filters, pads, shocks and radiators. Genuine and aftermarket."],
    adCta: ["كلام الزر", "Button text"], adCtaDef: ["تسوّق توا", "Shop now"],
    adGo: ["لما الزبون يضغط عليه", "When a customer taps it"], adGoQ: ["يبحث عن", "Search for"], adGoB: ["يفتح ماركة", "Open a brand"],
    adGoWa: ["يكتبلكم واتساب", "Message you on WhatsApp"], adGoUrl: ["يفتح رابط", "Open a web page"], adGoNone: ["ولا شي", "Nothing"],
    adToQ: ["كلمات البحث", "Search words"], adToQPh: ["باترول", "Patrol"], adToB: ["الماركة", "Brand"],
    adToWa: ["الرسالة اللي تنكتب للزبون", "Message written for the customer"], adToWaPh: ["السلام عليكم، نبي قطع باترول", "Hello, I’m looking for Patrol parts"],
    adToUrl: ["الرابط", "Link"], adPos: ["مكان الكلام فوق الصورة", "Where the words sit on the picture"],
    adPosRight: ["على اليمين", "Right"], adPosLeft: ["على اليسار", "Left"], adPosTop: ["فوق", "Top"], adPosBottom: ["تحت", "Bottom"],
    adUntil: ["يوقف وحده بعد يوم", "Stops by itself after"], adUntilH: ["فاضي يعني يقعد لين تشيله انت.", "Leave it empty to keep it until you remove it."],
    adOn: ["ظاهر للزبائن", "Shown to customers"], adSave: ["احفظ الإعلان", "Save ad"], adSaved: ["تم حفظ الإعلان", "Ad saved"], adCancel: ["إلغاء", "Cancel"],
    adDel: ["امسح الإعلان", "Delete ad"], adDelQ: ["تمسح الإعلان «{t}»؟", "Delete the ad “{t}”?"], adDelB: ["ما يرجعش بعد ما تمسحه.", "It can’t be brought back."], adDeleted: ["تم مسح الإعلان", "Ad deleted"],
    adUp: ["طلّعه لفوق", "Move up"], adDown: ["نزّله لتحت", "Move down"], adMoved: ["تم ترتيب الإعلانات", "Ads reordered"],
    adStOn: ["ظاهر", "Shown"], adStOff: ["مخفي", "Hidden"], adStEnded: ["خلص وقته", "Ended"], adStUntil: ["لين {d}", "Until {d}"],
    adNoTitle: ["إعلان بالصورة بس", "Picture-only ad"], adNeed: ["اكتب عنوان أو حط صورة", "Add a title or a picture"], adNeedQ: ["اكتب كلمة يبحث عليها", "Enter words to search for"], adNeedB: ["اختار الماركة", "Choose the brand"],
    adBadUrl: ["الرابط لازم يبدا بـ https://", "The link must start with https://"], adNeedWa: ["حط رقم واتساب الشركة في «إعدادات الشركة» أول", "Add the company WhatsApp number in Company settings first"]
  });

  /* ---------- reading the ads ---------- */
  const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const all = () => (S.settings && Array.isArray(S.settings.ads) ? S.settings.ads : []).filter(a => a && typeof a === 'object' && !Array.isArray(a));
  const ended = a => /^\d{4}-\d{2}-\d{2}$/.test(a.until || '') && a.until < today();
  /* a picture we may show: an uploaded or outside https photo (not inside the Claude app, which blocks outside photos),
     a photo kept on the device by the demo, or one of the app's own files */
  const pic = u => {
    u = String(u || '');
    if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(u)) return u;
    if (/^(img|icons)\/[a-z0-9/._-]+$/i.test(u)) return u;
    return /^https:\/\/[^\s"'<>]+$/i.test(u) && !CFG.embedded ? u : '';
  };
  const live = a => a.on !== false && !ended(a) && !!(clip(a.title, 60) || pic(a.img));
  /* an ad reads in the direction of its own words (an Arabic ad stays right to left in the English app) */
  const textDir = s => { const m = /\p{L}/u.exec(String(s || '')); return m ? (/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(m[0]) ? 'rtl' : 'ltr') : ''; };
  /* where the words sit: '' at the start (the right in Arabic), 'end', 'top' or 'bottom', so the photo's subject stays clear */
  const POS = ['', 'end', 'top', 'bottom'];
  const posCls = a => POS.includes(a.pos || '') && a.pos ? ' pos-' + a.pos : '';
  /* where a tap goes: only the kinds the editor makes, so nothing else can sit in the link */
  function goTo(a) {
    const to = clip(a.to, 300);
    if (a.go === 'q' && to) return `href="#search" data-sf="${esc(JSON.stringify({ q: to.slice(0, 60) }))}"`;
    if (a.go === 'b' && SP.BRAND.has(to)) return `href="#b-${esc(to)}"`;
    if (a.go === 'wa') { const w = SP.waLink((S.settings || {}).contact_wa, to || clip(a.title, 60), S.country); if (w) return `href="${esc(w)}" target="_blank" rel="noopener"`; }
    if (a.go === 'url' && /^https:\/\/[^\s"'<>]+$/i.test(to)) return `href="${esc(to)}" target="_blank" rel="noopener"`;
    return '';
  }
  /* one slide; in the editor's preview it is not a link */
  function slide(a, k, total, preview) {
    const src = pic(a.img), title = clip(a.title, 60), sub = clip(a.sub, 120), cta = clip(a.cta, 24) || t('adCtaDef'), href = preview ? '' : goTo(a);
    const dir = textDir(title || sub || clip(a.cta, 24)) || SP.dir || 'rtl';
    const tag = href ? 'a' : 'div';
    const label = total > 1 ? ` role="group" aria-roledescription="slide" aria-label="${esc(t('adsDot', { n: k + 1, k: total }))}"` : '';
    return `<${tag} class="ad${src ? '' : ' noimg'}${posCls(a)}" dir="${dir}"${href ? ' ' + href : ''}${label}>
      ${src ? `<img class="ad-img" src="${esc(src)}" alt="${esc(title || href || preview ? '' : t('adsLabel'))}" decoding="async"${k ? ' loading="lazy"' : ' fetchpriority="high"'}>` : ''}
      <span class="ad-copy">${title ? `<b class="ad-t">${esc(title)}</b>` : ''}${sub ? `<span class="ad-s">${esc(sub)}</span>` : ''}
        ${href || preview ? `<span class="ad-cta">${esc(cta)}${I('chevL', 'dirx')}</span>` : ''}</span></${tag}>`;
  }
  function banner(list, o) {
    o = o || {};
    if (!list.length) return '';
    const k = list.length;
    return `<section class="ads${o.preview ? ' prev' : ''}" aria-label="${esc(t('adsLabel'))}"${k > 1 ? ' aria-roledescription="carousel"' : ''}>
      <div class="ads-track">${list.map((a, i) => slide(a, i, k, o.preview)).join('')}</div>
      ${k > 1 ? `<div class="ads-dots">${list.map((a, i) => `<button type="button" aria-label="${esc(t('adsDot', { n: i + 1, k }))}" aria-current="${i ? 'false' : 'true'}"></button>`).join('')}</div>` : ''}
      ${S.admin && SP.company && !o.preview ? `<a class="ads-edit" href="#admin-ads">${I('edit')}<span>${esc(t('adsEdit'))}</span></a>` : ''}</section>`;
  }
  SP.adsBanner = () => banner(all().filter(live));

  /* turns: every few seconds while the banner is on screen and nobody is touching it; never with reduced motion */
  SP.wireAds = (root, n) => {
    const box = $('.ads', root);
    if (!box) return;
    const track = $('.ads-track', box), dots = $$('.ads-dots button', box), k = $$('.ad', track).length;
    if (k < 2) return;
    const rtl = getComputedStyle(track).direction === 'rtl', calm = matchMedia('(prefers-reduced-motion: reduce)');
    let i = 0, timer = 0, hold = false, seen = true, io = null;
    const mark = j => dots.forEach((d, x) => d.setAttribute('aria-current', x === j ? 'true' : 'false'));
    const go = (j, quick) => { i = (j + k) % k; track.scrollTo({ left: (rtl ? -1 : 1) * i * track.clientWidth, behavior: quick || calm.matches ? 'auto' : 'smooth' }); mark(i); };
    const stop = () => { clearInterval(timer); timer = 0; };
    const gone = () => !document.body.contains(box) || (n != null && !SP.alive(n));
    const tick = () => {
      if (gone()) { stop(); if (io) io.disconnect(); return; }
      if (!hold && seen && document.visibilityState === 'visible') go(i + 1);
    };
    const start = () => { stop(); if (!calm.matches) timer = setInterval(tick, EVERY); };
    track.addEventListener('scroll', () => { const j = Math.round(Math.abs(track.scrollLeft) / Math.max(1, track.clientWidth)); if (j !== i && j < k) { i = j; mark(i); } }, { passive: true });
    dots.forEach((d, x) => { d.onclick = () => { go(x); start(); }; });
    ['pointerdown', 'focusin', 'mouseenter'].forEach(ev => box.addEventListener(ev, () => { hold = true; }, { passive: true }));
    ['pointerup', 'pointercancel', 'focusout', 'mouseleave'].forEach(ev => box.addEventListener(ev, () => { hold = false; start(); }, { passive: true }));
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; }); io.observe(box); }
    start();
  };

  /* ---------- the owner's page ---------- */
  function guard(n) {
    if (!S.user) { S.after = SP.here(); shell(bar(t('adsT')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('adminSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (!S.admin) { shell(bar(t('adsT')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('notAdmin'))}</main>`); return false; }
    return true;
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const save = async list => { await SP.api.saveSettings({ ads: list }); };
  const status = a => a.on === false ? `<span class="pill">${esc(t('adStOff'))}</span>` : ended(a) ? `<span class="pill demo">${esc(t('adStEnded'))}</span>`
    : `<span class="pill ok">${esc(t('adStOn'))}</span>${a.until ? ` <small>${esc(t('adStUntil', { d: a.until }))}</small>` : ''}`;
  const goText = a => {
    const to = clip(a.to, 300);
    if (a.go === 'q' && to) return t('adGoQ') + ': ' + to;
    if (a.go === 'b' && SP.BRAND.has(to)) return t('adGoB') + ': ' + SP.brandName(to);
    if (a.go === 'wa') return t('adGoWa');
    if (a.go === 'url' && to) return to.replace(/^https:\/\//, '');
    return t('adGoNone');
  };
  const thumb = a => { const src = pic(a.img); return `<span class="ad-thumb${src ? '' : ' noimg'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : I('megaphone')}</span>`; };
  const row = (a, i, k) => `<div class="adrow${live(a) ? '' : ' off'}" data-i="${i}">
      <button type="button" class="adrow-main" data-edit="${i}">${thumb(a)}<span class="ar-main"><b>${esc(clip(a.title, 60) || t('adNoTitle'))}</b>
        <small>${status(a)}</small><small class="adrow-go">${esc(goText(a))}</small></span></button>
      <span class="adrow-move"><button type="button" class="iconbtn ink" data-up="${i}" aria-label="${esc(t('adUp'))}"${i ? '' : ' disabled'}>${I('up')}</button>
        <button type="button" class="iconbtn ink" data-down="${i}" aria-label="${esc(t('adDown'))}"${i < k - 1 ? '' : ' disabled'}>${I('down')}</button></span></div>`;

  SP.route(/^admin-ads$/, (m, n) => {
    if (gate(n) || !guard(n)) return;
    const draw = () => {
      const list = all(), k = list.length;
      shell(bar(t('adsT')) + `<main class="wrap mine">${SP.adminTabs('admin-ads')}<section class="mcard"><h2 class="lbl">${esc(t('adsHead'))}</h2><p class="hint">${esc(t('adsH'))}</p>
        <div class="adlist" id="adl">${k ? list.map((a, i) => row(a, i, k)).join('') : empty('megaphone', t('adsEmptyT'), t('adsEmptyB'))}</div>
        ${k >= MAX ? `<p class="hint">${esc(t('adsMax', { n: MAX }))}</p>` : `<button type="button" class="btn btn-signal block" id="adnew">${I('plus')} ${esc(t('adsNew'))}</button>`}</section></main>`);
      if ($('#adnew')) $('#adnew').onclick = () => editor(-1, draw);
      $('#adl').onclick = async e => {
        const b = e.target.closest('[data-edit],[data-up],[data-down]');
        if (!b) return;
        if (b.dataset.edit != null) return editor(+b.dataset.edit, draw);
        const list2 = all().slice(), i = +(b.dataset.up != null ? b.dataset.up : b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1;
        if (j < 0 || j >= list2.length) return;
        [list2[i], list2[j]] = [list2[j], list2[i]];
        b.classList.add('busy');
        try { await save(list2); SP.toast(t('adMoved')); if (SP.alive(n)) draw(); } catch (x) { b.classList.remove('busy'); SP.toast(SP.errText(x)); }
      };
    };
    draw();
    SP.done(n);
  });

  /* the editor: a sheet with a live preview of the banner */
  function editor(i, redraw) {
    const list = all(), old = i >= 0 ? list[i] : null;
    const a = old ? { ...old } : { id: uid(), img: '', title: '', sub: '', cta: '', go: 'q', to: '', pos: '', until: '', on: true };
    if (!['q', 'b', 'wa', 'url', ''].includes(a.go)) a.go = '';
    if (!POS.includes(a.pos || '')) a.pos = '';
    const rtl = (textDir(a.title || a.sub) || SP.dir) !== 'ltr';
    const PL = [['', rtl ? 'adPosRight' : 'adPosLeft'], ['end', rtl ? 'adPosLeft' : 'adPosRight'], ['top', 'adPosTop'], ['bottom', 'adPosBottom']];
    const GO = [['q', 'adGoQ'], ['b', 'adGoB'], ['wa', 'adGoWa'], ['url', 'adGoUrl'], ['', 'adGoNone']];
    const s = SP.openSheet(`<h2 class="sheet-title">${esc(t(old ? 'adEditT' : 'adNewT'))}</h2><form class="form adform" id="adf" novalidate>
      <div class="field"><span class="lbl">${esc(t('adPreview'))}</span><div id="adpv"></div></div>
      <div class="field"><span class="lbl">${esc(t('adPhoto'))}</span><div class="adpick"><label class="btn btn-ghost sm" id="adpl">${I('image')} <span id="adplt"></span><input type="file" accept="image/*" class="sr" id="adfile"></label>
        <button type="button" class="btn btn-ghost sm" id="adrm">${I('trash')} ${esc(t('adPhotoDel'))}</button></div><span class="hint">${esc(t('adPhotoH'))}</span></div>
      <fieldset class="field" id="adposw"><legend class="lbl">${esc(t('adPos'))}</legend><div class="seg" id="adpos">${PL.map(([v, k]) => `<input type="radio" name="adpos" id="adpos-${v || 'start'}" value="${v}"${(a.pos || '') === v ? ' checked' : ''}><label for="adpos-${v || 'start'}">${esc(t(k))}</label>`).join('')}</div></fieldset>
      <div class="field"><label for="adt">${esc(t('adTitle'))}</label><input id="adt" class="input" maxlength="60" value="${esc(a.title || '')}" placeholder="${esc(t('adTitlePh'))}"></div>
      <div class="field"><label for="ads2">${esc(t('adSub'))}</label><input id="ads2" class="input" maxlength="120" value="${esc(a.sub || '')}" placeholder="${esc(t('adSubPh'))}"></div>
      <div class="field"><label for="adc">${esc(t('adCta'))}</label><input id="adc" class="input" maxlength="24" value="${esc(a.cta || '')}" placeholder="${esc(t('adCtaDef'))}"></div>
      <fieldset class="field"><legend class="lbl">${esc(t('adGo'))}</legend><div class="seg" id="adgo">${GO.map(([v, k]) => `<input type="radio" name="adgo" id="adgo-${v || 'none'}" value="${v}"${a.go === v ? ' checked' : ''}><label for="adgo-${v || 'none'}">${esc(t(k))}</label>`).join('')}</div></fieldset>
      <div class="field" id="adtow"></div>
      <div class="field"><label for="adu">${esc(t('adUntil'))}</label><input id="adu" class="input" type="date" min="${today()}" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(a.until || '') ? a.until : '')}"><span class="hint">${esc(t('adUntilH'))}</span></div>
      <label class="switch"><input type="checkbox" id="adon"${a.on !== false ? ' checked' : ''}><span></span>${esc(t('adOn'))}</label>
      <p class="form-err" id="aderr" role="alert"></p>
      <div class="sheet-actions"><button class="btn btn-signal" id="adsave">${I('check')} ${esc(t('adSave'))}</button>
        ${old ? `<button type="button" class="btn btn-danger" id="addel">${I('trash')} ${esc(t('adDel'))}</button>` : ''}
        <button type="button" class="btn btn-ghost" data-close>${esc(t('adCancel'))}</button></div></form>`, { label: t(old ? 'adEditT' : 'adNewT') });
    const el = s.el, f = $('#adf', el);
    const val = id => $(id, el).value.trim();
    /* the field for "where a tap goes", keeping what was typed for each kind */
    const typed = { [a.go]: a.to || '' };
    const toField = () => {
      const g = a.go, v = typed[g] != null ? typed[g] : '';
      $('#adtow', el).hidden = !g;
      $('#adtow', el).innerHTML = g === 'q' ? `<label for="adto">${esc(t('adToQ'))}</label><input id="adto" class="input" maxlength="60" value="${esc(v)}" placeholder="${esc(t('adToQPh'))}">`
        : g === 'b' ? `<label for="adto">${esc(t('adToB'))}</label><select id="adto" class="input">${SP.brandOptions(SP.BRAND.has(v) ? v : '', '—')}</select>`
        : g === 'wa' ? `<label for="adto">${esc(t('adToWa'))}</label><input id="adto" class="input" maxlength="200" value="${esc(v)}" placeholder="${esc(t('adToWaPh'))}">`
        : g === 'url' ? `<label for="adto">${esc(t('adToUrl'))}</label><input id="adto" class="input" type="url" dir="ltr" inputmode="url" maxlength="300" value="${esc(v)}" placeholder="https://">` : '';
    };
    const read = () => {
      a.title = val('#adt'); a.sub = val('#ads2'); a.cta = val('#adc'); a.until = val('#adu'); a.on = $('#adon', el).checked;
      const ps = $('#adpos input:checked', el); a.pos = ps ? ps.value : '';
      if ($('#adto', el)) typed[a.go] = $('#adto', el).value.trim();
      a.to = a.go ? (typed[a.go] || '') : '';
    };
    const preview = () => { read(); $('#adpv', el).innerHTML = banner([{ ...a, on: true, until: '' }], { preview: true }); $('#adplt', el).textContent = t(a.img ? 'adPhotoChange' : 'adPhotoPick'); $('#adrm', el).hidden = !a.img; $('#adposw', el).hidden = !pic(a.img); };
    toField(); preview();
    f.addEventListener('input', preview);
    $('#adgo', el).addEventListener('change', e => { read(); a.go = e.target.value; toField(); preview(); $('#aderr', el).textContent = ''; });
    $('#adfile', el).onchange = async e => {
      const file = e.target.files && e.target.files[0]; e.target.value = '';
      if (!file) return;
      $('#adpl', el).classList.add('busy');
      try { a.img = await SP.uploadPhoto(file, 'cover'); preview(); } catch (x) { SP.toast(SP.errText(x)); } finally { $('#adpl', el).classList.remove('busy'); }
    };
    $('#adrm', el).onclick = () => { a.img = ''; preview(); };
    f.onsubmit = async e => {
      e.preventDefault(); read();
      const err = m => { $('#aderr', el).textContent = t(m); };
      if (!a.title && !a.img) return err('adNeed');
      if (a.go === 'q' && !a.to) return err('adNeedQ');
      if (a.go === 'b' && !SP.BRAND.has(a.to)) return err('adNeedB');
      if (a.go === 'url' && !/^https:\/\/[^\s"'<>]+$/i.test(a.to)) return err('adBadUrl');
      if (a.go === 'wa' && !SP.waLink((S.settings || {}).contact_wa, 'x', S.country)) return err('adNeedWa');
      const out = { id: clip(a.id, 40) || uid(), img: a.img || '', title: clip(a.title, 60), sub: clip(a.sub, 120), cta: clip(a.cta, 24), go: a.go || '', to: a.go ? clip(a.to, 300) : '',
        pos: a.img && POS.includes(a.pos || '') ? a.pos || '' : '', until: a.until || '', on: a.on !== false };
      const next = all().slice();
      if (old) { const j = next.findIndex(x => x.id === old.id); next[j >= 0 ? j : i] = out; } else next.push(out);
      const b = $('#adsave', el); b.classList.add('busy');
      try {
        await save(next.slice(0, MAX));
        if (old && old.img && old.img !== out.img && !next.some(x => x.img === old.img)) SP.removePhotos([old.img]);
        s.close(); SP.toast(t('adSaved')); redraw();
      } catch (x) { $('#aderr', el).textContent = SP.errText(x); } finally { b.classList.remove('busy'); }
    };
    if ($('#addel', el)) $('#addel', el).onclick = async () => {
      if (!await SP.confirmSheet({ title: t('adDelQ', { t: clip(old.title, 60) || t('adNoTitle') }), body: t('adDelB'), ok: t('adDel'), danger: true })) return;
      const next = all().filter(x => x !== old && x.id !== old.id);
      try {
        await save(next);
        if (old.img && !next.some(x => x.img === old.img)) SP.removePhotos([old.img]);
        s.close(); SP.toast(t('adDeleted')); redraw();
      } catch (x) { $('#aderr', el).textContent = SP.errText(x); }
    };
  }
})();
