# سبيرات · Sparat

سوق قطع غيار السيارات: المحلات تسجّل وتنزّل بضاعتها بالصور، والزبائن يبحثون ويتواصلون مع المحل على واتساب مباشرة.

## المزايا

- **8 لغات**: العربية، English، Français، Español، Deutsch، Türkçe، Русский، 中文. الاتجاه يتبدّل تلقائياً بين اليمين واليسار.
- **217 دولة**: كل دولة «سيرفر» مستقل بمحلاته ومدنه وعملته، وجنب كل دولة علمها.
- **135 ماركة و1400 موديل** بسنوات الإنتاج من 2000 إلى 2026. اختيار الموديل يحدد السنوات المتاحة.
- **رقم الشاصي (VIN)**: يعرف الماركة وبلد التصنيع والسنة من جدول مصانع العالم (496 كود)، ويجيب الموديل والمحرك من قاعدة NHTSA الأمريكية المفتوحة.
- **تطبيق قابل للتثبيت (PWA)** على أندرويد وآيفون وويندوز، ويفتح بدون إنترنت.
- **للتاجر**: تسجيل المحل بالشعار وصورة الواجهة، إضافة القطع بست صور، «نفدت الكمية»، إحصائيات.
- **للإدارة**: أول حساب يُنشأ يصبح المدير. يوثّق المحلات، ويعدّل أي محل، ويضع إعلاناً في الرئيسية.
- **الأمان**: قواعد صلاحيات داخل قاعدة البيانات (RLS)، فلا يقدر أحد يعدّل محل غيره حتى لو تلاعب بالتطبيق.

## نسخة الشركة الواحدة (مثال: [`crossky/`](crossky/))

نفس الكود يشتغل كتطبيق لشركة واحدة وفروعها (`mode: 'company'` في `config.js`)، ويضيف:

- تحكم كامل للمالك: الاسم والشعار والنصوص، إخفاء الأسعار (للكل، للمسجّلين، للمعتمدين، أو لقطع معينة)، اعتماد الزبائن، والماركات المعروضة بشعار يرفعه لكل ماركة.
- طلبات الزبائن من التطبيق (مش واتساب): الطلب ينزل فاتورة في المبيعات «قيد التجهيز» ثم «قيد الاستلام» ثم «تم الاستلام»، أو «ملغي» والقطع ترجع للمخزن؛ والزبون يتابعه في «طلباتي». ومساعد رد آلي بقواعد يكتبها المالك، ونصوص جاهزة لـ WhatsApp Business.
- التجار: يسجلوا باسم المحل ورقم الهاتف، ويدخلوا برقم الهاتف أو بالإيميل، ولو نسوا كلمة السر يوصلهم كود على الإيميل أو SMS صالح دقيقة ونص. لكل تاجر «صادر ووارد» (الفواتير اللي توصله، طلباته ودفعاته، والباقي عليه بعد الاعتماد)، و«ابعث الفاتورة للتاجر» من الفاتورة أو الطلب، وصفحة «التجار» في المنظومة.
- الشركة المصنّعة لكل قطعة (موبيس، دنسو…): تبيع وتستلم وتدوّر بيها وبالموديل في نقطة البيع واستلام البضاعة والمخزن، مع الباركود ورقم الصنف، وتنطبع في الفاتورة. وسجل الاستلام يلقى الاستلام بالمورّد أو اسم القطعة أو رقم الصنف أو الشركة.
- منظومة مبيعات: نقطة بيع، فواتير وطباعة ومرتجعات، تقارير وأرباح، موظفين بصلاحيات تتحقق منها قاعدة البيانات.
- حسابات: المخزن وقيمته وتعديلاته (تالف، ضايع، جرد)، ديون الزبائن والموردين ودفعاتهم، المصروفات، والأرباح والخسائر مع ربح كل بايع.
- تبويب «المنظومة» جنب الرئيسية لصاحب الشركة والموظفين: أول حاجة زرّين «فاتورة بيع» و«فاتورة شراء» (المشتريات يدوي أو بالتصوير)، و«استعلام سعر قطعة» بالباركود أو رقم الصنف أو الاسم، و«تجهيز الفواتير» لموظف المخزن: كل فاتورة جديدة توصله بمكان كل قطعة (الرف والخانة) ويعلّم عليها وهو ياخذها أو يمسح باركودها، ولصاحب الشركة نوافذ تسحبها: اليوم، الأرباح والخسائر، والرصيد الكلي. والأرقام تتخبى بالعين المغلقة لين تفتحها بـ Face ID، والمساعد يعمل فاتورة البيع بالكلام («بيع زوز فلتر… كاش» ثم «نفّذ»)، والدخول بـ Face ID أو البصمة (passkeys) بدل كلمة السر.
- الشاشة الرئيسية: الإعلانات، «وصل حديثاً»، و«المحلات»: بطاقات محلات التجار اللي تظهرهم الشركة، كل تاجر يختار لون بطاقته أو صورة محله، والرقم لو التاجر اختار يظهره. وكل ماركات السيارات في العالم بشارة 3D في تبويب «المتجر».
- إعلانات فوق في الشاشة الرئيسية (لحد 5 يتبدلو وحدهم): صورة وعنوان وزر يبحث أو يفتح ماركة أو واتساب أو رابط، ويوقف وحده في يوم تحدده.
- مساعد ذكي (Claude) يجاوب ويعمل الشغل: ينزّل فاتورة من صورتها طبق الأصل، يبيع، يعطي الأرقام، يعدّل الأسعار والكميات والدفعات والمصروفات، ويفتح الصفحات. للمدير دايماً، ويعطيه لكل موظف بالصلاحيات اللي يختارها، وللزبائن لو حب. ولا تغيير إلا بعد «نفّذ»، وكل شي في سجل الحركة.
- تحكم المالك: سجل كل حركة (مين عمل شنو ووقتاش، ما يتعدّلش ولا ينمسح)، تغيير الأسعار بالجملة مع الرجوع، حد تخفيض لكل موظف ومنع البيع تحت التكلفة، قفل الطلبات مؤقتاً وإخفاء الكميات والفروع عن الزبائن، وملخص اليوم.
- باركود بكاميرا الهاتف (أندرويد وآيفون) أو بجهاز باركود، واستلام بضاعة بتصوير فاتورة المورّد: تدخل للمخزن بروحها (الاسم والكمية ورقم الصنف) وتقدر تتراجع.
- ربط مع منظومة المبيعات الحالية: Excel/CSV، أو برنامج `tools/sync/sparat_sync.py`، أو API.

تبني نسخة باسم أي شركة وأيقوناتها بأمر واحد:

```
python3 tools/build_company.py --name CROSSKY --email owner@crossky.ly --brand branding/crossky/png --out crossky \
  --skin royal --color '#2F54E6' --logo branding/crossky/svg/wordmark-white.svg --logo-ink branding/crossky/svg/wordmark-ink.svg \
  --hero-car branding/crossky/svg/hero-car.svg --demo-extra branding/crossky/demo.json --demo-ads branding/crossky/ads.json \
  --site-url https://hkymalqnydy-creator.github.io/README.md/crossky/
```

الماركات المعروضة من البداية كورية ويابانية (`--brands KR,JP`)، وتقدر تحط ماركات معينة (`--brands toyota,kia`) أو `--brands all`. صاحب الشركة يغيّرها بعدين من التطبيق.

الدليل: [`docs/دليل-نسخة-الشركة.md`](docs/دليل-نسخة-الشركة.md).

## التشغيل (مرة واحدة)

1. أنشئ مشروعاً مجانياً على [supabase.com](https://supabase.com).
2. افتح **SQL Editor** والصق محتوى `supabase/setup.sql` واضغط **Run**. تقدر تعاود تشغيله بأمان.
3. من **Authentication → Sign In / Providers → Email** أطفئ **Confirm email**، لأن خدمة البريد المجانية محدودة. أو اربط خدمة بريد خاصة (SMTP).
4. من **Authentication → URL Configuration** ضع رابط موقعك في **Site URL**.
5. من **Project Settings → API** انسخ **Project URL** والمفتاح العام (anon / publishable) إلى `config.js`.
6. ارفع المجلد على أي استضافة ثابتة: GitHub Pages أو Netlify أو Cloudflare Pages.

بعدها افتح الموقع وسجّل حسابك أولاً، فيصبح حساب الإدارة.

## الملفات

| الملف | الوظيفة |
|---|---|
| `index.html` | الصفحة الوحيدة للتطبيق |
| `config.js` | رابط Supabase والمفتاح العام والدولة الافتراضية |
| `css/styles.css` | التصميم (فاتح وداكن) |
| `js/core.js` | البيانات وتسجيل الدخول والصور والتنقل |
| `js/views.js`, `js/views2.js` | الصفحات |
| `js/data.js` | الدول والماركات والموديلات والأقسام |
| `js/i18n.js` | النصوص بثماني لغات |
| `js/vin.js` | قراءة رقم الشاصي |
| `js/company.js`, `js/pos.js`, `js/scan.js`, `js/books.js`, `js/control.js`, `js/warehouse.js` | نسخة الشركة، منظومة المبيعات، الباركود واستلام البضاعة، الحسابات، تحكم المالك وسجل الحركة |
| `js/demo.js` | خادم تجريبي داخل المتصفح (للعرض والاختبارات) |
| `sw.js`, `manifest.webmanifest`, `icons/` | التثبيت والعمل بدون إنترنت |
| `supabase/setup.sql` | الجداول والصلاحيات ودوال البحث والمبيعات والاستلام |
| `supabase/functions/scan-invoice` | قراءة فواتير الموردين بالذكاء الاصطناعي (اختياري) |
| `supabase/functions/assistant`, `js/ai.js`, `js/ai-tools.js` | المساعد الذكي: الدالة على السيرفر، الشات، والأدوات (اختياري على السيرفر) |
| `tools/sync` | برنامج ربط منظومة المبيعات (Python) |
| `tools/build_company.py`, `branding/` | بناء نسخة شركة باسمها وأيقوناتها |
| `tools/build_artifact.py` | نسخة تجريبية تفتح كصفحة داخل تطبيق Claude |
| `tests/` | اختبارات قاعدة البيانات والمتصفح ودالة القراءة |
| `privacy.html` | سياسة الخصوصية (تطلبها المتاجر) |

## English

Static PWA (no build step) + Supabase (Postgres, Auth, Storage). Run `supabase/setup.sql` in the SQL editor, turn off "Confirm email" (or set up SMTP), set the Site URL, put the project URL and anon key in `config.js`, and host the folder on any static host. The first account to sign up becomes the admin.

Company edition (`mode: 'company'`): one company with branches, owner-controlled price visibility and branding, in-app customer orders that land in the sales system as invoices (being prepared → ready → received, or cancelled with the parts back in stock; supabase/setup.sql section 15, js/orders.js), an auto-reply assistant, a sales system (POS, invoices, returns, reports, staff permissions enforced in the database), barcode scanning (native BarcodeDetector or ZXing on iPhone), receiving stock from a photographed supplier invoice that goes into stock by itself and can be taken back (Claude vision via `supabase/functions/scan-invoice`, or on-device Tesseract), owner controls (an append-only activity log, bulk price changes with undo, per-employee discount limits, no selling below cost, closing orders and hiding quantities or branches from customers), a System tab next to Home for staff, Face ID / fingerprint sign-in with passkeys (Supabase Auth passkeys, supabase-js 2.108), owner-managed ads at the top of the home screen (up to 5 that take turns, each with a photo, a title and a tap that searches, opens a brand, WhatsApp or an https page, and an optional last day; checked by `public.ads_ok`), an AI assistant that answers and acts in the app (enters an invoice from its photo line by line, sells, reports, changes prices, stock, payments and expenses, opens pages; every change waits for a confirm tap and is logged; the owner always has it and grants it per employee with a chosen subset of that employee's permissions, and optionally to signed-in customers; Claude through `supabase/functions/assistant` gated by `public.ai_gate`, or the viewer's own Claude inside the Claude app), a warehouse employee who gets every new invoice with where each part is kept (shelf and bin, set on the part, on a purchase or in the Excel import), ticks the lines or scans them, and marks it prepared (section 18, js/warehouse.js), and sales-system sync (CSV/XLSX, `tools/sync`, or the `sync_products` RPC). Build a branded copy with `tools/build_company.py`.
