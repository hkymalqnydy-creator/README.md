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

كل سطر نتيجة يبدأ برقم الاختبار، والأخطاء المتوقعة مكتوبة قبلها (expect …). / Each result line starts with its test number; expected errors are announced just before them.

`../functions/scan_invoice_test.mjs` يختبر دالة قراءة الفواتير بخدمات وهمية / tests the invoice-reader function against fake services:
`node --experimental-strip-types tests/functions/scan_invoice_test.mjs` (Node 22.6+).
