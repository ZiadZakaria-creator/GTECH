// ============ لوحة التحكم: بيانات خاصة بالأدمن ============
// التكلفة، الردود الجاهزة، المتابعات، وعلامات العملاء: حاجات مايصحش تبقى في المنتجات (لأن المنتجات أي حد يقراها).
// بتتحفظ في مستند في مجموعة adminData (الأدمن بس يقرا ويكتب) + نسخة في المتصفح.
// لو قواعد الأمان الجديدة لسه ماتنشرتش، كل حاجة بتشتغل من المتصفح ده بس لحد ما تتنشر، وبعدها بتترفع لوحدها.
// كل مستند بيتقري مرة واحدة بس في الجلسة (عشان حصة القراءة في Firestore).

const PRIV_LOCAL = "gtech-admin-private"; // { costs: {...}, replies: {...}, followups: {...}, customers: {...} }
const privCache = {};
const privLoading = {};
let privCloud = USE_FIREBASE ? "unknown" : "local"; // "ok" | "local" (القواعد لسه قديمة) | "unknown"

const privLocalAll = () => store.get(PRIV_LOCAL, {});
function privLocalSet(name, data) {
  const all = privLocalAll();
  all[name] = data;
  store.set(PRIV_LOCAL, all);
}

// بيرجّع المستند كـ object (فاضي لو مفيش)
function privLoad(name) {
  if (privCache[name]) return Promise.resolve(privCache[name]);
  if (privLoading[name]) return privLoading[name];
  const local = privLocalAll()[name] || {};
  privLoading[name] = (async () => {
    let data = { ...local };
    if (USE_FIREBASE) {
      try {
        await loadFirebase(["auth", "firestore"]);
        const snap = await firebase.firestore().collection("adminData").doc(name).get();
        const remote = snap.exists ? snap.data() : {};
        data = { ...local, ...remote };
        privCloud = "ok";
        // حاجات اتسجلت على الجهاز ده قبل ما القواعد تتنشر ← ترتفع
        const missing = Object.keys(local).filter((k) => !(k in remote));
        if (missing.length) {
          await firebase.firestore().collection("adminData").doc(name)
            .set(Object.fromEntries(missing.map((k) => [k, local[k]])), { merge: true });
        }
      } catch (err) {
        console.warn("adminData", name, err);
        if (err?.code === "permission-denied") privCloud = "local";
      }
    }
    privCache[name] = data;
    privLocalSet(name, data);
    delete privLoading[name];
    document.dispatchEvent(new Event("privchange"));
    return data;
  })();
  return privLoading[name];
}

// تعديل مفاتيح معيّنة بس (null = امسح المفتاح)، عشان جهازين مايمسحوش تعديلات بعض
async function privPatch(name, patch) {
  const data = { ...(await privLoad(name)) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete data[k];
    else data[k] = v;
  }
  privCache[name] = data;
  privLocalSet(name, data);
  document.dispatchEvent(new Event("privchange"));
  if (USE_FIREBASE && privCloud !== "local") {
    try {
      const del = firebase.firestore.FieldValue.delete();
      await firebase.firestore().collection("adminData").doc(name)
        .set(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null || v === undefined ? del : v])), { merge: true });
      privCloud = "ok";
    } catch (err) {
      console.warn("adminData save", name, err);
      if (err?.code === "permission-denied") {
        privCloud = "local";
        document.dispatchEvent(new Event("privchange"));
      }
    }
  }
  return data;
}

const privGet = (name) => privCache[name] || privLocalAll()[name] || {};

// سطر تحذير بيظهر في الأقسام اللي بتستخدم البيانات دي لو القواعد لسه قديمة
function privNote() {
  return USE_FIREBASE && privCloud === "local"
    ? `<p class="priv-note">⚠️ البيانات دي محفوظة على الجهاز ده بس دلوقتي. انشر قواعد الأمان الجديدة (firestore.rules) من Firebase Console عشان تتحفظ وتبان على كل أجهزتك، واللي كتبته هنا هيترفع لوحده.</p>`
    : "";
}

// الأرقام: 01xxxxxxxxx
const privPhone = (p) => normalizePhone(String(p || "")).replace(/^\+?20(?=1)/, "0");
