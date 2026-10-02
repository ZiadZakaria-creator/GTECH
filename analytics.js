// ============ قياس الزوار والإعلانات: Google Analytics 4 + Meta Pixel ============
// الأكواد في firebase-config.js (ANALYTICS_IDS). لو فاضية مفيش أي حاجة بتتحمّل.
// الأحداث: مشاهدة منتج، إضافة للسلة، بدء الدفع، وشراء تم (بقيمته) — عشان تعرف أنهي إعلان بيجيب بيع.
// زيارات صاحب المتجر من المتصفح اللي فتح منه لوحة التحكم ماتتحسبش.

const ANALYTICS_ON = (() => {
  try { if (localStorage.getItem("gtech-admin-browser") === "true") return false; } catch {}
  return typeof ANALYTICS_IDS !== "undefined";
})();
const GA_ID = ANALYTICS_ON ? (ANALYTICS_IDS.ga4 || "").trim() : "";
const PIXEL_ID = ANALYTICS_ON ? (ANALYTICS_IDS.metaPixel || "").trim() : "";

if (GA_ID) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA_ID);
}
if (PIXEL_ID) {
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
  s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
}

// track("view_item" | "add_to_cart" | "begin_checkout" | "purchase", { items: [{id, name, price, qty}], value, orderId })
const FB_EVENTS = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" };
function track(event, { items = [], value, orderId } = {}) {
  if (!GA_ID && !PIXEL_ID) return;
  const total = value ?? items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  try {
    if (GA_ID) gtag("event", event, {
      currency: "EGP", value: total, ...(orderId ? { transaction_id: orderId } : {}),
      items: items.map((i) => ({ item_id: String(i.id), item_name: i.name, price: i.price, quantity: i.qty || 1 })),
    });
    if (PIXEL_ID) fbq("track", FB_EVENTS[event], {
      currency: "EGP", value: total, content_type: "product",
      content_ids: items.map((i) => String(i.id)), num_items: items.reduce((s, i) => s + (i.qty || 1), 0),
    }, orderId ? { eventID: orderId } : undefined);
  } catch (err) { console.warn("analytics", err); }
}
