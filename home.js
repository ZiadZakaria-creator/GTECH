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
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
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

$$("[data-filter].category, [data-jump]").forEach((el) =>
  el.addEventListener("click", () => {
    setFilter(el.dataset.filter || el.dataset.jump);
    $("#products").scrollIntoView({ behavior: "smooth" });
  })
);

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

// ============ العد التنازلي ============
const offerEnd = Date.now() + ((3 * 24 + 7) * 3600 + 42 * 60) * 1000;
function tick() {
  const s = Math.max(0, Math.floor((offerEnd - Date.now()) / 1000));
  const parts = { cdDays: Math.floor(s / 86400), cdHours: Math.floor((s % 86400) / 3600), cdMins: Math.floor((s % 3600) / 60), cdSecs: s % 60 };
  for (const [id, v] of Object.entries(parts)) $("#" + id).textContent = String(v).padStart(2, "0");
}
tick();
setInterval(tick, 1000);

// ============ عداد الإحصائيات ============
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = +el.dataset.count;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 1600);
      el.textContent = num(Math.floor(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    statsObserver.unobserve(el);
  });
});
$$("[data-count]").forEach((el) => statsObserver.observe(el));

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
