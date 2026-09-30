// ============ لوحة التحكم: الزوار ============
// بيقرا عدّادات visits.js: زوار كل يوم، والمنتجات الأكتر مشاهدة، ونسبة الزوار اللي طلبوا

const VISITS_LOCAL_KEY = "gtech-visits-local";
let visitDays = {};   // { "2026-09-30": { visitors, newVisitors, mobile, desktop } }
let viewDocs = [];    // [{ day, productId, count }]
let visitsRange = 30;

const dayOf = (msAgo) => new Date(Date.now() - msAgo).toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const rangeDays = (n) => Array.from({ length: n }, (_, i) => dayOf((n - 1 - i) * 86400000));

const visitsStore = USE_FIREBASE
  ? {
      stops: [],
      watch(from, onDays, onViews, onError) {
        this.stops.forEach((s) => s());
        this.stops = [];
        loadFirebase(["auth", "firestore"]).then(() => {
          const db = firebase.firestore();
          this.stops.push(db.collection("visits").where(firebase.firestore.FieldPath.documentId(), ">=", from)
            .onSnapshot((snap) => onDays(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))), onError));
          this.stops.push(db.collection("productViews").where("day", ">=", from)
            .onSnapshot((snap) => onViews(snap.docs.map((d) => d.data())), onError));
        }, onError);
      },
    }
  : {
      watch(from, onDays, onViews) {
        const all = store.get(VISITS_LOCAL_KEY, { days: {}, products: {} });
        onDays(all.days);
        onViews(Object.values(all.products));
      },
    };

function pct(part, whole) {
  if (!whole) return "—";
  const v = (part / whole) * 100;
  return `${num(v < 10 ? Number(v.toFixed(1)) : Math.round(v))}٪`;
}

function renderVisits() {
  const days = rangeDays(visitsRange);
  const from = days[0];
  const get = (d, f) => visitDays[d]?.[f] || 0;
  const sum = (f) => days.reduce((s, d) => s + get(d, f), 0);
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const visitors = sum("visitors");
  const mobile = sum("mobile");
  const desktop = sum("desktop");
  const fromMs = new Date(from + "T00:00:00+02:00").getTime();
  const rangeOrders = orders.filter((o) => o.status !== "cancelled" && new Date(o.createdAt).getTime() >= fromMs);

  $("#visitStats").innerHTML = [
    { icon: "👀", label: "زوار النهارده", value: num(get(today, "visitors")), hint: `امبارح ${num(get(yesterday, "visitors"))}` },
    { icon: "📈", label: `زوار آخر ${num(visitsRange)} يوم`, value: num(visitors), hint: `منهم ${num(sum("newVisitors"))} أول مرة يدخلوا` },
    { icon: "📱", label: "من الموبايل", value: pct(mobile, mobile + desktop), hint: `${num(desktop)} من الكمبيوتر` },
    { icon: "🛒", label: "نسبة اللي طلبوا", value: pct(rangeOrders.length, visitors), hint: `${num(rangeOrders.length)} طلب من ${num(visitors)} زائر` },
  ].map((s) => `
    <div class="stat card-box">
      <span class="stat__icon">${s.icon}</span>
      <div><small>${s.label}</small><b>${s.value}</b><em>${s.hint}</em></div>
    </div>`).join("");

  // ============ رسم الزوار في اليوم ============
  const values = days.map((d) => get(d, "visitors"));
  const max = Math.max(...values, 1);
  const top = Math.max(4, Math.ceil(max / 4) * 4); // خطوط الشبكة أرقام صحيحة
  const labelEvery = visitsRange <= 7 ? 1 : visitsRange <= 30 ? 5 : 15;
  const dayLabel = (d, opts) => new Date(d + "T12:00:00").toLocaleDateString("ar-EG", opts);
  $("#visitsChart").innerHTML = `
    <div class="vchart__plot" style="--n:${days.length}">
      <div class="vchart__grid">${[1, .75, .5, .25, 0].map((f) => `<span><i>${num(Math.round(top * f))}</i></span>`).join("")}</div>
      <div class="vchart__bars">
        ${days.map((d, i) => `
          <button type="button" class="vchart__bar ${d === today ? "is-today" : ""}" data-tip="${dayLabel(d, { weekday: "long", day: "numeric", month: "long" })}|${values[i]}" aria-label="${dayLabel(d, { day: "numeric", month: "long" })}: ${num(values[i])} زائر">
            <i style="height:${(values[i] / top) * 100}%"></i>
          </button>`).join("")}
      </div>
    </div>
    <div class="vchart__x" style="--n:${days.length}">
      ${days.map((d, i) => `<span>${(days.length - 1 - i) % labelEvery === 0 ? dayLabel(d, { day: "numeric", month: "short" }) : ""}</span>`).join("")}
    </div>
    <div class="vchart__tip" id="vchartTip" hidden></div>
    ${visitors ? "" : `<p class="vchart__empty muted">لسه مفيش زوار متسجلين في الفترة دي — العدّ بيبدأ من دلوقتي</p>`}`;

  // ============ المنتجات الأكتر مشاهدة ============
  const views = new Map();
  viewDocs.filter((v) => v.day >= from).forEach((v) => views.set(Number(v.productId), (views.get(Number(v.productId)) || 0) + (v.count || 0)));
  const bought = new Map();
  rangeOrders.forEach((o) => o.items.forEach((i) => bought.set(Number(i.id), (bought.get(Number(i.id)) || 0) + 1)));
  const list = alertProducts();
  const rows = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  $("#topViewedEmpty").hidden = rows.length > 0;
  $("#topViewed").innerHTML = rows.map(([id, n]) => {
    const p = list.find((x) => x.id === id);
    const b = bought.get(id) || 0;
    return `
      <tr>
        <td><b>${escapeHtml(p?.name || `منتج #${id}`)}</b></td>
        <td>${num(n)} مشاهدة</td>
        <td>${num(b)} طلب</td>
        <td>${pct(b, n)} اشتروا</td>
      </tr>`;
  }).join("");
}

// تلميح لما تقف على أي عمود
function showTip(bar) {
  const tip = $("#vchartTip");
  if (!bar || !tip) return tip && (tip.hidden = true);
  const [label, value] = bar.dataset.tip.split("|");
  tip.innerHTML = `<small>${label}</small><b>${num(+value)} زائر</b>`;
  tip.hidden = false;
  const box = $("#visitsChart").getBoundingClientRect();
  const r = bar.getBoundingClientRect();
  const x = Math.min(Math.max(r.left + r.width / 2 - box.left, tip.offsetWidth / 2), box.width - tip.offsetWidth / 2);
  const barTop = bar.querySelector("i").getBoundingClientRect().top - box.top;
  tip.style.left = `${x}px`;
  tip.style.top = `${Math.max(tip.offsetHeight, barTop - 8)}px`;
}
$("#visitsChart").addEventListener("pointerover", (e) => showTip(e.target.closest(".vchart__bar")));
$("#visitsChart").addEventListener("pointerleave", () => showTip(null));
$("#visitsChart").addEventListener("focusin", (e) => showTip(e.target.closest(".vchart__bar")));
$("#visitsChart").addEventListener("focusout", () => showTip(null));

function watchVisits() {
  const from = rangeDays(visitsRange)[0];
  visitsStore.watch(from,
    (d) => { visitDays = d; renderVisits(); },
    (v) => { viewDocs = v; renderVisits(); },
    (err) => {
      console.warn("visits", err);
      if (err?.code === "permission-denied") toast("⛔ محتاج تحدّث قواعد الأمان في Firebase عشان عدد الزوار يظهر");
    });
}

$("#visitsRange").addEventListener("change", (e) => {
  visitsRange = +e.target.value;
  renderVisits();
  watchVisits();
});

// بنقرا الأرقام بس لما التاب يتفتح (عشان نوفّر من قراءات Firebase)
let visitsStarted = false;
document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "visits") return;
  if (!visitsStarted) {
    visitsStarted = true;
    watchProducts(); // أسماء المنتجات
    watchVisits();
  }
  renderVisits();
});
document.addEventListener("adminproducts", () => visitsStarted && renderVisits());
