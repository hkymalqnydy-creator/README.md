# اختبارات المتصفح / Browser tests

Playwright with Chrome, against the app files (no server: the in-browser demo backend stands in for Supabase).

```
npm i -D playwright            # or set PLAYWRIGHT to an installed copy
CHROME=/path/to/chrome node tests/browser/run.js           # marketplace edition (31 checks)
CHROME=/path/to/chrome node tests/browser/run_company.js   # company edition: prices, assistant, sales system, barcode, invoice photos, accounts (46 checks)
CHROME=/path/to/chrome node tests/browser/run_controls.js  # owner controls: invoice photo into stock by itself and back, closing and hiding, limits, bulk prices, log, brand marks, system tab, Face ID with a virtual authenticator (23 checks)
SITE=crossky node tests/browser/run_company.js             # the same checks on a built company folder
SITE=crossky node tests/browser/run_embedded.js            # in-app page edition (tools/build_artifact.py) under the page's security policy
python3 -m http.server 8765 --directory crossky &          # then: the built folder with its own config and offline cache
PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 node tests/browser/smoke_build.js
```

Screenshots go to `tests/browser/shots/`. The camera is Chrome's fake camera; the ZXing and Tesseract libraries are replaced by small stand-ins with the same calls.
