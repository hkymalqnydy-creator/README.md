#!/usr/bin/env python3
"""Builds the single-company edition of the app (one company, its branches and its customers) into its own folder,
with the company's name, icons, app ids and settings. The result is a complete project: web app, database setup,
invoice-reader function, sync bridge, Android/iPhone/Windows packaging and the guide.

  python3 tools/build_company.py --name CROSSKY --email owner@crossky.ly --brand branding/crossky/png --out crossky \
      --skin royal --color '#2F54E6' --logo branding/crossky/svg/wordmark-white.svg --logo-ink branding/crossky/svg/wordmark-ink.svg \
      --site-url https://hkymalqnydy-creator.github.io/README.md/crossky/

--demo (default on) lets the app run without a server, with sample data kept on the device; it switches itself off
as soon as supabaseUrl and supabaseKey are filled in config.js."""
import argparse
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = ['index.html', 'privacy.html', 'sw.js', 'css', 'js', 'img', 'LICENSE.txt']


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, text):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def copy(src, dst):
    if os.path.isdir(src):
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('node_modules', 'www', 'app', '__pycache__', 'sparat_sync.ini'))
    else:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)


def sub(text, old, new, count=1):
    if old not in text:
        raise SystemExit('build: expected text not found: ' + old[:60])
    return text.replace(old, new) if count == 0 else text.replace(old, new, count)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', required=True, help='company / app name, e.g. CROSSKY')
    ap.add_argument('--email', required=True, help='owner e-mail used by the demo (password 123456)')
    ap.add_argument('--brand', required=True, help='folder with the brand PNGs (see branding/crossky/make_assets.py)')
    ap.add_argument('--out', required=True, help='output folder (replaced)')
    ap.add_argument('--country', default='LY')
    ap.add_argument('--app-id', default='', help='Android/iOS id, default ly.<name>.app')
    ap.add_argument('--tagline-ar', default='قطع غيار السيارات الكورية واليابانية')
    ap.add_argument('--tagline-en', default='Korean & Japanese car parts')
    ap.add_argument('--no-demo', action='store_true')
    ap.add_argument('--skin', default='', help='look of the edition: "" (market look) or "royal" (brand blue, see css/styles.css)')
    ap.add_argument('--color', default='#0d2038', help='brand colour for the splash screen, browser bar and app shells')
    ap.add_argument('--logo', default='', help='wordmark SVG for the blue bar and splash (white); it replaces the name in the bar')
    ap.add_argument('--logo-ink', default='', help='wordmark SVG for paper and light screens (invoice, about page)')
    ap.add_argument('--hero-car', default='', help='picture of a car for the blue hero (SVG or PNG with a clear background)')
    ap.add_argument('--demo-extra', default='', help='JSON list of the edition\'s own demo parts with real photos (see branding/crossky/demo.json)')
    ap.add_argument('--site-url', default='', help='public address of this edition, for link previews (WhatsApp) and share links')
    ap.add_argument('--brands', default='KR,JP', help='brands shown until the owner picks them in the app: origin countries (KR,JP) or brand ids (toyota,kia); "all" for every brand')
    a = ap.parse_args()
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', a.color):
        raise SystemExit('--color must look like #2F54E6')
    site = a.site_url.strip()
    if site and not site.endswith('/'):
        site += '/'
    name, slug = a.name.strip(), re.sub(r'[^a-z0-9]+', '', a.name.lower()) or 'company'
    app_id = a.app_id or 'ly.%s.app' % slug
    out = os.path.abspath(a.out)
    data = read(os.path.join(ROOT, 'js', 'data.js'))
    known = re.findall(r"^\s*'?([a-z0-9-]+)\|[^|\n]*\|[^|\n]*\|([A-Z]{2})\|", data, re.M)  # id|Latin|Arabic|origin|models
    want = [x.strip() for x in a.brands.split(',') if x.strip()]
    if a.brands.strip().lower() == 'all':
        brands = []
    elif all(re.fullmatch(r'[A-Z]{2}', x) for x in want):
        brands = [i for i, o in known if o in want]
    else:
        ids = {i for i, o in known}
        bad = [x for x in want if x not in ids]
        if bad:
            raise SystemExit('unknown brand ids: %s' % ', '.join(bad))
        brands = want
    if a.brands.strip().lower() != 'all' and not brands:
        raise SystemExit('no brands match %r' % a.brands)
    brand = os.path.abspath(a.brand)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(out)

    # web app
    for k in WEB:
        copy(os.path.join(ROOT, k), os.path.join(out, k))
    copy(os.path.join(ROOT, 'supabase'), os.path.join(out, 'supabase'))
    copy(os.path.join(ROOT, 'tools', 'sync'), os.path.join(out, 'tools', 'sync'))
    for f in os.listdir(brand):
        if f.endswith('.png') and not f.startswith('app-'):
            copy(os.path.join(brand, f), os.path.join(out, 'icons', f))
    for src, dst in ((a.logo, 'logo.svg'), (a.logo_ink, 'logo-ink.svg')):
        if src:
            copy(os.path.abspath(src), os.path.join(out, 'icons', dst))
    hero_car = ''
    if a.hero_car:
        hero_car = 'icons/hero-car' + os.path.splitext(a.hero_car)[1].lower()
        copy(os.path.abspath(a.hero_car), os.path.join(out, hero_car))
    # the edition's own parts: their photos go to img/demo/, the list into config.js
    extra = []
    if a.demo_extra:
        base = os.path.dirname(os.path.abspath(a.demo_extra))
        for x in json.loads(read(a.demo_extra)):
            imgs = []
            for rel in x.get('imgs', []):
                dst = 'img/demo/' + os.path.basename(rel)
                copy(os.path.join(base, rel), os.path.join(out, dst))
                imgs.append(dst)
            extra.append(dict(x, imgs=imgs))
    svg = os.path.join(os.path.dirname(brand), 'svg', 'icon.svg')
    if os.path.exists(svg):
        copy(svg, os.path.join(out, 'icons', 'icon.svg'))

    write(os.path.join(out, 'config.js'), """/* %(name)s settings. Put your Supabase project URL and its public key here (Project Settings → API).
   The public key ("anon" / "publishable") is safe in the browser: the database rules in supabase/setup.sql protect the data.
   While both are empty and demo is true, the app runs as a demo with sample data kept on this device. */
window.SPARAT_CONFIG = {
  mode: 'company',          // one company with its branches, customers, staff and sales system
  appName: %(jname)s,
  supabaseUrl: '',          // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseKey: '',          // the anon / publishable key
  siteUrl: %(jsite)s,              // public address of the app, e.g. 'https://parts.example.ly/' (used in share links and e-mails)
  skin: %(jskin)s,                 // look: '' (market) or 'royal' (brand blue)
  logo: %(jlogo)s,                 // wordmark for the blue bar (it replaces the name there)
  logoInk: %(jink)s,              // wordmark for paper and light screens
  heroCar: %(jcar)s,              // picture of a car in the blue hero (skin royal)
  demoExtra: %(jextra)s,      // the edition's own demo parts, with real photos
  defaultCountry: %(jcountry)s,
  defaultLang: '',          // '' = follow the phone's language; or 'ar', 'en', 'fr', 'es', 'de', 'tr', 'ru', 'zh'
  demo: %(demo)s,             // demo data on the device while no server is set
  demoEmail: %(jemail)s,      // demo owner login (password 123456)
  brands: %(jbrands)s  // brands shown until the owner picks them (Owner panel → Company settings); [] = all
  // aiScan: false          // stop the app from trying the AI invoice reader (supabase/functions/scan-invoice)
};
""" % {'name': name, 'jname': json.dumps(name), 'jcountry': json.dumps(a.country), 'demo': 'false' if a.no_demo else 'true', 'jemail': json.dumps(a.email), 'jbrands': json.dumps(brands), 'jsite': json.dumps(site), 'jskin': json.dumps(a.skin),
       'jlogo': json.dumps('icons/logo.svg' if a.logo else ''), 'jink': json.dumps('icons/logo-ink.svg' if a.logo_ink else ''),
       'jcar': json.dumps(hero_car), 'jextra': json.dumps(extra, ensure_ascii=False)})

    m = json.loads(read(os.path.join(ROOT, 'manifest.webmanifest')))
    m.update({'name': name, 'short_name': name, 'description': '%s · %s. %s' % (name, a.tagline_ar, a.tagline_en), 'background_color': a.color, 'theme_color': a.color,
              'categories': ['shopping', 'business', 'productivity']})
    m['shortcuts'] = [
        {'name': 'نقطة البيع', 'short_name': 'البيع', 'url': './#pos', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]},
        {'name': 'استلام بضاعة', 'short_name': 'استلام', 'url': './#receive', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]},
        {'name': 'رقم الشاصي (VIN)', 'short_name': 'VIN', 'url': './#vin', 'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192'}]},
    ]
    write(os.path.join(out, 'manifest.webmanifest'), json.dumps(m, ensure_ascii=False, indent=2) + '\n')

    h = read(os.path.join(out, 'index.html'))
    desc = '%s: %s، والطلب واتساب ومنظومة مبيعات للشركة. %s.' % (name, a.tagline_ar, a.tagline_en)
    h = sub(h, '<title>سبيرات · Sparat</title>', '<title>%s</title>' % name)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % desc, h, count=1)
    h = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % desc, h, count=1)
    h = sub(h, '<meta name="apple-mobile-web-app-title" content="سبيرات">', '<meta name="apple-mobile-web-app-title" content="%s">' % name)
    h = sub(h, '<meta property="og:title" content="سبيرات · Sparat">', '<meta property="og:title" content="%s">' % name)
    h = sub(h, 'aria-label="سبيرات"', 'aria-label="%s"' % name)
    # splash screen and browser bar in the brand colour, with the wordmark when there is one
    h = sub(h, '<meta name="theme-color" content="#15181d">', '<meta name="theme-color" content="%s">' % a.color)
    h = sub(h, '.boot{min-height:100vh;display:grid;place-items:center;background:#15181d}', '.boot{min-height:100vh;display:grid;place-items:center;background:%s}' % a.color)
    if a.logo:
        h = sub(h, '<span class="brand-mark" aria-label="%s"></span>' % name, '<img class="boot-logo" src="icons/logo.svg" alt="%s">' % name)
        h = sub(h, '  .boot .brand-mark{', '  .boot-logo{width:min(56vw,260px);height:auto;animation:pulse 1.1s ease-in-out infinite alternate}\n  .boot .brand-mark{')
    # link previews (WhatsApp, Facebook) need absolute addresses
    if site:
        h = sub(h, '<meta property="og:image" content="icons/og.png">', '<meta property="og:image" content="%sicons/og.png">\n<meta property="og:url" content="%s">' % (site, site))
    h = sub(h, 'لاستخدام سبيرات · Please enable JavaScript to use Sparat.', 'لاستخدام %s · Please enable JavaScript to use %s.' % (name, name))
    write(os.path.join(out, 'index.html'), h)

    p = read(os.path.join(out, 'privacy.html'))
    p = p.replace('Sparat Privacy Policy', '%s Privacy Policy' % name).replace('تطبيق سبيرات', 'تطبيق %s' % name).replace('Sparat app', '%s app' % name)
    write(os.path.join(out, 'privacy.html'), p)

    # its own offline caches, so it never clears another app's caches on the same web address
    s = read(os.path.join(out, 'sw.js')).replace("'sparat-", "'%s-" % slug).replace("startsWith('sparat-')", "startsWith('%s-')" % slug)
    # the edition's own pictures belong to the shell too, so the bar and the hero look right when opened offline
    own = [f for f in ('icons/logo.svg', 'icons/logo-ink.svg', hero_car) if f and os.path.exists(os.path.join(out, f))]
    if own:
        s = sub(s, "'icons/icon.svg', 'icons/icon-192.png'];", "'icons/icon.svg', 'icons/icon-192.png', %s];" % ', '.join("'%s'" % f for f in own))
    write(os.path.join(out, 'sw.js'), s)

    # Android / iPhone (Capacitor) and Windows (Electron)
    pk = os.path.join(out, 'packaging')
    copy(os.path.join(ROOT, 'packaging', 'android-ios'), os.path.join(pk, 'android-ios'))
    copy(os.path.join(ROOT, 'packaging', 'windows'), os.path.join(pk, 'windows'))
    for f in os.listdir(brand):
        if f.startswith('app-'):
            copy(os.path.join(brand, f), os.path.join(pk, 'android-ios', 'assets', f[4:]))
    cap = json.loads(read(os.path.join(pk, 'android-ios', 'capacitor.config.json')))
    cap.update({'appId': app_id, 'appName': name})
    cap.setdefault('android', {})['backgroundColor'] = a.color
    cap.setdefault('ios', {})['backgroundColor'] = a.color
    write(os.path.join(pk, 'android-ios', 'capacitor.config.json'), json.dumps(cap, ensure_ascii=False, indent=2) + '\n')
    pj = json.loads(read(os.path.join(pk, 'android-ios', 'package.json')))
    pj.update({'name': slug + '-mobile', 'description': '%s for Android and iPhone (Capacitor wrapper around the web app)' % name})
    write(os.path.join(pk, 'android-ios', 'package.json'), json.dumps(pj, ensure_ascii=False, indent=2) + '\n')
    wj = json.loads(read(os.path.join(pk, 'windows', 'package.json')))
    wj.update({'name': slug + '-windows', 'productName': name, 'description': '%s desktop app for Windows' % name})
    wj['build'].update({'appId': app_id.replace('.app', '.desktop'), 'productName': name})
    wj['build']['nsis']['shortcutName'] = name
    write(os.path.join(pk, 'windows', 'package.json'), json.dumps(wj, ensure_ascii=False, indent=2) + '\n')
    wm = read(os.path.join(pk, 'windows', 'main.js')).replace("title: 'Sparat'", "title: %s" % json.dumps(name)).replace("'#15181d'", "'%s'" % a.color).replace('Sparat for Windows', '%s for Windows' % name)
    write(os.path.join(pk, 'windows', 'main.js'), wm)

    # guide
    guide = os.path.join(ROOT, 'docs', 'دليل-نسخة-الشركة.md')
    if os.path.exists(guide):
        write(os.path.join(out, 'docs', 'دليل-نسخة-الشركة.md'), read(guide).replace('{{NAME}}', name).replace('{{EMAIL}}', a.email))
    readme = os.path.join(ROOT, 'docs', 'company-README.md')
    if os.path.exists(readme):
        write(os.path.join(out, 'README.md'), read(readme).replace('{{NAME}}', name).replace('{{EMAIL}}', a.email).replace('{{APPID}}', app_id))
    print('built %s edition in %s' % (name, out))


if __name__ == '__main__':
    main()
