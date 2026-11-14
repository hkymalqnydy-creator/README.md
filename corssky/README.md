# Corssky

تطبيق قطع غيار لشركة Corssky وفروعها وزبائنها، مع منظومة مبيعات داخلية.
A spare-parts app for Corssky, its branches and customers, with a built-in sales system.

**الدليل الكامل:** [`docs/دليل-نسخة-الشركة.md`](docs/دليل-نسخة-الشركة.md)

## ما فيه / What's inside

- كتالوج بالصور والبحث والماركات الكورية واليابانية، ورقم الشاصي (VIN)، و8 لغات.
- إخفاء الأسعار (للكل، للمسجّلين، للمعتمدين، أو لقطع معينة)، مطبّق في قاعدة البيانات.
- سلة طلب على واتساب الشركة، ومساعد رد آلي بقواعد يكتبها المالك.
- منظومة مبيعات: نقطة بيع، فواتير وطباعة ومرتجعات، تقارير وأرباح، موظفين بصلاحيات.
- باركود بكاميرا الهاتف (أندرويد وآيفون) أو بجهاز باركود.
- استلام بضاعة بتصوير فاتورة المورّد: قراءة تلقائية، مراجعة، ثم إدخال للمخزون.
- ربط مع منظومة المبيعات الحالية: Excel/CSV، أو برنامج الربط `tools/sync`، أو API.

## جرّب الآن / Try it now

افتح `index.html` من استضافة (أو أي سيرفر محلي). الوضع التجريبي شغّال:
- صاحب الشركة: `owner@corssky.ly` / `123456`
- بائع: `seller@` + نفس النطاق / `123456`

## التشغيل الحقيقي / Going live

1. `supabase/setup.sql` في SQL Editor على مشروع Supabase.
2. الرابط والمفتاح العام في `config.js`.
3. أول حساب يتسجّل = صاحب الشركة.
4. (اختياري) قراءة الفواتير بالذكاء الاصطناعي: `supabase functions deploy scan-invoice` و`supabase secrets set ANTHROPIC_API_KEY=...`.

| المجلد / Folder | |
|---|---|
| `index.html`, `js`, `css`, `icons` | التطبيق / the app (PWA) |
| `supabase/setup.sql` | قاعدة البيانات والصلاحيات / database and rules |
| `supabase/functions/scan-invoice` | قراءة الفواتير بالذكاء الاصطناعي / AI invoice reader |
| `tools/sync` | برنامج الربط مع منظومة المبيعات / sales-system sync bridge |
| `packaging` | أندرويد وآيفون (ly.corssky.app) وويندوز / Android, iPhone, Windows |
| `docs` | الدليل / the guide |
