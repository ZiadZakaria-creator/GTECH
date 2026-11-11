// ============ "نبّهني" — تنبيهات رجوع المنتج ونزول السعر ============
// العميل بيسيب رقم واتساب أو إيميل:
// - الإيميل بيتحفظ في مجموعة alerts، ولوحة التحكم بتبعت الإيميلات لوحدها (admin-alerts.js)
// - الرقم بيتحفظ في leads (page = "stock:<id>" أو "price:<id>:<السعر>")، ولوحة التحكم بتطلّعه في "متابعات"
//   عشان صاحب المتجر يبعتله واتساب بنفسه أول ما المنتج يرجع (admin-followups.js)

const ALERTS_LOCAL = "gtech-alerts-local"; // الوضع التجريبي
const MY_ALERTS = "gtech-my-alerts";       // التنبيهات اللي العميل ده اشترك فيها (عشان الزرار يبان متفعّل)
const ALERT_TYPES = {
  stock: { btn: "🔔 نبّهني لما يرجع", title: "نبّهني لما يرجع", msg: "أول ما المنتج يرجع المخزون هنبلّغك على واتساب أو إيميل." },
  price: { btn: "📉 نبّهني لو السعر قلّ", title: "نبّهني لو السعر قلّ", msg: "لو سعره نزل عن السعر الحالي هنبلّغك على واتساب أو إيميل." },
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const alertKey = (id, type) => `${id}:${type}`;
const hasMyAlert = (id, type) => store.get(MY_ALERTS, []).includes(alertKey(id, type));

// تنبيه برقم الواتساب: بيتسجل كرقم عميل (leads) — نفس طريقة نافذة العروض، من غير تسجيل دخول
function savePhoneAlert(phone, p, type) {
  const lead = {
    phone,
    createdAt: new Date().toISOString(),
    page: (type === "price" ? `price:${p.id}:${p.price}` : `stock:${p.id}`).slice(0, 80),
    source: type === "price" ? "price-alert" : "stock-alert",
  };
  const done = () => store.set(MY_ALERTS, [...new Set([...store.get(MY_ALERTS, []), alertKey(p.id, type)])]);
  if (!FIREBASE_CONFIG) {
    store.set("gtech-leads-local", [...store.get("gtech-leads-local", []), lead]);
    done();
    return Promise.resolve();
  }
  const root = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  return fetch(`https://firestore.googleapis.com/v1/${root}/leads?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(lead).map(([k, v]) => [k, { stringValue: v }])) }),
  }).then((r) => { if (!r.ok) throw new Error("alert lead " + r.status); done(); });
}

async function saveAlert(alert) {
  if (!USE_FIREBASE) {
    store.set(ALERTS_LOCAL, [...store.get(ALERTS_LOCAL, []), { ...alert, _id: "a" + Date.now().toString(36) }]);
  } else {
    await ensureCustomerAuth();
    await firebase.firestore().collection("alerts").add(alert);
  }
  store.set(MY_ALERTS, [...new Set([...store.get(MY_ALERTS, []), alertKey(alert.productId, alert.type)])]);
}

// الأزرار اللي تحت "أضف للسلة" في صفحة المنتج
function alertButtonsHtml(p) {
  const types = inStock(p) ? ["price"] : ["stock"];
  return types.map((t) => hasMyAlert(p.id, t)
    ? `<span class="pd__alert done">✔ هنبلّغك ${t === "stock" ? "أول ما يرجع" : "لو السعر قلّ"}</span>`
    : t === "stock"
      ? `<button type="button" class="btn btn--primary pd__alert" data-alert="${t}" data-id="${p.id}">${ALERT_TYPES[t].btn}</button>`
      : `<button type="button" class="pd__alert alert-chip" data-alert="${t}" data-id="${p.id}"><i>📉</i><span><b>${ALERT_TYPES[t].title}</b><small>هنبلّغك أول ما سعره ينزل</small></span><em>🔔</em></button>`
  ).join("");
}

document.body.insertAdjacentHTML("beforeend", `
  <div class="modal" id="alertModal" hidden role="dialog" aria-modal="true" aria-labelledby="alertTitle">
    <form class="modal__box card-box" id="alertForm" novalidate>
      <button type="button" class="icon-btn modal__close" data-close-alert aria-label="إغلاق">✕</button>
      <div class="modal__icon" id="alertIcon">🔔</div>
      <h3 id="alertTitle"></h3>
      <p class="muted" id="alertMsg"></p>
      <label class="field"><span>رقم الواتساب أو الإيميل</span><input name="email" type="text" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx" required /><em></em></label>
      <button class="btn btn--primary btn--block" type="submit">فعّل التنبيه</button>
    </form>
  </div>`);

let alertTarget = null;
function openAlert(p, type) {
  alertTarget = { p, type };
  const f = $("#alertForm");
  $("#alertIcon").textContent = type === "stock" ? "🔔" : "📉";
  $("#alertTitle").textContent = ALERT_TYPES[type].title;
  $("#alertMsg").textContent = `${p.name} — ${ALERT_TYPES[type].msg}`;
  f.email.value = f.email.value || store.get("gtech-alert-email", "") || user?.phone || user?.email || "";
  f.email.closest(".field").classList.remove("invalid");
  $("#alertModal").hidden = false;
  setTimeout(() => f.email.focus(), 50);
}
const closeAlert = () => { $("#alertModal").hidden = true; };

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-alert]");
  if (b) {
    const p = findProduct(Number(b.dataset.id));
    if (p) openAlert(p, b.dataset.alert);
    return;
  }
  if (e.target.closest("[data-close-alert]") || e.target.id === "alertModal") closeAlert();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#alertModal").hidden) closeAlert(); });

$("#alertForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim();
  const field = f.email.closest(".field");
  const phone = normalizePhone(email);
  const isPhone = isValidPhone(email);
  const ok = isPhone || EMAIL_RE.test(email);
  field.classList.toggle("invalid", !ok);
  field.querySelector("em").textContent = ok ? "" : "اكتب رقم موبايل صحيح (01xxxxxxxxx) أو إيميل";
  if (!ok || !alertTarget) return;

  const { p, type } = alertTarget;
  const btn = f.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    if (isPhone) await savePhoneAlert(phone, p, type);
    else await saveAlert({
      productId: p.id,
      productName: String(p.name).slice(0, 120),
      email,
      name: String(user?.name || "").slice(0, 60),
      type,
      price: p.price,
      createdAt: new Date().toISOString(),
    });
    store.set("gtech-alert-email", isPhone ? phone : email);
    closeAlert();
    const via = isPhone ? "واتساب" : "إيميل";
    toast(type === "stock" ? `🔔 تمام! هنبعتلك ${via} أول ما يرجع` : `📉 تمام! هنبعتلك ${via} لو السعر قلّ`);
    document.dispatchEvent(new Event("alertschange"));
  } catch (err) {
    console.warn("alert", err);
    toast("❌ مقدرناش نفعّل التنبيه، جرّب تاني");
  } finally {
    btn.disabled = false;
  }
});
