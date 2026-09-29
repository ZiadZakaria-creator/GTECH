// ============ الإعدادات ============
// رقم واتساب المتجر بالصيغة الدولية (مصر = 20) — الطلبات والاستفسارات بتوصل عليه
const WHATSAPP = "201100053123";
const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

// ============ أدوات مشتركة ============
const fmt = (n) => n.toLocaleString("ar-EG") + " ج.م";
const num = (n) => n.toLocaleString("ar-EG");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const findProduct = (id) => products.find((p) => p.id === id);
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const normalizePhone = (s) => toLatinDigits(s).replace(/[\s-]/g, "");
const isValidPhone = (s) => /^01[0125]\d{8}$/.test(normalizePhone(s));
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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

// ============ صور المنتجات ============
// لو المنتج ليه صور في p.images بتظهر، ولو مفيش (أو الصورة مفتحتش) بيظهر الإيموجي
function productVisual(p, src = p.images?.[0], attrs = "") {
  return src
    ? `<img src="${src}" alt="${p.name}" loading="lazy" data-icon="${p.icon}" onerror="imgFallback(this)" ${attrs}>`
    : `<span ${attrs}>${p.icon}</span>`;
}
function imgFallback(img) {
  const span = document.createElement("span");
  span.textContent = img.dataset.icon;
  if (img.id) span.id = img.id;
  span.className = img.className;
  img.replaceWith(span);
}

// ============ كارت المنتج ============
function productCard(p, i = 0) {
  const url = productUrl(p.id);
  return `
    <article class="product" style="animation-delay:${i * 50}ms">
      <a href="${url}" class="product__media" style="--tint:${p.tint}" aria-label="${p.name}">
        ${p.tag ? `<span class="product__tag ${p.tag === "جديد" ? "product__tag--new" : ""}">${p.tag}</span>` : ""}
        ${productVisual(p)}
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
          <a href="${productUrl(p.id)}" class="cart-item__icon">${productVisual(p)}</a>
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
  document.dispatchEvent(new Event("cartchange"));
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
  document.dispatchEvent(new Event("wishchange"));
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
  openCart(false);
  requireLogin(() => (location.href = "checkout.html"), "سجّل دخولك عشان تكمّل الطلب");
});

// ============ تسجيل الدخول ============
// الحساب محفوظ في المتصفح بس (مفيش سيرفر): الاسم ورقم الموبايل
let user = store.get("gtech-user", null);
let afterLogin = null;
const userIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';

$(".header__actions").insertAdjacentHTML("afterbegin", `
  <div class="account">
    <button class="icon-btn account__btn" id="accountBtn" aria-label="حسابي" aria-haspopup="true"></button>
    <div class="account__menu" id="accountMenu" hidden></div>
  </div>`);

document.body.insertAdjacentHTML("beforeend", `
  <div class="modal" id="loginModal" hidden role="dialog" aria-modal="true" aria-labelledby="loginTitle">
    <form class="modal__box card-box" id="loginForm" novalidate>
      <button type="button" class="icon-btn modal__close" data-close aria-label="إغلاق">✕</button>
      <div class="modal__icon">${userIcon}</div>
      <h3 id="loginTitle">تسجيل الدخول</h3>
      <p class="muted" id="loginReason">ادخل اسمك ورقم موبايلك عشان تقدر تطلب</p>
      <label class="field"><span>الاسم بالكامل</span><input name="name" autocomplete="name" placeholder="مثال: أحمد محمد" maxlength="40" /><em></em></label>
      <label class="field"><span>رقم الموبايل</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01xxxxxxxxx" dir="ltr" maxlength="14" /><em></em></label>
      <button class="btn btn--primary btn--block" type="submit">دخول</button>
      <small class="muted">هنستخدم رقمك للتواصل معاك بخصوص طلباتك بس.</small>
    </form>
  </div>`);

function renderAccount() {
  const btn = $("#accountBtn");
  if (user) {
    btn.classList.add("account__btn--in");
    btn.innerHTML = `<span class="account__avatar">${escapeHtml(user.name.trim()[0])}</span><span class="account__name">${escapeHtml(user.name.split(" ")[0])}</span>`;
    $("#accountMenu").innerHTML = `
      <div class="account__info"><b>${escapeHtml(user.name)}</b><small dir="ltr">${user.phone}</small></div>
      <a href="wishlist.html">❤️ المفضلة</a>
      <button id="logoutBtn">↩ تسجيل الخروج</button>`;
  } else {
    btn.classList.remove("account__btn--in");
    btn.innerHTML = `${userIcon}<span class="account__name">دخول</span>`;
  }
}

function openLogin(reason) {
  $("#loginReason").textContent = reason || "ادخل اسمك ورقم موبايلك عشان تقدر تطلب";
  $("#loginModal").hidden = false;
  document.body.classList.add("no-scroll");
  setTimeout(() => $("#loginForm").name.focus(), 50);
}
function closeLogin() {
  $("#loginModal").hidden = true;
  document.body.classList.remove("no-scroll");
  afterLogin = null;
}

// ينفّذ الإجراء لو المستخدم داخل، وإلا يطلب منه يسجل الأول
function requireLogin(action, reason) {
  if (user) return action();
  afterLogin = action;
  openLogin(reason);
}

$("#accountBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!user) return openLogin();
  $("#accountMenu").hidden = !$("#accountMenu").hidden;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".account")) $("#accountMenu").hidden = true;
  if (e.target.id === "logoutBtn") {
    user = null;
    store.set("gtech-user", null);
    renderAccount();
    document.dispatchEvent(new Event("userchange"));
    toast("👋 تم تسجيل الخروج");
  }
});

$("#loginModal").addEventListener("click", (e) => {
  if (e.target.id === "loginModal" || e.target.closest("[data-close]")) closeLogin();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && !$("#loginModal").hidden && closeLogin());

$("#loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  const checks = [
    [f.name, f.name.value.trim().length >= 3 || "اكتب اسمك بالكامل"],
    [f.phone, isValidPhone(f.phone.value) || "رقم موبايل غير صحيح (11 رقم يبدأ بـ 01)"],
  ];
  checks.forEach(([el, res]) => {
    el.closest(".field").classList.toggle("invalid", res !== true);
    el.closest(".field").querySelector("em").textContent = res === true ? "" : res;
  });
  const bad = checks.find(([, res]) => res !== true);
  if (bad) return bad[0].focus();

  user = { name: f.name.value.trim().replace(/\s+/g, " "), phone: normalizePhone(f.phone.value) };
  store.set("gtech-user", user);
  renderAccount();
  document.dispatchEvent(new Event("userchange"));
  const action = afterLogin;
  closeLogin();
  f.reset();
  toast(`أهلاً ${user.name.split(" ")[0]} 👋`);
  if (action) action();
});

renderAccount();

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

// ============ زرار واتساب العائم ============
document.body.insertAdjacentHTML("beforeend", `
  <a class="wa-float" href="${waLink("السلام عليكم، عندي استفسار عن منتجات GTECH")}" target="_blank" rel="noopener" aria-label="كلمنا على واتساب">
    <svg viewBox="0 0 24 24" class="wa-ico"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>
  </a>`);

$("#year").textContent = new Date().getFullYear();
$("#wishCount").textContent = num(wishlist.length);
renderCart();
