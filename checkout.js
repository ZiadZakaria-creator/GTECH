// ============ صفحة إتمام الشراء ============
// أسعار الشحن لكل محافظة جاية من shipping.js (وصاحب المتجر بيغيّرها من لوحة التحكم)
// SHUKRAN10: للي اشتروا قبل كده (مكتوب في كارت الشكر اللي بيتحط جوه الأوردر)
const promos = { GTECH10: 0.1, SHUKRAN10: 0.1 };
// عرض أول أوردر من التطبيق: خصم 20% + توصيل مجاني (مايتجمعش مع كود خصم)
const APP_FIRST = { code: "APP-FIRST20", rate: 0.2 };
let firstOrder = null; // null = لسه بنتأكد، true = دي أول مرة يطلب، false = طلب قبل كده
const payLabels = { cod: "الدفع عند الاستلام", instapay: "إنستاباي", vodafone: "فودافون كاش" };

const form = $("#checkoutForm");
let promo = null;
let placed = false;
let checkoutTracked = false; // بدء الدفع بيتحسب مرة واحدة

function totals() {
  const sub = cart.reduce((s, i) => s + i.qty * findProduct(i.id).price, 0);
  const bundle = bundleTotal(); // خصم باكدجات السيت أب
  const base = sub - bundle;    // خصم أول أوردر أو الكود بيتحسب على السعر بعد الباكدج
  const app = appOffer();
  const ship = app ? 0 : shipCost(form.gov.value, form.ship.value, sub) ?? 0;
  const disc = app ? Math.round(base * APP_FIRST.rate) : promo ? Math.round(base * promos[promo]) : 0;
  return { sub, bundle, ship, disc, total: base + ship - disc, app };
}

function renderSummary() {
  if (placed) return;
  const empty = !cart.length;
  const locked = !empty && !user;
  $("#checkoutView").hidden = empty || locked;
  $("#emptyView").hidden = !empty;
  $("#loginView").hidden = !locked;
  if (empty || locked) return;
  if (!checkoutTracked && typeof track === "function") {
    checkoutTracked = true;
    track("begin_checkout", { items: cart.map((i) => { const p = findProduct(i.id); return { id: p.id, name: p.name, price: p.price, qty: i.qty }; }) });
  }

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
  $("#sumShip").textContent = shipNow === null ? (gov ? "مش متاح" : "اختار المحافظة") : t.app ? "مجاناً 🎁" : shipNow ? fmt(shipNow) : "مجاناً";
  const left = s.freeOver - t.sub;
  $("#freeShipHint").hidden = t.app || !(s.freeOver > 0 && left > 0 && std);
  $("#sumDiscLabel").textContent = t.app ? "🎁 خصم أول أوردر من التطبيق (20%)" : "الخصم";
  $("#appOffer").hidden = !(firstOrder === true && !isStandalone() && FIREBASE_CONFIG);
  $("#freeShipHint").textContent = `🚚 ضيف منتجات بـ ${fmt(left)} كمان والشحن يبقى مجاناً`;
  $("#sumDiscRow").hidden = !t.disc;
  $("#sumBundleRow").hidden = !t.bundle;
  $("#sumBundle").textContent = "− " + fmt(t.bundle);
  $("#sumDisc").textContent = "− " + fmt(t.disc);
  $("#sumTotal").textContent = fmt(t.total);
}

// ============ كود الخصم ============
$("#promoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = e.target.code.value.trim().toUpperCase();
  if (!code) return;
  if (/^(REF|REWARD)-/.test(promo || "") && !promos[code]) return; // خصم صاحبك عليا متطبّق خلاص
  if (appOffer()) {
    promo = null;
    toast("🎁 إنت واخد خصم أول أوردر من التطبيق (20% + توصيل مجاني)، وده أحسن من أي كود");
  } else if (promos[code]) {
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
  if (e.target.name === "pay") renderPayOptions();
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
    payment: isTransfer(d.pay) ? { method: d.pay, label: payLabels[d.pay], status: "pending", to: transferTarget(d.pay) } : { method: d.pay, label: payLabels[d.pay] },
    promo: t.app ? APP_FIRST.code : promo,
    source: typeof orderSource === "function" ? orderSource() : "direct",
    // الخصم = الباكدج + (أول أوردر أو الكود)، عشان المجموع − الخصم + الشحن = الإجمالي في اللوحة والإيميل
    totals: { subtotal: t.sub, shipping: t.ship, discount: t.disc + t.bundle, total: t.total },
    bundles: bundleDiscounts().map((d) => ({ id: d.id, name: d.name, sets: d.sets, amount: d.amount })),
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
    if (typeof track === "function") track("purchase", { items: order.items, value: order.totals.total, orderId: order.id });
    store.set(HAS_ORDERS_KEY, true);
    sendOrderEmail(order, "new")
      .then((sent) => sent && showEmailStatus(`📧 بعتنالك تأكيد الطلب على ${order.customer.email}`))
      .catch((err) => {
        console.warn("order email", err);
        showEmailStatus(`⚠️ الطلب وصلنا بس إيميل التأكيد ماتبعتش (${String(err.message).slice(0, 80)})`);
      });
    notifyStoreOfOrder(order).catch((err) => console.warn("store email", err));
    pushStoreOfOrder(order).catch((err) => console.warn("store push", err));
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
  if (promo === store.get("gtech-promo", "")) store.set("gtech-promo", ""); // كود أول أوردر بيتطبّق لوحده مرة واحدة بس
  if (promo?.startsWith("REF-")) store.set(REF_KEY, null);
  cart = [];
  renderCart();
  clearTimeout(cartSyncTimer);
  syncCart(); // الطلب اتعمل، فالسلة مش متروكة

  const days = order.shipping.method === "express" ? 1 : 3;
  const date = new Date(Date.now() + days * 86400000).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  $("#okName").textContent = order.customer.name;
  $("#okPhone").textContent = order.customer.phone;
  $("#okId").textContent = order.id;
  $("#okTotal").textContent = fmt(order.totals.total);
  $("#okPay").textContent = order.payment.label;
  $("#okDate").textContent = date;
  $("#okAddr").textContent = `${order.address.street}، ${order.address.city}، ${order.address.gov}`;

  if (isTransfer(order.payment.method)) showPayBox(order);
  $("#successView .success__box").insertAdjacentHTML("afterend", referralCardHtml(order.customer.phone));

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

// ============ عرض أول أوردر من التطبيق ============
// بيشتغل لما المتجر مفتوح كتطبيق متسطّب، والعميل ده ماطلبش قبل كده
function appOffer() {
  return firstOrder === true && isStandalone();
}
function checkFirstOrder() {
  if (!user) return;
  if (store.get(HAS_ORDERS_KEY, false) || !FIREBASE_CONFIG) {
    firstOrder = false;
    return renderSummary();
  }
  const stop = watchMyOrders(null, (list) => {
    firstOrder = !list.length;
    setTimeout(() => stop(), 0);
    renderSummary();
  }, () => { firstOrder = false; renderSummary(); });
}
$("#appOfferBtn")?.addEventListener("click", installApp);
document.addEventListener("userchange", checkFirstOrder);
checkFirstOrder();

// ============ الدفع بالتحويل (إنستاباي / فودافون كاش) ============
function renderPayOptions() {
  $("#payInstapay").hidden = !transferTarget("instapay");
  $("#payVodafone").hidden = !transferTarget("vodafone");
  const chosen = form.querySelector('input[name="pay"]:checked');
  if (chosen?.closest(".choice")?.hidden) form.pay.value = "cod";
  $("#payNote").hidden = !isTransfer(form.pay.value);
}

function showPayBox(order) {
  const p = order.payment;
  $("#payBox").hidden = false;
  $("#payAmount").textContent = fmt(order.totals.total);
  $("#payMethod").textContent = TRANSFER_METHODS[p.method].label;
  $("#payTarget").textContent = p.to;
  $("#payOrderId").textContent = order.id;
  $("#payHolder").hidden = !paymentSettings.holder;
  $("#payHolder").textContent = `باسم: ${paymentSettings.holder || ""}`;
  $("#proofWa").href = proofWhatsApp(order);
  $("#payCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(p.to); toast("📋 اتنسخ"); } catch { toast(p.to); }
  };
  $("#proofFile").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const st = $("#proofStatus");
    st.hidden = false;
    st.className = "pay-box__status";
    st.textContent = "⏳ بنرفع الصورة...";
    try {
      await uploadProof(order.id, file);
      st.classList.add("is-ok");
      st.textContent = "✅ صورة التحويل وصلتنا — هنأكد طلبك أول ما نراجعها";
    } catch (err) {
      console.error(err);
      st.classList.add("is-bad");
      st.textContent = "⚠️ الصورة مارفعتش — ابعتها واتساب من الزرار اللي جنبها";
    }
  };
}

// كود الخصم اللي العميل خده من نافذة أول زيارة بيتطبّق لوحده
(() => {
  const saved = store.get("gtech-promo", "");
  if (!promos[saved] || appOffer()) return;
  promo = saved;
  $("#promoForm").code.value = saved;
  renderSummary();
})();

// ============ صاحبك عليا ============
// مكافأة العميل (لو صحابه اشتروا من لينكه) ← أو خصم الصاحب لو جه من لينك حد. نفس الـ 10%، وبيتطبّق لوحده.
async function applyReferral() {
  const own = user?.phone ? referralCode(user.phone) : "";
  if (promo === "REF-" + own) promo = null; // مينفعش تستخدم لينكك إنت
  if (appOffer() || (promo && !/^REF-/.test(promo))) return renderSummary();
  if (own && (await rewardCredits(own)) > 0 && !appOffer()) {
    promo = "REWARD-" + own;
    promos[promo] = REF_RATE;
    $("#promoForm").code.value = "🎁 مكافأة صاحبك عليا";
    toast("🎁 عندك مكافأة من صحابك: خصم 10% اتطبق على الأوردر ده");
    return renderSummary();
  }
  const ref = activeRef();
  if (ref && ref !== own && !promo) {
    promo = "REF-" + ref;
    promos[promo] = REF_RATE;
    $("#promoForm").code.value = "🤝 خصم صاحبك";
  }
  renderSummary();
}
applyReferral();
document.addEventListener("userchange", applyReferral);

document.addEventListener("paymentchange", renderPayOptions);
renderPayOptions();
