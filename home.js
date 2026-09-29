// ============ الصفحة الرئيسية ============
const params = new URLSearchParams(location.search);
let filter = params.get("cat") || "all";
let query = params.get("q") || "";
const grid = $("#productsGrid");

function renderProducts() {
  const q = query.trim().toLowerCase();
  const list = shopProducts().filter((p) =>
    (filter === "all" || p.cat === filter) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  );
  grid.innerHTML = list.map(productCard).join("");
  $("#emptyState").hidden = list.length > 0;
}

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
  stopStrip = watchMyOrders(user.phone, renderOrderStrip, (err) => console.warn("order strip", err));
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
