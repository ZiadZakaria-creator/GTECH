// ============ لوحة التحكم: السلات المتروكة ============
// السلات بتتحفظ من المتجر (common.js ← syncCart) للعملاء اللي داخلين بإيميل.
// مفيش سيرفر يبعت لوحده، فالتذكير بيتبعت من هنا بزرار (كل تذكير = إيميل من رصيد EmailJS)

const ABANDON_AFTER = 2 * 3600e3; // السلة تعتبر متروكة بعد ساعتين من آخر تعديل
const CARTS_LOCAL_KEY = "gtech-carts-local";

const cartsStore = USE_FIREBASE
  ? {
      watch(onData, onError) {
        let stop = () => {};
        loadFirebase(["auth", "firestore"]).then(() => {
          stop = firebase.firestore().collection("carts").onSnapshot(
            (snap) => onData(snap.docs.map((d) => ({ ...d.data(), uid: d.id }))), onError);
        }, onError);
        return () => stop();
      },
      async markReminded(uid, at) {
        await firebase.firestore().collection("carts").doc(uid).update({ remindedAt: at });
      },
    }
  : {
      watch(onData) {
        const emit = () => onData(Object.values(store.get(CARTS_LOCAL_KEY, {})));
        addEventListener("storage", (e) => e.key === CARTS_LOCAL_KEY && emit());
        document.addEventListener("localcarts", emit);
        emit();
      },
      async markReminded(uid, at) {
        const all = store.get(CARTS_LOCAL_KEY, {});
        if (all[uid]) all[uid].remindedAt = at;
        store.set(CARTS_LOCAL_KEY, all);
        document.dispatchEvent(new Event("localcarts"));
      },
    };

let allCarts = [];
const cartsSending = new Set();

const isAbandoned = (c) => Date.now() - new Date(c.updatedAt).getTime() >= ABANDON_AFTER;
// اتبعتله تذكير بعد آخر تعديل في السلة؟
const isReminded = (c) => c.remindedAt && c.remindedAt >= c.updatedAt;
const needsReminder = (c) => isAbandoned(c) && !isReminded(c);

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "دلوقتي";
  if (mins < 60) return `من ${num(mins)} دقيقة`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `من ${num(hrs)} ساعة`;
  return `من ${num(Math.round(hrs / 24))} يوم`;
}

function cartLink(c) {
  return siteUrl(`checkout.html?cart=${c.items.map((i) => [i.id, i.qty, i.opts].filter((x) => x !== "").map((x) => encodeURIComponent(x).replace(/,/g, "%2C")).join(".")).join(",")}`);
}

function cartEmailHtml(c) {
  const e = escapeHtml;
  const rows = c.items.map((i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6">${e(i.name)}${i.opts ? `<br><span style="color:#8a94a6;font-size:12px">${e(i.opts)}</span>` : ""}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;color:#6b7589;white-space:nowrap" align="center">${i.qty} ×</td>
      <td style="padding:10px 0;border-bottom:1px solid #eef1f6;white-space:nowrap" align="left">${egp(i.price * i.qty)}</td>
    </tr>`).join("");
  return `
<div dir="rtl" style="margin:0;padding:24px 12px;background:#f2f5fa;font-family:Tahoma,Arial,sans-serif;color:#1d2433">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#00d4ff,#0a84ff 50%,#7c5cff);background-color:#0a84ff;padding:22px 24px;color:#fff">
      <div style="font-size:22px;font-weight:900;letter-spacing:1px;direction:ltr;text-align:right">GTECH</div>
    </td></tr>
    <tr><td style="padding:26px 24px 8px">
      <div style="font-size:36px;line-height:1">🛒</div>
      <h1 style="margin:10px 0 6px;font-size:22px">نسيت حاجة في السلة؟</h1>
      <p style="margin:0;color:#4b5568;line-height:1.8">أهلاً${c.name ? " " + e(c.name) : ""}، لاحظنا إنك سبت منتجات في سلتك من غير ما تكمّل الطلب. حجزنالك السلة زي ما هي، كمّل طلبك في دقيقة قبل ما الكمية تخلص.</p>
    </td></tr>
    <tr><td style="padding:10px 24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
        <tr><td style="padding:12px 0 0;font-weight:900;font-size:16px">الإجمالي</td><td></td><td align="left" style="padding:12px 0 0;font-weight:900;font-size:16px">${egp(c.total)}</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:18px 24px 26px">
      <a href="${cartLink(c)}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#0a84ff;color:#fff;text-decoration:none;font-weight:700">كمّل طلبك</a>
      <p style="margin:12px 0 0;color:#8a94a6;font-size:12px">عندك سؤال عن أي منتج؟ رد على الإيميل ده أو كلمنا واتساب ${WHATSAPP.replace(/^20/, "0")}</p>
    </td></tr>
    <tr><td align="center" style="padding:14px;background:#f5f8fd;color:#8a94a6;font-size:12px">GTECH</td></tr>
  </table>
</div>`;
}

async function remindCart(c) {
  if (cartsSending.has(c.uid)) return false;
  cartsSending.add(c.uid);
  renderCarts();
  try {
    await sendEmail(c.email, c.name, "🛒 سلتك لسه مستنياك — GTECH", cartEmailHtml(c));
    await cartsStore.markReminded(c.uid, new Date().toISOString()).catch((err) => console.warn("mark reminded", err));
    return true;
  } catch (err) {
    console.warn("cart reminder", err);
    return false;
  } finally {
    cartsSending.delete(c.uid);
    renderCarts();
  }
}

function renderCarts() {
  const list = [...allCarts].filter((c) => c.items?.length).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pending = list.filter(needsReminder);
  const badge = $("#cartsBadge");
  badge.hidden = !pending.length;
  badge.textContent = num(pending.length);

  const all = $("#remindAllBtn");
  all.hidden = !EMAIL_ON || pending.length < 2;
  all.textContent = `📧 ابعت تذكير للكل (${num(pending.length)})`;

  $("#cartsEmpty").hidden = !!list.length;
  $("#cartsBody").innerHTML = list.map((c) => {
    const abandoned = isAbandoned(c);
    const sending = cartsSending.has(c.uid);
    const action = !abandoned
      ? `<span class="pill pill--idle">لسه بيتسوق</span>`
      : isReminded(c)
        ? `<span class="pill pill--done">✔ اتبعت ${timeAgo(c.remindedAt)}</span>`
        : EMAIL_ON
          ? `<button class="btn btn--ghost btn--sm" data-remind="${escapeHtml(c.uid)}" ${sending ? "disabled" : ""}>${sending ? "بيتبعت..." : "📧 ابعت تذكير"}</button>`
          : `<span class="pill pill--idle">الإيميلات مقفولة</span>`;
    return `
      <tr class="${abandoned ? "" : "is-fresh"}">
        <td><b>${escapeHtml(c.name || "—")}</b><br><small class="muted" dir="ltr">${escapeHtml(c.email)}</small></td>
        <td class="carts-items">${c.items.map((i) => `${escapeHtml(i.name)} <small class="muted">× ${num(i.qty)}</small>`).join("<br>")}</td>
        <td><b>${fmt(c.total)}</b></td>
        <td>${timeAgo(c.updatedAt)}</td>
        <td>${action}</td>
      </tr>`;
  }).join("");
}

$("#cartsBody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-remind]");
  if (!b) return;
  const c = allCarts.find((x) => x.uid === b.dataset.remind);
  if (c) toast((await remindCart(c)) ? `📧 اتبعت تذكير لـ ${c.name || c.email}` : "❌ التذكير ماتبعتش، جرّب تاني");
});

$("#remindAllBtn").addEventListener("click", async () => {
  const pending = allCarts.filter((c) => c.items?.length && needsReminder(c));
  if (!pending.length || !confirm(`هيتبعت ${pending.length} إيميل تذكير. متأكد؟`)) return;
  let sent = 0;
  for (const c of pending) if (await remindCart(c)) sent++;
  toast(`📧 اتبعت ${num(sent)} من ${num(pending.length)} تذكير`);
});

let cartsStarted = false;
function startCarts() {
  if (cartsStarted) return;
  cartsStarted = true;
  cartsStore.watch((list) => { allCarts = list; renderCarts(); }, (err) => {
    console.warn("carts", err);
    if (err?.code === "permission-denied") $("#cartsEmpty").querySelector("p").textContent = "⛔ محتاج تحدّث قواعد الأمان في Firebase عشان السلات تظهر";
    $("#cartsEmpty").hidden = false;
  });
  setInterval(renderCarts, 60000); // عشان "من كام دقيقة" والسلات اللي بقت متروكة تتحدث
}
document.addEventListener("dashboardready", startCarts);
if (!$("#dashboard").hidden) startCarts();
