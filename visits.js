// ============ عدّاد الزوار ============
// كل زائر بيتعد مرة واحدة في اليوم (visits/{اليوم})، وكل منتج بيتعد مرة واحدة لكل زائر في اليوم
// (productViews/{اليوم_رقم المنتج}). من غير أي بيانات شخصية، ومن غير تحميل Firebase SDK.
// لوحة التحكم بتقرا الأرقام دي في تاب "الزوار" (admin-visits.js)

const VISIT_LOG = "gtech-visit-log";   // { day, seen: [أرقام المنتجات اللي اتعدّت النهارده] }
const FIRST_SEEN = "gtech-first-seen";  // أول مرة الزائر ده دخل
const IS_ADMIN_BROWSER = "gtech-admin-browser"; // متصفح صاحب المتجر مايتعدّش
const VISITS_LOCAL = "gtech-visits-local"; // الوضع التجريبي
const SOURCE_KEY = "gtech-source"; // آخر مصدر جه منه الزائر (فيسبوك، تيك توك…) — بيتربط بالطلب لو طلب خلال 30 يوم

// ============ الزائر جاي منين؟ ============
// من لينك فيه utm_source أو من علامات الإعلانات (fbclid / ttclid / gclid) أو من الصفحة اللي جه منها
const SOURCES = ["facebook", "instagram", "tiktok", "google", "whatsapp", "direct", "other"];
function detectSource() {
  const q = new URLSearchParams(location.search);
  const utm = (q.get("utm_source") || "").toLowerCase();
  const pick = (s) => (/^(fb|facebook|meta)/.test(s) ? "facebook" : /^(ig|insta)/.test(s) ? "instagram" : /tiktok|^tt$/.test(s) ? "tiktok"
    : /google|^gg$/.test(s) ? "google" : /whats|^wa$/.test(s) ? "whatsapp" : s ? "other" : "");
  if (utm) return pick(utm);
  if (q.has("fbclid")) return /instagram/i.test(navigator.userAgent) ? "instagram" : "facebook";
  if (q.has("ttclid")) return "tiktok";
  if (q.has("gclid")) return "google";
  if (/Instagram/i.test(navigator.userAgent)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(navigator.userAgent)) return "facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(navigator.userAgent)) return "tiktok";
  let host = "";
  try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch {}
  if (!host || host === location.hostname) return "direct";
  return /facebook|fb\.me|fb\.com/.test(host) ? "facebook" : /instagram/.test(host) ? "instagram" : /tiktok/.test(host) ? "tiktok"
    : /google\./.test(host) ? "google" : /whatsapp|wa\.me/.test(host) ? "whatsapp" : /tinyurl/.test(host) ? "direct" : "other";
}
// المصدر اللي بيتكتب في الطلب: آخر مصدر مش "مباشر" خلال 30 يوم
function orderSource() {
  const s = store.get(SOURCE_KEY, null);
  return s && Date.now() - s.at < 30 * 86400000 ? s.src : "direct";
}

const NEW_FIELDS = new Set(["viewers", "carts", "checkouts", ...SOURCES.map((s) => "src_" + s)]);
function countVisit(allFields, productId) {
  const fields = allFields.filter((f) => !NEW_FIELDS.has(f));
  const extra = allFields.filter((f) => NEW_FIELDS.has(f));
  const day = cairoDay();
  if (!FIREBASE_CONFIG) {
    const all = store.get(VISITS_LOCAL, { days: {}, products: {} });
    const d = (all.days[day] ||= {});
    allFields.forEach((f) => { d[f] = (d[f] || 0) + 1; });
    if (productId) {
      const key = `${day}_${productId}`;
      all.products[key] = { day, productId, count: (all.products[key]?.count || 0) + 1 };
    }
    store.set(VISITS_LOCAL, all);
    return Promise.resolve();
  }
  const root = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  const inc = (fieldPath) => ({ fieldPath, increment: { integerValue: "1" } });
  const writes = [];
  if (fields.length) writes.push({ transform: { document: `${root}/visits/${day}`, fieldTransforms: fields.map(inc) } });
  if (productId) {
    writes.push({
      update: { name: `${root}/productViews/${day}_${productId}`, fields: { day: { stringValue: day }, productId: { integerValue: String(productId) } } },
      updateMask: { fieldPaths: ["day", "productId"] },
      updateTransforms: [inc("count")],
    });
  }
  const commit = (w) => fetch(`https://firestore.googleapis.com/v1/${root}:commit?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: w }),
    keepalive: true,
  });
  const jobs = [];
  if (writes.length) jobs.push(commit(writes));
  if (extra.length) jobs.push(commit([{ transform: { document: `${root}/visits/${day}`, fieldTransforms: extra.map(inc) } }]));
  return Promise.all(jobs);
}

// مسار الشراء: كل زائر بيتعد مرة واحدة في اليوم لكل خطوة (ضاف للسلة، دخل صفحة الدفع)
function countFunnel(event) {
  try {
    const step = { add_to_cart: "carts", begin_checkout: "checkouts" }[event];
    if (!step || navigator.webdriver || store.get(IS_ADMIN_BROWSER, false)) return;
    const log = store.get(VISIT_LOG, null);
    if (!log || log.day !== cairoDay()) return; // trackVisit بيسجّل اليوم الأول
    log.steps = log.steps || [];
    if (log.steps.includes(step)) return;
    log.steps.push(step);
    store.set(VISIT_LOG, log);
    countVisit([step], null).catch((err) => console.warn("funnel", err));
  } catch (err) {
    console.warn("funnel", err);
  }
}

(function trackVisit() {
  try {
    if (navigator.webdriver || store.get(IS_ADMIN_BROWSER, false)) return;
    const day = cairoDay();
    let log = store.get(VISIT_LOG, null);
    const fields = [];
    const src = detectSource();
    if (src !== "direct") store.set(SOURCE_KEY, { src, at: Date.now() });
    if (log?.day !== day) {
      log = { day, seen: [] };
      fields.push("visitors", "src_" + src);
      if (!store.get(FIRST_SEEN, null)) {
        store.set(FIRST_SEEN, day);
        fields.push("newVisitors");
      }
      fields.push(matchMedia("(max-width: 900px)").matches ? "mobile" : "desktop");
    }
    const pid = document.documentElement.dataset.product ? Number(document.documentElement.dataset.product)
      : /product\.html$/.test(location.pathname) ? Number(new URLSearchParams(location.search).get("id")) : null;
    const productId = pid > 0 && !log.seen.includes(pid) ? pid : null;
    if (productId) {
      if (!log.seen.length) fields.push("viewers"); // أول منتج يشوفه النهارده
      log.seen.push(productId);
    }
    if (!fields.length && !productId) return;
    // بنسجّل إنه اتعد الأول، عشان لو الطلب فشل مانعدّش مرتين
    store.set(VISIT_LOG, log);
    countVisit(fields, productId).catch((err) => console.warn("visit", err));
  } catch (err) {
    console.warn("visit", err);
  }
})();
