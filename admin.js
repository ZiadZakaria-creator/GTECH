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
$("#modeBadge").textContent = USE_FIREBASE ? "🟢 مباشر" : "🧪 تجريبي";
$("#modeBadge").classList.add(USE_FIREBASE ? "mode-badge--live" : "mode-badge--demo");

if (USE_FIREBASE) initFirebaseAdmin();
else {
  $("#demoNote").hidden = false;
  startDashboard();
}

function startDashboard() {
  $("#adminGate").hidden = true;
  $("#dashboard").hidden = false;
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
  firebase.auth().onAuthStateChanged((u) => {
    const isAdmin = u && !u.isAnonymous && u.email;
    $("#adminLogout").hidden = !isAdmin;
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
  render();
  if (openId) openOrder(openId, false);
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
  document.title = (pending ? `(${pending}) ` : "") + "GTECH | لوحة التحكم";
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
      <td data-label="الدفع">${escapeHtml(o.payment.label)}</td>
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
  const greet = `أهلاً ${c.name}، معاك GTECH بخصوص طلبك رقم ${o.id} بإجمالي ${t.total.toLocaleString("en-US")} ج.م`;

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
        <a class="btn btn--ghost btn--sm" href="${waLink(greet, intlPhone)}" target="_blank" rel="noopener">💬 واتساب</a>
      </div>
    </section>

    <section class="od-sec">
      <h4>📍 العنوان</h4>
      <p>${escapeHtml(a.gov)} — ${escapeHtml(a.city)}</p>
      <p>${escapeHtml(a.street)}</p>
      ${a.notes ? `<p class="od-note">📝 ${escapeHtml(a.notes)}</p>` : ""}
    </section>

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
        ${t.discount ? `<div class="totals__discount"><dt>الخصم ${o.promo ? `(${escapeHtml(o.promo)})` : ""}</dt><dd>− ${fmt(t.discount)}</dd></div>` : ""}
        <div class="totals__grand"><dt>الإجمالي</dt><dd>${fmt(t.total)}</dd></div>
      </dl>
      <p class="od-pay">💳 ${escapeHtml(o.payment.label)}</p>
    </section>

    <button class="btn btn--ghost btn--block" id="printBtn">🖨 طباعة الفاتورة</button>`;

  if (show) {
    $("#drawer").classList.add("open");
    $("#overlay").classList.add("show");
  }
}

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
    toast(`${STATUS_ICONS[status]} الطلب ${o.id} بقى "${ORDER_STATUSES[status]}"`);
  } catch {
    toast("❌ مقدرناش نحدّث الطلب، جرّب تاني");
  }
});

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
