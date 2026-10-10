// ============ قياس الزوار والإعلانات: Google Analytics 4 + Meta Pixel + TikTok Pixel ============
// الأكواد في firebase-config.js (ANALYTICS_IDS). لو فاضية مفيش أي حاجة بتتحمّل.
// الأحداث: مشاهدة منتج، إضافة للسلة، بدء الدفع، وشراء تم (بقيمته) — عشان تعرف أنهي إعلان بيجيب بيع.
// زيارات صاحب المتجر من المتصفح اللي فتح منه لوحة التحكم ماتتحسبش.

const ANALYTICS_ON = (() => {
  try { if (localStorage.getItem("gtech-admin-browser") === "true") return false; } catch {}
  return typeof ANALYTICS_IDS !== "undefined";
})();
const GA_ID = ANALYTICS_ON ? (ANALYTICS_IDS.ga4 || "").trim() : "";
const PIXEL_ID = ANALYTICS_ON ? (ANALYTICS_IDS.metaPixel || "").trim() : "";
const TT_ID = ANALYTICS_ON ? (ANALYTICS_IDS.tiktokPixel || "").trim() : "";

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

if (TT_ID) {
  /* eslint-disable */
  !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)}}(window,document,"ttq");
  /* eslint-enable */
  ttq.load(TT_ID);
  ttq.page();
}

// track("view_item" | "add_to_cart" | "begin_checkout" | "purchase", { items: [{id, name, price, qty}], value, orderId })
const FB_EVENTS = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase", whatsapp_order: "Contact" };
const TT_EVENTS = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "CompletePayment", whatsapp_order: "Contact" };
function track(event, { items = [], value, orderId } = {}) {
  if (typeof countFunnel === "function") countFunnel(event); // للوحة التحكم (تاب الزوار)
  if (!GA_ID && !PIXEL_ID && !TT_ID) return;
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
    if (TT_ID) ttq.track(TT_EVENTS[event], {
      currency: "EGP", value: total, content_type: "product",
      contents: items.map((i) => ({ content_id: String(i.id), content_name: i.name, price: i.price, quantity: i.qty || 1 })),
    }, orderId ? { event_id: orderId } : undefined);
  } catch (err) { console.warn("analytics", err); }
}
