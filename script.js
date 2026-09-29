// ============ بيانات المنتجات ============
const products = [
  { id: 1, name: "آيفون 17 برو ماكس 256 جيجا", brand: "APPLE", cat: "phones", icon: "📱", price: 72999, old: 78999, rating: 4.9, reviews: 312, tag: "جديد", tint: "rgba(0,212,255,.35)" },
  { id: 2, name: "سامسونج جالاكسي S26 ألترا", brand: "SAMSUNG", cat: "phones", icon: "📱", price: 64999, old: 71999, rating: 4.8, reviews: 245, tag: "-10%", tint: "rgba(124,92,255,.35)" },
  { id: 3, name: "ماك بوك إير M4 – 13 بوصة", brand: "APPLE", cat: "laptops", icon: "💻", price: 58999, old: 64999, rating: 4.9, reviews: 188, tag: "-9%", tint: "rgba(10,132,255,.35)" },
  { id: 4, name: "لابتوب جيمنج ROG Strix G16", brand: "ASUS", cat: "laptops", icon: "💻", price: 79999, old: 99999, rating: 4.7, reviews: 96, tag: "-20%", tint: "rgba(255,77,109,.3)" },
  { id: 5, name: "سماعة سوني WH-1000XM6 لاسلكية", brand: "SONY", cat: "audio", icon: "🎧", price: 17499, old: 24999, rating: 4.8, reviews: 402, tag: "-30%", tint: "rgba(0,212,255,.3)" },
  { id: 6, name: "إيربودز برو 3 مع إلغاء الضوضاء", brand: "APPLE", cat: "audio", icon: "🎧", price: 12999, old: null, rating: 4.7, reviews: 530, tag: "جديد", tint: "rgba(34,197,94,.28)" },
  { id: 7, name: "ساعة جالاكسي واتش 8 كلاسيك", brand: "SAMSUNG", cat: "wearables", icon: "⌚", price: 14999, old: 16999, rating: 4.6, reviews: 150, tag: "-12%", tint: "rgba(124,92,255,.35)" },
  { id: 8, name: "أبل واتش سيريس 11 – 45 مم", brand: "APPLE", cat: "wearables", icon: "⌚", price: 21999, old: null, rating: 4.8, reviews: 207, tag: null, tint: "rgba(251,191,36,.25)" },
  { id: 9, name: "بلايستيشن 5 برو + ذراع إضافي", brand: "SONY", cat: "gaming", icon: "🎮", price: 38999, old: 42999, rating: 4.9, reviews: 610, tag: "-9%", tint: "rgba(10,132,255,.4)" },
  { id: 10, name: "نظارة الواقع الافتراضي Quest 3", brand: "META", cat: "gaming", icon: "🥽", price: 27999, old: 31999, rating: 4.5, reviews: 88, tag: "-12%", tint: "rgba(255,77,109,.28)" },
  { id: 11, name: "شاحن سريع 65 واط GaN", brand: "ANKER", cat: "accessories", icon: "🔌", price: 1299, old: 1799, rating: 4.7, reviews: 920, tag: "-28%", tint: "rgba(34,197,94,.28)" },
  { id: 12, name: "شاومي ريدمي نوت 15 برو", brand: "XIAOMI", cat: "phones", icon: "📱", price: 16999, old: 18999, rating: 4.6, reviews: 356, tag: "-10%", tint: "rgba(251,146,60,.3)" },
];

const fmt = (n) => n.toLocaleString("ar-EG") + " ج.م";
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ============ الحالة ============
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
let cart = store.get("gtech-cart", []);
let wishlist = store.get("gtech-wish", []);
let filter = "all";
let query = "";

// ============ عرض المنتجات ============
const grid = $("#productsGrid");
const heart = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.3-9.2C1.3 8.2 3.7 4.5 7.4 4.5c2 0 3.4 1 4.6 2.6 1.2-1.6 2.6-2.6 4.6-2.6 3.7 0 6.1 3.7 4.7 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const plus = '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.2"/><path d="M13 10v4M11 12h4"/></svg>';

function stars(r) {
  const full = Math.round(r);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function renderProducts() {
  const q = query.trim().toLowerCase();
  const list = products.filter((p) =>
    (filter === "all" || p.cat === filter) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  );

  grid.innerHTML = list.map((p, i) => `
    <article class="product" style="animation-delay:${i * 50}ms">
      <div class="product__media" style="--tint:${p.tint}">
        ${p.tag ? `<span class="product__tag ${p.tag === "جديد" ? "product__tag--new" : ""}">${p.tag}</span>` : ""}
        <button class="product__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heart}</button>
        <span>${p.icon}</span>
      </div>
      <div class="product__body">
        <span class="product__brand">${p.brand}</span>
        <h3 class="product__name">${p.name}</h3>
        <div class="product__rating">${stars(p.rating)} <small>(${p.reviews.toLocaleString("ar-EG")})</small></div>
        <div class="product__foot">
          <div class="product__price">
            ${p.old ? `<del>${fmt(p.old)}</del>` : ""}
            <b>${fmt(p.price)}</b>
          </div>
          <button class="add-btn" data-add="${p.id}" aria-label="أضف للسلة">${plus}</button>
        </div>
      </div>
    </article>`).join("");

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

// ============ السلة والمفضلة ============
function bump(el, value) {
  el.textContent = value.toLocaleString("ar-EG");
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * products.find((p) => p.id === i.id).price, 0);
  bump($("#cartCount"), count);
  $("#cartTotal").textContent = fmt(total);

  $("#cartItems").innerHTML = cart.length
    ? cart.map((i) => {
        const p = products.find((x) => x.id === i.id);
        return `
        <div class="cart-item">
          <span class="cart-item__icon">${p.icon}</span>
          <div class="cart-item__info">
            <b>${p.name}</b>
            <small>${fmt(p.price)}</small>
            <div class="qty">
              <button data-qty="${p.id}" data-d="1" aria-label="زيادة">+</button>
              <span>${i.qty.toLocaleString("ar-EG")}</span>
              <button data-qty="${p.id}" data-d="-1" aria-label="نقص">−</button>
            </div>
          </div>
          <button class="cart-item__remove" data-remove="${p.id}" aria-label="حذف">🗑</button>
        </div>`;
      }).join("")
    : `<div class="cart__empty"><span>🛒</span>سلتك فاضية.. يلا نملاها!</div>`;

  store.set("gtech-cart", cart);
}

function addToCart(id) {
  const item = cart.find((i) => i.id === id);
  item ? item.qty++ : cart.push({ id, qty: 1 });
  renderCart();
  toast(`✅ تمت إضافة "${products.find((p) => p.id === id).name}" للسلة`);
}

function toggleWish(id, btn) {
  wishlist = wishlist.includes(id) ? wishlist.filter((w) => w !== id) : [...wishlist, id];
  btn.classList.toggle("active");
  bump($("#wishCount"), wishlist.length);
  store.set("gtech-wish", wishlist);
  toast(wishlist.includes(id) ? "❤️ تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة");
}

grid.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  const wish = e.target.closest("[data-wish]");
  if (add) addToCart(+add.dataset.add);
  if (wish) toggleWish(+wish.dataset.wish, wish);
});

$("#cartItems").addEventListener("click", (e) => {
  const q = e.target.closest("[data-qty]");
  const r = e.target.closest("[data-remove]");
  if (q) {
    const item = cart.find((i) => i.id === +q.dataset.qty);
    item.qty += +q.dataset.d;
    if (item.qty < 1) cart = cart.filter((i) => i !== item);
  }
  if (r) cart = cart.filter((i) => i.id !== +r.dataset.remove);
  if (q || r) renderCart();
});

const openCart = (open) => {
  $("#cart").classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
};
$("#cartBtn").addEventListener("click", () => openCart(true));
$("#cartClose").addEventListener("click", () => openCart(false));
$("#overlay").addEventListener("click", () => openCart(false));
document.addEventListener("keydown", (e) => e.key === "Escape" && openCart(false));

$("#checkoutBtn").addEventListener("click", () => {
  if (!cart.length) return toast("السلة فاضية! ضيف منتجات الأول 🛍️");
  cart = [];
  renderCart();
  openCart(false);
  toast("🎉 تم استلام طلبك بنجاح! هنتواصل معاك قريباً");
});

// ============ Toast ============
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ============ العد التنازلي ============
const offerEnd = Date.now() + ((3 * 24 + 7) * 3600 + 42 * 60) * 1000;
function tick() {
  let s = Math.max(0, Math.floor((offerEnd - Date.now()) / 1000));
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
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString("ar-EG");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    statsObserver.unobserve(el);
  });
});
$$("[data-count]").forEach((el) => statsObserver.observe(el));

// ============ ظهور العناصر عند التمرير ============
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.12 });
$$(".section__head, .category, .offer, .mini-offer, .review, .newsletter, .feature").forEach((el) => {
  el.classList.add("reveal");
  revealObserver.observe(el);
});

// ============ الهيدر والقائمة ============
const header = $("#header");
const nav = $("#nav");
window.addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 10), { passive: true });
$("#menuToggle").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", (e) => {
  if (e.target.tagName !== "A") return;
  $$(".nav a").forEach((a) => a.classList.remove("active"));
  e.target.classList.add("active");
  nav.classList.remove("open");
});

// ============ النشرة البريدية ============
$("#newsletterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.reset();
  toast("📩 شكراً لاشتراكك! كود الخصم وصل لبريدك");
});

$("#year").textContent = new Date().getFullYear();
$("#wishCount").textContent = wishlist.length.toLocaleString("ar-EG");

renderProducts();
renderCart();
