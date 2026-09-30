// ============ صفحة إتمام الشراء ============
// أسعار الشحن لكل محافظة جاية من shipping.js (وصاحب المتجر بيغيّرها من لوحة التحكم)
const promos = { GTECH10: 0.1 };
const payLabels = { cod: "الدفع عند الاستلام", card: "بطاقة بنكية", install: "تقسيط بدون فوائد", wallet: "محفظة إلكترونية" };

const form = $("#checkoutForm");
let promo = null;
let placed = false;

function totals() {
  const sub = cart.reduce((s, i) => s + i.qty * findProduct(i.id).price, 0);
  const ship = shipCost(form.gov.value, form.ship.value, sub) ?? 0;
  const disc = promo ? Math.round(sub * promos[promo]) : 0;
  return { sub, ship, disc, total: sub + ship - disc };
}

function renderSummary() {
  if (placed) return;
  const empty = !cart.length;
  const locked = !empty && !user;
  $("#checkoutView").hidden = empty || locked;
  $("#emptyView").hidden = !empty;
  $("#loginView").hidden = !locked;
  if (empty || locked) return;

  // بيانات التواصل جاية من الحساب
  form.elements.name.value = user.name;
  // لو الحساب مفيهوش رقم (دخول بـ Google) العميل يكتبه هنا مرة واحدة
  const phoneEl = form.elements.phone;
  phoneEl.readOnly = !!user.phone;
  if (user.phone) phoneEl.value = user.phone;
  if (!form.elements.email.value && user.email) form.elements.email.value = user.email;
  $("#accountNote").innerHTML = `✔ داخل باسم <b>${escapeHtml(user.name)}</b> — <button type="button" class="link-btn" id="switchUser">مش إنت؟ غيّر الحساب</button>`;

  const count = cart.reduce((s, i) => s + i.qty, 0);
  $("#sumCount").textContent = `(${num(count)} منتج)`;
  $("#sumItems").innerHTML = cart.map((i) => {
    const p = findProduct(i.id);
    return `
      <div class="sum-item">
        <span class="sum-item__icon">${productVisual(p)}<i>${num(i.qty)}</i></span>
        <div><b>${p.name}</b>${i.opts ? `<small>${i.opts}</small>` : ""}</div>
        <strong>${fmt(p.price * i.qty)}</strong>
      </div>`;
  }).join("");

  const t = totals();
  const gov = form.gov.value;
  const s = shippingSettings;
  // الشحن السريع بيظهر بس للمحافظات اللي صاحب المتجر مفعّله ليها
  const express = hasExpress(gov);
  $("#expressChoice").hidden = !!gov && !express;
  $("#expressNote").textContent = `خلال 24 ساعة (${s.express.govs.join(" و") || "محافظات محددة"})`;
  if (!express && form.ship.value === "express") form.ship.value = "standard";
  const std = shipCost(gov, "standard", t.sub);
  const priceText = (v) => (v === null ? (gov ? "—" : "حسب المحافظة") : v ? fmt(v) : "مجاناً");
  $('[data-ship-price="standard"]').textContent = priceText(std);
  $('[data-ship-price="express"]').textContent = fmt(s.express.price);
  $("#sumSub").textContent = fmt(t.sub);
  const shipNow = shipCost(gov, form.ship.value, t.sub);
  $("#sumShip").textContent = shipNow === null ? (gov ? "مش متاح" : "اختار المحافظة") : shipNow ? fmt(shipNow) : "مجاناً";
  const left = s.freeOver - t.sub;
  $("#freeShipHint").hidden = !(s.freeOver > 0 && left > 0 && std);
  $("#freeShipHint").textContent = `🚚 ضيف منتجات بـ ${fmt(left)} كمان والشحن يبقى مجاناً`;
  $("#sumDiscRow").hidden = !t.disc;
  $("#sumDisc").textContent = "− " + fmt(t.disc);
  $("#sumTotal").textContent = fmt(t.total);
}

// ============ كود الخصم ============
$("#promoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = e.target.code.value.trim().toUpperCase();
  if (!code) return;
  if (promos[code]) {
    promo = code;
    toast(`🎁 تم تطبيق الكود ${code} — خصم ${num(promos[code] * 100)}%`);
  } else {
    promo = null;
    toast("❌ الكود ده مش صالح");
  }
  renderSummary();
});

// ============ التحقق من البيانات ============
const rules = {
  name: (v) => v.trim().length >= 3 || "اكتب اسمك بالكامل",
  phone: (v) => isValidPhone(v) || "رقم موبايل غير صحيح (11 رقم يبدأ بـ 01)",
  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "البريد الإلكتروني غير صحيح",
  gov: (v) => (!v ? "اختار المحافظة" : deliversTo(v) || "للأسف مش بنوصّل للمحافظة دي لسه، كلمنا واتساب"),
  city: (v) => v.trim().length >= 2 || "اكتب المدينة أو المنطقة",
  address: (v) => v.trim().length >= 8 || "اكتب العنوان بالتفصيل",
};

function validateField(el) {
  const rule = rules[el.name];
  if (!rule) return true;
  const res = rule(el.value);
  const field = el.closest(".field");
  field.classList.toggle("invalid", res !== true);
  field.querySelector("em").textContent = res === true ? "" : res;
  return res === true;
}

form.addEventListener("focusout", (e) => { if (e.target.name in rules) validateField(e.target); });
form.addEventListener("input", (e) => {
  if (e.target.closest(".field.invalid")) validateField(e.target);
  if (e.target.name === "ship" || e.target.name === "gov") renderSummary();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fields = Object.keys(rules).map((n) => form.elements[n]);
  const bad = fields.filter((el) => !validateField(el));
  if (bad.length) {
    bad[0].focus();
    bad[0].scrollIntoView({ behavior: "smooth", block: "center" });
    return toast("⚠️ راجع البيانات المطلوبة");
  }
  if (!form.agree.checked) return toast("⚠️ لازم توافق على الشروط والأحكام");
  const soldOut = cart.map((i) => findProduct(i.id)).find((p) => !inStock(p));
  if (soldOut) return toast(`😔 "${soldOut.name}" نفد من المخزون، شيله من السلة وكمّل`);
  placeOrder();
});

const shipLabels = { standard: "شحن عادي (2-4 أيام)", express: "شحن سريع (24 ساعة)" };

// ============ الدخول ============
const gate = () => requireLogin(renderSummary, "سجّل دخولك عشان تكمّل الطلب");
$("#loginGateBtn").addEventListener("click", gate);
form.addEventListener("click", (e) => {
  if (e.target.id !== "switchUser") return;
  user = null;
  store.set("gtech-user", null);
  renderAccount();
  renderSummary();
  gate();
});
document.addEventListener("userchange", renderSummary);

// ============ إرسال الطلب ============
// شكل الطلب ده هو اللي الداشبورد هيقراه بعدين
function buildOrder(d, t) {
  return {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    status: "new",
    customer: { name: user.name, phone: normalizePhone(d.phone), email: d.email.trim() },
    address: { gov: d.gov, city: d.city.trim(), street: d.address.trim(), notes: d.notes.trim() },
    items: cart.map((i) => {
      const p = findProduct(i.id);
      return { id: p.id, name: p.name, options: i.opts || "", price: p.price, qty: i.qty };
    }),
    shipping: { method: d.ship, label: shipLabels[d.ship], cost: t.ship },
    payment: { method: d.pay, label: payLabels[d.pay] },
    promo: promo,
    totals: { subtotal: t.sub, shipping: t.ship, discount: t.disc, total: t.total },
  };
}

async function placeOrder() {
  if (!user) return gate();
  if (SMS_ON && !(await phoneSessionMatches(user))) {
    user = { ...user, verified: false };
    store.set("gtech-user", user);
    renderAccount();
    return requireLogin(placeOrder, "محتاجين نأكد رقمك تاني بكود SMS عشان نبعت الطلب");
  }
  const d = Object.fromEntries(new FormData(form));
  const order = buildOrder(d, totals());

  const btn = $("#placeOrder");
  btn.disabled = true;
  btn.textContent = "جاري إرسال الطلب...";
  try {
    await submitOrder(order);
    store.set(HAS_ORDERS_KEY, true);
    sendOrderEmail(order, "new")
      .then((sent) => sent && showEmailStatus(`📧 بعتنالك تأكيد الطلب على ${order.customer.email}`))
      .catch((err) => {
        console.warn("order email", err);
        showEmailStatus(`⚠️ الطلب وصلنا بس إيميل التأكيد ماتبعتش (${String(err.message).slice(0, 80)})`);
      });
    notifyStoreOfOrder(order).catch((err) => console.warn("store email", err));
    if (!user.phone) {
      user = { ...user, phone: order.customer.phone };
      store.set("gtech-user", user);
      renderAccount();
    }
  } catch {
    btn.disabled = false;
    btn.textContent = "إرسال الطلب";
    return toast("❌ حصلت مشكلة في الإرسال، جرّب تاني");
  }

  placed = true;
  cart = [];
  renderCart();
  clearTimeout(cartSyncTimer);
  syncCart(); // الطلب اتعمل، فالسلة مش متروكة

  const days = order.shipping.method === "express" ? 1 : 3;
  const date = new Date(Date.now() + days * 86400000).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  $("#okName").textContent = order.customer.name;
  $("#okPhone").textContent = order.customer.phone;
  $("#okId").textContent = order.id;
  $("#okTotal").textContent = fmt(order.totals.total);
  $("#okPay").textContent = order.payment.label;
  $("#okDate").textContent = date;
  $("#okAddr").textContent = `${order.address.street}، ${order.address.city}، ${order.address.gov}`;

  $("#checkoutView").hidden = true;
  $("#successView").hidden = false;
  document.title = "GTECH | تم إرسال الطلب";
  scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("cartchange", renderSummary);
document.addEventListener("productschange", renderSummary);
renderSummary();
if (cart.length && !user) gate();

function showEmailStatus(text) {
  $("#okEmail").hidden = false;
  $("#okEmail").textContent = text;
}

// ============ المحافظات وأسعار الشحن ============
form.gov.insertAdjacentHTML("beforeend", GOVERNORATES.map((g) => `<option>${g.name}</option>`).join(""));
document.addEventListener("shippingchange", renderSummary);
loadShippingSettings();
