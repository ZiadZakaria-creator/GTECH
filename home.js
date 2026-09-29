// ============ الصفحة الرئيسية ============
const params = new URLSearchParams(location.search);
let filter = params.get("cat") || "all";
let query = params.get("q") || "";
const grid = $("#productsGrid");

function renderProducts() {
  const q = query.trim().toLowerCase();
  const list = products.filter((p) =>
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

reveal(".section__head, .category, .offer, .mini-offer, .review, .newsletter, .feature");
setFilter(filter);
