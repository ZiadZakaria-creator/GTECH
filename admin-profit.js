// ============ لوحة التحكم: المكسب ============
// الأدمن بيكتب سعر الشراء (التكلفة) لكل منتج، واللوحة بتحسب المكسب في كل أوردر وكل فترة.
// التكلفة في adminData/costs (الأدمن بس) — عمرها ما بتتحفظ في المنتج نفسه لأن المنتجات أي حد يقراها.
// { "<id المنتج>": التكلفة, "_ship": اللي شركة الشحن بتاخده منك على الأوردر (اختياري) }

const PF_LOW = 0.07; // مكسب أقل من 7% ← "مكسب قليل"
const PF_COUNTED = ["confirmed", "shipped", "delivered"]; // الجديد لسه ماتأكدش، والملغي مالوش مكسب
let pfRange = "30";
let pfTab = "all";

const costOf = (id) => Number(privGet("costs")[id]) || 0;
const pfShipCost = () => Number(privGet("costs")._ship) || 0;

// مكسب الأوردر: (المنتجات − الخصم − تكلفتها) + (الشحن اللي العميل دفعه − اللي شركة الشحن بتاخده)
// التكلفة بالسعر المكتوب دلوقتي (مش وقت الأوردر)
function orderProfit(o) {
  const t = o.totals || {};
  let cost = 0;
  const missing = [];
  for (const i of o.items || []) {
    const c = costOf(+i.id);
    if (c) cost += c * i.qty;
    else missing.push(i.name);
  }
  const goods = (t.subtotal || 0) - (t.discount || 0);
  const ship = pfShipCost() ? (t.shipping || 0) - pfShipCost() : 0;
  return { goods, cost, ship, profit: goods - cost + ship, missing, complete: !missing.length };
}

const pfMargin = (price, cost) => (cost && price ? (price - cost) / price : null);
function pfKind(p) {
  const c = costOf(p.id);
  if (!c) return "missing";
  if (p.price < c) return "loss";
  if (pfMargin(p.price, c) < PF_LOW) return "low";
  return "ok";
}
const pfMarginTag = (price, cost) => {
  if (!cost) return "";
  const m = price - cost, pct = Math.round((m / price) * 100);
  const cls = m < 0 ? "pf-tag--loss" : m / price < PF_LOW ? "pf-tag--low" : "pf-tag--ok";
  return `<span class="pf-tag ${cls}">${m < 0 ? "⛔ خسارة" : "مكسب"} ${num(m)} (${num(pct)}%)</span>`;
};

function pfInRange(o) {
  if (pfRange === "all") return true;
  if (pfRange === "month") {
    const d = new Date(o.createdAt), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }
  if (pfRange === "today") return new Date(o.createdAt).toDateString() === new Date().toDateString();
  return Date.now() - new Date(o.createdAt) <= +pfRange * 864e5;
}

function renderProfit() {
  if ($("#profitSection").hidden) return;
  $("#pfNote").innerHTML = privNote();
  $("#pfShip").value = pfShipCost() || "";
  const list = orders.filter((o) => PF_COUNTED.includes(o.status) && pfInRange(o));
  const sum = { goods: 0, cost: 0, ship: 0, profit: 0, partial: 0 };
  const byProduct = new Map();
  for (const o of list) {
    const r = orderProfit(o);
    if (!r.complete) { sum.partial++; continue; } // أوردر فيه منتج من غير تكلفة مابيدخلش في الحساب
    sum.goods += r.goods; sum.cost += r.cost; sum.ship += r.ship; sum.profit += r.profit;
    const share = (o.totals.discount || 0) / Math.max(1, o.totals.subtotal || 1); // الخصم بيتوزع على المنتجات بالنسبة
    for (const i of o.items) {
      const k = +i.id;
      const g = byProduct.get(k) || { name: i.name, qty: 0, profit: 0 };
      g.qty += i.qty;
      g.profit += (i.price * (1 - share) - costOf(k)) * i.qty;
      byProduct.set(k, g);
    }
  }
  const pct = sum.goods ? Math.round((sum.profit / sum.goods) * 100) : 0;
  $("#pfStats").innerHTML = [
    { icon: "💰", label: "المكسب", value: fmt(Math.round(sum.profit)), hint: sum.goods ? `${num(pct)}% من المبيعات` : "لسه مفيش أوردرات محسوبة", accent: sum.profit < 0 ? "warn" : "" },
    { icon: "🧾", label: "مبيعات المنتجات", value: fmt(Math.round(sum.goods)), hint: "من غير الشحن، وبعد الخصم" },
    { icon: "📦", label: "تكلفة البضاعة", value: fmt(Math.round(sum.cost)), hint: `${num(list.length - sum.partial)} أوردر محسوب` },
    sum.partial
      ? { icon: "⚠️", label: "أوردرات مش محسوبة", value: num(sum.partial), hint: "فيها منتجات من غير تكلفة، اكتبها تحت", accent: "warn" }
      : { icon: "🚚", label: "صافي الشحن", value: pfShipCost() ? fmt(Math.round(sum.ship)) : "—", hint: pfShipCost() ? "اللي العملاء دفعوه − اللي شركة الشحن خدته" : "اكتب تكلفة الشحن عليك فوق" },
  ].map((s) => `
    <div class="stat card-box ${s.accent ? "stat--" + s.accent : ""}">
      <span class="stat__icon">${s.icon}</span>
      <div><small>${s.label}</small><b>${s.value}</b><em>${s.hint}</em></div>
    </div>`).join("");

  const top = [...byProduct.values()].sort((a, b) => b.profit - a.profit).slice(0, 5);
  $("#pfTop").innerHTML = top.length
    ? top.map((g) => `<div class="pf-top"><span>${escapeHtml(g.name)}</span><small>${num(g.qty)} قطعة</small><b class="${g.profit < 0 ? "pf-neg" : ""}">${fmt(Math.round(g.profit))}</b></div>`).join("")
    : `<p class="muted">أول ما تكتب تكلفة المنتجات وييجي أوردرات متأكدة، هتلاقي هنا أكتر المنتجات اللي بتكسّبك.</p>`;

  renderProfitList();
}

function renderProfitList() {
  if (!productsLoaded) { $("#pfList").innerHTML = `<p class="muted">بنحمّل المنتجات...</p>`; return; }
  const prods = adminProducts.filter((p) => p.active !== false);
  const cnt = { all: prods.length, missing: 0, loss: 0, low: 0 };
  prods.forEach((p) => { const k = pfKind(p); if (k in cnt) cnt[k]++; });
  $$("#pfTabs [data-pf-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.pfTab === pfTab);
    b.querySelector("b").textContent = num(cnt[b.dataset.pfTab]);
  });
  const words = mkNorm(toLatinDigits($("#pfSearch").value || "")).split(/\s+/).filter(Boolean);
  const shown = prods.filter((p) => (pfTab === "all" || pfKind(p) === pfTab)
    && (!words.length || words.every((w) => mkHay(p).includes(w) || String(p.id) === w)))
    .sort((a, b) => ({ loss: 0, low: 1, missing: 2, ok: 3 }[pfKind(a)] - { loss: 0, low: 1, missing: 2, ok: 3 }[pfKind(b)]) || a.id - b.id);
  $("#pfList").innerHTML = shown.length ? shown.map((p) => {
    const c = costOf(p.id);
    return `
      <div class="pf-row pf-row--${pfKind(p)}" data-pf="${p.id}">
        <div class="mk-name"><b>${escapeHtml(p.name)}</b><small>#${p.id} · المخزون: ${num(p.stock ?? 0)}</small></div>
        <div class="pf-nums">
          <div><small>سعر البيع</small><b>${num(p.price)}</b></div>
          <div><small>سعر الشراء</small><input type="number" inputmode="numeric" min="0" step="1" value="${c || ""}" placeholder="اكتبه" data-pf-cost aria-label="تكلفة ${escapeHtml(p.name)}" /></div>
          ${c ? pfMarginTag(p.price, c) : `<span class="pf-tag">من غير تكلفة</span>`}
        </div>
      </div>`;
  }).join("") : `<p class="muted">مفيش منتجات هنا.</p>`;
}

$("#pfList").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-pf-cost]")) return;
  const id = Number(e.target.closest("[data-pf]").dataset.pf);
  const v = Math.round(Number(toLatinDigits(e.target.value))) || 0;
  const p = adminProducts.find((x) => x.id === id);
  if (v && p && v > p.price * 3) toast(`⚠️ التكلفة ${num(v)} أكبر من سعر البيع بكتير — اتأكد من الرقم`);
  await privPatch("costs", { [id]: v > 0 ? v : null });
  if (v && p && v > p.price) toast(`⛔ "${p.name}" بيتباع بأقل من تكلفته`);
  renderProfit();
});
$("#pfShip").addEventListener("change", async (e) => {
  const v = Math.round(Number(toLatinDigits(e.target.value))) || 0;
  await privPatch("costs", { _ship: v > 0 ? v : null });
  renderProfit();
});
$("#pfRange").addEventListener("change", (e) => { pfRange = e.target.value; renderProfit(); });
$("#pfSearch").addEventListener("input", renderProfitList);
$("#pfTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pf-tab]");
  if (!b) return;
  pfTab = b.dataset.pfTab;
  renderProfitList();
});

document.addEventListener("sectionchange", async (e) => {
  if (e.detail !== "profit") return;
  watchProducts();
  await privLoad("costs");
  renderProfit();
});
["adminorders", "adminproducts", "privchange"].forEach((ev) => document.addEventListener(ev, () => {
  if (!$("#profitSection").hidden) renderProfit();
}));
// التكلفة بتتحمّل مع اللوحة عشان المكسب يبان في تفاصيل الطلب وأسعار السوق
document.addEventListener("dashboardready", () => privLoad("costs"));
if (!$("#dashboard").hidden) privLoad("costs");
