// ============ لوحة التحكم ============
const STATUS_ORDER = ["new", "confirmed", "shipped", "delivered", "cancelled"];
const STATUS_ICONS = { new: "🆕", confirmed: "✅", shipped: "🚚", delivered: "📦", cancelled: "✖" };

let orders = [];
let statusFilter = "all";
let range = "all";
let query = "";
let openId = null;
let knownIds = null; // لمعرفة الطلبات الجديدة اللي وصلت بعد فتح الصفحة
let soundOn = store.get("gtech-admin-sound", true);
let stopWatching = () => {};

const dateFmt = (iso, opts) => new Date(iso).toLocaleString("ar-EG", opts);
const shortDate = (iso) => dateFmt(iso, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const itemsCount = (o) => o.items.reduce((s, i) => s + i.qty, 0);
const statusPill = (s) => `<span class="pill-status pill-status--${s}">${STATUS_ICONS[s]} ${ORDER_STATUSES[s]}</span>`;

// ============ البداية ============
$("#modeBadge").textContent = USE_FIREBASE ? "النظام متصل" : "وضع تجريبي";
$("#modeBadge").classList.add(USE_FIREBASE ? "mode-badge--live" : "mode-badge--demo");

if (USE_FIREBASE) initFirebaseAdmin();
else {
  $("#demoNote").hidden = false;
  startDashboard();
}

function startDashboard() {
  $("#adminGate").hidden = true;
  $("#dashboard").hidden = false;
  startSmsMeter();
  store.set("gtech-admin-browser", true); // زياراتك للمتجر من المتصفح ده ماتتحسبش في عدد الزوار
  document.dispatchEvent(new Event("dashboardready"));
  stopWatching = watchOrders(onOrders, (err) => {
    console.error(err);
    const denied = err?.code === "permission-denied";
    toast(denied ? "⛔ الحساب ده مش مسموح له يشوف الطلبات" : "❌ مشكلة في الاتصال بقاعدة البيانات");
  });
}

// ============ دخول الأدمن (Firebase) ============
async function initFirebaseAdmin() {
  try {
    await loadFirebase(["auth", "firestore"]);
  } catch {
    return toast("❌ مقدرناش نحمّل Firebase، اتأكد من الإنترنت");
  }
  firebase.auth().onAuthStateChanged(async (u) => {
    let isAdmin = u && !u.isAnonymous && u.email;
    // نفس تسجيل الدخول متشارك مع المتجر: لو دخلت كعميل (Google) من المتجر، الحساب ده مش أدمن
    // فبنتأكد إن له مستند في admins قبل ما نفتح اللوحة، بدل ما تفتح فاضية وكل حاجة مرفوضة
    $("#gateWarn").hidden = true;
    if (isAdmin) {
      try {
        isAdmin = (await firebase.firestore().collection("admins").doc(u.uid).get()).exists;
      } catch (err) {
        isAdmin = err?.code !== "permission-denied"; // مشكلة نت مؤقتة: نكمّل زي الأول
      }
      if (!isAdmin) {
        $("#gateWarn").textContent = `⚠️ إنت داخل دلوقتي بحساب ${u.email} (حساب عميل من المتجر) — ده مش حساب الأدمن. ادخل بإيميل وباسورد الأدمن تحت.`;
        $("#gateWarn").hidden = false;
      }
    }
    $("#adminLogout").hidden = !isAdmin;
    // اسم الأدمن فوق (من الإيميل)
    $("#adUser").hidden = !isAdmin;
    if (isAdmin) {
      const nm = u.displayName || u.email.split("@")[0];
      $("#adUserName").textContent = nm;
      $("#adUserAv").textContent = nm.slice(0, 2).toUpperCase();
      $("#adUser").title = u.email;
    }
    if (isAdmin) startDashboard();
    else {
      stopWatching();
      $("#dashboard").hidden = true;
      $("#adminGate").hidden = false;
    }
  });
}

$("#adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector("button");
  btn.disabled = true;
  try {
    await firebase.auth().signInWithEmailAndPassword(f.email.value.trim(), f.password.value);
    f.reset();
  } catch {
    toast("❌ الإيميل أو كلمة المرور غلط");
  } finally {
    btn.disabled = false;
  }
});
$("#adminLogout").addEventListener("click", () => firebase.auth().signOut());

// ============ استقبال الطلبات ============
function onOrders(list) {
  orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ids = new Set(orders.map((o) => o.id));
  if (knownIds) {
    const fresh = orders.filter((o) => !knownIds.has(o.id));
    if (fresh.length) notifyNew(fresh);
  }
  knownIds = ids;
  try { handleCustomerCancels(); } catch (err) { console.warn("cancels", err); } // admin-products.js لسه بيتحمّل
  render();
  if (openId) openOrder(openId, false);
  document.dispatchEvent(new Event("adminorders")); // قايمة العملاء بتتحدث منها
}

// العميل لغى طلب كان متأكد (والمخزون اتخصم) ← المخزون يرجع مرة واحدة بس
const cancelSeen = new Set();
let cancelsReady = false;
function handleCustomerCancels() {
  orders.filter((o) => o.status === "cancelled" && o.cancelledBy === "customer").forEach((o) => {
    if (cancelSeen.has(o.id)) return;
    cancelSeen.add(o.id);
    if (cancelsReady) {
      toast(`✖ ${o.customer.name} لغى الطلب ${o.id}`);
      if (soundOn) beep();
    }
    if (HOLDS_STOCK(o.cancelledFrom) && !o.stockReleased) {
      syncStockForStatus(o, o.cancelledFrom, "cancelled")
        .then(() => updateOrder(o.id, { stockReleased: true }))
        .catch((err) => console.warn("cancel stock", err));
    }
  });
  cancelsReady = true;
}

function notifyNew(fresh) {
  toast(fresh.length === 1 ? `🔔 طلب جديد من ${fresh[0].customer.name} — ${fmt(fresh[0].totals.total)}` : `🔔 وصل ${num(fresh.length)} طلبات جديدة`);
  if (soundOn) beep();
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.25);
    });
  } catch {}
}

function renderSoundBtn() {
  $("#soundBtn").textContent = soundOn ? "🔔" : "🔕";
}
$("#soundBtn").addEventListener("click", () => {
  soundOn = !soundOn;
  store.set("gtech-admin-sound", soundOn);
  renderSoundBtn();
  toast(soundOn ? "🔔 صوت الإشعارات شغال" : "🔕 صوت الإشعارات مقفول");
});
renderSoundBtn();

// ============ الفلترة ============
function inRange(o) {
  if (range === "all") return true;
  if (range === "today") return isToday(o.createdAt);
  return Date.now() - new Date(o.createdAt) <= +range * 86400000;
}

function matches(o) {
  if (!query) return true;
  const q = toLatinDigits(query.trim().toLowerCase());
  return [o.id, o.customer.name, o.customer.phone, o.address.gov, o.address.city].some((v) => String(v).toLowerCase().includes(q));
}

function visibleOrders() {
  return orders.filter((o) => inRange(o) && matches(o) && (statusFilter === "all" || o.status === statusFilter));
}

// ============ العرض ============
function render() {
  const pending = orders.filter((o) => o.status === "new").length;
  document.title = (pending ? `(${pending}) ` : "") + "GTECH MASR | لوحة التحكم";
  $("#newCountBadge").hidden = !pending;
  $("#newCountBadge").textContent = num(pending);

  renderStats();
  renderTabs();

  const list = visibleOrders();
  $("#ordersBody").innerHTML = list.map((o) => `
    <tr data-id="${escapeHtml(o.id)}" class="${o.status === "new" ? "is-new" : ""}">
      <td data-label="رقم الطلب"><b class="mono">${escapeHtml(o.id)}</b></td>
      <td data-label="التاريخ">${shortDate(o.createdAt)}</td>
      <td data-label="العميل"><b>${escapeHtml(o.customer.name)}</b><small class="mono" dir="ltr">${escapeHtml(o.customer.phone)}</small></td>
      <td data-label="المحافظة">${escapeHtml(o.address.gov)}</td>
      <td data-label="المنتجات">${num(itemsCount(o))} منتج</td>
      <td data-label="الإجمالي"><b>${fmt(o.totals.total)}</b></td>
      <td data-label="الدفع">${escapeHtml(o.payment.label)}${o.payment.status === "pending" ? ` <span class="pay-pill">⏳ مستني التحويل</span>` : o.payment.status === "paid" ? ` <span class="pay-pill pay-pill--ok">✅ اتدفع</span>` : ""}</td>
      <td data-label="الحالة">${statusPill(o.status)}</td>
    </tr>`).join("");

  const empty = !list.length;
  $("#ordersEmpty").hidden = !empty;
  $("#emptyText").textContent = orders.length ? "مفيش طلبات مطابقة للفلتر ده" : "مفيش طلبات لسه — أول ما عميل يبعت طلب هيظهر هنا";
}

function renderStats() {
  const scoped = orders.filter(inRange);
  const valid = scoped.filter((o) => o.status !== "cancelled");
  const revenue = valid.reduce((s, o) => s + o.totals.total, 0);
  const today = orders.filter((o) => isToday(o.createdAt));
  const pending = orders.filter((o) => o.status === "new").length;
  const rangeLabel = $("#rangeSel").selectedOptions[0].textContent;

  $("#stats").innerHTML = [
    { icon: "🆕", label: "طلبات محتاجة تأكيد", value: num(pending), hint: pending ? "راجعها وأكّد مع العملاء" : "مفيش حاجة مستنية", accent: pending ? "warn" : "" },
    { icon: "📅", label: "طلبات النهارده", value: num(today.length), hint: fmt(today.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.totals.total, 0)) },
    { icon: "💰", label: "إجمالي المبيعات", value: fmt(revenue), hint: `${rangeLabel} · من غير الملغي` },
    { icon: "🧾", label: "متوسط قيمة الطلب", value: fmt(valid.length ? Math.round(revenue / valid.length) : 0), hint: `${num(valid.length)} طلب` },
  ].map((s) => `
    <div class="stat card-box ${s.accent ? "stat--" + s.accent : ""}">
      <span class="stat__icon">${s.icon}</span>
      <div><small>${s.label}</small><b>${s.value}</b><em>${s.hint}</em></div>
    </div>`).join("");
}

function renderTabs() {
  const scoped = orders.filter((o) => inRange(o) && matches(o));
  const count = (s) => scoped.filter((o) => s === "all" || o.status === s).length;
  $("#statusTabs").innerHTML = ["all", ...STATUS_ORDER].map((s) => `
    <button class="tab ${statusFilter === s ? "active" : ""}" data-status="${s}">
      ${s === "all" ? "الكل" : ORDER_STATUSES[s]} <span class="tab__count">${num(count(s))}</span>
    </button>`).join("");
}

$("#statusTabs").addEventListener("click", (e) => {
  const t = e.target.closest("[data-status]");
  if (!t) return;
  statusFilter = t.dataset.status;
  render();
});
$("#rangeSel").addEventListener("change", (e) => { range = e.target.value; render(); });
$("#searchBox").addEventListener("input", (e) => { query = e.target.value; render(); });

// ============ تفاصيل الطلب ============
$("#ordersBody").addEventListener("click", (e) => {
  const row = e.target.closest("tr[data-id]");
  if (row) openOrder(row.dataset.id);
});

function openOrder(id, show = true) {
  const o = orders.find((x) => x.id === id);
  if (!o) return closeOrder();
  openId = id;
  const c = o.customer, a = o.address, t = o.totals;
  const intlPhone = "2" + c.phone;
  // رسالة واتساب جاهزة لتأكيد الطلب: المنتجات والسعر والعنوان وميعاد الإرسال
  const egpTxt = (n) => `${Number(n).toLocaleString("en-US")} ج.م`;
  const greet = [
    `أهلاً ${c.name} 👋`,
    `معاك GTECH MASR، بنأكد طلبك رقم ${o.id} ✅`,
    ``,
    `🛒 الطلب:`,
    ...o.items.map((i) => `• ${i.name}${i.options ? ` (${i.options})` : ""}${i.qty > 1 ? ` × ${i.qty}` : ""} — ${egpTxt(i.price * i.qty)}`),
    t.discount ? `🎁 الخصم: − ${egpTxt(t.discount)}` : null,
    `🚚 الشحن: ${t.shipping ? egpTxt(t.shipping) : "مجاناً"}`,
    `💰 الإجمالي: ${egpTxt(t.total)}${o.payment?.label ? ` — ${o.payment.label}` : ""}`,
    ``,
    `📍 العنوان: ${[a.street, a.city, a.gov].filter(Boolean).join("، ")}`,
    ``,
    `📦 طلبك هيتم إرساله خلال 4 أيام عمل.`,
    `🔎 تابع حالة طلبك من هنا: ${siteUrl("myorders.html")}`,
    `لو في أي تعديل في الطلب أو العنوان رد علينا هنا 🙏`,
  ].filter((l) => l !== null).join("\n");
  // رسالة "طلبك اتشحن" برقم التتبع (بتظهر بعد ما تحط رقم التتبع)
  const sh = o.shipment;
  const shipMsg = sh?.trackingNumber ? [
    `أهلاً ${c.name} 👋`,
    `طلبك رقم ${o.id} اتشحن 🚚`,
    ``,
    `شركة الشحن: ${carrierName(sh)}`,
    `رقم التتبع: ${sh.trackingNumber}`,
    shipmentTrackUrl(sh) ? `تتبع الشحنة: ${shipmentTrackUrl(sh)}` : null,
    ``,
    o.payment?.status === "paid" ? `✅ الطلب مدفوع، مش هتدفع حاجة للمندوب.` : `💵 جهّز ${egpTxt(t.total)} للمندوب عند الاستلام.`,
    `المندوب هيكلمك قبل ما يوصل، ولو في أي حاجة كلمنا هنا 🙏`,
  ].filter((l) => l !== null).join("\n") : "";
  // تنبيه مشكلة توصيل: منطقة العميل خارج نطاق شركة الشحن + اختيارات يرد بيها
  const paid = o.payment?.status === "paid";
  const zoneMsg = [
    `أهلاً ${c.name} 👋`,
    `معاك GTECH MASR بخصوص طلبك رقم ${o.id} ⚠️`,
    ``,
    `للأسف شركة الشحن بلّغتنا إن منطقتك (${[a.city, a.gov].filter(Boolean).join("، ")}) خارج نطاق التوصيل بتاعها حالياً، فمش هنقدر نوصّل الطلب على العنوان ده.`,
    ``,
    `عشان نكمّل طلبك، اختار اللي يناسبك:`,
    `1️⃣ تبعتلنا عنوان تاني قريب منك (شغل، قرايب، أو أقرب مدينة)`,
    `2️⃣ تستلم الطلب من أقرب فرع لشركة الشحن`,
    `3️⃣ نلغي الطلب${paid ? " ونرجعلك المبلغ كامل" : " من غير أي مصاريف"}`,
    ``,
    `رد علينا برقم الاختيار، ونعتذر جداً عن الإزعاج 🙏`,
  ].join("\n");

  $("#drawerTitle").innerHTML = `طلب <span class="mono">${escapeHtml(o.id)}</span>`;
  $("#drawerBody").innerHTML = `
    <div class="od-status">
      ${statusPill(o.status)}
      <small>${dateFmt(o.createdAt, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}</small>
    </div>

    <div class="od-steps">
      ${STATUS_ORDER.map((s) => `<button class="od-step ${o.status === s ? "active" : ""} od-step--${s}" data-set-status="${s}">${STATUS_ICONS[s]} ${ORDER_STATUSES[s]}</button>`).join("")}
    </div>

    <section class="od-sec">
      <h4>👤 العميل</h4>
      <p><b>${escapeHtml(c.name)}</b></p>
      <p class="mono" dir="ltr">${escapeHtml(c.phone)}</p>
      ${c.email ? `<p class="mono" dir="ltr">${escapeHtml(c.email)}</p>` : ""}
      <div class="od-contact">
        <a class="btn btn--ghost btn--sm" href="tel:${escapeHtml(c.phone)}">📞 اتصال</a>
        <a class="btn btn--primary btn--sm" href="${waLink(greet, intlPhone)}" target="_blank" rel="noopener" title="رسالة جاهزة فيها المنتجات والإجمالي والعنوان ولينك التتبع">✅ ابعت تأكيد الطلب</a>
        ${shipMsg ? `<a class="btn btn--ghost btn--sm" href="${waLink(shipMsg, intlPhone)}" target="_blank" rel="noopener">🚚 ابعت إنه اتشحن</a>` : ""}
        <a class="btn btn--sm btn--warn" href="${waLink(zoneMsg, intlPhone)}" target="_blank" rel="noopener" title="ابعت للعميل إن منطقته خارج نطاق التوصيل">⚠️ مشكلة توصيل</a>
      </div>
    </section>

    <section class="od-sec">
      <h4>📍 العنوان</h4>
      <p>${escapeHtml(a.gov)} — ${escapeHtml(a.city)}</p>
      <p>${escapeHtml(a.street)}</p>
      ${a.notes ? `<p class="od-note">📝 ${escapeHtml(a.notes)}</p>` : ""}
    </section>

    ${shipmentSection(o)}

    <section class="od-sec">
      <h4>📦 المنتجات (${num(itemsCount(o))})</h4>
      ${o.items.map((i) => `
        <div class="od-item">
          <div><b>${escapeHtml(i.name)}</b>${i.options ? `<small>${escapeHtml(i.options)}</small>` : ""}</div>
          <span>${num(i.qty)} × ${fmt(i.price)}</span>
          <strong>${fmt(i.qty * i.price)}</strong>
        </div>`).join("")}
    </section>

    <section class="od-sec">
      <dl class="totals">
        <div><dt>المجموع الفرعي</dt><dd>${fmt(t.subtotal)}</dd></div>
        <div><dt>الشحن <small>· ${escapeHtml(o.shipping.label)}</small></dt><dd>${t.shipping ? fmt(t.shipping) : "مجاناً"}</dd></div>
        ${t.discount ? `<div class="totals__discount"><dt>الخصم ${o.promo ? `(${escapeHtml(promoLabel(o.promo))})` : ""}</dt><dd>− ${fmt(t.discount)}</dd></div>` : ""}
        <div class="totals__grand"><dt>الإجمالي</dt><dd>${fmt(t.total)}</dd></div>
      </dl>
      ${paymentBlock(o)}
    </section>

    <button class="btn btn--ghost btn--block" id="printBtn">🖨 طباعة الفاتورة</button>`;

  if (isTransfer(o.payment.method)) loadProof(o.id);

  if (show) {
    $("#drawer").classList.add("open");
    $("#overlay").classList.add("show");
  }
}

// ============ الدفع بالتحويل في تفاصيل الطلب ============
function paymentBlock(o) {
  const p = o.payment;
  if (!isTransfer(p.method)) return `<p class="od-pay">💳 ${escapeHtml(p.label)}</p>`;
  const paid = p.status === "paid";
  return `
    <div class="od-paybox ${paid ? "is-paid" : ""}">
      <p class="od-pay">💳 ${escapeHtml(p.label)}${p.to ? ` على <b class="mono" dir="ltr">${escapeHtml(p.to)}</b>` : ""}</p>
      <p><b>${paid ? "✅ الفلوس وصلت" : "⏳ مستني التحويل"}</b>${paid && p.paidAt ? ` <small class="muted">${shortDate(p.paidAt)}</small>` : ""}</p>
      <div class="od-proof" id="odProof"><small class="muted">بندوّر على صورة التحويل...</small></div>
      <button class="btn ${paid ? "btn--ghost" : "btn--primary"} btn--sm" data-pay="${paid ? "pending" : "paid"}">${paid ? "↩️ لسه موصلتش" : "✅ الفلوس وصلت"}</button>
    </div>`;
}

async function loadProof(orderId) {
  const box = $("#odProof");
  if (!box) return;
  try {
    let proof = null;
    if (USE_FIREBASE) {
      const snap = await firebase.firestore().collection("paymentProofs").doc(orderId).get();
      proof = snap.exists ? snap.data() : null;
    } else {
      proof = store.get("gtech-proofs-local", {})[orderId] || null;
    }
    if (openId !== orderId || !$("#odProof")) return;
    $("#odProof").innerHTML = proof?.data
      ? `<small class="muted">صورة التحويل (${shortDate(proof.createdAt)}) — دوس عليها تكبر</small><img src="${proof.data}" alt="صورة التحويل" data-zoom />`
      : `<small class="muted">العميل لسه مارفعش صورة التحويل — ممكن يكون بعتها واتساب</small>`;
  } catch (err) {
    console.warn("proof", err);
    if ($("#odProof")) $("#odProof").innerHTML = `<small class="muted">${err?.code === "permission-denied" ? "⛔ حدّث قواعد الأمان عشان صورة التحويل تظهر" : "مقدرناش نجيب صورة التحويل"}</small>`;
  }
}

$("#drawerBody").addEventListener("click", async (e) => {
  const z = e.target.closest("[data-zoom]");
  if (z) return z.classList.toggle("is-zoomed");
  const b = e.target.closest("[data-pay]");
  if (!b || !openId) return;
  const o = orders.find((x) => x.id === openId);
  const paid = b.dataset.pay === "paid";
  try {
    await updateOrder(o.id, { payment: { ...o.payment, status: paid ? "paid" : "pending", paidAt: paid ? new Date().toISOString() : null } });
    toast(paid ? "✅ اتسجل إن الطلب اتدفع" : "↩️ الطلب رجع مستني التحويل");
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مقدرناش نحدّث الطلب");
  }
});

function closeOrder() {
  openId = null;
  $("#drawer").classList.remove("open");
  $("#overlay").classList.remove("show");
}
$("#drawerClose").addEventListener("click", closeOrder);
$("#overlay").addEventListener("click", closeOrder);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeOrder());

$("#drawerBody").addEventListener("click", async (e) => {
  if (e.target.id === "printBtn") return window.print();
  const b = e.target.closest("[data-set-status]");
  if (!b || !openId) return;
  const status = b.dataset.setStatus;
  const o = orders.find((x) => x.id === openId);
  if (o.status === status) return;
  if (status === "cancelled" && !confirm(`متأكد إنك عايز تلغي الطلب ${o.id}؟`)) return;
  try {
    const from = o.status;
    await updateOrder(openId, { status });
    await syncStockForStatus(o, from, status);
    handleReferral(o, status).catch((err) => console.warn("referral", err));
    if (o.customer.email && EMAIL_ON) {
      sendOrderEmail({ ...o, status }, status)
        .then((sent) => sent && toast(`📧 اتبعت إيميل "${EMAIL_STAGES[status].subject}" للعميل`))
        .catch((err) => { console.warn("status email", err); toast("⚠️ الحالة اتغيرت بس الإيميل ماتبعتش"); });
    }
    toast(`${STATUS_ICONS[status]} الطلب ${o.id} بقى "${ORDER_STATUSES[status]}"`);
    if (status === "confirmed") setTimeout(() => toast("💬 متنساش: دوس \"✅ ابعت تأكيد الطلب\" عشان العميل يطمّن"), 1800);
  } catch {
    toast("❌ مقدرناش نحدّث الطلب، جرّب تاني");
  }
});

// ============ صاحبك عليا: المكافآت ============
// أوردر جه من لينك صاحب (promo = REF-الكود) واتسلّم ← صاحب اللينك ياخد مكافأة (rewards/الكود: credits + 1)
// أوردر استخدم مكافأة (promo = REWARD-الكود) واتأكد ← بتتخصم مكافأة. كل أوردر بيتحسب مرة واحدة بس.
async function handleReferral(o, status) {
  const [kind, code] = String(o.promo || "").split("-");
  if (!USE_FIREBASE || !code || !["REF", "REWARD"].includes(kind)) return;
  const db = firebase.firestore();
  const ref = db.collection("rewards").doc(code);
  if (kind === "REF" && status === "delivered") {
    const added = await db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data() || {};
      if ((d.credited || []).includes(o.id)) return false;
      tx.set(ref, { credits: (d.credits || 0) + 1, credited: [...(d.credited || []), o.id].slice(-300), redeemed: d.redeemed || [], updatedAt: new Date().toISOString() });
      return true;
    });
    if (added) toast(`🤝 صاحب اللينك خد مكافأة خصم 10% على أوردره الجاي`);
  }
  if (kind === "REWARD" && ["confirmed", "shipped", "delivered"].includes(status)) {
    const res = await db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data() || {};
      if ((d.redeemed || []).includes(o.id)) return "done";
      if (!(d.credits > 0)) return "none";
      tx.set(ref, { credits: d.credits - 1, credited: d.credited || [], redeemed: [...(d.redeemed || []), o.id].slice(-300), updatedAt: new Date().toISOString() });
      return "used";
    });
    if (res === "none") toast("⚠️ الأوردر ده خد خصم مكافأة صاحبك عليا، بس العميل مكانش عنده مكافأة متاحة — راجع الخصم قبل الشحن");
  }
}
const promoLabel = (p) => /^REF-/.test(p) ? "🤝 من لينك صاحب" : /^REWARD-/.test(p) ? "🎁 مكافأة صاحبك عليا" : p;

// ============ تصدير ============
$("#exportBtn").addEventListener("click", () => {
  const list = visibleOrders();
  if (!list.length) return toast("مفيش طلبات للتصدير");
  const head = ["رقم الطلب", "التاريخ", "الحالة", "العميل", "الموبايل", "الإيميل", "المحافظة", "المدينة", "العنوان", "ملاحظات", "المنتجات", "عدد القطع", "المجموع الفرعي", "الشحن", "الخصم", "الإجمالي", "الدفع", "طريقة الشحن"];
  const rows = list.map((o) => [
    o.id, new Date(o.createdAt).toLocaleString("en-GB"), ORDER_STATUSES[o.status], o.customer.name, o.customer.phone, o.customer.email,
    o.address.gov, o.address.city, o.address.street, o.address.notes,
    o.items.map((i) => `${i.name}${i.options ? ` (${i.options})` : ""} x${i.qty}`).join(" | "), itemsCount(o),
    o.totals.subtotal, o.totals.shipping, o.totals.discount, o.totals.total, o.payment.label, o.shipping.label,
  ]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `gtech-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`⬇ تم تصدير ${num(list.length)} طلب`);
});

// ============ الوضع التجريبي ============
const demoNames = ["أحمد محمود", "سارة علي", "محمد حسن", "نورهان سامي", "كريم عادل", "ياسمين خالد", "عمر فاروق", "منة الله طارق", "يوسف إبراهيم", "هبة مصطفى"];
const demoPlaces = [["القاهرة", "مدينة نصر"], ["الجيزة", "الدقي"], ["الإسكندرية", "سموحة"], ["الدقهلية", "المنصورة"], ["القاهرة", "المعادي"], ["الشرقية", "الزقازيق"], ["الغربية", "طنطا"], ["أسيوط", "أسيوط الجديدة"]];
const demoPays = [["cod", "الدفع عند الاستلام"], ["card", "بطاقة بنكية"], ["install", "تقسيط بدون فوائد"], ["wallet", "محفظة إلكترونية"]];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function demoOrder(hoursAgo) {
  const items = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => {
    const p = pick(products);
    const opts = Object.values(p.options || {}).map((v) => pick(v)).join(" · ");
    return { id: p.id, name: p.name, options: opts, price: p.price, qty: Math.random() < 0.8 ? 1 : 2 };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const express = Math.random() < 0.3;
  const shipping = express ? 150 : subtotal >= 1000 ? 0 : 60;
  const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.1) : 0;
  const [gov, city] = pick(demoPlaces);
  const [pm, pl] = pick(demoPays);
  const created = new Date(Date.now() - hoursAgo * 3600000);
  const status = hoursAgo < 6 ? "new" : hoursAgo < 30 ? pick(["new", "confirmed", "confirmed"]) : pick(["confirmed", "shipped", "delivered", "delivered", "cancelled"]);
  return {
    id: `GT-${created.toISOString().slice(2, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`,
    createdAt: created.toISOString(),
    status,
    customer: { name: pick(demoNames), phone: "01" + pick(["0", "1", "2", "5"]) + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"), email: "" },
    address: { gov, city, street: `شارع ${num(1 + Math.floor(Math.random() * 90))}، عمارة ${num(1 + Math.floor(Math.random() * 40))}`, notes: Math.random() < 0.3 ? "اتصل قبل ما توصل" : "" },
    items,
    shipping: { method: express ? "express" : "standard", label: express ? "شحن سريع (24 ساعة)" : "شحن عادي (2-4 أيام)", cost: shipping },
    payment: { method: pm, label: pl },
    promo: discount ? "GTECH10" : null,
    totals: { subtotal, shipping, discount, total: subtotal + shipping - discount },
    demo: true,
  };
}

$("#seedBtn").addEventListener("click", () => {
  const existing = store.get(ORDERS_KEY, []);
  const demo = Array.from({ length: 14 }, (_, i) => demoOrder(i * 17 + Math.random() * 10));
  store.set(ORDERS_KEY, [...existing, ...demo]);
  knownIds = new Set([...knownIds, ...demo.map((o) => o.id)]); // من غير إشعار للطلبات التجريبية
  document.dispatchEvent(new Event("orderschange"));
  toast("🧪 اتضافت 14 طلب تجريبي");
});

$("#clearBtn").addEventListener("click", () => {
  if (!confirm("هيتمسح كل الطلبات المحفوظة في المتصفح ده. متأكد؟")) return;
  store.set(ORDERS_KEY, []);
  closeOrder();
  document.dispatchEvent(new Event("orderschange"));
  toast("🗑 تم مسح الطلبات");
});

// ============ عدّاد رسايل SMS ============
// رقم تقريبي: الموقع بيزوّده مع كل كود بيتبعت (الرقم الرسمي في Firebase ← Authentication ← Usage)
let smsDay = null;
let stopSms = () => {};

function startSmsMeter() {
  if (!USE_FIREBASE || !PHONE_VERIFICATION || smsDay === cairoDay()) return;
  stopSms();
  smsDay = cairoDay();
  loadFirebase(["auth", "firestore"]).then(() => {
    stopSms = firebase.firestore().collection("smsStats").doc(smsDay)
      .onSnapshot((d) => renderSmsMeter(d.exists ? d.data() : {}), (err) => {
        console.warn("sms stats", err);
        $("#smsMeter").hidden = true;
      });
  });
}

function renderSmsMeter({ sent = 0, quotaHits = 0 }) {
  const limit = SMS_DAILY_LIMIT;
  const left = limit ? Math.max(0, limit - sent) : null;
  const pct = limit ? Math.min(100, (sent / limit) * 100) : 0;
  const level = !limit ? "ok" : sent >= limit || quotaHits ? "full" : sent >= limit * 0.7 ? "warn" : "ok";
  const box = $("#smsMeter");
  box.hidden = false;
  box.className = `sms-meter card-box sms-meter--${level}`;
  box.innerHTML = `
    <span class="sms-meter__icon">📲</span>
    <div class="sms-meter__body">
      <div class="sms-meter__head">
        <b>رسايل كود التأكيد النهارده</b>
        <span>${limit ? `${num(sent)} من ${num(limit)} · ${left ? `فاضل ${num(left)}` : "خلصت"}` : `${num(sent)} رسالة`}</span>
      </div>
      ${limit ? `<div class="sms-meter__bar"><i style="width:${pct}%"></i></div>` : ""}
      <small>${quotaHits
        ? `⚠️ ${num(quotaHits)} محاولة ماوصلهاش كود عشان الحد خلص — العملاء دول ممكن يكلموك على واتساب`
        : "رقم تقريبي من الموقع، والعدد بيرجع من الأول كل يوم. الرقم الرسمي في Firebase ← Authentication ← Usage"}</small>
    </div>`;
}

// لو الصفحة فضلت مفتوحة لحد اليوم اللي بعده
setInterval(() => !$("#dashboard").hidden && startSmsMeter(), 60000);

// ============ تجربة الإيميل ============
// بتبعت إيميل تجريبي لإيميل المتجر وتعرض رد EmailJS بالظبط لو فيه مشكلة
if (EMAIL_ON && EMAIL_CONFIG.storeEmail) {
  $("#testEmailBtn").hidden = false;
  $("#testEmailBtn").addEventListener("click", async () => {
    const btn = $("#testEmailBtn");
    btn.disabled = true;
    btn.textContent = "📧 جاري الإرسال...";
    const sample = orders[0] || {
      id: "GT-TEST-0001", status: "shipped",
      customer: { name: "تجربة", phone: "01000000000", email: EMAIL_CONFIG.storeEmail },
      address: { gov: "القاهرة", city: "مدينة نصر", street: "عنوان تجريبي", notes: "" },
      items: [{ id: 1, name: "منتج تجريبي", options: "", price: 1000, qty: 1 }],
      shipping: { label: "شحن عادي (2-4 أيام)" }, payment: { label: "الدفع عند الاستلام" },
      totals: { subtotal: 1000, shipping: 0, discount: 0, total: 1000 },
    };
    try {
      await sendOrderEmail({ ...sample, customer: { ...sample.customer, email: EMAIL_CONFIG.storeEmail } }, "shipped");
      alert(`✅ الإيميل اتبعت بنجاح على ${EMAIL_CONFIG.storeEmail}\nلو موصلش خلال دقيقة دوّر في Spam.`);
    } catch (err) {
      alert(`❌ الإيميل ماتبعتش\n\nرد EmailJS:\n${err.message}\n\nالبيانات المستخدمة:\nService ID: ${EMAIL_CONFIG.serviceId}\nTemplate ID: ${EMAIL_CONFIG.templateId}\nPublic Key: ${EMAIL_CONFIG.publicKey}\n\nابعت صورة الرسالة دي.`);
    } finally {
      btn.disabled = false;
      btn.textContent = "📧 تجربة الإيميل";
    }
  });
}
