/* CROSSKY settings. Put your Supabase project URL and its public key here (Project Settings → API).
   The public key ("anon" / "publishable") is safe in the browser: the database rules in supabase/setup.sql protect the data.
   While both are empty and demo is true, the app runs as a demo with sample data kept on this device. */
window.SPARAT_CONFIG = {
  mode: 'company',          // one company with its branches, customers, staff and sales system
  appName: "CROSSKY",
  supabaseUrl: '',          // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseKey: '',          // the anon / publishable key
  siteUrl: "https://hkymalqnydy-creator.github.io/README.md/crossky/",              // public address of the app, e.g. 'https://parts.example.ly/' (used in share links and e-mails)
  skin: "royal",                 // look: '' (market) or 'royal' (brand blue)
  logo: "icons/logo.svg",                 // wordmark for the blue bar (it replaces the name there)
  logoInk: "icons/logo-ink.svg",              // wordmark for paper and light screens
  heroCar: "icons/hero-car.svg",              // picture of a car in the blue hero (skin royal)
  demoExtra: [{"sku": "CS-AF-100", "title": "فلتر هواء CROSSKY", "cat": "oils", "cond": "original", "price": 45, "qty": 80, "make": "any", "part_no": "CS-AF-100", "descr": "فلتر هواء أصلي من CROSSKY في علبته. تنقية عالية للهواء وأداء ممتاز للمحرك.", "imgs": ["img/demo/crossky-air-filter.jpg"]}],      // the edition's own demo parts, with real photos
  defaultCountry: "LY",
  defaultLang: '',          // '' = follow the phone's language; or 'ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'zh'
  demo: true,             // demo data on the device while no server is set
  demoEmail: "owner@crossky.ly",      // demo owner login (password 123456)
  brands: ["toyota", "lexus", "nissan", "infiniti", "honda", "acura", "mazda", "mitsubishi", "subaru", "suzuki", "isuzu", "daihatsu", "hyundai", "kia", "genesis", "ssangyong", "daewoo", "hino"]  // brands shown until the owner picks them (Owner panel → Company settings); [] = all
  // aiScan: false          // stop the app from trying the AI invoice reader (supabase/functions/scan-invoice)
};
