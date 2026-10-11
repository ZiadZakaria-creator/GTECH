// ============ المنتجات (الكتالوج) ============
// المنتجات بتتقري من Firestore (اللي صاحب المتجر بيعدّلها من لوحة التحكم).
// - أول ما الصفحة تفتح بنعرض آخر نسخة محفوظة في المتصفح عشان السرعة
// - وبعدين بنجيب أحدث نسخة، ولو فيه تغيير الصفحة بتتحدث لوحدها (حدث productschange)
// - لو لسه مفيش منتجات في Firestore بنستخدم المنتجات الافتراضية اللي في data.js
//
// الصور: إما مسار عادي (images/1-1.jpg) أو "fs:<id>" = صورة مرفوعة ومتخزنة في Firestore

const CATALOG_CACHE = "gtech-catalog";
const LOCAL_PRODUCTS = "gtech-products-local"; // الوضع التجريبي من غير Firebase
const LOCAL_IMAGES = "gtech-product-images-local";

const CATEGORY_TINTS = {
  storage: "rgba(251,191,36,.25)", keyboards: "rgba(10,132,255,.35)", mice: "rgba(34,197,94,.28)",
  audio: "rgba(124,92,255,.35)", earphones: "rgba(236,72,153,.3)", speakers: "rgba(45,212,191,.3)", monitors: "rgba(0,212,255,.35)", gpus: "rgba(255,77,109,.3)", controllers: "rgba(255,159,10,.3)",
};
// لون كل قسم (أيقونات الأقسام وإضاءة كروت المنتجات)
const CATEGORY_COLORS = { storage: "#fbbf24", keyboards: "#3b9bff", mice: "#22c55e", audio: "#a78bfa", earphones: "#ec4899", speakers: "#2dd4bf", monitors: "#00d4ff", gpus: "#ff4d6d", controllers: "#ff9f0a" };
const CATEGORY_ICONS = { storage: "💾", keyboards: "⌨️", mice: "🖱️", audio: "🎧", earphones: "🎵", speakers: "🔊", monitors: "🖥️", gpus: "🎮", controllers: "🕹️" };

// المنتجات القديمة (قبل الأقسام الجديدة) بيتعرف قسمها من اسمها لحد ما تتعدّل من اللوحة
const CATEGORY_GUESS = [
  ["controllers", /دراع|ذراع|يد تحكم|controller|gamepad|جيم ?باد/i],
  ["speakers", /سبيكر|سماعة (?:محمولة|بلوتوث محمولة)|speaker|soundbar|ساوند ?بار/i],
  ["mice", /ماوس|mouse/i], ["keyboards", /كيبورد|keyboard/i], ["gpus", /كارت شاشة|كروت شاشة|rtx|gtx|radeon|graphics card/i],
  ["monitors", /شاشة|شاشه|monitor/i], ["storage", /هارد|ssd|hdd|nvme|فلاشة|flash/i],
  ["earphones", /إيربودز|ايربودز|إيربدز|earbud|earphone|airpods|buds|tws|in-ear|سماعة (?:سلك|أذن|اذن|بلوتوث)/i],
  ["audio", /سماع|headset|headphone/i],
];
function productCategory(p) {
  if (categories[p.cat]) return p.cat;
  const text = `${p.name || ""} ${p.specs?.["النوع"] || ""}`;
  return CATEGORY_GUESS.find(([, re]) => re.test(text))?.[0] || p.cat || "";
}
const categoryLabel = (cat) => categories[cat] || "منتجات";

const discount = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);
const isForSale = (p) => p.active !== false;
const inStock = (p) => (p.stock ?? 1) > 0;
const shopProducts = () => products.filter(isForSale);
const productTag = (p) => p.tag || (discount(p) ? `-${discount(p)}%` : "");

// بيكمّل أي بيانات ناقصة عشان باقي الموقع يشتغل من غير مشاكل
// عرض القسم (CATEGORY_SALES في data.js) بيتطبق على المتجر بس — اللوحة لازم تشوف وتحفظ السعر الأصلي
const IN_ADMIN = /\/admin\//.test(location.pathname);
const categorySale = (cat) => (IN_ADMIN ? 0 : Number(CATEGORY_SALES[cat]) || 0);
function applyCategorySale(p) {
  const pct = categorySale(p.cat);
  if (!pct || !(p.price > 0)) return p;
  return { ...p, price: Math.round(p.price * (1 - pct / 100)), old: p.price, tag: `-${pct}%`, sale: pct };
}

function normalizeProduct(p) {
  return applyCategorySale({
    brand: "", desc: "", highlights: [], options: {}, specs: {}, images: [], old: null, tag: "",
    rating: 5, reviews: 0, stock: 0, active: true,
    ...p,
    id: Number(p.id),
    cat: productCategory(p),
    icon: p.icon || CATEGORY_ICONS[productCategory(p)] || "📦",
    tint: p.tint || CATEGORY_TINTS[productCategory(p)] || "rgba(10,132,255,.3)",
  });
}

function setProducts(list) {
  const next = list.map(normalizeProduct).sort((a, b) => a.id - b.id);
  if (JSON.stringify(next) === JSON.stringify(products)) return false;
  products = next;
  return true;
}

// ============ قراءة Firestore عن طريق REST (خفيف ومش محتاج SDK) ============
const FS_BASE = FIREBASE_CONFIG
  ? `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`
  : null;

function fromFirestore(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestore);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFirestore(x)]));
  return null;
}
const docToObject = (doc) => fromFirestore({ mapValue: { fields: doc.fields || {} } });

async function fetchRemoteProducts() {
  const res = await fetch(`${FS_BASE}/products?pageSize=300&key=${FIREBASE_CONFIG.apiKey}`);
  if (!res.ok) throw new Error("products " + res.status);
  return ((await res.json()).documents || []).map(docToObject);
}

// ============ تحميل الكتالوج ============
(function initCatalog() {
  if (USE_FIREBASE_CATALOG()) {
    const cached = store.get(CATALOG_CACHE, null);
    if (cached?.items?.length) setProducts(cached.items);
  } else {
    const local = store.get(LOCAL_PRODUCTS, null);
    if (local?.length) setProducts(local);
  }
  // المتجر الحقيقي (Firebase) مايعرضش المنتجات التجريبية أبداً، حتى لو التحميل اتأخر أو فشل
  if (products === DEFAULT_PRODUCTS) setProducts(USE_FIREBASE_CATALOG() ? [] : DEFAULT_PRODUCTS);
})();

function USE_FIREBASE_CATALOG() {
  return !!FIREBASE_CONFIG;
}

let catalogLoaded = false; // اتجابت أحدث نسخة (أو فشلت) ولا لسه
let catalogFailed = false; // مفيش نت أو Firestore مردّش
async function refreshCatalog() {
  try {
    await loadLatestCatalog();
  } finally {
    catalogLoaded = true;
    document.dispatchEvent(new Event("catalogloaded"));
  }
}

// الكتالوج المتحفظ لسه طازة (أقل من 5 دقايق) ← مش بنقرا 70 منتج من Firestore تاني مع كل صفحة
const CATALOG_FRESH_MS = 5 * 60 * 1000;
async function loadLatestCatalog() {
  let list = null;
  if (USE_FIREBASE_CATALOG()) {
    const cached = store.get(CATALOG_CACHE, null);
    if (!IN_ADMIN && cached?.items?.length && Date.now() - (cached.at || 0) < CATALOG_FRESH_MS) return;
    try {
      list = await fetchRemoteProducts();
      store.set(CATALOG_CACHE, { at: Date.now(), items: list });
    } catch (err) {
      console.warn("catalog", err);
      // Firestore مردّش (الحصة خلصت مثلاً) ← النسخة الثابتة اللي اتعملت وقت النشر (catalog.json)
      try {
        const res = await fetch("catalog.json", { cache: "no-cache" });
        if (!res.ok) throw new Error("catalog.json " + res.status);
        list = (await res.json()).items;
      } catch (err2) {
        console.warn("catalog fallback", err2);
        catalogFailed = true;
        return;
      }
    }
  } else {
    list = store.get(LOCAL_PRODUCTS, null);
  }
  const changed = list?.length ? setProducts(list) : setProducts(USE_FIREBASE_CATALOG() ? [] : DEFAULT_PRODUCTS);
  if (changed) document.dispatchEvent(new Event("productschange"));
}

// ============ الصور المرفوعة (fs:...) ============
const TRANSPARENT = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const imageCache = new Map();

// خريطة الصور اللي اتحولت ملفات ثابتة وقت النشر (tools/build-seo.mjs ← p/img/map.json):
// الصورة بتتحمّل من GitHub Pages ومش بتبقى قراءة من Firestore (الحصة المجانية 50 ألف قراءة في اليوم)
let staticImagesJob = null;
const staticImages = () => (staticImagesJob ||= fetch("p/img/map.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

function fetchStoredImage(key) {
  if (imageCache.has(key)) return imageCache.get(key);
  const job = (async () => {
    if (!IN_ADMIN) {
      const file = (await staticImages())[key];
      if (file) return "p/img/" + file;
    }
    try {
      const hit = sessionStorage.getItem("img:" + key);
      if (hit) return hit;
    } catch {}
    let data;
    if (USE_FIREBASE_CATALOG()) {
      const res = await fetch(`${FS_BASE}/productImages/${encodeURIComponent(key)}?key=${FIREBASE_CONFIG.apiKey}`);
      if (!res.ok) throw new Error("image " + res.status);
      data = docToObject(await res.json()).data;
    } else {
      data = store.get(LOCAL_IMAGES, {})[key];
    }
    if (!data) throw new Error("missing image");
    try { sessionStorage.setItem("img:" + key, data); } catch {}
    return data;
  })();
  imageCache.set(key, job);
  job.catch(() => imageCache.delete(key));
  return job;
}

// لو أركان الصورة كلها بنفس اللون (صورة منتج على خلفية سادة) بنرجّع اللون ده،
// عشان الصورة تتعرض كاملة من غير قص حتى لو اترفعت قبل ما اللوحة تظبطها
const plainBgCache = new Map();
function detectPlainBackground(src) {
  if (plainBgCache.has(src)) return plainBgCache.get(src);
  const job = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        const n = 24, c = document.createElement("canvas");
        c.width = c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(im, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        const px = (x, y) => { const i = (y * n + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
        const pts = [px(0, 0), px(1, 1), px(n - 1, 0), px(n - 2, 1), px(0, n - 1), px(1, n - 2), px(n - 1, n - 1), px(n - 2, n - 2)]; // الأركان بس (السلك ممكن يوصل لنص الحافة)
        const [r, g, b] = pts[0];
        const same = pts.every(([r2, g2, b2]) => Math.abs(r2 - r) + Math.abs(g2 - g) + Math.abs(b2 - b) <= 36);
        resolve(same ? `rgb(${r},${g},${b})` : null);
      } catch {
        resolve(null);
      }
    };
    im.onerror = () => resolve(null);
    im.src = src;
  });
  plainBgCache.set(src, job);
  return job;
}

// أي <img data-fs="..."> بيظهر في الصفحة بيتحمّل لوحده
function hydrateImage(img) {
  if (img.dataset.loading) return;
  img.dataset.loading = "1";
  fetchStoredImage(img.dataset.fs)
    .then((src) => {
      // صور المنتجات على خلفية سادة (متجهزة في اللوحة) بتظهر كاملة على نفس لون خلفيتها
      const fit = /^cfit-([0-9a-f]{6})-/.exec(img.dataset.fs);
      if (fit) Object.assign(img.style, { objectFit: "contain", background: "#" + fit[1] });
      else detectPlainBackground(src).then((bg) => { if (bg) Object.assign(img.style, { objectFit: "contain", background: bg }); });
      img.src = src;
      img.classList.add("is-loaded");
    })
    .catch(() => imgFallback(img));
}
function hydrateAll(root = document) {
  root.querySelectorAll?.("img[data-fs]").forEach(hydrateImage);
}
new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
  if (n.nodeType !== 1) return;
  if (n.matches("img[data-fs]")) hydrateImage(n);
  hydrateAll(n);
}))).observe(document.documentElement, { childList: true, subtree: true });

// src للصورة: مسار عادي أو صورة مرفوعة بتتحمّل بعدين
function imageAttrs(src) {
  return src?.startsWith("fs:") ? `src="${TRANSPARENT}" data-fs="${escapeHtml(src.slice(3))}"` : `src="${escapeHtml(src)}"`;
}

// صورة المنتج: أول صورة، ولو مفيش (أو الصورة مفتحتش) بيظهر الإيموجي
function productVisual(p, src = p.images?.[0], attrs = "") {
  return src
    ? `<img ${imageAttrs(src)} alt="${escapeHtml(p.name)}" loading="lazy" data-icon="${p.icon}" onerror="imgFallback(this)" ${attrs}>`
    : `<span ${attrs}>${p.icon}</span>`;
}
function imgFallback(img) {
  const span = document.createElement("span");
  span.textContent = img.dataset.icon || "📦";
  if (img.id) span.id = img.id;
  span.className = img.className;
  img.replaceWith(span);
}

document.addEventListener("DOMContentLoaded", () => hydrateAll());
refreshCatalog();

// مدة الضمان: اللي صاحب المتجر كتبه للمنتج، ولو فاضي: سنة للإكسسوارات وسنتين لباقي الأقسام
const warrantyText = (p) => String(p.warranty || "").trim() || (p.cat === "accessories" ? "سنة" : "سنتين");
const hasWarranty = (p) => !/^(لا|بدون|مفيش|no|none|0)/i.test(warrantyText(p));
