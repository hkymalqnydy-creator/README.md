# اختبارات المتصفح / Browser tests

Playwright with Chrome, against the app files (no server: the in-browser demo backend stands in for Supabase).

```
npm i -D playwright            # or set PLAYWRIGHT to an installed copy
CHROME=/path/to/chrome node tests/browser/run.js           # marketplace edition (31 checks)
CHROME=/path/to/chrome node tests/browser/run_company.js   # company edition: prices, assistant, sales system, barcode, invoice photos, accounts (46 checks)
CHROME=/path/to/chrome node tests/browser/run_controls.js  # owner controls: invoice photo into stock by itself and back, closing and hiding, limits, bulk prices, log, brand marks, system tab, Face ID with a virtual authenticator (23 checks)
CHROME=/path/to/chrome node tests/browser/run_ads.js       # ads at the top of the home screen: the Patrol ad and its parts, the owner's ads page, turns, links, staff, old demos, reduced motion, English (16 checks)
CHROME=/path/to/chrome node tests/browser/run_stock.js     # the Stock page: running low and run out first, the fewest left first, tap to add stock, all good, the part's company and car at the till and on the invoice, English (6 checks), receiving finds parts by their company and a new part gets one, the receipts found by supplier, part name, item code or company
CHROME=/path/to/chrome node tests/browser/run_orders.js    # orders in the app: the basket (no WhatsApp), sign-in, pickup or delivery, preparing → ready → received, the counts on the tabs, cancelling, stock limits, orders closed, the assistant, English (14 checks)
CHROME=/path/to/chrome node tests/browser/run_merchants.js # merchants: sign-up with the shop and phone, sign-in by phone or email, the forgotten password (a code for 90 seconds, wrong and late codes), «صادر ووارد», sending an invoice from the till and from an order, «التجار», approval, a new password (8 checks), the merchants' shops on the home screen and their pages (phone only when shown), the owner's switches
CHROME=/path/to/chrome node tests/browser/run_system.js    # the System tab: the windows (today, profit and loss, total balance) with the right numbers, the part lookup (barcode, name, «Sell it»), and the closed eye (numbers hidden until Face ID, a virtual authenticator)
CHROME=/path/to/chrome node tests/browser/run_voice.js     # talking to the assistant (stand-ins for speech and voice): «بيع زوز فلتر زيت باترول كاش» goes by itself, is read out, «نفّذ» said back makes the invoice
CHROME=/path/to/chrome node tests/browser/run_ai.js        # the AI assistant: the manager, an invoice from its photo line by line, giving it to a seller for selling only, customers, the server and Claude-app engines with stand-ins, English, a wide screen (23 checks)
SITE=crossky node tests/browser/run_company.js             # the same checks on a built company folder
SITE=crossky node tests/browser/run_embedded.js            # in-app page edition (tools/build_artifact.py) under the page's security policy
python3 -m http.server 8765 --directory crossky &          # then: the built folder with its own config and offline cache
PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 node tests/browser/smoke_build.js
```

Screenshots go to `tests/browser/shots/`. The camera is Chrome's fake camera; the ZXing and Tesseract libraries are replaced by small stand-ins with the same calls.
