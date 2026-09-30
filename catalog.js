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
  phones: "rgba(0,212,255,.35)", laptops: "rgba(10,132,255,.35)", audio: "rgba(124,92,255,.35)",
  wearables: "rgba(251,191,36,.25)", gaming: "rgba(255,77,109,.3)", accessories: "rgba(34,197,94,.28)",
};
const CATEGORY_ICONS = { phones: "📱", laptops: "💻", audio: "🎧", wearables: "⌚", gaming: "🎮", accessories: "🔌" };

const discount = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);
const isForSale = (p) => p.active !== false;
const inStock = (p) => (p.stock ?? 1) > 0;
const shopProducts = () => products.filter(isForSale);
const productTag = (p) => p.tag || (discount(p) ? `-${discount(p)}%` : "");

// بيكمّل أي بيانات ناقصة عشان باقي الموقع يشتغل من غير مشاكل
function normalizeProduct(p) {
  return {
    brand: "", desc: "", highlights: [], options: {}, specs: {}, images: [], old: null, tag: "",
    rating: 5, reviews: 0, stock: 0, active: true,
    ...p,
    id: Number(p.id),
    icon: p.icon || CATEGORY_ICONS[p.cat] || "📦",
    tint: p.tint || CATEGORY_TINTS[p.cat] || "rgba(10,132,255,.3)",
  };
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
  if (products === DEFAULT_PRODUCTS) setProducts(DEFAULT_PRODUCTS);
})();

function USE_FIREBASE_CATALOG() {
  return !!FIREBASE_CONFIG;
}

let catalogLoaded = false; // اتجابت أحدث نسخة (أو فشلت) ولا لسه
async function refreshCatalog() {
  try {
    await loadLatestCatalog();
  } finally {
    catalogLoaded = true;
    document.dispatchEvent(new Event("catalogloaded"));
  }
}

async function loadLatestCatalog() {
  let list = null;
  if (USE_FIREBASE_CATALOG()) {
    try {
      list = await fetchRemoteProducts();
      store.set(CATALOG_CACHE, { at: Date.now(), items: list });
    } catch (err) {
      console.warn("catalog", err);
      return;
    }
  } else {
    list = store.get(LOCAL_PRODUCTS, null);
  }
  const changed = list?.length ? setProducts(list) : setProducts(DEFAULT_PRODUCTS);
  if (changed) document.dispatchEvent(new Event("productschange"));
}

// ============ الصور المرفوعة (fs:...) ============
const TRANSPARENT = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const imageCache = new Map();

function fetchStoredImage(key) {
  if (imageCache.has(key)) return imageCache.get(key);
  const job = (async () => {
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

// أي <img data-fs="..."> بيظهر في الصفحة بيتحمّل لوحده
function hydrateImage(img) {
  if (img.dataset.loading) return;
  img.dataset.loading = "1";
  fetchStoredImage(img.dataset.fs)
    .then((src) => { img.src = src; img.classList.add("is-loaded"); })
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
