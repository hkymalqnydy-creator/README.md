# اختبارات قاعدة البيانات / Database tests

شغّلها على PostgreSQL محلي بالترتيب / Run on a local PostgreSQL, in this order:

1. `supabase_emulation.sql` — يحاكي Supabase (الأدوار وauth.uid) / emulates Supabase roles and auth.uid()
2. `../../supabase/setup.sql` — مرتين للتأكد أنه يتعاد بأمان / twice, to check it re-runs safely
3. `behaviour.sql` (T1…T33) — المحلات والقطع والصور والبحث / shops, parts, photos, search
4. `country_tests.sql` (C1…C10) — الدول والعملات / countries and currencies
5. `company_tests.sql` (M1…M25) — نسخة الشركة: إخفاء الأسعار، الزبائن، الإعدادات، الربط / company edition: price hiding, customers, settings, sync
6. `pos_tests.sql` (P1…P21) — منظومة المبيعات والصلاحيات / sales system and staff permissions
7. `receive_tests.sql` (R1…R14) — استلام البضاعة والباركود / receiving stock and barcodes
8. `books_tests.sql` (B1…B37) — المخزن، ديون الزبائن والموردين، المصروفات، الأرباح والخسائر / stock, customer and supplier debts, expenses, profit and loss
9. `controls_tests.sql` (K1…K59) — سجل الحركة، حد التخفيض، البيع تحت التكلفة، إخفاء الكميات، الأسعار بالجملة، إلغاء الاستلام / activity log, discount limits, selling below cost, hidden quantities, bulk prices, taking a receipt back
10. `ads_tests.sql` (A1…A16) — إعلانات الرئيسية: الحفظ والقراءة، السجل، الروابط والصور المرفوضة، الحد 5، الموظف بدون صلاحية / home screen ads: saving and reading, the log, refused links and pictures, the limit of 5, staff without the right
11. `ai_tests.sql` (I1…I28) — المساعد الذكي: للمدير دايماً، يعطيه لموظف بصلاحيات من صلاحياته، الزبائن، حد الرسائل اليومي، الخطوات، السجل، الاستعمال / the AI assistant: always the manager's, granted per employee within his own permissions, customers, the daily message limit, steps per message, the log, usage
12. `orders_tests.sql` (O1…O35) — طلبات الزبائن من التطبيق: الطلب والحجز من المخزن، الأسعار من قاعدة البيانات، قيد التجهيز ← قيد الاستلام ← تم الاستلام، الإلغاء ورجوع القطع، التقارير والديون، الصلاحيات، السجل / in-app customer orders: placing and reserving stock, prices from the database, preparing → ready → received, cancelling with the parts back, reports and debts, permissions, the log
13. `stock_tests.sql` (S1…S22) — المخزن: الأصناف اللي قربت تخلص (الأقل كمية الأول) واللي خلصت، والعدد / the Stock page: what is running low (fewest left first), what ran out, the counts؛ والشركة المصنّعة: الاستيراد، البحث، المخزن، تقعد في سطر الفاتورة / and the part's manufacturer: import, search, the Stock page, kept on the sold line S16–S22: الشركة المصنّعة في استلام البضاعة وسطور الاستلام، والبحث في سجل الاستلام بالمورّد واسم القطعة ورقم الصنف والشركة والسيارة / receiving keeps the manufacturer, and receipts are found by supplier, part, code, maker or car.
14. `merchants_tests.sql` (MC1…MC59) — التجار: اسم المحل، صادر ووارد (قبل الاعتماد وبعده، ومحد يشوف حساب تاجر برقمه)، إرسال الفاتورة ورجوعها، البحث عن تاجر، صفحة التجار، كلمة سر جديدة من المدير، السجل / merchants: the shop name, the statement before and after approval (nobody reads a merchant's account by signing up with his number), sending and taking back invoices, finding merchants, the merchants page, a new password from the owner, the log MC51: الفلوس اللي دخلت واللي طلعت في الأرباح والخسائر (نافذة الرصيد الكلي) / money in and out in pnl_report. MC52–MC59: محلات التجار في الشاشة الرئيسية (الشركة تظهرها، والرقم بس لو التاجر يظهره) / the merchants' shops on the home screen.

كل سطر نتيجة يبدأ برقم الاختبار، والأخطاء المتوقعة مكتوبة قبلها (expect …). / Each result line starts with its test number; expected errors are announced just before them.

`../functions/scan_invoice_test.mjs` يختبر دالة قراءة الفواتير بخدمات وهمية / tests the invoice-reader function against fake services:
`node --experimental-strip-types tests/functions/scan_invoice_test.mjs` (Node 22.6+).
`../functions/assistant_test.mjs` يختبر دالة المساعد (الدخول، البوابة، الأدوات المسموحة، الصور، الأخطاء) / tests the assistant function (login, the gate, allowed tools, photos, errors):
`node --experimental-strip-types tests/functions/assistant_test.mjs`.
