// ============ أساسيات مشتركة (المتجر + الداشبورد) ============

// ريفريش الصفحة ← نرجع لأولها (بدل ما المتصفح يرجّعنا لنفس المكان).
// الرجوع بزرار "رجوع" بيفضل يرجّعك لنفس المكان زي ما هو.
(function scrollTopOnReload() {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type !== "reload" || !("scrollRestoration" in history)) return;
    history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    scrollTo(0, 0);
    addEventListener("load", () => scrollTo(0, 0));
    addEventListener("pagehide", () => { history.scrollRestoration = "auto"; });
  } catch {}
})();

// رقم واتساب المتجر بالصيغة الدولية (مصر = 20)
const WHATSAPP = "201100053123";
const waLink = (text, phone = WHATSAPP) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

// اللغة جاية من i18n.js (لوحة التحكم مش بتحمّله فبتفضل عربي)
const LOCALE = typeof IS_EN !== "undefined" && IS_EN ? "en-GB" : "ar-EG";
const fmt = (n) => (LOCALE === "ar-EG" ? n.toLocaleString("ar-EG") + " ج.م" : n.toLocaleString("en-US") + " EGP");
const num = (n) => n.toLocaleString(LOCALE === "ar-EG" ? "ar-EG" : "en-US");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const normalizePhone = (s) => toLatinDigits(s).replace(/[\s-]/g, "");
const isValidPhone = (s) => /^01[0125]\d{8}$/.test(normalizePhone(s));
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ============ صاحبك عليا ============
// كل رقم موبايل ليه كود ثابت (مش بيكشف الرقم). صاحبك اللي يدخل من لينكك ياخد 10% على أول أوردر،
// وإنت تاخد مكافأة خصم 10% على أوردرك الجاي لما أوردره يتسلّم (اللوحة بتحسبها في rewards/الكود).
const REF_RATE = 0.1;
const SITE_ROOT = new URL(".", document.currentScript?.src || location.href).href;
function referralCode(phone) {
  let h = 2166136261;
  for (const ch of "gtech-ref:" + normalizePhone(String(phone || ""))) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36).toUpperCase();
}
const referralLink = (code) => `${SITE_ROOT}?ref=${code}`;

// تاريخ النهارده بتوقيت القاهرة (YYYY-MM-DD)
const cairoDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ============ Firebase ============
// بيتحمّل بس لما نحتاجه (دخول Google/Facebook أو قاعدة بيانات الطلبات)
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const loadScript = (src) => new Promise((ok, fail) => {
  const s = document.createElement("script");
  s.src = src; s.onload = ok; s.onerror = fail;
  document.head.appendChild(s);
});

async function loadFirebase(modules = []) {
  if (!window.firebase) await loadScript(FIREBASE_SDK + "firebase-app-compat.js");
  for (const m of modules) {
    if (!firebase[m]) await loadScript(FIREBASE_SDK + `firebase-${m}-compat.js`);
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
}

// ============ Toast ============
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), Math.max(2600, String(msg).length * 55)); // الرسايل الطويلة بتقعد أكتر
}

// ============ الوضع الفاتح / الغامق ============
// الاختيار بيتحفظ في المتصفح، وسطر في <head> كل صفحة بيطبّقه قبل ما الصفحة تترسم
const THEME_KEY = "gtech-theme";
const themeIcons = {
  dark: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  light: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
};
const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  // لون شريط الموبايل فوق (في التطبيق) يمشي مع الوضع
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f3f6fb" : "#070b14");
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  const b = document.getElementById("themeToggle");
  if (b) {
    b.innerHTML = themeIcons[theme];
    b.setAttribute("aria-label", theme === "light" ? "الوضع الغامق" : "الوضع الفاتح");
    b.title = b.getAttribute("aria-label");
  }
  const n = document.getElementById("navTheme");
  if (n) n.innerHTML = `${themeIcons[theme]} ${theme === "light" ? "الوضع الغامق" : "الوضع الفاتح"}`;
}
(() => {
  const actions = document.querySelector(".header__actions, .ad-top__actions");
  if (!actions) return;
  actions.insertAdjacentHTML("afterbegin", '<button class="icon-btn theme-toggle" id="themeToggle" type="button"></button>');
  // على الموبايل الزرار بيبقى جوه القائمة عشان الهيدر مايزحمش
  document.getElementById("nav")?.insertAdjacentHTML("beforeend", '<button class="nav-theme" id="navTheme" type="button"></button>');
  // الموبايل الصغير: زرار المفضلة بيتنقل للقائمة عشان الهيدر مايخرجش برّه الشاشة
  if (document.querySelector('.header__actions a[href="wishlist.html"]'))
    document.getElementById("nav")?.insertAdjacentHTML("beforeend", '<a href="wishlist.html" class="nav-wish">❤️ المفضلة</a>');
  setTheme(currentTheme());
  const flip = () => setTheme(currentTheme() === "light" ? "dark" : "light");
  document.getElementById("themeToggle").addEventListener("click", flip);
  document.getElementById("navTheme")?.addEventListener("click", flip);
})();

// ============ التطبيق (PWA) ============
// المتجر بيتسطب على الموبايل كتطبيق: أيقونة على الشاشة، بيفتح full screen، وبيشتغل من غير نت
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((err) => console.warn("sw", err)));
}

const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true || /GTECHAdminApp/.test(navigator.userAgent);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installPrompt = null;

// على الموبايل الزرار بيظهر دايماً (لو المتصفح ماعرضش التثبيت لوحده بنوري العميل الخطوات)
const isMobile = () => matchMedia("(max-width: 900px)").matches || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
function canInstall() {
  return !isStandalone() && (!!installPrompt || isMobile());
}

function renderInstallUI() {
  const show = canInstall();
  document.querySelectorAll("[data-install]").forEach((el) => { el.hidden = !show; });
  const banner = document.getElementById("appBanner");
  if (banner) banner.hidden = !show || store.get("gtech-app-banner-closed", false);
}

async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null;
    if (outcome === "accepted") toast("📲 التطبيق بيتسطب على موبايلك");
    renderInstallUI();
    return;
  }
  openInstallSteps();
}

// خطوات التثبيت يدوي: آيفون (Safari)، أو أندرويد لو Chrome ماعرضش التثبيت
function openInstallSteps() {
  const ios = isIOS();
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok/i.test(navigator.userAgent);
  const dots = '<span class="ios-share" aria-hidden="true">⋮</span>';
  const share = '<span class="ios-share" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span>';
  const steps = inApp
    ? [`إنت فاتح الموقع من جوه تطبيق تاني (واتساب أو فيسبوك)`, `دوس ${dots} فوق واختار <b>"فتح في المتصفح"</b> (${ios ? "Safari" : "Chrome"})`, `وبعدين دوس "نزّل التطبيق" تاني`]
    : ios
      ? [`افتح الموقع من <b>Safari</b>`, `دوس على زرار المشاركة ${share} تحت`, `اختار <b>"إضافة إلى الشاشة الرئيسية"</b> (Add to Home Screen)`, `دوس <b>"إضافة"</b> — والأيقونة هتظهر مع باقي التطبيقات`]
      : [`افتح الموقع من <b>Google Chrome</b>`, `دوس على ${dots} (التلات نقط) فوق في الركن`, `اختار <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>`, `دوس <b>"تثبيت"</b> — والأيقونة هتظهر مع باقي التطبيقات`];
  let m = document.getElementById("iosInstall");
  if (!m) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal" id="iosInstall" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle">
        <div class="modal__box card-box ios-install">
          <button type="button" class="icon-btn modal__close" data-close-ios aria-label="إغلاق">✕</button>
          <img src="icons/icon-192.png" alt="" width="64" height="64" class="ios-install__icon" />
          <h3 id="iosInstallTitle"></h3>
          <ol id="installSteps"></ol>
          <button type="button" class="btn btn--primary btn--block" data-close-ios>تمام</button>
        </div>
      </div>`);
    m = document.getElementById("iosInstall");
    m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("[data-close-ios]")) m.hidden = true; });
  }
  document.getElementById("iosInstallTitle").textContent = `نزّل تطبيق GTECH على ${ios ? "الآيفون" : "موبايلك"}`;
  document.getElementById("installSteps").innerHTML = steps.map((x) => `<li>${x}</li>`).join("");
  m.hidden = false;
}

addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  renderInstallUI();
});
addEventListener("appinstalled", () => {
  installPrompt = null;
  store.set("gtech-app-banner-closed", true);
  renderInstallUI();
});

(() => {
  const nav = document.getElementById("nav");
  const adminActions = document.querySelector(".ad-top__actions");
  if (nav) {
    nav.insertAdjacentHTML("beforeend", '<button class="nav-install" type="button" data-install hidden>📲 نزّل التطبيق</button>');
    // شريط صغير فوق الصفحة على الموبايل
    document.querySelector(".header")?.insertAdjacentHTML("afterend", `
      <div class="app-banner" id="appBanner" hidden>
        <img src="icons/icon-192.png" alt="" width="40" height="40" />
        <div><b>تطبيق GTECH</b><small>أسرع، وبيفتح من غير متصفح</small></div>
        <button type="button" class="btn btn--primary btn--sm" data-install-btn>نزّله</button>
        <button type="button" class="icon-btn app-banner__close" aria-label="إخفاء">✕</button>
      </div>`);
    document.querySelector(".app-banner__close")?.addEventListener("click", () => {
      store.set("gtech-app-banner-closed", true);
      renderInstallUI();
    });
  } else if (adminActions) {
    adminActions.insertAdjacentHTML("afterbegin", '<button class="icon-btn" type="button" data-install hidden aria-label="نزّل تطبيق لوحة التحكم" title="نزّل تطبيق لوحة التحكم">📲</button>');
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-install], [data-install-btn]")) installApp();
  });
  renderInstallUI();
})();
