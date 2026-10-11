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
          ${o.status === "delivered" ? `<button class="btn btn--ghost btn--sm my-rate" data-rate="${escapeHtml(o.id)}">${rateLabel(o)}</button>` : ""}
          ${["delivered", "cancelled"].includes(o.status) ? `<button class="btn btn--primary btn--sm my-reorder" data-reorder="${escapeHtml(o.id)}">🔁 اطلب تاني</button>` : ""}
          ${canCustomerCancel(o) ? `<button class="btn btn--ghost btn--sm my-cancel" data-cancel="${escapeHtml(o.id)}">✖ إلغاء الطلب</button>` : ""}
        </footer>
      </article>`;
  }).join("");
  openRateFromLink();
}

// لينك رسالة "اطلب رأيه" من اللوحة: myorders.html?rate=رقم الطلب ← بيفتح نافذة التقييم مرة واحدة
let rateLinkDone = false;
function openRateFromLink() {
  const id = new URLSearchParams(location.search).get("rate");
  if (rateLinkDone || !id) return;
  const btn = $$("[data-rate]");
  const b = [...btn].find((x) => x.dataset.rate === id);
  rateLinkDone = true;
  if (!b) return;
  b.closest(".my-order")?.scrollIntoView({ block: "center" });
  openRate(shownOrders.find((x) => x.id === id), b);
}

// إلغاء الطلب من العميل (قبل الشحن)
let shownOrders = [];
$("#myOrders").addEventListener("click", async (e) => {
  const re = e.target.closest("[data-reorder]");
  if (re) return reorder(shownOrders.find((x) => x.id === re.dataset.reorder));
  const rt = e.target.closest("[data-rate]");
  if (rt) return openRate(shownOrders.find((x) => x.id === rt.dataset.rate), rt);
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

// ============ "شاركنا رأيك": تقييم منتجات الطلب بعد ما يتسلّم ============
// نفس تقييمات صفحة المنتج (reviews.js): بيتنشر باسم العميل في صفحة المنتج، وكل منتج تقييم واحد يتعدّل.
// ده تقييم المنتج على موقعنا؛ استبيان جوجل عن المتجر بيتعرض مرة واحدة في صفحة "تم الطلب" (شروط جوجل).
const rateItems = (o) => [...new Map(o.items.map((i) => [i.id, i])).values()].filter((i) => findProduct(i.id));
const rateLabel = (o) => {
  const items = rateItems(o);
  return items.length && items.every((i) => myReviewFor(i.id)) ? "✏️ عدّل رأيك" : "⭐ شاركنا رأيك";
};

document.body.insertAdjacentHTML("beforeend", `
  <div class="modal" id="rateModal" hidden role="dialog" aria-modal="true" aria-labelledby="rateTitle">
    <form class="modal__box card-box rate-box" id="rateForm">
      <button type="button" class="icon-btn modal__close" data-rate-close aria-label="إغلاق">✕</button>
      <h3 id="rateTitle">شاركنا رأيك</h3>
      <p class="muted">إيه رأيك في اللي وصلك؟ تقييمك بيظهر باسمك في صفحة المنتج وبيساعد غيرك يختار.</p>
      <div class="rate-box__items" id="rateItems"></div>
      <div class="rate-box__actions">
        <button type="button" class="btn btn--ghost" data-rate-close>مش دلوقتي</button>
        <button type="submit" class="btn btn--primary">نشر التقييم</button>
      </div>
    </form>
  </div>`);

let rateOrder = null;
let rateOpener = null;
function openRate(o, opener) {
  if (!o) return;
  rateOrder = o;
  rateOpener = opener;
  $("#rateItems").innerHTML = rateItems(o).map((i) => {
    const p = findProduct(i.id);
    const mine = myReviewFor(i.id);
    const v = mine?.stars || 0;
    return `
      <fieldset class="rate-item" data-item="${i.id}">
        <legend class="rate-item__head"><span class="my-item__img">${productVisual(p)}</span><b>${escapeHtml(p.name)}</b></legend>
        <div class="rv__stars" data-value="${v}" role="radiogroup" aria-label="تقييم ${escapeHtml(p.name)}">
          ${[1, 2, 3, 4, 5].map((s) => `<button type="button" data-star="${s}" class="${s <= v ? "on" : ""}" role="radio" aria-checked="${s === v}" aria-label="${num(s)} من 5">★</button>`).join("")}
        </div>
        <textarea name="text-${i.id}" rows="2" maxlength="500" placeholder="اكتب رأيك… (اختياري)">${escapeHtml(mine?.text || "")}</textarea>
      </fieldset>`;
  }).join("");
  $("#rateModal").hidden = false;
  document.body.classList.add("no-scroll");
  $("#rateItems [data-star]")?.focus();
}
function closeRate() {
  $("#rateModal").hidden = true;
  document.body.classList.remove("no-scroll");
  rateOpener?.focus();
}
$("#rateModal").addEventListener("click", (e) => {
  if (e.target.id === "rateModal" || e.target.closest("[data-rate-close]")) return closeRate();
  const b = e.target.closest("[data-star]");
  if (!b) return;
  const box = b.parentElement;
  box.dataset.value = b.dataset.star;
  box.querySelectorAll("button").forEach((x) => {
    x.classList.toggle("on", +x.dataset.star <= +b.dataset.star);
    x.setAttribute("aria-checked", x === b);
  });
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#rateModal").hidden) closeRate(); });
$("#rateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const picks = [...$$("#rateItems .rate-item")].map((f) => ({
    id: +f.dataset.item, stars: +f.querySelector(".rv__stars").dataset.value,
    text: f.querySelector("textarea").value.trim().slice(0, 500),
  })).filter((x) => x.stars >= 1);
  if (!picks.length) return toast("⭐ اختار عدد النجوم الأول");
  const btn = e.target.querySelector("[type=submit]");
  btn.disabled = true;
  btn.textContent = "جاري النشر…";
  try {
    for (const x of picks) await saveReview(x.id, x.stars, x.text);
    if (rateOpener && rateOrder) rateOpener.textContent = rateLabel(rateOrder);
    closeRate();
    toast("⭐ شكراً! رأيك اتنشر في صفحة المنتج");
  } catch (err) {
    console.error(err);
    toast("❌ التقييم ماتحفظش، جرّب تاني");
  } finally {
    btn.disabled = false;
    btn.textContent = "نشر التقييم";
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
