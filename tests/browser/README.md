# اختبارات المتصفح / Browser tests

Playwright with Chrome, against the app files (no server: the in-browser demo backend stands in for Supabase).

```
npm i -D playwright            # or set PLAYWRIGHT to an installed copy
CHROME=/path/to/chrome node tests/browser/run.js           # marketplace edition (31 checks)
CHROME=/path/to/chrome node tests/browser/run_company.js   # company edition: prices, assistant, sales system, barcode, invoice photos (38 checks)
SITE=corssky node tests/browser/run_company.js             # the same checks on a built company folder
```

Screenshots go to `tests/browser/shots/`. The camera is Chrome's fake camera; the ZXing and Tesseract libraries are replaced by small stand-ins with the same calls.
