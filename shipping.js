// ============ الشحن: سعر لكل محافظة + بوسطة ============
// صاحب المتجر بيظبط الأسعار من لوحة التحكم (تاب "الشحن")، وبتتحفظ في Firestore: settings/shipping
// وصفحة الدفع بتقراها من هناك. لو لسه متظبطتش بنستخدم الأسعار الافتراضية اللي تحت.

// المحافظات بالترتيب اللي بيظهر للعميل، وكود كل محافظة عند بوسطة، والسعر الافتراضي
const GOVERNORATES = [
  ["القاهرة", "EG-01", 60], ["الجيزة", "EG-25", 60], ["الإسكندرية", "EG-02", 70], ["القليوبية", "EG-06", 65],
  ["الدقهلية", "EG-05", 70], ["الشرقية", "EG-10", 70], ["الغربية", "EG-07", 70], ["المنوفية", "EG-09", 70],
  ["البحيرة", "EG-04", 70], ["كفر الشيخ", "EG-08", 70], ["دمياط", "EG-14", 70], ["بورسعيد", "EG-13", 75],
  ["الإسماعيلية", "EG-11", 75], ["السويس", "EG-12", 75], ["الفيوم", "EG-15", 80], ["بني سويف", "EG-16", 80],
  ["المنيا", "EG-19", 85], ["أسيوط", "EG-17", 90], ["سوهاج", "EG-18", 90], ["قنا", "EG-20", 95],
  ["الأقصر", "EG-22", 95], ["أسوان", "EG-21", 100], ["البحر الأحمر", "EG-23", 110], ["مطروح", "EG-28", 110],
  ["شمال سيناء", "EG-27", 120], ["جنوب سيناء", "EG-26", 120], ["الوادي الجديد", "EG-24", 120],
].map(([name, code, rate]) => ({ name, code, rate }));

const DEFAULT_SHIPPING = {
  rates: Object.fromEntries(GOVERNORATES.map((g) => [g.name, g.rate])), // null = مش بنوصّل للمحافظة دي
  freeOver: 1000, // 0 = مفيش شحن مجاني
  express: { price: 150, govs: ["القاهرة", "الجيزة"] },
};

// التوصيل حالياً للمحافظات دي بس — أي محافظة تانية بتتقفل في المتجر واللوحة مهما كان محفوظ.
// عشان ترجّع التوصيل لكل المحافظات خليها فاضية: []
const DELIVERY_ONLY = ["القاهرة", "الجيزة"];

const SHIPPING_CACHE = "gtech-shipping";
const SHIPPING_LOCAL = "gtech-shipping-local"; // الوضع التجريبي

function withShippingDefaults(s) {
  const out = {
    ...DEFAULT_SHIPPING,
    ...s,
    rates: { ...DEFAULT_SHIPPING.rates, ...(s?.rates || {}) },
    express: { ...DEFAULT_SHIPPING.express, ...(s?.express || {}) },
  };
  if (DELIVERY_ONLY.length) {
    Object.keys(out.rates).forEach((g) => { if (!DELIVERY_ONLY.includes(g)) out.rates[g] = null; });
    out.express = { ...out.express, govs: out.express.govs.filter((g) => DELIVERY_ONLY.includes(g)) };
  }
  return out;
}
const deliveryLocked = (gov) => DELIVERY_ONLY.length > 0 && !DELIVERY_ONLY.includes(gov);

let shippingSettings = withShippingDefaults(store.get(FIREBASE_CONFIG ? SHIPPING_CACHE : SHIPPING_LOCAL, null));

// بتجيب أحدث أسعار (من غير SDK) وبتبعت حدث shippingchange لو اتغيرت
async function loadShippingSettings() {
  if (!FIREBASE_CONFIG) return shippingSettings;
  try {
    const root = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
    const res = await fetch(`${root}/settings/shipping?key=${FIREBASE_CONFIG.apiKey}`);
    if (res.status === 404) return shippingSettings; // لسه محدش حفظ أسعار
    if (!res.ok) throw new Error("shipping " + res.status);
    const doc = await res.json();
    const fresh = fromFirestore({ mapValue: { fields: doc.fields || {} } });
    store.set(SHIPPING_CACHE, fresh);
    const next = withShippingDefaults(fresh);
    if (JSON.stringify(next) !== JSON.stringify(shippingSettings)) {
      shippingSettings = next;
      document.dispatchEvent(new Event("shippingchange"));
    }
  } catch (err) {
    console.warn("shipping", err);
  }
  return shippingSettings;
}

const deliversTo = (gov, s = shippingSettings) => typeof s.rates[gov] === "number";
const hasExpress = (gov, s = shippingSettings) => !!gov && s.express.price > 0 && s.express.govs.includes(gov);

// سعر الشحن: null لو المحافظة لسه متختارتش أو مش بنوصّلها
function shipCost(gov, method, subtotal, s = shippingSettings) {
  if (!gov || !deliversTo(gov, s)) return null;
  if (method === "express") return hasExpress(gov, s) ? s.express.price : null;
  return s.freeOver > 0 && subtotal >= s.freeOver ? 0 : s.rates[gov];
}

// ============ تتبع الشحنة ============
const CARRIERS = {
  bosta: { name: "بوسطة", track: (n) => `https://bosta.co/ar-eg/tracking-shipments?shipment-number=${encodeURIComponent(n)}` },
  other: { name: "شركة الشحن", track: () => "" },
};
const shipmentTrackUrl = (sh) => (sh?.trackingNumber ? (CARRIERS[sh.carrier] || CARRIERS.other).track(sh.trackingNumber) : "");
const carrierName = (sh) => sh?.carrierName || (CARRIERS[sh?.carrier] || CARRIERS.other).name;
