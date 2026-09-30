// ============ أساسيات مشتركة (المتجر + الداشبورد) ============

// رقم واتساب المتجر بالصيغة الدولية (مصر = 20)
const WHATSAPP = "201100053123";
const waLink = (text, phone = WHATSAPP) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

const fmt = (n) => n.toLocaleString("ar-EG") + " ج.م";
const num = (n) => n.toLocaleString("ar-EG");
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const normalizePhone = (s) => toLatinDigits(s).replace(/[\s-]/g, "");
const isValidPhone = (s) => /^01[0125]\d{8}$/.test(normalizePhone(s));
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
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
  setTheme(currentTheme());
  const flip = () => setTheme(currentTheme() === "light" ? "dark" : "light");
  document.getElementById("themeToggle").addEventListener("click", flip);
  document.getElementById("navTheme")?.addEventListener("click", flip);
})();
