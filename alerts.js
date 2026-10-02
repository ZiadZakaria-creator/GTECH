// ============ "نبّهني" — تنبيهات رجوع المنتج ونزول السعر ============
// العميل بيسيب إيميله، والتنبيه بيتحفظ في مجموعة alerts.
// لوحة التحكم هي اللي بتبعت الإيميلات لما المنتج يرجع أو سعره يقل (admin-alerts.js)

const ALERTS_LOCAL = "gtech-alerts-local"; // الوضع التجريبي
const MY_ALERTS = "gtech-my-alerts";       // التنبيهات اللي العميل ده اشترك فيها (عشان الزرار يبان متفعّل)
const ALERT_TYPES = {
  stock: { btn: "🔔 نبّهني لما يرجع", title: "نبّهني لما يرجع", msg: "أول ما المنتج يرجع المخزون هيوصلك إيميل." },
  price: { btn: "📉 نبّهني لو السعر قلّ", title: "نبّهني لو السعر قلّ", msg: "لو سعره نزل عن السعر الحالي هيوصلك إيميل فوراً." },
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const alertKey = (id, type) => `${id}:${type}`;
const hasMyAlert = (id, type) => store.get(MY_ALERTS, []).includes(alertKey(id, type));

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
    ? `<span class="pd__alert done">✔ هنبلّغك على إيميلك ${t === "stock" ? "لما يرجع" : "لو السعر قلّ"}</span>`
    : t === "stock"
      ? `<button type="button" class="btn btn--primary pd__alert" data-alert="${t}" data-id="${p.id}">${ALERT_TYPES[t].btn}</button>`
      : `<button type="button" class="pd__alert alert-chip" data-alert="${t}" data-id="${p.id}"><i>📉</i><span><b>${ALERT_TYPES[t].title}</b><small>هيوصلك إيميل أول ما سعره ينزل</small></span><em>🔔</em></button>`
  ).join("");
}

document.body.insertAdjacentHTML("beforeend", `
  <div class="modal" id="alertModal" hidden role="dialog" aria-modal="true" aria-labelledby="alertTitle">
    <form class="modal__box card-box" id="alertForm" novalidate>
      <button type="button" class="icon-btn modal__close" data-close-alert aria-label="إغلاق">✕</button>
      <div class="modal__icon" id="alertIcon">🔔</div>
      <h3 id="alertTitle"></h3>
      <p class="muted" id="alertMsg"></p>
      <label class="field"><span>إيميلك</span><input name="email" type="email" dir="ltr" autocomplete="email" required /><em></em></label>
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
  f.email.value = f.email.value || user?.email || store.get("gtech-alert-email", "");
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
  const ok = EMAIL_RE.test(email);
  field.classList.toggle("invalid", !ok);
  field.querySelector("em").textContent = ok ? "" : "اكتب إيميل صحيح";
  if (!ok || !alertTarget) return;

  const { p, type } = alertTarget;
  const btn = f.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await saveAlert({
      productId: p.id,
      productName: String(p.name).slice(0, 120),
      email,
      name: String(user?.name || "").slice(0, 60),
      type,
      price: p.price,
      createdAt: new Date().toISOString(),
    });
    store.set("gtech-alert-email", email);
    closeAlert();
    toast(type === "stock" ? "🔔 تمام! هنبعتلك إيميل أول ما يرجع" : "📉 تمام! هنبعتلك إيميل لو السعر قلّ");
    document.dispatchEvent(new Event("alertschange"));
  } catch (err) {
    console.warn("alert", err);
    toast("❌ مقدرناش نفعّل التنبيه، جرّب تاني");
  } finally {
    btn.disabled = false;
  }
});
