/* Company edition and shared extras: owner settings (name, logo, colour, texts, price visibility, brands shown),
   customer accounts with approval, order basket sent on WhatsApp, about page, auto-reply assistant,
   Excel/CSV import-export and the sales-system link. */
(function () {
  'use strict';
  const SP = window.SP;
  const { $, $$, esc, I, t, S, api, D, BRAND, opt, shell, bar, empty, avatar, vb, gate } = SP;
  const CFG = SP.CFG, arr = SP.arr;
  /* a single company has no shops to verify: its admin card and hints speak about the company */
  if (CFG.mode === 'company') Object.assign(SP.L.T, {
    /* the store with no parts yet */
    coEmptyT: ["ما فيش قطع بعد", "No parts yet"], coEmptyB: ["القطع جاية قريب. لو تحتاج قطعة اسألنا عليها.", "Parts are coming soon. Need a part? Ask us."],
    coEmptyWa: ["اسألنا على واتساب", "Ask us on WhatsApp"], coEmptyWaMsg: ["السلام عليكم، نبي قطعة: ", "Hello, I need a part: "],
    coEmptyStaff: ["دخّل بضاعتك بفاتورة شراء (يدوي، بالباركود، أو بتصوير فاتورة المورّد) أو من ملف إكسل، وتظهر هنا.", "Bring your stock in with a purchase invoice (by hand, barcode or a photo of the supplier's invoice) or an Excel file, and it shows here."],
    coEmptyGo: ["فاتورة شراء", "Purchase invoice"],
    adminB: ["الإعدادات، إخفاء الأسعار، الزبائن، الرد الآلي، والربط مع منظومتك.", "Settings, price visibility, customers, auto-reply and the link to your system."],
    noticePh: ["مثلاً: تخفيضات على الفحمات هذا الأسبوع", "e.g. Brake pads on sale this week"]
  });

  Object.assign(window.SP_IC, {
    bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    bot: '<rect x="4" y="7" width="16" height="12" rx="3.5"/><path d="M12 3.5V7M9 12.5h.01M15 12.5h.01M9.5 16h5"/>',
    send: '<path d="M20 12 4 4l3 8-3 8z"/><path d="M7 12h6"/>'
  });

  /* Interface text: ar, en (other languages fall back to English). */
  const T = {
    loginPrice: ["سجّل الدخول لرؤية السعر", "Sign in to see the price"],
    approvedPrice: ["السعر للزبائن المعتمدين", "Price for approved customers"],
    dupSku: ["رقم الصنف مستخدم في قطعة ثانية", "This item code is already used by another part"],
    waMsgNoPrice: ["السلام عليكم، رأيت عندكم «{title}»{pn} على تطبيق سبيرات.{car}\nكم سعرها؟ وهل هي متوفرة؟", "Hello, I saw “{title}”{pn} on Sparat.{car}\nWhat is the price, and is it available?", "Bonjour, j’ai vu « {title} »{pn} sur Sparat.{car}\nQuel est le prix, et est-ce disponible ?", "Hola, vi «{title}»{pn} en Sparat.{car}\n¿Qué precio tiene y está disponible?", "Hallo, ich habe „{title}“{pn} auf Sparat gesehen.{car}\nWas kostet es und ist es verfügbar?", "Merhaba, Sparat’ta “{title}”{pn} parçasını gördüm.{car}\nFiyatı nedir, mevcut mu?", "Здравствуйте! Увидел «{title}»{pn} в Sparat.{car}\nСколько стоит и есть ли в наличии?", "你好，我在 Sparat 上看到“{title}”{pn}。{car}\n请问价格多少，有货吗？"],
    tabBranches: ["الفروع", "Branches"], tabAccount: ["حسابي", "Account"], branches: ["فروعنا", "Our branches"],
    addCart: ["أضف للطلب", "Add to order"], addedCart: ["أُضيفت لطلبك", "Added to your order"], cart: ["طلبي", "My order"],
    cartEmptyT: ["طلبك فارغ", "Your order is empty"], cartEmptyB: ["أضف القطع اللي تحتاجها، وابعت الطلب للشركة على واتساب بضغطة.", "Add the parts you need, then send the order to the company on WhatsApp in one tap."],
    cartNote: ["ملاحظة للشركة", "Note for the company"], cartNotePh: ["مثلاً: نحتاجها اليوم، التوصيل إلى…", "e.g. needed today, deliver to…"],
    sendOrder: ["ابعت الطلب على واتساب", "Send order on WhatsApp"], clearCart: ["أفرغ الطلب", "Clear order"], cartCleared: ["تم إفراغ الطلب", "Order cleared"],
    orderMsg: ["السلام عليكم، نبي نطلب هذه القطع من سبيرات:", "Hello, I would like to order these parts from Sparat:"],
    orderTotal: ["المجموع التقريبي: {t}", "Approx. total: {t}"], orderFrom: ["الاسم: {n}", "Name: {n}"], orderPhone: ["الهاتف: {p}", "Phone: {p}"], orderNote: ["ملاحظة: {x}", "Note: {x}"],
    noCompanyWa: ["رقم واتساب الشركة غير مضبوط بعد.", "The company WhatsApp number isn’t set yet."],
    custName: ["الاسم الكامل", "Full name"], needCustName: ["اكتب اسمك.", "Enter your name."],
    /* merchants: sign up with the shop and the phone number, sign in with the number or the email (js/merchants.js has the rest) */
    mShop: ["اسم المحل", "Shop name"], mShopPh: ["مثلاً: محل الأمل لقطع الغيار", "e.g. Al Amal Spare Parts"], needShop: ["اكتب اسم المحل.", "Enter the shop name."],
    yourName: ["اسمك", "Your name"], loginBy: ["تدخل بـ", "Sign in with"], byPhone: ["رقم الهاتف", "Phone number"], byEmail: ["الإيميل", "Email"],
    phoneLoginHint: ["تدخل برقم هاتفك وكلمة السر.", "You sign in with your phone number and password."],
    emailLoginHint: ["تدخل بالإيميل وكلمة السر، ورقم هاتفك يقعد للتواصل.", "You sign in with your email and password; your phone number stays for contact."],
    errLoginPhone: ["رقم الهاتف أو كلمة السر غلط. لو سجلت بالإيميل، ادخل بيه.", "Wrong phone number or password. If you signed up with your email, use it."],
    errExistsPhone: ["الرقم هذا عنده حساب قبل. ادخل بيه، ولو نسيت كلمة السر كلّم الشركة.", "This number already has an account. Sign in with it; if you forgot the password, contact the company."],
    forgotPhoneT: ["نسيت كلمة السر؟", "Forgot your password?"],
    forgotPhoneB: ["الحساب اللي يدخل برقم الهاتف، كلمة السر الجديدة تعطيهاله الشركة. كلّمهم وقولهم رقمك.", "For an account that signs in with a phone number, the company gives the new password. Contact them with your number."],
    forgotPhoneWa: ["السلام عليكم، نسيت كلمة السر متاع حسابي في التطبيق. رقمي: {p}", "Hello, I forgot the password of my app account. My number: {p}"],
    completeT: ["كمّل حسابك", "Complete your account"], completeB: ["اكتب اسم المحل ورقم هاتفك، باش يطلعلك «صادر ووارد» وتوصلك الفواتير.", "Add your shop name and phone number to get your account statement and your invoices."],
    phoneAgainH: ["لو بدلت رقمك، الشركة تعتمد حسابك من جديد.", "If you change your number, the company approves your account again."], cuPhonePub: ["اظهر رقمي في صفحة محلي", "Show my number on my shop’s page"],
    cuPhonePubH: ["لما الشركة تظهر محلك في «المحلات»، الزبائن يقدروا يتصلوا بيك أو يكلموك واتساب من صفحته.", "When the company shows your shop in «Shops», customers can call you or WhatsApp you from its page."],
    demoM: ["ودخول التاجر: 0925551234 وكلمة السر 123456.", "Merchant sign-in: 0925551234, password 123456."],
    /* a forgotten password: a code by email or SMS, valid 90 seconds */
    rsT: ["كلمة سر جديدة", "New password"], rsB: ["اكتب رقمك أو إيميلك، ونبعتولك كود.", "Enter your number or email and we’ll send you a code."],
    rsSend: ["ابعتلي الكود", "Send me the code"], rsTo: ["بعثنالك كود على {d}.", "We sent a code to {d}."],
    rsDemo: ["نسخة تجريبية: ما يطلعش منها SMS ولا إيميل. الكود اللي كان بيوصلك: {c}", "Demo: no SMS or email is sent from it. The code you would get: {c}"],
    rsCode: ["الكود", "Code"], rsLeft: ["الكود صالح {t}", "The code works for {t}"], rsGone: ["خلص وقت الكود. اطلب كود جديد.", "The code has expired. Ask for a new one."],
    rsNew: ["كلمة السر الجديدة", "New password"], rsSave: ["غيّر كلمة السر وادخل", "Change password and sign in"], rsAgain: ["ابعتلي كود جديد", "Send a new code"],
    rsWrong: ["الكود غلط. تأكد منه.", "Wrong code. Check it."], rsNoAcct: ["ما فيش حساب بالرقم أو الإيميل هذا.", "No account with this number or email."],
    rsWait: ["استنى {n} ثانية وبعدين اطلب كود جديد.", "Wait {n} seconds before asking for a new code."],
    rsNoSms: ["إرسال الرسائل مش مفعّل عند الشركة. كلّمهم يعطوك كلمة سر جديدة.", "Text messages aren’t set up by the company. Contact them for a new password."],
    rsDone: ["تبدلت كلمة السر ودخلت", "Password changed; you’re signed in"], rsNeedCode: ["اكتب الكود (6 أرقام).", "Enter the 6-digit code."],
    myAccount: ["حسابي", "My account"], signInToOrder: ["سجّل دخولك باش تشوف الأسعار وتطلب بسهولة.", "Sign in to see prices and order easily."],
    approvedYes: ["حسابك معتمد: تشوف أسعار الزبائن المعتمدين.", "Your account is approved: you see approved-customer prices."],
    approvedNo: ["حسابك بانتظار موافقة الشركة. بعد الموافقة تظهرلك الأسعار.", "Your account is waiting for company approval. Prices appear once approved."],
    saveProfile: ["احفظ بياناتي", "Save my details"], profileSaved: ["تم حفظ بياناتك", "Details saved"],
    about: ["عن الشركة", "About us"], contactT: ["تواصل معنا", "Contact us"],
    demoB: ["نسخة تجريبية: البيانات محفوظة على هذا الجهاز فقط. دخول المالك: {e} وكلمة السر 123456", "Demo: data is stored on this device only. Owner sign-in: {e}, password 123456"],
    hidePriceL: ["إخفاء سعر هذه القطعة", "Hide this part’s price"], skuL: ["رقم الصنف في المنظومة", "Item code (sales system)"],
    skuHint: ["نفس الكود اللي في منظومة المبيعات، باش يتحدث السعر والكمية تلقائياً.", "The same code as in your sales system, so price and stock update automatically."],
    adminMain: ["عام", "Overview"], companySet: ["الإعدادات", "Settings"], customersT: ["الزبائن", "Customers"], syncT: ["منظومة المبيعات", "Sales system"],
    brandingT: ["الاسم والشكل", "Name and look"], textsT: ["النصوص", "Texts"],
    brandNameL: ["اسم التطبيق / الشركة", "App / company name"], taglineL: ["الوصف المختصر", "Tagline"], logoL: ["الشعار", "Logo"], accentL: ["اللون الأساسي", "Main colour"],
    heroTitleL: ["عنوان الصفحة الرئيسية", "Home page title"], heroSubL: ["النص تحت العنوان", "Text under the title"], aboutL: ["نص صفحة «عن الشركة»", "“About us” page text"],
    contactWaL: ["واتساب الشركة (يوصله الطلب)", "Company WhatsApp (receives orders)"], contactPhoneL: ["هاتف الشركة", "Company phone"], addressL: ["العنوان", "Address"],
    priceModeL: ["عرض الأسعار", "Price visibility"], pm_all: ["تظهر للكل", "Shown to everyone"], pm_members: ["للزبائن المسجّلين فقط", "Signed-in customers only"],
    pm_approved: ["للزبائن المعتمدين فقط (تجار وورش)", "Approved customers only (traders, workshops)"], pm_hidden: ["مخفية على الكل (اتصل للسعر)", "Hidden from everyone (call for price)"],
    pmHint: ["الإخفاء يتم من السيرفر نفسه، فما حد يقدر يشوف السعر المخفي.", "Prices are hidden by the server itself, so nobody can read a hidden price."],
    ordersL: ["تفعيل سلة الطلبات", "Turn on the order basket"], signupL: ["السماح لأي شخص بتسجيل محل", "Let anyone register a shop"],
    signupHint: ["أطفئها في نسخة الشركة: الفروع تضيفها الإدارة فقط.", "Turn off for a single company: only admins add branches."],
    brandsL: ["الماركات الظاهرة في التطبيق", "Car brands shown in the app"], brandsKJ: ["كوري وياباني", "Korean and Japanese"], brandsAll: ["كل الماركات", "All brands"],
    blogosT: ["شعارات الماركات", "Brand logos"],
    blogosH: ["كل ماركة ليها شارة بحروفها. اضغط على الماركة وارفع صورة شعارها من عندك، ويطلع بدل الشارة في كل التطبيق. وبعدها احفظ الإعدادات.",
      "Each brand has a badge with its initials. Tap a brand and upload a picture of its logo from your own files to show it instead everywhere in the app. Then save the settings."],
    blogoAdd: ["ارفع الشعار", "Upload logo"], blogoChange: ["غيّره", "Change"], blogoDel: ["ارجع لشارة {b}", "Back to the {b} badge"],
    custPending: ["بانتظار الموافقة", "Pending"], custApproved: ["معتمد", "Approved"], approveBtn: ["اعتمد", "Approve"], unapproveBtn: ["ألغِ الاعتماد", "Remove approval"],
    noCustomers: ["لا يوجد زبائن مسجّلين بعد", "No customers yet"], custSaved: ["تم تحديث الزبون", "Customer updated"],
    importT: ["تحديث القطع من ملف Excel", "Update parts from an Excel file"],
    importB: ["صدّر قائمة الأصناف من منظومة المبيعات (Excel أو CSV) وارفعها هنا. الأصناف الجديدة تنضاف، والموجودة يتحدث سعرها وكميتها حسب «رقم الصنف».", "Export the item list from your sales system (Excel or CSV) and upload it here. New items are added; existing ones get their price and stock updated by item code."],
    importBranch: ["تنضاف للفرع", "Add to branch"], chooseFile: ["اختر الملف", "Choose file"], importing: ["جارٍ التحديث… {n}", "Updating… {n}"],
    importDone: ["تم: {i} جديدة، {u} محدّثة، {s} متجاهلة، {e} أخطاء", "Done: {i} new, {u} updated, {s} skipped, {e} errors"],
    importCols: ["الأعمدة: {c}", "Columns: {c}"], importNoSku: ["ما لقيناش عمود «رقم الصنف» أو «الكود». تأكد من عناوين الأعمدة في أول سطر.", "No item-code column found. Check the column headers in the first row."],
    exportT: ["تصدير القطع", "Export parts"], exportB: ["ملف CSV يفتح في Excel، فيه كل القطع بأسعارها وكمياتها.", "A CSV file that opens in Excel with all parts, prices and stock."], exportBtn: ["نزّل ملف القطع", "Download parts file"], exported: ["تم تجهيز الملف ({n} قطعة)", "File ready ({n} parts)"],
    autoT: ["الربط التلقائي", "Automatic link"], autoB: ["لربط المنظومة مباشرة: أنشئ مفتاح ربط، وشغّل برنامج الربط على كمبيوتر الشركة، أو أعطِ المفتاح لمبرمج المنظومة.", "To link your sales system directly: create a link key, then run the sync program on the company computer or give the key to your system’s developer."],
    newKey: ["أنشئ مفتاح ربط", "Create link key"], keyOnce: ["انسخ المفتاح توا، لن يظهر مرة ثانية. مفتاح جديد يلغي القديم.", "Copy the key now; it won’t be shown again. A new key cancels the old one."],
    keyConfirm: ["مفتاح جديد يوقف الربط الحالي لين تحدّثه بالمفتاح الجديد. نكمل؟", "A new key stops the current link until it’s updated. Continue?"], yes: ["نعم", "Yes"],
    downloadScript: ["برنامج الربط (Python)", "Sync program (Python)"], devDetails: ["التفاصيل للمبرمج", "Details for the developer"],
    botT: ["المساعد الآلي", "Auto assistant"], botFab: ["اسأل المساعد", "Ask the assistant"], botPh: ["اكتب سؤالك أو اسم القطعة…", "Type a question or a part name…"], botSend: ["إرسال", "Send"],
    botWelcomeDef: ["أهلاً بك في سبيرات! اكتب اسم القطعة أو رقمها ونلقاهالك، أو اسألني عن الفروع وأوقات العمل والأسعار.", "Welcome to Sparat! Type a part name or number and I’ll find it, or ask me about branches, opening hours and prices."],
    botFound: ["لقيت {n} نتيجة:", "I found {n} results:"], botSeeAll: ["عرض كل النتائج", "See all results"],
    botNone: ["ما لقيتش قطعة تطابق «{q}». تبي تسأل الشركة مباشرة؟", "I couldn’t find a part matching “{q}”. Want to ask the company directly?"], botAskWa: ["اسأل على واتساب", "Ask on WhatsApp"],
    botWhere: ["فروعنا:", "Our branches:"], botHours: ["أوقات العمل:", "Opening hours:"], botContact: ["تقدر تتواصل معنا هنا:", "You can reach us here:"],
    botVin: ["اكتب رقم الشاصي في صفحة «رقم الشاصي» ونعرف سيارتك والقطع اللي تركب عليها.", "Enter your VIN on the VIN page and we’ll identify your car and the parts that fit."], botOpenVin: ["افتح صفحة رقم الشاصي", "Open the VIN page"],
    botQ1: ["وين مكانكم؟", "Where are you?"], botQ2: ["أوقات العمل", "Opening hours"], botQ3: ["كيف نشوف الأسعار؟", "How do I see prices?"], botQ4: ["رقم الواتساب", "WhatsApp number"],
    botNoBranch: ["لا توجد فروع مسجّلة بعد.", "No branches registered yet."], botPricesShown: ["الأسعار ظاهرة على كل قطعة.", "Prices are shown on every part."],
    botHowLogin: ["سجّل الدخول من «حسابي» وتظهرلك الأسعار.", "Sign in from “Account” to see prices."], botHowApproved: ["سجّل حساب من «حسابي»، وبعد ما تعتمدك الشركة تظهرلك الأسعار.", "Create an account under “Account”; prices appear once the company approves you."],
    botHowCall: ["الأسعار تعطيها الشركة عند التواصل.", "The company gives prices on request."], botClear: ["محادثة جديدة", "New chat"],
    adminBot: ["الرد الآلي", "Auto-reply"], botOnL: ["تفعيل المساعد الآلي", "Turn on the assistant"], botWelcomeL: ["رسالة الترحيب", "Welcome message"],
    botRulesL: ["ردود جاهزة", "Ready replies"], botRulesHint: ["لو كتب الزبون أي كلمة من الكلمات، يرد المساعد بالنص. افصل الكلمات بفاصلة.", "If the customer writes any of the words, the assistant replies with the text. Separate words with commas."],
    botKeys: ["الكلمات", "Words"], botAns: ["الرد", "Reply"], botAddRule: ["أضف رداً", "Add a reply"], botDelRule: ["احذف هذا الرد", "Delete this reply"],
    botWaT: ["ردود واتساب بزنس", "WhatsApp Business replies"], botWaB: ["في تطبيق واتساب بزنس: الإعدادات ← أدوات الأعمال ← رسالة الترحيب / رسالة عدم التواجد. انسخ هذه النصوص:", "In WhatsApp Business: Settings → Business tools → Greeting message / Away message. Copy these texts:"],
    waGreet: ["أهلاً بك في {app}! ابعت اسم القطعة أو رقمها مع نوع السيارة وسنة الصنع، أو رقم الشاصي، ونردّوا عليك بالسعر والتوفر في أقرب وقت.", "Welcome to {app}! Send the part name or number with your car model and year, or your VIN, and we’ll reply with price and availability shortly."],
    waAway: ["شكراً لتواصلك مع {app}. إحنا خارج أوقات العمل توا، ونردّوا عليك أول ما نفتحوا. تقدر تدوّر على القطع في التطبيق: {url}", "Thanks for contacting {app}. We’re closed right now and will reply as soon as we open. You can search parts in the app: {url}"],
    copy: ["نسخ", "Copy"]
  };
  /* Owner-facing words for a single company: shops become branches. */
  const COMPANY_WORDS = {
    shopNew: ["إضافة فرع", "Add a branch"], shopEdit: ["تعديل الفرع", "Edit branch"], registerT: ["أضف أول فرع للشركة", "Add the company’s first branch"],
    registerShop: ["أضف فرعاً", "Add a branch"], anotherShop: ["أضف فرعاً آخر", "Add another branch"], yourShops: ["فروع الشركة", "Company branches"],
    yourShop: ["فرع الشركة", "Company branch"], shopName: ["اسم الفرع", "Branch name"], youShop: ["أنت تدير هذا الفرع", "You manage this branch"],
    saveShop: ["احفظ الفرع", "Save branch"], shopCreated: ["تمت إضافة الفرع! أضف أول قطعة.", "Branch added! Add the first part."], noShopsT: ["لا توجد فروع بعد", "No branches yet"],
    noShopsB: ["الفروع تضيفها إدارة الشركة.", "Branches are added by the company."], shop: ["الفرع", "Branch"], shops: ["الفروع", "Branches"], allShops: ["كل الفروع", "All branches"],
    deleteShop: ["احذف الفرع وكل بضاعته", "Delete the branch and all its stock"], statShops: ["الفروع", "Branches"]
  };
  Object.assign(SP.L.T, T);
  if (SP.company) Object.assign(SP.L.T, COMPANY_WORDS);

  const appName = () => (S.settings && S.settings.brand_name) || CFG.appName || t('app');
  const sf = o => `href="#search" data-sf="${esc(JSON.stringify(o))}"`;
  const contactNum = () => (S.settings && S.settings.contact_wa) || ((S.branches || []).find(b => b.whatsapp) || {}).whatsapp || '';
  SP.contactNumber = contactNum;
  async function branches() {
    if (S.branches) return S.branches;
    try { S.branches = (await api.shops({ p_country: S.country, p_limit: 50 })).items; } catch (e) { S.branches = []; }
    return S.branches;
  }
  function adminGuard(n) {
    if (!S.user) { S.after = SP.here(); shell(bar(t('admin')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('adminSignIn'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`); return false; }
    if (!S.admin) { shell(bar(t('admin')) + `<main class="wrap">${empty('lock', t('adminOnly'), t('notAdmin'))}</main>`); return false; }
    return true;
  }
  SP.adminTabs = cur => `<nav class="chips light admintabs" aria-label="${esc(t('admin'))}">${[['admin', 'adminMain'], ['admin-control', 'ctlT'], ['admin-log', 'logT'], ['admin-prices', 'bpT'],
    ['admin-ads', 'adsT'], ['admin-ai', 'aiSetT'], ['admin-company', 'companySet'], ['admin-customers', 'customersT'], ['admin-bot', 'adminBot'], ['admin-sync', 'syncT']]
    .map(([h, k]) => `<a class="chip${cur === h ? ' on' : ''}" href="#${h}"${cur === h ? ' aria-current="page"' : ''}>${esc(t(k))}</a>`).join('')}</nav>`;

  /* ---------- header extras: basket button, assistant button, contact block ---------- */
  SP.cartBtn = () => {
    if (!(S.settings && S.settings.orders_enabled)) return '';
    const c = SP.cart.count();
    return `<a class="iconbtn cartbtn" href="#cart" aria-label="${esc(t('cart'))}">${I('bag')}<span class="badge"${c ? '' : ' hidden'}>${c}</span></a>`;
  };
  document.addEventListener('sp:cart', () => { const c = SP.cart.count(); $$('.cartbtn .badge').forEach(b => { b.textContent = c; b.hidden = !c; }); });
  SP.afterShell = () => {
    /* the owner panel's tabs scroll sideways: bring the open one into view (without moving the page) */
    const nav = $('.admintabs'), on = nav && $('.chip.on', nav);
    if (on) { const a = nav.getBoundingClientRect(), b = on.getBoundingClientRect(); if (b.left < a.left || b.right > a.right) nav.scrollLeft += b.left - a.left - (a.width - b.width) / 2; }
    let fab = $('#botfab');
    /* the ready-replies assistant, for whoever does not have the AI assistant (js/ai.js has its own button) */
    const show = !S.err && !(SP.aiOn && SP.aiOn()) && !(S.settings && S.settings.bot_enabled === false) && ['home', 'cats', 'shops', 'favs'].includes(SP.tab);
    if (!show) { if (fab) fab.remove(); return; }
    if (!fab) { fab = document.createElement('a'); fab.id = 'botfab'; fab.className = 'botfab'; fab.href = '#bot'; document.body.appendChild(fab); }
    fab.setAttribute('aria-label', t('botFab'));
    fab.innerHTML = `${I('bot')}<span>${esc(t('botFab'))}</span>`;
  };
  SP.contactCta = () => {
    const st = S.settings || {}, num = contactNum();
    const wa = SP.waLink(num, t('waShop', { name: appName() }), S.country), tel = SP.telHref(st.contact_phone || num, S.country);
    return `<section class="cta"><h2>${esc(t('contactT'))}</h2>${st.address || st.tagline ? `<p>${esc(st.address || st.tagline)}</p>` : ''}
      <div class="cta-actions">${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('whatsapp'))}</a>` : ''}${tel ? `<a class="btn btn-ghost light" href="${esc(tel)}">${I('phone')} ${esc(t('call'))}</a>` : ''}<a class="btn btn-ghost light" href="#about">${I('info')} ${esc(t('about'))}</a></div></section>`;
  };

  /* ---------- merchants sign up and sign in (company edition): the shop's name and the phone number are required; the account
     signs in with the phone number or with an email (Gmail…), chosen at sign-up (js/core.js SP.phoneLogin) ---------- */
  const okMail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  function forgotByPhone(phone) {
    const st = S.settings || {}, num = st.contact_wa || st.contact_phone || '';
    const wa = SP.waLink(num, t('forgotPhoneWa', { p: SP.prettyPhone(phone, CFG.defaultCountry || 'LY') || '' }), S.country), tel = SP.telHref(st.contact_phone || num, S.country);
    SP.openSheet(`<h2 class="sheet-title">${esc(t('forgotPhoneT'))}</h2><p class="sheet-sub">${esc(t('forgotPhoneB'))}</p>
      <div class="sheet-actions">${wa ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('whatsapp'))}</a>` : ''}
        ${tel ? `<a class="btn btn-ghost" href="${esc(tel)}">${I('phone')} ${esc(t('call'))}</a>` : ''}<button type="button" class="btn btn-ghost" data-close>${esc(t('close'))}</button></div>`, { label: t('forgotPhoneT') });
  }
  SP.authCompany = (up, n) => {
    let by = SP.load('sp_login_by', 'phone') === 'email' ? 'email' : 'phone';
    const req = ' <span class="req">*</span>';
    shell(bar(t(up ? 'signupT' : 'loginT')) + `<main class="wrap form-wrap">
      <div class="chips light authtabs"><a class="chip${up ? '' : ' on'}" href="#login"${up ? '' : ' aria-current="page"'}>${esc(t('tabIn'))}</a><a class="chip${up ? ' on' : ''}" href="#signup"${up ? ' aria-current="page"' : ''}>${esc(t('tabUp'))}</a></div>
      ${up ? '' : '<div id="abio" class="bio-login" hidden></div>'}
      <form class="form" id="af" novalidate style="margin-top:18px">
        ${up ? `<div class="field"><label for="ash">${esc(t('mShop'))}${req}</label><input id="ash" class="input" maxlength="80" autocomplete="organization" placeholder="${esc(t('mShopPh'))}"></div>
        <div class="row2"><div class="field"><label for="anm">${esc(t('yourName'))}${req}</label><input id="anm" class="input" maxlength="80" autocomplete="name"></div>
          <div class="field"><label for="act">${esc(t('city'))}</label><input id="act" class="input" maxlength="40" autocomplete="address-level2"></div></div>
        <div class="field"><label for="aph">${esc(t('phoneNum'))}${req}</label><input id="aph" class="input" type="tel" inputmode="tel" dir="ltr" maxlength="30" autocomplete="tel" placeholder="09XXXXXXXX"></div>` : ''}
        <fieldset class="field loginby"><legend class="flabel">${esc(t('loginBy'))}</legend><div class="chips light" role="radiogroup">
          <button type="button" class="chip" role="radio" data-by="phone">${I('phone')} ${esc(t('byPhone'))}</button>
          <button type="button" class="chip" role="radio" data-by="email">${I('mail')} ${esc(t('byEmail'))}</button></div>
          ${up ? '<span class="hint" id="abyh"></span>' : ''}</fieldset>
        ${up ? '' : `<div class="field" id="alpw"><label for="alp">${esc(t('phoneNum'))}</label><input id="alp" class="input" type="tel" inputmode="tel" dir="ltr" maxlength="30" autocomplete="username" placeholder="09XXXXXXXX"></div>`}
        <div class="field" id="aew"><label for="ae">${esc(t('email'))}</label><input id="ae" class="input" type="email" autocomplete="${up ? 'email' : 'username'}" inputmode="email" autocapitalize="off" spellcheck="false" dir="ltr" placeholder="name@gmail.com"></div>
        <div class="field"><label for="ap">${esc(t('password'))}</label><input id="ap" class="input" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="6" dir="ltr" required>${up ? `<span class="hint">${esc(t('passHint'))}</span>` : ''}</div>
        <p class="form-err" id="aerr" role="alert"></p>
        <div class="form-actions"><button class="btn btn-signal" id="ago">${esc(t(up ? 'createAcct' : 'signIn'))}</button>${up ? '' : `<button type="button" class="btn btn-ghost" id="afg">${esc(t('forgot'))}</button>`}</div>
      </form></main>`);
    const err = $('#aerr'), btn = $('#ago'), label = t(up ? 'createAcct' : 'signIn');
    const pick = (b, focus) => {
      by = b; SP.store('sp_login_by', b);
      $$('[data-by]').forEach(c => { const on = c.dataset.by === b; c.classList.toggle('on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
      $('#aew').hidden = b !== 'email'; if ($('#alpw')) $('#alpw').hidden = b !== 'phone';
      if ($('#abyh')) $('#abyh').textContent = t(b === 'phone' ? 'phoneLoginHint' : 'emailLoginHint');
      err.textContent = '';
      if (focus) { const f = b === 'email' ? $('#ae') : $('#alp') || $('#aph'); if (f && !f.value) f.focus(); }
    };
    $$('[data-by]').forEach(c => c.onclick = () => pick(c.dataset.by, true));
    pick(by);
    const bad = (id, k) => { err.textContent = t(k); $(id).focus(); };
    $('#af').onsubmit = async e => {
      e.preventDefault(); err.textContent = '';
      const pw = $('#ap').value, phone = SP.digits((up ? $('#aph') : $('#alp') || $('#aph')).value).trim();
      let prof = null;
      if (up) {
        prof = { shop_name: $('#ash').value.trim(), name: $('#anm').value.trim(), phone, city: $('#act').value.trim() };
        if (prof.shop_name.length < 2) return bad('#ash', 'needShop');
        if (prof.name.length < 2) return bad('#anm', 'needCustName');
        if (!SP.waNum(phone, CFG.defaultCountry || 'LY')) return bad('#aph', 'badPhone');
      }
      const email = by === 'email' ? $('#ae').value.trim() : SP.phoneLogin(phone);
      if (by === 'email' && !okMail(email)) return bad('#ae', 'badEmail');
      if (by === 'phone' && !email) return bad(up ? '#aph' : '#alp', 'badPhone');
      if (pw.length < 6) return bad('#ap', 'shortPass');
      if (prof) SP.store('sp_pending_profile', prof);
      btn.classList.add('busy'); btn.textContent = t('wait');
      try {
        const d = up ? await SP.auth.signUp(email, pw) : await SP.auth.signIn(email, pw);
        if (!d.session) {
          shell(bar(t('signupT')) + `<main class="wrap">${empty('mail', t('signupT'), t('confirmSent'), `<a class="btn btn-ink" href="#login">${esc(t('signIn'))}</a>`)}</main>`);
          return;
        }
        await SP.refreshUser(d.session);
        if (by === 'phone') SP.sb.rpc('link_login_phone').then(() => {}, () => {});
        SP.toast(t('welcome'));
        const to = S.after || 'mine'; S.after = '';
        SP.go(to);
      } catch (x) {
        const m = String((x && x.message) || '');
        err.textContent = by === 'phone' && /Invalid login credentials/i.test(m) ? t('errLoginPhone')
          : by === 'phone' && /already registered|already been registered|User already exists/i.test(m) ? t('errExistsPhone') : SP.errText(x);
        btn.classList.remove('busy'); btn.textContent = label;
      }
    };
    /* Face ID / fingerprint (js/passkey.js): same landing as the password */
    if (!up && SP.wireBioLogin) SP.wireBioLogin(n, async session => {
      await SP.refreshUser(session);
      SP.toast(t('welcome'));
      const to = S.after || 'mine'; S.after = '';
      SP.go(to);
    });
    if ($('#afg')) $('#afg').onclick = () => { S.resetBy = by; S.resetLogin = (by === 'phone' ? $('#alp') : $('#ae')).value.trim(); SP.go('reset'); };
    SP.done(n);
  };

  /* ---------- a forgotten password: a code by email (Gmail…) or by SMS, valid 90 seconds (the server's OTP expiry), then a new
     password. The demo cannot send either, so it shows the code it would have sent. ---------- */
  const OTP_SECS = +CFG.otpSeconds || 90;
  SP.route(/^reset$/, (m, n) => {
    if (gate(n)) return;
    let by = S.resetBy === 'email' ? 'email' : 'phone', to = null, end = 0, tick = 0;
    const pre = S.resetLogin || '';
    shell(bar(t('rsT')) + `<main class="wrap form-wrap">
      <form class="form" id="rsf" novalidate><p class="muted-p">${esc(t('rsB'))}</p>
        <fieldset class="field loginby"><legend class="flabel">${esc(t('loginBy'))}</legend><div class="chips light" role="radiogroup">
          <button type="button" class="chip" role="radio" data-by="phone">${I('phone')} ${esc(t('byPhone'))}</button>
          <button type="button" class="chip" role="radio" data-by="email">${I('mail')} ${esc(t('byEmail'))}</button></div></fieldset>
        <div class="field" id="rpw"><label for="rp">${esc(t('phoneNum'))}</label><input id="rp" class="input" type="tel" inputmode="tel" dir="ltr" maxlength="30" autocomplete="tel" placeholder="09XXXXXXXX" value="${by === 'phone' ? esc(pre) : ''}"></div>
        <div class="field" id="rew"><label for="re">${esc(t('email'))}</label><input id="re" class="input" type="email" inputmode="email" dir="ltr" autocapitalize="off" spellcheck="false" placeholder="name@gmail.com" value="${by === 'email' ? esc(pre) : ''}"></div>
        <p class="form-err" id="rserr" role="alert"></p>
        <div class="form-actions"><button class="btn btn-signal" id="rsgo">${I('send')} ${esc(t('rsSend'))}</button></div></form>
      <form class="form" id="rcf" novalidate hidden>
        <div class="banner note">${I('check')}<span id="rsto"></span></div>
        <div class="banner warn" id="rsdemo" hidden></div>
        <div class="field"><label for="rc">${esc(t('rsCode'))}</label><input id="rc" class="input num otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" placeholder="••••••"></div>
        <p class="rs-timer" id="rst" aria-live="polite"></p>
        <div class="field"><label for="rn">${esc(t('rsNew'))}</label><input id="rn" class="input" type="password" autocomplete="new-password" minlength="6" dir="ltr"><span class="hint">${esc(t('passHint'))}</span></div>
        <p class="form-err" id="rcerr" role="alert"></p>
        <div class="form-actions"><button class="btn btn-signal" id="rcgo">${I('check')} ${esc(t('rsSave'))}</button>
          <button type="button" class="btn btn-ghost" id="rsagain" hidden>${I('send')} ${esc(t('rsAgain'))}</button></div></form></main>`);
    const pick = b => {
      by = b; S.resetBy = b;
      $$('[data-by]').forEach(c => { const on = c.dataset.by === b; c.classList.toggle('on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
      $('#rpw').hidden = b !== 'phone'; $('#rew').hidden = b !== 'email'; $('#rserr').textContent = '';
    };
    $$('[data-by]').forEach(c => c.onclick = () => { pick(c.dataset.by); (by === 'phone' ? $('#rp') : $('#re')).focus(); });
    pick(by);
    const clock = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (!SP.alive(n) || !$('#rst')) { clearInterval(tick); return; }
      $('#rst').textContent = s ? t('rsLeft', { t: Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }) : t('rsGone');
      $('#rst').classList.toggle('gone', !s); $('#rsagain').hidden = !!s;
      if (!s) clearInterval(tick);
    };
    const sendErr = x => {
      const m = String((x && x.message) || ''), w = /after (\d+) seconds?/i.exec(m);
      if (w) return t('rsWait', { n: w[1] });
      if (/Signups not allowed|User not found|not found/i.test(m)) return t('rsNoAcct');
      if (by === 'phone' && /sms|phone provider|twilio|messagebird|vonage|textlocal|unsupported/i.test(m)) { forgotByPhone($('#rp').value); return t('rsNoSms'); }
      return SP.errText(x);
    };
    const send = async () => {
      const err = $('#rserr'); err.textContent = ''; $('#rcerr').textContent = '';
      if (by === 'phone') { const w = SP.waNum($('#rp').value, CFG.defaultCountry || 'LY'); if (!w) { err.textContent = t('badPhone'); $('#rp').focus(); return false; } to = { phone: '+' + w }; }
      else { const e = $('#re').value.trim().toLowerCase(); if (!okMail(e)) { err.textContent = t('badEmail'); $('#re').focus(); return false; } to = { email: e }; }
      try {
        const d = await SP.auth.otpSend(to);
        end = Date.now() + OTP_SECS * 1000; clearInterval(tick); tick = setInterval(clock, 1000);
        $('#rsf').hidden = true; $('#rcf').hidden = false;
        $('#rsto').innerHTML = esc(t('rsTo', { d: '\u0000' })).replace('\u0000', `<bdi dir="ltr">${esc(to.phone || to.email)}</bdi>`);
        $('#rsdemo').hidden = !d.demo_code; if (d.demo_code) $('#rsdemo').textContent = t('rsDemo', { c: d.demo_code });
        clock(); $('#rc').value = ''; $('#rc').focus();
        return true;
      } catch (x) { const msg = sendErr(x); if ($('#rcf').hidden) err.textContent = msg; else $('#rcerr').textContent = msg; return false; }
    };
    $('#rsf').onsubmit = async e => { e.preventDefault(); const b = $('#rsgo'); b.classList.add('busy'); await send(); b.classList.remove('busy'); };
    $('#rsagain').onclick = async () => { const b = $('#rsagain'); b.classList.add('busy'); await send(); b.classList.remove('busy'); };
    $('#rcf').onsubmit = async e => {
      e.preventDefault();
      const err = $('#rcerr'), code = SP.digits($('#rc').value).replace(/\D/g, ''), pw = $('#rn').value, b = $('#rcgo');
      err.textContent = '';
      if (Date.now() > end) { err.textContent = t('rsGone'); return; }
      if (code.length !== 6) { err.textContent = t('rsNeedCode'); $('#rc').focus(); return; }
      if (pw.length < 6) { err.textContent = t('shortPass'); $('#rn').focus(); return; }
      b.classList.add('busy');
      try {
        const d = await SP.auth.otpCheck(to, code);
        await SP.auth.setPassword(pw);
        clearInterval(tick);
        await SP.refreshUser(d.session);
        if (to.phone) SP.sb.rpc('link_login_phone').then(() => {}, () => {});
        S.resetLogin = '';
        SP.toast(t('rsDone'));
        SP.go(S.after || 'mine'); S.after = '';
      } catch (x) {
        err.textContent = /expired|invalid/i.test(String((x && x.message) || '')) ? (Date.now() > end ? t('rsGone') : t('rsWrong')) : SP.errText(x);
        b.classList.remove('busy');
      }
    };
    SP.done(n);
  });

  /* ---------- customer account (company edition) ---------- */
  SP.customerView = (m, n) => {
    const demo = SP.demo ? `<div class="banner warn">${I('info')}<span>${esc(t('demoB', { e: CFG.demoEmail || 'owner@demo.app' }))} ${esc(t('demoM'))}</span></div>` : '';
    const cartLink = S.settings.orders_enabled ? `<a class="admin-entry" href="#cart">${I('bag')}<span><b>${esc(t('cart'))}</b><small>${esc(SP.count(SP.cart.count(), 'parts'))}</small></span>${I('chevL', 'dirx')}</a>` : '';
    const ordLink = SP.ordersLink && S.settings.orders_enabled ? SP.ordersLink() : '';
    if (!S.user) {
      shell(bar(t('tabAccount'), '', { noBack: true }) + `<main class="wrap mine">${demo}<section class="onb"><h2>${esc(t('myAccount'))}</h2><p>${esc(t('signInToOrder'))}</p>
        <div class="form-actions"><a class="btn btn-signal" href="#login">${esc(t('signIn'))}</a><a class="btn btn-ghost" href="#signup">${esc(t('createAcct'))}</a></div></section>${cartLink}${SP.prefs()}</main>`);
      SP.wirePrefs();
      return SP.done(n);
    }
    const c = S.customer || { name: '', shop_name: '', phone: '', city: '' }, mode = S.settings.price_mode, staffer = SP.isStaff && SP.isStaff();
    /* a merchant without his shop or his number (an account from before) is asked for them first */
    const missing = !staffer && (!String(c.shop_name || '').trim() || !SP.waNum(c.phone, CFG.defaultCountry || 'LY'));
    const req = ' <span class="req">*</span>';
    shell(bar(t('tabAccount'), '', { noBack: true }) + `<main class="wrap mine">${demo}
      <section class="mcard acct"><div class="mc-head">${I(c.shop_name ? 'store' : 'user')}<span><b>${esc(c.shop_name || c.name || t('signedInT'))}</b><small class="ltr">${esc([c.shop_name ? c.name : '', SP.loginShown(S.user.email)].filter(Boolean).join(' · '))}</small></span>
        <button type="button" class="btn btn-ghost sm" id="lo">${I('logout', 'dirx')} ${esc(t('logout'))}</button></div>
        ${mode === 'approved' ? `<div class="banner ${c.approved ? 'note' : 'warn'}">${I(c.approved ? 'verified' : 'clock')}<span>${esc(t(c.approved ? 'approvedYes' : 'approvedNo'))}</span></div>` : ''}</section>
      ${missing ? `<a class="banner warn" href="#pf">${I('info')}<span><b>${esc(t('completeT'))}</b> ${esc(t('completeB'))}</span></a>` : ''}
      ${!staffer && SP.ledgerLink ? SP.ledgerLink() : ''}${!staffer && SP.myShopCard ? SP.myShopCard() : ''}${SP.bioCard ? SP.bioCard() : ''}${SP.eyeRow ? SP.eyeRow() : ''}${SP.systemLink ? SP.systemLink() : ''}${cartLink}${ordLink}
      <form class="form mcard" id="pf" novalidate><h2 class="lbl">${esc(t('myAccount'))}</h2>
        <div class="field"><label for="psh">${esc(t('mShop'))}${staffer ? '' : req}</label><input id="psh" class="input" maxlength="80" value="${esc(c.shop_name || '')}" autocomplete="organization" placeholder="${esc(t('mShopPh'))}"></div>
        <div class="field"><label for="pn">${esc(t('yourName'))}${req}</label><input id="pn" class="input" maxlength="80" value="${esc(c.name)}" autocomplete="name"></div>
        <div class="row2"><div class="field"><label for="pp">${esc(t('phoneNum'))}${staffer ? '' : req}</label><input id="pp" class="input" type="tel" dir="ltr" maxlength="30" value="${esc(c.phone)}" autocomplete="tel"></div>
          <div class="field"><label for="pc">${esc(t('city'))}</label><input id="pc" class="input" maxlength="40" value="${esc(c.city)}"></div></div>
        ${c.approved ? `<p class="hint">${esc(t('phoneAgainH'))}</p>` : ''}
        ${staffer ? '' : `<label class="switch"><input type="checkbox" id="ppub"${c.phone_public ? ' checked' : ''}><span></span>${esc(t('cuPhonePub'))}</label><span class="hint">${esc(t('cuPhonePubH'))}</span>`}
        <p class="form-err" id="perr" role="alert"></p><button class="btn btn-ink" id="pgo">${esc(t('saveProfile'))}</button></form>
      ${SP.prefs()}</main>`);
    SP.wirePrefs();
    if (SP.wireBio) SP.wireBio(n);
    if (SP.wireMyShopCard) SP.wireMyShopCard(n);
    if (SP.wireEyeRow) SP.wireEyeRow(n);
    $('#lo').onclick = async () => { await SP.auth.signOut(); await SP.refreshUser(null); SP.toast(t('loggedOut')); SP.render(); };
    $('#pf').onsubmit = async e => {
      e.preventDefault();
      const v = { shop_name: $('#psh').value.trim(), name: $('#pn').value.trim(), phone: SP.digits($('#pp').value).trim(), city: $('#pc').value.trim() };
      if ($('#ppub')) v.phone_public = $('#ppub').checked;
      const no = (id, k) => { $('#perr').textContent = t(k); $(id).focus(); };
      if (!staffer && v.shop_name.length < 2) return no('#psh', 'needShop');
      if (v.name.length < 2) return no('#pn', 'needCustName');
      if (!staffer && !SP.waNum(v.phone, CFG.defaultCountry || 'LY')) return no('#pp', 'badPhone');
      const b = $('#pgo'); b.classList.add('busy');
      try { await api.saveMe(v); SP.toast(t('profileSaved')); SP.render(); } catch (x) { $('#perr').textContent = SP.errText(x); } finally { b.classList.remove('busy'); }
    };
    SP.done(n);
  };

  /* ---------- order basket ---------- */
  SP.route(/^cart$/, async (m, n) => {
    if (gate(n)) return;
    const items = SP.cart.get();
    if (!items.length) {
      shell(bar(t('cart')) + `<main class="wrap">${empty('bag', t('cartEmptyT'), t('cartEmptyB'), `<a class="btn btn-ink" ${sf({})}>${esc(t('findPart'))}</a>`)}</main>`);
      return SP.done(n);
    }
    shell(bar(t('cart')) + `<main class="wrap form-wrap"><div class="cartlist" id="cl">${'<div class="sk sk-row"></div>'.repeat(Math.min(items.length, 4))}</div></main>`);
    let prods = [];
    try { prods = await api.byIds(items.map(i => i.id)); } catch (e) { if (SP.alive(n)) $('#cl').innerHTML = SP.errBox(e); return; }
    if (!SP.alive(n)) return;
    const c = S.customer || {};
    function draw() {
      const list = SP.cart.get().map(i => ({ ...i, p: prods.find(p => p.id === i.id) })).filter(i => i.p);
      if (!list.length) { SP.render(); return; }
      const cur = (list[0].p.shop || {}).currency || SP.currencyOf(S.country);
      const allPriced = list.every(i => i.p.price != null), total = list.reduce((k, i) => k + (i.p.price || 0) * i.qty, 0);
      $('#cl').innerHTML = list.map(i => `<div class="crow" data-id="${i.id}"><a class="cr-img" href="#p-${i.id}">${i.p.imgs[0] ? SP.imgTag(i.p.imgs[0], '', i.p.title, true) : I(SP.catIcon(i.p.cat))}</a>
          <span class="cr-main"><a href="#p-${i.id}"><b>${esc(i.p.title)}</b></a><small>${esc([i.p.part_no || i.p.sku, SP.fitText(i.p)].filter(Boolean).join(' · '))}</small>${SP.priceHTML(i.p.price, cur, i.p.price_hidden)}</span>
          <span class="stepper"><button type="button" data-d="-1" aria-label="−">−</button><b class="num">${i.qty}</b><button type="button" data-d="1" aria-label="+">+</button></span></div>`).join('')
        + (allPriced && total ? `<p class="cart-total">${esc(t('orderTotal', { t: SP.priceText(total, cur) }))}</p>` : '')
        + SP.orderForm(list);
      $('#cl').onclick = e => {
        const b = e.target.closest('[data-d]');
        if (!b) return;
        const id = b.closest('.crow').dataset.id, it = SP.cart.get().find(x => x.id === id);
        SP.cart.qty(id, (it ? it.qty : 0) + +b.dataset.d);
        draw();
      };
      /* the order is placed in the app (js/orders.js): it lands in the sales system «قيد التجهيز» */
      SP.orderWire(list, draw);
    }
    draw();
    SP.done(n);
  });

  /* ---------- about the company ---------- */
  SP.route(/^about$/, async (m, n) => {
    if (gate(n)) return;
    const st = S.settings || {};
    shell(bar(t('about')) + `<main class="wrap form-wrap"><div class="bhead">${st.logo ? `<img class="about-logo" src="${esc(st.logo)}" alt="">` : CFG.logoInk ? '' : `<span class="brand-mark big">${I('nut')}</span>`}<span>${!st.logo && CFG.logoInk ? `<img class="about-wm" src="${esc(CFG.logoInk)}" alt="${esc(appName())}">` : `<b>${esc(appName())}</b>`}${st.tagline ? `<small>${esc(st.tagline)}</small>` : ''}</span></div>
      ${st.about ? `<div class="about-text">${esc(st.about).replace(/\n/g, '<br>')}</div>` : ''}${SP.contactCta()}
      <h2 class="lbl optg">${esc(t('branches'))}</h2><div class="shops" id="sl"><div class="sk sk-row"></div></div></main>`);
    S.branches = null;
    const list = await branches();
    if (SP.alive(n)) $('#sl').innerHTML = list.length ? list.map(SP.shopRow).join('') : `<p class="muted-p">${esc(t('botNoBranch'))}</p>`;
    SP.done(n);
  });

  /* ---------- auto-reply assistant ---------- */
  const FILLER = new Set(['عندكم', 'عندك', 'هل', 'يوجد', 'فيه', 'في', 'ابي', 'نبي', 'ابغي', 'اريد', 'نريد', 'نحب', 'محتاج', 'نحتاج', 'ممكن', 'لو', 'سمحت', 'من', 'فضلك', 'السلام', 'عليكم', 'مرحبا', 'اهلا', 'هلا', 'شن', 'شنو', 'ايش', 'كم', 'بكم', 'سعر', 'اسعار', 'الاسعار', 'السعر', 'عن', 'على', 'الي', 'يا', 'و', 'متوفر', 'متوفره', 'موجود', 'do', 'you', 'have', 'i', 'need', 'want', 'please', 'is', 'there', 'any', 'the', 'a', 'an', 'for', 'of', 'price', 'prices', 'how', 'much', 'what', 'hello', 'hi', 'hey', 'available', 'in', 'stock']);
  const INTENT = {
    where: /^(وين|فين|مكان|مكانكم|عنوان|عنوانكم|موقع|موقعكم|الفرع|فرع|فروع|فروعكم|where|location|address|branch|branches)$/,
    hours: /^(متي|ساعات|اوقات|وقت|دوام|الدوام|تفتح|تفتحو|تفتحوا|تقفل|تقفلو|مفتوح|مسكر|العمل|hours|open|opening|close|closing)$/,
    contact: /^(واتساب|واتس|اتصال|رقم|رقمكم|هاتف|تلفون|موبايل|نتواصل|تواصل|contact|phone|whatsapp|call|number)$/,
    price: /^(سعر|اسعار|الاسعار|السعر|بكم|نشوف|نري|تظهر|price|prices|cost|see)$/,
    vin: /^(شاصي|الشاصي|vin|هيكل|الهيكل)$/,
    hello: /^(السلام|مرحبا|اهلا|هلا|صباح|مساء|hello|hi|hey|salam)$/
  };
  function priceHow() {
    const mm = (S.settings && S.settings.price_mode) || 'all';
    if (mm === 'all') return t('botPricesShown');
    if (mm === 'members') return S.user ? t('botPricesShown') : t('botHowLogin');
    if (mm === 'approved') return S.customer && S.customer.approved ? t('botPricesShown') : t('botHowApproved');
    return t('botHowCall');
  }
  function waBtn(q) {
    const w = SP.waLink(contactNum(), q, S.country);
    return w ? `<a class="chip wa" href="${esc(w)}" target="_blank" rel="noopener">${I('chat')} ${esc(t('botAskWa'))}</a>` : '';
  }
  async function botAnswer(q) {
    const nq = SP.norm(q);
    for (const r of arr(S.settings && S.settings.bot_rules)) {
      const keys = String(r.k || '').split(/[,،\n]/).map(SP.norm).filter(Boolean);
      if (r.a && keys.some(k => nq.includes(k))) return `<p>${esc(r.a).replace(/\n/g, '<br>')}</p>`;
    }
    const words = nq.split(' ').filter(Boolean), hit = {};
    const rest = words.filter(w => {
      let used = false;
      for (const k in INTENT) if (INTENT[k].test(w)) { hit[k] = true; used = true; }
      return !used && !FILLER.has(w);
    });
    if (hit.vin) return `<p>${esc(t('botVin'))}</p><a class="chip" href="#vin">${I('barcode')} ${esc(t('botOpenVin'))}</a>`;
    if (!rest.length) {
      if (hit.where || hit.hours) {
        const list = await branches();
        if (!list.length) return `<p>${esc(t('botNoBranch'))}</p>`;
        return `<p><b>${esc(t(hit.where ? 'botWhere' : 'botHours'))}</b></p><ul class="botlist">${list.slice(0, 8).map(b => `<li><a href="#s-${b.id}"><b>${esc(b.name)}</b></a> · ${esc(b.city)}${b.area ? '، ' + esc(b.area) : ''}${b.hours ? `<br><small>${I('clock')} ${esc(b.hours)}</small>` : ''}</li>`).join('')}</ul>`;
      }
      if (hit.contact) {
        const st = S.settings || {}, num = contactNum();
        return `<p>${esc(t('botContact'))}</p><p class="ltr">${num ? esc(SP.prettyPhone(num, S.country)) : ''}${st.contact_phone && st.contact_phone !== num ? '<br>' + esc(SP.prettyPhone(st.contact_phone, S.country)) : ''}</p>${waBtn(t('waShop', { name: appName() }))}`;
      }
      if (hit.price) return `<p>${esc(priceHow())}</p>`;
      return `<p>${esc((S.settings && S.settings.bot_welcome) || t('botWelcomeDef'))}</p>`;
    }
    const query = rest.join(' ');
    try {
      const r = await api.search(SP.searchArgs({ ...SP.FDEF, q: query }, { limit: 3 }));
      if (!r.total) return `<p>${esc(t('botNone', { q: query }))}</p>${waBtn(q)}`;
      return `<p>${esc(t('botFound', { n: SP.fmtNum(r.total) }))}</p><div class="botparts">${r.items.map(p => `<a class="botpart" href="#p-${p.id}"><span class="bp-img">${p.imgs[0] ? SP.imgTag(p.imgs[0], '', p.title, true) : I(SP.catIcon(p.cat))}</span><span><b>${esc(p.title)}</b><small>${esc(SP.fitText(p))}</small>${SP.priceHTML(p.price, (p.shop || {}).currency, p.price_hidden)}</span></a>`).join('')}</div>
        ${hit.price ? `<p class="muted-p">${esc(priceHow())}</p>` : ''}<a class="chip" ${sf({ q: query })}>${I('search')} ${esc(t('botSeeAll'))}</a>`;
    } catch (e) { return `<p>${esc(SP.errText(e))}</p>${waBtn(q)}`; }
  }
  const BOT_KEY = 'sp_bot';
  const botLog = () => { try { return JSON.parse(sessionStorage.getItem(BOT_KEY) || '[]'); } catch (e) { return []; } };
  const botSave = l => { try { sessionStorage.setItem(BOT_KEY, JSON.stringify(l.slice(-40))); } catch (e) { /* private mode */ } };
  SP.route(/^bot$/, (m, n) => {
    if (gate(n)) return;
    shell(bar(t('botT'), `<button type="button" class="iconbtn" id="bclr" aria-label="${esc(t('botClear'))}">${I('trash')}</button>`) +
      `<main class="wrap chat" id="chat" aria-live="polite"></main>
      <div class="chatdock"><div class="chips quick" id="bq">${['botQ1', 'botQ2', 'botQ3', 'botQ4'].map(k => `<button type="button" class="chip" data-q="${esc(t(k))}">${esc(t(k))}</button>`).join('')}</div>
      <form class="chatbar wrap" id="cf"><input id="ci" class="input" autocomplete="off" maxlength="200" placeholder="${esc(t('botPh'))}" enterkeyhint="send" aria-label="${esc(t('botPh'))}"><button class="btn btn-signal" aria-label="${esc(t('botSend'))}">${I('send', 'dirx')}</button></form></div>`, { actionbar: true });
    document.body.classList.add('has-chat');
    let log = botLog();
    if (!log.length) log = [{ w: 'bot', h: `<p>${esc((S.settings && S.settings.bot_welcome) || t('botWelcomeDef'))}</p>` }];
    const chat = $('#chat');
    const draw = () => { chat.innerHTML = log.map(x => `<div class="msg ${x.w}">${x.h}</div>`).join(''); window.scrollTo(0, document.body.scrollHeight); };
    draw();
    async function ask(q) {
      q = q.trim();
      if (!q) return;
      log.push({ w: 'me', h: `<p>${esc(q)}</p>` }, { w: 'bot typing', h: '<span class="dots"><i></i><i></i><i></i></span>' });
      draw();
      const h = await botAnswer(q);
      if (!SP.alive(n)) return;
      log.pop(); log.push({ w: 'bot', h });
      botSave(log); draw();
    }
    $('#cf').onsubmit = e => { e.preventDefault(); const v = $('#ci').value; $('#ci').value = ''; ask(v); };
    $('#bq').onclick = e => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); };
    $('#bclr').onclick = () => { log = []; botSave(log); SP.render(); };
  });
  window.addEventListener('hashchange', () => { if (SP.here() !== 'bot') document.body.classList.remove('has-chat'); });

  /* ---------- admin: company settings ---------- */
  SP.route(/^admin-company$/, (m, n) => {
    if (gate(n) || !adminGuard(n)) return;
    const st = S.settings || {};
    let logo = st.logo || '';
    /* a logo picture per brand, from the company's own files; saved with the settings */
    const logos = { ...(st.brand_logos && typeof st.brand_logos === 'object' ? st.brand_logos : {}) };
    /* the colour of this edition's look (the royal skin is blue): shown when the owner has not picked one, and saved as "none" when picked back */
    const skinColor = (() => {
      const r = document.documentElement, cur = r.style.getPropertyValue('--signal');
      r.style.removeProperty('--signal'); const v = getComputedStyle(r).getPropertyValue('--signal').trim().toLowerCase(); if (cur) r.style.setProperty('--signal', cur);
      return /^#[0-9a-f]{6}$/.test(v) ? v : '#ffa31a';
    })();
    const chosen = new Set(arr(st.brands).length ? st.brands : SP.brandsList().map(b => b.id));
    const group = (title, list) => `<p class="lbl optg">${title}</p><div class="seg brandseg">${list.map(b => `<input type="checkbox" id="bb-${b.id}" value="${b.id}"${chosen.has(b.id) ? ' checked' : ''}><label for="bb-${b.id}">${esc(SP.brandName(b.id))}</label>`).join('')}</div>`;
    const by = cc => D.BRANDS.filter(b => b.origin === cc), other = D.BRANDS.filter(b => b.origin !== 'KR' && b.origin !== 'JP');
    shell(bar(t('companySet')) + `<main class="wrap mine">${SP.adminTabs('admin-company')}<form class="form" id="csf" novalidate>
      <section class="mcard"><h2 class="lbl">${esc(t('brandingT'))}</h2>
        <div class="row2"><div class="field"><label for="cbn">${esc(t('brandNameL'))}</label><input id="cbn" class="input" maxlength="60" value="${esc(st.brand_name || '')}" placeholder="${esc(CFG.appName || t('app'))}"></div>
          <div class="field"><label for="ctg">${esc(t('taglineL'))}</label><input id="ctg" class="input" maxlength="120" value="${esc(st.tagline || '')}"></div></div>
        <div class="row2"><div class="field"><span class="lbl">${esc(t('logoL'))}</span><label class="logo-pick sm" id="clp"><span class="logo-in" id="cli">${logo ? SP.imgTag(logo, '', '') : I('camera')}</span><input type="file" accept="image/*" class="sr" id="clf"></label></div>
          <div class="field"><label for="cac">${esc(t('accentL'))}</label><input id="cac" class="input color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(st.accent || '') ? st.accent : skinColor)}"></div></div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('textsT'))}</h2>
        <div class="field"><label for="cht">${esc(t('heroTitleL'))}</label><input id="cht" class="input" maxlength="80" value="${esc(st.hero_title || '')}" placeholder="${esc(t('heroA') + ' ' + t('heroB'))}"></div>
        <div class="field"><label for="chs">${esc(t('heroSubL'))}</label><textarea id="chs" class="input" maxlength="240" placeholder="${esc(t('heroSub'))}">${esc(st.hero_sub || '')}</textarea></div>
        <div class="field"><label for="cnt">${esc(t('notice'))}</label><input id="cnt" class="input" maxlength="300" value="${esc(st.notice || '')}" placeholder="${esc(t('noticePh'))}"></div>
        <div class="field"><label for="cab">${esc(t('aboutL'))}</label><textarea id="cab" class="input" maxlength="4000" rows="6">${esc(st.about || '')}</textarea></div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('contactT'))}</h2>
        <div class="row2"><div class="field"><label for="cwa">${esc(t('contactWaL'))}</label><input id="cwa" class="input" type="tel" dir="ltr" maxlength="30" value="${esc(st.contact_wa || '')}"></div>
          <div class="field"><label for="cph">${esc(t('contactPhoneL'))}</label><input id="cph" class="input" type="tel" dir="ltr" maxlength="30" value="${esc(st.contact_phone || '')}"></div></div>
        <div class="field"><label for="cad">${esc(t('addressL'))}</label><input id="cad" class="input" maxlength="200" value="${esc(st.address || '')}"></div></section>
      <a class="admin-entry" href="#admin-control">${I('lock')}<span><b>${esc(t('ctlCustT'))}</b><small>${esc(t('ctlMoved'))}</small></span>${I('chevL', 'dirx')}</a>
      <section class="mcard"><h2 class="lbl">${esc(t('brandsL'))}</h2><div class="form-actions"><button type="button" class="btn btn-ghost sm" id="bkj">${esc(t('brandsKJ'))}</button><button type="button" class="btn btn-ghost sm" id="ball">${esc(t('brandsAll'))}</button></div>
        <div id="bgs">${group(SP.flag('KR') + ' ' + SP.countryName('KR'), by('KR'))}${group(SP.flag('JP') + ' ' + SP.countryName('JP'), by('JP'))}${group(t('moreBrands'), other)}</div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('blogosT'))}</h2><p class="hint">${esc(t('blogosH'))}</p><div class="blogos" id="blg"></div></section>
      <p class="form-err" id="cerr" role="alert"></p><button class="btn btn-signal block" id="cgo">${I('check')} ${esc(t('saveSettings'))}</button></form></main>`);
    const inp = $('#clf');
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      if (!f) return;
      $('#clp').classList.add('busy-pick');
      try { logo = await SP.uploadPhoto(f, 'logo'); $('#cli').innerHTML = SP.imgTag(logo, '', ''); } catch (e) { SP.toast(SP.errText(e)); }
      finally { $('#clp').classList.remove('busy-pick'); }
    };
    /* the brands shown, each with its mark: tap to upload its logo, × to go back to the initials */
    const drawLogos = () => {
      const ids = $$('#bgs input:checked').map(x => x.value);
      $('#blg').innerHTML = ids.map(id => { const has = typeof logos[id] === 'string' && !!logos[id];
        return `<div class="blogo" data-id="${id}"><label class="blogo-pick">${SP.brandMark(id, logos)}<span class="bn">${esc(SP.brandName(id))}</span>
          <small>${I('camera')} ${esc(t(has ? 'blogoChange' : 'blogoAdd'))}</small><input type="file" accept="image/*" class="sr" data-up="${id}"></label>
          ${has ? `<button type="button" class="blogo-rm" data-rm="${id}" aria-label="${esc(t('blogoDel', { b: SP.brandName(id) }))}">${I('close')}</button>` : ''}</div>`; }).join('');
    };
    drawLogos();
    $('#bgs').addEventListener('change', drawLogos);
    $('#blg').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0], id = e.target.dataset.up, tile = e.target.closest('.blogo');
      e.target.value = '';
      if (!f || !id) return;
      tile.classList.add('busy');
      try { logos[id] = await SP.uploadPhoto(f, 'logo'); drawLogos(); } catch (x) { tile.classList.remove('busy'); SP.toast(SP.errText(x)); }
    });
    $('#blg').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { delete logos[b.dataset.rm]; drawLogos(); } });
    $('#bkj').onclick = () => { $$('#bgs input').forEach(x => { x.checked = ['KR', 'JP'].includes((BRAND.get(x.value) || {}).origin); }); drawLogos(); };
    $('#ball').onclick = () => { $$('#bgs input').forEach(x => { x.checked = true; }); drawLogos(); };
    $('#csf').onsubmit = async e => {
      e.preventDefault();
      const picked = $$('#bgs input:checked').map(x => x.value);
      const v = {
        brand_name: $('#cbn').value.trim(), tagline: $('#ctg').value.trim(), logo: logo || '', accent: $('#cac').value || '',
        hero_title: $('#cht').value.trim(), hero_sub: $('#chs').value.trim(), notice: $('#cnt').value.trim(), about: $('#cab').value.trim(),
        contact_wa: SP.digits($('#cwa').value).trim(), contact_phone: SP.digits($('#cph').value).trim(), address: $('#cad').value.trim(),
        brands: picked.length === D.BRANDS.length ? [] : picked,
        brand_logos: Object.fromEntries(Object.entries(logos).filter(([k, v]) => BRAND.has(k) && typeof v === 'string' && v))
      };
      if (v.accent.toLowerCase() === skinColor) v.accent = '';
      if (v.contact_wa && !SP.waNum(v.contact_wa, S.country)) { $('#cerr').textContent = t('needWa', { ex: '+' + SP.dialOf(S.country) + ' …' }); return; }
      const b = $('#cgo'); b.classList.add('busy');
      try { await api.saveSettings(v); SP.toast(t('settingsSaved')); SP.render(); } catch (x) { $('#cerr').textContent = SP.errText(x); } finally { b.classList.remove('busy'); }
    };
    SP.done(n);
  });

  /* ---------- admin: customers ---------- */
  const custRow = c => `<div class="arow"><span class="hexav"><span>${esc(SP.initial(c.name))}</span></span><span class="ar-main"><b>${esc(c.name)} ${c.approved ? `<span class="pill ok">${esc(t('custApproved'))}</span>` : `<span class="pill demo">${esc(t('custPending'))}</span>`}</b>
    <small><span class="ltr">${esc(c.phone || '—')}</span>${c.city ? ' · ' + esc(c.city) : ''} · ${esc(SP.ago(Date.parse(c.created_at)))}</small></span>
    <button type="button" class="btn ${c.approved ? 'btn-ghost' : 'btn-ink'} sm" data-c="${c.user_id}" data-on="${c.approved ? 0 : 1}">${esc(t(c.approved ? 'unapproveBtn' : 'approveBtn'))}</button>
    ${SP.waLink(c.phone, '', S.country) ? `<a class="iconbtn ink" href="${esc(SP.waLink(c.phone, '', S.country))}" target="_blank" rel="noopener" aria-label="${esc(t('whatsapp'))}">${I('chat')}</a>` : ''}</div>`;
  SP.route(/^admin-customers$/, async (m, n) => {
    if (gate(n) || !adminGuard(n)) return;
    shell(bar(t('customersT')) + `<main class="wrap mine">${SP.adminTabs('admin-customers')}<div id="cl"><div class="sk sk-row"></div></div></main>`);
    try {
      const list = await api.customers();
      if (!SP.alive(n)) return;
      $('#cl').innerHTML = list.length ? `<p class="lbl">${esc(SP.fmtNum(list.length))} · ${esc(t('custPending'))}: ${esc(SP.fmtNum(list.filter(c => !c.approved).length))}</p>` + list.map(custRow).join('') : empty('user', t('noCustomers'));
      $('#cl').onclick = async e => {
        const b = e.target.closest('[data-c]');
        if (!b) return;
        b.classList.add('busy');
        try { const c = await api.approve(b.dataset.c, b.dataset.on === '1'); b.closest('.arow').outerHTML = custRow(c); SP.toast(t('custSaved')); }
        catch (x) { b.classList.remove('busy'); SP.toast(SP.errText(x)); }
      };
    } catch (e) { if (SP.alive(n)) $('#cl').innerHTML = SP.errBox(e); }
    SP.done(n);
  });

  /* ---------- admin: auto-reply ---------- */
  SP.route(/^admin-bot$/, (m, n) => {
    if (gate(n) || !adminGuard(n)) return;
    const st = S.settings || {};
    let rules = arr(st.bot_rules).map(r => ({ k: r.k || '', a: r.a || '' }));
    const url = SP.siteUrl();
    const ruleHTML = (r, i) => `<div class="rule" data-i="${i}"><div class="field"><label>${esc(t('botKeys'))}</label><input class="input rk" maxlength="200" value="${esc(r.k)}"></div>
      <div class="field"><label>${esc(t('botAns'))}</label><textarea class="input ra" maxlength="600">${esc(r.a)}</textarea></div><button type="button" class="btn btn-ghost sm rdel">${I('trash')} ${esc(t('botDelRule'))}</button></div>`;
    shell(bar(t('adminBot')) + `<main class="wrap mine">${SP.adminTabs('admin-bot')}<form class="form" id="bf" novalidate>
      <section class="mcard"><label class="switch"><input type="checkbox" id="bon"${st.bot_enabled !== false ? ' checked' : ''}><span></span>${esc(t('botOnL'))}</label>
        <div class="field"><label for="bwl">${esc(t('botWelcomeL'))}</label><textarea id="bwl" class="input" maxlength="400" placeholder="${esc(t('botWelcomeDef'))}">${esc(st.bot_welcome || '')}</textarea></div></section>
      <section class="mcard"><h2 class="lbl">${esc(t('botRulesL'))}</h2><span class="hint">${esc(t('botRulesHint'))}</span><div id="rl">${rules.map(ruleHTML).join('')}</div>
        <button type="button" class="btn btn-ghost" id="radd">${I('plus')} ${esc(t('botAddRule'))}</button></section>
      <p class="form-err" id="berr" role="alert"></p><button class="btn btn-signal block" id="bgo">${I('check')} ${esc(t('saveSettings'))}</button></form>
      <section class="mcard"><h2 class="lbl">${esc(t('botWaT'))}</h2><p class="hint">${esc(t('botWaB'))}</p>
        ${['waGreet', 'waAway'].map(k => `<pre class="share-pre">${esc(t(k, { app: appName(), url }))}</pre><button type="button" class="btn btn-ghost sm" data-copy="${k}">${I('copy')} ${esc(t('copy'))}</button>`).join('')}</section></main>`);
    const read = () => $$('#rl .rule').map(d => ({ k: $('.rk', d).value.trim(), a: $('.ra', d).value.trim() }));
    $('#radd').onclick = () => { rules = read(); rules.push({ k: '', a: '' }); $('#rl').innerHTML = rules.map(ruleHTML).join(''); $$('#rl .rk').pop().focus(); };
    $('#rl').onclick = e => { const d = e.target.closest('.rdel'); if (!d) return; rules = read(); rules.splice(+d.closest('.rule').dataset.i, 1); $('#rl').innerHTML = rules.map(ruleHTML).join(''); };
    $$('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(t(b.dataset.copy, { app: appName(), url })); SP.toast(t('copied')); } catch (e) { SP.toast(t('selectCopy')); } });
    $('#bf').onsubmit = async e => {
      e.preventDefault();
      const b = $('#bgo'); b.classList.add('busy');
      try { await api.saveSettings({ bot_enabled: $('#bon').checked, bot_welcome: $('#bwl').value.trim(), bot_rules: read().filter(r => r.k && r.a).slice(0, 60) }); SP.toast(t('settingsSaved')); }
      catch (x) { $('#berr').textContent = SP.errText(x); } finally { b.classList.remove('busy'); }
    };
    SP.done(n);
  });

  /* ---------- admin: sales system (Excel/CSV import, export, sync key) ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => window.XLSX ? res(window.XLSX) : rej(new Error('Failed to fetch'));
      s.onerror = () => rej(new Error('Failed to fetch'));
      document.head.appendChild(s);
    });
  }
  async function readSheet(file) {
    if (/\.(xlsx|xls|xlsm|ods)$/i.test(file.name)) {
      if (CFG.embedded) throw Object.assign(new Error('xlsx in the in-app page'), { userMsg: t('xlsxEmbedded') });
      const X = await loadXLSX(), wb = X.read(await file.arrayBuffer());
      return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    }
    return parseCSV(await file.text());
  }
  const COLS = {
    sku: ['sku', 'code', 'item code', 'itemcode', 'item_code', 'كود', 'الكود', 'رقم الصنف', 'كود الصنف', 'رمز الصنف', 'رقم الماده', 'كود الماده', 'الرمز'],
    barcode: ['barcode', 'bar code', 'ean', 'upc', 'gtin', 'الباركود', 'باركود'],
    title: ['name', 'item name', 'item', 'title', 'description', 'اسم الصنف', 'الصنف', 'اسم الماده', 'الاسم', 'البيان', 'الوصف', 'الماده', 'اسم القطعه', 'القطعه'],
    price: ['price', 'sale price', 'selling price', 'retail price', 'سعر', 'السعر', 'سعر البيع', 'سعر المستهلك', 'سعر القطاعي'],
    qty: ['qty', 'quantity', 'stock', 'balance', 'on hand', 'الكميه', 'الرصيد', 'المخزون', 'الكميه المتوفره', 'الموجود', 'العدد'],
    make: ['brand', 'make', 'car', 'الماركه', 'نوع السياره', 'السياره'],
    /* the company that made the part (Mobis, Denso…), not the car */
    maker: ['maker', 'manufacturer', 'mfr', 'الشركه', 'الشركه المصنعه', 'الشركه الصانعه', 'المصنع'],
    location: ['location', 'bin', 'shelf', 'place', 'المكان', 'مكان القطعه', 'مكانها', 'الموقع', 'الرف', 'مكان التخزين'],
    model: ['model', 'الموديل', 'الطراز'],
    part_no: ['oem', 'part number', 'part no', 'partno', 'oem no', 'oem number', 'رقم القطعه', 'رقم المصنع', 'الرقم الاصلي', 'رقم الوكاله'],
    cat: ['category', 'group', 'القسم', 'المجموعه', 'الفئه', 'التصنيف']
  };
  function detectColumns(rows) {
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const head = rows[r].map(h => SP.norm(h)), map = {};
      head.forEach((h, i) => { for (const k in COLS) if (map[k] == null && COLS[k].some(w => SP.norm(w) === h)) map[k] = i; });
      head.forEach((h, i) => { if (!h) return; for (const k in COLS) if (map[k] == null && !Object.values(map).includes(i) && COLS[k].some(w => SP.norm(w).length > 3 && h.includes(SP.norm(w)))) map[k] = i; });
      if (Object.keys(map).length >= 2) return { row: r, map };
    }
    return null;
  }
  const BRAND_AR = new Map(D.BRANDS.map(b => [SP.norm(b.ar), b.id]));
  const catOf = v => {
    const n = SP.norm(v);
    if (!n) return null;
    if (D.CATS.some(c => c.id === n)) return n;
    for (const id in SP.L.CAT) if (SP.L.CAT[id].some(r => r.some(x => SP.norm(x) === n || (n.length > 3 && SP.norm(x).includes(n))))) return id;
    return 'other';
  };
  function toRows(rows, det) {
    const g = (r, k) => det.map[k] != null ? String(r[det.map[k]] == null ? '' : r[det.map[k]]).trim() : undefined;
    return rows.slice(det.row + 1).map(r => {
      const bc = g(r, 'barcode'), o = { sku: det.map.sku != null ? g(r, 'sku') : bc, title: g(r, 'title') };
      if (bc) o.barcode = bc.replace(/\s/g, '');
      const pr = g(r, 'price'), qt = g(r, 'qty'), mk = g(r, 'make'), md = g(r, 'model'), pn = g(r, 'part_no'), ct = g(r, 'cat'), mf = g(r, 'maker');
      if (pr !== undefined && pr !== '') o.price = SP.digits(pr).replace(/[^\d.,-]/g, '');
      if (qt !== undefined && qt !== '') o.qty = SP.digits(qt).replace(/[^\d.,-]/g, '');
      if (mk) o.make = SP.VIN.matchBrand(mk) || BRAND_AR.get(SP.norm(mk)) || '';
      if (md !== undefined) o.model = md;
      if (mf !== undefined) o.maker = mf.slice(0, 60);
      const lc = g(r, 'location'); if (lc !== undefined) o.location = lc.slice(0, 60);
      if (pn) o.part_no = pn.toUpperCase();
      if (ct) o.cat = catOf(ct);
      return o;
    }).filter(o => o.sku);
  }
  const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const download = (name, text) => SP.saveFile(name, text);
  SP.route(/^admin-sync$/, async (m, n) => {
    if (gate(n) || !adminGuard(n)) return;
    const base = (CFG.supabaseUrl || 'https://YOUR-PROJECT.supabase.co').replace(/\/$/, '');
    shell(bar(t('syncT')) + `<main class="wrap mine">${SP.adminTabs('admin-sync')}
      <section class="mcard"><h2 class="lbl">${esc(t('importT'))}</h2><p class="hint">${esc(t('importB'))}</p>
        <div class="field"><label for="ibr">${esc(t('importBranch'))}</label><select id="ibr" class="input"><option value="">…</option></select></div>
        <label class="btn btn-signal filebtn">${I('download')} ${esc(t('chooseFile'))}<input type="file" id="ifile" class="sr" accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv"></label>
        <p class="hint" id="istat" aria-live="polite"></p></section>
      <section class="mcard"><h2 class="lbl">${esc(t('exportT'))}</h2><p class="hint">${esc(t('exportB'))}</p><button type="button" class="btn btn-ghost" id="exp">${I('download')} ${esc(t('exportBtn'))}</button></section>
      <section class="mcard"><h2 class="lbl">${esc(t('autoT'))}</h2><p class="hint">${esc(t('autoB'))}</p>
        <div class="form-actions"><button type="button" class="btn btn-ink" id="key">${I('lock')} ${esc(t('newKey'))}</button><a class="btn btn-ghost" href="tools/sync/sparat_sync.py" download>${I('download')} ${esc(t('downloadScript'))}</a></div>
        <div id="kbox"></div>
        <details class="dev"><summary>${esc(t('devDetails'))}</summary><pre class="share-pre ltr">POST ${esc(base)}/rest/v1/rpc/sync_products
apikey: ${esc(CFG.supabaseKey || '<anon key>')}
Content-Type: application/json

{"p_key": "&lt;link key&gt;",
 "p_rows": [{"sku": "58101-1RA00", "barcode": "8801234567890", "title": "Brake pads Accent",
             "price": 150, "qty": 12, "make": "hyundai", "model": "Accent"}]}

→ {"inserted": 1, "updated": 0, "skipped": 0, "errors": 0}</pre></details></section></main>`);
    try {
      const sh = (await api.shops({ p_limit: 100 })).items;
      if (SP.alive(n)) $('#ibr').innerHTML = sh.map(s => opt(s.id, s.name + ' · ' + s.city, sh[0] && sh[0].id)).join('') || `<option value="">${esc(t('noShopsT'))}</option>`;
    } catch (e) { /* branch list optional: server picks the first branch */ }
    const stat = $('#istat');
    $('#ifile').onchange = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = '';
      if (!f) return;
      stat.textContent = t('importing', { n: '' });
      try {
        const rows = await readSheet(f), det = detectColumns(rows);
        if (!det || (det.map.sku == null && det.map.barcode == null)) { stat.textContent = t('importNoSku'); return; }
        const names = Object.keys(det.map).map(k => ({ sku: 'SKU', title: t('partName'), price: t('priceCur', { cur: '' }).replace(/[()（）\s]+$/, ''), qty: t('qty'), make: t('brand'), model: t('model'), part_no: t('partNo'), cat: t('category'), barcode: t('barcodeL'), maker: t('makerL'), location: t('locL') }[k]));
        const data = toRows(rows, det), sum = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
        for (let i = 0; i < data.length; i += 500) {
          stat.textContent = t('importing', { n: SP.fmtNum(Math.min(i + 500, data.length)) + ' / ' + SP.fmtNum(data.length) });
          const r = await api.importRows(data.slice(i, i + 500), $('#ibr').value || null);
          for (const k in sum) sum[k] += +r[k] || 0;
        }
        stat.innerHTML = `${esc(t('importCols', { c: names.join('، ') }))}<br><b>${esc(t('importDone', { i: sum.inserted, u: sum.updated, s: sum.skipped, e: sum.errors }))}</b>`;
        S.myShops = null; S.pcache.clear();
      } catch (x) { stat.textContent = (x && x.userMsg) || SP.errText(x); }
    };
    $('#exp').onclick = async () => {
      const b = $('#exp'); b.classList.add('busy');
      try {
        const all = [];
        for (let off = 0; off < 50000; off += 60) {
          const r = await api.search({ p_include_sold: true, p_limit: 60, p_offset: off, p_country: null });
          all.push(...r.items);
          if (r.items.length < 60) break;
        }
        const head = ['sku', 'barcode', 'title', 'price', 'qty', 'status', 'maker', 'make', 'model', 'y_from', 'y_to', 'part_no', 'cat', 'cond', 'hide_price', 'branch', 'city'];
        const lines = [head.join(',')].concat(all.map(p => [p.sku, p.barcode, p.title, p.price, p.qty, p.status, p.maker, p.make, p.model, p.y_from, p.y_to, p.part_no, p.cat, p.cond, p.hide_price ? 1 : 0, p.shop && p.shop.name, p.shop && p.shop.city].map(csvCell).join(',')));
        download('parts-' + new Date().toISOString().slice(0, 10) + '.csv', lines.join('\r\n'));
        SP.toast(t('exported', { n: SP.fmtNum(all.length) }));
      } catch (x) { SP.toast(SP.errText(x)); } finally { b.classList.remove('busy'); }
    };
    $('#key').onclick = async () => {
      if (!await SP.confirmSheet({ title: t('newKey'), body: t('keyConfirm'), ok: t('yes') })) return;
      try {
        const k = await api.rotateKey();
        $('#kbox').innerHTML = `<pre class="share-pre ltr mono" id="kv">${esc(k)}</pre><p class="hint warnt">${esc(t('keyOnce'))}</p><button type="button" class="btn btn-ghost sm" id="kc">${I('copy')} ${esc(t('copy'))}</button>`;
        $('#kc').onclick = async () => { try { await navigator.clipboard.writeText(k); SP.toast(t('copied')); } catch (e) { SP.toast(t('selectCopy')); } };
      } catch (x) { SP.toast(SP.errText(x)); }
    };
    SP.done(n);
  });
})();
