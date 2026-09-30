// ============ صفحة طلباتي ============
let stopMine = () => {};
let notifyChanges = statusChangeNotifier();

const orderDate = (iso) => new Date(iso).toLocaleString("ar-EG", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

function show(id) {
  ["myLogin", "myLoading", "myEmpty"].forEach((x) => ($("#" + x).hidden = x !== id));
}

function start() {
  stopMine();
  notifyChanges = statusChangeNotifier();
  $("#myOrders").innerHTML = "";
  $("#ordersCount").textContent = "";
  $("#liveNote").hidden = true;
  if (!user) return show("myLogin");

  show("myLoading");
  stopMine = watchMyOrders(myOrdersPhone(), renderOrders, (err) => {
    console.error(err);
    show("myEmpty");
    $("#myEmptyText").textContent = "مقدرناش نحمّل طلباتك دلوقتي، جرّب تاني بعد شوية أو كلمنا على واتساب.";
  });
}

function renderOrders(list) {
  const orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  notifyChanges(orders);
  if (orders.length) store.set(HAS_ORDERS_KEY, true);

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
    const count = o.items.reduce((s, i) => s + i.qty, 0);
    return `
      <article class="my-order card-box ${cancelled ? "my-order--cancelled" : ""}">
        <header class="my-order__head">
          <div>
            <b class="mono">${escapeHtml(o.id)}</b>
            <small>${orderDate(o.createdAt)}</small>
          </div>
          ${trackPill(o.status)}
        </header>

        ${trackBar(o.status)}
        <p class="my-order__hint">${STATUS_HINTS[o.status]}</p>
        ${o.payment?.status === "pending" && !cancelled ? `
          <p class="my-pay">
            <span>⏳ مستنيين تحويل <b>${fmt(o.totals.total)}</b> بـ${escapeHtml(o.payment.label)} على <b dir="ltr">${escapeHtml(o.payment.to || "")}</b></span>
            <a class="btn btn--ghost btn--sm" href="${proofWhatsApp(o)}" target="_blank" rel="noopener">💬 ابعت صورة التحويل</a>
          </p>` : o.payment?.status === "paid" && !cancelled ? `<p class="my-pay my-pay--ok">✅ استلمنا التحويل، شكراً!</p>` : ""}
        ${o.shipment?.trackingNumber && !cancelled ? `
          <p class="my-ship">
            <span>🚚 شحنتك مع ${escapeHtml(carrierName(o.shipment))} — رقم التتبع <b>${escapeHtml(o.shipment.trackingNumber)}</b></span>
            ${shipmentTrackUrl(o.shipment) ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(shipmentTrackUrl(o.shipment))}" target="_blank" rel="noopener">تتبع الشحنة</a>` : ""}
          </p>` : ""}

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
