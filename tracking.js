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

function trackBar(status) {
  if (status === "cancelled") return "";
  const step = TRACK_STEPS.indexOf(status);
  return `
    <ol class="track" style="--progress:${step / (TRACK_STEPS.length - 1)}">
      ${TRACK_STEPS.map((s, i) => `
        <li class="${i < step ? "done" : i === step ? "current" : ""}">
          <span>${i < step ? "✓" : TRACK_ICONS[s]}</span><small>${TRACK_LABELS[s]}</small>
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
