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
  // الضمان من بيانات المنتج: منتجات اللوحة (Firestore) الأول، وبعدها الكتالوج المحلي.
  // (findProduct مش محمّلة في لوحة التحكم، فكان الضمان بيطلع فاضي)
  const warrantyOf = (id) => {
    const list = typeof adminProducts !== "undefined" && adminProducts.length ? adminProducts : products;
    const p = list.find((x) => x.id === Number(id));
    if (!p) return "";
    if (typeof hasWarranty === "function" && !hasWarranty(p)) return "بدون ضمان";
    const w = (typeof warrantyText === "function" ? warrantyText(p) : String(p.warranty || "")).trim()
      .replace(/^12\s*(شهر|شهور)$/, "سنة").replace(/^24\s*(شهر|شهور)$/, "سنتين");
    return w ? `ضمان ${w}` : "";
  };
  const sealDate = new Date(o.createdAt).toLocaleDateString("en-GB").replace(/\//g, ".");
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
      <thead><tr><th class="n">#</th><th>المنتج</th><th class="w">الضمان</th><th class="q">الكمية</th><th class="m">سعر الوحدة</th><th class="m">الإجمالي</th></tr></thead>
      <tbody>
        ${(o.items || []).map((i, k) => {
          const war = warrantyOf(i.id);
          return `
        <tr>
          <td class="n">${k + 1}</td>
          <td><b>${escapeHtml(i.name)}</b>${i.options ? `<small>${escapeHtml(i.options)}</small>` : ""}</td>
          <td class="w">${war ? `<span class="inv__war ${war === "بدون ضمان" ? "is-none" : ""}">${war === "بدون ضمان" ? "" : "🛡 "}${escapeHtml(war)}</span>` : "—"}</td>
          <td class="q">${i.qty}</td>
          <td class="m">${egp(i.price)}</td>
          <td class="m"><b>${egp(i.price * i.qty)}</b></td>
        </tr>`;
        }).join("")}
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

    <section class="inv__sealrow">
      <p class="inv__warnote">🛡 الضمان مكتوب قدام كل منتج، واحتفظ بالفاتورة دي عشان تستخدمها في الضمان أو الاسترجاع.</p>
      ${cancelled ? "" : `<figure class="inv__seal" aria-label="ختم GTECH MASR">${invoiceSealSvg(sealDate)}<figcaption>ختم المتجر</figcaption></figure>`}
    </section>

    <footer class="inv__foot">
      <p class="inv__thanks">شكراً إنك اخترت GTECH MASR 💙</p>
      <p>الاسترجاع خلال 14 يوم من الاستلام حسب سياسة الاسترجاع · الضمان حسب المكتوب جنب كل منتج · محتاج حاجة؟ كلمنا واتساب <span dir="ltr">${INVOICE_STORE.phone}</span></p>
    </footer>
  </div>`;
}

// ختم دائري للمتجر (SVG) بلون حبر الأختام: اسم المتجر والشركة حوالين الدايرة، واللوجو والتاريخ في النص.
// فلتر خفيف بيدّي ملمس الحبر الحقيقي (أطراف مش ناعمة ١٠٠٪).
function invoiceSealSvg(date) {
  return `<svg viewBox="0 0 200 200" width="140" height="140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="sealTop" d="M 30 100 A 70 70 0 0 1 170 100"/>
    <path id="sealBot" d="M 36 100 A 64 64 0 0 0 164 100"/>
    <filter id="sealInk" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.75" result="m"/>
      <feComposite in="SourceGraphic" in2="m" operator="in"/>
    </filter>
  </defs>
  <g filter="url(#sealInk)" fill="none" stroke="currentColor">
    <circle cx="100" cy="100" r="94" stroke-width="5"/>
    <circle cx="100" cy="100" r="86" stroke-width="1.6"/>
    <circle cx="100" cy="100" r="52" stroke-width="1.6"/>
    <g fill="currentColor" stroke="none" font-family="Arial, Helvetica, sans-serif" font-weight="900">
      <text font-size="17" letter-spacing="3.2"><textPath href="#sealTop" startOffset="50%" text-anchor="middle">GTECH MASR</textPath></text>
      <text font-size="12.5" letter-spacing="2.4" dominant-baseline="hanging"><textPath href="#sealBot" startOffset="50%" text-anchor="middle">GTECHMASR.COM</textPath></text>
      <text x="22" y="105" font-size="12">★</text><text x="168" y="105" font-size="12">★</text>
      <rect x="80" y="60" width="40" height="40" rx="11"/>
      <text x="100" y="91" font-size="30" text-anchor="middle" fill="#fff">G</text>
      <text x="100" y="118" font-size="12.5" text-anchor="middle" letter-spacing="1.5">OFFICIAL</text>
      <text x="100" y="135" font-size="11" text-anchor="middle" letter-spacing=".5" font-family="ui-monospace, Menlo, Consolas, monospace" font-weight="700">${escapeHtml(date)}</text>
    </g>
  </g>
</svg>`;
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
