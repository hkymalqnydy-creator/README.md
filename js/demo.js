/* In-browser stand-in for the Supabase backend. Used for the demo build (no server yet) and by the tests.
   It follows the rules of supabase/setup.sql: first account is admin, owners edit only their rows,
   prices are masked by the owner's price setting, customers cannot approve themselves.
   window.SPARAT_DEMO.create({ seed, persist }) returns an object with the supabase-js calls the app uses. */
(function () {
  'use strict';
  /* one saved demo per app, so two demo builds on the same web address keep their own data */
  /* SEED goes up when the sample data changes (v2: part pictures, v3: the air filter itself), so every phone starts again from the new data */
  const CONF = window.SPARAT_CONFIG || {}, SEED = 3, SUFFIX = CONF.mode === 'company' ? '_' + String(CONF.appName || 'co').toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
  const KEY = 'sp_demo_db_v' + SEED + SUFFIX;
  try { for (let v = 1; v < SEED; v++) { localStorage.removeItem('sp_demo_db_v' + v + SUFFIX); localStorage.removeItem('sp_demo_db_v' + v + SUFFIX + '_session'); } } catch (e) { /* no storage */ }
  const CATS = ['engine', 'brakes', 'suspension', 'electrical', 'lights', 'body', 'oils', 'cooling', 'ac', 'transmission', 'tires', 'interior', 'other'];
  const now = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
  const clone = o => JSON.parse(JSON.stringify(o));
  const blank = () => ({
    users: [], shops: [], products: [], admins: [], customers: [], files: {}, sync_key: '', staff: [], invoices: [], invoice_items: [], inv_seq: 1000,
    purchases: [], purchase_items: [], pur_seq: 0,
    settings: { id: 1, admin_wa: '', notice: '', updated_at: now(), price_mode: 'all', brand_name: '', tagline: '', logo: '', accent: '', hero_title: '', hero_sub: '',
      about: '', contact_wa: '', contact_phone: '', address: '', open_signup: true, orders_enabled: false, brands: [], bot_enabled: true, bot_welcome: '', bot_rules: [] }
  });

  /* Picture for demo parts: the category icon on a soft gradient. */
  const PAL = [['#fff4e3', '#ffd9a3', '#a85a00'], ['#e8f1f6', '#c4dbe8', '#0d5b74'], ['#eef0e6', '#d6dcc4', '#4b5a1e'], ['#f3ecf8', '#ddcdea', '#5a3b85'], ['#f1f1ef', '#dcdcd6', '#3b3f45']];
  const ICON = { brakes: 'c_brakes', electrical: 'c_elec', engine: 'c_engine', lights: 'c_light', oils: 'c_oil', suspension: 'c_susp', cooling: 'c_cool', tires: 'c_tire', body: 'c_body', ac: 'c_ac', transmission: 'c_gear', interior: 'c_int' };
  /* the brand-blue look (config skin 'royal') keeps its pictures in the same family of blues */
  const PAL_ROYAL = [['#eef2ff', '#d3ddff', '#2f54e6'], ['#f2f5fb', '#dde4f1', '#24366f'], ['#e8f0ff', '#c6d6ff', '#2343d2'], ['#f4f6fb', '#e1e6ef', '#3b4566']];
  function art(cat, k) {
    const pal = (window.SPARAT_CONFIG || {}).skin === 'royal' ? PAL_ROYAL : PAL;
    const IC = window.SP_IC || {}, [a, b, c] = pal[k % pal.length], icon = IC[ICON[cat]] || IC.wrench || '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><ellipse cx="200" cy="248" rx="110" ry="14" fill="#000" opacity=".08"/><g transform="translate(110 50) scale(7.5)" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</g></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function seedCompany(DB) {
    const C = window.SPARAT_CONFIG || {}, app = C.appName || 'CROSSKY', email = C.demoEmail || 'owner@demo.app';
    const owner = { id: uuid(), email, password: '123456' };
    DB.users.push(owner); DB.admins.push(owner.id);
    const ago = m => new Date(Date.now() - m * 60000).toISOString();
    const KJ = (window.SP_DATA ? window.SP_DATA.BRANDS : []).filter(b => b.origin === 'KR' || b.origin === 'JP').map(b => b.id);
    Object.assign(DB.settings, {
      brand_name: app, tagline: 'قطع غيار السيارات الكورية واليابانية', hero_title: 'قطع الكوري والياباني… كلها عندنا',
      hero_sub: 'أصلي وتجاري بأسعار الجملة والقطاعي، مع التوصيل لكل المدن الليبية.',
      about: app + ' شركة متخصصة في قطع غيار السيارات الكورية واليابانية: هيونداي، كيا، تويوتا، نيسان، ميتسوبيشي وغيرها.\n\nنوفر القطع الأصلية والتجارية بضمان، ونخدم الزبائن والورش والتجار في كل ليبيا.',
      contact_wa: '0912345678', contact_phone: '0912345678', address: 'طرابلس – طريق المطار', price_mode: 'all', orders_enabled: true, open_signup: false, brands: KJ,
      bot_rules: [
        { k: 'توصيل, شحن, delivery', a: 'نعم، التوصيل متاح لكل المدن الليبية. ابعتلنا موقعك على واتساب ونحددلك الوقت والتكلفة.' },
        { k: 'ضمان, كفالة, warranty', a: 'القطع الأصلية عليها ضمان الوكيل، والتجاري عليه ضمان التركيب. التفاصيل مكتوبة في كل قطعة.' },
        { k: 'جملة, تاجر, ورشة, wholesale', a: 'عندنا أسعار خاصة للتجار والورش. سجّل حساب من «حسابي» واطلب الاعتماد.' }
      ]
    });
    const shop = (name, city, area, makes, m) => ({ id: uuid(), owner_id: owner.id, name, person: '', whatsapp: '0912345678', phone: '0912345678', city, area,
      hours: '9 ص – 9 م، الجمعة عطلة', about: 'قطع أصلية وتجاري مع ضمان، وتوصيل داخل المدينة.', kinds: ['original', 'aftermarket'], makes,
      logo: null, cover: null, verified: true, country: 'LY', currency: 'LYD', created_at: ago(m), updated_at: ago(5) });
    const s1 = shop(app + ' – الفرع الرئيسي', 'طرابلس', 'طريق المطار', ['hyundai', 'kia', 'toyota', 'nissan'], 9000);
    const s2 = shop(app + ' – فرع بنغازي', 'بنغازي', 'شارع دبي', ['toyota', 'mitsubishi', 'honda'], 8000);
    const s3 = shop(app + ' – فرع مصراتة', 'مصراتة', 'الطريق الساحلي', ['hyundai', 'kia', 'mazda'], 7000);
    DB.shops.push(s1, s2, s3);
    const P = [
      [s1, 'HY-58101', 'فحمات فرامل أمامية', 'brakes', 'original', 150, 24, 'hyundai', 'Accent', 2011, 2017, '58101-1RA00'],
      [s1, 'HY-25310', 'رادياتير مياه أكسنت', 'cooling', 'aftermarket', 310, 6, 'hyundai', 'Accent', 2011, 2018, '25310-1R050'],
      [s3, 'KI-55300', 'مساعدات خلفية (زوج)', 'suspension', 'aftermarket', 260, 10, 'kia', 'Cerato', 2013, 2018, '55300-A7000'],
      [s1, 'KI-26300', 'فلتر زيت كيا وهيونداي', 'oils', 'original', 25, 120, 'kia', '', null, null, '26300-35505'],
      [s2, 'TY-04465', 'فحمات أمامية كورولا', 'brakes', 'original', 175, 30, 'toyota', 'Corolla', 2014, 2019, '04465-02220'],
      [s2, 'TY-81110', 'فنار أمامي يمين', 'lights', 'used', 480, 2, 'toyota', 'Corolla', 2014, 2019, '81110-02B90'],
      [s2, 'TY-88320', 'كمبروسر مكيف لاندكروزر', 'ac', 'refurb', 1450, 1, 'toyota', 'Land Cruiser', 2008, 2015, '88320-60890'],
      [s1, 'NS-40206', 'فحمات أمامية نيسان صني', 'brakes', 'aftermarket', 95, 40, 'nissan', 'Sunny', 2012, 2020, 'D1060-3AA0A'],
      [s1, 'NS-15208', 'فلتر زيت نيسان', 'oils', 'original', 20, 200, 'nissan', '', null, null, '15208-65F0E'],
      [s2, 'MT-MR968', 'كلتش كامل ميتسوبيشي L200', 'transmission', 'original', 690, 4, 'mitsubishi', 'L200 / Triton', 2006, 2015, 'MR968245'],
      [s3, 'MZ-PE01', 'بواجي مازدا (4 قطع)', 'engine', 'original', 140, 18, 'mazda', 'Mazda3', 2014, 2019, 'PE5R-18-110'],
      [s2, 'HO-45022', 'فحمات أمامية هوندا سيفيك', 'brakes', 'aftermarket', 120, 0, 'honda', 'Civic', 2012, 2015, '45022-TR0-A01'],
      [s1, 'HY-ELN-LED', 'فنار خلفي إلنترا LED', 'lights', 'original', 520, 3, 'hyundai', 'Elantra / Avante', 2016, 2020, '92401-F2000'],
      [s1, 'KI-SPT-SH', 'مساعدات أمامية سبورتاج', 'suspension', 'original', 640, 5, 'kia', 'Sportage', 2016, 2021, '54651-D9000'],
      [s3, 'GEN-OIL-5W30', 'زيت محرك 5W-30 (4 لتر)', 'oils', 'aftermarket', 95, 60, 'any', '', null, null, ''],
      [s1, 'GEN-BAT-70', 'بطارية 70 أمبير', 'electrical', 'aftermarket', 520, 8, 'any', '', null, null, '']
    ];
    /* studio pictures of each kind of part (img/parts, rendered from 3D models); the drawn icon when there is none */
    const PART_IMG = { 'HY-58101': 'brake-pads', 'TY-04465': 'brake-pads', 'NS-40206': 'brake-pads', 'HO-45022': 'brake-pads', 'HY-25310': 'radiator',
      'KI-55300': 'rear-shocks', 'KI-SPT-SH': 'front-strut', 'KI-26300': 'oil-filter', 'NS-15208': 'oil-filter', 'TY-81110': 'headlight', 'HY-ELN-LED': 'tail-lamp',
      'TY-88320': 'ac-compressor', 'MT-MR968': 'clutch-kit', 'MZ-PE01': 'spark-plugs', 'GEN-OIL-5W30': 'engine-oil', 'GEN-BAT-70': 'battery' };
    const imgBase = C.demoImgBase == null ? 'img/parts/' : C.demoImgBase;
    const DESCR = 'القطعة جديدة في الكرتونة، وعليها ضمان من الشركة. التوصيل متاح لكل المدن.';
    P.forEach(([s, sku, title, cat, cond, price, qty, make, model, yf, yt, pn], i) => DB.products.push({
      id: uuid(), shop_id: s.id, owner_id: owner.id, sku, title, cat, cond, price, nego: i % 4 === 0, qty, make, model, y_from: yf, y_to: yt, part_no: pn,
      descr: DESCR, imgs: PART_IMG[sku] && imgBase ? [imgBase + PART_IMG[sku] + '.jpg'] : [art(cat, i), art(cat, i + 2)],
      status: qty === 0 ? 'sold' : 'active', hide_price: i === 6 || i === 9, search_text: '', created_at: ago(40 + i * 97), updated_at: ago(3)
    }));
    /* the edition's own parts with real photos (config demoExtra, from tools/build_company.py --demo-extra): listed first */
    (Array.isArray(C.demoExtra) ? C.demoExtra : []).forEach((x, k) => x && x.sku && x.title && DB.products.push({
      id: uuid(), shop_id: s1.id, owner_id: owner.id, sku: String(x.sku), title: String(x.title), cat: x.cat || 'other', cond: x.cond || 'original',
      price: x.price == null ? null : +x.price, nego: false, qty: x.qty == null ? 10 : +x.qty, make: x.make || 'any', model: x.model || '', y_from: null, y_to: null,
      part_no: x.part_no || String(x.sku), descr: x.descr || DESCR, imgs: Array.isArray(x.imgs) ? x.imgs.slice(0, 6) : [], status: 'active', hide_price: false,
      search_text: '', created_at: ago(5 + k), updated_at: ago(1)
    }));
    DB.products.forEach(p => { if (p.price != null) p.cost = Math.round(p.price * 0.72); });
    const ean = d12 => d12 + ((10 - d12.split('').reduce((k, c, i) => k + (+c) * (i % 2 ? 3 : 1), 0) % 10) % 10);
    DB.products.forEach((p, i) => { p.barcode = i % 3 === 2 ? null : ean((['hyundai', 'kia'].includes(p.make) ? '880' : p.make === 'any' ? '622' : '490') + String(1000000001 + i * 7919).slice(-9)); });
    const rid = uuid(), rc = [[0, 20], [3, 60], [8, 100]];
    DB.purchases.push({ id: rid, no: ++DB.pur_seq, branch_id: s1.id, staff_id: owner.id, staff_name: email, supplier: 'الشركة الكورية للتوريد', note: '', items_count: rc.length,
      total: rc.reduce((k, [i, q]) => k + DB.products[i].cost * q, 0), created_at: ago(2900) });
    rc.forEach(([i, q], k) => DB.purchase_items.push({ id: k + 1, purchase_id: rid, product_id: DB.products[i].id, code: DB.products[i].sku, title: DB.products[i].title, qty: q, cost: DB.products[i].cost }));
    const domain = email.split('@')[1] || 'demo.app', seller = { id: uuid(), email: 'seller@' + domain, password: '123456' };
    DB.users.push(seller);
    DB.staff.push({ id: uuid(), email: seller.email, user_id: seller.id, name: 'أحمد (بائع)', perms: ['sales', 'returns'], branch_id: s1.id, active: true, created_at: ago(5000) });
    [[s1, seller, 'أحمد (بائع)', [[0, 2], [3, 4]], 'cash', 1500], [s1, owner, email, [[13, 1]], 'card', 700], [s2, owner, email, [[4, 2], [8, 3]], 'credit', 60]].forEach(([sh, who, name, lines, pay, m]) => {
      const id = uuid(); let sub = 0;
      lines.forEach(([i, q]) => { const pr = DB.products[i]; sub += pr.price * q; if (pr.qty != null) pr.qty -= q; DB.invoice_items.push({ id: DB.invoice_items.length + 1, invoice_id: id, product_id: pr.id, sku: pr.sku, title: pr.title, qty: q, price: pr.price, cost: pr.cost, line_total: pr.price * q }); });
      DB.invoices.push({ id, no: ++DB.inv_seq, branch_id: sh.id, staff_id: who.id, staff_name: name, customer_id: null, customer_name: pay === 'credit' ? 'ورشة النور للصيانة' : '', customer_phone: '',
        subtotal: sub, discount: 0, total: sub, paid: pay === 'credit' ? 0 : sub, payment: pay, currency: 'LYD', status: 'done', note: '', created_at: ago(m), returned_at: null });
    });
    const cu = (name, phone, city, approved, m) => { const id = uuid(); DB.users.push({ id, email: 'c' + DB.users.length + '@demo.app', password: uuid() }); DB.customers.push({ user_id: id, name, phone, city, approved, created_at: ago(m) }); };
    cu('ورشة النور للصيانة', '0925551234', 'طرابلس', true, 3000);
    cu('محمد سالم', '0947778899', 'بنغازي', false, 200);
  }

  function create(opts) {
    opts = opts || {};
    let DB = null;
    if (opts.persist) { try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; } }
    if (!DB) { DB = blank(); if (opts.seed && (window.SPARAT_CONFIG || {}).mode === 'company') seedCompany(DB); }
    DB = Object.assign(blank(), DB); DB.settings = Object.assign(blank().settings, DB.settings);
    window.__mockdb = DB;
    let session = null; const listeners = [];
    try { const s = opts.persist && JSON.parse(localStorage.getItem(KEY + '_session') || 'null'); if (s && DB.users.some(u => u.id === s.user.id)) session = s; } catch (e) { /* signed out */ }
    function save() {
      if (!opts.persist) return;
      try { localStorage.setItem(KEY, JSON.stringify(DB)); localStorage.setItem(KEY + '_session', JSON.stringify(session)); } catch (e) { /* storage full: keep working in memory */ }
    }
    const later = v => new Promise(r => setTimeout(() => r(v), 15));
    const uid = () => session && session.user.id;
    const isAdmin = () => !!uid() && DB.admins.includes(uid());
    const staffRow = () => DB.staff.find(x => x.user_id && x.user_id === uid() && x.active);
    const hasPerm = p => isAdmin() || !!(staffRow() && staffRow().perms.includes(p));
    const isStaff = () => isAdmin() || !!staffRow();
    const fail = (m, code) => { throw Object.assign(new Error(m), { code: code || 'P0001' }); };
    const emit = ev => listeners.forEach(f => { try { f(ev, session); } catch (e) { console.error(e); } });
    const rls = () => ({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } });

    const auth = {
      getSession: () => later({ data: { session }, error: null }),
      onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      async signUp({ email, password }) {
        email = String(email || '').trim().toLowerCase();
        if (DB.users.find(u => u.email === email)) return { data: { user: null, session: null }, error: { message: 'User already registered', status: 422 } };
        const user = { id: uuid(), email };
        DB.users.push({ ...user, password });
        DB.staff.forEach(x => { if (!x.user_id && x.email === email) x.user_id = user.id; });
        if (!DB.admins.length) DB.admins.push(user.id);
        session = { user, access_token: 'demo' }; save(); setTimeout(() => emit('SIGNED_IN'));
        return { data: { user, session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        email = String(email || '').trim().toLowerCase();
        const u = DB.users.find(x => x.email === email && x.password === password);
        if (!u) return { data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } };
        session = { user: { id: u.id, email }, access_token: 'demo' }; save(); setTimeout(() => emit('SIGNED_IN'));
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() { session = null; save(); setTimeout(() => emit('SIGNED_OUT')); return { error: null }; },
      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser({ password }) {
        if (!session) return { data: null, error: { message: 'not authorized' } };
        const u = DB.users.find(x => x.id === uid()); if (u && password) u.password = password; save();
        return { data: { user: session.user }, error: null };
      }
    };

    const canRead = (name, r) => name === 'products' ? (isStaff() || r.owner_id === uid()) : name === 'customers' ? (r.user_id === uid() || hasPerm('customers') || hasPerm('sales'))
      : name === 'staff' ? (isAdmin() || (!!uid() && r.user_id === uid())) : (name === 'invoices' ? (hasPerm('invoices') || r.staff_id === uid()) : true);
    const canWrite = (name, r) => name === 'settings' ? hasPerm('settings') : name === 'customers' ? (!!uid() && (r.user_id === uid() || hasPerm('customers')))
      : name === 'products' ? (!!uid() && (r.owner_id === uid() || hasPerm('products'))) : name === 'staff' ? isAdmin() : (!!uid() && (r.owner_id === uid() || isAdmin()));
    function insertRow(name, v) {
      if (!uid()) return rls();
      if (name === 'shops') {
        if (!(DB.settings.open_signup !== false || isAdmin())) return rls();
        if (v.country && !/^[A-Z]{2}$/.test(v.country)) return { error: { message: 'violates check constraint', code: '23514' } };
        return { row: { id: uuid(), person: '', phone: '', area: '', hours: '', about: '', kinds: [], makes: [], logo: null, cover: null, country: 'LY', currency: 'LYD', ...v,
          owner_id: isAdmin() && v.owner_id ? v.owner_id : uid(), verified: isAdmin() ? !!v.verified : false, created_at: now(), updated_at: now() } };
      }
      if (name === 'products') {
        const s = DB.shops.find(x => x.id === v.shop_id);
        if (!s || !(s.owner_id === uid() || hasPerm('products'))) return rls();
        if (v.sku && DB.products.some(p => p.sku === v.sku)) return { error: { message: 'duplicate key value violates unique constraint "products_sku_key"', code: '23505' } };
        const row = { id: uuid(), price: null, qty: null, nego: false, make: 'any', model: '', y_from: null, y_to: null, part_no: '', descr: '', imgs: [], status: 'active', sku: null, hide_price: false, ...v, owner_id: s.owner_id, created_at: now(), updated_at: now() };
        if (row.y_from && row.y_to && row.y_from > row.y_to) [row.y_from, row.y_to] = [row.y_to, row.y_from];
        return { row };
      }
      if (name === 'customers') {
        if (DB.customers.some(c => c.user_id === uid())) return { error: { message: 'duplicate key', code: '23505' } };
        return { row: { phone: '', city: '', ...v, user_id: uid(), approved: false, created_at: now() } };
      }
      return rls();
    }
    function updateVals(name, r, v) {
      v = { ...v };
      if (name === 'shops' && !isAdmin()) { delete v.owner_id; delete v.verified; }
      if (name === 'products') {
        if (!isAdmin()) delete v.shop_id;
        if (v.sku && DB.products.some(p => p.sku === v.sku && p.id !== r.id)) return { error: { message: 'duplicate key value violates unique constraint "products_sku_key"', code: '23505' } };
        v.owner_id = (DB.shops.find(s => s.id === (v.shop_id || r.shop_id)) || {}).owner_id || r.owner_id;
      }
      if (name === 'customers' && !hasPerm('customers')) { delete v.approved; delete v.user_id; }
      if (name !== 'customers') v.updated_at = now();
      return { vals: v };
    }
    function run(q) {
      const rows = q.name === 'settings' ? [DB.settings] : DB[q.name];
      const match = r => q.filters.every(([k, v]) => String(r[k]) === String(v));
      let out = [];
      if (q.op === 'select') out = rows.filter(r => match(r) && canRead(q.name, r));
      else if (q.op === 'insert') { const r = insertRow(q.name, q.vals); if (!r.row) return r; rows.push(r.row); out = [r.row]; }
      else if (q.op === 'update') {
        for (const r of rows.filter(match)) {
          if (!canWrite(q.name, r)) continue;
          const u = updateVals(q.name, r, q.vals);
          if (u.error) return u;
          Object.assign(r, u.vals); out.push(r);
        }
      } else if (q.op === 'delete') {
        rows.filter(match).forEach(r => {
          if (!canWrite(q.name, r)) return;
          rows.splice(rows.indexOf(r), 1); out.push(r);
          if (q.name === 'shops') DB.products = DB.products.filter(p => p.shop_id !== r.id);
        });
      }
      if (q.op !== 'select') save();
      if (q.sort) out = out.slice().sort((a, b) => String(a[q.sort.k]).localeCompare(String(b[q.sort.k])) * (q.sort.asc ? 1 : -1));
      if (q.lim) out = out.slice(0, q.lim);
      const copy = clone(out);
      if (q.mode === 'single') return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } };
      if (q.mode === 'maybe') return { data: copy[0] || null, error: null };
      return { data: copy, error: null };
    }
    function from(name) {
      const q = { name, op: 'select', vals: null, filters: [], mode: 'many' };
      const b = {
        select() { return b; }, insert(v) { q.op = 'insert'; q.vals = v; return b; }, update(v) { q.op = 'update'; q.vals = v; return b; },
        delete() { q.op = 'delete'; return b; }, eq(k, v) { q.filters.push([k, v]); return b; },
        order(k, o) { q.sort = { k, asc: !(o && o.ascending === false) }; return b; }, limit(n) { q.lim = n; return b; },
        maybeSingle() { q.mode = 'maybe'; return b; }, single() { q.mode = 'single'; return b; },
        then(res, rej) { return later().then(() => run(q)).then(res, rej); }
      };
      return b;
    }

    const shopOf = id => DB.shops.find(s => s.id === id);
    const counts = s => { const ps = DB.products.filter(p => p.shop_id === s.id); return { product_count: ps.filter(p => p.status === 'active').length, sold_count: ps.filter(p => p.status === 'sold').length, noimg_count: ps.filter(p => !p.imgs.length).length, last_at: ps.length ? ps.map(p => p.created_at).sort().pop() : null }; };
    const yr = (p, y) => (!p.y_from || p.y_from <= y) && (!p.y_to || p.y_to >= y);
    const norm = s => (window.SP && window.SP.norm ? window.SP.norm(s) : String(s || '').toLowerCase());
    const brandWords = id => { const b = window.SP_DATA && window.SP_DATA.BRANDS.find(x => x.id === id); return b ? b.en + ' ' + b.ar : ''; };
    const text = p => p.search_text || (window.SP && window.SP.searchText ? window.SP.searchText(p) : norm([p.title, p.part_no, p.sku, p.make, brandWords(p.make), p.model, p.descr].join(' ')));
    function visible(p) {
      const me = uid(), mode = DB.settings.price_mode || 'all';
      if (isStaff() || (me && me === p.owner_id)) return true;
      if (p.hide_price) return false;
      return mode === 'all' || (mode === 'members' && !!me) || (mode === 'approved' && DB.customers.some(c => c.user_id === me && c.approved));
    }
    function upsert(rows, shopId) {
      const shop = shopOf(shopId) || DB.shops.find(s => DB.admins.includes(s.owner_id)) || DB.shops[0];
      if (!shop) throw new Error('create a branch first');
      const sum = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
      const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : null; };
      for (const r of rows || []) {
        const sku = String(r.sku || '').trim().slice(0, 60);
        if (!sku) { sum.skipped++; continue; }
        const title = String(r.title || '').trim().slice(0, 120), price = num(r.price), qty = r.qty == null || r.qty === '' ? null : Math.floor(num(r.qty));
        const make = r.make ? String(r.make).toLowerCase().slice(0, 20) : null, cat = CATS.includes(r.cat) ? r.cat : null, bar = String(r.barcode || '').trim().slice(0, 60) || null;
        const p = DB.products.find(x => x.sku === sku);
        if (!p) {
          if (title.length < 2) { sum.skipped++; continue; }
          DB.products.push({ id: uuid(), shop_id: shop.id, owner_id: shop.owner_id, sku, barcode: bar, title, cat: cat || 'other', cond: 'original', price: price != null && price >= 0 ? price : null,
            nego: false, qty, make: make || 'any', model: r.model || '', y_from: null, y_to: null, part_no: r.part_no || sku, descr: '', imgs: [],
            status: qty != null && qty <= 0 ? 'sold' : 'active', hide_price: false, search_text: '', created_at: now(), updated_at: now() });
          sum.inserted++;
        } else {
          if (title.length >= 2) p.title = title;
          if ('price' in r) p.price = price != null && price >= 0 ? price : null;
          if ('qty' in r) { p.qty = qty; if (qty != null) p.status = qty <= 0 ? 'sold' : 'active'; }
          if (make) p.make = make; if ('model' in r) p.model = r.model || ''; if (cat) p.cat = cat; if (bar) p.barcode = bar;
          p.search_text = ''; p.updated_at = now();
          sum.updated++;
        }
      }
      save();
      return sum;
    }
    const RPC = {
      is_admin: () => isAdmin(),
      customer_approved: () => DB.customers.some(c => c.user_id === uid() && c.approved),
      search_products(a) {
        let L = DB.products.map(p => ({ p, s: shopOf(p.shop_id) })).filter(x => x.s).filter(({ p, s }) =>
          (a.p_include_sold || p.status === 'active') && (!a.p_ids || a.p_ids.includes(p.id)) && (!a.p_country || s.country === a.p_country) &&
          (!a.p_shop || p.shop_id === a.p_shop) && (!a.p_city || s.city === a.p_city) && (!a.p_cat || p.cat === a.p_cat) && (!a.p_cond || p.cond === a.p_cond) &&
          (!a.p_make || p.make === a.p_make) && (!a.p_model || p.model === '' || p.model === a.p_model) && (!a.p_year || yr(p, a.p_year)) &&
          (!a.p_fit_make || (p.make === 'any' && !a.p_fit_strict) || (p.make === a.p_fit_make && (!a.p_fit_model || p.model === '' || p.model === a.p_fit_model) && (!a.p_fit_year || yr(p, a.p_fit_year)))) &&
          (!a.p_patterns || a.p_patterns.every(pat => { try { return new RegExp(pat).test(text(p)); } catch (e) { return false; } })) &&
          (!a.p_years || a.p_years.every(y => (!p.y_from && !p.y_to) || yr(p, y))));
        L = L.map(x => ({ ...x, ok: visible(x.p) }));
        const by = a.p_sort === 'cheap' ? 1 : a.p_sort === 'exp' ? -1 : 0;
        L.sort((x, y) => {
          if (by) { const px = x.ok ? x.p.price : null, py = y.ok ? y.p.price : null; if (px == null && py != null) return 1; if (py == null && px != null) return -1; if (px !== py) return by * (px - py); }
          return y.p.created_at.localeCompare(x.p.created_at) || x.p.id.localeCompare(y.p.id);
        });
        const total = L.length, off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 24, 1), 60);
        return L.slice(off, off + lim).map(({ p, s, ok }) => {
          const r = { ...p }; delete r.search_text;
          r.price = ok ? p.price : null; r.price_hidden = p.price != null && !ok; r.cost = hasPerm('costs') ? (p.cost == null ? null : p.cost) : null;
          return { ...r, shop: { id: s.id, name: s.name, city: s.city, area: s.area, hours: s.hours, whatsapp: s.whatsapp, phone: s.phone, logo: s.logo, verified: s.verified, owner_id: s.owner_id, country: s.country, currency: s.currency }, total_count: total };
        });
      },
      list_shops(a) {
        const q = a.p_q ? norm(a.p_q) : '';
        const L = DB.shops.filter(s => (!a.p_country || s.country === a.p_country) && (!a.p_city || s.city === a.p_city) && (!a.p_owner || s.owner_id === a.p_owner) &&
          (!a.p_make || (s.makes || []).includes(a.p_make)) && (!q || [s.name, s.area, s.about].some(x => norm(x).includes(q)))).map(s => ({ ...s, ...counts(s) }));
        L.sort((x, y) => (y.verified - x.verified) || (y.product_count - x.product_count) || y.created_at.localeCompare(x.created_at));
        const total = L.length, off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 40, 1), 100);
        return L.slice(off, off + lim).map(s => ({ ...s, total_count: total }));
      },
      store_stats(a) {
        const sh = DB.shops.filter(s => (!a.p_country || s.country === a.p_country) && (!a.p_city || s.city === a.p_city) && (!a.p_shop || s.id === a.p_shop));
        const pr = DB.products.filter(p => sh.some(s => s.id === p.shop_id)), cats = {};
        pr.filter(p => p.status === 'active').forEach(p => { cats[p.cat] = (cats[p.cat] || 0) + 1; });
        return { shops: sh.length, products: pr.filter(p => p.status === 'active').length, sold: pr.filter(p => p.status === 'sold').length, noimg: pr.filter(p => !p.imgs.length).length,
          cities: new Set(DB.shops.filter(s => !a.p_country || s.country === a.p_country).map(s => s.city)).size, countries: new Set(DB.shops.map(s => s.country)).size, cats };
      },
      list_cities(a) { const m = {}; DB.shops.filter(s => !a.p_country || s.country === a.p_country).forEach(s => { m[s.city] = (m[s.city] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]).map(([city, shops]) => ({ city, shops })); },
      country_stats() { const m = {}; DB.shops.forEach(s => { m[s.country] = m[s.country] || { country: s.country, shops: 0, products: 0 }; m[s.country].shops++; m[s.country].products += counts(s).product_count; }); return Object.values(m); },
      rotate_sync_key() { if (!isAdmin()) throw Object.assign(new Error('not authorized'), { code: '42501' }); DB.sync_key = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join(''); save(); return DB.sync_key; },
      sync_products(a) { if (!DB.sync_key || a.p_key !== DB.sync_key) throw Object.assign(new Error('invalid sync key'), { code: '42501' }); return upsert(a.p_rows, a.p_shop); },
      my_perms() { const st = DB.staff.find(x => x.user_id && x.user_id === uid()); return { admin: isAdmin(), staff: !!staffRow(), perms: staffRow() ? staffRow().perms : [], branch: staffRow() ? staffRow().branch_id : null, name: st ? st.name : null }; },
      save_staff(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const email = String(a.p_email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('invalid email', '22023');
        const ok = ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'customers', 'reports', 'costs', 'settings', 'purchases'];
        let r = DB.staff.find(x => x.email === email);
        if (!r) { r = { id: uuid(), email, user_id: (DB.users.find(u => u.email === email) || {}).id || null, created_at: now() }; DB.staff.push(r); }
        Object.assign(r, { name: String(a.p_name || '').slice(0, 80), perms: [...new Set((a.p_perms || []).filter(p => ok.includes(p)))], branch_id: a.p_branch || null, active: a.p_active !== false });
        save(); return r;
      },
      delete_staff(a) { if (!isAdmin()) fail('not authorized', '42501'); DB.staff = DB.staff.filter(x => x.id !== a.p_id); save(); return null; },
      get_invoice(a) {
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v || !uid() || !(hasPerm('invoices') || v.staff_id === uid())) return null;
        const s = shopOf(v.branch_id);
        return { ...v, branch: s ? { id: s.id, name: s.name, city: s.city, area: s.area, phone: s.phone, whatsapp: s.whatsapp } : null,
          items: DB.invoice_items.filter(i => i.invoice_id === v.id).map(i => { const o = { ...i }; if (!hasPerm('costs')) delete o.cost; return o; }) };
      },
      create_invoice(a) {
        const p = a.p || {};
        if (!uid() || !hasPerm('sales')) fail('not authorized', '42501');
        const items = Array.isArray(p.items) ? p.items : [];
        if (!items.length || items.length > 200) fail('invoice needs 1 to 200 items', '22023');
        const st = staffRow(); let branch = (st && st.branch_id) || p.branch || null, sub = 0;
        const pay = ['cash', 'card', 'transfer', 'credit'].includes(p.payment) ? p.payment : 'cash', lines = [], snap = DB.products.map(x => ({ id: x.id, qty: x.qty, status: x.status }));
        try {
          for (const it of items) {
            const q = Math.floor(Number(it.qty) || 0), pr = DB.products.find(x => x.id === it.id);
            if (q < 1 || q > 100000) fail('bad quantity', '22023');
            if (!pr) fail('part not found');
            const price = hasPerm('prices') && it.price != null && it.price !== '' && isFinite(Number(it.price)) ? Number(it.price) : pr.price;
            if (price == null || price < 0) fail('part has no price: ' + pr.title);
            if (pr.qty != null && pr.qty < q) fail('not enough stock: ' + pr.title + ' (available ' + pr.qty + ')');
            if (pr.qty != null) { pr.qty -= q; if (pr.qty <= 0) pr.status = 'sold'; }
            sub += price * q; branch = branch || pr.shop_id;
            lines.push({ product_id: pr.id, sku: pr.sku || pr.part_no || null, title: pr.title, qty: q, price, cost: pr.cost == null ? null : pr.cost, line_total: price * q });
          }
          const disc = Number(p.discount) || 0;
          if (disc < 0 || disc > sub) fail('bad discount', '22023');
          if (disc > 0 && !hasPerm('discounts')) fail('not authorized to give discounts', '42501');
          const shop = shopOf(branch), me = DB.users.find(u => u.id === uid());
          const v = { id: uuid(), no: ++DB.inv_seq, branch_id: branch, staff_id: uid(), staff_name: (st && st.name) || (me && me.email) || '', customer_id: p.customer_id || null,
            customer_name: String(p.customer_name || '').slice(0, 80), customer_phone: String(p.customer_phone || '').slice(0, 30), subtotal: sub, discount: disc, total: sub - disc,
            paid: Math.max(0, p.paid != null ? Number(p.paid) || 0 : (pay === 'credit' ? 0 : sub - disc)), payment: pay, currency: (shop && shop.currency) || 'LYD', status: 'done',
            note: String(p.note || '').slice(0, 500), created_at: now(), returned_at: null };
          DB.invoices.push(v);
          lines.forEach((l, i) => DB.invoice_items.push({ id: DB.invoice_items.length + i + 1, invoice_id: v.id, ...l }));
          save();
          return RPC.get_invoice({ p_id: v.id });
        } catch (e) { snap.forEach(x => { const pr = DB.products.find(y => y.id === x.id); if (pr) { pr.qty = x.qty; pr.status = x.status; } }); throw e; }
      },
      return_invoice(a) {
        if (!hasPerm('returns')) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v) fail('invoice not found'); if (v.status === 'returned') fail('invoice already returned');
        DB.invoice_items.filter(i => i.invoice_id === v.id).forEach(i => { const pr = DB.products.find(x => x.id === i.product_id); if (pr && pr.qty != null) { pr.qty += i.qty; if (pr.qty > 0) pr.status = 'active'; } });
        v.status = 'returned'; v.returned_at = now(); save();
        return RPC.get_invoice({ p_id: v.id });
      },
      list_invoices(a) {
        if (!uid()) return [];
        const q = String(a.p_q || '').trim();
        const L = DB.invoices.filter(v => (hasPerm('invoices') || v.staff_id === uid()) && (!a.p_from || v.created_at >= a.p_from) && (!a.p_to || v.created_at < a.p_to) &&
          (!a.p_branch || v.branch_id === a.p_branch) && (!q || String(v.no) === q || v.customer_name.includes(q) || v.customer_phone.includes(q)))
          .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.no - x.no);
        const total = L.length, off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 30, 1), 100);
        return L.slice(off, off + lim).map(v => ({ ...v, branch_name: (shopOf(v.branch_id) || {}).name || null, items_count: DB.invoice_items.filter(i => i.invoice_id === v.id).reduce((k, i) => k + i.qty, 0), total_count: total }));
      },
      sales_report(a) {
        if (!hasPerm('reports')) fail('not authorized', '42501');
        const inv = DB.invoices.filter(v => v.status === 'done' && v.created_at >= a.p_from && v.created_at < a.p_to && (!a.p_branch || v.branch_id === a.p_branch));
        const ids = new Set(inv.map(v => v.id)), items = DB.invoice_items.filter(i => ids.has(i.invoice_id)), sum = (l, f) => l.reduce((k, x) => k + (Number(f(x)) || 0), 0);
        const group = (l, key, val) => { const m = {}; l.forEach(x => { const k = key(x); m[k] = m[k] || { c: 0, s: 0 }; m[k].c++; m[k].s += val(x); }); return m; };
        const bp = {}; Object.entries(group(inv, v => v.payment, v => v.total)).forEach(([k, x]) => { bp[k] = x.s; });
        const top = {}; items.forEach(i => { top[i.title] = top[i.title] || { title: i.title, qty: 0, total: 0 }; top[i.title].qty += i.qty; top[i.title].total += i.line_total; });
        return { count: inv.length, total: sum(inv, v => v.total), discount: sum(inv, v => v.discount), credit: sum(inv.filter(v => v.payment === 'credit'), v => v.total - v.paid),
          returned: DB.invoices.filter(v => v.status === 'returned' && v.returned_at >= a.p_from && v.returned_at < a.p_to).length, by_payment: bp,
          by_staff: Object.entries(group(inv, v => v.staff_name, v => v.total)).map(([name, x]) => ({ name, count: x.c, total: x.s })).sort((x, y) => y.total - x.total),
          by_branch: Object.entries(group(inv, v => v.branch_id, v => v.total)).map(([id, x]) => ({ name: (shopOf(id) || {}).name || '—', count: x.c, total: x.s })).sort((x, y) => y.total - x.total),
          by_day: Object.entries(group(inv, v => v.created_at.slice(0, 10), v => v.total)).map(([day, x]) => ({ day, total: x.s })).sort((x, y) => x.day.localeCompare(y.day)),
          top: Object.values(top).sort((x, y) => y.qty - x.qty).slice(0, 10),
          profit: hasPerm('costs') ? sum(items, i => i.line_total - (i.cost || 0) * i.qty) - sum(inv, v => v.discount) : null,
          cost_missing: hasPerm('costs') ? items.filter(i => i.cost == null).length : null };
      },
      import_products(a) { if (!isAdmin()) throw Object.assign(new Error('not authorized'), { code: '42501' }); return upsert(a.p_rows, a.p_shop); },
      receive_stock(a) {
        const p = a.p || {};
        if (!uid() || !hasPerm('purchases')) fail('not authorized', '42501');
        const items = Array.isArray(p.items) ? p.items : [];
        if (!items.length || items.length > 300) fail('receipt needs 1 to 300 items', '22023');
        const st = staffRow(), branch = shopOf((st && st.branch_id) || p.branch) || DB.shops.find(s => DB.admins.includes(s.owner_id)) || DB.shops[0];
        if (!branch) fail('create a branch first');
        const num = v => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
        const key = v => String(v || '').trim().toUpperCase(), canPrice = hasPerm('products');
        const snap = clone(DB.products), lines = []; let total = 0, nNew = 0, nUpd = 0;
        try {
          for (const it of items) {
            const q = Math.floor(num(it.qty) || 0);
            if (q < 1 || q > 1000000) fail('bad quantity', '22023');
            let cost = num(it.cost), price = num(it.price);
            if (cost != null && (cost < 0 || cost > 99999999)) cost = null;
            if (price != null && (price < 0 || price > 99999999 || !canPrice)) price = null;
            const sku = String(it.sku || '').trim().slice(0, 60), bar = String(it.barcode || '').trim().slice(0, 60), pn = String(it.part_no || '').trim().toUpperCase().slice(0, 60);
            const code = sku || bar || pn || null, here = list => list.sort((x, y) => (y.shop_id === branch.id) - (x.shop_id === branch.id))[0];
            let pr = it.product_id ? DB.products.find(x => x.id === it.product_id) : null;
            if (it.product_id && !pr) fail('part not found');
            const codes = [sku, bar, pn].filter(Boolean);
            if (!pr && codes.length) pr = DB.products.find(x => x.sku && codes.some(c => key(c) === key(x.sku)))
              || here(DB.products.filter(x => x.barcode && codes.includes(x.barcode))) || here(DB.products.filter(x => x.part_no && [pn, sku].some(c => c && key(c) === key(x.part_no))));
            if (pr) {
              pr.qty = (pr.qty || 0) + q; if (cost != null) pr.cost = cost; if (price != null) pr.price = price; pr.status = 'active'; pr.updated_at = now(); nUpd++;
            } else {
              const title = String(it.title || '').trim().slice(0, 120);
              if (title.length < 2) fail('new item needs a name', '22023');
              pr = { id: uuid(), shop_id: branch.id, owner_id: branch.owner_id, sku: sku || null, barcode: bar || null,
                title, cat: CATS.includes(it.cat) ? it.cat : 'other', cond: 'original', price, cost, nego: false, qty: q, make: String(it.make || '').trim().toLowerCase().slice(0, 20) || 'any',
                model: String(it.model || '').slice(0, 60), y_from: null, y_to: null, part_no: pn || sku || '', descr: '', imgs: [], status: 'active',
                hide_price: false, search_text: '', created_at: now(), updated_at: now() };
              DB.products.push(pr); nNew++;
            }
            lines.push({ product_id: pr.id, code, title: pr.title, qty: q, cost });
            total += (cost || 0) * q;
          }
        } catch (e) { DB.products = snap; throw e; }
        const me = DB.users.find(u => u.id === uid()), v = { id: uuid(), no: ++DB.pur_seq, branch_id: branch.id, staff_id: uid(), staff_name: (st && st.name) || (me && me.email) || '',
          supplier: String(p.supplier || '').slice(0, 120), note: String(p.note || '').slice(0, 500), total, items_count: lines.length, created_at: now() };
        DB.purchases.push(v);
        lines.forEach((l, i) => DB.purchase_items.push({ id: DB.purchase_items.length + i + 1, purchase_id: v.id, ...l }));
        save();
        return { id: v.id, no: v.no, new: nNew, updated: nUpd, total };
      },
      list_purchases(a) {
        if (!uid() || !(hasPerm('purchases') || hasPerm('reports'))) return [];
        const L = DB.purchases.slice().sort((x, y) => y.created_at.localeCompare(x.created_at)), off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 30, 1), 100), costs = hasPerm('costs');
        return L.slice(off, off + lim).map(v => ({ ...v, total: costs ? v.total : null, branch_name: (shopOf(v.branch_id) || {}).name || null, total_count: L.length,
          items: DB.purchase_items.filter(i => i.purchase_id === v.id).map(i => ({ title: i.title, code: i.code, qty: i.qty, cost: costs ? i.cost : null })) }));
      }
    };
    async function rpc(name, a) {
      await later();
      try { return { data: clone(RPC[name](a || {})), error: null }; } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    }
    function shrink(blob) {
      return new Promise(res => {
        const url = URL.createObjectURL(blob), img = new Image();
        img.onload = () => {
          const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = () => { URL.revokeObjectURL(url); res(''); };
        img.src = url;
      });
    }
    const storage = { from(bucket) { return {
      async upload(path, blob) {
        if (!uid() || path.split('/')[0] !== uid()) return rls();
        if (!/_t\.jpg$/.test(path)) DB.files[path] = opts.persist ? await shrink(blob) : 'https://test.supabase.co/storage/v1/object/public/' + bucket + '/' + path;
        save();
        return { data: { path }, error: null };
      },
      getPublicUrl(path) { return { data: { publicUrl: DB.files[path] || ('https://test.supabase.co/storage/v1/object/public/' + bucket + '/' + path) } }; },
      async remove(paths) { paths.forEach(p => { delete DB.files[p]; }); save(); return { data: paths, error: null }; }
    }; } };
    return { auth, from, rpc, storage, __db: DB };
  }
  window.SPARAT_DEMO = { create, reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_session'); } catch (e) { /* ignore */ } } };
})();
