/* Sign in with Face ID, Touch ID or a fingerprint: passkeys (WebAuthn). The server side is Supabase Auth's passkeys
   (supabase-js 2.105+, Authentication → Passkeys in the dashboard: RP ID = the site's domain, its https origin); the demo runs
   the same ceremony against the in-browser backend. The challenge is fetched before the tap, because Safari only opens
   Face ID straight from a tap. Not offered inside the Claude app page (WebAuthn is not allowed in that frame). */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S } = SP;
  const CFG = SP.CFG || window.SPARAT_CONFIG || {};

  Object.assign(window.SP_IC, {
    faceid: '<path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2"/><path d="M9 9.2v1.3M15 9.2v1.3M12.2 9.5v3.6h-1.1M9.4 15.6a3.9 3.9 0 0 0 5.2 0"/>'
  });
  Object.assign(SP.L.T, {
    bioSignIn: ["ادخل بـ {b}", "Sign in with {b}"], bioOr: ["أو بالبريد وكلمة السر", "or with email and password"],
    bioT: ["الدخول بـ {b}", "Sign in with {b}"], bioOffB: ["ادخل للتطبيق بـ {b} بدل ما تكتب البريد وكلمة السر.", "Open the app with {b} instead of typing your email and password."],
    bioOnB: ["مفعّل: تقدر تدخل بـ {b} من الأجهزة هذي.", "On: you can sign in with {b} on these devices."],
    bioOn: ["فعّل الدخول بـ {b}", "Turn on {b} sign-in"], bioAdd: ["فعّله على الجهاز هذا كمان", "Add this device too"],
    bioDone: ["تمام! المرة الجاية ادخل بـ {b}", "Done! Next time, sign in with {b}"],
    bioDel: ["شيله", "Remove"], bioDelQ: ["توقف الدخول بـ {b} من «{d}»؟", "Stop {b} sign-in from “{d}”?"],
    bioDelB: ["تقدر تفعّله من جديد وقتما تبي.", "You can turn it on again any time."], bioDeleted: ["توقف الدخول من «{d}»", "Removed “{d}”"],
    bioAdded: ["تفعّل {ago}", "Added {ago}"], bioUsed: ["آخر دخول {ago}", "Last used {ago}"],
    bioExists: ["الجهاز هذا مفعّل من قبل.", "This device is already set up."], bioCancel: ["ما تمش. جرّب مرة ثانية.", "Not done. Try again."],
    bioNotFound: ["{b} مش مفعّل لحساب على الجهاز هذا. ادخل بكلمة السر، وفعّله من «حسابي».", "{b} isn’t set up for an account on this device. Sign in with your password and turn it on in your account."],
    bioDisabled: ["الدخول بـ {b} مش مفعّل في السيرفر بعد.", "{b} sign-in isn’t enabled on the server yet."],
    bioFail: ["ما قدرناش نتأكدو منك. جرّب مرة ثانية أو ادخل بكلمة السر.", "We couldn’t confirm it was you. Try again or use your password."],
    bioFinger: ["البصمة", "your fingerprint"], bioThis: ["الجهاز هذا", "This device"]
  });

  const api = () => SP.sb && SP.sb.auth;
  const twoStep = () => { const a = api(); return !!(a && a.passkey && typeof a.passkey.startAuthentication === 'function' && typeof a.passkey.verifyAuthentication === 'function'); };

  /* Face ID on iPhone and iPad, Touch ID on a Mac, Windows Hello, a fingerprint elsewhere */
  SP.bioName = () => {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'Face ID';
    if (/Macintosh/.test(ua)) return 'Touch ID';
    if (/Windows/.test(ua)) return 'Windows Hello';
    return t('bioFinger');
  };
  /* this device can do it: a secure page outside the Claude app frame, a screen-lock authenticator, a server that has passkeys */
  let readyP = null;
  SP.passkeyReady = () => readyP || (readyP = (async () => {
    const a = api();
    if (CFG.embedded || !window.isSecureContext || !window.PublicKeyCredential || !a || !(a.passkey || a.signInWithPasskey)) return false;
    try { return !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
  })());

  /* ---------- WebAuthn JSON ⇄ the browser's objects ---------- */
  const b64u = {
    enc: buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec: s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0)).buffer
  };
  /* the server's options may come as {publicKey: {...}} or as the options themselves */
  const unwrap = o => (o && o.publicKey) || o || {};
  function requestOptions(o) {
    o = unwrap(o);
    if (PublicKeyCredential.parseRequestOptionsFromJSON) { try { return PublicKeyCredential.parseRequestOptionsFromJSON(o); } catch (e) { /* older shape: decode by hand */ } }
    return { ...o, challenge: b64u.dec(o.challenge), allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: b64u.dec(c.id) })) };
  }
  function creationOptions(o) {
    o = unwrap(o);
    if (PublicKeyCredential.parseCreationOptionsFromJSON) { try { return PublicKeyCredential.parseCreationOptionsFromJSON(o); } catch (e) { /* decode by hand */ } }
    return { ...o, challenge: b64u.dec(o.challenge), user: { ...o.user, id: b64u.dec(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: b64u.dec(c.id) })) };
  }
  function credentialJSON(c) {
    if (typeof c.toJSON === 'function') { try { return c.toJSON(); } catch (e) { /* by hand below */ } }
    const r = c.response, o = { id: c.id, rawId: b64u.enc(c.rawId), type: c.type, clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
      authenticatorAttachment: c.authenticatorAttachment || undefined, response: { clientDataJSON: b64u.enc(r.clientDataJSON) } };
    if (r.attestationObject) { o.response.attestationObject = b64u.enc(r.attestationObject); if (r.getTransports) o.response.transports = r.getTransports(); }
    else { o.response.authenticatorData = b64u.enc(r.authenticatorData); o.response.signature = b64u.enc(r.signature); if (r.userHandle) o.response.userHandle = b64u.enc(r.userHandle); }
    return o;
  }
  const fail = r => { if (r && r.error) throw r.error; return r ? r.data : null; };

  /* ---------- the ceremonies; options fetched ahead and used once ---------- */
  const ahead = { login: null, reg: null }, going = { login: null, reg: null };
  const fresh = x => x && Date.now() - x.at < 3.5 * 60e3;
  function prefetch(kind) {
    if (!twoStep()) return Promise.resolve(null);
    return going[kind] || (going[kind] = (async () => {
      try {
        const d = fail(await (kind === 'login' ? api().passkey.startAuthentication() : api().passkey.startRegistration()));
        ahead[kind] = { at: Date.now(), id: d.challenge_id || d.challengeId, options: d.options };
      } catch (e) { ahead[kind] = null; }
      going[kind] = null;
      return ahead[kind];
    })());
  }
  SP.passkeyPrefetch = kind => prefetch(kind || 'login');
  /* only when the one at hand is old or used (the System's lock keeps one ready); and whether a tap can use it now */
  SP.passkeyWarm = kind => { kind = kind || 'login'; return fresh(ahead[kind]) ? Promise.resolve(ahead[kind]) : prefetch(kind); };
  SP.passkeyHot = kind => !twoStep() || !!fresh(ahead[kind || 'login']);
  async function take(kind) { const x = fresh(ahead[kind]) ? ahead[kind] : await prefetch(kind); ahead[kind] = null; if (!x) throw Object.assign(new Error('passkey options'), { code: 'webauthn_challenge_not_found' }); return x; }

  /* signs in; returns the session */
  SP.passkeySignIn = async () => {
    if (!twoStep()) return fail(await api().signInWithPasskey()).session;
    const x = await take('login');
    const cred = await navigator.credentials.get({ publicKey: requestOptions(x.options) });
    const d = fail(await api().passkey.verifyAuthentication({ challengeId: x.id, credential: credentialJSON(cred) }));
    return d && d.session;
  };
  SP.passkeyRegister = async () => {
    if (!twoStep()) return fail(await api().registerPasskey());
    const x = await take('reg');
    const cred = await navigator.credentials.create({ publicKey: creationOptions(x.options) });
    return fail(await api().passkey.verifyRegistration({ challengeId: x.id, credential: credentialJSON(cred) }));
  };
  function bioErr(e) {
    const m = String((e && (e.message || e.code)) || ''), code = (e && e.code) || '', n = e && e.name, b = SP.bioName();
    if (n === 'NotAllowedError' || n === 'AbortError' || /NotAllowed|cancel/i.test(m)) return t('bioCancel');
    if (n === 'InvalidStateError' || code === 'webauthn_credential_exists') return t('bioExists');
    if (code === 'webauthn_credential_not_found') return t('bioNotFound', { b });
    if (code === 'passkey_disabled') return t('bioDisabled', { b });
    if (/^webauthn_/.test(code) || n === 'SecurityError') return t('bioFail');
    return SP.errText(e);
  }
  SP.bioErr = bioErr;

  /* ---------- the sign-in page: the Face ID button above the email form ---------- */
  SP.wireBioLogin = (n, done) => {
    const box = $('#abio');
    if (!box) return;
    SP.passkeyReady().then(ok => {
      if (!ok || !SP.alive(n) || !box.isConnected) return;
      const b = SP.bioName();
      box.innerHTML = `<button type="button" class="btn btn-ink block bio-btn" id="abg">${I('faceid')} ${esc(t('bioSignIn', { b }))}</button><p class="or-line"><span>${esc(t('bioOr'))}</span></p>`;
      box.hidden = false;
      prefetch('login');
      $('#abg').onclick = async () => {
        const btn = $('#abg'), err = $('#aerr');
        btn.classList.add('busy'); if (err) err.textContent = '';
        try { const s = await SP.passkeySignIn(); await done(s); }
        catch (e) { if (err) err.textContent = bioErr(e); btn.classList.remove('busy'); prefetch('login'); }
      };
    });
  };

  /* ---------- the account page: turn it on, see the devices, remove one ---------- */
  SP.bioCard = () => S.user ? '<div id="bioc"></div>' : '';
  SP.wireBio = n => {
    const box = $('#bioc');
    if (!box) return;
    SP.passkeyReady().then(async ok => {
      if (!ok || !SP.alive(n) || !box.isConnected) return;
      let list = [];
      try { list = (api().passkey && typeof api().passkey.list === 'function' ? fail(await api().passkey.list()) : []) || []; } catch (e) { list = []; }
      if (!SP.alive(n) || !box.isConnected) return;
      const b = SP.bioName(), on = list.length > 0;
      box.innerHTML = `<section class="mcard bio-card${on ? ' on' : ''}"><div class="mc-head">${I('faceid')}<span><b>${esc(t('bioT', { b }))}</b><small>${esc(t(on ? 'bioOnB' : 'bioOffB', { b }))}</small></span></div>
        ${on ? `<div class="bio-list">${list.map(p => `<div class="arow"><span class="ar-main"><b>${esc(p.friendly_name || t('bioThis'))}</b>
          <small>${esc([p.created_at && t('bioAdded', { ago: SP.ago(p.created_at) }), p.last_used_at && t('bioUsed', { ago: SP.ago(p.last_used_at) })].filter(Boolean).join(' · '))}</small></span>
          <button type="button" class="btn btn-ghost sm" data-del="${esc(p.id)}" data-name="${esc(p.friendly_name || t('bioThis'))}">${esc(t('bioDel'))}</button></div>`).join('')}</div>` : ''}
        ${SP.sysEntry && SP.isStaff && SP.isStaff() ? `<label class="switch bio-sys"><input type="checkbox" id="biosys"${SP.sysEntry.on() ? ' checked' : ''}><span></span><span class="bs-t"><b>${esc(t('enSw', { b }))}</b><small>${esc(t('enSwH'))}</small></span></label>` : ''}
        <p class="form-err" id="bioerr" role="alert"></p>
        <div class="form-actions"><button type="button" class="btn ${on ? 'btn-ghost' : 'btn-signal'}" id="bioon">${I('faceid')} ${esc(t(on ? 'bioAdd' : 'bioOn', { b }))}</button></div></section>`;
      if ($('#biosys', box)) $('#biosys', box).onchange = e => { SP.sysEntry.set(e.target.checked); SP.toast(t(e.target.checked ? 'enSwOn' : 'enSwOff', { b })); };
      prefetch('reg');
      $('#bioon').onclick = async () => {
        const btn = $('#bioon'); btn.classList.add('busy'); $('#bioerr').textContent = '';
        try { await SP.passkeyRegister(); SP.toast(t('bioDone', { b }), 5000); SP.wireBio(n); }
        catch (e) { $('#bioerr').textContent = bioErr(e); btn.classList.remove('busy'); prefetch('reg'); }
      };
      $$('[data-del]', box).forEach(x => { x.onclick = async () => {
        if (!await SP.confirmSheet({ title: t('bioDelQ', { b, d: x.dataset.name }), body: t('bioDelB'), ok: t('bioDel'), danger: true })) return;
        x.classList.add('busy');
        try { fail(await api().passkey.delete({ passkeyId: x.dataset.del })); SP.toast(t('bioDeleted', { d: x.dataset.name })); SP.wireBio(n); }
        catch (e) { x.classList.remove('busy'); $('#bioerr').textContent = bioErr(e); }
      }; });
    });
  };
})();
