// ============ إيميلات الطلبات ============
// بتتبعت عن طريق EmailJS (مجاني لحد 200 إيميل في الشهر) من غير سيرفر.
// القالب في EmailJS فيه: الموضوع {{subject}}، المستلم {{to_email}}، والمحتوى {{{html}}}

const EMAIL_ON = typeof EMAIL_CONFIG !== "undefined" && !!EMAIL_CONFIG?.publicKey && !!EMAIL_CONFIG?.serviceId && !!EMAIL_CONFIG?.templateId;

const EMAIL_STAGES = {
  new: { icon: "🎉", title: "طلبك وصلنا!", subject: "تم استلام طلبك", msg: "شكراً إنك اخترت GTECH MASR. هنتواصل معاك قريب عشان نأكد الطلب." },
  confirmed: { icon: "✅", title: "تم تأكيد طلبك", subject: "تم تأكيد طلبك", msg: "طلبك اتأكد وبنجهزه دلوقتي للشحن." },
  shipped: { icon: "🚚", title: "طلبك خرج للتوصيل", subject: "طلبك خرج للتوصيل", msg: "المندوب في الطريق ليك. خلي موبايلك جنبك عشان هيكلمك قبل ما يوصل." },
  delivered: { icon: "📦", title: "تم استلام طلبك", subject: "تم توصيل طلبك", msg: "طلبك اتسلّم. نتمنى المنتج يعجبك! لو فيه أي مشكلة كلمنا." },
  cancelled: { icon: "✖", title: "تم إلغاء طلبك", subject: "تم إلغاء طلبك", msg: "الطلب ده اتلغى. لو ده حصل بالغلط أو محتاج مساعدة، رد على الإيميل ده أو كلمنا على واتساب." },
};
const EMAIL_STEPS = ["new", "confirmed", "shipped", "delivered"];
const EMAIL_STEP_LABELS = { new: "تم الاستلام", confirmed: "تم التأكيد", shipped: "خرج للتوصيل", delivered: "تم التوصيل" };

const egp = (n) => Number(n).toLocaleString("en-US") + " ج.م";
const siteUrl = (page) => new URL(page, document.baseURI).href; // baseURI عشان لوحة التحكم (admin/) تطلع روابط المتجر صح

function orderEmailHtml(order, status) {
  const s = EMAIL_STAGES[status];
  const t = order.totals;
  const e = escapeHtml;
  const step = EMAIL_STEPS.indexOf(status);
  const progress = status === "cancelled" ? "" : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px">
      <tr>${EMAIL_STEPS.map((x, i) => `
        <td align="center" style="font-size:12px;color:${i <= step ? "#0a84ff" : "#9aa5b8"};font-weight:${i === step ? 700 : 400}">
          <div style="width:30px;height:30px;line-height:30px;border-radius:50%;margin:0 auto 6px;background:${i < step ? "#22c55e" : i === step ? "#0a84ff" : "#e6ebf3"};color:#fff;font-weight:700">${i < step ? "✓" : i + 1}</div>
          ${EMAIL_STEP_LABELS[x]}
        </td>`).join("")}
      </tr>
    </table>`;
  const rows = order.items.map((i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6">${e(i.name)}${i.options ? `<br><span style="color:#8a94a6;font-size:12px">${e(i.options)}</span>` : ""}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;color:#6b7589;white-space:nowrap" align="center">${i.qty} ×</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;white-space:nowrap" align="left">${egp(i.price * i.qty)}</td>
    </tr>`).join("");
  return `
<div dir="rtl" style="margin:0;padding:24px 12px;background:#f2f5fa;font-family:Tahoma,Arial,sans-serif;color:#1d2433">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#00d4ff,#0a84ff 50%,#7c5cff);background-color:#0a84ff;padding:22px 24px;color:#fff">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px;direction:ltr;text-align:right">GTECH MASR</div>
    </td></tr>
    <tr><td style="padding:26px 24px 8px">
      <div style="font-size:36px;line-height:1">${s.icon}</div>
      <h1 style="margin:10px 0 6px;font-size:22px">${s.title}</h1>
      <p style="margin:0;color:#4b5568;line-height:1.8">أهلاً ${e(order.customer.name)}، ${s.msg}</p>
      ${progress}
      <p style="margin:14px 0 0;padding:12px 14px;background:#f5f8fd;border-radius:10px;font-size:14px">
        رقم الطلب: <b style="direction:ltr;unicode-bidi:embed">${e(order.id)}</b><br>
        الدفع: ${e(order.payment.label)} · الشحن: ${e(order.shipping.label)}
      </p>
    </td></tr>
    <tr><td style="padding:10px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
        <tr><td style="padding:8px 0;color:#6b7589">المجموع</td><td></td><td align="left" style="padding:8px 0">${egp(t.subtotal)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7589">الشحن</td><td></td><td align="left">${t.shipping ? egp(t.shipping) : "مجاناً"}</td></tr>
        ${t.discount ? `<tr><td style="padding:4px 0;color:#16a34a">الخصم</td><td></td><td align="left" style="color:#16a34a">- ${egp(t.discount)}</td></tr>` : ""}
        <tr><td style="padding:12px 0 0;font-weight:900;font-size:16px">الإجمالي</td><td></td><td align="left" style="padding:12px 0 0;font-weight:900;font-size:16px">${egp(t.total)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 24px;color:#4b5568;font-size:14px">
      📍 ${e(order.address.street)}، ${e(order.address.city)}، ${e(order.address.gov)}
    </td></tr>
    ${order.shipment?.trackingNumber && status === "shipped" ? `<tr><td style="padding:4px 24px 10px">
      <p style="margin:0;padding:12px 14px;background:#eefaf2;border-radius:10px;font-size:14px;color:#1d2433">
        🚚 شحنتك مع ${e(typeof carrierName === "function" ? carrierName(order.shipment) : "شركة الشحن")} — رقم التتبع: <b style="direction:ltr;unicode-bidi:embed">${e(order.shipment.trackingNumber)}</b>
        ${typeof shipmentTrackUrl === "function" && shipmentTrackUrl(order.shipment) ? `<br><a href="${e(shipmentTrackUrl(order.shipment))}" style="color:#0a84ff;font-weight:700">تتبع الشحنة لحظة بلحظة ←</a>` : ""}
      </p>
    </td></tr>` : ""}
    <tr><td align="center" style="padding:8px 24px 26px">
      <a href="${siteUrl("myorders.html")}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:700">تابع طلبك</a>
    </td></tr>
    <tr><td align="center" style="padding:14px;background:#f5f8fd;color:#8a94a6;font-size:12px">
      GTECH MASR · للاستفسار واتساب ${WHATSAPP.replace(/^20/, "0")}
    </td></tr>
  </table>
</div>`;
}

async function sendEmail(to, name, subject, html) {
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAIL_CONFIG.serviceId,
      template_id: EMAIL_CONFIG.templateId,
      user_id: EMAIL_CONFIG.publicKey,
      template_params: { to_email: to, to_name: name, subject, html, reply_to: EMAIL_CONFIG.storeEmail || "" },
    }),
  });
  if (!res.ok) throw new Error(`email ${res.status}: ${await res.text()}`);
}

// بيبعت للعميل إيميل بحالة الطلب. بيرجّع true لو اتبعت
async function sendOrderEmail(order, status = order.status) {
  const to = order.customer?.email;
  if (!EMAIL_ON || !to || !EMAIL_STAGES[status]) return false;
  const s = EMAIL_STAGES[status];
  await sendEmail(to, order.customer.name, `${s.subject} ${order.id} — GTECH MASR`, orderEmailHtml(order, status));
  return true;
}

// إشعار فوري على موبايل صاحب المتجر بكل طلب جديد (تطبيق ntfy — ORDER_PUSH_TOPIC في firebase-config.js)
// من غير اسم العميل ولا رقمه، لأن أي حد يعرف اسم القناة يقدر يقراها
async function pushStoreOfOrder(order) {
  if (typeof ORDER_PUSH_TOPIC === "undefined" || !ORDER_PUSH_TOPIC) return false;
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const lines = order.items.map((i) => `• ${clip(i.name, 70)} × ${i.qty}`);
  lines.push("", `📍 ${order.address.gov} · ${order.payment.label} · ${order.shipping.label}`, `رقم الطلب: ${order.id}`);
  const res = await fetch("https://ntfy.sh/", {
    method: "POST",
    body: JSON.stringify({
      topic: ORDER_PUSH_TOPIC,
      title: `🛒 طلب جديد — ${egp(order.totals.total)}`,
      message: lines.join("\n"),
      priority: 5,
      tags: ["moneybag"],
      click: siteUrl("admin/"),
    }),
  });
  if (!res.ok) throw new Error("ntfy " + res.status);
  return true;
}

// إيميل لصاحب المتجر بكل طلب جديد (لو storeEmail متحط)
async function notifyStoreOfOrder(order) {
  if (!EMAIL_ON || !EMAIL_CONFIG.storeEmail) return false;
  const html = orderEmailHtml(order, "new")
    .replace(EMAIL_STAGES.new.title, `طلب جديد من ${escapeHtml(order.customer.name)}`)
    .replace(`${EMAIL_STAGES.new.msg}`, `رقم العميل: ${escapeHtml(order.customer.phone)}`);
  await sendEmail(EMAIL_CONFIG.storeEmail, "GTECH MASR", `🛒 طلب جديد ${order.id} — ${egp(order.totals.total)}`, html);
  return true;
}
