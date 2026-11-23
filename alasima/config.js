/* متجر العاصمة settings. Put your Supabase project URL and its public key here (Project Settings → API).
   The public key ("anon" / "publishable") is safe in the browser: the database rules in supabase/setup.sql protect the data.
   While both are empty and demo is true, the app runs as a demo with sample data kept on this device. */
window.SPARAT_CONFIG = {
  mode: 'company',          // one company with its branches, customers, staff and sales system
  appName: "متجر العاصمة",
  slug: "alasima",          // the edition's short id: what it keeps on the phone stays its own
  supabaseUrl: '',          // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseKey: '',          // the anon / publishable key
  siteUrl: "https://hkymalqnydy-creator.github.io/README.md/alasima/",              // public address of the app, e.g. 'https://parts.example.ly/' (used in share links and e-mails)
  skin: "royal",                 // look: '' (market) or 'royal' (brand colour)
  tint: "burgundy",                 // colour of the royal skin: '' (royal blue) or 'burgundy'
  logo: "icons/logo.svg",                 // wordmark for the blue bar (it replaces the name there)
  logoInk: "icons/logo-ink.svg",              // wordmark for paper and light screens
  heroCar: "icons/hero-car.svg",              // picture of a car in the blue hero (skin royal)
  demoExtra: [],      // the edition's own demo parts, with real photos
  demoAds: [{"id": "welcome", "img": "", "title": "أهلاً بيك في متجر العاصمة", "sub": "قطع غيار أصلية وتجارية لكل السيارات، والتوصيل لكل ليبيا.", "cta": "اسألنا على واتساب", "go": "wa", "to": "", "pos": "", "until": "", "on": true}],      // the demo's ads at the top of the home screen (the owner changes them in Owner panel → Ads)
  demoEmpty: true,     // true: the demo has no parts and no sales yet, to fill with your own (accounts, branches and settings stay)
  demoTexts: {"tagline": "قطع غيار السيارات", "hero_title": "قطع غيار سيارتك… كلها عندنا", "about": "{app} لقطع غيار السيارات: قطع أصلية وتجارية لكل الماركات.\n\nنخدم الزبائن والورش والتجار في كل ليبيا، بأسعار الجملة والقطاعي ومع التوصيل."},      // the demo's words on the home and «about us» (the owner changes them in Owner panel → Company settings)
  defaultCountry: "LY",
  defaultLang: '',          // '' = follow the phone's language; or 'ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'zh'
  demo: true,             // demo data on the device while no server is set
  demoEmail: "owner@alasima.ly",      // demo owner login (password 123456)
  brands: []  // brands shown until the owner picks them (Owner panel → Company settings); [] = all
  // aiScan: false          // stop the app from trying the AI invoice reader (supabase/functions/scan-invoice)
};
