// ============ الدفع بالتحويل: إنستاباي وفودافون كاش ============
// صاحب المتجر بيكتب بياناته من اللوحة (تاب "الشحن" ← طرق الدفع) وبتتحفظ في Firestore: settings/payment
// العميل بيختار التحويل، يبعت الطلب، يحوّل المبلغ، ويرفع صورة التحويل (paymentProofs/{رقم الطلب})
// أو يبعتها واتساب. صاحب المتجر بيأكد من اللوحة إن الفلوس وصلت.

const PAYMENT_CACHE = "gtech-payment";
const PAYMENT_LOCAL = "gtech-payment-local";   // الوضع التجريبي
const PROOFS_LOCAL = "gtech-proofs-local";     // الوضع التجريبي

const TRANSFER_METHODS = {
  instapay: { label: "إنستاباي", icon: "⚡" },
  vodafone: { label: "فودافون كاش", icon: "📱" },
};
const isTransfer = (method) => method in TRANSFER_METHODS;

let paymentSettings = store.get(FIREBASE_CONFIG ? PAYMENT_CACHE : PAYMENT_LOCAL, null) || {};

// بيانات التحويل اللي العميل هيحوّل عليها (فاضية = الطريقة دي مقفولة)
function transferTarget(method, s = paymentSettings) {
  if (method === "instapay") return (s.instapay || "").trim();
  if (method === "vodafone") return (s.vodafone || "").trim();
  return "";
}

async function loadPaymentSettings() {
  if (!FIREBASE_CONFIG) return paymentSettings;
  try {
    const root = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
    const res = await fetch(`${root}/settings/payment?key=${FIREBASE_CONFIG.apiKey}`);
    if (res.status === 404) return paymentSettings;
    if (!res.ok) throw new Error("payment " + res.status);
    const fresh = fromFirestore({ mapValue: { fields: (await res.json()).fields || {} } });
    store.set(PAYMENT_CACHE, fresh);
    if (JSON.stringify(fresh) !== JSON.stringify(paymentSettings)) {
      paymentSettings = fresh;
      document.dispatchEvent(new Event("paymentchange"));
    }
  } catch (err) {
    console.warn("payment settings", err);
  }
  return paymentSettings;
}

// رسالة واتساب جاهزة فيها رقم الطلب والمبلغ
const proofWhatsApp = (order) => waLink(`أهلاً GTECH MASR، حوّلت ${order.totals.total.toLocaleString("en-US")} ج.م بـ${TRANSFER_METHODS[order.payment.method]?.label || "تحويل"} لطلب رقم ${order.id}، ودي صورة التحويل:`);

// ============ صورة التحويل ============
// بنصغّرها (أقصى عرض 1000 بكسل) عشان تتخزن في قاعدة البيانات
function shrinkProof(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.75;
      let data = c.toDataURL("image/jpeg", q);
      while (data.length > 700000 && q > 0.35) data = c.toDataURL("image/jpeg", (q -= 0.1));
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("صورة مش مقروءة")); };
    img.src = url;
  });
}

async function uploadProof(orderId, file) {
  const data = await shrinkProof(file);
  const proof = { data, createdAt: new Date().toISOString() };
  if (!FIREBASE_CONFIG) {
    store.set(PROOFS_LOCAL, { ...store.get(PROOFS_LOCAL, {}), [orderId]: proof });
    return;
  }
  const u = await ensureCustomerAuth();
  await firebase.firestore().collection("paymentProofs").doc(orderId).set({ ...proof, uid: u.uid });
}

loadPaymentSettings();
