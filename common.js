// ============ أدوات مشتركة ============
const findProduct = (id) => products.find((p) => p.id === id);
const productUrl = (id) => `product.html?id=${id}`;

let cart = store.get("gtech-cart", []).filter((i) => findProduct(i.id));
const pruneCart = () => (cart = cart.filter((i) => { const p = findProduct(i.id); return p && isForSale(p); }));
pruneCart();
let wishlist = store.get("gtech-wish", []);

const heartIcon = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.3-9.2C1.3 8.2 3.7 4.5 7.4 4.5c2 0 3.4 1 4.6 2.6 1.2-1.6 2.6-2.6 4.6-2.6 3.7 0 6.1 3.7 4.7 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const cartPlusIcon = '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.2"/><path d="M13 10v4M11 12h4"/></svg>';

const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));

// ============ كارت المنتج ============
function productCard(p, i = 0) {
  const url = productUrl(p.id);
  const tag = inStock(p) ? productTag(p) : "نفد";
  return `
    <article class="product ${inStock(p) ? "" : "product--soldout"}" style="animation-delay:${i * 50}ms">
      <a href="${url}" class="product__media" style="--tint:${p.tint}" aria-label="${escapeHtml(p.name)}">
        ${tag ? `<span class="product__tag ${tag === "جديد" ? "product__tag--new" : tag === "نفد" ? "product__tag--out" : ""}">${escapeHtml(tag)}</span>` : ""}
        ${productVisual(p)}
      </a>
      <button class="product__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heartIcon}</button>
      <div class="product__body">
        <span class="product__brand">${escapeHtml(p.brand)}</span>
        <h3 class="product__name"><a href="${url}">${escapeHtml(p.name)}</a></h3>
        <div class="product__rating">${stars(p.rating)} <small>(${num(p.reviews)})</small></div>
        <div class="product__foot">
          <div class="product__price">
            ${p.old ? `<del>${fmt(p.old)}</del>` : ""}
            <b>${fmt(p.price)}</b>
          </div>
          <button class="add-btn" data-add="${p.id}" aria-label="أضف للسلة" ${inStock(p) ? "" : "disabled"}>${cartPlusIcon}</button>
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
  const p = findProduct(id);
  if (!p || !isForSale(p)) return toast("المنتج ده مش متاح دلوقتي");
  if (!inStock(p)) return toast("😔 المنتج ده نفد من المخزون");
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
      <div class="social" id="socialBox">
        <button type="button" class="social__btn social__btn--google" data-social="google"><svg viewBox="0 0 48 48" class="brand-ico"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>المتابعة بحساب Google</span></button>
        <button type="button" class="social__btn social__btn--facebook" data-social="facebook"><svg viewBox="0 0 24 24" class="brand-ico"><path fill="#fff" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21h3.1z"/></svg><span>المتابعة بحساب Facebook</span></button>
        <div class="divider"><span>أو ادخل بياناتك</span></div>
      </div>
      <p class="social-linked" id="socialLinked" hidden></p>
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
      <a href="myorders.html">📦 طلباتي</a>
      <a href="wishlist.html">❤️ المفضلة</a>
      <button id="logoutBtn">↩ تسجيل الخروج</button>`;
  } else {
    btn.classList.remove("account__btn--in");
    btn.innerHTML = `${userIcon}<span class="account__name">دخول</span>`;
  }
}

function openLogin(reason) {
  $("#loginReason").textContent = reason || "ادخل اسمك ورقم موبايلك عشان تقدر تطلب";
  resetSocial();
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
    const fbUser = window.firebase?.apps?.length && firebase.auth().currentUser;
    if (fbUser && !fbUser.isAnonymous) firebase.auth().signOut().catch(() => {});
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

  user = { name: f.name.value.trim().replace(/\s+/g, " "), phone: normalizePhone(f.phone.value), ...(socialInfo || {}) };
  socialInfo = null;
  store.set("gtech-user", user);
  renderAccount();
  document.dispatchEvent(new Event("userchange"));
  const action = afterLogin;
  closeLogin();
  f.reset();
  toast(`أهلاً ${user.name.split(" ")[0]} 👋`);
  if (action) action();
});

// ============ الدخول بـ Google و Facebook ============
// Google و Facebook بيدّوا الاسم والإيميل بس، فبعدها العميل لازم يكمّل رقم موبايله
const providerNames = { google: "Google", facebook: "Facebook" };
let socialInfo = null;

function resetSocial() {
  socialInfo = null;
  $("#socialBox").hidden = false;
  $("#socialLinked").hidden = true;
}

async function socialLogin(kind) {
  if (!FIREBASE_CONFIG) return toast(`الدخول بـ ${providerNames[kind]} هيتفعل قريب — استخدم الاسم ورقم الموبايل دلوقتي`);
  const btn = $(`[data-social="${kind}"]`);
  btn.disabled = true;
  try {
    await loadFirebase(["auth"]);
    const provider = kind === "google" ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.FacebookAuthProvider();
    const { user: fbUser } = await firebase.auth().signInWithPopup(provider);
    socialInfo = { provider: kind, uid: fbUser.uid, email: fbUser.email || "" };

    const f = $("#loginForm");
    if (fbUser.displayName) f.name.value = fbUser.displayName;
    $("#socialBox").hidden = true;
    $("#socialLinked").hidden = false;
    $("#socialLinked").innerHTML = `✔ تم الربط بحساب ${providerNames[kind]}${fbUser.email ? ` <small dir="ltr">(${escapeHtml(fbUser.email)})</small>` : ""}<br>فاضل تكتب رقم موبايلك عشان نتواصل معاك بخصوص الطلب`;
    (f.name.value ? f.phone : f.name).focus();
  } catch (err) {
    if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err?.code)) {
      toast(`❌ مقدرناش ندخل بـ ${providerNames[kind]}، جرّب تاني`);
    }
  } finally {
    btn.disabled = false;
  }
}

$("#socialBox").addEventListener("click", (e) => {
  const b = e.target.closest("[data-social]");
  if (b) socialLogin(b.dataset.social);
});

renderAccount();


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

// لما المنتجات تتحدث من لوحة التحكم: شيل من السلة أي منتج اتشال واحسب بالأسعار الجديدة
document.addEventListener("productschange", () => {
  pruneCart();
  renderCart();
});
