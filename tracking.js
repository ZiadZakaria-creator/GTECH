// ============ تتبع الطلبات (مشترك بين الرئيسية وطلباتي) ============
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

// العميل ده عمل طلب من المتصفح ده قبل كده؟ (عشان منتابعش طلبات من غير داعي)
const HAS_ORDERS_KEY = "gtech-has-orders";

const trackLabel = (s) => (s === "cancelled" ? "ملغي" : TRACK_LABELS[s]);

function trackPill(status) {
  return `<span class="pill-status pill-status--${status}">${status === "cancelled" ? "✖ ملغي" : `${TRACK_ICONS[status]} ${TRACK_LABELS[status]}`}</span>`;
}

// أيقونات خطوات التتبع (Lucide) بدل الإيموجي — شكلها موحّد على كل الموبايلات
const TRACK_SVG = {
  new: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  confirmed: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  shipped: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  delivered: '<path d="m16 16 2 2 4-4M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14M7.5 4.27l9 5.15"/><path d="M3.29 7 12 12l8.71-5M12 22V12"/>',
  done: '<path d="M20 6 9 17l-5-5"/>',
};
const trackSvg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TRACK_SVG[k]}</svg>`;

function trackBar(status) {
  if (status === "cancelled") return "";
  const step = TRACK_STEPS.indexOf(status);
  return `
    <ol class="track" style="--progress:${step / (TRACK_STEPS.length - 1)}">
      ${TRACK_STEPS.map((s, i) => `
        <li class="${i < step ? "done" : i === step ? "current" : ""}">
          <span>${trackSvg(i < step ? "done" : s)}</span><small>${TRACK_LABELS[s]}</small>
        </li>`).join("")}
    </ol>`;
}

// بيرجع دالة بتقارن الحالات بالمرة اللي فاتت وتطلع إشعار لو طلب اتغيرت حالته
function statusChangeNotifier() {
  let last = null;
  return (orders) => {
    if (last) {
      orders.forEach((o) => {
        const before = last.get(o.id);
        if (before && before !== o.status) toast(`🔔 طلبك ${o.id} بقى "${trackLabel(o.status)}"`);
      });
    }
    last = new Map(orders.map((o) => [o.id, o.status]));
  };
}
