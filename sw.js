// ============ Service Worker: بيخلّي المتجر يتسطب كتطبيق ويفتح من غير نت ============
// الصفحات والملفات: من النت الأول (عشان التحديثات توصل على طول)، ولو مفيش نت من النسخة المحفوظة.
// الصور: من المحفوظ الأول عشان السرعة.
const VERSION = "gtech-v5";
const CORE = [
  "./", "index.html", "product.html", "wishlist.html", "checkout.html", "compare.html", "myorders.html",
  "styles.css", "data.js", "firebase-config.js", "core.js", "catalog.js", "common.js", "visits.js",
  "api.js", "tracking.js", "shipping.js", "email.js", "alerts.js", "home.js", "product.js", "wishlist.js",
  "checkout.js", "compare.js", "myorders.js", "icons/icon-192.png", "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Firebase و EmailJS والخطوط وأي حاجة من برّه: زي ما هي من غير تدخل
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (/\/(images|icons|p\/img)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(async () =>
        (await caches.match(req)) ||
        (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
