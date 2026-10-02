// ============ الصفحة الرئيسية ============
const params = new URLSearchParams(location.search);
let filter = params.get("cat") || "all";
let query = params.get("q") || "";
const grid = $("#productsGrid");

// ============ الفلاتر المتقدمة ============
// السعر، الماركة، الرام، المساحة، المتوفر بس، والترتيب
const filters = { min: "", max: "", brands: new Set(), ram: new Set(), storage: new Set(), inStockOnly: false, sort: "" };

const lastNumber = (str) => { const m = String(str).match(/[\d.]+(?!.*[\d.])/); return m ? Number(m[0]) : null; };
// "12 جيجا رام" ← 12 جيجا
function ramValues(p) {
  const spec = p.specs["الرام"] || p.specs["الذاكرة"] || "";
  const n = parseFloat(toLatinDigits(String(spec)));
  const fromOpts = (p.options["السعة"] || []).map((o) => /رام/.test(o) ? parseFloat(toLatinDigits(o)) : null);
  return [...new Set([n, ...fromOpts].filter((x) => x > 0 && x <= 128))].map((x) => `${x} جيجا`);
}
// "256 جيجا" / "1 تيرا" / "16 رام / 512 SSD" ← المساحة
function storageValues(p) {
  const raw = [...(p.options["السعة"] || p.options["المساحة"] || []), p.specs["التخزين"] || p.specs["المساحة"] || ""].filter(Boolean);
  return [...new Set(raw.map((v) => {
    const s = toLatinDigits(String(v));
    const n = lastNumber(s);
    if (!n) return null;
    return /تيرا|TB/i.test(s) ? `${n} تيرا` : `${n} جيجا`;
  }).filter(Boolean))];
}
const sizeRank = (v) => parseFloat(v) * (v.includes("تيرا") ? 1024 : 1);

function baseList() {
  const q = query.trim().toLowerCase();
  return shopProducts().filter((p) =>
    (filter === "all" || p.cat === filter) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  );
}

function applyFilters(list) {
  const min = Number(toLatinDigits(filters.min)) || 0;
  const max = Number(toLatinDigits(filters.max)) || Infinity;
  const out = list.filter((p) =>
    p.price >= min && p.price <= max &&
    (!filters.brands.size || filters.brands.has(p.brand.toUpperCase())) &&
    (!filters.ram.size || ramValues(p).some((v) => filters.ram.has(v))) &&
    (!filters.storage.size || storageValues(p).some((v) => filters.storage.has(v))) &&
    (!filters.inStockOnly || inStock(p))
  );
  const sorters = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    discount: (a, b) => discount(b) - discount(a),
    newest: (a, b) => b.id - a.id,
  };
  return filters.sort ? [...out].sort(sorters[filters.sort]) : out;
}

const activeFilterCount = () =>
  (filters.min ? 1 : 0) + (filters.max ? 1 : 0) + filters.brands.size + filters.ram.size + filters.storage.size + (filters.inStockOnly ? 1 : 0);

function chipGroup(title, key, values) {
  if (values.length < 2 && !filters[key].size) return "";
  return `
    <fieldset class="fp-group">
      <legend>${title}</legend>
      <div class="fp-chips">${values.map((v) => `
        <label class="fp-chip"><input type="checkbox" data-facet="${key}" value="${escapeHtml(v)}" ${filters[key].has(v) ? "checked" : ""}/><span>${escapeHtml(v)}</span></label>`).join("")}
      </div>
    </fieldset>`;
}

function renderFilterPanel(list) {
  const brands = [...new Set(list.map((p) => p.brand.toUpperCase()).filter(Boolean))].sort();
  const rams = [...new Set(list.flatMap(ramValues))].sort((a, b) => sizeRank(a) - sizeRank(b));
  const storages = [...new Set(list.flatMap(storageValues))].sort((a, b) => sizeRank(a) - sizeRank(b));
  // اللي متعلّم ومش موجود في القسم ده يفضل ظاهر عشان يتشال
  filters.brands.forEach((v) => brands.includes(v) || brands.push(v));
  filters.ram.forEach((v) => rams.includes(v) || rams.push(v));
  filters.storage.forEach((v) => storages.includes(v) || storages.push(v));
  const prices = list.map((p) => p.price);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const focused = document.activeElement?.id;
  $("#filterPanel").innerHTML = `
    <fieldset class="fp-group">
      <legend>السعر (ج.م)</legend>
      <div class="fp-price">
        <input type="text" inputmode="numeric" id="fpMin" placeholder="من ${num(lo)}" value="${escapeHtml(filters.min)}" aria-label="أقل سعر" />
        <span>—</span>
        <input type="text" inputmode="numeric" id="fpMax" placeholder="لحد ${num(hi)}" value="${escapeHtml(filters.max)}" aria-label="أعلى سعر" />
      </div>
    </fieldset>
    ${chipGroup("الماركة", "brands", brands)}
    ${chipGroup("الرام", "ram", rams)}
    ${chipGroup("المساحة", "storage", storages)}
    <div class="fp-foot">
      <label class="fp-switch"><input type="checkbox" id="fpStock" ${filters.inStockOnly ? "checked" : ""}/> <span>المتوفر بس</span></label>
      <button type="button" class="link-btn" data-clear-filters ${activeFilterCount() ? "" : "hidden"}>امسح الفلاتر</button>
    </div>`;
  if (focused === "fpMin" || focused === "fpMax") {
    const el = $("#" + focused);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
}

function renderProducts() {
  const base = baseList();
  const list = applyFilters(base);
  grid.innerHTML = list.map(productCard).join("");
  $("#emptyState").hidden = list.length > 0;
  // قسم لسه مفيهوش منتجات خالص (مش فلتر أو بحث)
  const soonCat = !list.length && filter !== "all" && !shopProducts().some((p) => p.cat === filter);
  $("#emptyText").textContent = !catalogLoaded && !products.length ? "⏳ جاري تحميل المنتجات..." : catalogFailed && !products.length ? "📡 مقدرناش نحمّل المنتجات — اتأكد من النت وجرّب تاني" : soonCat ? `📦 قسم ${categoryLabel(filter)} هينزل فيه منتجات قريب جداً — تابعنا!` : "لا توجد منتجات مطابقة لبحثك 🔍";
  const count = activeFilterCount();
  $("#filterCount").hidden = !count;
  $("#filterCount").textContent = num(count);
  $("#filterResult").textContent = `${num(list.length)} منتج`;
  $$("[data-clear-filters]").forEach((b) => { b.hidden = !count; });
  renderFilterPanel(base);
}

$("#filterToggle").addEventListener("click", () => {
  const panel = $("#filterPanel");
  panel.hidden = !panel.hidden;
  $("#filterToggle").setAttribute("aria-expanded", String(!panel.hidden));
  $("#filterToggle").classList.toggle("active", !panel.hidden);
});
$("#sortSel").addEventListener("change", (e) => { filters.sort = e.target.value; renderProducts(); });
$("#filterPanel").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.facet) filters[t.dataset.facet][t.checked ? "add" : "delete"](t.value);
  else if (t.id === "fpStock") filters.inStockOnly = t.checked;
  else return;
  renderProducts();
});
let priceTimer = null;
$("#filterPanel").addEventListener("input", (e) => {
  if (e.target.id !== "fpMin" && e.target.id !== "fpMax") return;
  filters[e.target.id === "fpMin" ? "min" : "max"] = e.target.value.replace(/[^\d٠-٩]/g, "");
  clearTimeout(priceTimer);
  priceTimer = setTimeout(renderProducts, 350);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-clear-filters]")) return;
  Object.assign(filters, { min: "", max: "", inStockOnly: false });
  ["brands", "ram", "storage"].forEach((k) => filters[k].clear());
  renderProducts();
});

function setFilter(value) {
  filter = value;
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.filter === value));
  renderProducts();
}

$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) setFilter(tab.dataset.filter);
});

// ============ الأقسام: عدد المنتجات الحقيقي في كل قسم ============
function renderCategories() {
  const counts = {};
  shopProducts().forEach((p) => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  $("#categoryCards").innerHTML = Object.entries(categories).map(([k, label]) => `
    <button class="category" data-filter="${k}">
      <span class="category__icon">${CATEGORY_ICONS[k]}</span><h3>${label}</h3>
      <small>${counts[k] ? `${num(counts[k])} منتج` : "قريباً"}</small>
    </button>`).join("");
  $("#tabs").innerHTML = `<button class="tab" data-filter="all">الكل</button>` +
    Object.entries(categories).map(([k, label]) => `<button class="tab" data-filter="${k}">${label}</button>`).join("");
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.filter === filter));
}
renderCategories();
document.addEventListener("productschange", renderCategories);

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-filter].category, [data-jump]");
  if (!el) return;
  setFilter(el.dataset.filter || el.dataset.jump);
  $("#products").scrollIntoView({ behavior: "smooth" });
});

$("#searchInput").addEventListener("input", (e) => {
  query = e.target.value;
  if (query) setFilter("all");
  else renderProducts();
});
$(".search").addEventListener("submit", () => $("#products").scrollIntoView({ behavior: "smooth" }));

nav.addEventListener("click", (e) => {
  if (e.target.tagName !== "A") return;
  $$(".nav a").forEach((a) => a.classList.remove("active"));
  e.target.classList.add("active");
});

// ============ عرض الإيربودز (CATEGORY_SALES في data.js) ============
const OFFER_CAT = "earphones";

function renderOffer() {
  const pct = categorySale(OFFER_CAT);
  const list = shopProducts().filter((p) => p.cat === OFFER_CAT && inStock(p));
  if (pct) {
    $("#offerTag").textContent = `-${num(pct)}%`;
    $("#offerPill").textContent = "🎧 عرض GTECH على الإيربودز";
  }
  if (!list.length) { $("#offerPrice").hidden = true; return; }
  const cheapest = list.reduce((a, b) => (b.price < a.price ? b : a));
  $("#offerPrice").hidden = false;
  $("#offerPrice").innerHTML = `<small>تبدأ من</small> <b>${fmt(cheapest.price)}</b>${cheapest.old ? ` <del>${fmt(cheapest.old)}</del>` : ""}`;
}
renderOffer();
document.addEventListener("productschange", renderOffer);
document.addEventListener("catalogloaded", renderOffer);

// ============ باكدجات السيت أب ============
function renderBundles() {
  const list = (typeof BUNDLES === "undefined" ? [] : BUNDLES).filter(bundleAvailable);
  $("#bundles").hidden = !list.length;
  $("#bundleCards").innerHTML = list.map((b) => {
    const ps = bundleProducts(b);
    return `
      <article class="bundle card-box">
        <span class="bundle__tag">${b.tag}</span>
        <h3>${b.name}</h3>
        <p class="muted">${b.desc}</p>
        <div class="bundle__items">${ps.map((p) => `
          <a href="${productUrl(p.id)}" class="bundle__item">
            <span class="bundle__img">${productVisual(p)}</span>
            <small>${escapeHtml(p.name)}</small>
            <b>${fmt(p.price)}</b>
          </a>`).join('<span class="bundle__plus">+</span>')}
        </div>
        <div class="bundle__foot">
          <div class="bundle__price"><b>${fmt(bundlePrice(b))}</b><del>${fmt(bundleFull(b))}</del><span class="save">وفّر ${fmt(bundleFull(b) - bundlePrice(b))}</span></div>
          <button type="button" class="btn btn--primary" data-bundle="${b.id}">🛒 أضف الباكدج للسلة</button>
        </div>
      </article>`;
  }).join("");
}
$("#bundleCards").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-bundle]");
  if (btn) addBundle(btn.dataset.bundle);
});
renderBundles();
document.addEventListener("productschange", renderBundles);
document.addEventListener("catalogloaded", renderBundles);

// ============ المربعين اللي تحت العرض ============
// 1) عرض التطبيق (حقيقي: بيتحسب في صفحة الدفع) — 2) أرخص سعر في الماوسات والكيبوردات من المنتجات نفسها
function renderMiniOffers() {
  if (isStandalone()) {
    $("#appPromoText").textContent = "إنت فاتح من التطبيق ✅ الخصم والتوصيل المجاني هيتحسبوا لوحدهم على أول أوردر";
    $("#appPromoBtn").hidden = true;
  }
  const from = (cat) => {
    const prices = shopProducts().filter((p) => p.cat === cat && inStock(p)).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  };
  const mice = from("mice"), kb = from("keyboards");
  const parts = [mice && `ماوسات من <b>${fmt(mice)}</b>`, kb && `كيبوردات من <b>${fmt(kb)}</b>`].filter(Boolean);
  if (parts.length) $("#setupPromoText").innerHTML = parts.join(" · ");
  if (mice) $("#heroMiceFrom").textContent = `من ${fmt(mice)}`;
  $("#setupPromo").dataset.jump = mice || !kb ? "mice" : "keyboards";
}
renderMiniOffers();
document.addEventListener("productschange", renderMiniOffers);

if (query) {
  $("#searchInput").value = query;
  requestAnimationFrame(() => $("#products").scrollIntoView());
}

document.addEventListener("productschange", renderProducts);

reveal(".section__head, .category, .offer, .mini-offer, .review, .newsletter, .feature");
setFilter(filter);

// ============ شريط تتبع الطلب ============
// بيظهر للعميل اللي داخل وعنده طلب شغال، وبيتحدث لوحده لما حالته تتغير
const DISMISSED_KEY = "gtech-strip-dismissed"; // { orderId: الحالة اللي اتقفل عليها }
const RECENT_MS = 2 * 86400000; // الطلب اللي اتوصّل أو اتلغى بيفضل ظاهر يومين
let stopStrip = () => {};
let stripNotify = statusChangeNotifier();

function isActive(o) {
  if (["new", "confirmed", "shipped"].includes(o.status)) return true;
  return Date.now() - new Date(o.updatedAt || o.createdAt) < RECENT_MS;
}

function startOrderStrip() {
  stopStrip();
  stripNotify = statusChangeNotifier();
  $("#orderStrip").hidden = true;
  if (!user || !store.get(HAS_ORDERS_KEY, false)) return;
  stopStrip = watchMyOrders(myOrdersPhone(), renderOrderStrip, (err) => console.warn("order strip", err));
}

function renderOrderStrip(list) {
  const orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  stripNotify(orders);
  const dismissed = store.get(DISMISSED_KEY, {});
  const active = orders.filter((o) => isActive(o) && dismissed[o.id] !== o.status);
  const strip = $("#orderStrip");
  if (!active.length) return (strip.hidden = true);

  const o = active[0];
  const more = active.length - 1;
  strip.hidden = false;
  strip.innerHTML = `
    <div class="container order-strip__inner status-${o.status}">
      <div class="order-strip__info">
        <small>طلبك <b class="mono">${escapeHtml(o.id)}</b> · ${fmt(o.totals.total)}</small>
        <div class="order-strip__status">${trackPill(o.status)}</div>
        <p>${STATUS_HINTS[o.status]}</p>
      </div>
      <div class="order-strip__track">${trackBar(o.status)}</div>
      <div class="order-strip__actions">
        <a href="myorders.html" class="btn btn--primary btn--sm">تفاصيل الطلب${more ? ` <span class="order-strip__more">+${num(more)}</span>` : ""}</a>
        <button class="icon-btn order-strip__close" data-dismiss="${escapeHtml(o.id)}" data-status="${o.status}" aria-label="إخفاء">✕</button>
      </div>
    </div>`;
}

$("#orderStrip").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dismiss]");
  if (!b) {
    if (e.target.closest(".order-strip__info")) location.href = "myorders.html";
    return;
  }
  // بيتخفى لحد ما حالة الطلب تتغير
  const dismissed = store.get(DISMISSED_KEY, {});
  dismissed[b.dataset.dismiss] = b.dataset.status;
  store.set(DISMISSED_KEY, dismissed);
  startOrderStrip();
});

document.addEventListener("userchange", startOrderStrip);
startOrderStrip();

// ============ ستوري المنتجات جوه الموبايل اللي في الواجهة ============
// بيعرض أحدث المنتجات اللي ليها صور واحد ورا التاني زي الستوري، ولو مفيش صور بيفضل تصميم GTECH
const STORY_MS = 3800;
const socialIcons = {
  facebook: '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M16 3c.4 2.4 1.9 4 4 4.3v3.3a7.6 7.6 0 0 1-4-1.3v6.2A5.5 5.5 0 1 1 10.5 10v3.4a2.2 2.2 0 1 0 2.2 2.1V3H16z" fill="currentColor" stroke="none"/></svg>',
};
let storyItems = [], storyIndex = 0, storyTimer = null, storyPaused = false, storySig = "";

function renderPhoneStory() {
  const screen = $(".device__screen");
  if (!screen) return;
  const items = shopProducts().filter((p) => p.images?.length && inStock(p))
    .sort((a, b) => (discount(b) - discount(a)) || (b.id - a.id)).slice(0, 6);
  const sig = items.map((p) => `${p.id}:${p.price}:${p.images[0]}`).join("|");
  if (sig === storySig) return;
  storySig = sig;
  storyItems = items;
  clearTimeout(storyTimer);
  screen.querySelector(".story")?.remove();
  if (!items.length) {
    $(".hero__visual").classList.remove("story-on");
    return screen.classList.remove("has-story");
  }
  const links = Object.entries(typeof SOCIAL_LINKS === "object" ? SOCIAL_LINKS : {}).filter(([k, v]) => v && socialIcons[k]);
  screen.insertAdjacentHTML("beforeend", `
    <div class="story">
      <div class="story__bars">${items.map(() => "<i><b></b></i>").join("")}</div>
      <div class="story__head"><span class="story__avatar">G</span><b>GTECH</b><small>عروض النهارده</small></div>
      <div class="story__slides">${items.map((p, i) => {
        const off = discount(p);
        return `
        <a class="story__slide ${i === 0 ? "is-active" : ""}" href="${productUrl(p.id)}" tabindex="-1">
          <span class="story__img">${productVisual(p)}${off ? `<em class="story__off">-${num(off)}%</em>` : ""}</span>
          <span class="story__info">
            <small>${escapeHtml(p.brand)}</small>
            <b>${escapeHtml(p.name)}</b>
            <span class="story__price">${fmt(p.price)}${p.old ? ` <s>${fmt(p.old)}</s>` : ""}</span>
            <span class="story__cta">اطلبه دلوقتي ←</span>
          </span>
        </a>`;
      }).join("")}</div>
      <button type="button" class="story__nav story__nav--prev" aria-label="المنتج اللي فات"></button>
      <button type="button" class="story__nav story__nav--next" aria-label="المنتج اللي بعده"></button>
      ${links.length ? `<div class="story__social">${links.map(([k, v]) => `<a href="${escapeHtml(v)}" target="_blank" rel="noopener" aria-label="GTECH على ${k === "facebook" ? "فيسبوك" : "تيك توك"}">${socialIcons[k]}</a>`).join("")}</div>` : ""}
    </div>`);
  screen.classList.add("has-story");
  $(".hero__visual").removeAttribute("aria-hidden");
  $(".hero__visual").classList.add("story-on"); // الكروت العايمة بتتشال عشان ماتغطيش الستوري
  showStory(0);
}

function showStory(i) {
  const screen = $(".device__screen");
  const story = screen?.querySelector(".story");
  if (!story || !storyItems.length) return;
  storyIndex = (i + storyItems.length) % storyItems.length;
  story.querySelectorAll(".story__slide").forEach((s, n) => s.classList.toggle("is-active", n === storyIndex));
  story.querySelectorAll(".story__bars i").forEach((bar, n) => {
    bar.classList.toggle("is-done", n < storyIndex);
    bar.classList.remove("is-active");
    if (n === storyIndex) { void bar.offsetWidth; bar.classList.add("is-active"); }
  });
  story.style.setProperty("--story-ms", STORY_MS + "ms");
  clearTimeout(storyTimer);
  if (!storyPaused && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    storyTimer = setTimeout(() => showStory(storyIndex + 1), STORY_MS);
  }
}

document.addEventListener("click", (e) => {
  const nav = e.target.closest(".story__nav");
  if (!nav) return;
  showStory(storyIndex + (nav.classList.contains("story__nav--next") ? 1 : -1));
});
const visual = $(".hero__visual");
visual?.addEventListener("pointerenter", () => { storyPaused = true; clearTimeout(storyTimer); $(".story")?.classList.add("is-paused"); });
visual?.addEventListener("pointerleave", () => { storyPaused = false; $(".story")?.classList.remove("is-paused"); showStory(storyIndex); });
document.addEventListener("productschange", renderPhoneStory);
document.addEventListener("catalogloaded", renderPhoneStory);
renderPhoneStory();

// لو تحميل المنتجات فشل (من غير ما تتغير) نحدّث الرسالة بدل "جاري التحميل"
document.addEventListener("catalogloaded", () => { renderProducts(); renderCategories(); renderMiniOffers(); });
