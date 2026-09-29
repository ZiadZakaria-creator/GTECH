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
