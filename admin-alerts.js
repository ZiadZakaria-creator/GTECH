// ============ لوحة التحكم: تنبيهات "نبّهني" ============
// أول ما منتج يرجع المخزون أو سعره يقل عن السعر اللي العميل اشترك عنده،
// اللوحة بتبعت الإيميلات لوحدها (وهي مفتوحة) وتمسح التنبيهات اللي اتبعتت.

const ALERTS_LOCAL = "gtech-alerts-local"; // نفس المفتاح اللي في alerts.js (الوضع التجريبي)

const alertsStore = USE_FIREBASE
  ? {
      watch(onData, onError) {
        let stop = () => {};
        loadFirebase(["auth", "firestore"]).then(() => {
          stop = firebase.firestore().collection("alerts").onSnapshot(
            (snap) => onData(snap.docs.map((d) => ({ ...d.data(), _id: d.id }))), onError);
        }, onError);
        return () => stop();
      },
      async remove(ids) {
        const db = firebase.firestore();
        for (let i = 0; i < ids.length; i += 400) {
          const batch = db.batch();
          ids.slice(i, i + 400).forEach((id) => batch.delete(db.collection("alerts").doc(id)));
          await batch.commit();
        }
      },
    }
  : {
      watch(onData) {
        const emit = () => onData(store.get(ALERTS_LOCAL, []));
        const onStorage = (e) => e.key === ALERTS_LOCAL && emit();
        addEventListener("storage", onStorage);
        document.addEventListener("localalerts", emit);
        emit();
        return () => removeEventListener("storage", onStorage);
      },
      async remove(ids) {
        store.set(ALERTS_LOCAL, store.get(ALERTS_LOCAL, []).filter((a) => !ids.includes(a._id)));
        document.dispatchEvent(new Event("localalerts"));
      },
    };

let allAlerts = [];
let alertsSending = false;
const alertsFailed = new Set(); // اللي فشل مايتعادش لوحده في نفس الجلسة (عشان مانستهلكش الإيميلات)

const alertProducts = () => (productsLoaded && adminProducts.length ? adminProducts : products);

// التنبيه جاهز لو المنتج ظاهر وفيه مخزون، ولو تنبيه سعر: السعر الحالي أقل من سعر الاشتراك
function alertReady(a) {
  const p = alertProducts().find((x) => x.id === Number(a.productId));
  if (!p || !isForSale(p) || !inStock(p)) return null;
  if (a.type === "price" && !(p.price < a.price)) return null;
  return p;
}

// التنبيهات الجاهزة متجمّعة: إيميل واحد لكل عميل ومنتج ونوع
function readyGroups() {
  const groups = new Map();
  allAlerts.forEach((a) => {
    const p = alertReady(a);
    if (!p) return;
    const key = `${String(a.email).toLowerCase()}|${p.id}|${a.type}`;
    if (!groups.has(key)) groups.set(key, { key, email: a.email, name: a.name || "", type: a.type, p, oldPrice: a.price, ids: [] });
    const g = groups.get(key);
    g.ids.push(a._id);
    g.oldPrice = Math.max(g.oldPrice, a.price);
  });
  return [...groups.values()];
}

function alertEmailHtml(g) {
  const e = escapeHtml;
  const p = g.p;
  const img = (p.images || []).find((src) => /^https?:/.test(src)) || (p.images?.[0] && !String(p.images[0]).startsWith("fs:") ? siteUrl(p.images[0]) : "");
  const headline = g.type === "stock" ? "🎉 المنتج رجع تاني!" : "📉 السعر نزل!";
  const line = g.type === "stock"
    ? `المنتج اللي كنت مستنيه رجع المخزون. الكمية محدودة، الحق اطلبه قبل ما يخلص.`
    : `سعر المنتج اللي بتتابعه نزل من <s style="color:#9aa5b8">${egp(g.oldPrice)}</s> لـ <b style="color:#16a34a">${egp(p.price)}</b> — يعني هتوفّر ${egp(g.oldPrice - p.price)}.`;
  return `
<div dir="rtl" style="margin:0;padding:24px 12px;background:#f2f5fa;font-family:Tahoma,Arial,sans-serif;color:#1d2433">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#00d4ff,#0a84ff 50%,#7c5cff);background-color:#0a84ff;padding:22px 24px;color:#fff">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px;direction:ltr;text-align:right">GTECH</div>
    </td></tr>
    <tr><td style="padding:26px 24px 8px">
      <h1 style="margin:0 0 8px;font-size:22px">${headline}</h1>
      <p style="margin:0;color:#4b5568;line-height:1.8">أهلاً${g.name ? " " + e(g.name) : ""}، ${line}</p>
    </td></tr>
    <tr><td align="center" style="padding:18px 24px">
      ${img ? `<img src="${e(img)}" alt="" width="220" style="max-width:220px;border-radius:12px;display:block;margin:0 auto 12px">` : ""}
      <div style="font-size:18px;font-weight:700">${e(p.name)}</div>
      <div style="font-size:20px;font-weight:900;color:#0a84ff;margin-top:6px">${egp(p.price)}</div>
    </td></tr>
    <tr><td align="center" style="padding:4px 24px 26px">
      <a href="${siteUrl(`product.html?id=${p.id}`)}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:700">اطلبه دلوقتي</a>
    </td></tr>
    <tr><td align="center" style="padding:14px;background:#f5f8fd;color:#8a94a6;font-size:12px">
      وصلك الإيميل ده عشان طلبت تنبيه من GTECH على المنتج ده · التنبيه بيتبعت مرة واحدة بس
    </td></tr>
  </table>
</div>`;
}

async function sendReadyAlerts(manual = false) {
  if (alertsSending || !EMAIL_ON) return;
  const groups = readyGroups().filter((g) => manual || !alertsFailed.has(g.key));
  if (!groups.length) return;
  alertsSending = true;
  renderAlertsPanel();
  let sent = 0;
  const done = [];
  for (const g of groups) {
    try {
      const subject = g.type === "stock" ? `🎉 ${g.p.name} رجع تاني — GTECH` : `📉 سعر ${g.p.name} نزل لـ ${egp(g.p.price)} — GTECH`;
      await sendEmail(g.email, g.name, subject, alertEmailHtml(g));
      done.push(...g.ids);
      sent++;
    } catch (err) {
      console.warn("alert email", err);
      alertsFailed.add(g.key);
    }
  }
  try {
    if (done.length) await alertsStore.remove(done);
  } catch (err) {
    console.warn("alerts cleanup", err);
  }
  alertsSending = false;
  if (sent) toast(`🔔 اتبعت ${num(sent)} تنبيه للعملاء`);
  if (sent < groups.length) toast(`⚠️ ${num(groups.length - sent)} تنبيه ماتبعتش — هتلاقيهم في قسم المنتجات`);
  renderAlertsPanel();
}

function renderAlertsPanel() {
  const box = $("#alertsPanel");
  if (!box) return;
  box.hidden = !allAlerts.length;
  if (!allAlerts.length) return;
  const ready = readyGroups();
  const waiting = allAlerts.length;
  const byType = (t) => allAlerts.filter((a) => a.type === t).length;
  box.innerHTML = `
    <div>
      <b>🔔 تنبيهات العملاء</b>
      <p class="muted">${num(waiting)} تنبيه مستني (${num(byType("stock"))} رجوع مخزون · ${num(byType("price"))} نزول سعر).
      ${EMAIL_ON
        ? ready.length
          ? `<b>${num(ready.length)} جاهز للإرسال</b> ${alertsSending ? "— بيتبعت دلوقتي..." : ""}`
          : "أول ما منتج يرجع أو سعره يقل الإيميلات هتتبعت لوحدها."
        : "الإيميلات مقفولة، فعّل EmailJS عشان التنبيهات تتبعت."}</p>
    </div>
    ${EMAIL_ON && ready.length && !alertsSending ? `<button class="btn btn--primary btn--sm" id="sendAlertsBtn">📧 ابعت ${num(ready.length)} تنبيه</button>` : ""}`;
}

document.addEventListener("click", (e) => {
  if (e.target.id === "sendAlertsBtn") sendReadyAlerts(true);
});

let alertsStarted = false;
function startAlerts() {
  if (alertsStarted) return;
  alertsStarted = true;
  watchProducts(); // عشان نعرف المخزون والأسعار لحظة بلحظة
  alertsStore.watch((list) => {
    allAlerts = list;
    renderAlertsPanel();
    sendReadyAlerts();
  }, (err) => console.warn("alerts", err));
}
document.addEventListener("adminproducts", () => { renderAlertsPanel(); sendReadyAlerts(); });
document.addEventListener("dashboardready", startAlerts);
if (!$("#dashboard").hidden) startAlerts();
