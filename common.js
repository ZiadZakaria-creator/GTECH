// ============ أدوات مشتركة ============
const fmt = (n) => n.toLocaleString("ar-EG") + " ج.م";
const num = (n) => n.toLocaleString("ar-EG");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const findProduct = (id) => products.find((p) => p.id === id);
const productUrl = (id) => `product.html?id=${id}`;

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
let cart = store.get("gtech-cart", []).filter((i) => findProduct(i.id));
let wishlist = store.get("gtech-wish", []);

const heartIcon = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.3-9.2C1.3 8.2 3.7 4.5 7.4 4.5c2 0 3.4 1 4.6 2.6 1.2-1.6 2.6-2.6 4.6-2.6 3.7 0 6.1 3.7 4.7 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const cartPlusIcon = '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.2"/><path d="M13 10v4M11 12h4"/></svg>';

const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
const discount = (p) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);

// ============ كارت المنتج ============
function productCard(p, i = 0) {
  const url = productUrl(p.id);
  return `
    <article class="product" style="animation-delay:${i * 50}ms">
      <a href="${url}" class="product__media" style="--tint:${p.tint}" aria-label="${p.name}">
        ${p.tag ? `<span class="product__tag ${p.tag === "جديد" ? "product__tag--new" : ""}">${p.tag}</span>` : ""}
        <span>${p.icon}</span>
      </a>
      <button class="product__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heartIcon}</button>
      <div class="product__body">
        <span class="product__brand">${p.brand}</span>
        <h3 class="product__name"><a href="${url}">${p.name}</a></h3>
        <div class="product__rating">${stars(p.rating)} <small>(${num(p.reviews)})</small></div>
        <div class="product__foot">
          <div class="product__price">
            ${p.old ? `<del>${fmt(p.old)}</del>` : ""}
            <b>${fmt(p.price)}</b>
          </div>
          <button class="add-btn" data-add="${p.id}" aria-label="أضف للسلة">${cartPlusIcon}</button>
        </div>
      </div>
    </article>`;
}

// ============ السلة والمفضلة ============
function bump(el, value) {
  el.textContent = num(value);
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * findProduct(i.id).price, 0);
  bump($("#cartCount"), count);
  $("#cartTotal").textContent = fmt(total);

  $("#cartItems").innerHTML = cart.length
    ? cart.map((i, idx) => {
        const p = findProduct(i.id);
        return `
        <div class="cart-item">
          <a href="${productUrl(p.id)}" class="cart-item__icon">${p.icon}</a>
          <div class="cart-item__info">
            <b>${p.name}</b>
            ${i.opts ? `<em>${i.opts}</em>` : ""}
            <small>${fmt(p.price)}</small>
            <div class="qty">
              <button data-qty="${idx}" data-d="1" aria-label="زيادة">+</button>
              <span>${num(i.qty)}</span>
              <button data-qty="${idx}" data-d="-1" aria-label="نقص">−</button>
            </div>
          </div>
          <button class="cart-item__remove" data-remove="${idx}" aria-label="حذف">🗑</button>
        </div>`;
      }).join("")
    : `<div class="cart__empty"><span>🛒</span>سلتك فاضية.. يلا نملاها!</div>`;

  store.set("gtech-cart", cart);
}

function addToCart(id, qty = 1, opts = "") {
  const item = cart.find((i) => i.id === id && (i.opts || "") === opts);
  item ? (item.qty += qty) : cart.push({ id, qty, opts });
  renderCart();
  toast(`✅ تمت إضافة "${findProduct(id).name}" للسلة`);
}

function toggleWish(id) {
  wishlist = wishlist.includes(id) ? wishlist.filter((w) => w !== id) : [...wishlist, id];
  const on = wishlist.includes(id);
  $$(`[data-wish="${id}"]`).forEach((b) => b.classList.toggle("active", on));
  bump($("#wishCount"), wishlist.length);
  store.set("gtech-wish", wishlist);
  toast(on ? "❤️ تمت الإضافة للمفضلة" : "تمت الإزالة من المفضلة");
}

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  const wish = e.target.closest("[data-wish]");
  if (add) addToCart(+add.dataset.add);
  if (wish) toggleWish(+wish.dataset.wish);
});

$("#cartItems").addEventListener("click", (e) => {
  const q = e.target.closest("[data-qty]");
  const r = e.target.closest("[data-remove]");
  if (q) {
    const item = cart[+q.dataset.qty];
    item.qty += +q.dataset.d;
    if (item.qty < 1) cart.splice(+q.dataset.qty, 1);
  }
  if (r) cart.splice(+r.dataset.remove, 1);
  if (q || r) renderCart();
});

function openCart(open) {
  $("#cart").classList.toggle("open", open);
  $("#overlay").classList.toggle("show", open);
}
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

// ============ ظهور العناصر عند التمرير ============
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); revealObserver.unobserve(e.target); }
  });
}, { threshold: 0.12 });
function reveal(selector) {
  $$(selector).forEach((el) => {
    el.classList.add("reveal");
    revealObserver.observe(el);
  });
}

// ============ الهيدر والقائمة ============
const header = $("#header");
const nav = $("#nav");
window.addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 10), { passive: true });
$("#menuToggle").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", (e) => {
  if (e.target.tagName === "A") nav.classList.remove("open");
});

// ============ النشرة البريدية ============
$("#newsletterForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  e.target.reset();
  toast("📩 شكراً لاشتراكك! كود الخصم وصل لبريدك");
});

$("#year").textContent = new Date().getFullYear();
$("#wishCount").textContent = num(wishlist.length);
renderCart();
