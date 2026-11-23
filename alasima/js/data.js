/* Sparat reference data: countries ("servers"), Libyan cities, part categories, conditions and the car database. */
(function () {
  'use strict';

  /* Country:currency:dialling code. Names come from the browser in the reader's language (Intl.DisplayNames). */
  var COUNTRY_RAW = 'LY:LYD:218 EG:EGP:20 TN:TND:216 DZ:DZD:213 MA:MAD:212 MR:MRU:222 SD:SDG:249 SS:SSP:211 TD:XAF:235 NE:XOF:227 ' +
    'SA:SAR:966 AE:AED:971 QA:QAR:974 KW:KWD:965 BH:BHD:973 OM:OMR:968 YE:YER:967 IQ:IQD:964 JO:JOD:962 LB:LBP:961 SY:SYP:963 PS:ILS:970 ' +
    'TR:TRY:90 IR:IRR:98 IL:ILS:972 CY:EUR:357 GR:EUR:30 IT:EUR:39 MT:EUR:356 FR:EUR:33 ES:EUR:34 PT:EUR:351 DE:EUR:49 AT:EUR:43 CH:CHF:41 ' +
    'BE:EUR:32 NL:EUR:31 LU:EUR:352 GB:GBP:44 IE:EUR:353 DK:DKK:45 NO:NOK:47 SE:SEK:46 FI:EUR:358 IS:ISK:354 EE:EUR:372 LV:EUR:371 LT:EUR:370 ' +
    'PL:PLN:48 CZ:CZK:420 SK:EUR:421 HU:HUF:36 SI:EUR:386 HR:EUR:385 BA:BAM:387 RS:RSD:381 ME:EUR:382 MK:MKD:389 AL:ALL:355 XK:EUR:383 ' +
    'BG:EUR:359 RO:RON:40 MD:MDL:373 UA:UAH:380 BY:BYN:375 RU:RUB:7 GE:GEL:995 AM:AMD:374 AZ:AZN:994 KZ:KZT:7 UZ:UZS:998 TM:TMT:993 ' +
    'KG:KGS:996 TJ:TJS:992 AF:AFN:93 PK:PKR:92 IN:INR:91 BD:BDT:880 LK:LKR:94 NP:NPR:977 BT:BTN:975 MV:MVR:960 CN:CNY:86 HK:HKD:852 ' +
    'MO:MOP:853 TW:TWD:886 JP:JPY:81 KR:KRW:82 KP:KPW:850 MN:MNT:976 VN:VND:84 LA:LAK:856 KH:KHR:855 TH:THB:66 MM:MMK:95 MY:MYR:60 ' +
    'SG:SGD:65 ID:IDR:62 BN:BND:673 PH:PHP:63 TL:USD:670 AU:AUD:61 NZ:NZD:64 PG:PGK:675 FJ:FJD:679 SB:SBD:677 VU:VUV:678 WS:WST:685 ' +
    'TO:TOP:676 KI:AUD:686 NR:AUD:674 TV:AUD:688 PW:USD:680 FM:USD:691 MH:USD:692 NC:XPF:687 PF:XPF:689 US:USD:1 CA:CAD:1 MX:MXN:52 ' +
    'GT:GTQ:502 BZ:BZD:501 SV:USD:503 HN:HNL:504 NI:NIO:505 CR:CRC:506 PA:USD:507 CU:CUP:53 JM:JMD:1876 HT:HTG:509 DO:DOP:1809 ' +
    'PR:USD:1787 BS:BSD:1242 BB:BBD:1246 TT:TTD:1868 AG:XCD:1268 DM:XCD:1767 GD:XCD:1473 KN:XCD:1869 LC:XCD:1758 VC:XCD:1784 ' +
    'CO:COP:57 VE:VES:58 GY:GYD:592 SR:SRD:597 EC:USD:593 PE:PEN:51 BO:BOB:591 BR:BRL:55 PY:PYG:595 UY:UYU:598 AR:ARS:54 CL:CLP:56 ' +
    'NG:NGN:234 GH:GHS:233 CI:XOF:225 SN:XOF:221 ML:XOF:223 BF:XOF:226 GN:GNF:224 SL:SLE:232 LR:LRD:231 GM:GMD:220 GW:XOF:245 ' +
    'CV:CVE:238 TG:XOF:228 BJ:XOF:229 CM:XAF:237 CF:XAF:236 GA:XAF:241 CG:XAF:242 CD:CDF:243 GQ:XAF:240 ST:STN:239 AO:AOA:244 ' +
    'ET:ETB:251 ER:ERN:291 DJ:DJF:253 SO:SOS:252 KE:KES:254 UG:UGX:256 TZ:TZS:255 RW:RWF:250 BI:BIF:257 MZ:MZN:258 MW:MWK:265 ' +
    'ZM:ZMW:260 ZW:USD:263 BW:BWP:267 NA:NAD:264 ZA:ZAR:27 LS:LSL:266 SZ:SZL:268 MG:MGA:261 MU:MUR:230 SC:SCR:248 KM:KMF:269 ' +
    'AD:EUR:376 MC:EUR:377 SM:EUR:378 VA:EUR:39 LI:CHF:423 GI:GIP:350 GL:DKK:299 FO:DKK:298 RE:EUR:262 GP:EUR:590 MQ:EUR:596 GF:EUR:594 ' +
    'YT:EUR:262 AW:AWG:297 CW:XCG:599 KY:KYD:1345 BM:BMD:1441 GU:USD:1671 VI:USD:1340 VG:USD:1284';

  var COUNTRIES = COUNTRY_RAW.split(' ').map(function (s) {
    var p = s.split(':');
    return { code: p[0], currency: p[1], dial: p[2] };
  });
  /* Shown first in the picker. */
  var PINNED = ['LY', 'EG', 'TN', 'DZ', 'MA', 'SD', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'IQ', 'JO', 'LB', 'SY', 'PS', 'YE', 'TR'];

  var LIBYA_CITIES = ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'زليتن', 'الخمس', 'غريان', 'صبراتة', 'زوارة', 'ترهونة', 'سرت', 'أجدابيا',
    'البيضاء', 'المرج', 'درنة', 'طبرق', 'سبها', 'بني وليد', 'مسلاتة', 'صرمان', 'نالوت', 'يفرن', 'الكفرة', 'أوباري', 'هون', 'غدامس'];

  var CATS = [
    { id: 'engine', icon: 'c_engine' }, { id: 'brakes', icon: 'c_brakes' }, { id: 'suspension', icon: 'c_susp' },
    { id: 'electrical', icon: 'c_elec' }, { id: 'lights', icon: 'c_light' }, { id: 'body', icon: 'c_body' },
    { id: 'oils', icon: 'c_oil' }, { id: 'cooling', icon: 'c_cool' }, { id: 'ac', icon: 'c_ac' },
    { id: 'transmission', icon: 'c_gear' }, { id: 'tires', icon: 'c_tire' }, { id: 'interior', icon: 'c_int' },
    { id: 'other', icon: 'wrench' }
  ];
  var CONDS = ['original', 'aftermarket', 'used', 'refurb'];

  /*
   * Car database, 2000 to 2026 (a few long-running classics start earlier).
   * id|Latin name|Arabic name|origin country|models
   * Each model: Name[=Arabic name]:fromYear-toYear
   */
  var BRAND_RAW = [
    'toyota|Toyota|تويوتا|JP|Corolla=كورولا:2000-2026,Camry=كامري:2000-2026,Yaris=يارس:2000-2026,Land Cruiser=لاندكروزر:2000-2026,Prado=برادو:2000-2026,Hilux=هايلكس:2000-2026,RAV4=راف فور:2000-2026,Avalon=أفالون:2000-2022,Hiace=هايس:2000-2026,FJ Cruiser=إف جي:2006-2023,Fortuner=فورتشنر:2005-2026,Innova=إنوفا:2004-2026,Rush=راش:2006-2026,Corolla Cross=كورولا كروس:2020-2026,C-HR:2016-2026,Highlander=هايلاندر:2000-2026,Sequoia=سيكويا:2000-2026,Tundra=تندرا:2000-2026,Tacoma=تاكوما:2000-2026,4Runner=فور رنر:2000-2026,Sienna=سيينا:2000-2026,Prius=بريوس:2000-2026,Echo=إيكو:2000-2005,Celica=سيليكا:2000-2006,Supra=سوبرا:2019-2026,GR86 / 86:2012-2026,Venza=فينزا:2009-2024,Crown=كراون:2000-2026,Previa=بريفيا:2000-2019,Raize=رايز:2019-2026,Veloz=فيلوز:2021-2026,Granvia:2019-2026,Coaster=كوستر:2000-2026,Dyna=داينا:2000-2026,Urban Cruiser:2008-2026,bZ4X:2022-2026,Belta=بيلتا:2021-2026,Agya:2013-2026',
    'lexus|Lexus|لكزس|JP|IS:2000-2026,ES:2000-2026,GS:2000-2020,LS:2000-2026,RX:2000-2026,NX:2014-2026,UX:2018-2026,GX:2002-2026,LX:2000-2026,LC:2017-2026,RC:2014-2026,CT:2011-2022,LM:2020-2026,LBX:2023-2026,TX:2023-2026,SC:2001-2010,HS:2009-2018,RZ:2022-2026',
    'nissan|Nissan|نيسان|JP|Sunny=صني:2000-2026,Sentra=سنترا:2000-2026,Altima=ألتيما:2000-2026,Maxima=ماكسيما:2000-2023,Patrol=باترول:2000-2026,Navara=نافارا:2000-2026,X-Trail=إكس تريل:2001-2026,Pathfinder=باثفايندر:2000-2026,Tiida=تيدا:2004-2026,Micra=ميكرا:2000-2023,Qashqai=قشقاي:2006-2026,Juke=جوك:2010-2026,Murano=مورانو:2002-2026,Armada=أرمادا:2003-2026,Kicks=كيكس:2016-2026,Note:2004-2026,Almera=ألميرا:2000-2026,Versa:2006-2026,Rogue:2007-2026,Frontier:2000-2026,Titan:2003-2024,350Z:2002-2009,370Z:2009-2020,Z:2022-2026,GT-R:2007-2025,Leaf:2010-2026,Urvan=أورفان:2000-2026,Teana=تيانا:2003-2020,Primera:2000-2008,Terrano:2000-2022,Magnite:2020-2026',
    'infiniti|Infiniti|إنفينيتي|JP|Q50:2013-2026,Q60:2013-2022,Q70:2013-2019,QX50:2013-2026,QX55:2021-2025,QX60:2013-2026,QX70:2013-2017,QX80:2013-2026,G35:2002-2007,G37:2008-2013,FX35:2003-2013,FX45:2003-2008,M35:2005-2010,M37:2010-2013,QX56:2004-2013,EX35:2008-2012,I35:2002-2004,QX4:2000-2003',
    'honda|Honda|هوندا|JP|Civic=سيفيك:2000-2026,Accord=أكورد:2000-2026,CR-V:2000-2026,City=سيتي:2000-2026,Jazz / Fit=جاز:2001-2026,HR-V:2000-2026,Pilot=بايلوت:2002-2026,Odyssey=أوديسي:2000-2026,Ridgeline:2005-2026,Element:2003-2011,S2000:2000-2009,Legend:2000-2021,ZR-V:2022-2026,WR-V:2017-2026,BR-V:2015-2026,Passport:2019-2026,Insight:2000-2022,Stream:2000-2014',
    'acura|Acura|أكورا|JP|TL:2000-2014,TSX:2004-2014,RL:2000-2012,MDX:2001-2026,RDX:2007-2026,ILX:2013-2022,TLX:2015-2026,NSX:2000-2022,RSX:2002-2006,ZDX:2010-2013,Integra:2022-2026,RLX:2014-2020',
    'mazda|Mazda|مازدا|JP|Mazda2=مازدا 2:2002-2026,Mazda3=مازدا 3:2003-2026,Mazda6=مازدا 6:2002-2025,CX-3:2015-2026,CX-30:2019-2026,CX-5:2012-2026,CX-7:2006-2012,CX-9:2007-2023,CX-50:2022-2026,CX-60:2022-2026,CX-90:2023-2026,MX-5:2000-2026,RX-8:2003-2012,BT-50:2006-2026,323:2000-2003,626:2000-2002,Tribute:2000-2011,Premacy:2000-2018,MPV:2000-2016',
    'mitsubishi|Mitsubishi|ميتسوبيشي|JP|Lancer=لانسر:2000-2017,Pajero=باجيرو:2000-2021,Pajero Sport=باجيرو سبورت:2000-2026,L200=إل 200:2000-2026,Outlander=أوتلاندر:2001-2026,ASX:2010-2026,Attrage=أتراج:2013-2026,Mirage=ميراج:2012-2026,Eclipse Cross:2017-2026,Galant=جالانت:2000-2012,Xpander=إكسباندر:2017-2026,Space Star:2000-2026,Colt=كولت:2000-2026,Montero:2000-2021,Grandis:2003-2011,Endeavor:2004-2011,Eclipse:2000-2012,Lancer Evolution:2000-2016,Canter=كانتر:2000-2026',
    'subaru|Subaru|سوبارو|JP|Impreza:2000-2026,Legacy:2000-2025,Outback:2000-2026,Forester=فورستر:2000-2026,XV / Crosstrek:2012-2026,WRX:2014-2026,BRZ:2012-2026,Tribeca:2005-2014,Ascent:2018-2026,Levorg:2014-2026,Solterra:2022-2026',
    'suzuki|Suzuki|سوزوكي|JP|Swift=سويفت:2000-2026,Vitara=فيتارا:2015-2026,Grand Vitara=جراند فيتارا:2000-2026,Jimny=جيمني:2000-2026,Alto=ألتو:2000-2026,Celerio=سيليريو:2008-2026,Ciaz=سياز:2014-2026,Ertiga=إرتيجا:2012-2026,Dzire=ديزاير:2008-2026,Baleno=بالينو:2015-2026,SX4:2006-2014,S-Cross:2013-2026,Liana:2001-2007,Ignis:2000-2026,APV:2004-2026,Fronx:2023-2026,XL7:2001-2026,Kizashi:2009-2015,Carry=كاري:2000-2026,Wagon R:2000-2026',
    'isuzu|Isuzu|إيسوزو|JP|D-Max=دي ماكس:2002-2026,MU-X:2013-2026,NPR:2000-2026,NKR:2000-2026,NQR:2000-2026,FVR:2000-2026,Trooper=تروبر:2000-2002,Rodeo:2000-2004,Ascender:2003-2008',
    'daihatsu|Daihatsu|دايهاتسو|JP|Terios=تيريوس:2000-2026,Sirion:2000-2026,Charade:2000-2013,Gran Max:2007-2026,Rocky:2019-2026,Ayla:2013-2026,Xenia:2004-2026,Cuore:2000-2012,Materia:2006-2012,Hijet:2000-2026',
    'hyundai|Hyundai|هيونداي|KR|Elantra / Avante=إلنترا (أفانتي):2000-2026,Accent=أكسنت:2000-2026,Sonata=سوناتا:2000-2026,Tucson=توسان:2004-2026,Santa Fe=سنتافي:2000-2026,i10:2007-2026,i20:2008-2026,i30:2007-2026,Azera=أزيرا:2005-2026,Grandeur=جراندير:2000-2026,Creta=كريتا:2014-2026,H1 / Starex=H1 (ستاركس):2000-2026,Staria=ستاريا:2021-2026,Kona=كونا:2017-2026,Venue=فينيو:2019-2026,Palisade=باليسيد:2018-2026,Veloster=فيلوستر:2011-2022,Genesis=جينيسيس:2008-2016,Getz=جيتز:2002-2011,Matrix=ماتريكس:2001-2010,Terracan=تيراكان:2001-2007,Veracruz=فيراكروز:2007-2015,Atos=أتوس:2000-2014,Verna=فيرنا:2006-2026,Ioniq=أيونيك:2016-2022,Ioniq 5:2021-2026,Ioniq 6:2022-2026,Santa Cruz:2021-2026,Stargazer:2022-2026,Bayon:2021-2026,Coupe / Tiburon=كوبيه:2000-2008,Porter / H100=بورتر:2000-2026,Galloper=جالوبر:2000-2003',
    'kia|Kia|كيا|KR|Cerato / Forte / K3=سيراتو:2003-2026,Rio=ريو:2000-2026,Picanto=بيكانتو:2004-2026,Sportage=سبورتاج:2000-2026,Sorento=سورينتو:2002-2026,Optima / K5=أوبتيما (K5):2000-2026,Carnival / Sedona=كرنفال:2000-2026,Soul=سول:2008-2026,Seltos=سيلتوس:2019-2026,Sonet=سونيت:2020-2026,Stinger=ستينجر:2017-2023,Telluride=تيلورايد:2019-2026,Cadenza / K8=كادينزا (K8):2009-2026,Mohave / Borrego=موهافي:2008-2026,Carens=كارينز:2000-2026,Pegas=بيجاس:2019-2026,Niro=نيرو:2016-2026,EV6:2021-2026,EV9:2023-2026,Spectra=سبيكترا:2000-2009,Opirus=أوبيروس:2003-2011,Bongo / K2700=بونجو:2000-2026,Sephia=سيفيا:2000-2003,Shuma:2000-2004',
    'genesis|Genesis|جينيسيس|KR|G70:2017-2026,G80:2016-2026,G90:2016-2026,GV60:2021-2026,GV70:2020-2026,GV80:2020-2026',
    'ssangyong|SsangYong / KGM|سانغ يونغ|KR|Rexton=ريكستون:2001-2026,Korando=كوراندو:2000-2026,Tivoli=تيفولي:2015-2026,Musso=موسو:2000-2026,Actyon=أكتيون:2005-2026,Kyron=كايرون:2005-2014,Rodius:2004-2019,Torres=توريس:2022-2026',
    'daewoo|Daewoo|دايو|KR|Lanos=لانوس:2000-2009,Nubira=نوبيرا:2000-2008,Leganza=ليجانزا:2000-2002,Matiz=ماتيز:2000-2015,Lacetti=لاسيتي:2003-2008,Gentra=جنترا:2005-2015,Kalos:2002-2008,Tacuma:2000-2008,Nexia=نكسيا:2000-2016,Magnus:2000-2006,Cielo=سيلو:2000-2002,Espero=إسبيرو:1990-2000',
    'mercedes|Mercedes-Benz|مرسيدس|DE|A-Class=A كلاس:2000-2026,B-Class=B كلاس:2005-2026,C-Class=C كلاس:2000-2026,CLA:2013-2026,CLE:2023-2026,CLS:2004-2023,E-Class=E كلاس:2000-2026,S-Class=S كلاس:2000-2026,CLK:2000-2010,SL:2000-2026,SLK / SLC:2000-2020,G-Class=G كلاس:2000-2026,GLA:2014-2026,GLB:2019-2026,GLC:2015-2026,ML / GLE:2000-2026,GL / GLS:2006-2026,GLK:2008-2015,R-Class:2005-2017,Sprinter=سبرنتر:2000-2026,Vito / V-Class=فيتو:2000-2026,Viano:2003-2014,Citan:2012-2026,X-Class:2017-2020,AMG GT:2014-2026,EQC:2019-2024,EQE:2022-2026,EQS:2021-2026,Actros=أكتروس:2000-2026,Atego=أتيجو:2000-2026,190=190:1982-1993',
    'bmw|BMW|بي إم دبليو|DE|1 Series=الفئة 1:2004-2026,2 Series=الفئة 2:2014-2026,3 Series=الفئة 3:2000-2026,4 Series=الفئة 4:2013-2026,5 Series=الفئة 5:2000-2026,6 Series=الفئة 6:2003-2025,7 Series=الفئة 7:2000-2026,8 Series=الفئة 8:2018-2026,X1:2009-2026,X2:2018-2026,X3:2003-2026,X4:2014-2026,X5:2000-2026,X6:2008-2026,X7:2019-2026,XM:2022-2026,Z3:2000-2002,Z4:2002-2026,i3:2013-2022,i4:2021-2026,i5:2023-2026,i7:2022-2026,iX:2021-2026,iX1:2022-2026,iX3:2020-2026',
    'audi|Audi|أودي|DE|A1:2010-2026,A2:2000-2005,A3:2000-2026,A4:2000-2026,A5:2007-2026,A6:2000-2026,A7:2010-2026,A8:2000-2026,Q2:2016-2026,Q3:2011-2026,Q4 e-tron:2021-2026,Q5:2008-2026,Q6 e-tron:2024-2026,Q7:2005-2026,Q8:2018-2026,TT:2000-2023,R8:2006-2024,e-tron / Q8 e-tron:2018-2026,e-tron GT:2021-2026,Allroad:2000-2026',
    'volkswagen|Volkswagen|فولكس فاجن|DE|Golf=جولف:2000-2026,Passat=باسات:2000-2026,Jetta=جيتا:2000-2026,Polo=بولو:2000-2026,Tiguan=تيجوان:2007-2026,Touareg=طوارق:2002-2026,Touran=توران:2003-2026,Bora=بورا:2000-2026,Beetle=بيتل:2000-2019,Caddy=كادي:2000-2026,Transporter=ترانسبورتر:2000-2026,Amarok=أماروك:2010-2026,Arteon:2017-2024,Scirocco:2008-2017,Sharan:2000-2022,T-Roc:2017-2026,T-Cross:2018-2026,Teramont / Atlas=تيرامونت:2017-2026,ID.3:2019-2026,ID.4:2020-2026,ID.6:2021-2026,ID. Buzz:2022-2026,Lavida:2008-2026,Santana:2000-2022,Vento:2010-2022,Virtus:2021-2026,Taos / Tharu:2018-2026,Fox:2003-2021,Up:2011-2023,Eos:2006-2016,Phaeton:2002-2016,Crafter=كرافتر:2006-2026,Gol:2000-2023,Saveiro:2000-2026',
    'porsche|Porsche|بورشه|DE|911:2000-2026,Cayenne=كايين:2002-2026,Macan=ماكان:2014-2026,Panamera=باناميرا:2009-2026,Boxster:2000-2026,Cayman:2005-2026,Taycan:2019-2026,Carrera GT:2004-2007',
    'opel|Opel|أوبل|DE|Corsa=كورسا:2000-2026,Astra=أسترا:2000-2026,Vectra=فيكترا:2000-2008,Insignia=إنسجنيا:2008-2022,Zafira=زافيرا:2000-2019,Meriva:2003-2017,Mokka=موكا:2012-2026,Crossland:2017-2026,Grandland:2017-2026,Combo:2000-2026,Vivaro:2001-2026,Omega=أوميجا:2000-2003,Antara:2006-2015,Adam:2013-2019,Karl:2015-2019,Frontera:2000-2004',
    'maybach|Maybach|مايباخ|DE|57:2002-2012,62:2002-2012,S-Class:2015-2026,GLS:2020-2026',
    'smart|Smart|سمارت|DE|Fortwo:2000-2024,Forfour:2004-2021,#1:2022-2026,#3:2023-2026',
    'man|MAN|مان|DE|TGA:2000-2007,TGL:2005-2026,TGM:2005-2026,TGS:2007-2026,TGX:2007-2026,TGE:2016-2026',
    'peugeot|Peugeot|بيجو|FR|106:2000-2003,107:2005-2014,108:2014-2021,1007:2005-2009,206:2000-2012,207:2006-2014,208:2012-2026,2008:2013-2026,301:2012-2026,306:2000-2002,307:2001-2008,308:2007-2026,3008:2008-2026,405:2000-2021,406:2000-2004,407:2004-2011,408:2010-2026,4007:2007-2012,4008:2012-2026,5008:2009-2026,504:1968-2006,508:2010-2026,607:2000-2010,807:2002-2014,Partner=بارتنر:2000-2026,Expert=إكسبرت:2000-2026,Boxer=بوكسر:2000-2026,Rifter:2018-2026,Landtrek:2020-2026,RCZ:2010-2015',
    'renault|Renault|رينو|FR|Clio=كليو:2000-2026,Megane=ميجان:2000-2026,Logan=لوجان:2004-2026,Sandero=سانديرو:2007-2026,Symbol / Thalia=سيمبول:2000-2026,Duster=داستر:2010-2026,Captur=كابتشر:2013-2026,Kadjar=كادجار:2015-2022,Koleos=كوليوس:2007-2026,Fluence=فلوانس:2009-2017,Laguna=لاجونا:2000-2015,Scenic=سينيك:2000-2026,Kangoo=كانجو:2000-2026,Master=ماستر:2000-2026,Trafic=ترافيك:2000-2026,Talisman=تاليسمان:2015-2022,Twingo:2000-2024,Zoe:2012-2024,Arkana:2019-2026,Austral:2022-2026,Espace:2000-2026,Kwid:2015-2026,Triber:2019-2026,Kiger:2021-2026,Taliant:2021-2026,Express:2021-2026,Latitude:2010-2015',
    'citroen|Citroën|ستروين|FR|C1:2005-2022,C2:2003-2009,C3:2002-2026,C3 Aircross:2017-2026,C4:2004-2026,C4 Picasso / SpaceTourer:2006-2022,C5:2001-2017,C5 Aircross:2018-2026,C5 X:2021-2026,C-Elysee=سي إليزيه:2012-2022,Berlingo=بيرلينجو:2000-2026,Jumpy:2000-2026,Jumper:2000-2026,Xsara=إكسارا:2000-2006,Saxo:2000-2004,Xantia:2000-2001,C8:2002-2014,DS3:2009-2015,DS4:2011-2015,DS5:2011-2015,C-Crosser:2007-2012,Basalt:2024-2026',
    'ds|DS|دي إس|FR|DS 3:2016-2026,DS 4:2015-2026,DS 5:2015-2018,DS 7:2017-2026,DS 9:2020-2025',
    'alpine|Alpine|ألبين|FR|A110:2017-2026,A290:2024-2026',
    'bugatti|Bugatti|بوغاتي|FR|Veyron:2005-2015,Chiron:2016-2024,Tourbillon:2026-2026',
    'dacia|Dacia|داسيا|RO|Logan=لوجان:2004-2026,Sandero=سانديرو:2008-2026,Duster=داستر:2010-2026,Lodgy:2012-2022,Dokker:2012-2021,Spring:2021-2026,Jogger:2021-2026,Bigster:2025-2026,Solenza:2003-2005',
    'fiat|Fiat|فيات|IT|Punto=بونتو:2000-2018,Panda=باندا:2003-2026,500:2007-2026,500X:2014-2026,500L:2012-2022,Tipo=تيبو:2015-2026,Doblo=دوبلو:2000-2026,Ducato=دوكاتو:2000-2026,Linea=لينيا:2007-2018,Bravo:2007-2014,Stilo:2001-2010,Palio=باليو:2000-2018,Siena=سيينا:2000-2016,Albea=ألبيا:2002-2012,Uno=أونو:2000-2021,Fiorino=فيورينو:2000-2026,Strada:2000-2026,Croma:2005-2010,Fullback:2016-2019,Seicento:2000-2010,Marea:2000-2007,Multipla:2000-2010,Toro:2016-2026,Argo:2017-2026,Cronos:2018-2026,Pulse:2021-2026,Fastback:2022-2026,600:2023-2026,Grande Panda:2024-2026',
    'alfaromeo|Alfa Romeo|ألفا روميو|IT|147:2000-2010,156:2000-2007,159:2005-2011,166:2000-2007,Giulietta:2010-2020,MiTo:2008-2018,Giulia:2015-2026,Stelvio:2016-2026,Tonale:2022-2026,Brera:2005-2010,GT:2003-2010,Junior:2024-2026,4C:2013-2020',
    'ferrari|Ferrari|فيراري|IT|360:2000-2005,F430:2004-2009,458:2009-2015,488:2015-2019,F8:2019-2022,296:2021-2026,SF90:2019-2026,599:2006-2012,612:2004-2011,California:2008-2017,Portofino:2017-2026,Roma:2019-2026,812:2017-2024,FF / GTC4Lusso:2011-2020,Purosangue:2022-2026,12Cilindri:2024-2026,Enzo:2002-2004,LaFerrari:2013-2016,550 / 575:2000-2006',
    'lamborghini|Lamborghini|لامبورغيني|IT|Murcielago:2001-2010,Gallardo:2003-2013,Aventador:2011-2022,Huracan:2014-2024,Urus:2018-2026,Revuelto:2023-2026,Temerario:2024-2026,Diablo:2000-2001',
    'maserati|Maserati|مازيراتي|IT|Ghibli:2013-2024,Quattroporte:2000-2024,Levante:2016-2024,GranTurismo:2007-2026,GranCabrio:2010-2026,Grecale:2022-2026,MC20:2020-2026,Coupe / Spyder:2001-2007',
    'lancia|Lancia|لانشيا|IT|Ypsilon:2003-2026,Delta:2008-2014,Musa:2004-2012,Thesis:2002-2009,Lybra:2000-2005,Phedra:2002-2010,Voyager:2011-2015,Thema:2011-2014',
    'abarth|Abarth|أبارث|IT|500:2008-2026,595:2016-2024,695:2016-2024,124 Spider:2016-2019,600e:2024-2026',
    'iveco|Iveco|إيفيكو|IT|Daily=دايلي:2000-2026,Eurocargo:2000-2026,Stralis:2002-2021,S-Way:2019-2026,Trakker:2004-2026',
    'ford|Ford|فورد|US|Focus=فوكس:2000-2025,Fiesta=فييستا:2000-2023,Mondeo=مونديو:2000-2026,Fusion=فيوجن:2006-2020,Taurus=توروس:2000-2026,Mustang=موستانج:2000-2026,Explorer=إكسبلورر:2000-2026,Expedition=إكسبديشن:2000-2026,Escape / Kuga=إسكيب:2001-2026,Edge=إيدج:2007-2024,Ranger=رينجر:2000-2026,F-150:2000-2026,F-250:2000-2026,Transit=ترانزيت:2000-2026,EcoSport:2003-2022,Everest=إيفرست:2003-2026,Bronco=برونكو:2021-2026,Bronco Sport:2021-2026,Maverick:2022-2026,Territory=تيريتوري:2004-2026,Puma:2019-2026,Galaxy:2000-2023,S-Max:2006-2023,Ka:2000-2021,Crown Victoria=كراون فيكتوريا:2000-2011,Excursion:2000-2005,Flex:2009-2019,Figo:2010-2021,Tourneo:2000-2026,Mustang Mach-E:2020-2026',
    'chevrolet|Chevrolet|شيفروليه|US|Optra=أوبترا:2002-2026,Aveo=أفيو:2002-2026,Cruze=كروز:2008-2026,Captiva=كابتيفا:2006-2026,Malibu=ماليبو:2000-2025,Tahoe=تاهو:2000-2026,Suburban=سوبربان:2000-2026,Silverado=سلفرادو:2000-2026,Camaro=كامارو:2000-2024,Corvette=كورفيت:2000-2026,Spark=سبارك:2005-2022,Sonic:2011-2020,Trax=تراكس:2013-2026,Equinox=إكوينوكس:2005-2026,Traverse=ترافرس:2009-2026,Blazer=بليزر:2000-2026,Colorado=كولورادو:2004-2026,Impala=إمبالا:2000-2020,Lumina=لومينا:2000-2017,Caprice=كابريس:2000-2017,Epica=إبيكا:2006-2011,Lacetti=لاسيتي:2004-2013,Spin:2012-2026,Onix:2012-2026,Tracker:2019-2026,Groove=جروف:2021-2026,Menlo:2020-2024,Avalanche:2002-2013,Trailblazer=تريل بليزر:2002-2026,Express:2000-2026,Cobalt:2004-2026,Niva:2002-2020',
    'gmc|GMC|جي إم سي|US|Sierra=سييرا:2000-2026,Yukon=يوكن:2000-2026,Acadia=أكاديا:2007-2026,Terrain=تيرين:2010-2026,Canyon=كانيون:2004-2026,Savana=سافانا:2000-2026,Envoy=إنفوي:2002-2009,Hummer EV:2021-2026',
    'cadillac|Cadillac|كاديلاك|US|Escalade=إسكاليد:2000-2026,CTS:2003-2019,ATS:2013-2019,XTS:2013-2019,SRX:2004-2016,DTS:2006-2011,STS:2005-2011,Seville:2000-2004,DeVille:2000-2005,XT4:2019-2026,XT5:2017-2026,XT6:2020-2026,CT4:2020-2026,CT5:2020-2026,CT6:2016-2020,Lyriq:2022-2026',
    'buick|Buick|بيوك|US|Enclave:2008-2026,Encore:2013-2026,Envision:2016-2026,LaCrosse:2005-2019,Regal:2000-2020,Lucerne:2006-2011,Excelle:2003-2026,GL8:2000-2026,Verano:2012-2017',
    'chrysler|Chrysler|كرايسلر|US|300:2005-2023,300M:2000-2004,Pacifica:2004-2026,Town & Country:2000-2016,Voyager:2000-2026,Sebring:2001-2010,200:2011-2017,PT Cruiser:2001-2010,Crossfire:2004-2008,Concorde:2000-2004',
    'dodge|Dodge|دودج|US|Charger=تشارجر:2006-2026,Challenger=تشالنجر:2008-2023,Durango=دورانجو:2000-2026,Ram:2000-2009,Dakota:2000-2011,Grand Caravan:2000-2020,Journey:2009-2020,Neon:2000-2020,Avenger:2008-2014,Caliber:2007-2012,Nitro:2007-2012,Viper:2000-2017,Magnum:2005-2008,Stratus:2001-2006,Intrepid:2000-2004,Attitude:2006-2024,Hornet:2023-2026',
    'jeep|Jeep|جيب|US|Wrangler=رانجلر:2000-2026,Grand Cherokee=جراند شيروكي:2000-2026,Cherokee / Liberty=شيروكي:2000-2023,Compass=كومباس:2007-2026,Renegade=رينيجيد:2014-2026,Commander:2006-2026,Patriot:2007-2017,Gladiator:2019-2026,Grand Wagoneer:2021-2026,Wagoneer:2021-2026,Avenger:2023-2026',
    'ram|RAM|رام|US|1500:2010-2026,2500:2010-2026,3500:2010-2026,ProMaster:2013-2026',
    'lincoln|Lincoln|لينكولن|US|Navigator:2000-2026,Town Car:2000-2011,MKZ:2007-2020,MKX:2007-2018,Nautilus:2019-2026,Aviator:2003-2026,Corsair:2020-2026,Continental:2017-2020,MKS:2009-2016,MKC:2015-2019,MKT:2010-2019,LS:2000-2006',
    'tesla|Tesla|تسلا|US|Model S:2012-2026,Model 3:2017-2026,Model X:2015-2026,Model Y:2020-2026,Cybertruck:2023-2026,Roadster:2008-2012',
    'hummer|Hummer|همر|US|H1:2000-2006,H2:2002-2009,H3:2005-2010',
    'pontiac|Pontiac|بونتياك|US|G6:2005-2010,Grand Prix:2000-2008,Vibe:2003-2010,Solstice:2006-2009,Firebird:2000-2002,Aztek:2001-2005,Sunfire:2000-2005,Grand Am:2000-2005,Bonneville:2000-2005,G8:2008-2009',
    'mercury|Mercury|ميركوري|US|Grand Marquis=جراند ماركيز:2000-2011,Mountaineer:2002-2010,Milan:2006-2011,Sable:2000-2009,Mariner:2005-2011',
    'saturn|Saturn|ساترن|US|Ion:2003-2007,Vue:2002-2010,Aura:2007-2009,Outlook:2007-2010,Sky:2007-2009,L-Series:2000-2005',
    'scion|Scion|سايون|US|tC:2005-2016,xB:2004-2015,xD:2008-2014,FR-S:2013-2016,iM:2016-2016,iA:2016-2016',
    'oldsmobile|Oldsmobile|أولدزموبيل|US|Alero:2000-2004,Aurora:2001-2003,Intrigue:2000-2002,Bravada:2002-2004,Silhouette:2000-2004',
    'lucid|Lucid|لوسيد|US|Air:2021-2026,Gravity:2024-2026',
    'rivian|Rivian|ريفيان|US|R1T:2021-2026,R1S:2021-2026',
    'holden|Holden|هولدن|AU|Commodore:2000-2020,Caprice:2000-2017,Colorado:2008-2020,Captiva:2006-2018',
    'landrover|Land Rover|لاند روفر|GB|Range Rover=رينج روفر:2000-2026,Range Rover Sport=رينج روفر سبورت:2005-2026,Range Rover Evoque=إيفوك:2011-2026,Range Rover Velar=فيلار:2017-2026,Discovery=ديسكفري:2000-2026,Discovery Sport=ديسكفري سبورت:2014-2026,Defender=ديفندر:2000-2026,Freelander=فريلاندر:2000-2014',
    'jaguar|Jaguar|جاكوار|GB|XF:2007-2024,XJ:2000-2019,XE:2015-2024,F-Pace:2016-2026,E-Pace:2017-2024,I-Pace:2018-2024,F-Type:2013-2024,S-Type:2000-2008,X-Type:2001-2009,XK:2000-2014',
    'bentley|Bentley|بنتلي|GB|Continental GT:2003-2026,Flying Spur:2005-2026,Bentayga:2015-2026,Mulsanne:2010-2020,Arnage:2000-2009',
    'rollsroyce|Rolls-Royce|رولز رويس|GB|Phantom:2003-2026,Ghost:2009-2026,Wraith:2013-2023,Dawn:2015-2023,Cullinan:2018-2026,Spectre:2023-2026,Silver Seraph:2000-2002',
    'astonmartin|Aston Martin|أستون مارتن|GB|Vantage:2005-2026,DB9:2004-2016,DB11:2016-2023,DB12:2023-2026,DBS:2007-2026,Rapide:2010-2020,DBX:2020-2026,Vanquish:2001-2026',
    'mclaren|McLaren|ماكلارين|GB|MP4-12C:2011-2014,570S:2015-2021,720S:2017-2023,750S:2023-2026,Artura:2021-2026,GT:2019-2026,P1:2013-2015,Senna:2018-2019',
    'lotus|Lotus|لوتس|GB|Elise:2000-2021,Exige:2000-2021,Evora:2009-2021,Emira:2021-2026,Eletre:2022-2026,Emeya:2023-2026',
    'mini|MINI|ميني|GB|Cooper / Hatch=ميني كوبر:2001-2026,Clubman:2007-2024,Countryman=كانتريمان:2010-2026,Paceman:2013-2016,Convertible:2004-2026,Coupe:2011-2015,Aceman:2024-2026',
    'mg|MG|إم جي|GB|MG ZS=زد إس:2017-2026,MG5=إم جي 5:2012-2026,MG6=إم جي 6:2009-2026,MG HS=إتش إس:2018-2026,MG RX5:2016-2026,MG RX8:2018-2026,MG3=إم جي 3:2008-2026,MG4:2022-2026,MG7:2023-2026,MG One:2021-2026,MG GT:2015-2021,MG Whale:2023-2026,Marvel R:2021-2026,Cyberster:2023-2026,MG ZT:2001-2005,MG ZR:2001-2005,MG TF:2002-2011',
    'rover|Rover|روفر|GB|25:2000-2005,45:2000-2005,75:2000-2005',
    'volvo|Volvo|فولفو|SE|S40:2000-2012,S60:2000-2026,S80:2000-2016,S90:2016-2026,V40:2000-2019,V50:2004-2012,V60:2010-2026,V70:2000-2016,V90:2016-2026,XC40:2017-2026,XC60:2008-2026,XC70:2000-2016,XC90:2002-2026,C30:2006-2013,C40:2021-2026,EX30:2023-2026,EX90:2024-2026,FH=FH (شاحنة):2000-2026,FM=FM (شاحنة):2000-2026',
    'saab|Saab|ساب|SE|9-3:2000-2014,9-5:2000-2012,9-7X:2005-2008,9-4X:2011-2011',
    'polestar|Polestar|بولستار|SE|Polestar 1:2019-2021,Polestar 2:2020-2026,Polestar 3:2023-2026,Polestar 4:2024-2026',
    'scania|Scania|سكانيا|SE|P-Series:2004-2026,G-Series:2004-2026,R-Series:2004-2026,S-Series:2016-2026,4-Series:2000-2004',
    'daf|DAF|داف|NL|LF:2001-2026,CF:2001-2026,XF:2002-2026,XD:2022-2026',
    'skoda|Škoda|سكودا|CZ|Octavia=أوكتافيا:2000-2026,Fabia=فابيا:2000-2026,Superb=سوبيرب:2001-2026,Rapid:2012-2023,Yeti:2009-2017,Kodiaq=كودياك:2016-2026,Karoq:2017-2026,Kamiq:2019-2026,Scala:2019-2026,Roomster:2006-2015,Citigo:2011-2020,Enyaq:2020-2026,Elroq:2024-2026,Kushaq:2021-2026,Slavia:2021-2026,Felicia:2000-2001',
    'seat|SEAT|سيات|ES|Ibiza=إيبيزا:2000-2026,Leon=ليون:2000-2026,Toledo=توليدو:2000-2019,Cordoba=قرطبة:2000-2009,Altea:2004-2015,Alhambra:2000-2020,Arona:2017-2026,Ateca:2016-2026,Tarraco:2018-2026,Exeo:2008-2013,Mii:2011-2021,Arosa:2000-2004',
    'cupra|Cupra|كوبرا|ES|Formentor:2020-2026,Born:2021-2026,Leon:2020-2026,Ateca:2018-2026,Tavascan:2024-2026,Terramar:2024-2026',
    'chery|Chery|شيري|CN|Tiggo=تيجو:2005-2016,Tiggo 2:2017-2026,Tiggo 3:2014-2026,Tiggo 4:2017-2026,Tiggo 5:2013-2026,Tiggo 7=تيجو 7:2016-2026,Tiggo 8=تيجو 8:2018-2026,Tiggo 9:2023-2026,Arrizo 3:2014-2021,Arrizo 5=أريزو 5:2016-2026,Arrizo 6:2018-2026,Arrizo 8:2022-2026,QQ:2003-2026,A3:2008-2014,A5:2006-2010,E5:2011-2016,Fulwin:2006-2026,Eastar:2003-2013,Cowin:2001-2014',
    'geely|Geely|جيلي|CN|Emgrand=إمجراند:2009-2026,Emgrand X7:2011-2021,Emgrand GT:2015-2021,Coolray=كولراي:2018-2026,Azkarra:2019-2026,Okavango:2020-2026,Tugella=توجيلا:2019-2026,Monjaro=مونجارو:2021-2026,Preface:2020-2026,Starray:2023-2026,GX3:2016-2026,CK:2005-2016,MK:2006-2016,Atlas:2016-2026,Geometry C:2020-2026,Galaxy L7:2023-2026,Cityray:2024-2026',
    'changan|Changan|شانجان|CN|CS15:2016-2026,CS35=CS35:2012-2026,CS55:2017-2026,CS75:2013-2026,CS85:2019-2026,CS95:2016-2026,Alsvin=ألسفن:2008-2026,Eado=إيدو:2012-2026,Uni-T:2020-2026,Uni-K:2021-2026,Uni-V:2022-2026,Hunter:2021-2026,Raeton:2013-2026,Benni:2006-2026,X7 Plus:2019-2026,Lumin:2022-2026',
    'byd|BYD|بي واي دي|CN|F3:2005-2016,F0:2008-2015,L3:2010-2015,G3:2009-2014,S6:2011-2017,Song:2015-2026,Tang:2015-2026,Qin:2012-2026,Han:2020-2026,Yuan:2016-2026,Atto 3 / Yuan Plus:2022-2026,Dolphin:2021-2026,Seal:2022-2026,Seagull:2023-2026,Sealion:2024-2026,Shark:2024-2026,e6:2010-2026',
    'haval|Haval|هافال|CN|H1:2014-2021,H2:2014-2021,H6=H6:2011-2026,H9:2014-2026,F7:2018-2026,Jolion=جوليون:2020-2026,Dargo:2021-2026',
    'greatwall|Great Wall|جريت وول|CN|Wingle=وينجل:2006-2026,Poer:2019-2026,Hover:2005-2016,Deer:2000-2010,Safe:2001-2010,Voleex C30:2010-2016,Florid:2008-2013',
    'tank|Tank|تانك|CN|Tank 300:2021-2026,Tank 500:2021-2026,Tank 700:2024-2026',
    'wey|WEY|وي|CN|VV5:2017-2021,VV6:2018-2021,VV7:2017-2026,Coffee 01:2022-2026',
    'ora|ORA|أورا|CN|Good Cat:2020-2026,03:2020-2026',
    'jac|JAC|جاك|CN|J3:2008-2016,J5:2011-2016,J7:2020-2026,S2:2015-2026,S3:2014-2026,S4:2018-2026,S5:2013-2026,S7:2017-2026,T6:2015-2026,T8:2018-2026,Refine:2002-2026,Sunray:2011-2026',
    'baic|BAIC|بايك|CN|X25:2016-2023,X35:2016-2026,X55:2018-2026,X7:2020-2026,BJ40:2013-2026,BJ60:2023-2026,BJ80:2016-2026,U5:2018-2026,D20:2013-2020',
    'dongfeng|Dongfeng|دونغ فنغ|CN|AX7:2015-2026,Aeolus Shine:2019-2026,S30:2009-2016,H30:2010-2016,Rich:2006-2026,Mage:2022-2026,A30:2014-2020',
    'dfsk|DFSK|دي إف إس كيه|CN|Glory 580:2016-2026,Glory 500:2017-2026,C31:2012-2026,K01:2009-2026',
    'forthing|Forthing|فورثينج|CN|T5:2017-2026,T5 Evo:2021-2026,U-Tour:2021-2026',
    'faw|FAW|فاو|CN|V5:2012-2017,Oley:2012-2016,X40:2017-2023,Senia R7:2016-2020,Jiefang=جيفانغ (شاحنة):2000-2026',
    'bestune|Bestune|بيستيون|CN|B50:2009-2018,B70:2006-2026,T33:2019-2026,T55:2021-2026,T77:2018-2026,T99:2019-2026,NAT:2021-2026',
    'gac|GAC|جي إيه سي|CN|GS3:2017-2026,GS4:2015-2026,GS5:2011-2023,GS8:2016-2026,GA4:2017-2026,GA6:2014-2026,GA8:2016-2026,GN6:2019-2023,GN8:2020-2026,Emkoo:2023-2026,Empow:2021-2026,M8:2022-2026,Emzoom:2023-2026,Aion S:2019-2026,Aion Y:2021-2026',
    'jetour|Jetour|جيتور|CN|X70:2018-2026,X90:2019-2026,X95:2020-2026,Dashing:2022-2026,T2:2023-2026,X50:2023-2026',
    'exeed|Exeed|إكسيد|CN|TXL:2019-2026,VX:2021-2026,LX:2019-2026,RX:2023-2026',
    'omoda|Omoda|أومودا|CN|C5:2022-2026,E5:2023-2026,C7:2024-2026,C9:2024-2026',
    'jaecoo|Jaecoo|جايكو|CN|J7:2023-2026,J8:2024-2026',
    'hongqi|Hongqi|هونشي|CN|H5:2017-2026,H7:2013-2022,H9:2020-2026,HS5:2019-2026,HS7:2019-2026,E-HS9:2020-2026,HQ9:2024-2026,L5:2014-2026',
    'roewe|Roewe|رووي|CN|350:2010-2016,550:2008-2016,750:2006-2016,RX5:2016-2026,RX8:2018-2026,i5:2017-2026,i6:2016-2026',
    'baojun|Baojun|باوجون|CN|510:2017-2026,530:2018-2026,730:2014-2026,RS-5:2019-2023',
    'wuling|Wuling|وولينغ|CN|Hongguang:2010-2026,Almaz:2019-2026,Cortez:2017-2026,Air ev:2022-2026',
    'jetta|Jetta (China)|جيتا الصينية|CN|VA3:2019-2026,VS5:2019-2026,VS7:2020-2026',
    'zotye|Zotye|زوتي|CN|T600:2013-2020,Z300:2012-2018,SR9:2016-2019,Z100:2012-2016',
    'brilliance|Brilliance|بريليانس|CN|BS4:2006-2010,BS6:2004-2010,FRV:2008-2013,H230:2012-2018,H530:2011-2018,V5:2012-2022',
    'lifan|Lifan|ليفان|CN|320:2008-2015,520:2006-2012,620:2008-2016,X50:2014-2019,X60:2011-2019,Solano:2008-2016',
    'haima|Haima|هايما|CN|2:2010-2016,3:2008-2016,7:2010-2016,M3:2013-2019,S5:2014-2019,8S:2019-2024',
    'kaiyi|Kaiyi|كايي|CN|X3:2020-2026,X3 Pro:2022-2026,Showjet:2022-2026,E5:2021-2026',
    'soueast|Soueast|ساوايست|CN|DX3:2016-2023,DX7:2015-2022,S06:2024-2026,S07:2024-2026,S09:2024-2026',
    'maxus|Maxus|ماكسوس|CN|T60:2017-2026,T90:2021-2026,G10:2014-2026,D90:2017-2026,V80:2011-2026,Deliver 9:2020-2026',
    'foton|Foton|فوتون|CN|Tunland:2012-2026,Sauvana:2015-2026,View:2008-2026,Aumark:2005-2026,Gratour:2015-2026',
    'jmc|JMC|جيه إم سي|CN|Vigus:2017-2026,Yuhu:2012-2026,Baodian:2000-2026,Touring:2007-2026,Carrying:2014-2026',
    'nio|NIO|نيو|CN|ES6:2018-2026,ES8:2017-2026,EC6:2020-2026,ET5:2022-2026,ET7:2021-2026',
    'xpeng|XPeng|إكس بنغ|CN|G3:2018-2022,P5:2021-2023,P7:2020-2026,G6:2023-2026,G9:2022-2026,X9:2023-2026',
    'liauto|Li Auto|لي أوتو|CN|One:2019-2022,L6:2024-2026,L7:2023-2026,L8:2022-2026,L9:2022-2026,Mega:2024-2026',
    'zeekr|Zeekr|زيكر|CN|001:2021-2026,007:2023-2026,009:2022-2026,X:2023-2026,7X:2024-2026',
    'lynkco|Lynk & Co|لينك آند كو|CN|01:2017-2026,02:2018-2026,03:2018-2026,05:2019-2026,06:2020-2026,08:2023-2026,09:2021-2026',
    'leapmotor|Leapmotor|ليب موتور|CN|T03:2020-2026,C10:2023-2026,C11:2021-2026,C16:2024-2026',
    'neta|Neta|نيتا|CN|V:2020-2024,U:2019-2023,S:2022-2024,X:2024-2024',
    'aito|AITO / Seres|أيتو|CN|M5:2022-2026,M7:2022-2026,M9:2023-2026',
    'tata|Tata|تاتا|IN|Indica:2000-2018,Indigo:2002-2018,Nano:2008-2018,Safari:2000-2026,Sumo:2000-2019,Xenon:2007-2020,Nexon:2017-2026,Harrier:2019-2026,Tiago:2016-2026,Tigor:2017-2026,Altroz:2020-2026,Punch:2021-2026,Curvv:2024-2026,Ace:2005-2026',
    'mahindra|Mahindra|ماهيندرا|IN|Scorpio=سكوربيو:2002-2026,XUV500:2011-2021,XUV700:2021-2026,XUV300:2019-2024,XUV 3XO:2024-2026,Thar:2010-2026,Bolero:2000-2026,Pik-Up=بيك أب:2006-2026,KUV100:2016-2021,Marazzo:2018-2026,TUV300:2015-2021,Alturas G4:2018-2022,Xylo:2009-2019',
    'maruti|Maruti Suzuki|ماروتي سوزوكي|IN|Alto:2000-2026,Swift:2005-2026,Dzire:2008-2026,Wagon R:2000-2026,Baleno:2015-2026,Brezza:2016-2026,Ertiga:2012-2026,Celerio:2014-2026,Ciaz:2014-2026,Grand Vitara:2022-2026,Fronx:2023-2026,Jimny:2023-2026,Esteem:2000-2008,Zen:2000-2006,Omni:2000-2019,Gypsy:2000-2018,S-Presso:2019-2026,Ignis:2017-2026,XL6:2019-2026,Invicto:2023-2026,Eeco:2010-2026',
    'lada|Lada|لادا|RU|Granta=جرانتا:2011-2026,Vesta=فيستا:2015-2026,Niva / 4x4=نيفا:2000-2026,Niva Travel:2020-2026,Largus:2012-2026,Priora:2007-2018,Kalina:2004-2018,XRAY:2015-2022,2107=2107:2000-2012,110 / 111 / 112:2000-2014,Samara:2000-2013,Iskra:2025-2026,Aura:2024-2026',
    'uaz|UAZ|أواز|RU|Patriot:2005-2026,Hunter:2003-2026,Pickup:2008-2026,Bukhanka 452:2000-2026,Profi:2017-2026',
    'gaz|GAZ|غاز|RU|Gazelle:2000-2026,Gazelle Next:2013-2026,Sobol:2000-2026,Volga:2000-2010,Valdai:2004-2026',
    'ikco|Iran Khodro|إيران خودرو|IR|Samand=سمند:2002-2026,Dena=دنا:2011-2026,Soren=سورن:2007-2026,Runna=رانا:2012-2024,Tara=تارا:2022-2026,Paykan=بيكان:2000-2005,Peugeot Pars=بيجو بارس:2001-2026',
    'saipa|SAIPA|سايبا|IR|Pride=برايد:2000-2020,Tiba=تيبا:2009-2026,Saina=ساينا:2016-2026,Quick:2017-2026,Shahin=شاهين:2020-2026,Atlas:2022-2026',
    'togg|Togg|توغ|TR|T10X:2022-2026,T10F:2025-2026',
    'proton|Proton|بروتون|MY|Saga:2000-2026,Wira:2000-2009,Persona:2007-2026,Waja:2001-2011,Gen-2:2004-2012,Exora:2009-2026,Preve:2012-2020,Iriz:2014-2026,Inspira:2010-2015,Perdana:2013-2016,X50:2020-2026,X70:2018-2026,X90:2023-2026',
    'perodua|Perodua|بيرودوا|MY|Myvi:2005-2026,Axia:2014-2026,Bezza:2016-2026,Alza:2009-2026,Aruz:2019-2026,Ativa:2021-2026,Kancil:2000-2009,Kelisa:2001-2007,Kenari:2000-2009,Viva:2007-2014',
    'vinfast|VinFast|فين فاست|VN|Fadil:2019-2022,Lux A2.0:2019-2022,Lux SA2.0:2019-2022,VF e34:2021-2023,VF 3:2024-2026,VF 5:2023-2026,VF 6:2023-2026,VF 7:2023-2026,VF 8:2022-2026,VF 9:2022-2026',
    'hino|Hino|هينو|JP|Dutro:2000-2026,300 Series:2011-2026,500 Series:2003-2026,700 Series:2003-2026'
  ];

  var BRANDS = BRAND_RAW.map(function (line) {
    var p = line.split('|');
    var models = (p[4] || '').split(',').filter(Boolean).map(function (m) {
      var c = m.lastIndexOf(':');
      var name = m.slice(0, c), years = m.slice(c + 1).split('-');
      var eq = name.indexOf('=');
      return {
        en: eq > -1 ? name.slice(0, eq) : name,
        ar: eq > -1 ? name.slice(eq + 1) : '',
        from: parseInt(years[0], 10), to: parseInt(years[1] || years[0], 10)
      };
    });
    return { id: p[0], en: p[1], ar: p[2], origin: p[3], models: models };
  });

  /* Most-sold brands in Libya and the region come first in pickers. */
  var POPULAR = ['toyota', 'hyundai', 'kia', 'nissan', 'mercedes', 'chevrolet', 'mitsubishi', 'peugeot', 'volkswagen', 'renault', 'ford',
    'honda', 'mazda', 'bmw', 'isuzu', 'suzuki', 'lexus', 'chery', 'geely', 'changan', 'mg', 'haval', 'jetour', 'landrover', 'jeep',
    'gmc', 'opel', 'audi', 'fiat', 'dodge', 'byd', 'daewoo', 'ssangyong', 'skoda', 'seat', 'citroen', 'dacia'];

  var SYN = [
    ['فحمات', 'فحمة', 'تيل', 'بريك', 'brake', 'pads', 'plaquettes', 'pastillas', 'bremsbelag', 'balata', 'колодки', '刹车片'],
    ['بطارية', 'بطاريات', 'باتري', 'battery', 'batterie', 'bateria', 'batterie', 'akü', 'аккумулятор', '电池'],
    ['مساعدات', 'مساعد', 'امورتي', 'صنوبرص', 'shock', 'amortisseur', 'amortiguador', 'stoßdämpfer', 'amortisör', 'амортизатор', '减震'],
    ['فنار', 'فنارات', 'ضوء', 'اضاءة', 'لمبة', 'headlight', 'phare', 'faro', 'scheinwerfer', 'far', 'фара', '大灯'],
    ['رادياتير', 'رديتر', 'راديتر', 'radiator', 'radiateur', 'radiador', 'kühler', 'radyatör', 'радиатор', '水箱'],
    ['كمبروسر', 'كمبريسور', 'كومبروسر', 'compressor', 'compresseur', 'compresor', 'kompressor', 'kompresör', 'компрессор', '压缩机'],
    ['دينامو', 'دينمو', 'alternator', 'alternateur', 'alternador', 'lichtmaschine', 'alternatör', 'генератор', '发电机'],
    ['سلف', 'مارش', 'starter', 'démarreur', 'arranque', 'anlasser', 'marş', 'стартер', '启动机'],
    ['قير', 'جير', 'gear', 'gearbox', 'ناقل', 'boîte', 'caja', 'getriebe', 'şanzıman', 'коробка', '变速箱'],
    ['كلتش', 'دبرياج', 'clutch', 'embrayage', 'embrague', 'kupplung', 'debriyaj', 'сцепление', '离合'],
    ['اطار', 'اطارات', 'كوشوك', 'عجلة', 'tire', 'tyre', 'pneu', 'neumático', 'reifen', 'lastik', 'шина', '轮胎'],
    ['جنط', 'جنوط', 'rim', 'wheel', 'jante', 'llanta', 'felge', 'jant', 'диск', '轮毂'],
    ['زيت', 'زيوت', 'oil', 'huile', 'aceite', 'öl', 'yağ', 'масло', '机油'],
    ['فلتر', 'فلاتر', 'filter', 'filtre', 'filtro', 'filtro', 'фильтр', '滤'],
    ['بوجي', 'بوجيات', 'بواجي', 'spark', 'bougie', 'bujía', 'zündkerze', 'buji', 'свеча', '火花塞'],
    ['مراية', 'مرايات', 'mirror', 'rétroviseur', 'espejo', 'spiegel', 'ayna', 'зеркало', '后视镜'],
    ['صدام', 'bumper', 'pare-choc', 'parachoques', 'stoßstange', 'tampon', 'бампер', '保险杠'],
    ['سير', 'سيور', 'belt', 'تايمن', 'timing', 'courroie', 'correa', 'riemen', 'kayış', 'ремень', '皮带'],
    ['مكينة', 'محرك', 'engine', 'موتور', 'moteur', 'motor', 'двигатель', '发动机'],
    ['مكيف', 'تكييف', 'كنديشن', 'clim', 'climatisation', 'klima', 'кондиционер', '空调']
  ];

  window.SP_DATA = {
    COUNTRIES: COUNTRIES, PINNED: PINNED, LIBYA_CITIES: LIBYA_CITIES, CATS: CATS, CONDS: CONDS,
    BRANDS: BRANDS, POPULAR: POPULAR, SYN: SYN
  };
})();
