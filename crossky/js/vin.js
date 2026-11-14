/* Sparat VIN (chassis number) reader.
   1) Offline: format check, check digit, country of manufacture, world manufacturer code (WMI), model year.
   2) Online: NHTSA vPIC open database (US public domain) for model, trim, engine and more.
   Results are mapped onto SP_DATA brands/models so "My car" can be filled in automatically. */
(function () {
  'use strict';
  var ORDER = 'ABCDEFGHJKLMNPRSTUVWXYZ1234567890';

  /* Country of manufacture by the first one or two characters (ISO 3780 / SAE assignments). */
  var RANGES = 'AA-AH:ZA AJ-AN:CI BA-BE:AO BF-BK:KE BL-BR:TZ BU:UG CA-CB:EG CC-CE:BJ CF-CK:MG CL-CR:TN DA-DE:EG DF-DK:MA DL-DR:ZM ' +
    'E:RU FA-FE:GH FF-FK:NG H:CN J:JP KA-KE:LK KF-KK:IL KL-KR:KR KS-K0:KZ L:CN MA-ME:IN MF-MK:ID ML-MR:TH MS:MM MX:KZ MY-M0:IN ' +
    'NA-NE:IR NF-NK:PK NL-NR:TR NS-NT:UZ PA-PE:PH PF-PK:SG PL-PR:MY PS-PT:BD PV:KH RA-RE:AE RF-RK:TW RL-RN:VN RS-RT:SA RU-RW:RU R1-R7:HK ' +
    'SA-SM:GB SN-ST:DE SU-SZ:PL S1-S4:LV TA-TH:CH TJ-TP:CZ TR-TV:HU TW-T2:PT UH-UM:DK UN-UR:IE UU-UZ:RO U1-U2:MK U5-U7:SK ' +
    'VA-VE:AT VF-VR:FR VS-VW:ES VX-V2:FR V3-V5:HR V6-V8:EE W:DE XA-XE:BG XF-XK:GR XL-XR:NL XS-XW:RU XX-XY:LU XZ-X0:RU ' +
    'YA-YE:BE YF-YK:FI YL-YR:MT YS-YW:SE YX-Y2:NO Y3-Y5:BY Y6-Y0:UA ZA-ZU:IT ZX-ZZ:SI Z3-Z5:LT Z6-Z0:RU ' +
    '1:US 4:US 5:US 2:CA 3:MX 6A-6W:AU 7A-7E:NZ 7F-70:US 8A-8E:AR 8F-8J:CL 8L-8R:EC 8S-8W:PE 8X-81:VE 82:BO 84:CR ' +
    '9A-9E:BR 9F-9J:CO 9S-9W:UY 91-90:BR';

  /* World manufacturer identifiers, grouped by brand id in SP_DATA. */
  var WMI_BY_BRAND = {
    toyota: 'JT1 JT2 JT3 JT4 JTD JTE JTF JTG JTK JTL JTM JTN JTP 4T1 4T3 4T4 4TA 5TB 5TD 5TE 5TF 5YF 2T1 2T3 3TM 3TY 3MY MR0 MR1 MR2 MHF MBJ NMT SB1 VNK AHT 8AJ 9BR 93R 6T1 LTV LVG LFM RL4 YAR TW1 WZ1 7MU 7SV 7A4 4G3',
    lexus: 'JTH JTJ JT6 JT8 2T2 58A',
    nissan: 'JN1 JN6 JN8 SJN VSK VNV MNT LGB LJN 1N4 1N6 5N1 3N1 3N6 3N8 ADN 94D 8AN 6F4 MDH PN8 7A7 4N2',
    infiniti: 'JNK JNR 5N3 SJK 3PC',
    honda: 'JHM JHL JHG 1HG 19X 5FN 5FP 5J6 5KB 2HG 2HJ 2HK 3HG 3CZ SHH SHS 93H MRH LHG LUC LVH MAK MHR NLA PAD PMH RKT 8C3 7FA 7A3 NFB',
    acura: 'JH4 19U 19V 2HH 2HN 5J8 5FR 4W5 JAE',
    mazda: 'JM0 JM1 JM2 JM3 JM4 JM6 JM7 JMZ 3MZ 3MD 3MV 1YV 4F2 4F4 MM0 MM6 MM7 MM8 LVR PE3 7MM MP2 AFB 8LF',
    mitsubishi: 'JA3 JA4 JA7 JE4 JMA JMB JMF JMY MMA MMB MMC MMD MMT 4A3 4A4 4P3 KPH LL6 ABJ 6MM 7A1',
    subaru: 'JF1 JF2 JF3 JF4 4S3 4S4 MMR PLP',
    suzuki: 'JS2 JS3 JS4 JSA JG1 JG7 JGC TSM VSE MHD MHY MMS MS3 PMS PPP 2S2 2S3 5Z6 8AK',
    isuzu: 'JAA JAB JAL J8Z MPA PLZ RLE ACV 4S1 4S2',
    daihatsu: 'JDA JD1 JD2 JD4 MHK',
    hyundai: 'KMH KM8 KMF KMJ 5NM 5NP 5NT MAL TMA TMC NLH NLJ LBE X7M Z94 9BH MF3 MX3 PL8 PP3 PFD AC5',
    kia: 'KNA KNB KNC KND KNE KNJ U5Y U6Y 5XX 5XY 3KP LJD MZB 9UW',
    genesis: 'KMT KMU',
    ssangyong: 'KPT KPA KPB',
    daewoo: 'KLA KLY UU6 XWB',
    chevrolet: '1G1 1GC 1GN 2G1 2GN 3G1 3GC 3GN KL1 KL7 KL8 9BG',
    gmc: '1GT 1GK 2GT 2GK 3GT 3GK',
    cadillac: '1G6 1GY',
    buick: '1G4 2G4 5GA KL4',
    pontiac: '1G2 5Y2 6G2',
    oldsmobile: '1G3',
    saturn: '1G8 5GZ',
    hummer: '5GR 5GT',
    holden: '6G1 6H8',
    ford: '1FA 1FB 1FC 1FD 1FM 1FT 1ZV 2FA 2FM 2FT 3FA 3FM 3FT NM0 WF0 MAJ 6FP 8AF 9BF AFA',
    lincoln: '1LN 2LM 3LN 5LM',
    mercury: '1ME 2ME 4M2',
    jeep: '1J4 1J8 ZAC',
    ram: '1C6 3C6 3D7 1D7',
    dodge: '1B3 2B3 1B4 1D4 2D4 2D8',
    chrysler: '2A4 2A8 1A4 1A8',
    tesla: '5YJ 7SA LRW XP7',
    lucid: '50E',
    rivian: '7FC 7PD',
    mercedes: 'WDB WDC WDD WDF W1K W1N W1V W1X 4JG 55S VSA LE4',
    smart: 'WME',
    bmw: 'WBA WBS WBX WBY 4US 5UX 5YM LBV X4X',
    mini: 'WMW WMZ',
    volkswagen: 'WVW WVG WV1 WV2 WV3 3VW 3VV 1VW 1V2 9BW AAV 8AW LSV XW8',
    audi: 'WAU WA1 WUA TRU',
    porsche: 'WP0 WP1',
    skoda: 'TMB',
    seat: 'VSS',
    opel: 'W0L W0V VXK',
    man: 'WMA',
    renault: 'VF1 X7L 93Y 8A1 KNM MEE',
    dacia: 'UU1 UU3',
    peugeot: 'VF3 VR3',
    citroen: 'VF7 VR7',
    ds: 'VR1',
    bugatti: 'VF9',
    fiat: 'ZFA 9BD NM4 3C3',
    ferrari: 'ZFF',
    lamborghini: 'ZHW',
    maserati: 'ZAM',
    alfaromeo: 'ZAR ZAS',
    lancia: 'ZLA',
    iveco: 'ZCF',
    jaguar: 'SAJ',
    landrover: 'SAL',
    rollsroyce: 'SCA',
    bentley: 'SCB SJA',
    astonmartin: 'SCF',
    lotus: 'SCC LJU',
    mclaren: 'SBM',
    rover: 'SAR',
    mg: 'LSJ SDP MML MZ7 LNP',
    maxus: 'LSH',
    volvo: 'YV1 YV4 LVY 7JR',
    polestar: 'LPS YSM',
    saab: 'YS3',
    scania: 'YS2',
    daf: 'XLR',
    chery: 'LVV LVT LVU LVM 98R 9UJ',
    geely: 'LB3 L6T Y4K',
    byd: 'LGX LC0',
    greatwall: 'LGW XZG X9X MNU 8L4',
    changan: 'LS5 LS4',
    wuling: 'LZW MK3',
    jac: 'LJ1',
    baic: 'LNB LHB',
    dongfeng: 'LGJ LDP',
    dfsk: 'LVZ',
    faw: 'LFP',
    gac: 'LMG',
    brilliance: 'LSY',
    lifan: 'LLV',
    haima: 'LH1 LMV',
    zotye: 'LJ8',
    foton: 'LVA LVB LVC',
    jmc: 'LEF',
    xpeng: 'L1N',
    liauto: 'LW4',
    leapmotor: 'LFZ',
    neta: 'LUZ',
    aito: 'LM8',
    proton: 'PL1',
    perodua: 'PM2',
    tata: 'MAT',
    mahindra: 'MA1 MAB MAC',
    maruti: 'MA3',
    lada: 'XTA',
    uaz: 'XTT',
    gaz: 'X96',
    ikco: 'NAA',
    saipa: 'NAS'
  };
  /* Joint ventures and shared codes: the maker is known, the brand is not. */
  var WMI_NAMES = {
    LSG: 'SAIC-GM', LFV: 'FAW-Volkswagen', LDC: 'Dongfeng Peugeot-Citroën', LVS: 'Changan Ford', LWV: 'GAC (joint venture)',
    '1C3': 'Chrysler / Dodge', '2C3': 'Chrysler / Dodge', '1C4': 'Chrysler / Dodge / Jeep', '2C4': 'Chrysler / Dodge',
    '3C4': 'Chrysler / Dodge / Jeep', '1GB': 'Chevrolet / GMC', '1GD': 'GMC / Chevrolet'
  };
  var PREFIX_BRAND = { JT: 'toyota', JN: 'nissan', JF: 'subaru', KN: 'kia', KM: 'hyundai', WV: 'volkswagen', WD: 'mercedes', W1: 'mercedes', WB: 'bmw', TM: 'skoda', ZF: 'fiat', SA: null };
  var PREFIX_NAME = { '1G': 'General Motors', '2G': 'General Motors', '3G': 'General Motors', '1C': 'Stellantis (Chrysler)', '2C': 'Stellantis (Chrysler)', '3C': 'Stellantis (Chrysler)', '1F': 'Ford', '2F': 'Ford', '3F': 'Ford', VF: 'Stellantis / Renault' };

  var WMI = {};
  Object.keys(WMI_BY_BRAND).forEach(function (b) { WMI_BY_BRAND[b].split(' ').forEach(function (w) { if (w) WMI[w] = b; }); });

  var COUNTRY1 = {}, COUNTRY2 = {};
  RANGES.split(' ').forEach(function (tok) {
    var p = tok.split(':'), r = p[0], cc = p[1];
    if (r.length === 1) { COUNTRY1[r] = cc; return; }
    var a = r.split('-'), from = a[0], to = a[1] || a[0];
    var i0 = ORDER.indexOf(from[1]), i1 = ORDER.indexOf(to[1]);
    for (var i = i0; i <= i1 && i >= 0; i++) COUNTRY2[from[0] + ORDER[i]] = cc;
  });

  function countryOf(vin) {
    if (!vin) return null;
    return COUNTRY2[vin.slice(0, 2)] || COUNTRY1[vin[0]] || null;
  }

  /* Uppercase, drop separators, fix the letters a VIN never uses. */
  function clean(raw) {
    var s = String(raw || '').toUpperCase().replace(/[\s\-_.·•:/\\]+/g, '');
    var fixed = /[OQI]/.test(s);
    s = s.replace(/[OQ]/g, '0').replace(/I/g, '1');
    return { vin: s, fixed: fixed };
  }
  function looksJdm(raw) {
    var s = String(raw || '').toUpperCase().trim();
    return /^[A-Z]{2,6}\d{0,3}[A-Z]?\s*-\s*\d{5,8}$/.test(s);
  }
  function validFormat(vin) { return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin); }

  var TRANS = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  var WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  function checkDigit(vin) {
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      var c = vin[i], v = /\d/.test(c) ? +c : TRANS[c];
      if (v == null) return null;
      sum += v * WEIGHTS[i];
    }
    var r = sum % 11;
    return r === 10 ? 'X' : String(r);
  }
  var CHECKED = { US: 1, CA: 1, MX: 1, CN: 1 };

  /* Position 10 is a 30-year cycle. North America: a letter in position 7 means 2010+. */
  var YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
  function modelYear(vin, country) {
    var i = YEAR_CODES.indexOf(vin[9]);
    if (i < 0) return { year: null, sure: false };
    var y1 = 1980 + i, y2 = y1 + 30, maxY = new Date().getFullYear() + 1;
    if (country === 'US' || country === 'CA' || country === 'MX') {
      return { year: /[A-Z]/.test(vin[6]) ? y2 : y1, sure: true };
    }
    var y = y2 <= maxY ? y2 : y1;
    return { year: y, sure: country === 'CN' };
  }

  function brandsList() { return (window.SP_DATA && window.SP_DATA.BRANDS) || []; }
  function brandById(id) { var L = brandsList(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }

  function local(vin) {
    var wmi = vin.slice(0, 3), country = countryOf(vin);
    var brandId = WMI[wmi] || null, maker = WMI_NAMES[wmi] || '';
    if (!brandId && !maker) {
      var p2 = vin.slice(0, 2);
      if (PREFIX_BRAND[p2]) brandId = PREFIX_BRAND[p2];
      else if (PREFIX_NAME[p2]) maker = PREFIX_NAME[p2];
    }
    var b = brandId ? brandById(brandId) : null;
    if (b && !maker) maker = b.en;
    var y = modelYear(vin, country);
    var cd = checkDigit(vin), req = !!CHECKED[country];
    return {
      vin: vin, wmi: wmi, country: country, brandId: b ? b.id : null, maker: maker,
      year: y.year, yearSure: y.sure, checkRequired: req, checkOk: cd == null ? null : cd === vin[8],
      plant: vin[10], serial: vin.slice(11)
    };
  }

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  var BRAND_ALIAS = { vw: 'volkswagen', chevy: 'chevrolet', kgm: 'ssangyong', rangerover: 'landrover', mercedes: 'mercedes', mercedesbenz: 'mercedes', mb: 'mercedes', alfa: 'alfaromeo', rolls: 'rollsroyce', marutisuzuki: 'maruti', irankhodro: 'ikco', seres: 'aito', lynkco: 'lynkco', gmc: 'gmc', ramtrucks: 'ram', mini: 'mini', smart: 'smart' };
  var brandIndex = null;
  function matchBrand(name) {
    var n = norm(name);
    if (!n) return null;
    if (!brandIndex) {
      brandIndex = {};
      brandsList().forEach(function (b) {
        brandIndex[norm(b.id)] = b.id;
        brandIndex[norm(b.en)] = b.id;
        String(b.en).split(/[\/&(]/).forEach(function (part) { var k = norm(part); if (k.length > 1 && !brandIndex[k]) brandIndex[k] = b.id; });
      });
    }
    var id = BRAND_ALIAS[n] || brandIndex[n];
    return id && brandById(id) ? id : null;
  }
  function matchModel(brandId, name) {
    var b = brandById(brandId), n = norm(name);
    if (!b || !n) return null;
    var best = null, bestLen = 0;
    b.models.forEach(function (m) {
      var k = norm(m.en);
      if (!k) return;
      if (k === n) { best = m; bestLen = 1e9; return; }
      if (bestLen < 1e9 && (n.indexOf(k) === 0 || k.indexOf(n) === 0) && k.length > bestLen) { best = m; bestLen = k.length; }
    });
    return best;
  }

  function fuelKey(f, elec) {
    var e = String(elec || ''), s = String(f || '');
    if (/BEV|Battery Electric/i.test(e)) return 'fuelEV';
    if (/HEV|Hybrid/i.test(e)) return 'fuelHybrid';
    if (/diesel/i.test(s)) return 'fuelDiesel';
    if (/electric/i.test(s)) return 'fuelEV';
    if (/flex/i.test(s)) return 'fuelFlex';
    if (/gasoline|petrol/i.test(s)) return 'fuelGas';
    return '';
  }
  function bodyKey(b) {
    var s = String(b || '');
    if (/pickup/i.test(s)) return 'pickup';
    if (/SUV|Sport Utility|Crossover|CUV/i.test(s)) return 'suv';
    if (/sedan|saloon/i.test(s)) return 'sedan';
    if (/hatchback|liftback/i.test(s)) return 'hatch';
    if (/coupe/i.test(s)) return 'coupe';
    if (/convertible|cabriolet|roadster/i.test(s)) return 'conv';
    if (/wagon/i.test(s)) return 'wagon';
    if (/van|minivan|bus/i.test(s)) return 'van';
    return '';
  }
  function transKey(t) {
    var s = String(t || '');
    if (/CVT|Continuously/i.test(s)) return 'CVT';
    if (/DCT|Dual.Clutch/i.test(s)) return 'DCT';
    if (/AMT|Automated Manual/i.test(s)) return 'AMT';
    if (/manual|standard/i.test(s)) return 'transMT';
    if (/auto/i.test(s)) return 'transAT';
    return '';
  }

  function shape(x) {
    function v(k) { var s = x[k]; s = s == null ? '' : String(s).trim(); return s && s !== 'Not Applicable' && s !== 'null' ? s : ''; }
    var drive = v('DriveType').split('/')[0].trim();
    var liters = parseFloat(v('DisplacementL'));
    return {
      make: v('Make'), model: v('Model'), year: parseInt(v('ModelYear'), 10) || null,
      trim: [v('Trim'), v('Series')].filter(Boolean).join(' · '),
      body: v('BodyClass'), bodyKey: bodyKey(v('BodyClass')), doors: parseInt(v('Doors'), 10) || null,
      liters: isFinite(liters) && liters > 0 ? Math.round(liters * 10) / 10 : null,
      cyl: parseInt(v('EngineCylinders'), 10) || null, hp: Math.round(parseFloat(v('EngineHP'))) || null,
      engineModel: v('EngineModel'), fuel: v('FuelTypePrimary'), fuelKey: fuelKey(v('FuelTypePrimary'), v('ElectrificationLevel')),
      drive: drive, trans: v('TransmissionStyle'), transKey: transKey(v('TransmissionStyle')),
      plantCountry: v('PlantCountry'), plantCity: v('PlantCity'), manufacturer: v('Manufacturer'),
      type: v('VehicleType'), errorCode: v('ErrorCode'), errorText: v('ErrorText')
    };
  }

  var CACHE_KEY = 'sp_vin_cache';
  function cacheGet(vin) { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); return c[vin] || null; } catch (e) { return null; } }
  function cachePut(vin, data) {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'), keys = Object.keys(c);
      if (keys.length >= 30) delete c[keys[0]];
      c[vin] = data; localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) { /* storage full or blocked: no cache */ }
  }

  var API = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';
  function online(vin, ms) {
    var hit = cacheGet(vin);
    if (hit) return Promise.resolve(hit);
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || 9000) : null;
    return fetch(API + encodeURIComponent(vin) + '?format=json', ctl ? { signal: ctl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        var x = j && j.Results && j.Results[0];
        if (!x) throw new Error('empty');
        var s = shape(x);
        if (s.make) cachePut(vin, s);
        return s;
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* Full decode: always resolves; `online` tells whether the open database answered. */
  function decode(raw, opts) {
    opts = opts || {};
    var c = clean(raw), vin = c.vin;
    var base = { input: raw, vin: vin, fixed: c.fixed, jdm: looksJdm(raw), valid: validFormat(vin) };
    if (!base.valid) return Promise.resolve(base);
    var loc = local(vin);
    var res = Object.assign(base, loc, { online: false, onlineTried: false, model: null, modelText: '', specs: null });
    if (opts.offline) return Promise.resolve(finish(res));
    res.onlineTried = true;
    return online(vin, opts.timeout).then(function (s) {
      if (s.make) {
        res.online = true;
        res.specs = s;
        var bid = matchBrand(s.make) || res.brandId;
        res.brandId = bid;
        if (s.make) res.maker = s.manufacturer || s.make;
        if (s.year) { res.year = s.year; res.yearSure = true; }
        res.modelText = s.model || '';
      }
      return finish(res);
    }, function () { return finish(res); });
  }
  function finish(res) {
    if (res.brandId && res.modelText) res.model = matchModel(res.brandId, res.modelText);
    var b = res.brandId ? brandById(res.brandId) : null;
    res.brand = b;
    if (res.model && res.year && (res.year < res.model.from - 1 || res.year > res.model.to + 1)) res.yearOutside = true;
    return res;
  }

  /* Interface text for the VIN feature. Order: ar, en, fr, es, de, tr, ru, zh. */
  var T = {
    vin: ["رقم الشاصي (VIN)", "VIN (chassis number)", "Numéro VIN (châssis)", "Número VIN (bastidor)", "Fahrgestellnummer (FIN)", "Şasi numarası (VIN)", "VIN-номер", "车架号（VIN）"],
    vinShort: ["رقم الشاصي", "VIN", "VIN", "VIN", "FIN", "Şasi no", "VIN", "车架号"],
    vinT: ["اعرف سيارتك من رقم الشاصي", "Identify your car by its VIN", "Identifiez votre voiture par son VIN", "Identifica tu coche por su VIN", "Auto per Fahrgestellnummer erkennen", "Aracınızı şasi numarasıyla tanıyın", "Узнайте машину по VIN", "通过车架号识别你的车"],
    vinSub: ["17 خانة من الحروف والأرقام. نقرأ منها الماركة والموديل وسنة الصنع وبلد التصنيع.", "17 letters and digits. We read the brand, model, year and country of manufacture from it.", "17 lettres et chiffres. Nous en tirons la marque, le modèle, l’année et le pays de fabrication.", "17 letras y números. De ellos obtenemos la marca, el modelo, el año y el país de fabricación.", "17 Buchstaben und Ziffern. Daraus lesen wir Marke, Modell, Baujahr und Herstellungsland.", "17 harf ve rakam. Buradan marka, model, yıl ve üretim ülkesini okuruz.", "17 букв и цифр. По ним мы определим марку, модель, год и страну производства.", "17 位字母和数字，可识别品牌、车型、年份和生产国。"],
    vinCta: ["عندك رقم الشاصي؟ نعرف سيارتك منه", "Have your VIN? We’ll identify your car", "Vous avez le VIN ? On identifie votre voiture", "¿Tienes el VIN? Identificamos tu coche", "FIN zur Hand? Wir erkennen Ihr Auto", "Şasi numaranız var mı? Aracınızı tanıyalım", "Есть VIN? Определим вашу машину", "有车架号？帮你识别车辆"],
    vinBtn: ["اقرأ الرقم", "Decode", "Décoder", "Decodificar", "Auslesen", "Çözümle", "Расшифровать", "识别"],
    vinWhere: ["تجده أسفل الزجاج الأمامي جهة السائق، أو على عمود باب السائق، أو في أوراق تسجيل السيارة.", "Find it at the base of the windshield on the driver’s side, on the driver’s door pillar, or on the registration papers.", "Il se trouve en bas du pare-brise côté conducteur, sur le montant de la portière conducteur ou sur la carte grise.", "Está en la base del parabrisas del lado del conductor, en el marco de la puerta del conductor o en la documentación del coche.", "Sie steht unten an der Windschutzscheibe auf der Fahrerseite, an der Säule der Fahrertür oder in der Zulassungsbescheinigung.", "Sürücü tarafında ön camın altında, sürücü kapısı direğinde veya ruhsatta bulunur.", "Его можно найти внизу лобового стекла со стороны водителя, на стойке двери водителя или в документах на машину.", "可在驾驶侧前挡风玻璃下方、驾驶侧门柱或行驶证上找到。"],
    vinBad: ["رقم الشاصي 17 خانة: حروف إنجليزية وأرقام، بدون الحروف O وI وQ.", "A VIN has 17 characters: letters and digits, without O, I or Q.", "Un VIN compte 17 caractères : lettres et chiffres, sans O, I ni Q.", "Un VIN tiene 17 caracteres: letras y números, sin O, I ni Q.", "Eine FIN hat 17 Zeichen: Buchstaben und Ziffern, ohne O, I und Q.", "VIN 17 karakterdir: harf ve rakam, O, I ve Q olmadan.", "VIN состоит из 17 символов: латинские буквы и цифры, без O, I и Q.", "车架号共 17 位，由字母和数字组成，不含 O、I、Q。"],
    vinLen: ["كتبت {n} خانة، والمطلوب 17.", "You entered {n} characters; a VIN has 17.", "Vous avez saisi {n} caractères ; il en faut 17.", "Has escrito {n} caracteres; deben ser 17.", "Sie haben {n} Zeichen eingegeben; nötig sind 17.", "{n} karakter girdiniz; 17 olmalı.", "Вы ввели символов: {n}, а нужно 17.", "你输入了 {n} 位，车架号应为 17 位。"],
    vinJdm: ["هذا يبدو رقم هيكل ياباني وليس VIN من 17 خانة. اختر سيارتك من القائمة.", "This looks like a Japanese frame number, not a 17-character VIN. Pick your car from the list.", "Cela ressemble à un numéro de châssis japonais, pas à un VIN de 17 caractères. Choisissez votre voiture dans la liste.", "Parece un número de chasis japonés, no un VIN de 17 caracteres. Elige tu coche de la lista.", "Das sieht nach einer japanischen Rahmennummer aus, nicht nach einer 17-stelligen FIN. Wählen Sie Ihr Auto aus der Liste.", "Bu, 17 karakterlik VIN değil, Japon şasi (frame) numarasına benziyor. Aracınızı listeden seçin.", "Похоже на японский номер кузова, а не на 17-значный VIN. Выберите машину из списка.", "这像是日本车架号（Frame No.），不是 17 位 VIN。请从列表选择车辆。"],
    vinCheck: ["خانة التحقق (التاسعة) لا تطابق باقي الرقم. ربما فيه حرف خطأ، راجعه.", "The check digit (9th character) doesn’t match. A character may be wrong; please double-check.", "Le caractère de contrôle (9e) ne correspond pas. Un caractère est peut-être erroné.", "El dígito de control (9.º) no coincide. Puede que haya un carácter erróneo.", "Die Prüfziffer (9. Stelle) passt nicht. Vielleicht ist ein Zeichen falsch.", "Kontrol hanesi (9.) uyuşmuyor. Bir karakter yanlış olabilir.", "Контрольный символ (9-й) не совпадает. Возможно, где-то ошибка.", "校验位（第 9 位）不符，可能有字符输错，请核对。"],
    vinFixed: ["صححنا الحرف O إلى صفر والحرف I إلى واحد.", "We changed O to 0 and I to 1.", "Nous avons remplacé O par 0 et I par 1.", "Cambiamos O por 0 e I por 1.", "O wurde zu 0 und I zu 1 korrigiert.", "O harfini 0, I harfini 1 olarak düzelttik.", "Мы заменили O на 0 и I на 1.", "已将 O 改为 0、I 改为 1。"],
    vinReading: ["نقرأ الرقم…", "Reading the VIN…", "Lecture du VIN…", "Leyendo el VIN…", "FIN wird gelesen…", "VIN okunuyor…", "Читаем VIN…", "正在识别…"],
    vinFull: ["تفاصيل كاملة من قاعدة NHTSA المفتوحة", "Full details from the open NHTSA database", "Détails complets issus de la base ouverte NHTSA", "Detalles completos de la base abierta NHTSA", "Vollständige Angaben aus der offenen NHTSA-Datenbank", "Açık NHTSA veritabanından ayrıntılar", "Подробные данные из открытой базы NHTSA", "完整信息来自 NHTSA 开放数据库"],
    vinBasic: ["قراءة من الرقم نفسه. التفاصيل الكاملة غير متوفرة لهذه السيارة، اختر الموديل بنفسك.", "Read from the number itself. Full details aren’t available for this car; pick the model yourself.", "Lecture à partir du numéro seul. Pas de détails complets pour ce véhicule : choisissez le modèle.", "Lectura a partir del propio número. No hay detalles completos para este coche; elige el modelo.", "Aus der Nummer selbst gelesen. Für dieses Auto gibt es keine vollständigen Daten; bitte Modell wählen.", "Numaranın kendisinden okundu. Bu araç için tam bilgi yok; modeli kendiniz seçin.", "Прочитано по самому номеру. Полных данных для этой машины нет — выберите модель.", "仅根据号码本身识别，此车暂无完整信息，请自行选择车型。"],
    vinOff: ["تعذّر الاتصال بقاعدة البيانات، هذه قراءة من الرقم نفسه.", "Couldn’t reach the database; this is read from the number itself.", "Base de données injoignable ; lecture à partir du numéro seul.", "No se pudo conectar con la base de datos; lectura a partir del número.", "Datenbank nicht erreichbar; aus der Nummer selbst gelesen.", "Veritabanına ulaşılamadı; numaranın kendisinden okundu.", "База недоступна; данные прочитаны по самому номеру.", "无法连接数据库，以下仅根据号码识别。"],
    vinUnknown: ["لم نتعرف على الصانع من هذا الرقم. راجع الرقم أو اختر سيارتك من القائمة.", "We couldn’t identify the maker. Check the number or pick your car from the list.", "Constructeur non reconnu. Vérifiez le numéro ou choisissez dans la liste.", "No reconocimos el fabricante. Revisa el número o elige tu coche de la lista.", "Hersteller nicht erkannt. Nummer prüfen oder Auto aus der Liste wählen.", "Üretici tanınamadı. Numarayı kontrol edin veya listeden seçin.", "Производитель не определён. Проверьте номер или выберите машину из списка.", "无法识别制造商，请核对号码或从列表选择。"],
    vinMaker: ["الصانع", "Manufacturer", "Constructeur", "Fabricante", "Hersteller", "Üretici", "Производитель", "制造商"],
    vinMade: ["بلد التصنيع", "Built in", "Fabriqué en", "Fabricado en", "Gebaut in", "Üretim yeri", "Страна сборки", "生产国"],
    vinYear: ["سنة الموديل", "Model year", "Année modèle", "Año del modelo", "Modelljahr", "Model yılı", "Модельный год", "车型年份"],
    vinApprox: ["تقريبية", "approx.", "approx.", "aprox.", "ca.", "yaklaşık", "примерно", "约"],
    vinTrim: ["الفئة", "Trim", "Finition", "Versión", "Ausstattung", "Donanım", "Комплектация", "配置"],
    vinBody: ["الهيكل", "Body", "Carrosserie", "Carrocería", "Karosserie", "Kasa", "Кузов", "车身"],
    vinEngine: ["المحرك", "Engine", "Moteur", "Motor", "Motor", "Motor", "Двигатель", "发动机"],
    vinFuel: ["الوقود", "Fuel", "Carburant", "Combustible", "Kraftstoff", "Yakıt", "Топливо", "燃料"],
    vinDrive: ["الدفع", "Drive", "Transmission", "Tracción", "Antrieb", "Çekiş", "Привод", "驱动"],
    vinTrans: ["ناقل الحركة", "Gearbox", "Boîte", "Caja de cambios", "Getriebe", "Şanzıman", "КПП", "变速箱"],
    vinPlant: ["المصنع", "Plant", "Usine", "Planta", "Werk", "Fabrika", "Завод", "工厂"],
    vinUse: ["اعتمدها سيارتي", "Set as my car", "Définir comme ma voiture", "Usar como mi coche", "Als mein Auto speichern", "Aracım olarak kaydet", "Сделать моей машиной", "设为我的车"],
    vinParts: ["قطع تركب عليها", "Parts that fit it", "Pièces compatibles", "Piezas compatibles", "Passende Teile", "Uyumlu parçalar", "Подходящие детали", "适配配件"],
    vinMsg: ["\nرقم الشاصي: {v}", "\nVIN: {v}", "\nVIN : {v}", "\nVIN: {v}", "\nFIN: {v}", "\nŞasi no: {v}", "\nVIN: {v}", "\n车架号：{v}"],
    vinSource: ["المصدر: قاعدة NHTSA الأمريكية المفتوحة وجدول أكواد مصانع العالم.", "Source: the open US NHTSA database and the world manufacturer code table.", "Source : base ouverte NHTSA (États-Unis) et table mondiale des codes constructeurs.", "Fuente: base abierta NHTSA (EE. UU.) y tabla mundial de códigos de fabricantes.", "Quelle: offene NHTSA-Datenbank (USA) und weltweite Herstellercode-Tabelle.", "Kaynak: ABD NHTSA açık veritabanı ve dünya üretici kod tablosu.", "Источник: открытая база NHTSA (США) и мировая таблица кодов производителей.", "来源：美国 NHTSA 开放数据库与全球制造商代码表。"],
    vinOr: ["أو اختر يدوياً", "or choose manually", "ou choisissez manuellement", "o elige manualmente", "oder manuell wählen", "veya elle seçin", "или выберите вручную", "或手动选择"],
    fuelGas: ["بنزين", "Petrol", "Essence", "Gasolina", "Benzin", "Benzin", "Бензин", "汽油"],
    fuelDiesel: ["ديزل", "Diesel", "Diesel", "Diésel", "Diesel", "Dizel", "Дизель", "柴油"],
    fuelEV: ["كهرباء", "Electric", "Électrique", "Eléctrico", "Elektro", "Elektrik", "Электро", "纯电"],
    fuelHybrid: ["هجين", "Hybrid", "Hybride", "Híbrido", "Hybrid", "Hibrit", "Гибрид", "混动"],
    fuelFlex: ["وقود مرن", "Flex fuel", "Flex-fuel", "Flex", "Flex-Fuel", "Esnek yakıt", "Флекс-фьюел", "灵活燃料"],
    transAT: ["أوتوماتيك", "Automatic", "Automatique", "Automática", "Automatik", "Otomatik", "Автомат", "自动"],
    transMT: ["عادي (يدوي)", "Manual", "Manuelle", "Manual", "Schaltgetriebe", "Manuel", "Механика", "手动"],
    unitL: ["لتر", "L", "L", "L", "l", "L", "л", "L"],
    unitCyl: ["سلندر", "cyl", "cyl.", "cil.", "Zyl.", "silindir", "цил.", "缸"],
    unitHp: ["حصان", "hp", "ch", "CV", "PS", "HP", "л.с.", "马力"],
    bodySedan: ["سيدان", "Sedan", "Berline", "Sedán", "Limousine", "Sedan", "Седан", "轿车"],
    bodySuv: ["SUV", "SUV", "SUV", "SUV", "SUV", "SUV", "SUV", "SUV"],
    bodyPickup: ["بيك أب", "Pickup", "Pick-up", "Pick-up", "Pick-up", "Pikap", "Пикап", "皮卡"],
    bodyHatch: ["هاتشباك", "Hatchback", "Bicorps", "Hatchback", "Schrägheck", "Hatchback", "Хэтчбек", "两厢车"],
    bodyCoupe: ["كوبيه", "Coupe", "Coupé", "Coupé", "Coupé", "Coupe", "Купе", "轿跑"],
    bodyConv: ["مكشوفة", "Convertible", "Cabriolet", "Descapotable", "Cabrio", "Cabrio", "Кабриолет", "敞篷车"],
    bodyWagon: ["ستيشن", "Wagon", "Break", "Familiar", "Kombi", "Station wagon", "Универсал", "旅行车"],
    bodyVan: ["فان", "Van", "Monospace", "Furgoneta", "Van", "Van", "Минивэн", "厢式车"]
  };
  if (window.SP_I18N && window.SP_I18N.T) Object.keys(T).forEach(function (k) { window.SP_I18N.T[k] = T[k]; });

  window.SP_VIN = {
    clean: clean, validFormat: validFormat, looksJdm: looksJdm, checkDigit: checkDigit, countryOf: countryOf,
    local: local, online: online, decode: decode, matchBrand: matchBrand, matchModel: matchModel,
    bodyKey: bodyKey, fuelKey: fuelKey, transKey: transKey, WMI: WMI, T: T
  };
})();
