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
| `sw.js`, `manifest.webmanifest`, `icons/` | التثبيت والعمل بدون إنترنت |
| `supabase/setup.sql` | الجداول والصلاحيات ودوال البحث |
| `privacy.html` | سياسة الخصوصية (تطلبها المتاجر) |

## English

Static PWA (no build step) + Supabase (Postgres, Auth, Storage). Run `supabase/setup.sql` in the SQL editor, turn off "Confirm email" (or set up SMTP), set the Site URL, put the project URL and anon key in `config.js`, and host the folder on any static host. The first account to sign up becomes the admin.
