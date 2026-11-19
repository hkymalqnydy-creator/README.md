/* In-browser stand-in for the Supabase backend. Used for the demo build (no server yet) and by the tests.
   It follows the rules of supabase/setup.sql: first account is admin, owners edit only their rows,
   prices are masked by the owner's price setting, customers cannot approve themselves.
   window.SPARAT_DEMO.create({ seed, persist }) returns an object with the supabase-js calls the app uses. */
(function () {
  'use strict';
  /* one saved demo per app, so two demo builds on the same web address keep their own data */
  /* SEED goes up when the sample data changes (v2: part pictures, v3: the air filter itself, v4: customers, suppliers, expenses and stock changes,
     v5: the activity log and a discount limit for the seller), so every phone starts again from the new data */
  const CONF = window.SPARAT_CONFIG || {}, SEED = 5, SUFFIX = CONF.mode === 'company' ? '_' + String(CONF.appName || 'co').toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
  const KEY = 'sp_demo_db_v' + SEED + SUFFIX;
  try { for (let v = 1; v < SEED; v++) { localStorage.removeItem('sp_demo_db_v' + v + SUFFIX); localStorage.removeItem('sp_demo_db_v' + v + SUFFIX + '_session'); } } catch (e) { /* no storage */ }
  const DEMO_MERCHANT = '218925551234@' + (CONF.phoneDomain || 'phone.invalid');
  /* the company that made each sample part (الشركة المصنّعة) */
  const MAKER = { 'HY-58101': 'موبيس', 'HY-25310': 'دنسو', 'KI-55300': 'ماندو', 'KI-26300': 'موبيس', 'TY-04465': 'تويوتا أصلي', 'TY-81110': 'كويتو',
    'TY-88320': 'دنسو', 'NS-40206': 'سانغ شين', 'NS-15208': 'نيسان أصلي', 'MT-MR968': 'إكسيدي', 'MZ-PE01': 'إن جي كي', 'HO-45022': 'سانغ شين',
    'HY-ELN-LED': 'موبيس', 'KI-SPT-SH': 'موبيس', 'GEN-OIL-5W30': 'توتال', 'GEN-BAT-70': 'فارتا' };
  const CATS = ['engine', 'brakes', 'suspension', 'electrical', 'lights', 'body', 'oils', 'cooling', 'ac', 'transmission', 'tires', 'interior', 'other'];
  /* Real photos for the bundled part pictures (img/parts/NAME.jpg): free Pexels photos (pexels.com/license: free to use, no credit
     required; credited here). The app shows them where the phone can reach images.pexels.com and falls back to the bundled picture
     (offline, or inside the Claude app, which blocks outside photos). Parts with no clean free photo keep the bundled picture.
     [photo id, photographer] — the photo page is https://www.pexels.com/photo/<id>/ */
  const REAL = {
    'brake-pads': [4022543, 'Jae Park'], 'radiator': [34351909, 'Erik Mclean'], 'rear-shocks': [11532598, 'Juan Montes'], 'front-strut': [11532598, 'Juan Montes'],
    'headlight': [1003849, 'Vija Rindo Pratama'], 'tail-lamp': [191238, 'InstaWalli'], 'engine-oil': [13065697, 'Daniel Andraski'], 'battery': [4374843, 'JS Leng'],
    'air-filter': [7541975, 'cottonbro studio']
  };
  /* the photo for a bundled picture, cropped to the cards' 4:3 at width w, or '' when there is none */
  const realPhoto = (url, w) => {
    const m = /(?:^|\/)img\/parts\/([a-z-]+)\.jpg$/.exec(url || ''), r = m && REAL[m[1]];
    return r ? `https://images.pexels.com/photos/${r[0]}/pexels-photo-${r[0]}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${Math.round(w * 3 / 4)}` : '';
  };
  const now = () => new Date().toISOString();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
  const clone = o => JSON.parse(JSON.stringify(o));
  const blank = () => ({
    users: [], shops: [], products: [], admins: [], customers: [], files: {}, sync_key: '', staff: [], invoices: [], invoice_items: [], inv_seq: 1000,
    purchases: [], purchase_items: [], pur_seq: 0,
    stock_moves: [], move_seq: 0, customer_payments: [], supplier_payments: [], pay_seq: 0, expenses: [], exp_seq: 0,
    activity: [], act_seq: 0, price_changes: [], batch_seq: 0, passkeys: [],
    settings: { id: 1, admin_wa: '', notice: '', updated_at: now(), price_mode: 'all', brand_name: '', tagline: '', logo: '', accent: '', hero_title: '', hero_sub: '',
      about: '', contact_wa: '', contact_phone: '', address: '', open_signup: true, orders_enabled: false, brands: [], brand_logos: {}, bot_enabled: true, bot_welcome: '', bot_rules: [],
      hide_qty: false, hide_branches: false, shop_closed: false, closed_msg: '', no_below_cost: false, low_stock: 3, invoice_footer: '', ads: [], open_shops: false,
      ai_customers: false, ai_name: '', ai_rules: '', ai_daily: 40 },
    ai_turns: []
  });
  /* the edition's ads at the top of the home screen (config demoAds, from tools/build_company.py --demo-ads) */
  const demoAds = () => (Array.isArray(CONF.demoAds) ? CONF.demoAds : []).filter(x => x && typeof x === 'object').slice(0, 5)
    .map((x, k) => ({ id: String(x.id || 'ad' + (k + 1)).slice(0, 40), img: x.img || '', title: x.title || '', sub: x.sub || '', cta: x.cta || '', go: x.go || '', to: x.to || '', pos: x.pos || '', until: x.until || '', on: x.on !== false }));
  /* the same checks as public.ads_ok in supabase/setup.sql, except that the demo keeps uploaded pictures on the device (data:) */
  const URL_OK = /^https:\/\/[^\s"'<>]+$/;
  const adsOk = v => Array.isArray(v) && v.length <= 5 && v.every(x => x && typeof x === 'object' && !Array.isArray(x)
    && String(x.id || '').length <= 40 && String(x.title || '').length <= 60 && String(x.sub || '').length <= 120 && String(x.cta || '').length <= 24
    && String(x.to || '').length <= 300 && ['', 'q', 'b', 'wa', 'url'].includes(x.go || '') && ['', 'end', 'top', 'bottom'].includes(x.pos || '')
    && (!x.img || /^data:image\//.test(x.img) || (x.img.length <= 600 && URL_OK.test(x.img)) || /^(img|icons)\//.test(x.img))
    && (x.go !== 'url' || URL_OK.test(x.to || '')) && (!x.until || /^\d{4}-\d{2}-\d{2}$/.test(x.until)) && (x.on == null || typeof x.on === 'boolean'));

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

  /* the merchants' shops the company shows on the home screen (supabase/setup.sql section 17): three more merchants, and
     every demo merchant's shop shown; two of them show their phone */
  function demoShops(DB) {
    const ago = m => new Date(Date.now() - m * 60000).toISOString();
    [['خالد المصراتي', 'قطع غيار الأمانة', '0913334455', 'مصراتة', true, 2600], ['أحمد الزاوي', 'محل الوفاء للسيارات', '0926667788', 'الزاوية', false, 1800],
      ['سالم الفزاني', 'مركز البركة لقطع الغيار', '0945556677', 'سبها', true, 900]].forEach(([name, shop, phone, city, approved, m]) => {
      if (DB.customers.some(c => c.phone === phone)) return;
      const id = uuid(); DB.users.push({ id, email: 'c' + DB.users.length + '@demo.app', password: uuid() });
      DB.customers.push({ user_id: id, name, shop_name: shop, phone, city, approved, created_at: ago(m) });
    });
    DB.customers.forEach(c => { c.shop_on = !!String(c.shop_name || '').trim(); c.phone_public = ['0925551234', '0913334455'].includes(c.phone); });
    demoCards(DB); DB.mshops = 1;
  }
  /* the warehouse: a shelf and a bin for every part, يوسف who prepares the invoices, and the newest ones waiting for him */
  function demoPicks(DB) {
    const shelf = ['A', 'B', 'C', 'D'];
    DB.products.forEach((p, i) => { if (!p.location) p.location = 'رف ' + shelf[i % 4] + (1 + (i % 5)) + ' · خانة ' + (2 + (i * 7) % 18); });
    DB.invoices.filter(v => ['done', 'preparing', 'ready'].includes(v.status)).sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 3)
      .forEach(v => { if (!v.pick_state) { v.pick_state = 'waiting'; v.picked_at = null; v.picked_name = ''; } });
    const owner = DB.users.find(u => DB.admins.includes(u.id)), domain = ((owner && owner.email) || '@demo.app').split('@')[1], s1 = DB.shops[0];
    if (!DB.staff.some(x => (x.perms || []).includes('warehouse')) && !DB.users.some(u => u.email === 'store@' + domain)) {
      const u = { id: uuid(), email: 'store@' + domain, password: '123456' }; DB.users.push(u);
      DB.staff.push({ id: uuid(), email: u.email, user_id: u.id, name: 'يوسف (المخزن)', perms: ['warehouse'], branch_id: s1 ? s1.id : null, active: true, max_discount: null,
        created_at: new Date(Date.now() - 4000 * 60000).toISOString(), ai_on: false, ai_perms: [] });
    }
    DB.picks = 1;
  }
  /* the shops' cards: two with a photo, the rest on one of the six backgrounds */
  function demoCards(DB) {
    const look = { '0925551234': ['img/parts/engine-oil.jpg', 'b1'], '0913334455': ['', 'b3'], '0926667788': ['img/parts/radiator.jpg', 'b5'], '0945556677': ['', 'b4'], '0947778899': ['', 'b6'] };
    DB.customers.forEach(c => { const l = look[c.phone]; if (l && c.shop_cover == null && c.shop_bg == null) { c.shop_cover = l[0]; c.shop_bg = l[1]; } });
    DB.mcards = 1;
  }
  function seedCompany(DB) {
    const C = window.SPARAT_CONFIG || {}, app = C.appName || 'CROSSKY', email = C.demoEmail || 'owner@demo.app';
    const owner = { id: uuid(), email, password: '123456' };
    DB.users.push(owner); DB.admins.push(owner.id);
    const ago = m => new Date(Date.now() - m * 60000).toISOString();
    Object.assign(DB.settings, {
      brand_name: app, tagline: 'قطع غيار السيارات الكورية واليابانية', hero_title: 'قطع الكوري والياباني… كلها عندنا',
      hero_sub: 'أصلي وتجاري بأسعار الجملة والقطاعي، مع التوصيل لكل المدن الليبية.',
      about: app + ' شركة متخصصة في قطع غيار السيارات الكورية واليابانية: هيونداي، كيا، تويوتا، نيسان، ميتسوبيشي وغيرها.\n\nنوفر القطع الأصلية والتجارية بضمان، ونخدم الزبائن والورش والتجار في كل ليبيا.',
      contact_wa: '0912345678', contact_phone: '0912345678', address: 'طرابلس – طريق المطار', price_mode: 'all', orders_enabled: true, open_signup: false, brands: [], ads: demoAds(),
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
    /* an edition that starts empty (config demoEmpty): the accounts, branches, merchants and settings, no goods and nothing sold */
    if (C.demoEmpty) {
      const domain = email.split('@')[1] || 'demo.app', seller = { id: uuid(), email: 'seller@' + domain, password: '123456' };
      DB.users.push(seller);
      DB.staff.push({ id: uuid(), email: seller.email, user_id: seller.id, name: 'أحمد (بائع)', perms: ['sales', 'returns', 'discounts'], branch_id: s1.id, active: true, max_discount: 10, created_at: ago(5000) });
      const cu = (name, shop, phone, city, approved, m, login) => { const id = uuid(); DB.users.push({ id, email: login || 'c' + DB.users.length + '@demo.app', password: login ? '123456' : uuid() });
        DB.customers.push({ user_id: id, name, shop_name: shop, phone, city, approved, created_at: ago(m) }); return id; };
      cu('علي النوري', 'ورشة النور للصيانة', '0925551234', 'طرابلس', true, 3000, DEMO_MERCHANT);
      cu('محمد سالم', 'محل سالم لقطع الغيار', '0947778899', 'بنغازي', false, 200);
      demoShops(DB); demoPicks(DB);
      DB.merchants = 1; DB.makers = 1; DB.emptied = 1;
      return;
    }
    const imgBase = C.demoImgBase == null ? 'img/parts/' : C.demoImgBase;
    const DESCR = 'القطعة جديدة في الكرتونة، وعليها ضمان من الشركة. التوصيل متاح لكل المدن.';
    P.forEach(([s, sku, title, cat, cond, price, qty, make, model, yf, yt, pn], i) => DB.products.push({
      id: uuid(), shop_id: s.id, owner_id: owner.id, sku, title, cat, cond, price, nego: i % 4 === 0, qty, make, model, y_from: yf, y_to: yt, part_no: pn, maker: MAKER[sku] || '',
      descr: DESCR, imgs: PART_IMG[sku] && imgBase ? [imgBase + PART_IMG[sku] + '.jpg'] : [art(cat, i), art(cat, i + 2)],
      status: qty === 0 ? 'sold' : 'active', hide_price: i === 6 || i === 9, search_text: '', created_at: ago(40 + i * 97), updated_at: ago(3)
    }));
    /* the edition's own parts with real photos (config demoExtra, from tools/build_company.py --demo-extra): listed first */
    (Array.isArray(C.demoExtra) ? C.demoExtra : []).forEach((x, k) => x && x.sku && x.title && DB.products.push({
      id: uuid(), shop_id: s1.id, owner_id: owner.id, sku: String(x.sku), title: String(x.title), cat: x.cat || 'other', cond: x.cond || 'original', maker: String(x.maker || '').slice(0, 60),
      price: x.price == null ? null : +x.price, nego: false, qty: x.qty == null ? 10 : +x.qty, make: x.make || 'any', model: x.model || '', y_from: +x.y_from || null, y_to: +x.y_to || null,
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
    DB.staff.push({ id: uuid(), email: seller.email, user_id: seller.id, name: 'أحمد (بائع)', perms: ['sales', 'returns', 'discounts'], branch_id: s1.id, active: true, max_discount: 10, created_at: ago(5000) });
    /* sales: [branch, seller, seller name, [[part, qty]], payment, minutes ago, customer, phone, paid, returned] */
    [[s1, seller, 'أحمد (بائع)', [[0, 2], [3, 4]], 'cash', 1500], [s1, owner, email, [[13, 1]], 'card', 700],
      [s2, owner, email, [[4, 2], [8, 3]], 'credit', 60, 'ورشة النور للصيانة', '0925551234', 0],
      [s1, owner, email, [[1, 1], [7, 2]], 'credit', 4300, 'ورشة الفجر', '0913334455', 200],
      [s1, seller, 'أحمد (بائع)', [[14, 2], [15, 1]], 'cash', 2900, 'سالم علي', '0925550000'],
      [s3, owner, email, [[10, 1], [2, 1]], 'transfer', 7000],
      [s1, owner, email, [[0, 1]], 'cash', 9000, '', '', null, true]].forEach(([sh, who, name, lines, pay, m, cust, phone, paid, ret]) => {
      const id = uuid(); let sub = 0;
      lines.forEach(([i, q]) => { const pr = DB.products[i]; sub += pr.price * q; if (pr.qty != null && !ret) pr.qty -= q; DB.invoice_items.push({ id: DB.invoice_items.length + 1, invoice_id: id, product_id: pr.id, sku: pr.sku, title: pr.title, maker: pr.maker || '', qty: q, price: pr.price, cost: pr.cost, line_total: pr.price * q }); });
      DB.invoices.push({ id, no: ++DB.inv_seq, branch_id: sh.id, staff_id: who.id, staff_name: name, customer_id: null, customer_name: cust || '', customer_phone: phone || '',
        subtotal: sub, discount: 0, total: sub, paid: paid != null ? paid : pay === 'credit' ? 0 : sub, payment: pay, currency: 'LYD', status: ret ? 'returned' : 'done', note: '',
        created_at: ago(m), returned_at: ret ? ago(m - 100) : null });
    });
    DB.invoices.sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach((v, k) => { v.no = 1001 + k; });
    /* the money side: a payment from a customer, a receipt half on credit and a payment to that supplier, expenses, damaged and lost stock */
    DB.customer_payments.push({ id: ++DB.pay_seq, cust_key: 'p:925551234', customer_name: 'ورشة النور للصيانة', amount: 150, staff_id: owner.id, staff_name: email, note: 'كاش', created_at: ago(30) });
    DB.purchases[0].paid = 3000;
    const tid = uuid(), tc = [[4, 10], [9, 2]];
    DB.purchases.push({ id: tid, no: ++DB.pur_seq, branch_id: s2.id, staff_id: owner.id, staff_name: email, supplier: 'مؤسسة طوكيو لقطع الغيار', note: '', items_count: tc.length,
      total: tc.reduce((k, [i, q]) => k + DB.products[i].cost * q, 0), paid: null, created_at: ago(5000) });
    tc.forEach(([i, q]) => DB.purchase_items.push({ id: DB.purchase_items.length + 1, purchase_id: tid, product_id: DB.products[i].id, code: DB.products[i].sku, title: DB.products[i].title, qty: q, cost: DB.products[i].cost }));
    DB.purchases.sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach((v, k) => { v.no = k + 1; });
    DB.supplier_payments.push({ id: ++DB.pay_seq, supplier: 'الشركة الكورية للتوريد', amount: 1000, staff_id: owner.id, staff_name: email, note: 'تحويل', created_at: ago(1500) });
    const day = m => { const d = new Date(Date.now() - m * 60000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    [['transport', 120, 'شحن طلبية بنغازي', 1440], ['utilities', 180, 'فاتورة الكهرباء', 5760], ['maintenance', 90, 'صيانة الرف', 8640]].forEach(([cat, amount, note, m]) =>
      DB.expenses.push({ id: ++DB.exp_seq, branch_id: s1.id, cat, amount, spent_on: day(m), note, staff_id: owner.id, staff_name: email, created_at: ago(m) }));
    [[8, -3, 'damaged', 'كرتونة مبلولة', 2000], [3, -2, 'lost', 'ناقصة في الجرد', 3500]].forEach(([i, q, reason, note, m]) => {
      const pr = DB.products[i]; pr.qty += q;
      DB.stock_moves.push({ id: ++DB.move_seq, product_id: pr.id, title: pr.title, branch_id: pr.shop_id, staff_id: owner.id, staff_name: email, qty: q, reason, cost: pr.cost, note, created_at: ago(m) });
    });
    /* merchants: the approved one signs in with his phone number (0925551234, password 123456) and has an invoice sent to him */
    const cu = (name, shop, phone, city, approved, m, login) => { const id = uuid(); DB.users.push({ id, email: login || 'c' + DB.users.length + '@demo.app', password: login ? '123456' : uuid() });
      DB.customers.push({ user_id: id, name, shop_name: shop, phone, city, approved, created_at: ago(m) }); return id; };
    const nour = cu('علي النوري', 'ورشة النور للصيانة', '0925551234', 'طرابلس', true, 3000, DEMO_MERCHANT);
    cu('محمد سالم', 'محل سالم لقطع الغيار', '0947778899', 'بنغازي', false, 200);
    const sent = DB.invoices.find(v => v.customer_phone === '0925551234');
    if (sent) { sent.customer_id = nour; sent.sent_at = ago(50); }
    demoShops(DB); demoPicks(DB);
    DB.merchants = 1; DB.makers = 1;
    /* the activity log of everything above, as the database writes it (supabase/setup.sql section 12) */
    const L = [], who = id => id === owner.id ? email : (DB.staff.find(x => x.user_id === id) || {}).name || '';
    const add = (at, actor, kind, ref, title, amount, detail) => L.push({ created_at: at, actor_id: actor, actor_name: who(actor), kind, ref, title: title || '', amount: amount == null ? null : amount, detail });
    add(ago(5000), owner.id, 'staff', DB.staff[0].id, DB.staff[0].name, null, { email: DB.staff[0].email, perms: DB.staff[0].perms, active: true, max_discount: 10, new: true });
    DB.purchases.forEach(v => { const it = DB.purchase_items.filter(i => i.purchase_id === v.id);
      add(v.created_at, v.staff_id, 'receive', v.id, v.supplier, v.total, { no: v.no, units: it.reduce((k, i) => k + i.qty, 0), new: 0, updated: it.length, paid: v.paid == null ? null : v.paid, source: 'scan', auto: false, lines: it.map(i => [i.title, i.qty, i.cost]) }); });
    DB.invoices.forEach(v => { const it = DB.invoice_items.filter(i => i.invoice_id === v.id);
      add(v.created_at, v.staff_id, 'sale', v.id, v.customer_name, v.total, { no: v.no, units: it.reduce((k, i) => k + i.qty, 0), lines: it.length, discount: 0, off_list: 0, payment: v.payment, paid: v.paid });
      if (v.status === 'returned') add(v.returned_at, v.staff_id, 'return', v.id, v.customer_name, v.total, { no: v.no }); });
    if (sent) add(sent.sent_at, owner.id, 'invoice_sent', sent.id, 'ورشة النور للصيانة', sent.total, { no: sent.no, phone: '0925551234', again: false });
    DB.customer_payments.forEach(x => add(x.created_at, x.staff_id, 'pay_in', String(x.id), x.customer_name, x.amount, { note: x.note, by: x.staff_name, key: x.cust_key }));
    DB.supplier_payments.forEach(x => add(x.created_at, x.staff_id, 'pay_out', String(x.id), x.supplier, x.amount, { note: x.note, by: x.staff_name }));
    DB.expenses.forEach(x => add(x.created_at, x.staff_id, 'expense', String(x.id), x.cat, x.amount, { note: x.note, by: x.staff_name, day: x.spent_on }));
    DB.stock_moves.forEach(x => { const pr = DB.products.find(y => y.id === x.product_id);
      add(x.created_at, x.staff_id, 'stock', x.product_id, x.title, x.cost == null ? null : x.qty * x.cost, { from: pr.qty - x.qty, to: pr.qty, reason: x.reason, note: x.note }); });
    L.sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach((x, k) => { x.id = k + 1; DB.activity.push(x); });
    DB.act_seq = L.length;
  }

  function create(opts) {
    opts = opts || {};
    let DB = null;
    if (opts.persist) { try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; } }
    if (!DB) { DB = blank(); if (opts.seed && (window.SPARAT_CONFIG || {}).mode === 'company') seedCompany(DB); }
    /* a phone that already had the demo before the ads came gets the edition's ads once (an owner who deleted them keeps none) */
    const hadAds = !!(DB.settings && Object.prototype.hasOwnProperty.call(DB.settings, 'ads'));
    DB = Object.assign(blank(), DB); DB.settings = Object.assign(blank().settings, DB.settings);
    const migrate = !hadAds && !!opts.seed && CONF.mode === 'company' && DB.users.length > 0;
    if (!hadAds && opts.seed && CONF.mode === 'company') DB.settings.ads = demoAds();
    /* and the edition's own parts that came later (found by their code) */
    if (migrate && DB.shops.length) {
      const s1 = DB.shops[0], owner = s1.owner_id;
      (Array.isArray(CONF.demoExtra) ? CONF.demoExtra : []).forEach(x => x && x.sku && x.title && !DB.products.some(p => p.sku === String(x.sku)) && DB.products.push({
        id: uuid(), shop_id: s1.id, owner_id: owner, sku: String(x.sku), title: String(x.title), cat: x.cat || 'other', cond: x.cond || 'original',
        price: x.price == null ? null : +x.price, cost: x.price == null ? null : Math.round(+x.price * 0.72), nego: false, qty: x.qty == null ? 10 : +x.qty, make: x.make || 'any', model: x.model || '',
        y_from: +x.y_from || null, y_to: +x.y_to || null, part_no: x.part_no || String(x.sku), descr: x.descr || '', imgs: Array.isArray(x.imgs) ? x.imgs.slice(0, 6) : [], status: 'active',
        hide_price: false, barcode: null, search_text: '', created_at: now(), updated_at: now() }));
    }
    let merch = false;
    if (!DB.makers && opts.seed && CONF.mode === 'company') {
      merch = true; DB.makers = 1;
      const extra = {}; (Array.isArray(CONF.demoExtra) ? CONF.demoExtra : []).forEach(x => { if (x && x.sku && x.maker) extra[x.sku] = String(x.maker); });
      DB.products.forEach(p => { if (p.maker == null || p.maker === '') { const m = MAKER[p.sku] || extra[p.sku]; p.maker = m || ''; if (m) p.search_text = ''; } });
      DB.invoice_items.forEach(i => { if (i.maker == null) { const pr = DB.products.find(x => x.id === i.product_id); i.maker = (pr && pr.maker) || ''; } });
    }
    if (!DB.merchants && opts.seed && CONF.mode === 'company' && DB.users.length > 0) {
      merch = true; DB.merchants = 1;
      DB.customers.forEach(c => { if (c.shop_name == null) c.shop_name = ''; });
      const nour = DB.customers.find(c => c.phone === '0925551234' && c.name === 'ورشة النور للصيانة'), salem = DB.customers.find(c => c.phone === '0947778899' && !c.shop_name);
      if (salem) salem.shop_name = 'محل سالم لقطع الغيار';
      const u = nour && DB.users.find(x => x.id === nour.user_id);
      if (u && !DB.users.some(x => x.email === DEMO_MERCHANT)) {
        Object.assign(nour, { name: 'علي النوري', shop_name: 'ورشة النور للصيانة' }); Object.assign(u, { email: DEMO_MERCHANT, password: '123456' });
        const v = DB.invoices.find(x => x.customer_phone === '0925551234' && !x.customer_id && x.status === 'done');
        if (v) { v.customer_id = u.id; v.sent_at = new Date(Date.now() - 50 * 60000).toISOString(); }
      }
    } else if (!DB.merchants) DB.merchants = 1;
    if (!DB.mshops && opts.seed && CONF.mode === 'company' && DB.users.length > 0) demoShops(DB);
    else if (!DB.mshops) DB.mshops = 1;
    if (!DB.mcards && opts.seed && CONF.mode === 'company' && DB.users.length > 0) demoCards(DB);
    else if (!DB.mcards) DB.mcards = 1;
    if (!DB.picks && opts.seed && CONF.mode === 'company' && DB.users.length > 0) demoPicks(DB);
    else if (!DB.picks) DB.picks = 1;
    /* some of the parts back from a sale, and what an app order did not find on the shelf (supabase/setup.sql return_items, pick_done) */
    if (!DB.invoice_returns) DB.invoice_returns = [];
    /* an edition that starts empty (config demoEmpty): a phone that had the sample goods loses them once, with every sale, purchase,
       return, payment, expense and stock change and the log of them; the accounts, Face ID, branches, merchants and settings stay */
    let emptied = false;
    if (CONF.demoEmpty && !DB.emptied && opts.seed && CONF.mode === 'company') {
      const b = blank();
      ['products', 'invoices', 'invoice_items', 'purchases', 'purchase_items', 'stock_moves', 'customer_payments', 'supplier_payments', 'expenses', 'activity', 'price_changes', 'ai_turns']
        .forEach(k => { DB[k] = []; });
      DB.invoice_returns = [];
      Object.assign(DB, { inv_seq: b.inv_seq, pur_seq: b.pur_seq, move_seq: b.move_seq, pay_seq: b.pay_seq, exp_seq: b.exp_seq, act_seq: b.act_seq, batch_seq: b.batch_seq, emptied: 1 });
      try { localStorage.removeItem('sp_cart'); localStorage.removeItem('sp_favs'); sessionStorage.removeItem('sp_pos'); sessionStorage.removeItem('sp_rcv'); } catch (e) { /* no storage */ }
      emptied = true;
    }
    /* every car brand in the world now: a demo saved with only the Korean and Japanese ones shows them all */
    if (!DB.allBrands) {
      DB.allBrands = 1;
      const kj = new Set((window.SP_DATA ? window.SP_DATA.BRANDS : []).filter(b => b.origin === 'KR' || b.origin === 'JP').map(b => b.id)), cur = DB.settings && DB.settings.brands;
      if (CONF.mode === 'company' && Array.isArray(cur) && cur.length && cur.every(id => kj.has(id))) DB.settings.brands = [];
    }
    window.__mockdb = DB;
    let session = null; const listeners = [];
    try { const s = opts.persist && JSON.parse(localStorage.getItem(KEY + '_session') || 'null'); if (s && DB.users.some(u => u.id === s.user.id)) session = s; } catch (e) { /* signed out */ }
    function save() {
      if (!opts.persist) return;
      try { localStorage.setItem(KEY, JSON.stringify(DB)); localStorage.setItem(KEY + '_session', JSON.stringify(session)); } catch (e) { /* storage full: keep working in memory */ }
    }
    if (migrate || merch || emptied) save();
    const later = v => new Promise(r => setTimeout(() => r(v), 15));
    const uid = () => session && session.user.id;
    const isAdmin = () => !!uid() && DB.admins.includes(uid());
    const staffRow = () => DB.staff.find(x => x.user_id && x.user_id === uid() && x.active);
    const PERMS_ALL = ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'purchases', 'customers', 'reports', 'costs', 'expenses', 'settings', 'warehouse'];
    const aiAccess = () => {
      if (!uid()) return { ok: false, role: 'visitor' };
      if (isAdmin()) return { ok: true, role: 'admin', perms: PERMS_ALL.slice() };
      const on = staffRow();
      if (on) return on.ai_on ? { ok: true, role: 'staff', perms: (on.ai_perms || []).filter(x => on.perms.includes(x)) } : { ok: false, role: 'staff' };
      return DB.settings.ai_customers ? { ok: true, role: 'customer', perms: [] } : { ok: false, role: 'customer' };
    };
    const tripoliDay = (k) => { const d = new Date(Date.now() + (k || 0) * 864e5); try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tripoli' }).format(d); } catch (e) { return d.toISOString().slice(0, 10); } };
    const hasPerm = p => isAdmin() || !!(staffRow() && staffRow().perms.includes(p));
    const isStaff = () => isAdmin() || !!staffRow();
    const fail = (m, code) => { throw Object.assign(new Error(m), { code: code || 'P0001' }); };
    const emit = ev => listeners.forEach(f => { try { f(ev, session); } catch (e) { console.error(e); } });
    const rls = () => ({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' } });
    const otpLogin = (email, phone) => email ? String(email).trim().toLowerCase() : phone ? String(phone).replace(/\D/g, '') + '@' + (CONF.phoneDomain || 'phone.invalid') : '';

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
      /* A forgotten password: a 6-digit code by email or SMS (Supabase Auth's signInWithOtp / verifyOtp, the code living 90 seconds
         as the server is set). Nothing can be sent from the demo, so the code comes back for the screen to show (demo_code). */
      async signInWithOtp({ email, phone, options }) {
        const login = otpLogin(email, phone), u = login && DB.users.find(x => x.email === login);
        if (!u) return { data: { user: null, session: null }, error: { message: 'Signups not allowed for otp', status: 422 } };
        DB.otps = DB.otps || {};
        const o = DB.otps[login];
        if (o && Date.now() - o.at < 60000) return { data: { user: null, session: null }, error: { message: 'For security purposes, you can only request this after ' + Math.ceil((60000 - (Date.now() - o.at)) / 1000) + ' seconds.', status: 429 } };
        const code = String(100000 + Math.floor(Math.random() * 900000));
        DB.otps[login] = { code, at: Date.now(), exp: Date.now() + 90000, tries: 0 }; save();
        return { data: { user: null, session: null, demo_code: code }, error: null };
      },
      async verifyOtp({ email, phone, token }) {
        const login = otpLogin(email, phone), o = DB.otps && DB.otps[login];
        const bad = { data: { user: null, session: null }, error: { message: 'Token has expired or is invalid', status: 403 } };
        if (!o || Date.now() > o.exp) return bad;
        if (String(token || '').trim() !== o.code) { if (++o.tries >= 5) delete DB.otps[login]; save(); return bad; }
        delete DB.otps[login];
        const u = DB.users.find(x => x.email === login);
        if (!u) return bad;
        session = { user: { id: u.id, email: u.email }, access_token: 'demo' }; save(); setTimeout(() => emit('SIGNED_IN'));
        return { data: { user: session.user, session }, error: null };
      },
      async updateUser({ password }) {
        if (!session) return { data: null, error: { message: 'not authorized' } };
        const u = DB.users.find(x => x.id === uid()); if (u && password) u.password = password; save();
        return { data: { user: session.user }, error: null };
      },
      /* Passkeys (Face ID, Touch ID, a fingerprint): the same calls as supabase-js 2.105+ (auth.passkey.*). The ceremony is the
         browser's own; this side checks the challenge, the page's origin, the site's hash and that the person was verified. */
      passkey: {
        async startRegistration() {
          if (!session) return pkErr('not signed in', 'not_authenticated');
          const id = uuid(), challenge = pkRand();
          pkChallenges.set(id, { challenge, kind: 'reg', user: uid(), exp: Date.now() + 5 * 60e3 });
          return later({ data: { challenge_id: id, expires_at: new Date(Date.now() + 5 * 60e3).toISOString(), options: {
            challenge, rp: { id: location.hostname, name: CONF.appName || 'Sparat' },
            user: { id: b64uEnc(new TextEncoder().encode(uid())), name: session.user.email, displayName: session.user.email },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: 60000, attestation: 'none',
            authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
            excludeCredentials: DB.passkeys.filter(p => p.user_id === uid()).map(p => ({ type: 'public-key', id: p.credential_id })) } }, error: null });
        },
        async verifyRegistration({ challengeId, credential }) {
          const c = pkTake(challengeId, 'reg');
          if (c.error) return c;
          if (!session || uid() !== c.user) return pkErr('not signed in', 'not_authenticated');
          const cd = pkClient(credential, 'webauthn.create', c.challenge);
          if (!cd) return pkErr('verification failed', 'webauthn_verification_failed');
          if (DB.passkeys.some(p => p.credential_id === credential.id)) return pkErr('already registered', 'webauthn_credential_exists');
          const p = { id: uuid(), credential_id: credential.id, user_id: c.user, friendly_name: pkDevice(), created_at: now(), last_used_at: null };
          DB.passkeys.push(p); save();
          return { data: { id: p.id, friendly_name: p.friendly_name, created_at: p.created_at }, error: null };
        },
        async startAuthentication() {
          const id = uuid(), challenge = pkRand();
          pkChallenges.set(id, { challenge, kind: 'login', exp: Date.now() + 5 * 60e3 });
          return later({ data: { challenge_id: id, expires_at: new Date(Date.now() + 5 * 60e3).toISOString(),
            options: { challenge, rpId: location.hostname, timeout: 60000, userVerification: 'required', allowCredentials: [] } }, error: null });
        },
        async verifyAuthentication({ challengeId, credential }) {
          const c = pkTake(challengeId, 'login');
          if (c.error) return c;
          if (!pkClient(credential, 'webauthn.get', c.challenge)) return pkErr('verification failed', 'webauthn_verification_failed');
          const ad = new Uint8Array(b64uDec(credential.response.authenticatorData || ''));
          const site = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(location.hostname)));
          /* the site's hash, the person present (UP) and verified by Face ID or the fingerprint (UV) */
          if (ad.length < 37 || site.some((b, i) => b !== ad[i]) || (ad[32] & 0x05) !== 0x05) return pkErr('verification failed', 'webauthn_verification_failed');
          const p = DB.passkeys.find(x => x.credential_id === credential.id), u = p && DB.users.find(x => x.id === p.user_id);
          if (!u) return pkErr('credential not found', 'webauthn_credential_not_found');
          p.last_used_at = now();
          session = { user: { id: u.id, email: u.email }, access_token: 'demo' }; save(); setTimeout(() => emit('SIGNED_IN'));
          return { data: { user: session.user, session }, error: null };
        },
        async list() {
          return later({ data: session ? DB.passkeys.filter(p => p.user_id === uid()).map(p => ({ id: p.id, friendly_name: p.friendly_name, created_at: p.created_at, last_used_at: p.last_used_at })) : [], error: null });
        },
        async delete({ passkeyId }) {
          if (!session) return pkErr('not signed in', 'not_authenticated');
          DB.passkeys = DB.passkeys.filter(p => !(p.id === passkeyId && p.user_id === uid())); save();
          return { data: null, error: null };
        }
      }
    };
    /* passkey helpers: base64url, one-use challenges, the client data check, the device's name */
    const pkChallenges = new Map();
    const b64uEnc = b => { let x = ''; new Uint8Array(b).forEach(c => { x += String.fromCharCode(c); }); return btoa(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
    const b64uDec = v => Uint8Array.from(atob(String(v).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(v).length + 3) % 4)), c => c.charCodeAt(0)).buffer;
    const pkRand = () => b64uEnc(crypto.getRandomValues(new Uint8Array(32)));
    const pkErr = (message, code) => ({ data: null, error: { message, code, name: 'AuthApiError' } });
    function pkTake(id, kind) {
      const c = pkChallenges.get(id); pkChallenges.delete(id);
      if (!c || c.kind !== kind) return pkErr('challenge not found', 'webauthn_challenge_not_found');
      if (Date.now() > c.exp) return pkErr('challenge expired', 'webauthn_challenge_expired');
      return c;
    }
    function pkClient(cred, type, challenge) {
      try {
        const cd = JSON.parse(new TextDecoder().decode(b64uDec(cred.response.clientDataJSON)));
        return cd.type === type && cd.challenge === challenge && cd.origin === location.origin ? cd : null;
      } catch (e) { return null; }
    }
    const pkDevice = () => { const ua = navigator.userAgent || ''; return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Browser'; };

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
        const row = { id: uuid(), price: null, qty: null, nego: false, make: 'any', model: '', y_from: null, y_to: null, part_no: '', maker: '', descr: '', imgs: [], status: 'active', sku: null, hide_price: false, ...v, owner_id: s.owner_id, created_at: now(), updated_at: now() };
        if (row.y_from && row.y_to && row.y_from > row.y_to) [row.y_from, row.y_to] = [row.y_to, row.y_from];
        return { row };
      }
      if (name === 'customers') {
        if (DB.customers.some(c => c.user_id === uid())) return { error: { message: 'duplicate key', code: '23505' } };
        if (String(v.shop_name || '').length > 80) return { error: { message: 'new row for relation "customers" violates check constraint "customers_shop_name_check"', code: '23514' } };
        return { row: { phone: '', city: '', shop_name: '', phone_public: false, ...v, user_id: uid(), approved: false, shop_on: false, created_at: now() } };
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
      if (name === 'customers' && 'shop_name' in v && String(v.shop_name || '').length > 80) return { error: { message: 'new row for relation "customers" violates check constraint "customers_shop_name_check"', code: '23514' } };
      /* the shop's card: his own uploaded photo, or one of six backgrounds (customers_shop_cover_chk, customers_shop_bg_chk) */
      if (name === 'customers' && 'shop_bg' in v && !['', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'].includes(v.shop_bg)) return { error: { message: 'new row for relation "customers" violates check constraint "customers_shop_bg_chk"', code: '23514' } };
      if (name === 'customers' && v.shop_cover && !/^(data:image\/(jpeg|png|webp);base64,|https:\/\/)/.test(String(v.shop_cover))) return { error: { message: 'new row for relation "customers" violates check constraint "customers_shop_cover_chk"', code: '23514' } };
      if (name === 'customers' && !hasPerm('customers')) {
        delete v.approved; delete v.user_id; delete v.shop_on; // only the company shows a merchant's shop
        /* an approved merchant sees every sale under his number: a new number needs the company's approval again */
        if ('phone' in v && custKey('', v.phone) !== custKey('', r.phone)) v.approved = false;
      }
      if (name === 'settings' && 'ads' in v && !adsOk(v.ads)) return { error: { message: 'new row for relation "settings" violates check constraint "settings_ads_chk"', code: '23514' } };
      if (name === 'settings' && (('ai_daily' in v && !(Number.isInteger(+v.ai_daily) && +v.ai_daily >= 5 && +v.ai_daily <= 1000)) || ('ai_rules' in v && String(v.ai_rules || '').length > 3000) || ('ai_name' in v && String(v.ai_name || '').length > 40)))
        return { error: { message: 'new row for relation "settings" violates check constraint "settings_ai_check"', code: '23514' } };
      if (name !== 'customers') v.updated_at = now();
      return { vals: v };
    }
    function run(q) {
      const rows = q.name === 'settings' ? [DB.settings] : DB[q.name];
      const match = r => q.filters.every(([k, v]) => String(r[k]) === String(v));
      let out = [];
      if (q.op === 'select') out = rows.filter(r => match(r) && canRead(q.name, r));
      else if (q.op === 'insert') {
        const r = insertRow(q.name, q.vals); if (!r.row) return r; rows.push(r.row); out = [r.row];
        if (q.name === 'products') logAct('product_add', r.row.id, r.row.title, r.row.price, { qty: r.row.qty, cost: r.row.cost, code: r.row.sku || r.row.part_no || undefined });
      } else if (q.op === 'update') {
        for (const r of rows.filter(match)) {
          if (!canWrite(q.name, r)) continue;
          const u = updateVals(q.name, r, q.vals);
          if (u.error) return u;
          const before = clone(r);
          Object.assign(r, u.vals); out.push(r);
          logEdit(q.name, before, r);
        }
      } else if (q.op === 'delete') {
        rows.filter(match).forEach(r => {
          if (!canWrite(q.name, r)) return;
          rows.splice(rows.indexOf(r), 1); out.push(r);
          if (q.name === 'products') logAct('product_del', r.id, r.title, r.price, { qty: r.qty, code: r.sku || r.part_no || undefined });
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
    const text = p => p.search_text || (window.SP && window.SP.searchText ? window.SP.searchText(p) : norm([p.title, p.part_no, p.sku, p.maker, p.make, brandWords(p.make), p.model, p.descr].join(' ')));
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
            nego: false, qty, make: make || 'any', model: r.model || '', y_from: null, y_to: null, part_no: r.part_no || sku, maker: String(r.maker || '').trim().slice(0, 60), location: String(r.location || '').trim().slice(0, 60), descr: '', imgs: [],
            status: qty != null && qty <= 0 ? 'sold' : 'active', hide_price: false, search_text: '', created_at: now(), updated_at: now() });
          sum.inserted++;
        } else {
          if (title.length >= 2) p.title = title;
          if ('location' in r) p.location = String(r.location || '').trim().slice(0, 60);
          if ('price' in r) p.price = price != null && price >= 0 ? price : null;
          if ('qty' in r) { p.qty = qty; if (qty != null) p.status = qty <= 0 ? 'sold' : 'active'; }
          if (make) p.make = make; if ('model' in r) p.model = r.model || ''; if ('maker' in r) p.maker = String(r.maker || '').trim().slice(0, 60); if (cat) p.cat = cat; if (bar) p.barcode = bar;
          p.search_text = ''; p.updated_at = now();
          sum.updated++;
        }
      }
      save();
      return sum;
    }
    /* ---------- accounts helpers (supabase/setup.sql section 11) ---------- */
    const meName = () => { const st = DB.staff.find(x => x.user_id === uid()), cu = DB.customers.find(x => x.user_id === uid()), me = DB.users.find(u => u.id === uid());
      return (st && st.name) || (cu && cu.name) || (me && me.email) || ''; };
    /* one line in the activity log (supabase/setup.sql section 12: log_act and the triggers) */
    const logAct = (kind, ref, title, amount, detail) => DB.activity.push({ id: ++DB.act_seq, created_at: now(), actor_id: uid() || null, actor_name: meName(), kind,
      ref: String(ref == null ? '' : ref).slice(0, 80), title: String(title == null ? '' : title).slice(0, 200), amount: amount == null ? null : amount, detail: detail || {} });
    /* the parts of an order go back to stock (cancelled before it was received) */
    const restock = id => DB.invoice_items.filter(i => i.invoice_id === id).forEach(i => { const pr = DB.products.find(x => x.id === i.product_id); if (pr && pr.qty != null) { pr.qty += i.qty; if (pr.qty > 0) pr.status = 'active'; } });
    const LONG = ['about', 'bot_rules', 'bot_welcome', 'logo', 'brands', 'brand_logos', 'hero_sub', 'ads', 'ai_rules'];
    function logEdit(name, a, b) {
      const same = (x, y) => JSON.stringify(x == null ? null : x) === JSON.stringify(y == null ? null : y);
      if (name === 'settings') {
        const keys = Object.keys(b).filter(k => k !== 'updated_at' && !same(a[k], b[k])).sort();
        if (!keys.length) return;
        const changes = {}; keys.filter(k => !LONG.includes(k)).forEach(k => { changes[k] = [a[k] == null ? null : a[k], b[k] == null ? null : b[k]]; });
        logAct('settings', '', keys.join(','), null, { keys, changes });
      } else if (name === 'products') {
        const d = {};
        ['price', 'cost', 'qty', 'title', 'hide_price'].forEach(k => { if (!same(a[k], b[k])) d[k] = [a[k] == null ? null : a[k], b[k] == null ? null : b[k]]; });
        if (!same(a.status, b.status) && same(a.qty, b.qty)) d.status = [a.status, b.status];
        if (Object.keys(d).length) logAct('product_edit', b.id, b.title, null, d);
      } else if (name === 'customers' && !same(a.approved, b.approved)) logAct('customer', b.user_id, b.name || b.phone, null, { approved: !!b.approved, phone: b.phone });
    }
    /* one customer = one phone (its last 9 digits), or the name when there is no phone; one supplier = one name, spelled loosely */
    const custKey = (name, phone) => { const d = norm(phone).replace(/[^0-9]/g, ''); if (d.length >= 7) return 'p:' + d.slice(-9); const n = String(name || '').trim(); return n ? 'n:' + norm(n).slice(0, 80) : null; };
    const supKey = name => norm(String(name || '').trim()).slice(0, 120) || null;
    const dayOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const money2 = v => Math.round(v * 100) / 100, numOf = v => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return isFinite(x) ? x : null; };
    const newest = (x, y) => String(y.created_at).localeCompare(String(x.created_at)) || (y.id > x.id ? 1 : y.id < x.id ? -1 : 0);
    const owingFirst = (x, y) => (y.balance > 0) - (x.balance > 0) || y.last_at.localeCompare(x.last_at) || x.key.localeCompare(y.key);
    const page = (l, a, d) => { const off = a.p_offset || 0; return l.slice(off, off + Math.min(Math.max(a.p_limit || d, 1), 100)); };
    /* merchants (setup.sql section 16): the invoices sent to his account and his received orders, and once the company has
       approved him every sale under his number; his payments and what he owes only once approved */
    function merchantInvoices(user) {
      const c = DB.customers.find(x => x.user_id === user), k = c && c.approved ? custKey('', c.phone) : null;
      return DB.invoices.filter(v => (v.customer_id === user && (v.sent_at || v.status === 'done' || v.status === 'returned'))
        || (!!k && k.startsWith('p:') && (v.status === 'done' || v.status === 'returned') && custKey(v.customer_name, v.customer_phone) === k));
    }
    function merchantSums(c) {
      const k = custKey('', c.phone), d = merchantInvoices(c.user_id).filter(v => v.status === 'done');
      const due = d.reduce((x, v) => x + Math.max(v.total - v.paid, 0), 0);
      const paid = c.approved && k && k.startsWith('p:') ? DB.customer_payments.filter(p => p.cust_key === k).reduce((x, p) => x + p.amount, 0) : 0;
      return { bought: money2(d.reduce((x, v) => x + v.total, 0)), paid: money2(paid), balance: c.approved ? money2(due - paid) : null };
    }
    function merchantBook(user) {
      const c = DB.customers.find(x => x.user_id === user);
      if (!c) return null;
      const k = custKey('', c.phone), sums = merchantSums(c), units = id => DB.invoice_items.filter(i => i.invoice_id === id).reduce((x, i) => x + i.qty, 0);
      const showP = RPC.prices_shown(), hidden = id => DB.invoice_items.some(i => i.invoice_id === id && (DB.products.find(p => p.id === i.product_id) || {}).hide_price);
      const orders = DB.invoices.filter(v => v.customer_id === user && v.source === 'app')
        .sort((x, y) => String(y.ordered_at || '').localeCompare(String(x.ordered_at || '')) || y.no - x.no).slice(0, 100);
      return { user_id: c.user_id, shop_name: c.shop_name || '', name: c.name, phone: c.phone, city: c.city || '', approved: !!c.approved, created_at: c.created_at,
        bought: sums.bought, paid_later: sums.paid, open_orders: orders.filter(v => v.status === 'preparing' || v.status === 'ready').length, balance: sums.balance,
        invoices: merchantInvoices(user).sort((x, y) => String(y.sent_at || y.created_at).localeCompare(String(x.sent_at || x.created_at)) || y.no - x.no).slice(0, 100)
          .map(v => ({ id: v.id, no: v.no, status: v.status, source: v.source || 'pos', created_at: v.created_at, sent_at: v.sent_at || null, total: v.total, paid: v.paid,
            payment: v.payment, currency: v.currency, units: units(v.id) })),
        orders: orders.map(v => ({ id: v.id, no: v.no, status: v.status, ordered_at: v.ordered_at, currency: v.currency, units: units(v.id),
          total: isStaff() || (showP && !hidden(v.id)) ? v.total : null })),
        payments: c.approved && k && k.startsWith('p:') ? DB.customer_payments.filter(p => p.cust_key === k).sort(newest).slice(0, 100)
          .map(p => ({ id: p.id, amount: p.amount, note: p.note, created_at: p.created_at })) : [] };
    }
    const merchantHits = q => {
      q = String(q || '').trim(); const nq = norm(q); let d = nq.replace(/[^0-9]/g, ''); if (d.length > 9) d = d.slice(-9);
      return DB.customers.filter(c => !q || norm((c.shop_name || '') + ' ' + c.name).includes(nq) || (d.length >= 3 && norm(c.phone).replace(/[^0-9]/g, '').includes(d)));
    };
    const canOpen = v => hasPerm('invoices') || v.staff_id === uid() || (v.source === 'app' && hasPerm('sales'));
    const shopOrName = c => String(c.shop_name || '').trim() || c.name;
    /* a new invoice waits in the warehouse when someone prepares them there (an active employee with the permission, for its branch or all) */
    const pickWaits = b => DB.staff.some(x => x.active && (x.perms || []).includes('warehouse') && (!x.branch_id || x.branch_id === b)) ? 'waiting' : null;
    const pickOk = () => !!uid() && (isAdmin() || hasPerm('warehouse')), pickBranch = () => isAdmin() ? null : ((staffRow() || {}).branch_id || null);
    const shopShown = c => !!String(c.shop_name || '').trim() && (!!c.shop_on || !!DB.settings.open_shops) && !DB.admins.includes(c.user_id) && !DB.staff.some(x => x.user_id === c.user_id);
    const shopOut = c => ({ id: c.user_id, name: String(c.shop_name).trim(), city: c.city || '', phone: c.phone_public && c.phone ? c.phone : null, cover: c.shop_cover || '', bg: c.shop_bg || '' });
    function buyers() {
      const m = {};
      DB.invoices.filter(v => v.status === 'done').sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach(v => {
        const k = custKey(v.customer_name, v.customer_phone); if (!k) return;
        const b = m[k] = m[k] || { key: k, name: '', phone: '', count: 0, total: 0, due: 0, paid_later: 0, last_at: v.created_at };
        if (v.customer_name) b.name = v.customer_name; if (v.customer_phone) b.phone = v.customer_phone;
        b.count++; b.total += v.total; b.due += Math.max(v.total - v.paid, 0); b.last_at = v.created_at;
      });
      DB.customer_payments.forEach(p => { if (m[p.cust_key]) m[p.cust_key].paid_later += p.amount; });
      return Object.values(m).map(b => ({ ...b, name: b.name || b.phone, balance: money2(b.due - b.paid_later) }));
    }
    function suppliers() {
      const m = {};
      DB.purchases.slice().sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach(v => {
        const k = supKey(v.supplier); if (!k) return;
        const r = m[k] = m[k] || { key: k, name: '', count: 0, total: 0, due: 0, paid_later: 0, last_at: v.created_at };
        r.name = v.supplier.trim(); r.count++; r.total += v.total; r.due += v.total - (v.paid == null ? v.total : v.paid); r.last_at = v.created_at;
      });
      DB.supplier_payments.forEach(p => { const k = supKey(p.supplier); if (m[k]) m[k].paid_later += p.amount; });
      return Object.values(m).map(r => ({ ...r, balance: money2(r.due - r.paid_later) }));
    }
    const EXP_CATS = ['rent', 'salaries', 'utilities', 'transport', 'maintenance', 'other'];
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
          if (DB.settings.hide_qty && !(isStaff() || (uid() && uid() === p.owner_id))) r.qty = null;
          if (!(isStaff() || (uid() && uid() === p.owner_id))) r.location = '';
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
      sync_products(a) { if (!DB.sync_key || a.p_key !== DB.sync_key) throw Object.assign(new Error('invalid sync key'), { code: '42501' }); const r = upsert(a.p_rows, a.p_shop); logAct('sync', '', '', null, r); save(); return r; },
      my_perms() { const st = DB.staff.find(x => x.user_id && x.user_id === uid()), on = staffRow();
        return { admin: isAdmin(), staff: !!on, perms: on ? on.perms : [], branch: on ? on.branch_id : null, max_discount: on && on.max_discount != null ? on.max_discount : null, name: st ? st.name : null,
          ai: isAdmin() || !!(on && on.ai_on), ai_perms: isAdmin() ? PERMS_ALL.slice() : on && on.ai_on ? (on.ai_perms || []).filter(x => on.perms.includes(x)) : [] }; },
      save_staff(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const email = String(a.p_email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('invalid email', '22023');
        const ok = ['sales', 'invoices', 'returns', 'discounts', 'prices', 'products', 'customers', 'reports', 'costs', 'settings', 'purchases', 'expenses', 'warehouse'];
        const lim = a.p_max_discount == null || a.p_max_discount === '' ? null : Number(a.p_max_discount);
        if (lim != null && !(lim >= 0 && lim <= 100)) fail('bad discount limit', '22023');
        let r = DB.staff.find(x => x.email === email); const isNew = !r, was = r ? { perms: r.perms, active: r.active, max_discount: r.max_discount == null ? null : r.max_discount, ai_on: !!r.ai_on, ai_perms: r.ai_perms || [] } : null;
        if (!r) { r = { id: uuid(), email, user_id: (DB.users.find(u => u.email === email) || {}).id || null, created_at: now(), ai_on: false, ai_perms: [] }; DB.staff.push(r); }
        const before = JSON.stringify([r.name, r.perms, r.branch_id, r.active, r.max_discount == null ? null : r.max_discount, !!r.ai_on, r.ai_perms || []]);
        const perms = [...new Set((a.p_perms || []).filter(p => ok.includes(p)))];
        /* the assistant: null keeps what they have; what it may do stays within their own permissions */
        Object.assign(r, { name: String(a.p_name || '').slice(0, 80), perms, branch_id: a.p_branch || null, active: a.p_active !== false,
          max_discount: lim == null ? null : Math.round(lim * 100) / 100, ai_on: a.p_ai_on == null ? !!r.ai_on : !!a.p_ai_on,
          ai_perms: [...new Set((a.p_ai_perms == null ? r.ai_perms || [] : a.p_ai_perms).filter(p => perms.includes(p)))] });
        if (isNew || before !== JSON.stringify([r.name, r.perms, r.branch_id, r.active, r.max_discount, r.ai_on, r.ai_perms]))
          logAct('staff', r.id, r.name || r.email, null, { email: r.email, perms: r.perms, active: r.active, max_discount: r.max_discount, new: isNew, ai_on: r.ai_on, ai_perms: r.ai_perms, was });
        save(); return r;
      },
      delete_staff(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const r = DB.staff.find(x => x.id === a.p_id);
        if (r) { DB.staff = DB.staff.filter(x => x !== r); logAct('staff_del', r.id, r.name || r.email, null, { email: r.email, perms: r.perms, active: r.active, max_discount: r.max_discount == null ? null : r.max_discount, new: false, was: null }); }
        save(); return null;
      },
      get_invoice(a) {
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v || !uid() || !(hasPerm('invoices') || v.staff_id === uid() || (v.source === 'app' && hasPerm('sales')))) return null;
        const s = shopOf(v.branch_id);
        const mc = v.customer_id && DB.customers.find(c => c.user_id === v.customer_id);
        return { ...v, branch: s ? { id: s.id, name: s.name, city: s.city, area: s.area, phone: s.phone, whatsapp: s.whatsapp } : null,
          merchant: mc ? { user_id: mc.user_id, shop_name: mc.shop_name || '', name: mc.name, phone: mc.phone, approved: !!mc.approved } : null,
          items: DB.invoice_items.filter(i => i.invoice_id === v.id).map(i => { const o = { returned: 0, short: 0, ...i }; if (!hasPerm('costs')) delete o.cost; return o; }),
          refunded: v.refunded || 0, returns: (DB.invoice_returns || []).filter(r => r.invoice_id === v.id).map(r => { const o = { ...r }; delete o.staff_id; delete o.invoice_id; return o; }) };
      },
      create_invoice(a) {
        const p = a.p || {};
        if (!uid() || !hasPerm('sales')) fail('not authorized', '42501');
        const items = Array.isArray(p.items) ? p.items : [];
        if (!items.length || items.length > 200) fail('invoice needs 1 to 200 items', '22023');
        const st = staffRow(); let branch = (st && st.branch_id) || p.branch || null, sub = 0, list = 0, costSum = 0, units = 0;
        const pay = ['cash', 'card', 'transfer', 'credit'].includes(p.payment) ? p.payment : 'cash', lines = [], snap = DB.products.map(x => ({ id: x.id, qty: x.qty, status: x.status }));
        /* the owner's rules bind the staff, not the owner */
        const nbc = !isAdmin() && !!DB.settings.no_below_cost;
        try {
          for (const it of items) {
            const q = Math.floor(Number(it.qty) || 0), pr = DB.products.find(x => x.id === it.id);
            if (q < 1 || q > 100000) fail('bad quantity', '22023');
            if (!pr) fail('part not found');
            const price = hasPerm('prices') && it.price != null && it.price !== '' && isFinite(Number(it.price)) ? Number(it.price) : pr.price;
            if (price == null || price < 0) fail('part has no price: ' + pr.title);
            if (nbc && pr.cost != null && price < pr.cost) fail('below cost: ' + pr.title);
            if (pr.qty != null && pr.qty < q) fail('not enough stock: ' + pr.title + ' (available ' + pr.qty + ')');
            list += (pr.price != null ? pr.price : price) * q; costSum += (pr.cost || 0) * q; units += q;
            if (pr.qty != null) { pr.qty -= q; if (pr.qty <= 0) pr.status = 'sold'; }
            sub += price * q; branch = branch || pr.shop_id;
            lines.push({ product_id: pr.id, sku: pr.sku || pr.part_no || null, title: pr.title, maker: pr.maker || '', qty: q, price, cost: pr.cost == null ? null : pr.cost, line_total: price * q });
          }
          const disc = Number(p.discount) || 0;
          if (disc < 0 || disc > sub) fail('bad discount', '22023');
          if (disc > 0 && !hasPerm('discounts')) fail('not authorized to give discounts', '42501');
          /* the limit counts everything taken off the list prices: a lower price on a line and the discount on the invoice */
          if (!isAdmin() && st && st.max_discount != null && money2(list - (sub - disc)) > money2(list * st.max_discount / 100)) fail('discount over limit: ' + Number(st.max_discount).toFixed(2));
          if (nbc && money2(sub - disc) < money2(costSum)) fail('below cost');
          const shop = shopOf(branch), me = DB.users.find(u => u.id === uid());
          const v = { id: uuid(), no: ++DB.inv_seq, branch_id: branch, staff_id: uid(), staff_name: (st && st.name) || (me && me.email) || '', customer_id: p.customer_id || null,
            customer_name: String(p.customer_name || '').slice(0, 80), customer_phone: String(p.customer_phone || '').slice(0, 30), subtotal: sub, discount: disc, total: sub - disc,
            paid: Math.max(0, p.paid != null ? Number(p.paid) || 0 : (pay === 'credit' ? 0 : sub - disc)), payment: pay, currency: (shop && shop.currency) || 'LYD', status: 'done',
            note: String(p.note || '').slice(0, 500), created_at: now(), returned_at: null, pick_state: pickWaits(branch), picked_at: null, picked_name: '' };
          DB.invoices.push(v);
          lines.forEach((l, i) => DB.invoice_items.push({ id: DB.invoice_items.length + i + 1, invoice_id: v.id, ...l, picked: false }));
          logAct('sale', v.id, v.customer_name.trim() || null, v.total, { no: v.no, units, lines: lines.length, discount: disc, off_list: Math.max(money2(list - sub), 0), payment: pay, paid: v.paid });
          save();
          return RPC.get_invoice({ p_id: v.id });
        } catch (e) { snap.forEach(x => { const pr = DB.products.find(y => y.id === x.id); if (pr) { pr.qty = x.qty; pr.status = x.status; } }); throw e; }
      },
      return_invoice(a) {
        if (!hasPerm('returns')) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v) fail('invoice not found'); if (v.status === 'returned') fail('invoice already returned');
        if (v.status && v.status !== 'done') fail('order not received yet');
        DB.invoice_items.filter(i => i.invoice_id === v.id).forEach(i => { const pr = DB.products.find(x => x.id === i.product_id); if (pr && pr.qty != null) { pr.qty += i.qty; if (pr.qty > 0) pr.status = 'active'; } });
        v.status = 'returned'; v.returned_at = now();
        logAct('return', v.id, v.customer_name.trim() || null, v.total, { no: v.no }); save();
        return RPC.get_invoice({ p_id: v.id });
      },
      /* some of the parts back: the invoice keeps what stays sold, its discount shrinks with it, what was paid over the new total
         goes back (a sale on credit owes less instead); all of what is left coming back is the whole invoice returned */
      return_items(a) {
        if (!hasPerm('returns')) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_invoice);
        if (!v) fail('invoice not found'); if (v.status === 'returned') fail('invoice already returned');
        if (v.status && v.status !== 'done') fail('order not received yet');
        if (!Array.isArray(a.p_lines) || a.p_lines.length > 200) fail('pick the parts to return', '22023');
        const want = {}; a.p_lines.forEach(x => { if (/^[0-9]{1,18}$/.test(String(x && x.id))) want[x.id] = (want[x.id] || 0) + Math.floor(Number(x.qty) || 0); });
        Object.keys(want).forEach(k => { if (!want[k]) delete want[k]; });
        if (!Object.keys(want).length) fail('pick the parts to return', '22023');
        const its = DB.invoice_items.filter(i => i.invoice_id === v.id);
        Object.entries(want).forEach(([k, n]) => { const it = its.find(i => String(i.id) === k); if (!it) fail('line not on this invoice');
          if (n < 1 || n > it.qty) fail('bad quantity: ' + it.title + ' (on the invoice ' + it.qty + ')', '22023'); });
        if (!its.some(i => i.qty > (want[i.id] || 0))) return RPC.return_invoice({ p_id: v.id });
        const back = []; let units = 0;
        its.forEach(it => { const n = want[it.id]; if (!n) return;
          it.qty -= n; it.returned = (it.returned || 0) + n; it.line_total = money2(it.price * it.qty);
          const pr = DB.products.find(x => x.id === it.product_id); if (pr && pr.qty != null) { pr.qty += n; if (pr.qty > 0) pr.status = 'active'; }
          back.push({ id: it.id, title: it.title, sku: it.sku || null, maker: it.maker || '', qty: n, price: it.price }); units += n; });
        const sub = money2(its.reduce((k, i) => k + i.line_total, 0)), disc = v.subtotal > 0 ? money2(v.discount * sub / v.subtotal) : 0, total = money2(sub - disc);
        const refund = money2(Math.max(v.paid - total, 0)), amount = money2(v.total - total), reason = String(a.p_reason || '').trim().slice(0, 200);
        Object.assign(v, { subtotal: sub, discount: disc, total, paid: money2(v.paid - refund), refunded: money2((v.refunded || 0) + refund) });
        DB.invoice_returns.push({ id: (DB.invoice_returns.reduce((k, r) => Math.max(k, r.id), 0) || 0) + 1, invoice_id: v.id, created_at: now(), staff_id: uid(), staff_name: meName(),
          amount, refund, reason, lines: back });
        logAct('return_part', v.id, v.customer_name.trim() || null, amount, { no: v.no, units, refund, lines: back, reason });
        save();
        return RPC.get_invoice({ p_id: v.id });
      },
      list_invoices(a) {
        if (!uid()) return [];
        const q = String(a.p_q || '').trim();
        const L = DB.invoices.filter(v => (hasPerm('invoices') || v.staff_id === uid()) && (!a.p_from || v.created_at >= a.p_from) && (!a.p_to || v.created_at < a.p_to) &&
          (!a.p_branch || v.branch_id === a.p_branch) && (!q || String(v.no) === q || v.customer_name.includes(q) || v.customer_phone.includes(q)))
          .sort((x, y) => y.created_at.localeCompare(x.created_at) || y.no - x.no);
        const total = L.length, off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 30, 1), 100);
        return L.slice(off, off + lim).map(v => { const its = DB.invoice_items.filter(i => i.invoice_id === v.id);
          return { ...v, refunded: v.refunded || 0, branch_name: (shopOf(v.branch_id) || {}).name || null, items_count: its.reduce((k, i) => k + i.qty, 0),
            returned_units: its.reduce((k, i) => k + (i.returned || 0), 0), total_count: total }; });
      },
      /* ---------- customer orders from the app (supabase/setup.sql section 15): «قيد التجهيز» → «قيد الاستلام» → «تم الاستلام», or «ملغي» ---------- */
      prices_shown() {
        const mode = DB.settings.price_mode || 'all';
        return isStaff() || mode === 'all' || (mode === 'members' && !!uid()) || (mode === 'approved' && DB.customers.some(c => c.user_id === uid() && c.approved));
      },
      my_order(a) {
        const o = DB.invoices.find(x => x.id === a.p_id && x.source === 'app');
        if (!o || !uid() || !(o.customer_id === uid() || hasPerm('sales') || hasPerm('invoices'))) return null;
        const ok = RPC.prices_shown(), items = DB.invoice_items.filter(i => i.invoice_id === o.id).sort((x, y) => x.id - y.id), s = shopOf(o.branch_id);
        const shows = i => { const pr = DB.products.find(x => x.id === i.product_id); return isStaff() || (ok && !(pr && pr.hide_price)); };
        const all = items.every(shows), done = ['done', 'returned'].includes(o.status);
        return { id: o.id, no: o.no, status: o.status, source: o.source, ordered_at: o.ordered_at, ready_at: o.ready_at || null, done_at: done ? o.created_at : null,
          cancelled_at: o.cancelled_at || null, cancel_reason: o.cancel_reason || '', delivery: o.delivery || '', address: o.address || '', note: o.note || '',
          customer_name: o.customer_name, customer_phone: o.customer_phone, currency: o.currency, payment: done ? o.payment : null, total: all ? o.total : null,
          sent_at: o.sent_at || null, branch: s ? { id: s.id, name: s.name, city: s.city, area: s.area, phone: s.phone, whatsapp: s.whatsapp } : null,
          items: items.map(i => ({ product_id: i.product_id, title: i.title, sku: i.sku, qty: i.qty, short: i.short || 0, returned: i.returned || 0,
            price: shows(i) ? i.price : null, line_total: shows(i) ? i.line_total : null })) };
      },
      place_order(a) {
        const p = a.p || {}, me = uid(), st = DB.settings;
        if (!me) fail('sign in to order', '42501');
        if (!st.orders_enabled || st.shop_closed) fail('orders are closed');
        const c = DB.customers.find(x => x.user_id === me) || {};
        const name = String(String(p.name || '').trim() || String(c.shop_name || '').trim() || c.name || '').trim().slice(0, 80), phone = String(String(p.phone || '').trim() || c.phone || '').replace(/[^0-9+]/g, '').slice(0, 30);
        const del = p.delivery || 'pickup', addr = String(p.address || '').trim();
        if (name.length < 2) fail('order needs a name', '22023');
        if (phone.length < 7) fail('order needs a phone', '22023');
        if (!['pickup', 'delivery'].includes(del)) fail('bad delivery', '22023');
        if (del === 'delivery' && addr.length < 5) fail('delivery needs an address', '22023');
        const items = Array.isArray(p.items) ? p.items : [];
        if (!items.length || items.length > 100) fail('order needs 1 to 100 items', '22023');
        if (DB.invoices.filter(x => x.customer_id === me && x.source === 'app' && ['preparing', 'ready'].includes(x.status)).length >= 5) fail('too many open orders');
        const snap = DB.products.map(x => ({ id: x.id, qty: x.qty, status: x.status })), lines = [];
        let sub = 0, units = 0, branch = null;
        try {
          for (const it of items) {
            const q = Math.floor(Number(it.qty) || 0), pr = DB.products.find(x => x.id === it.id);
            if (q < 1 || q > 1000) fail('bad quantity', '22023');
            if (!pr || pr.status !== 'active') fail('part not available: ' + ((pr && pr.title) || ''));
            if (pr.price == null) fail('part has no price: ' + pr.title);
            if (pr.qty != null && pr.qty < q) fail(st.hide_qty && !isStaff() ? 'not enough stock: ' + pr.title : 'not enough stock: ' + pr.title + ' (available ' + pr.qty + ')');
            if (pr.qty != null) { pr.qty -= q; if (pr.qty <= 0) pr.status = 'sold'; }
            sub += pr.price * q; units += q; branch = branch || pr.shop_id;
            lines.push({ product_id: pr.id, sku: pr.sku || pr.part_no || null, title: pr.title, maker: pr.maker || '', qty: q, price: pr.price, cost: pr.cost == null ? null : pr.cost, line_total: pr.price * q });
          }
        } catch (e) { snap.forEach(x => { const pr = DB.products.find(y => y.id === x.id); if (pr) { pr.qty = x.qty; pr.status = x.status; } }); throw e; }
        const shop = shopOf(branch), t = now();
        const v = { id: uuid(), no: ++DB.inv_seq, branch_id: branch, staff_id: null, staff_name: '', customer_id: me, customer_name: name, customer_phone: phone,
          subtotal: money2(sub), discount: 0, total: money2(sub), paid: 0, payment: 'cash', currency: (shop && shop.currency) || 'LYD', status: 'preparing', note: String(p.note || '').trim().slice(0, 500),
          created_at: t, returned_at: null, source: 'app', ordered_at: t, ready_at: null, cancelled_at: null, cancel_reason: '', delivery: del, address: del === 'delivery' ? addr.slice(0, 300) : '',
          pick_state: pickWaits(branch), picked_at: null, picked_name: '' };
        DB.invoices.push(v);
        lines.forEach(l => DB.invoice_items.push({ id: DB.invoice_items.length + 1, invoice_id: v.id, ...l, picked: false }));
        logAct('order', v.id, name, v.total, { no: v.no, units, lines: lines.length, delivery: del });
        save();
        return RPC.my_order({ p_id: v.id });
      },
      my_orders(a) {
        if (!uid()) return [];
        return DB.invoices.filter(x => x.customer_id === uid() && x.source === 'app')
          .sort((x, y) => (['preparing', 'ready'].includes(y.status) - ['preparing', 'ready'].includes(x.status)) || (y.ordered_at || y.created_at).localeCompare(x.ordered_at || x.created_at))
          .slice(0, Math.min(Math.max((a && a.p_limit) || 30, 1), 100)).map(x => RPC.my_order({ p_id: x.id }));
      },
      cancel_my_order(a) {
        const v = DB.invoices.find(x => x.id === a.p_id && x.source === 'app' && x.customer_id === uid());
        if (!v) fail('order not found');
        if (v.status !== 'preparing') fail('order can no longer be cancelled');
        restock(v.id);
        v.status = 'cancelled'; v.cancelled_at = now(); v.cancel_reason = 'customer';
        logAct('order_cancelled', v.id, v.customer_name.trim() || null, v.total, { no: v.no, was: 'preparing', by: 'customer' }); save();
        return RPC.my_order({ p_id: v.id });
      },
      list_orders(a) {
        if (!uid() || !(hasPerm('sales') || hasPerm('invoices'))) fail('not authorized', '42501');
        const st = isAdmin() ? null : staffRow(), br = st && st.branch_id, want = (a && a.p_status) || '';
        const o = DB.invoices.filter(x => x.source === 'app' && (!br || x.branch_id === br));
        const open = x => ['preparing', 'ready'].includes(x.status);
        const pick = o.filter(x => !want ? open(x) : want === 'all' ? true : x.status === want)
          .sort((x, y) => (open(y) - open(x)) || (open(x) ? x.ordered_at.localeCompare(y.ordered_at) : (y.cancelled_at || y.created_at).localeCompare(x.cancelled_at || x.created_at)) || x.no - y.no);
        const off = (a && a.p_offset) || 0, lim = Math.min(Math.max((a && a.p_limit) || 30, 1), 100);
        return { counts: { preparing: o.filter(x => x.status === 'preparing').length, ready: o.filter(x => x.status === 'ready').length }, total: pick.length,
          items: pick.slice(off, off + lim).map(x => { const its = DB.invoice_items.filter(i => i.invoice_id === x.id);
            return { id: x.id, no: x.no, status: x.status, ordered_at: x.ordered_at, ready_at: x.ready_at || null, cancelled_at: x.cancelled_at || null,
              done_at: ['done', 'returned'].includes(x.status) ? x.created_at : null, customer_name: x.customer_name, customer_phone: x.customer_phone, delivery: x.delivery || '',
              address: x.address || '', note: x.note || '', total: x.total, currency: x.currency, payment: x.payment, staff_name: x.staff_name,
              units: its.reduce((k, i) => k + i.qty, 0), lines: its.filter(i => i.qty > 0).length, short: its.reduce((k, i) => k + (i.short || 0), 0) }; }) };
      },
      order_set(a) {
        if (!uid() || !hasPerm('sales')) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_id && x.source === 'app');
        if (!v) fail('order not found');
        const st = staffRow();
        if (!isAdmin() && st && st.branch_id && v.branch_id !== st.branch_id) fail('not authorized', '42501');
        const was = v.status, to = a.p_status, pay = a.p_payment || 'cash', reason = String(a.p_reason || '').trim().slice(0, 200);
        if (to === 'ready') { if (was !== 'preparing') fail('bad order status'); v.status = 'ready'; v.ready_at = now(); }
        else if (to === 'done') {
          if (!['preparing', 'ready'].includes(was)) fail('bad order status');
          if (!['cash', 'card', 'transfer', 'credit'].includes(pay)) fail('bad payment', '22023');
          /* from now on a sale like any other, dated the day it was received */
          Object.assign(v, { status: 'done', created_at: now(), ready_at: v.ready_at || now(), payment: pay, paid: pay === 'credit' ? 0 : v.total, staff_id: uid(), staff_name: meName() });
        } else if (to === 'cancelled') {
          if (!['preparing', 'ready'].includes(was)) fail('bad order status');
          restock(v.id); Object.assign(v, { status: 'cancelled', cancelled_at: now(), cancel_reason: reason });
        } else fail('bad order status', '22023');
        logAct('order_' + to, v.id, v.customer_name.trim() || null, v.total, { no: v.no, was, ...(to === 'done' ? { payment: pay } : to === 'cancelled' ? { reason } : {}) });
        save();
        return RPC.get_invoice({ p_id: v.id });
      },
      sales_report(a) {
        if (!hasPerm('reports')) fail('not authorized', '42501');
        const inv = DB.invoices.filter(v => v.status === 'done' && v.created_at >= a.p_from && v.created_at < a.p_to && (!a.p_branch || v.branch_id === a.p_branch));
        const ids = new Set(inv.map(v => v.id)), items = DB.invoice_items.filter(i => ids.has(i.invoice_id)), sum = (l, f) => l.reduce((k, x) => k + (Number(f(x)) || 0), 0);
        const group = (l, key, val) => { const m = {}; l.forEach(x => { const k = key(x); m[k] = m[k] || { c: 0, s: 0 }; m[k].c++; m[k].s += val(x); }); return m; };
        const bp = {}; Object.entries(group(inv, v => v.payment, v => v.total)).forEach(([k, x]) => { bp[k] = x.s; });
        const top = {}; items.forEach(i => { top[i.title] = top[i.title] || { title: i.title, qty: 0, total: 0 }; top[i.title].qty += i.qty; top[i.title].total += i.line_total; });
        return { count: inv.length, total: sum(inv, v => v.total), discount: sum(inv, v => v.discount), credit: sum(inv.filter(v => v.payment === 'credit'), v => v.total - v.paid),
          returned: DB.invoices.filter(v => v.status === 'returned' && v.returned_at >= a.p_from && v.returned_at < a.p_to && (!a.p_branch || v.branch_id === a.p_branch)).length
            + (DB.invoice_returns || []).filter(r => r.created_at >= a.p_from && r.created_at < a.p_to && (!a.p_branch || (DB.invoices.find(v => v.id === r.invoice_id) || {}).branch_id === a.p_branch)).length, by_payment: bp,
          by_staff: Object.entries(group(inv, v => v.staff_name, v => v.total)).map(([name, x]) => ({ name, count: x.c, total: x.s })).sort((x, y) => y.total - x.total),
          by_branch: Object.entries(group(inv, v => v.branch_id, v => v.total)).map(([id, x]) => ({ name: (shopOf(id) || {}).name || '—', count: x.c, total: x.s })).sort((x, y) => y.total - x.total),
          by_day: Object.entries(group(inv, v => v.created_at.slice(0, 10), v => v.total)).map(([day, x]) => ({ day, total: x.s })).sort((x, y) => x.day.localeCompare(y.day)),
          top: Object.values(top).filter(x => x.qty > 0).sort((x, y) => y.qty - x.qty).slice(0, 10),
          profit: hasPerm('costs') ? sum(items, i => i.line_total - (i.cost || 0) * i.qty) - sum(inv, v => v.discount) : null,
          cost_missing: hasPerm('costs') ? items.filter(i => i.cost == null).length : null };
      },
      import_products(a) { if (!isAdmin()) throw Object.assign(new Error('not authorized'), { code: '42501' }); const r = upsert(a.p_rows, a.p_shop); logAct('import', '', '', null, r); save(); return r; },
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
            const mk = String(it.maker || '').trim().slice(0, 60);
            let pr = it.product_id ? DB.products.find(x => x.id === it.product_id) : null;
            if (it.product_id && !pr) fail('part not found');
            const codes = [sku, bar, pn].filter(Boolean);
            if (!pr && codes.length) pr = DB.products.find(x => x.sku && codes.some(c => key(c) === key(x.sku)))
              || here(DB.products.filter(x => x.barcode && codes.includes(x.barcode))) || here(DB.products.filter(x => x.part_no && [pn, sku].some(c => c && key(c) === key(x.part_no))));
            let prev = null;
            if (pr) {
              prev = { prev_cost: pr.cost == null ? null : pr.cost, prev_price: pr.price == null ? null : pr.price };
              pr.qty = (pr.qty || 0) + q; if (cost != null) pr.cost = cost; if (price != null) pr.price = price; pr.status = 'active'; pr.updated_at = now(); nUpd++;
              if (!pr.maker && mk) { pr.maker = mk; if (pr.search_text) pr.search_text = (pr.search_text + ' ' + norm(mk)).slice(0, 3000); } // fills a part with none; one already set stays
            } else {
              const title = String(it.title || '').trim().slice(0, 120);
              if (title.length < 2) fail('new item needs a name', '22023');
              pr = { id: uuid(), shop_id: branch.id, owner_id: branch.owner_id, sku: sku || null, barcode: bar || null,
                title, cat: CATS.includes(it.cat) ? it.cat : 'other', cond: 'original', price, cost, nego: false, qty: q, make: String(it.make || '').trim().toLowerCase().slice(0, 20) || 'any',
                model: String(it.model || '').slice(0, 60), y_from: null, y_to: null, part_no: pn || sku || '', maker: mk, location: String(it.location || '').trim().slice(0, 60), descr: '', imgs: [], status: 'active',
                hide_price: false, search_text: '', created_at: now(), updated_at: now() };
              DB.products.push(pr); nNew++;
            }
            lines.push({ product_id: pr.id, code, title: pr.title, qty: q, cost, prev_cost: prev ? prev.prev_cost : null, prev_price: prev ? prev.prev_price : null, set_price: price, created: !prev, maker: pr.maker || '' });
            total += (cost || 0) * q;
          }
          /* paid less than the total: the rest is owed to the supplier, so the receipt needs the supplier's name */
          var paid = numOf(p.paid);
          if (paid != null) { paid = Math.min(Math.max(paid, 0), total); if (paid < total && !supKey(p.supplier)) fail('supplier needed for credit', '22023'); }
        } catch (e) { DB.products = snap; throw e; }
        const me = DB.users.find(u => u.id === uid()), v = { id: uuid(), no: ++DB.pur_seq, branch_id: branch.id, staff_id: uid(), staff_name: (st && st.name) || (me && me.email) || '',
          supplier: String(p.supplier || '').slice(0, 120), note: String(p.note || '').slice(0, 500), supplier_no: String(p.supplier_no || '').trim().slice(0, 60),
          total, paid: paid == null ? null : paid, items_count: lines.length, created_at: now() };
        DB.purchases.push(v);
        const base = DB.purchase_items.reduce((k, i) => Math.max(k, i.id || 0), 0);
        lines.forEach((l, i) => DB.purchase_items.push({ id: base + i + 1, purchase_id: v.id, ...l }));
        logAct('receive', v.id, v.supplier.trim() || null, total, { no: v.no, units: lines.reduce((k, l) => k + l.qty, 0), new: nNew, updated: nUpd, paid: v.paid,
          source: ['photo', 'scan', 'manual'].includes(p.source) ? p.source : null, auto: p.auto === true, lines: lines.slice(0, 100).map(l => [l.title, l.qty, l.cost]) });
        save();
        return { id: v.id, no: v.no, new: nNew, updated: nUpd, total };
      },
      /* p_q finds receipts like the sales: the number, the supplier, or a part on it by name, code, manufacturer or the car it fits */
      list_purchases(a) {
        if (!uid() || !(hasPerm('purchases') || hasPerm('reports'))) return [];
        const q = String(a.p_q || '').trim(), nq = norm(q), bare = v => String(v || '').replace(/[\s\-./]/g, '').toUpperCase();
        const prod = i => DB.products.find(x => x.id === i.product_id);
        const hit = v => !q || String(v.no) === q || (v.supplier_no && bare(v.supplier_no) === bare(q)) || norm(v.supplier).includes(nq) || DB.purchase_items.some(i => i.purchase_id === v.id
          && (norm([i.title, i.code, i.maker].filter(Boolean).join(' ')).includes(nq) || (i.code && bare(i.code) === bare(q)) || (prod(i) && text(prod(i)).includes(nq))));
        const L = DB.purchases.filter(hit).sort((x, y) => y.created_at.localeCompare(x.created_at)), off = a.p_offset || 0, lim = Math.min(Math.max(a.p_limit || 30, 1), 100), costs = hasPerm('costs');
        return L.slice(off, off + lim).map(v => ({ ...v, total: costs ? v.total : null, paid: costs ? (v.paid == null ? v.total : v.paid) : null, branch_name: (shopOf(v.branch_id) || {}).name || null, total_count: L.length,
          items: DB.purchase_items.filter(i => i.purchase_id === v.id).map(i => { const pr = prod(i); return { title: i.title, code: i.code, qty: i.qty, maker: i.maker || '', make: pr ? pr.make : null, model: pr ? pr.model : null, cost: costs ? i.cost : null }; }) }));
      },
      /* one purchase invoice for its page (supplier invoice number, lines, how it was paid, what the supplier is owed now) */
      get_purchase(a) {
        if (!uid() || !(hasPerm('purchases') || hasPerm('reports'))) return null;
        const v = DB.purchases.find(x => x.id === a.p_id);
        if (!v) return null;
        const costs = hasPerm('costs'), k = supKey(v.supplier), sh = shopOf(v.branch_id) || {}, paid = v.paid == null ? v.total : v.paid;
        const owed = k == null ? null : DB.purchases.filter(x => supKey(x.supplier) === k).reduce((n, x) => n + x.total - (x.paid == null ? x.total : x.paid), 0)
          - DB.supplier_payments.filter(y => supKey(y.supplier) === k).reduce((n, y) => n + y.amount, 0);
        return { ...v, supplier_no: v.supplier_no || '', total: costs ? v.total : null, paid: costs ? paid : null,
          pay: costs ? (v.paid == null || v.paid >= v.total ? 'full' : v.paid === 0 ? 'credit' : 'part') : null,
          branch: { name: sh.name || null, city: sh.city || null, phone: sh.phone || null }, sup_key: k, sup_balance: costs && k != null ? owed : null,
          can_undo: hasPerm('purchases') && (isAdmin() || (v.staff_id === uid() && Date.now() - Date.parse(v.created_at) < 864e5)),
          items: DB.purchase_items.filter(i => i.purchase_id === v.id).sort((x, y) => x.id - y.id).map(i => { const pr = DB.products.find(x => x.id === i.product_id);
            return { id: i.id, title: i.title, code: i.code || (pr && (pr.sku || pr.part_no)) || null, qty: i.qty, maker: i.maker || '', make: pr ? pr.make : null, model: pr ? pr.model : null, created: !!i.created, cost: costs ? i.cost : null }; }) };
      }
,

      /* ---------- accounts: stock, customers (الشاري), suppliers (البايع), expenses, profit and loss ---------- */
      stock_report(a) {
        if (!uid() || !(hasPerm('products') || hasPerm('purchases') || hasPerm('reports'))) fail('not authorized', '42501');
        const costs = hasPerm('costs'), q = String(a.p_q || '').trim(), nq = norm(q), uq = q.toUpperCase(), f = a.p_filter || 'all', L = DB.products;
        const lv = DB.settings.low_stock == null ? 3 : DB.settings.low_stock;
        const sum = (l, fn) => l.reduce((k, x) => k + (Number(fn(x)) || 0), 0), low = p => p.qty != null && p.qty >= 1 && p.qty <= lv, full = L.filter(p => p.qty > 0);
        const hit = L.filter(p => (!q || norm(p.title).includes(nq) || String(p.sku || '').toUpperCase().includes(uq) || String(p.part_no || '').toUpperCase().includes(uq) || (p.barcode || '') === q
            || norm(p.maker || '').includes(nq) || text(p).includes(nq))
          && (f === 'low' ? low(p) : f === 'out' ? p.qty === 0 : true)).sort((x, y) => (f === 'low' ? x.qty - y.qty : 0) || x.title.localeCompare(y.title, 'ar') || x.id.localeCompare(y.id));
        const byTitle = (x, y) => x.title.localeCompare(y.title, 'ar') || x.id.localeCompare(y.id), first = !a.p_offset, br = p => (shopOf(p.shop_id) || {}).name || null;
        return {
          summary: { parts: L.length, units: sum(L, p => p.qty), low: L.filter(low).length, low_level: lv, out: L.filter(p => p.qty === 0).length,
            value_price: sum(full.filter(p => p.price != null), p => p.qty * p.price),
            value_cost: costs ? sum(full.filter(p => p.cost != null), p => p.qty * p.cost) : null, cost_missing: costs ? full.filter(p => p.cost == null).length : null },
          /* what is running low, the fewest left first, and what has run out (on the first page) */
          low_items: first ? L.filter(low).sort((x, y) => x.qty - y.qty || byTitle(x, y)).slice(0, 10).map(p => ({ id: p.id, title: p.title, sku: p.sku || null, part_no: p.part_no || '', maker: p.maker || '', qty: p.qty, price: p.price == null ? null : p.price, branch_name: br(p) })) : null,
          out_items: first ? L.filter(p => p.qty === 0).sort(byTitle).slice(0, 10).map(p => ({ id: p.id, title: p.title, sku: p.sku || null, part_no: p.part_no || '', branch_name: br(p) })) : null,
          total: hit.length,
          items: page(hit, a, 50).map(p => ({ id: p.id, title: p.title, sku: p.sku || null, part_no: p.part_no || '', barcode: p.barcode || null, maker: p.maker || '', make: p.make || 'any', model: p.model || '',
            qty: p.qty == null ? null : p.qty,
            price: p.price == null ? null : p.price, cost: costs && p.cost != null ? p.cost : null, branch_name: (shopOf(p.shop_id) || {}).name || null })),
          moves: hasPerm('products') || hasPerm('reports') ? DB.stock_moves.slice().sort(newest).slice(0, 20).map(m => ({ id: m.id, title: m.title, qty: m.qty, reason: m.reason, note: m.note,
            staff_name: m.staff_name, created_at: m.created_at, value: costs && m.cost != null ? m.qty * m.cost : null })) : []
        };
      },
      adjust_stock(a) {
        const p = a.p || {};
        if (!uid() || !hasPerm('products')) fail('not authorized', '42501');
        const reason = p.reason || 'other';
        if (!['count', 'damaged', 'lost', 'other'].includes(reason)) fail('bad reason', '22023');
        const pr = DB.products.find(x => x.id === p.id);
        if (!pr) fail('part not found');
        const old = pr.qty || 0, nv = numOf(p.set) != null ? Math.floor(numOf(p.set)) : old + Math.floor(numOf(p.delta) || 0);
        if (nv < 0) fail('stock cannot go below zero (available ' + old + ')', '22023');
        if (nv > 999999) fail('bad quantity', '22023');
        if (nv === old) fail('nothing to change', '22023');
        pr.qty = nv; pr.status = nv === 0 ? 'sold' : 'active'; pr.updated_at = now();
        DB.stock_moves.push({ id: ++DB.move_seq, product_id: pr.id, title: pr.title, branch_id: pr.shop_id, staff_id: uid(), staff_name: meName(), qty: nv - old, reason,
          cost: pr.cost == null ? null : pr.cost, note: String(p.note || '').slice(0, 300), created_at: now() });
        logAct('stock', pr.id, pr.title, pr.cost == null ? null : (nv - old) * pr.cost, { from: old, to: nv, reason, note: String(p.note || '').slice(0, 300) || null });
        save();
        return { id: pr.id, qty: nv, delta: nv - old };
      },
      list_buyers(a) {
        if (!uid() || !(hasPerm('invoices') || hasPerm('reports'))) fail('not authorized', '42501');
        const B = buyers(), q = String(a.p_q || '').trim(), nq = norm(q);
        let d = nq.replace(/[^0-9]/g, ''); if (d.length > 9) d = d.slice(-9);
        const hit = B.filter(b => (!q || norm(b.name).includes(nq) || (d && b.key.startsWith('p:') && b.key.includes(d))) && (!a.p_owing || b.balance > 0)).sort(owingFirst);
        const owing = B.filter(b => b.balance > 0);
        return { owing_total: money2(owing.reduce((k, b) => k + b.balance, 0)), owing_count: owing.length, total: hit.length, items: page(hit, a, 30) };
      },
      buyer_detail(a) {
        if (!uid() || !(hasPerm('invoices') || hasPerm('reports'))) fail('not authorized', '42501');
        const inv = DB.invoices.filter(v => custKey(v.customer_name, v.customer_phone) === a.p_key).sort(newest);
        if (!inv.length) return null;
        const d = inv.filter(v => v.status === 'done'), pays = DB.customer_payments.filter(p => p.cust_key === a.p_key).sort(newest), latest = f => (inv.find(v => v[f]) || {})[f] || '';
        const due = d.reduce((k, v) => k + Math.max(v.total - v.paid, 0), 0), paid = pays.reduce((k, p) => k + p.amount, 0);
        return { key: a.p_key, name: latest('customer_name') || latest('customer_phone'), phone: latest('customer_phone'), count: d.length, total: d.reduce((k, v) => k + v.total, 0),
          due, paid_later: paid, balance: money2(due - paid),
          invoices: inv.slice(0, 50).map(v => ({ id: v.id, no: v.no, created_at: v.created_at, total: v.total, paid: v.paid, payment: v.payment, status: v.status, currency: v.currency, staff_name: v.staff_name })),
          payments: pays.map(p => ({ id: p.id, amount: p.amount, note: p.note, staff_name: p.staff_name, created_at: p.created_at })) };
      },
      add_customer_payment(a) {
        if (!uid() || !hasPerm('invoices')) fail('not authorized', '42501');
        const amt = numOf(a.p_amount);
        if (amt == null || amt <= 0 || amt > 99999999) fail('bad amount', '22023');
        const v = DB.invoices.filter(x => custKey(x.customer_name, x.customer_phone) === a.p_key).sort(newest)[0];
        if (!v) fail('customer not found');
        const cp = { id: ++DB.pay_seq, cust_key: a.p_key, customer_name: (v.customer_name || v.customer_phone).slice(0, 80), amount: money2(amt), staff_id: uid(), staff_name: meName(),
          note: String(a.p_note || '').slice(0, 300), created_at: now() };
        DB.customer_payments.push(cp);
        logAct('pay_in', cp.id, cp.customer_name || cp.cust_key, cp.amount, { note: cp.note || undefined, by: cp.staff_name || undefined, key: cp.cust_key });
        save();
        return RPC.buyer_detail({ p_key: a.p_key });
      },
      delete_customer_payment(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const x = DB.customer_payments.find(p => p.id === a.p_id);
        if (x) { DB.customer_payments = DB.customer_payments.filter(p => p !== x); logAct('pay_in_del', x.id, x.customer_name || x.cust_key, x.amount, { note: x.note || undefined, by: x.staff_name || undefined, key: x.cust_key }); }
        save(); return null;
      },
      /* ---------- merchants: «صادر ووارد», sending invoices, a new password (setup.sql section 16) ---------- */
      link_login_phone() { return !!uid(); },
      my_book() { return uid() ? merchantBook(uid()) : null; },
      my_bill(a) {
        if (!uid()) return null;
        const v = merchantInvoices(uid()).find(x => x.id === a.p_id);
        if (!v) return null;
        const s = shopOf(v.branch_id);
        return { id: v.id, no: v.no, status: v.status, source: v.source || 'pos', created_at: v.created_at, sent_at: v.sent_at || null, customer_name: v.customer_name,
          customer_phone: v.customer_phone, subtotal: v.subtotal, discount: v.discount, total: v.total, paid: v.paid, payment: v.payment, currency: v.currency,
          note: v.note || '', staff_name: v.staff_name || '', branch: s ? { name: s.name, city: s.city, phone: s.phone } : null,
          items: DB.invoice_items.filter(i => i.invoice_id === v.id).map(i => ({ title: i.title, sku: i.sku, maker: i.maker || '', qty: i.qty, price: i.price, line_total: i.line_total })) };
      },
      my_inbox() {
        if (!uid()) return [];
        const from = Date.now() - 60 * 864e5;
        return DB.invoices.filter(v => v.customer_id === uid() && v.sent_at && Date.parse(v.sent_at) > from && v.status !== 'cancelled')
          .sort((x, y) => y.sent_at.localeCompare(x.sent_at)).slice(0, 20).map(v => ({ id: v.id, no: v.no, sent_at: v.sent_at }));
      },
      send_invoice(a) {
        if (!uid() || !(hasPerm('sales') || hasPerm('invoices'))) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v || !canOpen(v)) fail('invoice not found');
        if (v.status === 'cancelled') fail('invoice cancelled');
        if (v.customer_id && a.p_user && a.p_user !== v.customer_id) fail('invoice belongs to another merchant');
        const to = v.customer_id || a.p_user;
        if (!to) fail('choose the merchant', '22023');
        const c = DB.customers.find(x => x.user_id === to);
        if (!c) fail('merchant not found');
        const again = !!v.sent_at;
        v.customer_id = to; v.sent_at = now();
        logAct('invoice_sent', v.id, shopOrName(c), v.total, { no: v.no, phone: c.phone, again });
        save();
        return RPC.get_invoice({ p_id: v.id });
      },
      unsend_invoice(a) {
        if (!uid() || !(hasPerm('sales') || hasPerm('invoices'))) fail('not authorized', '42501');
        const v = DB.invoices.find(x => x.id === a.p_id);
        if (!v || !canOpen(v)) fail('invoice not found');
        if (!v.sent_at) fail('invoice not sent');
        const c = DB.customers.find(x => x.user_id === v.customer_id);
        v.sent_at = null; if (v.source !== 'app') v.customer_id = null;
        logAct('invoice_unsent', v.id, c ? shopOrName(c) : '', v.total, { no: v.no });
        save();
        return RPC.get_invoice({ p_id: v.id });
      },
      find_merchants(a) {
        if (!uid() || !(hasPerm('sales') || hasPerm('invoices') || hasPerm('customers'))) fail('not authorized', '42501');
        return merchantHits(a.p_q).sort((x, y) => (!!y.approved - !!x.approved) || y.created_at.localeCompare(x.created_at)).slice(0, Math.min(Math.max(a.p_limit || 20, 1), 50))
          .map(c => ({ user_id: c.user_id, shop_name: c.shop_name || '', name: c.name, phone: c.phone, city: c.city || '', approved: !!c.approved }));
      },
      list_merchants(a) {
        if (!uid() || !(hasPerm('customers') || hasPerm('invoices') || hasPerm('reports'))) fail('not authorized', '42501');
        const M = merchantHits(a.p_q).map(c => {
          const mine = DB.invoices.filter(i => i.customer_id === c.user_id);
          return { user_id: c.user_id, shop_name: c.shop_name || '', name: c.name, phone: c.phone, city: c.city || '', approved: !!c.approved, created_at: c.created_at,
            open_orders: mine.filter(i => i.source === 'app' && (i.status === 'preparing' || i.status === 'ready')).length,
            balance: c.approved ? merchantSums(c).balance : null, last_at: mine.map(i => i.sent_at || i.ordered_at || i.created_at).sort().pop() || null };
        });
        const f = a.p_filter || '', owes = m => (m.balance || 0) > 0;
        const pick = M.filter(m => f === 'pending' ? !m.approved : f === 'owing' ? owes(m) : f === 'orders' ? m.open_orders > 0 : true)
          .sort((x, y) => ((y.open_orders > 0) - (x.open_orders > 0)) || (x.approved - y.approved) || (owes(y) - owes(x))
            || String(y.last_at || '').localeCompare(String(x.last_at || '')) || y.created_at.localeCompare(x.created_at));
        return { counts: { all: M.length, pending: M.filter(m => !m.approved).length, owing: M.filter(owes).length, orders: M.filter(m => m.open_orders > 0).length },
          total: pick.length, items: page(pick, a, 30) };
      },
      merchant_detail(a) {
        if (!uid() || !(hasPerm('customers') || hasPerm('invoices') || hasPerm('reports'))) fail('not authorized', '42501');
        const b = merchantBook(a.p_user), c = DB.customers.find(x => x.user_id === a.p_user);
        return b ? { ...b, key: custKey('', b.phone), shop_on: !!(c && c.shop_on), phone_public: !!(c && c.phone_public), shop_shown: !!(c && shopShown(c)),
          shop_cover: (c && c.shop_cover) || '', shop_bg: (c && c.shop_bg) || '' } : null;
      },
      /* the merchants' shops for everyone (supabase/setup.sql section 17): the name, the city, the phone only if the merchant shows it */
      merchant_shops(a) {
        const q = norm(String(a.p_q || '').trim()), off = Math.max(a.p_offset || 0, 0), lim = Math.min(Math.max(a.p_limit || 20, 1), 100);
        const L = DB.customers.filter(c => shopShown(c) && (!q || norm(c.shop_name + ' ' + (c.city || '')).includes(q)))
          .sort((x, y) => (!!y.shop_on - !!x.shop_on) || x.created_at.localeCompare(y.created_at) || x.user_id.localeCompare(y.user_id));
        return L.slice(off, off + lim).map(c => ({ ...shopOut(c), total_count: L.length }));
      },
      merchant_shop(a) { const c = DB.customers.find(x => x.user_id === a.p_id); return c && shopShown(c) ? shopOut(c) : null; },
      /* the warehouse (supabase/setup.sql section 18): new invoices wait there, each line with where the part is kept */
      pick_list(a) {
        if (!pickOk()) fail('not authorized', '42501');
        const done = a.p_state === 'done', b = pickBranch(), off = Math.max(a.p_offset || 0, 0), lim = Math.min(Math.max(a.p_limit || 30, 1), 100);
        const L = DB.invoices.filter(v => v.pick_state === (done ? 'done' : 'waiting') && ['done', 'preparing', 'ready'].includes(v.status) && (!b || v.branch_id === b))
          .sort((x, y) => done ? String(y.picked_at || '').localeCompare(String(x.picked_at || '')) : x.created_at.localeCompare(y.created_at) || x.no - y.no);
        return L.slice(off, off + lim).map(v => {
          const its = DB.invoice_items.filter(i => i.invoice_id === v.id);
          const lines = its.filter(i => i.qty > 0 || (i.short || 0) > 0).map(i => { const p = DB.products.find(x => x.id === i.product_id) || {};
            return { id: i.id, title: i.title, sku: i.sku || null, maker: i.maker || '', qty: i.qty, short: i.short || 0, picked: !!i.picked, part_no: p.part_no || null, barcode: p.barcode || null,
              make: p.make || null, model: p.model || null, location: p.location || '', img: (p.imgs || [])[0] || null, stock: p.qty == null ? null : p.qty }; })
            .sort((x, y) => (x.location || 'ي').localeCompare(y.location || 'ي', 'ar') || x.id - y.id);
          return { id: v.id, no: v.no, created_at: v.created_at, customer_name: v.customer_name, staff_name: v.staff_name, source: v.source || 'pos', status: v.status, note: v.note || '',
            picked_at: v.picked_at || null, picked_name: v.picked_name || '', branch_name: (shopOf(v.branch_id) || {}).name || null, total_count: L.length,
            units: its.reduce((k, i) => k + i.qty, 0), picked_n: its.filter(i => i.picked && i.qty > 0).length, can_short: v.source === 'app' && ['preparing', 'ready'].includes(v.status), lines };
        });
      },
      pick_line(a) {
        if (!pickOk()) fail('not authorized', '42501');
        const it = DB.invoice_items.find(i => i.id === a.p_item), v = it && DB.invoices.find(x => x.id === it.invoice_id), b = pickBranch();
        if (!v || v.pick_state !== 'waiting' || (b && v.branch_id !== b)) fail('invoice not waiting', 'P0001');
        it.picked = a.p_on !== false; save();
        return { picked: it.picked, left: DB.invoice_items.filter(i => i.invoice_id === v.id && !i.picked).length };
      },
      pick_done(a) {
        if (!pickOk()) fail('not authorized', '42501');
        const b = pickBranch(), v = DB.invoices.find(x => x.id === a.p_invoice && (!b || x.branch_id === b));
        if (!v) fail('invoice not found', 'P0001');
        if (v.pick_state !== 'waiting') fail('invoice not waiting', 'P0001');
        const st = staffRow(), me = DB.users.find(u => u.id === uid()), its = DB.invoice_items.filter(i => i.invoice_id === v.id);
        let short = 0, out = '';
        /* an order from the app not yet received: what is not on the shelf comes off it and back to stock, the order goes to its
           customer «قيد الاستلام» with what was found; nothing found cancels it */
        if (v.source === 'app' && ['preparing', 'ready'].includes(v.status)) {
          if (Array.isArray(a.p_avail)) {
            const got = {}; a.p_avail.forEach(x => { if (/^[0-9]{1,18}$/.test(String(x && x.id))) { const n = Math.floor(x.qty == null || x.qty === '' ? -1 : Number(x.qty)); got[x.id] = got[x.id] == null ? n : Math.min(got[x.id], n); } });
            Object.entries(got).forEach(([k, n]) => { const it = its.find(i => String(i.id) === k); if (!it) fail('line not on this invoice');
              if (!(n >= 0) || n > it.qty) fail('bad quantity: ' + it.title + ' (ordered ' + it.qty + ')', '22023'); });
            Object.entries(got).forEach(([k, n]) => { const it = its.find(i => String(i.id) === k); if (n >= it.qty) return;
              const d = it.qty - n; it.short = (it.short || 0) + d; it.qty = n; it.line_total = money2(it.price * n); short += d;
              const pr = DB.products.find(x => x.id === it.product_id); if (pr && pr.qty != null) { pr.qty += d; if (pr.qty > 0) pr.status = 'active'; } });
            if (short) { const sub = money2(its.reduce((k, i) => k + i.line_total, 0)), disc = v.subtotal > 0 ? money2(v.discount * sub / v.subtotal) : 0;
              Object.assign(v, { subtotal: sub, discount: disc, total: money2(sub - disc) }); }
          }
          if (!its.some(i => i.qty > 0)) { Object.assign(v, { status: 'cancelled', cancelled_at: now(), cancel_reason: 'القطع مش موجودة في المخزن' }); out = 'cancelled'; }
          else if (v.status === 'preparing') { Object.assign(v, { status: 'ready', ready_at: now() }); out = 'ready'; }
        }
        its.forEach(i => { if (i.qty > 0) i.picked = true; });
        Object.assign(v, { pick_state: 'done', picked_at: now(), picked_name: String((st && st.name) || (me && me.email) || '').slice(0, 80) });
        logAct('picked', v.id, v.customer_name || null, v.total, { no: v.no, ...(short ? { short } : {}), ...(out ? { order: out } : {}) });
        save();
        return { no: v.no, short, order: out || null };
      },
      pick_waiting() { if (!pickOk()) return 0; const b = pickBranch(); return DB.invoices.filter(v => v.pick_state === 'waiting' && ['done', 'preparing', 'ready'].includes(v.status) && (!b || v.branch_id === b)).length; },
      set_customer_password(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const pw = String(a.p_pw || '');
        if (pw.length < 6 || pw.length > 72) fail('bad password', '22023');
        const c = DB.customers.find(x => x.user_id === a.p_user), u = DB.users.find(x => x.id === a.p_user);
        if (!c || !u || DB.admins.includes(a.p_user) || DB.staff.some(x => x.user_id === a.p_user)) fail('merchant not found');
        u.password = pw;
        logAct('customer_password', a.p_user, shopOrName(c), null, { phone: c.phone });
        save(); return null;
      },
      list_suppliers(a) {
        if (!uid() || !hasPerm('costs')) fail('not authorized', '42501');
        const L = suppliers(), q = norm(String(a.p_q || '').trim());
        const hit = L.filter(r => (!q || norm(r.name).includes(q)) && (!a.p_owing || r.balance > 0)).sort(owingFirst), owing = L.filter(r => r.balance > 0);
        return { owing_total: money2(owing.reduce((k, r) => k + r.balance, 0)), owing_count: owing.length, total: hit.length, items: page(hit, a, 30) };
      },
      supplier_detail(a) {
        if (!uid() || !hasPerm('costs')) fail('not authorized', '42501');
        const pu = DB.purchases.filter(v => supKey(v.supplier) === a.p_key).sort(newest);
        if (!pu.length) return null;
        const pays = DB.supplier_payments.filter(p => supKey(p.supplier) === a.p_key).sort(newest);
        const due = pu.reduce((k, v) => k + v.total - (v.paid == null ? v.total : v.paid), 0), paid = pays.reduce((k, p) => k + p.amount, 0);
        return { key: a.p_key, name: pu[0].supplier.trim(), count: pu.length, total: pu.reduce((k, v) => k + v.total, 0), due, paid_later: paid, balance: money2(due - paid),
          receipts: pu.slice(0, 50).map(v => ({ id: v.id, no: v.no, created_at: v.created_at, total: v.total, paid: v.paid == null ? v.total : v.paid, items_count: v.items_count, branch_name: (shopOf(v.branch_id) || {}).name || null })),
          payments: pays.map(p => ({ id: p.id, amount: p.amount, note: p.note, staff_name: p.staff_name, created_at: p.created_at })) };
      },
      add_supplier_payment(a) {
        if (!uid() || !(hasPerm('costs') && hasPerm('purchases'))) fail('not authorized', '42501');
        const amt = numOf(a.p_amount);
        if (amt == null || amt <= 0 || amt > 99999999) fail('bad amount', '22023');
        const v = DB.purchases.filter(x => supKey(x.supplier) === a.p_key).sort(newest)[0];
        if (!v) fail('supplier not found');
        const sp = { id: ++DB.pay_seq, supplier: v.supplier.trim().slice(0, 120), amount: money2(amt), staff_id: uid(), staff_name: meName(), note: String(a.p_note || '').slice(0, 300), created_at: now() };
        DB.supplier_payments.push(sp);
        logAct('pay_out', sp.id, sp.supplier, sp.amount, { note: sp.note || undefined, by: sp.staff_name || undefined });
        save();
        return RPC.supplier_detail({ p_key: a.p_key });
      },
      delete_supplier_payment(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const x = DB.supplier_payments.find(p => p.id === a.p_id);
        if (x) { DB.supplier_payments = DB.supplier_payments.filter(p => p !== x); logAct('pay_out_del', x.id, x.supplier, x.amount, { note: x.note || undefined, by: x.staff_name || undefined }); }
        save(); return null;
      },
      add_expense(a) {
        const p = a.p || {};
        if (!uid() || !hasPerm('expenses')) fail('not authorized', '42501');
        const amt = numOf(p.amount);
        if (amt == null || amt <= 0 || amt > 99999999) fail('bad amount', '22023');
        const day = p.spent_on ? String(p.spent_on).slice(0, 10) : dayOf(new Date());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(Date.parse(day)) || day > dayOf(new Date(Date.now() + 864e5)) || day < dayOf(new Date(Date.now() - 3660 * 864e5))) fail('bad date', '22023');
        const st = staffRow(), r = { id: ++DB.exp_seq, branch_id: (st && st.branch_id) || p.branch || null, cat: EXP_CATS.includes(p.cat) ? p.cat : 'other', amount: money2(amt), spent_on: day,
          note: String(p.note || '').slice(0, 300), staff_id: uid(), staff_name: meName(), created_at: now() };
        DB.expenses.push(r);
        logAct('expense', r.id, r.cat, r.amount, { note: r.note || undefined, by: r.staff_name || undefined, day: r.spent_on }); save();
        const o = { ...r }; delete o.staff_id; return o;
      },
      list_expenses(a) {
        if (!uid() || !(hasPerm('expenses') || hasPerm('costs'))) fail('not authorized', '42501');
        const e = DB.expenses.filter(x => (!a.p_from || x.spent_on >= a.p_from) && (!a.p_to || x.spent_on < a.p_to)).sort((x, y) => y.spent_on.localeCompare(x.spent_on) || y.id - x.id);
        const by = {}; e.forEach(x => { by[x.cat] = money2((by[x.cat] || 0) + x.amount); });
        return { total: e.length, sum: money2(e.reduce((k, x) => k + x.amount, 0)), by_cat: by,
          items: page(e, a, 50).map(x => { const o = { ...x, branch_name: (shopOf(x.branch_id) || {}).name || null, mine: x.staff_id === uid() }; delete o.staff_id; return o; }) };
      },
      delete_expense(a) {
        if (!uid() || !hasPerm('expenses')) fail('not authorized', '42501');
        const x = DB.expenses.find(e => e.id === a.p_id);
        if (!x || !(isAdmin() || x.staff_id === uid())) fail('not authorized', '42501');
        DB.expenses = DB.expenses.filter(e => e !== x);
        logAct('expense_del', x.id, x.cat, x.amount, { note: x.note || undefined, by: x.staff_name || undefined, day: x.spent_on }); save(); return null;
      },
      pnl_report(a) {
        if (!uid() || !hasPerm('costs')) fail('not authorized', '42501');
        const span = t => t && t >= a.p_from && t < a.p_to, br = x => !a.p_branch || x === a.p_branch, sum = (l, f) => l.reduce((k, x) => k + (Number(f(x)) || 0), 0);
        const inv = DB.invoices.filter(v => v.status === 'done' && span(v.created_at) && br(v.branch_id)), ids = new Set(inv.map(v => v.id));
        const items = DB.invoice_items.filter(i => ids.has(i.invoice_id)), ci = {};
        items.forEach(i => { ci[i.invoice_id] = (ci[i.invoice_id] || 0) + (i.cost || 0) * i.qty; });
        const d0 = dayOf(new Date(a.p_from)), d1 = dayOf(new Date(a.p_to));
        const ex = DB.expenses.filter(e => e.spent_on >= d0 && e.spent_on < d1 && br(e.branch_id)), mv = DB.stock_moves.filter(m => span(m.created_at) && br(m.branch_id));
        const ret = DB.invoices.filter(v => v.status === 'returned' && span(v.returned_at) && br(v.branch_id));
        /* parts returned from sales that stay sales, and what the period's sales brought in (the ones returned since too) */
        const rp = (DB.invoice_returns || []).filter(r => span(r.created_at) && br((DB.invoices.find(v => v.id === r.invoice_id) || {}).branch_id));
        const sold = DB.invoices.filter(v => ['done', 'returned'].includes(v.status) && span(v.created_at) && br(v.branch_id));
        const byCat = {}, byReason = {}, st = {};
        ex.forEach(e => { byCat[e.cat] = money2((byCat[e.cat] || 0) + e.amount); });
        mv.forEach(m => { byReason[m.reason] = money2((byReason[m.reason] || 0) + m.qty * (m.cost || 0)); });
        inv.forEach(v => { const k = v.staff_name || '—'; st[k] = st[k] || { name: k, count: 0, total: 0, c: 0 }; st[k].count++; st[k].total += v.total; st[k].c += ci[v.id] || 0; });
        const sales = sum(inv, v => v.total), cogs = sum(Object.values(ci), x => x), expenses = sum(ex, e => e.amount), stockAdj = sum(mv, m => m.qty * (m.cost || 0));
        return { count: inv.length, sales, discount: sum(inv, v => v.discount), cogs: money2(cogs), cost_missing: items.filter(i => i.cost == null).length, expenses: money2(expenses), by_cat: byCat,
          stock_adj: money2(stockAdj), stock_by_reason: byReason, returned_count: ret.length + rp.length, returned_total: money2(sum(ret, v => v.total) + sum(rp, r => r.amount)),
          by_staff: Object.values(st).map(x => ({ name: x.name, count: x.count, total: x.total, profit: money2(x.total - x.c) })).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name)),
          receivable: money2(sum(buyers().filter(b => b.balance > 0), b => b.balance)), payable: money2(sum(suppliers().filter(r => r.balance > 0), r => r.balance)),
          /* the money that came in and went out in the period (the System tab's «الرصيد الكلي») */
          cash_in: money2(sum(sold, v => v.paid + (v.refunded || 0)) + sum(DB.customer_payments.filter(p => span(p.created_at)), p => p.amount)),
          cash_out: money2(sum(DB.purchases.filter(p => span(p.created_at) && br(p.branch_id)), p => p.paid == null ? p.total : p.paid) + sum(DB.supplier_payments.filter(p => span(p.created_at)), p => p.amount)
            + expenses + sum(ret, v => v.paid) + sum(rp, r => r.refund)),
          gross: money2(sales - cogs), net: money2(sales - cogs - expenses + stockAdj) };
      },

      /* ---------- owner controls (supabase/setup.sql section 12) ---------- */
      /* the AI assistant (supabase/setup.sql section 14): who may use it, the day's limit, its log line, and the manager's view of the use */
      ai_access() { return aiAccess(); },
      ai_gate(a) {
        const acc = aiAccess(), day = tripoliDay();
        if (!acc.ok) fail('ai not allowed', '42501');
        if (!a.p_turn) fail('bad turn', '22023');
        const st = DB.settings, lim = acc.role === 'admin' ? null : +st.ai_daily || 40, mine = () => DB.ai_turns.filter(x => x.user_id === uid() && x.day === day).length;
        let r = DB.ai_turns.find(x => x.user_id === uid() && x.turn === a.p_turn);
        if (!r) { if (lim != null && mine() >= lim) fail('ai daily limit'); r = { user_id: uid(), turn: a.p_turn, day, calls: 0, created_at: now() }; DB.ai_turns.push(r); }
        if (r.calls + 1 > 12) fail('ai too many steps');
        r.calls++; save();
        const on = staffRow(), cust = (DB.customers || []).find(c => c.user_id === uid()), br = on && DB.shops.find(x => x.id === on.branch_id);
        return { ...acc, left: lim == null ? null : Math.max(lim - mine(), 0), me: (on && on.name) || (cust && cust.name) || '', branch: br ? br.name : null,
          name: st.ai_name, rules: st.ai_rules, bot_rules: st.bot_rules, company: st.brand_name, about: String(st.about || '').slice(0, 1500), contact: st.contact_wa, address: st.address,
          price_mode: st.price_mode, orders: st.orders_enabled !== false && !st.shop_closed };
      },
      ai_log(a) {
        const acc = aiAccess();
        if (!acc.ok || acc.role === 'customer') fail('not authorized', '42501');
        const d = {}; if (a.p_tool) d.tool = String(a.p_tool).slice(0, 40); if (a.p_ask) d.ask = String(a.p_ask).slice(0, 300);
        logAct('ai', String(a.p_ref || '').slice(0, 80), String(a.p_what || '').slice(0, 200), null, d); save(); return null;
      },
      ai_usage(a) {
        if (!isAdmin()) fail('not authorized', '42501');
        const days = Math.min(Math.max(+a.p_days || 1, 1), 90), from = tripoliDay(-(days - 1)), g = {};
        DB.ai_turns.filter(x => x.day >= from).forEach(x => { const r = g[x.user_id] = g[x.user_id] || { user_id: x.user_id, messages: 0, calls: 0 }; r.messages++; r.calls += x.calls; });
        return Object.values(g).map(r => { const f = DB.staff.find(x => x.user_id === r.user_id), c = (DB.customers || []).find(x => x.user_id === r.user_id), u = DB.users.find(x => x.id === r.user_id);
          return { ...r, name: (f && f.name) || (c && c.name) || (u && u.email) || '' }; }).sort((x, y) => y.messages - x.messages || x.name.localeCompare(y.name));
      },
      list_activity(a) {
        if (!uid() || !isAdmin()) fail('not authorized', '42501');
        const q = String(a.p_q || '').trim(), nq = norm(q), g = a.p_group || null, has = (x, k) => !!x.detail && Object.prototype.hasOwnProperty.call(x.detail, k);
        const inGroup = x => !g || (g === 'sales' ? ['sale', 'return', 'return_part', 'order', 'order_ready', 'order_done', 'order_cancelled', 'picked'].includes(x.kind)
          : g === 'stock' ? ['receive', 'receipt_undo', 'stock', 'product_add', 'product_del', 'sync', 'import'].includes(x.kind) || (x.kind === 'product_edit' && (has(x, 'qty') || has(x, 'title') || has(x, 'status')))
          : g === 'prices' ? ['bulk_price', 'bulk_undo'].includes(x.kind) || (x.kind === 'product_edit' && (has(x, 'price') || has(x, 'cost') || has(x, 'hide_price')))
          : g === 'money' ? ['pay_in', 'pay_in_del', 'pay_out', 'pay_out_del', 'expense', 'expense_del'].includes(x.kind)
          : g === 'admin' ? ['staff', 'staff_del', 'settings', 'customer'].includes(x.kind) : g === 'ai' ? x.kind === 'ai' : true);
        const hit = DB.activity.filter(x => (!a.p_from || x.created_at >= a.p_from) && (!a.p_to || x.created_at < a.p_to) && (!a.p_actor || x.actor_id === a.p_actor)
          && (!q || norm(x.title).includes(nq) || String((x.detail || {}).no) === q || norm(x.actor_name).includes(nq)) && inGroup(x)).sort(newest);
        const people = {};
        DB.activity.slice().sort((x, y) => x.created_at.localeCompare(y.created_at)).forEach(x => {
          if (!x.actor_id) return; const r = people[x.actor_id] = people[x.actor_id] || { id: x.actor_id, name: '', count: 0 }; r.name = x.actor_name; r.count++;
        });
        return { total: hit.length, items: page(hit, a, 50), actors: Object.values(people).sort((x, y) => y.count - x.count) };
      },
      /* taking a receipt back: the parts go out again, the costs and prices it set go back, parts it created that nothing else uses are removed */
      undo_receipt(a) {
        if (!uid() || !hasPerm('purchases')) fail('not authorized', '42501');
        const v = DB.purchases.find(x => x.id === a.p_id);
        if (!v) fail('receipt not found');
        if (!isAdmin() && (v.staff_id !== uid() || Date.parse(v.created_at) < Date.now() - 864e5)) fail('not authorized', '42501');
        const its = DB.purchase_items.filter(i => i.purchase_id === v.id), need = {};
        its.forEach(i => { if (i.product_id) need[i.product_id] = (need[i.product_id] || 0) + i.qty; });
        const bad = Object.keys(need).map(id => DB.products.find(p => p.id === id)).filter(p => p && (p.qty || 0) < need[p.id]).map(p => p.title).sort();
        if (bad.length) fail('already sold: ' + bad.join('، '));
        let back = 0;
        its.slice().sort((x, y) => y.id - x.id).forEach(i => {
          const pr = i.product_id && DB.products.find(p => p.id === i.product_id); if (!i.product_id) return; back++; if (!pr) return;
          pr.qty = (pr.qty || 0) - i.qty; if (pr.qty <= 0) pr.status = 'sold';
          if (i.cost != null && 'prev_cost' in i && pr.cost === i.cost) pr.cost = i.prev_cost;
          if (i.set_price != null && 'prev_price' in i && pr.price === i.set_price) pr.price = i.prev_price;
          pr.updated_at = now();
        });
        const used = id => DB.invoice_items.some(x => x.product_id === id) || DB.purchase_items.some(x => x.product_id === id && x.purchase_id !== v.id) || DB.stock_moves.some(m => m.product_id === id);
        const gone = new Set(its.filter(i => i.created).map(i => i.product_id).filter(id => { const pr = DB.products.find(p => p.id === id); return pr && (pr.qty || 0) === 0 && !used(id); }));
        DB.products = DB.products.filter(p => !gone.has(p.id));
        logAct('receipt_undo', v.id, v.supplier.trim() || null, v.total, { no: v.no, by: v.staff_name, at: v.created_at, parts: back, removed: gone.size, lines: its.slice(0, 100).map(i => [i.title, i.qty, i.cost]) });
        DB.purchases = DB.purchases.filter(x => x !== v); DB.purchase_items = DB.purchase_items.filter(i => i.purchase_id !== v.id);
        save();
        return { no: v.no, parts: back, removed: gone.size };
      },
      /* prices in bulk: by a percent, an amount, or cost + a margin, rounded up to a step; each change can be put back */
      bulk_price(a) {
        const p = a.p || {};
        if (!uid() || !isAdmin()) fail('not authorized', '42501');
        const mode = p.mode || 'pct', v = numOf(p.value), rd = numOf(p.round) || 0;
        if (!['pct', 'add', 'margin'].includes(mode)) fail('bad mode', '22023');
        if (v == null || (mode === 'pct' && (v === 0 || v <= -100 || v > 1000)) || (mode === 'add' && (v === 0 || Math.abs(v) > 1000000)) || (mode === 'margin' && (v < 0 || v > 1000))) fail('bad value', '22023');
        if (![0, 0.25, 0.5, 1, 5, 10].includes(rd)) fail('bad rounding', '22023');
        const q = String(p.q || '').trim(), nq = norm(q), uq = q.toUpperCase();
        const rows = DB.products.filter(x => (!p.make || x.make === p.make) && (!p.cat || x.cat === p.cat) && (!p.shop || x.shop_id === p.shop)
          && (!q || norm(x.title).includes(nq) || String(x.sku || '').toUpperCase().startsWith(uq) || String(x.part_no || '').toUpperCase().startsWith(uq))
          && (mode === 'margin' ? x.cost != null : x.price != null)).map(x => {
          const raw = money2(mode === 'pct' ? x.price * (1 + v / 100) : mode === 'add' ? x.price + v : x.cost * (1 + v / 100));
          return { id: x.id, title: x.title, old: x.price, cost: x.cost, new: money2(Math.max(rd > 0 ? Math.ceil(raw / rd - 1e-9) * rd : raw, 0)) };
        }), ch = rows.filter(r => r.new !== r.old);
        if (p.dry === true) return { count: ch.length, same: rows.length - ch.length, below: ch.filter(r => r.cost != null && r.new < r.cost).length,
          sample: ch.slice().sort((x, y) => x.title.localeCompare(y.title, 'ar')).slice(0, 6).map(r => ({ title: r.title, old: r.old, new: r.new })) };
        if (!ch.length) fail('nothing to change', '22023');
        const batch = ++DB.batch_seq;
        ch.forEach(r => { DB.price_changes.push({ batch, product_id: r.id, old_price: r.old, new_price: r.new }); const x = DB.products.find(y => y.id === r.id); x.price = r.new; x.updated_at = now(); });
        DB.price_changes = DB.price_changes.filter(c => c.batch > batch - 20);
        const d = { mode, value: v, round: rd, count: ch.length }; ['make', 'cat', 'shop'].forEach(k => { if (p[k]) d[k] = p[k]; }); if (q) d.q = q;
        logAct('bulk_price', batch, '', null, d);
        save();
        return { batch, count: ch.length };
      },
      undo_bulk_price(a) {
        if (!uid() || !isAdmin()) fail('not authorized', '42501');
        const cs = DB.price_changes.filter(c => c.batch === Number(a.p_batch));
        if (!cs.length) fail('nothing to undo');
        let n = 0;
        cs.forEach(c => { const x = DB.products.find(y => y.id === c.product_id); if (x && x.price === c.new_price) { x.price = c.old_price; x.updated_at = now(); n++; } });
        DB.price_changes = DB.price_changes.filter(c => c.batch !== Number(a.p_batch));
        logAct('bulk_undo', a.p_batch, '', null, { count: n, kept: cs.length - n });
        save();
        return { count: n, kept: cs.length - n };
      },
      price_batches() {
        if (!isAdmin()) return null;
        const m = {};
        DB.price_changes.forEach(c => { m[c.batch] = (m[c.batch] || 0) + 1; });
        return Object.keys(m).map(Number).sort((x, y) => y - x).slice(0, 5).map(b => {
          const l = DB.activity.find(x => x.kind === 'bulk_price' && x.ref === String(b)) || {};
          return { batch: b, count: m[b], created_at: l.created_at || null, by: l.actor_name || null, detail: l.detail || null };
        });
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
  window.SPARAT_DEMO = { create, realPhoto, key: KEY, reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_session'); } catch (e) { /* ignore */ } } };
})();
