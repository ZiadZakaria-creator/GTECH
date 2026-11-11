// ============ لوحة التحكم: متابعات واتساب ============
// 1) "مستنيين منتج يرجع": العملاء اللي سابوا رقم واتساب في "نبّهني" (leads بـ page = stock:<id> أو price:<id>:<السعر>).
//    أول ما المنتج يرجع (أو سعره يقل) بيظهروا هنا برسالة جاهزة.
// 2) "اسألهم عن المنتج": الأوردرات اللي اتسلمت من 3 أيام أو أكتر ولسه ماسألناش العميل عن رأيه.
// مفيش حاجة بتتبعت لوحدها: كل رسالة بتتبعت من رقمك بضغطة، واللي اتبعت بيتسجل في adminData/followups.

const FU_RATE_AFTER = 3;  // أيام بعد التسليم
const FU_RATE_UNTIL = 45; // بعد كده خلاص متأخر
const fuDone = (key) => !!privGet("followups")[key];
const fuDays = (iso) => Math.floor((Date.now() - new Date(iso)) / 864e5);

function fuAlertLeads() {
  const list = typeof allLeads !== "undefined" ? allLeads : [];
  return list.map((l) => {
    const m = String(l.page || "").match(/^(stock|price):(\d+)(?::(\d+))?/);
    if (!m) return null;
    const p = adminProducts.find((x) => x.id === +m[2]);
    const type = m[1], was = +m[3] || 0;
    const ready = !!p && p.active !== false && inStock(p) && (type === "stock" || (was && p.price < was));
    return { l, type, was, p, pid: +m[2], ready, key: "alert:" + l.id };
  }).filter(Boolean);
}

function fuRateOrders() {
  return orders.filter((o) => o.status === "delivered")
    .map((o) => ({ o, days: fuDays(o.updatedAt || o.createdAt), key: "rate:" + o.id }))
    .filter((r) => r.days <= FU_RATE_UNTIL && !fuDone(r.key));
}

function fuAlertMsg(a) {
  const p = a.p;
  const lines = a.type === "stock"
    ? [`أهلاً 👋 معاك GTECH MASR`, ``, `${p.name} اللي سبت رقمك عشان نبلّغك لما يرجع، رجع تاني ✅`, `💰 السعر: ${p.price.toLocaleString("en-US")} ج.م`]
    : [`أهلاً 👋 معاك GTECH MASR`, ``, `سعر ${p.name} اللي كنت متابعه نزل 📉`, `كان ${a.was.toLocaleString("en-US")} ج.م ← بقى ${p.price.toLocaleString("en-US")} ج.م`];
  return [...lines, ``, `تقدر تطلبه من هنا 👇`, siteUrl(`product.html?id=${p.id}`), ``, `التوصيل في القاهرة والجيزة، والدفع عند الاستلام 🙏`].join("\n");
}

function fuCount() {
  if (!productsLoaded) return 0;
  return fuAlertLeads().filter((a) => a.ready && !fuDone(a.key)).length
    + fuRateOrders().filter((r) => r.days >= FU_RATE_AFTER).length;
}

function renderFollowups() {
  const n = fuCount();
  $("#followBadge").hidden = !n;
  $("#followBadge").textContent = num(n);
  if ($("#followupsSection").hidden) return;
  $("#fuNote").innerHTML = privNote();

  // 1) مستنيين منتج
  const alerts = productsLoaded ? fuAlertLeads() : [];
  const ready = alerts.filter((a) => a.ready && !fuDone(a.key));
  const waiting = alerts.filter((a) => !a.ready && !fuDone(a.key));
  const byProduct = new Map();
  waiting.forEach((a) => {
    const g = byProduct.get(a.pid) || { p: a.p, pid: a.pid, n: 0, stock: 0, price: 0 };
    g.n++;
    if (a.type === "stock") g.stock++; else g.price++;
    byProduct.set(a.pid, g);
  });
  $("#fuAlerts").innerHTML = !productsLoaded ? `<p class="muted">بنحمّل...</p>` : `
    ${ready.length ? ready.map((a) => `
      <div class="fu-row" data-fu="${escapeHtml(a.key)}">
        <div><b class="mono" dir="ltr">${escapeHtml(a.l.phone)}</b>
          <small>${a.type === "stock" ? `🔔 مستني ${escapeHtml(a.p.name)} يرجع` : `📉 مستني سعر ${escapeHtml(a.p.name)} ينزل عن ${num(a.was)} (بقى ${num(a.p.price)})`} · ساب رقمه ${agoTxt(a.l.createdAt)}</small></div>
        <div class="fu-btns">
          <a class="btn btn--wa btn--sm" href="${waLink(fuAlertMsg(a), "2" + a.l.phone)}" target="_blank" rel="noopener" data-fu-send>💬 ابعتله إنه ${a.type === "stock" ? "رجع" : "نزل"}</a>
          <button type="button" class="btn btn--ghost btn--sm" data-fu-skip>تخطّي</button>
        </div>
      </div>`).join("") : `<p class="muted">✅ مفيش حد مستني منتج رجع دلوقتي.</p>`}
    ${byProduct.size ? `<p class="fu-sub">لسه مستنيين (المنتج خلصان أو سعره مانزلش):</p>
      <div class="fu-wait">${[...byProduct.values()].sort((a, b) => b.n - a.n).map((g) => `
        <span class="fu-chip" title="${g.stock ? num(g.stock) + " مستني يرجع" : ""}${g.stock && g.price ? " · " : ""}${g.price ? num(g.price) + " مستني السعر يقل" : ""}">
          ${escapeHtml(g.p?.name || "منتج #" + g.pid)} <b>${num(g.n)}</b></span>`).join("")}</div>
      <small class="muted">الرقم = عدد العملاء اللي مستنيين المنتج ده، فده مؤشر إن عليه طلب لما تجيب منه تاني.</small>` : ""}`;

  // 2) اسألهم عن المنتج
  const rates = fuRateOrders().sort((a, b) => b.days - a.days);
  const due = rates.filter((r) => r.days >= FU_RATE_AFTER);
  const soon = rates.length - due.length;
  $("#fuRates").innerHTML = (due.length ? due.map((r) => `
      <div class="fu-row" data-fu="${escapeHtml(r.key)}">
        <div><b>${escapeHtml(r.o.customer.name)}</b> <small class="mono" dir="ltr">${escapeHtml(r.o.customer.phone)}</small>
          <small>${escapeHtml(r.o.items.map((i) => i.name).join("، ").slice(0, 80))} · اتسلّم من ${num(r.days)} ${r.days === 1 ? "يوم" : r.days <= 10 ? "أيام" : "يوم"}</small></div>
        <div class="fu-btns">
          <a class="btn btn--wa btn--sm" href="${waLink(rateMessage(r.o), "2" + r.o.customer.phone)}" target="_blank" rel="noopener" data-fu-send>⭐ اسأله عن رأيه</a>
          <button type="button" class="btn btn--ghost btn--sm" data-fu-skip>تخطّي</button>
        </div>
      </div>`).join("") : `<p class="muted">✅ مفيش حد محتاج متابعة دلوقتي.</p>`)
    + (soon ? `<p class="fu-sub">${soon === 1 ? `أوردر واحد اتسلّم من أقل من ${num(FU_RATE_AFTER)} أيام، وهيظهر هنا لما يكمّلهم.` : `${num(soon)} أوردرات اتسلمت من أقل من ${num(FU_RATE_AFTER)} أيام، وهيظهروا هنا لما يكمّلوهم.`}</p>` : "");
}

document.addEventListener("click", (e) => {
  const row = e.target.closest("#followupsSection [data-fu]");
  if (!row) return;
  const key = row.dataset.fu;
  if (e.target.closest("[data-fu-send]")) {
    // اللينك بيفتح واتساب عادي، وبعدها بنسجّل إنها اتبعتت
    setTimeout(() => privPatch("followups", { [key]: new Date().toISOString() }), 400);
    return;
  }
  if (e.target.closest("[data-fu-skip]")) privPatch("followups", { [key]: "skip:" + new Date().toISOString() });
});

document.addEventListener("sectionchange", async (e) => {
  if (e.detail !== "followups") return;
  watchProducts();
  renderFollowups();
  await privLoad("followups");
  renderFollowups();
});
["adminorders", "adminproducts", "privchange", "adminleads"].forEach((ev) => document.addEventListener(ev, renderFollowups));
document.addEventListener("dashboardready", () => privLoad("followups"));
if (!$("#dashboard").hidden) privLoad("followups");
