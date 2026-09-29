// ============ صفحة طلباتي ============
const TRACK_STEPS = ["new", "confirmed", "shipped", "delivered"];
const TRACK_LABELS = { new: "تم الاستلام", confirmed: "تم التأكيد", shipped: "في الطريق", delivered: "تم التوصيل" };
const TRACK_ICONS = { new: "📝", confirmed: "✅", shipped: "🚚", delivered: "📦" };
const STATUS_HINTS = {
  new: "استلمنا طلبك وهنتواصل معاك قريب لتأكيده.",
  confirmed: "تم تأكيد طلبك وبنجهزه للشحن.",
  shipped: "طلبك خرج مع المندوب وفي الطريق ليك.",
  delivered: "تم توصيل طلبك. نتمنى المنتج يعجبك! 💙",
  cancelled: "الطلب ده اتلغى. لو محتاج مساعدة كلمنا على واتساب.",
};

let stopMine = () => {};
let lastStatus = null; // لإظهار إشعار لما حالة طلب تتغير

const orderDate = (iso) => new Date(iso).toLocaleString("ar-EG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

function show(id) {
  ["myLogin", "myLoading", "myEmpty"].forEach((x) => ($("#" + x).hidden = x !== id));
}

function start() {
  stopMine();
  lastStatus = null;
  $("#myOrders").innerHTML = "";
  $("#ordersCount").textContent = "";
  $("#liveNote").hidden = true;
  if (!user) return show("myLogin");

  show("myLoading");
  stopMine = watchMyOrders(user.phone, renderOrders, (err) => {
    console.error(err);
    show("myEmpty");
    $("#myEmptyText").textContent = "مقدرناش نحمّل طلباتك دلوقتي، جرّب تاني بعد شوية أو كلمنا على واتساب.";
  });
}

function renderOrders(list) {
  const orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (lastStatus) {
    orders.forEach((o) => {
      const before = lastStatus.get(o.id);
      if (before && before !== o.status) toast(`🔔 طلبك ${o.id} بقى "${o.status === "cancelled" ? "ملغي" : TRACK_LABELS[o.status]}"`);
    });
  }
  lastStatus = new Map(orders.map((o) => [o.id, o.status]));

  $("#ordersCount").textContent = orders.length ? `(${num(orders.length)})` : "";
  $("#liveNote").hidden = !orders.length || !USE_FIREBASE;
  if (!orders.length) {
    show("myEmpty");
    $("#myEmptyText").textContent = "أول ما تطلب هتلاقي طلبك هنا وتتابع حالته خطوة بخطوة.";
    $("#myOrders").innerHTML = "";
    return;
  }
  show(null);

  $("#myOrders").innerHTML = orders.map((o) => {
    const cancelled = o.status === "cancelled";
    const step = TRACK_STEPS.indexOf(o.status);
    const count = o.items.reduce((s, i) => s + i.qty, 0);
    return `
      <article class="my-order card-box ${cancelled ? "my-order--cancelled" : ""}">
        <header class="my-order__head">
          <div>
            <b class="mono">${escapeHtml(o.id)}</b>
            <small>${orderDate(o.createdAt)}</small>
          </div>
          <span class="pill-status pill-status--${o.status}">${cancelled ? "✖ ملغي" : `${TRACK_ICONS[o.status]} ${TRACK_LABELS[o.status]}`}</span>
        </header>

        ${cancelled ? "" : `
        <ol class="track" style="--progress:${step / (TRACK_STEPS.length - 1)}">
          ${TRACK_STEPS.map((s, i) => `
            <li class="${i < step ? "done" : i === step ? "current" : ""}">
              <span>${i < step ? "✓" : TRACK_ICONS[s]}</span><small>${TRACK_LABELS[s]}</small>
            </li>`).join("")}
        </ol>`}
        <p class="my-order__hint">${STATUS_HINTS[o.status]}</p>

        <div class="my-order__items">
          ${o.items.map((i) => {
            const p = findProduct(i.id);
            return `
              <a class="my-item" href="${productUrl(i.id)}">
                <span class="my-item__img">${p ? productVisual(p) : "📦"}</span>
                <div><b>${escapeHtml(i.name)}</b>${i.options ? `<small>${escapeHtml(i.options)}</small>` : ""}</div>
                <span class="my-item__qty">${num(i.qty)} × ${fmt(i.price)}</span>
              </a>`;
          }).join("")}
        </div>

        <footer class="my-order__foot">
          <span>📍 ${escapeHtml(o.address.city)}، ${escapeHtml(o.address.gov)}</span>
          <span>💳 ${escapeHtml(o.payment.label)}</span>
          <span>${num(count)} منتج</span>
          <b>الإجمالي: ${fmt(o.totals.total)}</b>
          <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
             href="${waLink(`السلام عليكم، عندي استفسار عن طلبي رقم ${o.id}`)}">💬 استفسار</a>
        </footer>
      </article>`;
  }).join("");
}

$("#myLoginBtn").addEventListener("click", () => requireLogin(start, "ادخل بنفس الاسم والرقم اللي طلبت بيهم"));
document.addEventListener("userchange", start);

start();
if (!user) requireLogin(start, "ادخل بنفس الاسم والرقم اللي طلبت بيهم");
