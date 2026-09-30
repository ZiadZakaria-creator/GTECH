// ============ عدّاد الزوار ============
// كل زائر بيتعد مرة واحدة في اليوم (visits/{اليوم})، وكل منتج بيتعد مرة واحدة لكل زائر في اليوم
// (productViews/{اليوم_رقم المنتج}). من غير أي بيانات شخصية، ومن غير تحميل Firebase SDK.
// لوحة التحكم بتقرا الأرقام دي في تاب "الزوار" (admin-visits.js)

const VISIT_LOG = "gtech-visit-log";   // { day, seen: [أرقام المنتجات اللي اتعدّت النهارده] }
const FIRST_SEEN = "gtech-first-seen";  // أول مرة الزائر ده دخل
const IS_ADMIN_BROWSER = "gtech-admin-browser"; // متصفح صاحب المتجر مايتعدّش
const VISITS_LOCAL = "gtech-visits-local"; // الوضع التجريبي

function countVisit(fields, productId) {
  const day = cairoDay();
  if (!FIREBASE_CONFIG) {
    const all = store.get(VISITS_LOCAL, { days: {}, products: {} });
    const d = (all.days[day] ||= {});
    fields.forEach((f) => { d[f] = (d[f] || 0) + 1; });
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
  return fetch(`https://firestore.googleapis.com/v1/${root}:commit?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
    keepalive: true,
  });
}

(function trackVisit() {
  try {
    if (navigator.webdriver || store.get(IS_ADMIN_BROWSER, false)) return;
    const day = cairoDay();
    let log = store.get(VISIT_LOG, null);
    const fields = [];
    if (log?.day !== day) {
      log = { day, seen: [] };
      fields.push("visitors");
      if (!store.get(FIRST_SEEN, null)) {
        store.set(FIRST_SEEN, day);
        fields.push("newVisitors");
      }
      fields.push(matchMedia("(max-width: 900px)").matches ? "mobile" : "desktop");
    }
    const pid = document.documentElement.dataset.product ? Number(document.documentElement.dataset.product)
      : /product\.html$/.test(location.pathname) ? Number(new URLSearchParams(location.search).get("id")) : null;
    const productId = pid > 0 && !log.seen.includes(pid) ? pid : null;
    if (productId) log.seen.push(productId);
    if (!fields.length && !productId) return;
    // بنسجّل إنه اتعد الأول، عشان لو الطلب فشل مانعدّش مرتين
    store.set(VISIT_LOG, log);
    countVisit(fields, productId).catch((err) => console.warn("visit", err));
  } catch (err) {
    console.warn("visit", err);
  }
})();
