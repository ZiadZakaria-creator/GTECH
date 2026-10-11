// ============ صفحة طلباتي ============
let stopMine = () => {};
let notifyChanges = statusChangeNotifier();

const orderDate = (iso) => new Date(iso).toLocaleString(LOCALE, { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

function show(id) {
  ["myLogin", "myLoading", "myEmpty"].forEach((x) => ($("#" + x).hidden = x !== id));
}

function start() {
  stopMine();
  notifyChanges = statusChangeNotifier();
  $("#myOrders").innerHTML = "";
  $("#myRef")?.remove();
  refShownFor = "";
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

// كارت "صاحبك عليا" فوق الطلبات، ومعاه عدد المكافآت
let refShownFor = "";
async function renderMyReferral(phone) {
  if (!REFERRAL_ON || !phone || refShownFor === phone) return;
  refShownFor = phone;
  if (!$("#myRef")) $("#myOrders").insertAdjacentHTML("beforebegin", '<div id="myRef"></div>');
  $("#myRef").innerHTML = referralCardHtml(phone);
  const credits = await rewardCredits(referralCode(phone));
  if (credits) $("#myRef").innerHTML = referralCardHtml(phone, credits);
}

function renderOrders(list) {
  const orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  shownOrders = orders;

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
  renderMyReferral(user?.phone || orders[0].customer.phone);

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
        <p class="my-order__hint">${cancelled && o.cancelledBy === "customer" ? "إنت لغيت الطلب ده. لو غيّرت رأيك تقدر تطلب تاني في أي وقت 💙" : STATUS_HINTS[o.status]}</p>
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
          ${["delivered", "cancelled"].includes(o.status) ? `<button class="btn btn--primary btn--sm my-reorder" data-reorder="${escapeHtml(o.id)}">🔁 اطلب تاني</button>` : ""}
          ${canCustomerCancel(o) ? `<button class="btn btn--ghost btn--sm my-cancel" data-cancel="${escapeHtml(o.id)}">✖ إلغاء الطلب</button>` : ""}
        </footer>
      </article>`;
  }).join("");
}

// إلغاء الطلب من العميل (قبل الشحن)
let shownOrders = [];
$("#myOrders").addEventListener("click", async (e) => {
  const re = e.target.closest("[data-reorder]");
  if (re) return reorder(shownOrders.find((x) => x.id === re.dataset.reorder));
  const b = e.target.closest("[data-cancel]");
  if (!b) return;
  const o = shownOrders.find((x) => x.id === b.dataset.cancel);
  if (!o || !canCustomerCancel(o)) return;
  if (!confirm(`متأكد إنك عايز تلغي الطلب ${o.id}؟\nالإلغاء ببلاش طول ما الطلب لسه ماتشحنش.`)) return;
  b.disabled = true;
  try {
    await cancelMyOrder(o);
    toast("✖ الطلب اتلغى");
    pushStoreOfCancel(o).catch(() => {});
  } catch (err) {
    console.warn("cancel", err);
    b.disabled = false;
    toast("❌ مقدرناش نلغي الطلب دلوقتي، كلمنا على واتساب وهنلغيه لك");
  }
});

// "اطلب تاني": يرجّع منتجات الطلب القديم للسلة (المتاح بس، بالسعر الحالي)
function reorder(o) {
  if (!o) return;
  let added = 0, missing = 0;
  for (const i of o.items) {
    const p = findProduct(i.id);
    if (!p || !isForSale(p) || !inStock(p)) { missing++; continue; }
    const opts = i.options || "";
    const line = cart.find((c) => c.id === p.id && (c.opts || "") === opts);
    line ? (line.qty += i.qty) : cart.push({ id: p.id, qty: i.qty, opts });
    added++;
  }
  if (!added) return toast("😔 منتجات الطلب ده مش متاحة دلوقتي");
  renderCart();
  openCart(true);
  toast(missing ? `✅ رجّعنا ${added} منتج للسلة — و${missing} مش متاح دلوقتي` : "✅ رجّعنا منتجات الطلب للسلة بالأسعار الحالية");
}

// إشعار لصاحب المتجر على ntfy إن العميل لغى (من غير اسم أو رقم)
async function pushStoreOfCancel(o) {
  if (typeof ORDER_PUSH_TOPIC === "undefined" || !ORDER_PUSH_TOPIC) return;
  await fetch("https://ntfy.sh/", {
    method: "POST",
    body: JSON.stringify({ topic: ORDER_PUSH_TOPIC, title: `✖ عميل لغى الطلب ${o.id}`, message: `الإجمالي كان ${fmt(o.totals.total)} · ${o.address.gov}`, tags: ["x"], priority: 4 }),
  });
}

$("#myLoginBtn").addEventListener("click", () => requireLogin(start, "ادخل بنفس الاسم والرقم اللي طلبت بيهم"));
document.addEventListener("userchange", start);

start();
if (!user) requireLogin(start, "ادخل بنفس الاسم والرقم اللي طلبت بيهم");
