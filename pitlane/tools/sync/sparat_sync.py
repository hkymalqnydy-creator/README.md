#!/usr/bin/env python3
"""
Sync bridge: sends item codes, names, barcodes, prices and stock from your sales system to the app.

  1. In the app (owner account): Admin panel -> Sales system -> "Create link key". Copy the key.
  2. Export the items list from your sales system to Excel (.xlsx) or CSV, with a header row.
     Arabic or English column names both work: code / رقم الصنف, name / اسم الصنف, price / السعر,
     quantity / الكمية, and if you have them barcode / الباركود, brand / الماركة, model / الموديل, part number / رقم القطعة.
  3. Send it once:
       python sparat_sync.py --url https://YOUR-PROJECT.supabase.co --anon YOUR-PUBLIC-KEY --key LINK-KEY --file items.xlsx
     Keep the app in step with the sales system (sends again whenever the file changes):
       python sparat_sync.py ... --watch
     Check what the file contains without sending anything:
       python sparat_sync.py --file items.xlsx --dry-run

Settings can also be kept in sparat_sync.ini next to this file:
  [sync]
  url = https://YOUR-PROJECT.supabase.co
  anon = YOUR-PUBLIC-KEY
  key = LINK-KEY
  file = C:\\Sales\\items.xlsx
  every = 60

Only Python 3.8 or newer is needed (no extra packages). On Windows you can run it at startup with Task Scheduler.
Items are matched by their code: a new code adds a part, a known code updates its name, price and stock.
A quantity of 0 marks the part as sold out.
"""
import argparse
import configparser
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

BATCH = 500

# ---------- reading the file ----------

def norm(s):
    """Same normalisation as the app: lower case, Arabic letter variants unified, marks removed."""
    s = str(s or '')
    s = s.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')).lower()
    s = re.sub('[\u064B-\u065F\u0670\u0640]', '', s)
    s = re.sub('[أإآٱ]', 'ا', s).replace('ة', 'ه').replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not ('\u0300' <= c <= '\u036f'))
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[^\w\s\-/.]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def read_csv(path):
    raw = open(path, 'rb').read()
    text = None
    for enc in ('utf-8-sig', 'cp1256', 'latin-1'):  # Arabic Windows exports are often cp1256
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    sample = text[:4096]
    delim = max([',', ';', '\t', '|'], key=lambda d: sample.count(d))
    return [row for row in csv.reader(io.StringIO(text), delimiter=delim)]


def read_xlsx(path):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rel_ns = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        shared = []
        if 'xl/sharedStrings.xml' in names:
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('m:si', ns):
                shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
        sheet = 'xl/worksheets/sheet1.xml'
        try:  # the first sheet in the workbook's order
            wb = ET.fromstring(z.read('xl/workbook.xml'))
            first = wb.find('m:sheets/m:sheet', ns)
            rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
            for r in rels:
                if r.get('Id') == first.get(rel_ns):
                    target = r.get('Target').lstrip('/')
                    sheet = target if target.startswith('xl/') else 'xl/' + target
        except Exception:
            pass
        root = ET.fromstring(z.read(sheet))
    rows = []
    for row in root.iter('{%s}row' % ns['m']):
        cells = {}
        for c in row.findall('m:c', ns):
            ref = re.match(r'([A-Z]+)', c.get('r', 'A'))
            col = 0
            for ch in ref.group(1):
                col = col * 26 + (ord(ch) - 64)
            kind = c.get('t')
            if kind == 'inlineStr':
                val = ''.join(t.text or '' for t in c.iter('{%s}t' % ns['m']))
            else:
                v = c.find('m:v', ns)
                val = v.text if v is not None and v.text is not None else ''
                if kind == 's' and val != '':
                    val = shared[int(val)]
                elif kind not in ('s', 'str', 'b', 'e') and re.fullmatch(r'-?\d+\.0+', val):
                    val = val.split('.')[0]  # 12.0 -> 12
            cells[col - 1] = val
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(i, '') for i in range(width)])
    return rows


def read_table(path):
    if re.search(r'\.(xlsx|xlsm)$', path, re.I):
        return read_xlsx(path)
    if re.search(r'\.xls$', path, re.I):
        sys.exit('Old .xls files cannot be read: save it as .xlsx or CSV from Excel, then try again.')
    return read_csv(path)

# ---------- columns ----------

COLS = {
    'sku': ['sku', 'code', 'item code', 'itemcode', 'item_code', 'كود', 'الكود', 'رقم الصنف', 'كود الصنف', 'رمز الصنف', 'رقم الماده', 'كود الماده', 'الرمز'],
    'barcode': ['barcode', 'bar code', 'ean', 'upc', 'gtin', 'الباركود', 'باركود'],
    'title': ['name', 'item name', 'item', 'title', 'description', 'اسم الصنف', 'الصنف', 'اسم الماده', 'الاسم', 'البيان', 'الوصف', 'الماده', 'اسم القطعه', 'القطعه'],
    'price': ['price', 'sale price', 'selling price', 'retail price', 'سعر', 'السعر', 'سعر البيع', 'سعر المستهلك', 'سعر القطاعي'],
    'qty': ['qty', 'quantity', 'stock', 'balance', 'on hand', 'الكميه', 'الرصيد', 'المخزون', 'الكميه المتوفره', 'الموجود', 'العدد'],
    'make': ['brand', 'make', 'manufacturer', 'الماركه', 'نوع السياره', 'الشركه المصنعه', 'المصنع', 'السياره'],
    'model': ['model', 'الموديل', 'الطراز'],
    'part_no': ['oem', 'part number', 'part no', 'partno', 'oem no', 'oem number', 'رقم القطعه', 'رقم المصنع', 'الرقم الاصلي', 'رقم الوكاله'],
    'cat': ['category', 'group', 'القسم', 'المجموعه', 'الفئه', 'التصنيف'],
}

BRANDS = {"تويوتا": "toyota", "toyota": "toyota", "لكزس": "lexus", "lexus": "lexus", "نيسان": "nissan", "nissan": "nissan", "انفينيتي": "infiniti", "infiniti": "infiniti", "هوندا": "honda", "honda": "honda", "اكورا": "acura", "acura": "acura", "مازدا": "mazda", "mazda": "mazda", "ميتسوبيشي": "mitsubishi", "mitsubishi": "mitsubishi", "سوبارو": "subaru", "subaru": "subaru", "سوزوكي": "suzuki", "suzuki": "suzuki", "ايسوزو": "isuzu", "isuzu": "isuzu", "دايهاتسو": "daihatsu", "daihatsu": "daihatsu", "هيونداي": "hyundai", "hyundai": "hyundai", "كيا": "kia", "kia": "kia", "جينيسيس": "genesis", "genesis": "genesis", "سانغ يونغ": "ssangyong", "ssangyong": "ssangyong", "kgm": "ssangyong", "دايو": "daewoo", "daewoo": "daewoo", "مرسيدس": "mercedes", "mercedes-benz": "mercedes", "mercedes": "mercedes", "بي ام دبليو": "bmw", "bmw": "bmw", "اودي": "audi", "audi": "audi", "فولكس فاجن": "volkswagen", "volkswagen": "volkswagen", "بورشه": "porsche", "porsche": "porsche", "اوبل": "opel", "opel": "opel", "مايباخ": "maybach", "maybach": "maybach", "سمارت": "smart", "smart": "smart", "مان": "man", "man": "man", "بيجو": "peugeot", "peugeot": "peugeot", "رينو": "renault", "renault": "renault", "ستروين": "citroen", "citroen": "citroen", "دي اس": "ds", "ds": "ds", "البين": "alpine", "alpine": "alpine", "بوغاتي": "bugatti", "bugatti": "bugatti", "داسيا": "dacia", "dacia": "dacia", "فيات": "fiat", "fiat": "fiat", "الفا روميو": "alfaromeo", "alfa romeo": "alfaromeo", "alfaromeo": "alfaromeo", "فيراري": "ferrari", "ferrari": "ferrari", "لامبورغيني": "lamborghini", "lamborghini": "lamborghini", "مازيراتي": "maserati", "maserati": "maserati", "لانشيا": "lancia", "lancia": "lancia", "ابارث": "abarth", "abarth": "abarth", "ايفيكو": "iveco", "iveco": "iveco", "فورد": "ford", "ford": "ford", "شيفروليه": "chevrolet", "chevrolet": "chevrolet", "جي ام سي": "gmc", "gmc": "gmc", "كاديلاك": "cadillac", "cadillac": "cadillac", "بيوك": "buick", "buick": "buick", "كرايسلر": "chrysler", "chrysler": "chrysler", "دودج": "dodge", "dodge": "dodge", "جيب": "jeep", "jeep": "jeep", "رام": "ram", "ram": "ram", "لينكولن": "lincoln", "lincoln": "lincoln", "تسلا": "tesla", "tesla": "tesla", "همر": "hummer", "hummer": "hummer", "بونتياك": "pontiac", "pontiac": "pontiac", "ميركوري": "mercury", "mercury": "mercury", "ساترن": "saturn", "saturn": "saturn", "سايون": "scion", "scion": "scion", "اولدزموبيل": "oldsmobile", "oldsmobile": "oldsmobile", "لوسيد": "lucid", "lucid": "lucid", "ريفيان": "rivian", "rivian": "rivian", "هولدن": "holden", "holden": "holden", "لاند روفر": "landrover", "land rover": "landrover", "landrover": "landrover", "جاكوار": "jaguar", "jaguar": "jaguar", "بنتلي": "bentley", "bentley": "bentley", "رولز رويس": "rollsroyce", "rolls-royce": "rollsroyce", "rollsroyce": "rollsroyce", "استون مارتن": "astonmartin", "aston martin": "astonmartin", "astonmartin": "astonmartin", "ماكلارين": "mclaren", "mclaren": "mclaren", "لوتس": "lotus", "lotus": "lotus", "ميني": "mini", "mini": "mini", "ام جي": "mg", "mg": "mg", "روفر": "rover", "rover": "rover", "فولفو": "volvo", "volvo": "volvo", "ساب": "saab", "saab": "saab", "بولستار": "polestar", "polestar": "polestar", "سكانيا": "scania", "scania": "scania", "داف": "daf", "daf": "daf", "سكودا": "skoda", "skoda": "skoda", "سيات": "seat", "seat": "seat", "كوبرا": "cupra", "cupra": "cupra", "شيري": "chery", "chery": "chery", "جيلي": "geely", "geely": "geely", "شانجان": "changan", "changan": "changan", "بي واي دي": "byd", "byd": "byd", "هافال": "haval", "haval": "haval", "جريت وول": "greatwall", "great wall": "greatwall", "greatwall": "greatwall", "تانك": "tank", "tank": "tank", "وي": "wey", "wey": "wey", "اورا": "ora", "ora": "ora", "جاك": "jac", "jac": "jac", "بايك": "baic", "baic": "baic", "دونغ فنغ": "dongfeng", "dongfeng": "dongfeng", "دي اف اس كيه": "dfsk", "dfsk": "dfsk", "فورثينج": "forthing", "forthing": "forthing", "فاو": "faw", "faw": "faw", "بيستيون": "bestune", "bestune": "bestune", "جي ايه سي": "gac", "gac": "gac", "جيتور": "jetour", "jetour": "jetour", "اكسيد": "exeed", "exeed": "exeed", "اومودا": "omoda", "omoda": "omoda", "جايكو": "jaecoo", "jaecoo": "jaecoo", "هونشي": "hongqi", "hongqi": "hongqi", "رووي": "roewe", "roewe": "roewe", "باوجون": "baojun", "baojun": "baojun", "وولينغ": "wuling", "wuling": "wuling", "جيتا الصينيه": "jetta", "jetta china": "jetta", "jetta": "jetta", "زوتي": "zotye", "zotye": "zotye", "بريليانس": "brilliance", "brilliance": "brilliance", "ليفان": "lifan", "lifan": "lifan", "هايما": "haima", "haima": "haima", "كايي": "kaiyi", "kaiyi": "kaiyi", "ساوايست": "soueast", "soueast": "soueast", "ماكسوس": "maxus", "maxus": "maxus", "فوتون": "foton", "foton": "foton", "جيه ام سي": "jmc", "jmc": "jmc", "نيو": "nio", "nio": "nio", "اكس بنغ": "xpeng", "xpeng": "xpeng", "لي اوتو": "liauto", "li auto": "liauto", "liauto": "liauto", "زيكر": "zeekr", "zeekr": "zeekr", "لينك اند كو": "lynkco", "lynk co": "lynkco", "lynkco": "lynkco", "ليب موتور": "leapmotor", "leapmotor": "leapmotor", "نيتا": "neta", "neta": "neta", "ايتو": "aito", "aito": "aito", "seres": "aito", "تاتا": "tata", "tata": "tata", "ماهيندرا": "mahindra", "mahindra": "mahindra", "ماروتي سوزوكي": "maruti", "maruti suzuki": "maruti", "maruti": "maruti", "لادا": "lada", "lada": "lada", "اواز": "uaz", "uaz": "uaz", "غاز": "gaz", "gaz": "gaz", "ايران خودرو": "ikco", "iran khodro": "ikco", "ikco": "ikco", "سايبا": "saipa", "saipa": "saipa", "توغ": "togg", "togg": "togg", "بروتون": "proton", "proton": "proton", "بيرودوا": "perodua", "perodua": "perodua", "فين فاست": "vinfast", "vinfast": "vinfast", "هينو": "hino", "hino": "hino"}
CATS = {"engine": "engine", "المحرك وقطعه": "engine", "المحرك": "engine", "brakes": "brakes", "الفرامل": "brakes", "suspension": "suspension", "التعليق والمساعدات": "suspension", "التعليق": "suspension", "suspension steering": "suspension", "electrical": "electrical", "الكهرباء والبطاريات": "electrical", "الكهرباء": "electrical", "electrical batteries": "electrical", "lights": "lights", "الاضاءه والفنارات": "lights", "الاضاءه": "lights", "lighting": "lights", "body": "body", "البودي والهيكل": "body", "البودي": "body", "body parts": "body", "oils": "oils", "الزيوت والفلاتر": "oils", "زيوت وفلاتر": "oils", "oils filters": "oils", "cooling": "cooling", "التبريد والرادياتير": "cooling", "التبريد": "cooling", "ac": "ac", "التكييف": "ac", "air conditioning": "ac", "a/c": "ac", "transmission": "transmission", "ناقل الحركه والكلتش": "transmission", "القير": "transmission", "transmission clutch": "transmission", "gearbox": "transmission", "tires": "tires", "الاطارات والجنوط": "tires", "اطارات وجنوط": "tires", "tyres wheels": "tires", "tyres": "tires", "interior": "interior", "الداخليه والاكسسوارات": "interior", "الداخليه": "interior", "interior accessories": "interior", "other": "other", "قطع اخري": "other", "اخري": "other", "other parts": "other"}


def detect(rows):
    """Finds the header row (within the first 6) and which column holds what."""
    for r in range(min(len(rows), 6)):
        head = [norm(h) for h in rows[r]]
        found = {}
        for i, h in enumerate(head):
            for k, words in COLS.items():
                if k not in found and any(norm(w) == h for w in words):
                    found[k] = i
        for i, h in enumerate(head):
            if not h or i in found.values():
                continue
            for k, words in COLS.items():
                if k not in found and any(len(norm(w)) > 3 and norm(w) in h for w in words):
                    found[k] = i
        if len(found) >= 2:
            return r, found
    return None, {}


def number(s):
    s = norm(s).replace(' ', '')
    if re.fullmatch(r'-?\d{1,3}(,\d{3})+(\.\d+)?', s):
        s = s.replace(',', '')
    s = s.replace(',', '.')
    s = re.sub(r'[^\d.\-]', '', s)
    try:
        return float(s)
    except ValueError:
        return None


def to_items(rows, head_row, cols):
    out = []
    for r in rows[head_row + 1:]:
        cell = lambda k: str(r[cols[k]]).strip() if k in cols and cols[k] < len(r) and r[cols[k]] is not None else None
        sku = cell('sku') if 'sku' in cols else cell('barcode')
        if not sku:
            continue
        item = {'sku': sku[:60]}
        if cell('title'):
            item['title'] = cell('title')[:120]
        if cell('barcode'):
            item['barcode'] = re.sub(r'\s', '', cell('barcode'))[:60]
        if cell('price') not in (None, ''):
            p = number(cell('price'))
            item['price'] = p if p is not None and p >= 0 else None
        if cell('qty') not in (None, ''):
            q = number(cell('qty'))
            item['qty'] = int(q) if q is not None else None
        if cell('make'):
            m = BRANDS.get(norm(cell('make')))
            if m:
                item['make'] = m
        if 'model' in cols:
            item['model'] = (cell('model') or '')[:60]
        if cell('part_no'):
            item['part_no'] = cell('part_no').upper()[:60]
        if cell('cat'):
            c = CATS.get(norm(cell('cat')))
            if c:
                item['cat'] = c
        out.append(item)
    return out

# ---------- sending ----------

def send(cfg, items):
    url = cfg['url'].rstrip('/') + '/rest/v1/rpc/sync_products'
    total = {'inserted': 0, 'updated': 0, 'skipped': 0, 'errors': 0}
    for i in range(0, len(items), BATCH):
        body = {'p_key': cfg['key'], 'p_rows': items[i:i + BATCH]}
        if cfg.get('branch'):
            body['p_shop'] = cfg['branch']
        req = urllib.request.Request(url, data=json.dumps(body, ensure_ascii=False).encode('utf-8'), method='POST', headers={
            'apikey': cfg['anon'], 'Authorization': 'Bearer ' + cfg['anon'], 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                part = json.loads(res.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')
            if 'invalid sync key' in msg:
                sys.exit('The link key is not valid. Create a new one in the app (Admin panel -> Sales system) and use it here.')
            sys.exit('The server refused the data (%s): %s' % (e.code, msg[:300]))
        except urllib.error.URLError as e:
            raise ConnectionError(str(e.reason))
        for k in total:
            total[k] += int(part.get(k, 0) or 0)
    return total


def load_config(args):
    cfg = {}
    ini = args.config or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sparat_sync.ini')
    if os.path.exists(ini):
        cp = configparser.ConfigParser()
        cp.read(ini, encoding='utf-8')
        if cp.has_section('sync'):
            cfg.update({k: v.strip() for k, v in cp.items('sync')})
    for k in ('url', 'anon', 'key', 'file', 'branch', 'every'):
        v = getattr(args, k, None)
        if v:
            cfg[k] = str(v)
    return cfg


def run_once(cfg, dry):
    rows = read_table(cfg['file'])
    head, cols = detect(rows)
    if head is None or ('sku' not in cols and 'barcode' not in cols):
        sys.exit('No item-code column found. The first row of the file should have column names such as "code" or "رقم الصنف".')
    items = to_items(rows, head, cols)
    names = ', '.join('%s=column %d' % (k, v + 1) for k, v in cols.items())
    print('Read %d items from %s (%s)' % (len(items), os.path.basename(cfg['file']), names))
    if dry:
        for it in items[:5]:
            print('  ', json.dumps(it, ensure_ascii=False))
        return
    for k in ('url', 'anon', 'key'):
        if not cfg.get(k):
            sys.exit('Missing --%s (or "%s =" in sparat_sync.ini).' % (k, k))
    r = send(cfg, items)
    print('Done: %(inserted)d new, %(updated)d updated, %(skipped)d skipped, %(errors)d errors' % r)


def main():
    ap = argparse.ArgumentParser(description='Send items from your sales system to the app.')
    ap.add_argument('--url', help='Supabase project address, e.g. https://abcd.supabase.co')
    ap.add_argument('--anon', help='the public (anon / publishable) key from config.js')
    ap.add_argument('--key', help='the link key created in the app (Admin panel -> Sales system)')
    ap.add_argument('--file', help='the exported items file (.xlsx or .csv)')
    ap.add_argument('--branch', help='optional: id of the branch that new items belong to')
    ap.add_argument('--watch', action='store_true', help='keep running and send again whenever the file changes')
    ap.add_argument('--every', type=int, help='with --watch: seconds between checks (default 60)')
    ap.add_argument('--dry-run', action='store_true', help='only show what was read from the file')
    ap.add_argument('--config', help='path of an .ini file with the settings')
    args = ap.parse_args()
    cfg = load_config(args)
    if not cfg.get('file'):
        ap.error('--file is required (or "file =" in sparat_sync.ini)')
    if not args.watch:
        run_once(cfg, args.dry_run)
        return
    every = max(10, int(cfg.get('every') or 60))
    last = None
    print('Watching %s (every %d seconds). Press Ctrl+C to stop.' % (cfg['file'], every))
    while True:
        try:
            stamp = os.path.getmtime(cfg['file'])
            if stamp != last:
                time.sleep(2)  # let the sales system finish writing the file
                run_once(cfg, args.dry_run)
                last = stamp
        except FileNotFoundError:
            print('Waiting for %s ...' % cfg['file'])
        except ConnectionError as e:
            print('No connection (%s). Trying again later.' % e)
        except KeyboardInterrupt:
            return
        time.sleep(every)


if __name__ == '__main__':
    main()
