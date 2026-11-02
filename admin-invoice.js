// ============ فاتورة الطلب للطباعة (A4) ============
// زرار "🖨 طباعة الفاتورة" في تفاصيل الطلب بيبني صفحة فاتورة منفصلة (#invoice) ويطبعها لوحدها،
// بدل ما يطبع لوحة التحكم نفسها. التصميم أبيض وأسود في الأساس مع لون المتجر خفيف، فبيطلع كويس على أي طابعة.
const INVOICE_STORE = {
  name: "GTECH MASR",
  company: "ZIRATECH",
  phone: "01100053123",
  area: "القاهرة والجيزة",
};

// المبلغ بالحروف زي الفواتير التجارية في مصر: "فقط ألفان وخمسمائة وتسعون جنيه مصري لا غير"
function amountInWords(n) {
  n = Math.round(Number(n) || 0);
  if (!n) return "صفر";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
    "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const below1000 = (x) => {
    const parts = [];
    if (x >= 100) parts.push(hundreds[Math.floor(x / 100)]);
    const r = x % 100;
    if (r && r < 20) parts.push(ones[r]);
    else if (r) parts.push(r % 10 ? `${ones[r % 10]} و${tens[Math.floor(r / 10)]}` : tens[Math.floor(r / 10)]);
    return parts.join(" و");
  };
  const th = Math.floor(n / 1000), rest = n % 1000;
  let thWord = "";
  if (th === 1) thWord = "ألف";
  else if (th === 2) thWord = "ألفان";
  else if (th >= 3 && th <= 10) thWord = `${below1000(th)} آلاف`;
  else if (th > 10) thWord = `${below1000(th)} ألف`;
  return [thWord, rest ? below1000(rest) : ""].filter(Boolean).join(" و");
}

function invoiceHtml(o) {
  const c = o.customer || {};
  const a = o.address || {};
  const t = o.totals || {};
  const egp = (n) => `${Number(n || 0).toLocaleString("en-US")}<span class="inv__cur"> ج.م</span>`;
  const created = new Date(o.createdAt);
  const date = created.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });
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
  const sealDate = created.toLocaleDateString("en-GB").replace(/\//g, ".");
  const sh = o.shipment;
  const carrier = sh?.trackingNumber ? (typeof carrierName === "function" ? carrierName(sh) : sh.carrier || "") : "";
  const orderStatus = cancelled ? "ملغي" : (typeof ORDER_STATUSES !== "undefined" && ORDER_STATUSES[o.status]) || o.status || "";
  const site = siteUrl("").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const dueLabel = cancelled ? "الطلب ده اتلغى" : paid ? "اتدفع بالكامل" : isCod ? "المطلوب دفعه عند الاستلام" : "المطلوب تحويله";
  const payNote = cancelled ? "مفيش أي مبلغ مطلوب."
    : paid ? `اتدفع بـ${escapeHtml(o.payment?.label || "")}${o.payment?.paidAt ? ` يوم ${new Date(o.payment.paidAt).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}` : ""}، والمندوب مش هيحصّل أي فلوس.`
    : isCod ? "تقدر تفتح الشحنة وتتأكد منها قبل ما تدفع."
    : "طلبك بيتأكد أول ما التحويل يوصلنا.";

  return `
  <article class="inv ${cancelled ? "is-cancelled" : ""}" dir="rtl">
    <header class="inv__head">
      <div class="inv__brand">
        <span class="inv__logo" aria-hidden="true">G</span>
        <div>
          <b class="inv__name" dir="ltr">GTECH <span>MASR</span></b>
          <p>إكسسوارات جيمنج وكمبيوتر أصلية</p>
          <p class="inv__sub">${INVOICE_STORE.company} — القاهرة والجيزة</p>
        </div>
      </div>
      <div class="inv__title">
        <h1>فاتورة بيع</h1>
        <dl class="inv__ids">
          <div><dt>رقم الفاتورة</dt><dd dir="ltr">${escapeHtml(o.id)}</dd></div>
          <div><dt>التاريخ</dt><dd>${date}</dd></div>
          <div><dt>حالة الطلب</dt><dd>${escapeHtml(orderStatus)}</dd></div>
        </dl>
      </div>
    </header>

    <section class="inv__parties">
      <div class="inv__party">
        <h2>العميل</h2>
        <p class="inv__big">${escapeHtml(c.name || "")}</p>
        <p dir="ltr" class="inv__right">${escapeHtml(c.phone || "")}</p>
        ${c.email ? `<p dir="ltr" class="inv__right inv__muted">${escapeHtml(c.email)}</p>` : ""}
      </div>
      <div class="inv__party">
        <h2>عنوان التوصيل</h2>
        <p>${escapeHtml([a.street, a.city, a.gov].filter(Boolean).join("، "))}</p>
        ${a.notes ? `<p class="inv__muted">علامة مميزة: ${escapeHtml(a.notes)}</p>` : ""}
      </div>
      <div class="inv__party">
        <h2>الشحن والدفع</h2>
        <p>${escapeHtml(o.shipping?.label || "")}</p>
        <p>${escapeHtml(o.payment?.label || "")}</p>
        ${sh?.trackingNumber ? `<p class="inv__muted">التتبع: ${escapeHtml(carrier)} <span dir="ltr">${escapeHtml(sh.trackingNumber)}</span></p>` : ""}
      </div>
    </section>

    <table class="inv__table">
      <thead><tr><th class="n">م</th><th>المنتج</th><th class="w">الضمان</th><th class="q">الكمية</th><th class="m">سعر القطعة</th><th class="m">الإجمالي</th></tr></thead>
      <tbody>
        ${(o.items || []).map((i, k) => {
          const war = warrantyOf(i.id);
          const none = war === "بدون ضمان";
          return `
        <tr>
          <td class="n">${k + 1}</td>
          <td><b>${escapeHtml(i.name)}</b>${i.options ? `<small>${escapeHtml(i.options)}</small>` : ""}${Number(i.id) > 0 ? `<small>كود المنتج ${Number(i.id)}</small>` : ""}</td>
          <td class="w">${war ? `<span class="inv__war ${none ? "is-none" : ""}">${escapeHtml(war)}</span>` : "—"}</td>
          <td class="q">${i.qty}</td>
          <td class="m">${egp(i.price)}</td>
          <td class="m"><b>${egp(i.price * i.qty)}</b></td>
        </tr>`;
        }).join("")}
      </tbody>
    </table>

    <section class="inv__sum">
      <div class="inv__due">
        <p class="inv__due-label">${dueLabel}</p>
        <p class="inv__due-amount">${cancelled ? "—" : egp(t.total)}</p>
        ${cancelled ? "" : `<p class="inv__words">فقط ${amountInWords(t.total)} جنيه مصري لا غير</p>`}
        <p class="inv__due-note">${payNote}</p>
      </div>
      <dl class="inv__totals">
        <div><dt>إجمالي المنتجات</dt><dd>${egp(t.subtotal)}</dd></div>
        ${t.discount ? `<div><dt>الخصم</dt><dd>− ${egp(t.discount)}</dd></div>` : ""}
        <div><dt>مصاريف الشحن</dt><dd>${t.shipping ? egp(t.shipping) : "—"}</dd></div>
        <div class="inv__grand"><dt>الإجمالي</dt><dd>${egp(t.total)}</dd></div>
      </dl>
    </section>

    <section class="inv__terms">
      <div>
        <h3>الضمان</h3>
        <p>مدته مكتوبة قدام كل منتج، وبيغطي عيوب الصناعة. مايغطيش الكسر أو المية أو فتح المنتج وتصليحه برّه.</p>
      </div>
      <div>
        <h3>الاسترجاع والاستبدال</h3>
        <p>خلال 14 يوم من الاستلام، والمنتج بحالته في علبته بكل مشتملاته. لو فيه عيب صناعة الاسترجاع مجاني.</p>
      </div>
      <div>
        <h3>محتاج مساعدة؟</h3>
        <p>ابعت رقم الفاتورة على واتساب <span dir="ltr">${INVOICE_STORE.phone}</span>، وتابع طلبك من صفحة طلباتي على <span dir="ltr">${escapeHtml(site)}</span></p>
      </div>
    </section>

    <section class="inv__sign">
      <div class="inv__sigline">
        <p>استلمت الطلب سليم ومطابق للفاتورة</p>
        <span class="inv__line"></span>
        <small>اسم وتوقيع العميل</small>
      </div>
      ${cancelled ? "" : `<figure class="inv__seal" aria-label="ختم GTECH MASR">${invoiceSealSvg(sealDate)}</figure>`}
    </section>

    <footer class="inv__foot">
      <p><b>شكراً إنك اشتريت من GTECH MASR.</b> احتفظ بالفاتورة دي، هتحتاجها في الضمان أو الاسترجاع.</p>
      <p class="inv__contact"><span dir="ltr">${escapeHtml(site)}</span><span>واتساب <span dir="ltr">${INVOICE_STORE.phone}</span></span><span>${INVOICE_STORE.area}</span></p>
    </footer>
  </article>`;
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
  // الخط بيتحمّل أول ما يتستخدم، والفاتورة مخفية لحد الطباعة، فنستنى الخط (بحد أقصى ثانية ونص)
  const ready = document.fonts?.load ? Promise.all(["400 13px \"IBM Plex Sans Arabic\"", "700 13px \"IBM Plex Sans Arabic\""].map((f) => document.fonts.load(f))) : Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(() => window.print());
}
