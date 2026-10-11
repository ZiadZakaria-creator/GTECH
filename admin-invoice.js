// ============ فاتورة الطلب للطباعة (A4) ============
// زرار "🖨 طباعة الفاتورة" في تفاصيل الطلب بيبني صفحة فاتورة منفصلة (#invoice) ويطبعها لوحدها،
// بدل ما يطبع لوحة التحكم نفسها. التصميم أبيض وأسود في الأساس مع لون المتجر خفيف، فبيطلع كويس على أي طابعة.
const INVOICE_STORE = {
  name: "GTECH MASR",
  company: "ZIRATECH",
  phone: "01100053123",
  area: "القاهرة والجيزة",
};

function invoiceHtml(o) {
  const c = o.customer || {};
  const a = o.address || {};
  const t = o.totals || {};
  const egp = (n) => `${Number(n || 0).toLocaleString("en-US")} <span class="inv__cur">ج.م</span>`;
  const date = new Date(o.createdAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
  const paid = o.payment?.status === "paid";
  const isCod = o.payment?.method === "cod" || /الاستلام/.test(o.payment?.label || "");
  const cancelled = o.status === "cancelled";
  const warrantyOf = (id) => {
    const p = typeof findProduct === "function" ? findProduct(id) : null;
    if (!p) return "";
    const w = typeof warrantyText === "function" ? warrantyText(p) : String(p.warranty || "");
    return typeof hasWarranty === "function" && !hasWarranty(p) ? "بدون ضمان" : w ? `ضمان ${w}` : "";
  };
  const sh = o.shipment;
  const carrier = sh?.trackingNumber ? (typeof carrierName === "function" ? carrierName(sh) : sh.carrier || "") : "";
  const statusLabel = cancelled ? "ملغي" : paid ? "مدفوع" : isCod ? "الدفع عند الاستلام" : "في انتظار الدفع";

  return `
  <div class="inv" dir="rtl">
    <header class="inv__head">
      <div class="inv__brand">
        <span class="inv__logo" aria-hidden="true">G</span>
        <div><b class="inv__name">GTECH <span>MASR</span></b><small>${INVOICE_STORE.company} · إكسسوارات جيمنج وكمبيوتر</small></div>
      </div>
      <div class="inv__title">
        <h1>فاتورة</h1>
        <p class="inv__no" dir="ltr">${escapeHtml(o.id)}</p>
        <p class="inv__date">${date}</p>
      </div>
    </header>

    <section class="inv__parties">
      <div>
        <h2>من</h2>
        <p><b>${INVOICE_STORE.name}</b></p>
        <p>واتساب: <span dir="ltr">${INVOICE_STORE.phone}</span></p>
        <p dir="ltr" class="inv__url">${escapeHtml(siteUrl("").replace(/^https?:\/\//, "").replace(/\/$/, ""))}</p>
        <p>التوصيل: ${INVOICE_STORE.area}</p>
      </div>
      <div>
        <h2>إلى</h2>
        <p><b>${escapeHtml(c.name || "")}</b></p>
        <p dir="ltr" class="inv__right">${escapeHtml(c.phone || "")}</p>
        ${c.email ? `<p dir="ltr" class="inv__right">${escapeHtml(c.email)}</p>` : ""}
        <p>${escapeHtml([a.street, a.city, a.gov].filter(Boolean).join("، "))}</p>
        ${a.notes ? `<p class="inv__muted">ملاحظات: ${escapeHtml(a.notes)}</p>` : ""}
      </div>
      <div class="inv__meta">
        <h2>الطلب</h2>
        <p>الحالة: <b>${escapeHtml(cancelled ? "ملغي" : (typeof ORDER_STATUSES !== "undefined" && ORDER_STATUSES[o.status]) || o.status)}</b></p>
        <p>الدفع: <b>${escapeHtml(o.payment?.label || "")}</b></p>
        <p>الشحن: ${escapeHtml(o.shipping?.label || "")}</p>
        ${sh?.trackingNumber ? `<p>التتبع: ${escapeHtml(carrier)} <span dir="ltr">${escapeHtml(sh.trackingNumber)}</span></p>` : ""}
      </div>
    </section>

    <table class="inv__table">
      <thead><tr><th class="n">#</th><th>المنتج</th><th class="q">الكمية</th><th class="m">سعر الوحدة</th><th class="m">الإجمالي</th></tr></thead>
      <tbody>
        ${(o.items || []).map((i, k) => `
        <tr>
          <td class="n">${k + 1}</td>
          <td><b>${escapeHtml(i.name)}</b>${i.options ? `<small>${escapeHtml(i.options)}</small>` : ""}${warrantyOf(i.id) ? `<small class="inv__war">${escapeHtml(warrantyOf(i.id))}</small>` : ""}</td>
          <td class="q">${i.qty}</td>
          <td class="m">${egp(i.price)}</td>
          <td class="m"><b>${egp(i.price * i.qty)}</b></td>
        </tr>`).join("")}
      </tbody>
    </table>

    <section class="inv__bottom">
      <div class="inv__pay ${paid ? "is-paid" : ""} ${cancelled ? "is-cancelled" : ""}">
        <span class="inv__stamp">${statusLabel}</span>
        ${cancelled ? "<p>الطلب ده اتلغى.</p>"
          : paid ? `<p>اتدفع بـ${escapeHtml(o.payment?.label || "")}${o.payment?.paidAt ? ` يوم ${new Date(o.payment.paidAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}` : ""}. المندوب مش هيحصّل أي فلوس.</p>`
          : isCod ? `<p>المطلوب تحصيله عند الاستلام: <b>${egp(t.total)}</b></p>`
          : `<p>في انتظار تحويل <b>${egp(t.total)}</b></p>`}
      </div>
      <dl class="inv__totals">
        <div><dt>المجموع الفرعي</dt><dd>${egp(t.subtotal)}</dd></div>
        ${t.discount ? `<div><dt>الخصم</dt><dd>− ${egp(t.discount)}</dd></div>` : ""}
        <div><dt>الشحن</dt><dd>${t.shipping ? egp(t.shipping) : "—"}</dd></div>
        <div class="inv__grand"><dt>الإجمالي</dt><dd>${egp(t.total)}</dd></div>
      </dl>
    </section>

    <footer class="inv__foot">
      <p class="inv__thanks">شكراً إنك اخترت GTECH MASR 💙</p>
      <p>الاسترجاع خلال 14 يوم من الاستلام حسب سياسة الاسترجاع · الضمان حسب المكتوب جنب كل منتج · محتاج حاجة؟ كلمنا واتساب <span dir="ltr">${INVOICE_STORE.phone}</span></p>
    </footer>
  </div>`;
}

function printInvoice(o) {
  if (!o) return;
  let el = document.getElementById("invoice");
  if (!el) {
    el = document.createElement("div");
    el.id = "invoice";
    document.body.appendChild(el);
  }
  el.innerHTML = invoiceHtml(o);
  const prevTitle = document.title;
  document.title = `فاتورة ${o.id}`; // اسم الملف لو اتحفظ PDF
  document.body.classList.add("printing-invoice");
  const done = () => {
    document.body.classList.remove("printing-invoice");
    document.title = prevTitle;
    removeEventListener("afterprint", done);
  };
  addEventListener("afterprint", done);
  window.print();
}
