// ============ أدوات مشتركة ============
const findProduct = (id) => products.find((p) => p.id === id);
// صفحة المنتج الثابتة اللي جوجل بيفهرسها (بتتعمل وقت النشر — tools/build-seo.mjs)
const productUrl = (id) => (FIREBASE_CONFIG ? `p/${id}.html` : `product.html?id=${id}`);

let cart = store.get("gtech-cart", []).filter((i) => findProduct(i.id));

// رابط التذكير بالسلة المتروكة بيرجّع المنتجات: ?cart=رقم.كمية.الاختيارات,...
(() => {
  const param = new URLSearchParams(location.search).get("cart");
  if (!param) return;
  param.split(",").forEach((part) => {
    const [id, qty] = part.split(".", 2).map(Number);
    const opts = part.split(".").slice(2).join(".").slice(0, 120);
    if (!findProduct(id) || !(qty > 0)) return;
    const line = cart.find((i) => i.id === id && (i.opts || "") === opts);
    if (line) line.qty = Math.max(line.qty, Math.min(qty, 20));
    else cart.push({ id, qty: Math.min(qty, 20), opts });
  });
  history.replaceState(null, "", location.pathname + location.hash);
})();
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
    <article class="product ${inStock(p) ? "" : "product--soldout"}" style="animation-delay:${i * 50}ms;--cc:${CATEGORY_COLORS[p.cat] || "#0a84ff"}">
      <a href="${url}" class="product__media ${p.images?.[1] ? "has-alt" : ""}" style="--tint:${p.tint}" aria-label="${escapeHtml(p.name)}">
        ${tag ? `<span class="product__tag ${tag === "جديد" ? "product__tag--new" : tag === "نفد" ? "product__tag--out" : ""}">${escapeHtml(tag)}</span>` : ""}
        ${productVisual(p)}
        ${p.images?.[1] ? productVisual(p, p.images[1], 'class="product__alt" aria-hidden="true"') : ""}
      </a>
      <button class="product__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heartIcon}</button>
      <button class="product__compare ${compareList.includes(p.id) ? "active" : ""}" data-compare="${p.id}" aria-label="قارن" title="قارن">⚖️</button>
      <div class="product__body">
        <span class="product__brand">${escapeHtml(p.brand)}</span>
        <h3 class="product__name"><a href="${url}">${escapeHtml(p.name)}</a></h3>
        ${typeof ratingHtml === "function" ? ratingHtml(p.id) : ""}
        <div class="product__foot">
          <div class="product__price">
            ${p.old ? `<del>${fmt(p.old)}</del>` : ""}
            <b>${fmt(p.price)}</b>
          </div>
          <button class="add-btn" data-add="${p.id}" aria-label="أضف للسلة" ${inStock(p) ? "" : "disabled"}>${cartPlusIcon}<span class="add-btn__txt">أضف</span></button>
        </div>
      </div>
    </article>`;
}

// ============ المقارنة ============
// العميل بيختار لحد 3 منتجات ويقارن مواصفاتهم في compare.html
const COMPARE_MAX = 3;
let compareList = store.get("gtech-compare", []).filter((id) => findProduct(id));

function toggleCompare(id) {
  const on = compareList.includes(id);
  if (!on && compareList.length >= COMPARE_MAX) return toast(`تقدر تقارن ${num(COMPARE_MAX)} منتجات بس — شيل واحد الأول`);
  compareList = on ? compareList.filter((x) => x !== id) : [...compareList, id];
  store.set("gtech-compare", compareList);
  $$(`[data-compare="${id}"]`).forEach((b) => b.classList.toggle("active", !on));
  renderCompareTray();
  document.dispatchEvent(new Event("comparechange"));
  if (!on) toast(compareList.length > 1 ? `⚖️ اتضاف للمقارنة (${num(compareList.length)})` : "⚖️ اتضاف للمقارنة — اختار منتج كمان");
}

function renderCompareTray() {
  let tray = $("#compareTray");
  if (!tray) {
    document.body.insertAdjacentHTML("beforeend", `<div class="compare-tray" id="compareTray" hidden></div>`);
    tray = $("#compareTray");
  }
  const items = compareList.map(findProduct).filter(Boolean);
  tray.hidden = !items.length || document.body.classList.contains("compare-page");
  tray.innerHTML = `
    <div class="compare-tray__items">
      ${items.map((p) => `<span class="compare-tray__item" title="${escapeHtml(p.name)}">${productVisual(p)}<button data-compare="${p.id}" aria-label="شيل">✕</button></span>`).join("")}
      ${Array.from({ length: COMPARE_MAX - items.length }, () => `<span class="compare-tray__item compare-tray__item--empty">＋</span>`).join("")}
    </div>
    <a href="compare.html" class="btn btn--primary btn--sm ${items.length < 2 ? "is-disabled" : ""}">⚖️ قارن ${items.length > 1 ? `(${num(items.length)})` : ""}</a>
    <button class="compare-tray__clear" id="compareClear">مسح</button>`;
}

// ============ السلة والمفضلة ============
function bump(el, value) {
  el.textContent = num(value);
  el.hidden = !value; // مفيش "٠" على السلة والمفضلة وهما فاضيين
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

// ============ باكدجات السيت أب (BUNDLES في data.js) ============
// كل باكدج كامل في السلة (كل منتجاته موجودة) بياخد خصمه، ولو العميل جايب منه نسختين بياخد الخصم مرتين
const bundleProducts = (b) => b.items.map(findProduct);
const bundleAvailable = (b) => bundleProducts(b).every((p) => p && isForSale(p) && inStock(p));
const bundleFull = (b) => bundleProducts(b).reduce((s, p) => s + p.price, 0);
const bundlePrice = (b) => bundleFull(b) - Math.round(bundleFull(b) * b.off / 100);
function bundleDiscounts(items = cart) {
  if (typeof BUNDLES === "undefined") return [];
  const qty = (id) => items.filter((i) => i.id === id).reduce((s, i) => s + i.qty, 0);
  return BUNDLES.filter((b) => bundleProducts(b).every((p) => p))
    .map((b) => {
      const sets = Math.min(...b.items.map(qty));
      return { id: b.id, name: b.name, sets, amount: sets * Math.round(bundleFull(b) * b.off / 100) };
    })
    .filter((d) => d.sets > 0);
}
const bundleTotal = (items = cart) => bundleDiscounts(items).reduce((s, d) => s + d.amount, 0);
function addBundle(id) {
  const b = BUNDLES.find((x) => x.id === id);
  if (!b || !bundleAvailable(b)) return toast("الباكدج ده مش متاح دلوقتي");
  b.items.forEach((pid) => {
    const p = findProduct(pid);
    const item = cart.find((i) => i.id === pid && !i.opts);
    item ? item.qty++ : cart.push({ id: pid, qty: 1, opts: "" });
    if (typeof track === "function") track("add_to_cart", { items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }] });
  });
  renderCart();
  toast(`🎁 اتضاف "${b.name}" للسلة — وفّرت ${fmt(bundleFull(b) - bundlePrice(b))}`);
  if ($("#cart")) openCart(true);
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const bundleOff = bundleTotal();
  const total = cart.reduce((s, i) => s + i.qty * findProduct(i.id).price, 0) - bundleOff;
  bump($("#cartCount"), count);
  $("#cartTotal").textContent = fmt(total);
  // سطر خصم الباكدج فوق الإجمالي
  const totalRow = $(".cart__total");
  if (totalRow) {
    let row = document.getElementById("cartBundle");
    if (!row) {
      totalRow.insertAdjacentHTML("beforebegin", '<div class="cart__bundle" id="cartBundle" hidden><span>🎁 خصم الباكدج</span><b></b></div>');
      row = document.getElementById("cartBundle");
    }
    row.hidden = !bundleOff;
    row.querySelector("b").textContent = "− " + fmt(bundleOff);
  }
  renderFreeShip(total + bundleOff);

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
      }).join("") + setupRecsHtml([...new Set(cart.map((i) => i.id))].map(findProduct))
    : `<div class="cart__empty"><span>🛒</span>سلتك فاضية.. يلا نملاها!</div>`;

  store.set("gtech-cart", cart);
  document.dispatchEvent(new Event("cartchange"));
}

// ============ كمّل السيت أب: منتجات بتكمّل مع بعض ============
// مش من بيانات مبيعات — قاعدة بسيطة: كل قسم والأقسام اللي بتكمّله عادةً.
// بنقترح من قسم مش موجود أصلاً في السلة، ونفضّل نفس الماركة وسعر قريب.
const COMPLEMENTS = {
  mice: ["keyboards", "audio"], keyboards: ["mice", "audio"], audio: ["mice", "keyboards"],
  earphones: ["storage", "mice"], storage: ["keyboards", "mice"],
  monitors: ["keyboards", "mice"], gpus: ["monitors", "storage"],
  controllers: ["audio", "earphones"], speakers: ["earphones", "storage"],
};
function complementsFor(sources, n = 2) {
  sources = sources.filter(Boolean);
  const have = new Set(sources.map((p) => p.cat));
  const pool = shopProducts().filter((p) => inStock(p) && !have.has(p.cat));
  const out = [];
  for (const s of sources) for (const cat of COMPLEMENTS[s.cat] || []) {
    if (out.length >= n || out.some((p) => p.cat === cat)) continue;
    const pick = pool.filter((p) => p.cat === cat)
      .sort((a, b) => (b.brand === s.brand) - (a.brand === s.brand) || Math.abs(a.price - s.price) - Math.abs(b.price - s.price))[0];
    if (pick) out.push(pick);
  }
  return out;
}
const miniProduct = (p) => `
  <div class="mini-prod">
    <a href="${productUrl(p.id)}" class="mini-prod__img">${productVisual(p)}</a>
    <a href="${productUrl(p.id)}" class="mini-prod__info"><small>${categoryLabel(p.cat)}</small><b>${escapeHtml(p.name)}</b><span>${fmt(p.price)}</span></a>
    <button type="button" class="btn btn--ghost btn--sm" data-add="${p.id}">+ أضف</button>
  </div>`;
function setupRecsHtml(sources) {
  const recs = complementsFor(sources);
  return recs.length ? `<div class="setup-recs"><h4>🧩 كمّل السيت أب</h4>${recs.map(miniProduct).join("")}</div>` : "";
}

// شريط الشحن المجاني فوق منتجات السلة (نفس حسبة صفحة الدفع: على المجموع قبل الخصومات)
function renderFreeShip(sub) {
  const items = $("#cartItems");
  if (!items || typeof shippingSettings === "undefined") return;
  let bar = document.getElementById("cartShip");
  if (!bar) {
    items.insertAdjacentHTML("beforebegin", '<div class="cart__ship" id="cartShip" hidden><p></p><i><em></em></i></div>');
    bar = document.getElementById("cartShip");
  }
  const goal = shippingSettings.freeOver;
  bar.hidden = !(goal > 0 && cart.length);
  if (bar.hidden) return;
  const left = goal - sub;
  bar.classList.toggle("is-done", left <= 0);
  const en = typeof IS_EN !== "undefined" && IS_EN;
  bar.querySelector("p").innerHTML = left > 0
    ? (en ? `🚚 Add <b>${fmt(left)}</b> more for <b>free shipping</b>` : `🚚 فاضلك <b>${fmt(left)}</b> وتاخد <b>شحن مجاني</b>`)
    : (en ? "🎉 Nice! Your shipping is <b>free</b>" : "🎉 مبروك! الشحن عندك <b>مجاني</b>");
  bar.querySelector("em").style.width = Math.min(100, (sub / goal) * 100) + "%";
}

function addToCart(id, qty = 1, opts = "") {
  const p = findProduct(id);
  if (!p || !isForSale(p)) return toast("المنتج ده مش متاح دلوقتي");
  if (!inStock(p)) return toast("😔 المنتج ده نفد من المخزون");
  const item = cart.find((i) => i.id === id && (i.opts || "") === opts);
  item ? (item.qty += qty) : cart.push({ id, qty, opts });
  renderCart();
  if (typeof track === "function") track("add_to_cart", { items: [{ id: p.id, name: p.name, price: p.price, qty }] });
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
  const cmp = e.target.closest("[data-compare]");
  if (cmp) toggleCompare(+cmp.dataset.compare);
  if (e.target.id === "compareClear") {
    compareList = [];
    store.set("gtech-compare", compareList);
    $$("[data-compare].active").forEach((b) => b.classList.remove("active"));
    renderCompareTray();
    document.dispatchEvent(new Event("comparechange"));
  }
  if (add) {
    addToCart(+add.dataset.add);
    // علامة ✓ صغيرة على الزرار نفسه إن المنتج اتضاف
    if (add.classList.contains("add-btn") && cart.some((i) => i.id === +add.dataset.add)) {
      add.classList.remove("is-added"); void add.offsetWidth; add.classList.add("is-added");
      clearTimeout(add._addedT); add._addedT = setTimeout(() => add.classList.remove("is-added"), 1200);
    }
  }
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
      <div class="login-step" id="loginStep1">
      <div class="social" id="socialBox">
        <button type="button" class="social__btn social__btn--google" data-social="google"><svg viewBox="0 0 48 48" class="brand-ico"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg><span>المتابعة بحساب Google</span></button>
        <button type="button" class="social__btn social__btn--facebook" data-social="facebook"><svg viewBox="0 0 24 24" class="brand-ico"><path fill="#fff" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21h3.1z"/></svg><span>المتابعة بحساب Facebook</span></button>
        <div class="divider"><span>أو ادخل بياناتك</span></div>
      </div>
      <p class="social-linked" id="socialLinked" hidden></p>
      <label class="field"><span>الاسم بالكامل</span><input name="name" autocomplete="name" placeholder="مثال: أحمد محمد" maxlength="40" /><em></em></label>
      <label class="field"><span>رقم الموبايل</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01xxxxxxxxx" dir="ltr" maxlength="14" /><em></em></label>
      </div>
      <div class="otp" id="otpStep" hidden>
        <p>بعتنالك كود من ٦ أرقام في رسالة على<br><b dir="ltr" id="otpPhone"></b></p>
        <input class="otp__input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" dir="ltr" aria-label="كود التأكيد" />
        <div class="otp__links">
          <button type="button" class="link-btn" id="otpResend" disabled></button>
          <button type="button" class="link-btn" id="otpChange">تغيير الرقم</button>
        </div>
      </div>
      <p class="login-error" id="loginError" hidden></p>
      <button class="btn btn--primary btn--block" type="submit" id="loginSubmit">دخول</button>
      <div id="recaptchaBox"></div>
      <small class="muted" id="loginNote">هنستخدم رقمك للتواصل معاك بخصوص طلباتك بس.</small>
    </form>
  </div>`);

function renderAccount() {
  const btn = $("#accountBtn");
  if (user) {
    btn.classList.add("account__btn--in");
    btn.innerHTML = `<span class="account__avatar">${escapeHtml(user.name.trim()[0])}</span><span class="account__name">${escapeHtml(user.name.split(" ")[0])}</span>`;
    $("#accountMenu").innerHTML = `
      <div class="account__info"><b>${escapeHtml(user.name)}</b><small dir="ltr">${escapeHtml(user.phone || user.email || "")}${user.verified ? ` <span class="verified" title="رقم مؤكد">✔</span>` : ""}</small></div>
      ${needsVerify(user) ? `<button id="verifyBtn">📲 أكّد رقم موبايلك</button>` : ""}
      <a href="myorders.html">📦 طلباتي</a>
      <a href="wishlist.html">❤️ المفضلة</a>
      <button id="logoutBtn">↩ تسجيل الخروج</button>`;
  } else {
    btn.classList.remove("account__btn--in");
    btn.innerHTML = `${userIcon}<span class="account__name">دخول</span>`;
  }
}

function openLogin(reason, prefill = null) {
  $("#loginReason").textContent = reason || "ادخل اسمك ورقم موبايلك عشان تقدر تطلب";
  resetSocial();
  showStep1();
  if (prefill) {
    $("#loginForm").name.value = prefill.name;
    $("#loginForm").phone.value = prefill.phone;
  }
  $("#loginModal").hidden = false;
  document.body.classList.add("no-scroll");
  setTimeout(() => $("#loginForm").name.focus(), 50);
}
function closeLogin() {
  $("#loginModal").hidden = true;
  document.body.classList.remove("no-scroll");
  afterLogin = null;
  otp = null;
  clearInterval(resendTimer);
}

// ينفّذ الإجراء لو المستخدم داخل، وإلا يطلب منه يسجل الأول
function requireLogin(action, reason) {
  if (user && !needsVerify(user)) return action();
  afterLogin = action;
  openLogin(needsVerify(user) ? "أكّد رقم موبايلك بكود SMS عشان تكمّل" : reason, user);
}

$("#accountBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (!user) return openLogin();
  $("#accountMenu").hidden = !$("#accountMenu").hidden;
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".account")) $("#accountMenu").hidden = true;
  if (e.target.id === "verifyBtn") {
    $("#accountMenu").hidden = true;
    openLogin("أكّد رقم موبايلك بكود SMS", user);
  }
  if (e.target.id === "logoutBtn") logout();
});

// تسجيل الخروج: بيقفل الحساب ويرجّع العميل للصفحة الرئيسية (تحميل جديد للصفحة)
async function logout() {
  $("#accountMenu").hidden = true;
  const fbUser = window.firebase?.apps?.length && firebase.auth().currentUser;
  if (fbUser && !fbUser.isAnonymous) {
    // نستنى الخروج من Google يخلص قبل ما نسيب الصفحة (بحد أقصى ثانيتين)
    await Promise.race([firebase.auth().signOut().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
  }
  user = null;
  store.set("gtech-user", null);
  try { sessionStorage.setItem("gtech-logged-out", "1"); } catch {}
  location.replace("index.html");
}
try {
  if (sessionStorage.getItem("gtech-logged-out")) {
    sessionStorage.removeItem("gtech-logged-out");
    setTimeout(() => toast("👋 تم تسجيل الخروج"), 300);
  }
} catch {}

$("#loginModal").addEventListener("click", (e) => {
  if (e.target.id === "loginModal" || e.target.closest("[data-close]")) closeLogin();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && !$("#loginModal").hidden && closeLogin());

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (otp) return confirmCode();
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

  const name = f.name.value.trim().replace(/\s+/g, " ");
  const phone = normalizePhone(f.phone.value);
  if (!SMS_ON) return finishLogin({ name, phone, ...(socialInfo || {}) });

  // لو الرقم ده متأكد قبل كده على الجهاز ده، مش محتاجين كود تاني
  setLoginBusy("لحظة...");
  try {
    await loadFirebase(["auth"]);
    const current = await new Promise((res) => { const stop = firebase.auth().onAuthStateChanged((u) => { stop(); res(u); }); });
    if (current?.phoneNumber === toIntlPhone(phone)) {
      return finishLogin({ name, phone, ...(socialInfo || {}), verified: true, uid: current.uid });
    }
  } catch {}
  await sendCode(name, phone);
});

function finishLogin(info) {
  user = info;
  socialInfo = null;
  store.set("gtech-user", user);
  renderAccount();
  document.dispatchEvent(new Event("userchange"));
  const action = afterLogin;
  closeLogin();
  $("#loginForm").reset();
  toast(info.verified ? `✔ تم تأكيد رقمك — أهلاً ${user.name.split(" ")[0]} 👋` : `أهلاً ${user.name.split(" ")[0]} 👋`);
  if (action) action();
}

// رقم الموبايل اللي بنفلتر بيه "طلباتي": حسابات Google بتتعرف بالحساب نفسه
const myOrdersPhone = () => (user?.provider ? "" : user?.phone || "");

// ============ كود تأكيد SMS ============
// الكود بيتبعت عن طريق Firebase Phone Auth. لو العميل عنده حساب Firebase (مجهول أو Google)
// بنربط الرقم بنفس الحساب عشان طلباته القديمة تفضل ظاهرة في "طلباتي"
const SMS_ON = (() => {
  if (!FIREBASE_CONFIG) return false;
  try {
    if (new URLSearchParams(location.search).get("sms") === "1") sessionStorage.setItem("gtech-sms-test", "1");
    return PHONE_VERIFICATION || sessionStorage.getItem("gtech-sms-test") === "1";
  } catch {
    return PHONE_VERIFICATION;
  }
})();
const needsVerify = (u) => SMS_ON && !!u && !u.verified;
const toIntlPhone = (p) => "+2" + normalizePhone(p);
const RESEND_SECONDS = 60;
let otp = null;          // { confirmation, name, phone, linking }
let recaptcha = null;
let resendTimer = null;

const SMS_ERRORS = {
  "auth/invalid-phone-number": "رقم الموبايل غير صحيح",
  "auth/missing-phone-number": "اكتب رقم الموبايل",
  "auth/too-many-requests": "محاولات كتير على الرقم ده، استنى شوية وجرّب تاني",
  "auth/quota-exceeded": "وصلنا للحد الأقصى لرسايل التأكيد النهارده 😔 كلمنا على واتساب ونأكد طلبك",
  "auth/invalid-verification-code": "الكود غلط، راجعه وجرّب تاني",
  "auth/code-expired": "الكود انتهت صلاحيته، اطلب كود جديد",
  "auth/session-expired": "الكود انتهت صلاحيته، اطلب كود جديد",
  "auth/network-request-failed": "في مشكلة في الإنترنت، اتأكد من الاتصال وجرّب تاني",
  "auth/billing-not-enabled": "خدمة رسايل التأكيد مش مفعّلة على المتجر لسه، كلمنا على واتساب ونأكد طلبك",
};
// الأخطاء اللي مش معروفة بيظهر كودها صغير عشان نعرف السبب بسرعة
const smsError = (err) => SMS_ERRORS[err?.code] || `خدمة كود التأكيد مش متاحة دلوقتي، جرّب تاني بعد شوية أو كلمنا على واتساب (${err?.code || "unknown"})`;

function setLoginBusy(text) {
  const b = $("#loginSubmit");
  b.disabled = !!text;
  if (text) b.textContent = text;
  else b.textContent = otp ? "تأكيد الكود" : SMS_ON ? "إرسال كود التأكيد" : "دخول";
}
function showLoginError(msg) {
  $("#loginError").hidden = !msg;
  $("#loginError").textContent = msg || "";
}
function showStep1() {
  otp = null;
  clearInterval(resendTimer);
  $("#loginStep1").hidden = false;
  $("#otpStep").hidden = true;
  $("#loginNote").textContent = SMS_ON ? "هنبعتلك كود في رسالة SMS عشان نتأكد إن الرقم بتاعك." : "هنستخدم رقمك للتواصل معاك بخصوص طلباتك بس.";
  showLoginError("");
  setLoginBusy(null);
}
function showOtpStep() {
  $("#loginStep1").hidden = true;
  $("#otpStep").hidden = false;
  $("#otpPhone").textContent = otp.phone;
  $("#loginNote").textContent = "مجاش الكود؟ استنى دقيقة واطلب إعادة الإرسال.";
  $("#loginForm").code.value = "";
  showLoginError("");
  setLoginBusy(null);
  setTimeout(() => $("#loginForm").code.focus(), 50);
  let left = RESEND_SECONDS;
  const btn = $("#otpResend");
  const tick = () => {
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? `إعادة الإرسال بعد ${num(left)} ث` : "إعادة إرسال الكود";
    left--;
    if (left < -1) clearInterval(resendTimer);
  };
  clearInterval(resendTimer);
  tick();
  resendTimer = setInterval(tick, 1000);
}

function freshRecaptcha() {
  try { recaptcha?.clear(); } catch {}
  $("#recaptchaBox").innerHTML = "<div></div>";
  recaptcha = new firebase.auth.RecaptchaVerifier($("#recaptchaBox").firstChild, { size: "invisible" });
}

async function sendCode(name, phone) {
  setLoginBusy("جاري إرسال الكود...");
  showLoginError("");
  try {
    await loadFirebase(["auth"]);
    const auth = firebase.auth();
    auth.languageCode = "ar";
    freshRecaptcha();
    const current = auth.currentUser;
    const linking = !!current && !current.phoneNumber;
    const confirmation = linking
      ? await current.linkWithPhoneNumber(toIntlPhone(phone), recaptcha)
      : await auth.signInWithPhoneNumber(toIntlPhone(phone), recaptcha);
    otp = { confirmation, name, phone, linking };
    bumpSmsStat("sent");
    showOtpStep();
  } catch (err) {
    console.warn("sms send", err);
    if (err?.code === "auth/quota-exceeded") bumpSmsStat("quotaHits");
    otp = null;
    setLoginBusy(null);
    showLoginError(smsError(err));
  }
}

async function confirmCode() {
  const code = toLatinDigits($("#loginForm").code.value).replace(/\D/g, "");
  if (code.length !== 6) return showLoginError("الكود ٦ أرقام");
  setLoginBusy("جاري التأكيد...");
  try {
    let result;
    try {
      result = await otp.confirmation.confirm(code);
    } catch (err) {
      // الرقم مربوط بحساب تاني قبل كده: ندخل بيه بدل الربط
      if (otp.linking && ["auth/credential-already-in-use", "auth/provider-already-linked", "auth/account-exists-with-different-credential"].includes(err?.code)) {
        const cred = err.credential || firebase.auth.PhoneAuthProvider.credential(otp.confirmation.verificationId, code);
        result = await firebase.auth().signInWithCredential(cred);
      } else {
        throw err;
      }
    }
    const { name, phone } = otp;
    otp = null;
    clearInterval(resendTimer);
    finishLogin({ name, phone, ...(socialInfo || {}), verified: true, uid: result.user.uid });
  } catch (err) {
    console.warn("sms confirm", err);
    setLoginBusy(null);
    showLoginError(smsError(err));
    $("#loginForm").code.select();
  }
}

// عدّاد تقريبي لرسايل النهارده بيظهر في لوحة التحكم (smsStats/<التاريخ>)
// بيتبعت عن طريق REST عشان منحمّلش Firestore SDK في المتجر
function bumpSmsStat(field) {
  const { projectId, apiKey } = FIREBASE_CONFIG;
  const doc = `projects/${projectId}/databases/(default)/documents/smsStats/${cairoDay()}`;
  fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes: [{ transform: { document: doc, fieldTransforms: [{ fieldPath: field, increment: { integerValue: "1" } }] } }] }),
  }).catch(() => {});
}

// الجلسة في Firebase لسه مربوطة بنفس الرقم؟ (ممكن تتمسح لو العميل مسح بيانات المتصفح)
async function phoneSessionMatches(u) {
  try {
    await loadFirebase(["auth"]);
    const current = await new Promise((res) => { const stop = firebase.auth().onAuthStateChanged((x) => { stop(); res(x); }); });
    return current?.phoneNumber === toIntlPhone(u.phone);
  } catch {
    return false;
  }
}

$("#otpResend").addEventListener("click", () => otp && sendCode(otp.name, otp.phone));
$("#otpChange").addEventListener("click", showStep1);
$("#otpStep").addEventListener("input", (e) => {
  // أول ما يكتب ٦ أرقام نأكد لوحده
  if (e.target.name === "code" && toLatinDigits(e.target.value).replace(/\D/g, "").length === 6) confirmCode();
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

    // من غير كود SMS: الدخول بيخلص على طول، ورقم الموبايل بيتطلب في صفحة الدفع
    if (!SMS_ON) {
      const name = (fbUser.displayName || (fbUser.email || "").split("@")[0] || "عميل").trim();
      return finishLogin({ name, phone: "", ...socialInfo });
    }

    const f = $("#loginForm");
    if (fbUser.displayName) f.name.value = fbUser.displayName;
    $("#socialBox").hidden = true;
    $("#socialLinked").hidden = false;
    $("#socialLinked").innerHTML = `✔ تم الربط بحساب ${providerNames[kind]}${fbUser.email ? ` <small dir="ltr">(${escapeHtml(fbUser.email)})</small>` : ""}<br>فاضل تكتب رقم موبايلك عشان نتواصل معاك بخصوص الطلب`;
    (f.name.value ? f.phone : f.name).focus();
  } catch (err) {
    if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err?.code)) {
      toast(`❌ مقدرناش ندخل بـ ${providerNames[kind]}، جرّب تاني (${err?.code || "unknown"})`);
    }
  } finally {
    btn.disabled = false;
  }
}

// اخفي الأزرار اللي مش متفعّلة (ولو مفيش ولا واحد اخفي الجزء كله)
$$("[data-social]").forEach((b) => (b.hidden = !!FIREBASE_CONFIG && !SOCIAL_PROVIDERS.includes(b.dataset.social)));
if (FIREBASE_CONFIG && !SOCIAL_PROVIDERS.length) $("#socialBox").classList.add("social--none");

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
  <a class="wa-float" href="${waLink("السلام عليكم، عندي استفسار عن منتجات GTECH MASR")}" target="_blank" rel="noopener" aria-label="كلمنا على واتساب">
    <span class="wa-float__tip">عندك سؤال؟ كلمنا 👋</span>
    <svg viewBox="0 0 24 24" class="wa-ico"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.2-.2-.5-.3z"/></svg>
  </a>`);

// ============ صاحبك عليا: لينك ?ref=الكود ============
const REF_KEY = "gtech-ref";
(() => {
  const code = (new URLSearchParams(location.search).get("ref") || "").toUpperCase();
  if (!/^[0-9A-Z]{4,8}$/.test(code)) return;
  if (user?.phone && referralCode(user.phone) === code) return; // لينكك إنت
  store.set(REF_KEY, { code, at: Date.now() });
  setTimeout(() => toast("🎁 صاحبك بعتلك خصم 10% على أول أوردر — هيتحسب لوحده في صفحة الدفع"), 1200);
})();
// الكود اللي العميل جه بيه (صالح 30 يوم)
function activeRef() {
  const r = store.get(REF_KEY, null);
  return r && Date.now() - r.at < 30 * 86400000 ? r.code : "";
}
// عدد مكافآت العميل (من غير SDK)
async function rewardCredits(code) {
  if (!FIREBASE_CONFIG || !code) return 0;
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/rewards/${code}?key=${FIREBASE_CONFIG.apiKey}`);
    if (!res.ok) return 0;
    return +((await res.json()).fields?.credits?.integerValue || 0);
  } catch {
    return 0;
  }
}
// كارت "صاحبك عليا" (صفحة نجاح الطلب وطلباتي)
function referralCardHtml(phone, credits = 0) {
  const link = referralLink(referralCode(phone));
  const share = `https://wa.me/?text=${encodeURIComponent(`جرّب GTECH MASR لإكسسوارات الكمبيوتر والجيمنج 🎮\nادخل من اللينك ده وخد خصم 10% على أول أوردر 👇\n${link}`)}`;
  return `
    <div class="ref-card card-box">
      <div class="ref-card__head">
        <span class="ref-card__icon">🤝</span>
        <div>
          <h3>صاحبك عليا</h3>
          <p class="muted">ابعت اللينك ده لصحابك: هما ياخدوا <b>خصم 10%</b> على أول أوردر، وإنت تاخد <b>خصم 10%</b> على أوردرك الجاي مع كل صاحب أوردره يتسلّم.</p>
        </div>
      </div>
      ${credits > 0 ? `<p class="ref-card__credits">🎁 عندك ${num(credits)} ${credits === 1 ? "مكافأة" : "مكافآت"} — الخصم هيتحسب لوحده في أوردرك الجاي</p>` : ""}
      <div class="ref-card__link"><input readonly dir="ltr" value="${escapeHtml(link)}" aria-label="لينك صاحبك عليا" /><button type="button" class="btn btn--ghost btn--sm" data-ref-copy="${escapeHtml(link)}">📋 نسخ</button></div>
      <a class="btn btn--wa-share btn--block" href="${share}" target="_blank" rel="noopener">💬 ابعته لصحابك على واتساب</a>
    </div>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ref-copy]");
  if (b) navigator.clipboard?.writeText(b.dataset.refCopy).then(() => toast("📋 اللينك اتنسخ — ابعته لصحابك"), () => {});
});

// ============ نافذة خصم أول زيارة ============
// بتظهر مرة واحدة بس للزائر الجديد (بعد 25 ثانية أو لما ينزل نص الصفحة): يكتب رقم واتساب وياخد كود الخصم.
// الرقم بيتحفظ في Firestore (leads) ويظهر في لوحة التحكم ← "أرقام العملاء".
const LEAD_KEY = "gtech-lead";
const LEAD_CODE = "GTECH10";
function saveLead(phone) {
  const lead = {
    phone,
    createdAt: new Date().toISOString(),
    page: (location.pathname.split("/").pop() || "index.html").slice(0, 80),
    source: typeof orderSource === "function" ? orderSource() : "direct",
  };
  if (!FIREBASE_CONFIG) {
    store.set("gtech-leads-local", [...store.get("gtech-leads-local", []), lead]);
    return Promise.resolve();
  }
  const root = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  return fetch(`https://firestore.googleapis.com/v1/${root}/leads?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, { stringValue: v }])) }),
  }).then((r) => { if (!r.ok) throw new Error("lead " + r.status); });
}
function openLeadPopup() {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal lead" id="leadModal" role="dialog" aria-modal="true" aria-labelledby="leadTitle">
      <form class="modal__box card-box lead__box" id="leadForm" novalidate>
        <button type="button" class="icon-btn modal__close" id="leadClose" aria-label="إغلاق">✕</button>
        <div class="lead__badge">🎁</div>
        <h3 id="leadTitle" data-no-i18n>${typeof IS_EN !== "undefined" && IS_EN ? '<span class="lead__pct">10%</span> off your first order' : 'خصم <span class="lead__pct">10%</span> على أول أوردر'}</h3>
        <p class="muted">اكتب رقم الواتساب بتاعك وخد كود الخصم فوراً، وكمان هتعرف العروض الجديدة قبل أي حد.</p>
        <label class="field"><input name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01xxxxxxxxx" dir="ltr" maxlength="14" aria-label="رقم الواتساب" /><em></em></label>
        <button class="btn btn--primary btn--block" type="submit">ابعتلي الكود 🎉</button>
        <small class="muted">مش هنزعجك — عروض بس، وتقدر تقولنا نوقف في أي وقت.</small>
      </form>
    </div>`);
  const modal = $("#leadModal"), form = $("#leadForm");
  const close = () => modal.remove();
  $("#leadClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => e.target === modal && close());
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = form.querySelector("em");
    if (!isValidPhone(form.phone.value)) { err.textContent = "رقم موبايل غير صحيح (11 رقم يبدأ بـ 01)"; return; }
    const phone = normalizePhone(form.phone.value);
    store.set(LEAD_KEY, { phone, at: Date.now() });
    store.set("gtech-promo", LEAD_CODE); // صفحة الدفع بتطبّقه لوحده
    saveLead(phone).catch((x) => console.warn("lead", x));
    if (typeof track === "function") track("generate_lead");
    form.innerHTML = `
      <button type="button" class="icon-btn modal__close" aria-label="إغلاق">✕</button>
      <div class="lead__badge">🎉</div>
      <h3>الكود بتاعك جاهز!</h3>
      <button type="button" class="lead__code" id="leadCode" title="انسخ الكود">${LEAD_CODE} <small>📋 انسخ</small></button>
      <p class="muted">خصم 10% على أول أوردر — <b>والكود هيتحط لوحده في صفحة الدفع</b>.</p>
      <button type="button" class="btn btn--primary btn--block" id="leadShop">يلا نتسوق 🛒</button>`;
    form.querySelector(".modal__close").addEventListener("click", close);
    $("#leadShop").addEventListener("click", close);
    $("#leadCode").addEventListener("click", () => {
      navigator.clipboard?.writeText(LEAD_CODE).then(() => toast("📋 الكود اتنسخ"), () => {});
    });
  });
}
(() => {
  if (store.get(LEAD_KEY, null) || user || activeRef() || isStandalone() || $("#checkoutForm") || /myorders/.test(location.pathname)) return;
  let done = false;
  const show = () => {
    if (done) return;
    // لو العميل فاتح السلة أو نافذة تانية نستنى شوية
    if ($(".cart.open") || $$(".modal:not([hidden])").length) return void setTimeout(show, 8000);
    done = true;
    removeEventListener("scroll", onScroll);
    store.set(LEAD_KEY, { shown: Date.now() });
    openLeadPopup();
  };
  const onScroll = () => { if (scrollY + innerHeight > document.body.scrollHeight * 0.55) show(); };
  setTimeout(show, 25000);
  setTimeout(() => addEventListener("scroll", onScroll, { passive: true }), 6000);
})();

// أسعار الشحن (عشان شريط الشحن المجاني) — صفحة الدفع بتحمّلها بنفسها
if (typeof loadShippingSettings === "function") {
  document.addEventListener("shippingchange", renderCart);
  if (!$("#checkoutForm")) loadShippingSettings();
}

// فقاعة "عندك سؤال؟" بتظهر مرة واحدة في الزيارة بعد شوية
(() => {
  const wa = $(".wa-float");
  try { if (sessionStorage.getItem("gtech-wa-tip")) return; sessionStorage.setItem("gtech-wa-tip", "1"); } catch { return; }
  setTimeout(() => wa.classList.add("tip"), 9000);
  setTimeout(() => wa.classList.remove("tip"), 16000);
})();
// في صفحة المنتج الرسالة بتتكتب فيها اسم المنتج ولينكه
function setWhatsAppProduct(p) {
  $(".wa-float")?.setAttribute("href", waLink(`السلام عليكم، عندي استفسار عن:\n${p.name}\n${new URL(productUrl(p.id), document.baseURI).href}`));
}

$("#year").textContent = new Date().getFullYear();
$("#wishCount").textContent = num(wishlist.length);
$("#wishCount").hidden = !wishlist.length;
renderCart();

// لما المنتجات تتحدث من لوحة التحكم: شيل من السلة أي منتج اتشال واحسب بالأسعار الجديدة
document.addEventListener("productschange", () => {
  pruneCart();
  renderCart();
  renderCompareTray();
});

renderCompareTray();

// ============ السلة المتروكة ============
// لو العميل داخل بحساب فيه إيميل (Google)، سلته بتتحفظ في carts/{uid}
// عشان صاحب المتجر يقدر يبعتله تذكير من لوحة التحكم لو ساب السلة من غير ما يطلب
const CARTS_LOCAL = "gtech-carts-local"; // الوضع التجريبي
const CART_SYNCED = "gtech-cart-synced";
let cartSyncTimer = null;

function cartSnapshot() {
  return cart.map((i) => {
    const p = findProduct(i.id);
    return { id: p.id, name: String(p.name).slice(0, 120), price: p.price, qty: i.qty, opts: i.opts || "" };
  });
}

async function syncCart() {
  if (!user?.uid || !(user.email || user.phone)) return;
  const items = cartSnapshot();
  const sig = JSON.stringify([user.uid, items.map((i) => [i.id, i.qty, i.opts])]);
  if (store.get(CART_SYNCED, "") === sig) return; // مفيش تغيير (فتح صفحة بس)
  const doc = items.length && {
    uid: user.uid,
    email: String(user.email || ""),
    phone: String(user.phone || "").slice(0, 14),
    name: String(user.name || "").slice(0, 60),
    items: items.slice(0, 50),
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    updatedAt: new Date().toISOString(),
  };
  try {
    if (!FIREBASE_CONFIG) {
      const all = store.get(CARTS_LOCAL, {});
      if (doc) all[user.uid] = doc;
      else delete all[user.uid];
      store.set(CARTS_LOCAL, all);
    } else {
      await loadFirebase(["auth", "firestore"]);
      const fbUser = await new Promise((res) => { const stop = firebase.auth().onAuthStateChanged((u) => { stop(); res(u); }); });
      if (fbUser?.uid !== user.uid) return;
      const ref = firebase.firestore().collection("carts").doc(user.uid);
      await (doc ? ref.set(doc) : ref.delete());
    }
    store.set(CART_SYNCED, sig);
  } catch (err) {
    console.warn("cart sync", err);
  }
}
document.addEventListener("cartchange", () => {
  clearTimeout(cartSyncTimer);
  cartSyncTimer = setTimeout(syncCart, 2500);
});
document.addEventListener("userchange", () => setTimeout(syncCart, 500));

// صفحات المنتجات الثابتة (p/) فيها <base href="../">، فأي لينك "#قسم" كان بيروح للرئيسية.
// لو القسم موجود في نفس الصفحة بننزل له هنا بدل ما نسيب الصفحة
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || !document.querySelector("base")) return;
  const id = a.getAttribute("href").slice(1);
  const target = id && document.getElementById(id);
  if (!id || target) e.preventDefault();
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
});
