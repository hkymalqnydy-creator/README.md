/* Sparat settings. Put your Supabase project URL and its public key here (Project Settings → API).
   The public key ("anon" / "publishable") is safe in the browser: the database rules in supabase/setup.sql protect the data. */
window.SPARAT_CONFIG = {
  supabaseUrl: '',          // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseKey: '',          // the anon / publishable key
  siteUrl: '',              // public address of the site, e.g. 'https://example.github.io/sparat/' (used in share links and emails)
  defaultCountry: 'LY',     // country shown on first visit (ISO code)
  defaultLang: ''           // '' = follow the phone's language; or 'ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'zh'
};
