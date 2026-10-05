// ============ لوحة التحكم: نظرة عامة ============
// كل الأرقام هنا محسوبة من الطلبات والمنتجات الحقيقية (مفيش أرقام تقديرية)
let ovDays = store.get("gtech-ov-range", 30);
const OV_LOW = 5; // المخزون القليل
const OV_STATUS_COLORS = { new: "#fbbf24", confirmed: "#3b9bff", shipped: "#a78bfa", delivered: "#22c55e", cancelled: "#ff4d6d" };
const OV_STATUS_HINT = { new: "محتاجة تأكيد", confirmed: "متأكدة · جاهزة للشحن", shipped: "مع شركة الشحن", delivered: "اتسلّمت للعميل", cancelled: "اتلغت" };
const ovIcon = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const OV_ICONS = {
  sales: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  orders: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  avg: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
};

const ovProducts = () => (typeof productsLoaded !== "undefined" && productsLoaded && adminProducts.length ? adminProducts : products);
const ovFind = (id) => ovProducts().find((p) => p.id === id) || products.find((p) => p.id === id);
const ovValid = (o) => o.status !== "cancelled";
const ovSum = (list) => list.reduce((s, o) => s + (o.totals?.total || 0), 0);

// بداية الفترة (من أول اليوم) والفترة اللي قبلها بنفس الطول
function ovPeriod(days = ovDays) {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days);
  return { start: +start, end: Date.now(), prevStart: +prevStart };
}
const ovIn = (o, a, b) => { const t = +new Date(o.createdAt); return t >= a && t < b; };

// تقسيم الفترة: ساعات (النهارده) / أيام / أسابيع (3 شهور)
function ovBuckets() {
  const { start } = ovPeriod();
  const out = [];
  if (ovDays === 1) {
    for (let h = 0; h < 24; h++) out.push({ a: start + h * 3600e3, b: start + (h + 1) * 3600e3, label: `${num(h % 12 || 12)} ${h < 12 ? "ص" : "م"}` });
  } else {
    const step = ovDays > 31 ? 7 : 1;
    for (let d = 0; d < ovDays; d += step) {
      const a = new Date(start); a.setDate(a.getDate() + d);
      const b = new Date(a); b.setDate(b.getDate() + step);
      out.push({ a: +a, b: +b, label: a.toLocaleDateString("ar-EG", { day: "numeric", month: "short" }) });
    }
  }
  return out.map((k) => {
    const list = orders.filter((o) => ovIn(o, k.a, k.b));
    const valid = list.filter(ovValid);
    return { ...k, sales: ovSum(valid), count: valid.length, customers: new Set(valid.map((o) => o.customer.phone)).size };
  });
}

function ovDelta(cur, prev) {
  if (!prev) return cur ? '<span class="ov-delta ov-delta--up">جديد</span>' : '<span class="ov-delta">—</span>';
  const d = Math.round(((cur - prev) / prev) * 1000) / 10;
  const cls = d > 0 ? "up" : d < 0 ? "down" : "";
  return `<span class="ov-delta ${cls ? "ov-delta--" + cls : ""}">${d > 0 ? "▲" : d < 0 ? "▼" : ""} ${num(Math.abs(d))}%</span>`;
}

function ovSpark(values, color) {
  const max = Math.max(...values, 1), n = values.length;
  const pts = values.map((v, i) => `${n > 1 ? (i / (n - 1)) * 100 : 50},${28 - (v / max) * 24}`).join(" ");
  return `<svg class="ov-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// ---------- كروت الأرقام ----------
function ovKpis(buckets) {
  const { start, end, prevStart } = ovPeriod();
  const cur = orders.filter((o) => ovIn(o, start, end + 1));
  const prev = orders.filter((o) => ovIn(o, prevStart, start));
  const cv = cur.filter(ovValid), pv = prev.filter(ovValid);
  const sales = ovSum(cv), pSales = ovSum(pv);
  const avg = cv.length ? Math.round(sales / cv.length) : 0, pAvg = pv.length ? Math.round(pSales / pv.length) : 0;
  const custs = new Set(cv.map((o) => o.customer.phone)), pCusts = new Set(pv.map((o) => o.customer.phone));
  const before = new Set(orders.filter((o) => +new Date(o.createdAt) < start && ovValid(o)).map((o) => o.customer.phone));
  const fresh = [...custs].filter((p) => !before.has(p)).length;
  const cancelled = cur.length - cv.length;
  const cards = [
    { k: "sales", label: "إجمالي المبيعات", value: fmt(sales), delta: ovDelta(sales, pSales), hint: "مقارنة بالفترة اللي قبلها", color: "#3b9bff", spark: buckets.map((b) => b.sales) },
    { k: "orders", label: "عدد الطلبات", value: num(cv.length), delta: ovDelta(cv.length, pv.length), hint: cancelled ? `${num(cancelled)} ملغي مش محسوب` : "من غير الملغي", color: "#a78bfa", spark: buckets.map((b) => b.count) },
    { k: "avg", label: "متوسط قيمة الطلب", value: fmt(avg), delta: ovDelta(avg, pAvg), hint: "مقارنة بالفترة اللي قبلها", color: "#22c55e", spark: buckets.map((b) => (b.count ? b.sales / b.count : 0)) },
    { k: "customers", label: "العملاء", value: num(custs.size), delta: ovDelta(custs.size, pCusts.size), hint: `${num(fresh)} عميل جديد`, color: "#ff9f0a", spark: buckets.map((b) => b.customers) },
  ];
  $("#ovKpis").innerHTML = cards.map((c) => `
    <article class="card-box ov-kpi" style="--kc:${c.color}">
      <div class="ov-kpi__top"><span class="ov-kpi__icon">${ovIcon(OV_ICONS[c.k])}</span><small>${c.label}</small>${ovSpark(c.spark, c.color)}</div>
      <b class="ov-kpi__val">${c.value}</b>
      <div class="ov-kpi__foot">${c.delta}<span class="muted">${c.hint}</span></div>
    </article>`).join("");
}

// ---------- رسم المبيعات ----------
function ovSmooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${Math.min(100, c1[1])} ${c2[0]},${Math.min(100, c2[1])} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const ovNice = (v) => { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1); };

function ovChart(buckets) {
  const W = 100, H = 100, n = buckets.length;
  const maxS = ovNice(Math.max(...buckets.map((b) => b.sales))), maxC = Math.max(2, ...buckets.map((b) => b.count)) * 1.25;
  const x = (i) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  // في العربي الرسم بيمشي من اليمين للشمال (الأقدم يمين)
  const xr = (i) => W - x(i);
  const ps = buckets.map((b, i) => [xr(i), H - (b.sales / maxS) * 92 - 2]);
  const pc = buckets.map((b, i) => [xr(i), H - (b.count / maxC) * 92 - 2]);
  const line = ovSmooth(ps), lineC = ovSmooth(pc);
  const area = line ? `${line} L${ps[n - 1][0]},${H} L${ps[0][0]},${H} Z` : "";
  const ticks = [0, .25, .5, .75, 1];
  const every = Math.ceil(n / (innerWidth < 700 ? 4 : 7));
  $("#ovChartSub").textContent = ovDays === 1 ? "النهارده بالساعة" : ovDays > 31 ? "كل أسبوع في آخر 3 شهور" : `كل يوم في آخر ${num(ovDays)} يوم`;
  $("#ovPlot").innerHTML = `
    <div class="ov-y">${ticks.map((t) => `<span style="bottom:${t * 92 + 2}%">${num(Math.round(maxS * t / (maxS >= 10000 ? 1000 : 1)))}${maxS >= 10000 && t ? "k" : ""}</span>`).join("")}</div>
    <div class="ov-canvas">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="ovFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b9bff" stop-opacity=".38"/><stop offset="1" stop-color="#3b9bff" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((t) => `<line x1="0" x2="100" y1="${H - t * 92 - 2}" y2="${H - t * 92 - 2}" class="ov-grid"/>`).join("")}
        <path d="${area}" fill="url(#ovFill)"/>
        <path d="${lineC}" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>
        <path d="${line}" fill="none" stroke="#3b9bff" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      </svg>
      <i class="ov-guide" id="ovGuide" hidden></i><i class="ov-dot" id="ovDot" hidden></i>
      <div class="ov-tip" id="ovTip" hidden></div>
      <div class="ov-hits">${buckets.map((_, i) => `<span data-i="${i}"></span>`).join("")}</div>
    </div>
    <div class="ov-x">${buckets.map((b, i) => `<span style="right:${100 - xr(i)}%">${i % every === 0 || i === n - 1 ? b.label : ""}</span>`).join("")}</div>`;
  const canvas = $("#ovPlot .ov-canvas");
  const show = (i) => {
    const b = buckets[i], left = xr(i), top = ps[i][1];
    $("#ovGuide").hidden = $("#ovDot").hidden = $("#ovTip").hidden = false;
    $("#ovGuide").style.left = left + "%";
    Object.assign($("#ovDot").style, { left: left + "%", top: top + "%" });
    $("#ovTip").innerHTML = `<small>${b.label}</small><b>${fmt(b.sales)}</b><span>${num(b.count)} طلب</span>`;
    const tip = $("#ovTip"); tip.style.left = Math.min(Math.max(left, 14), 86) + "%"; tip.style.top = Math.max(top - 4, 8) + "%";
  };
  canvas.querySelector(".ov-hits").addEventListener("pointerover", (e) => { const s = e.target.closest("[data-i]"); if (s) show(+s.dataset.i); });
  canvas.addEventListener("pointerleave", () => { $("#ovGuide").hidden = $("#ovDot").hidden = $("#ovTip").hidden = true; });
}

// ---------- حالة الطلبات + الدفع ----------
function ovStatus() {
  const { start } = ovPeriod();
  const cur = orders.filter((o) => +new Date(o.createdAt) >= start);
  const total = cur.length || 0;
  const by = (s) => cur.filter((o) => o.status === s).length;
  const done = by("delivered");
  const valid = cur.filter(ovValid);
  const paid = valid.filter((o) => o.payment?.status === "paid").length;
  const pending = valid.filter((o) => o.payment?.status === "pending").length;
  const cod = valid.length - paid - pending;
  const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
  $("#ovStatus").innerHTML = `
    <div class="ov-card__head"><div><h3>حالة الطلبات</h3><p class="muted">توزيع طلبات الفترة دي</p></div></div>
    <div class="ov-st">
      <div class="ov-st__big"><b>${num(total)}</b><small>إجمالي الطلبات</small><span class="ov-st__ok">${num(pct(done, total))}% اتسلّمت</span></div>
      <ul class="ov-st__list">${STATUS_ORDER.map((s) => `
        <li style="--sc:${OV_STATUS_COLORS[s]}"><span class="ov-st__name"><i></i>${ORDER_STATUSES[s]}</span><b>${num(by(s))}</b><em><u style="width:${pct(by(s), total)}%"></u></em></li>`).join("")}
      </ul>
    </div>
    <div class="ov-pay">
      <div class="ov-pay__head"><b>حالة الدفع</b><span class="ov-chip ov-chip--ok">${num(pct(paid + cod, valid.length))}% مضمون</span></div>
      <div class="ov-pay__bar">${[[paid, "#22c55e"], [cod, "#3b9bff"], [pending, "#fbbf24"]].map(([v, c]) => v ? `<i style="flex:${v};background:${c}"></i>` : "").join("") || '<i style="flex:1"></i>'}</div>
      <div class="ov-pay__lg"><span style="--c:#22c55e">اتدفع ${num(paid)}</span><span style="--c:#3b9bff">عند الاستلام ${num(cod)}</span><span style="--c:#fbbf24">مستني التحويل ${num(pending)}</span></div>
    </div>`;
}

// ---------- أحدث الطلبات ----------
function ovRecent() {
  const list = orders.slice(0, 6);
  const pending = orders.filter((o) => o.status === "new").length;
  $("#ovPendingChip").hidden = !pending;
  $("#ovPendingChip").textContent = `${num(pending)} محتاج تأكيد`;
  $("#ovRecentEmpty").hidden = list.length > 0;
  const payPill = (o) => o.payment?.status === "paid" ? '<span class="ov-pp ov-pp--ok">اتدفع</span>'
    : o.payment?.status === "pending" ? '<span class="ov-pp ov-pp--wait">مستني التحويل</span>'
    : `<span class="ov-pp">${escapeHtml(o.payment?.label || "عند الاستلام")}</span>`;
  $("#ovRecent").innerHTML = list.map((o) => {
    const first = o.items[0];
    const more = o.items.length - 1;
    const initials = escapeHtml((o.customer.name || "؟").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(" "));
    return `<tr data-id="${escapeHtml(o.id)}" class="${o.status === "new" ? "is-new" : ""}">
      <td data-label="رقم الطلب"><b class="mono ov-id">${escapeHtml(o.id)}</b><small>${shortDate(o.createdAt)}</small></td>
      <td data-label="العميل"><span class="ov-cust"><i>${initials}</i><span><b>${escapeHtml(o.customer.name)}</b><small>${escapeHtml(o.address?.gov || "")}</small></span></span></td>
      <td data-label="المنتجات"><span class="ov-prod">${escapeHtml(first?.name || "")}</span><small>${more > 0 ? `+ ${num(more)} منتج تاني` : `${num(first?.qty || 1)} قطعة`}</small></td>
      <td data-label="الإجمالي"><b>${fmt(o.totals.total)}</b></td>
      <td data-label="الدفع">${payPill(o)}</td>
      <td data-label="الحالة">${statusPill(o.status)}</td>
    </tr>`;
  }).join("");
}

// ---------- المخزون + الأكثر مبيعاً + الشحن ----------
function ovStock() {
  const low = ovProducts().filter((p) => p.active !== false && (p.stock ?? 99) <= OV_LOW).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  const badge = $("#lowStockBadge");
  badge.hidden = !low.length; badge.textContent = num(low.length);
  $("#ovStock").innerHTML = `
    <div class="ov-card__head"><div><h3>تنبيهات المخزون</h3><p class="muted">${low.length ? `${num(low.length)} منتج محتاج تزوّد كميته` : "كل المنتجات كميتها كويسة"}</p></div><span class="ov-head-ic">⚠️</span></div>
    <ul class="ov-list">${low.slice(0, 5).map((p) => `
      <li><span class="ov-thumb">${productVisual(p)}</span><span class="ov-list__txt"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(categories[p.cat] || "")}</small></span>
        <span class="ov-stock ${(p.stock ?? 0) === 0 ? "is-out" : ""}"><b>${num(p.stock ?? 0)}</b><small>${(p.stock ?? 0) === 0 ? "نفد" : "متبقي"}</small></span></li>`).join("") || '<li class="ov-empty">✅ مفيش منتجات قربت تخلص</li>'}
    </ul>
    <div class="ov-card__foot"><small class="muted">التنبيه لما الكمية ${num(OV_LOW)} أو أقل</small><button class="btn btn--ghost btn--sm" data-go="products" data-low="1">📦 تحديث المخزون</button></div>`;
}

function ovBest() {
  const { start } = ovPeriod();
  const agg = {};
  orders.filter((o) => ovValid(o) && +new Date(o.createdAt) >= start).forEach((o) => o.items.forEach((it) => {
    const a = (agg[it.id] ||= { id: it.id, name: it.name, qty: 0, rev: 0 });
    a.qty += it.qty; a.rev += (it.price || 0) * it.qty;
  }));
  const list = Object.values(agg).sort((a, b) => b.rev - a.rev);
  const total = list.reduce((s, a) => s + a.rev, 0);
  const max = list[0]?.rev || 1;
  const top3 = list.slice(0, 3).reduce((s, a) => s + a.rev, 0);
  $("#ovBest").innerHTML = `
    <div class="ov-card__head"><div><h3>الأكثر مبيعاً</h3><p class="muted">حسب قيمة المبيعات في الفترة دي</p></div><button class="btn btn--ghost btn--sm" data-go="products">المنتجات ←</button></div>
    <ul class="ov-list">${list.slice(0, 4).map((a) => { const p = ovFind(a.id); return `
      <li><span class="ov-thumb">${p ? productVisual(p) : "📦"}</span><span class="ov-list__txt"><b>${escapeHtml(a.name)}</b><small>${num(a.qty)} قطعة · ${fmt(a.rev)}</small><em class="ov-bar"><u style="width:${(a.rev / max) * 100}%"></u></em></span></li>`; }).join("") || '<li class="ov-empty">لسه مفيش مبيعات في الفترة دي</li>'}
    </ul>
    ${total ? `<div class="ov-note">📈 أعلى ${num(Math.min(3, list.length))} منتجات = ${num(Math.round((top3 / total) * 100))}% من المبيعات</div>` : ""}`;
}

function ovShip() {
  const { start } = ovPeriod();
  const by = (s, list = orders) => list.filter((o) => o.status === s).length;
  const cur = orders.filter((o) => +new Date(o.createdAt) >= start);
  const closed = by("delivered", cur) + by("cancelled", cur);
  const rate = closed ? Math.round((by("delivered", cur) / closed) * 1000) / 10 : 0;
  $("#ovShip").innerHTML = `
    <div class="ov-card__head"><div><h3>الشحن والتوصيل</h3><p class="muted">الطلبات اللي لسه شغالين عليها</p></div></div>
    <div class="ov-ship">
      <button class="ov-ship__box" data-go="orders" data-status="new"><span>🆕</span><b>${num(by("new"))}</b><small>محتاجة تأكيد</small></button>
      <button class="ov-ship__box" data-go="orders" data-status="confirmed"><span>📦</span><b>${num(by("confirmed"))}</b><small>جاهزة للشحن</small></button>
      <button class="ov-ship__box" data-go="orders" data-status="shipped"><span>🚚</span><b>${num(by("shipped"))}</b><small>في الطريق</small></button>
    </div>
    <div class="ov-rate"><span>نسبة التسليم في الفترة دي</span><b>${closed ? num(rate) + "%" : "—"}</b></div>
    <em class="ov-bar ov-bar--ok"><u style="width:${rate}%"></u></em>
    <p class="muted ov-rate__sub">${closed ? `${num(by("delivered", cur))} اتسلّم · ${num(by("cancelled", cur))} اتلغى` : "لسه مفيش طلبات اتقفلت في الفترة دي"}</p>
    <div class="ov-card__foot"><button class="btn btn--primary btn--sm" data-go="orders" data-status="new">مراجعة الطلبات الجديدة</button><button class="btn btn--ghost btn--sm" data-go="shipping">إعدادات الشحن</button></div>`;
}

function ovHead() {
  const { start } = ovPeriod();
  const h = new Date().getHours();
  const name = $("#adUserName")?.textContent;
  $("#ovHello").textContent = `${h < 12 ? "صباح الخير" : "مساء الخير"}${name ? " يا " + name : ""} 👋 ده ملخص أداء متجرك وأهم الحاجات اللي محتاجة انتباهك.`;
  const f = (d) => new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  $("#ovDates").textContent = ovDays === 1 ? `📅 النهارده ${f(Date.now())}` : `📅 ${f(start)} – ${f(Date.now())}`;
  $$("#ovRange [data-r]").forEach((b) => b.classList.toggle("active", +b.dataset.r === ovDays));
}

function renderOverview() {
  if ($("#overviewSection").hidden) { ovStock(); return; } // بادج المخزون في القائمة بيتحدث برضه
  const buckets = ovBuckets();
  ovHead(); ovKpis(buckets); ovChart(buckets); ovStatus(); ovRecent(); ovStock(); ovBest(); ovShip();
}

// ---------- الأحداث ----------
$("#ovRange").addEventListener("click", (e) => {
  const b = e.target.closest("[data-r]");
  if (!b) return;
  ovDays = +b.dataset.r; store.set("gtech-ov-range", ovDays);
  renderOverview();
});
$("#overviewSection").addEventListener("click", (e) => {
  const row = e.target.closest("#ovRecent tr[data-id]");
  if (row) return openOrder(row.dataset.id);
  const go = e.target.closest("[data-go]");
  if (!go) return;
  if (go.dataset.status) { statusFilter = go.dataset.status; render(); }
  showSection(go.dataset.go);
  if (go.dataset.low) { $("#prodState").value = "low"; $("#prodState").dispatchEvent(new Event("change")); }
});
$("#ovExport").addEventListener("click", () => {
  const { start } = ovPeriod();
  const list = orders.filter((o) => +new Date(o.createdAt) >= start);
  const rows = [["رقم الطلب", "التاريخ", "العميل", "الموبايل", "المحافظة", "المنتجات", "الإجمالي", "الدفع", "الحالة"],
    ...list.map((o) => [o.id, new Date(o.createdAt).toLocaleString("en-GB"), o.customer.name, o.customer.phone, o.address?.gov || "",
      o.items.map((i) => `${i.name} × ${i.qty}`).join(" | "), o.totals.total, o.payment?.label || "", ORDER_STATUSES[o.status]])];
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `GTECH-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`⬇ اتنزّل تقرير ${num(list.length)} طلب`);
});

document.addEventListener("adminorders", renderOverview);
document.addEventListener("adminproducts", renderOverview);
document.addEventListener("productschange", renderOverview);
document.addEventListener("catalogloaded", renderOverview);
document.addEventListener("sectionchange", (e) => { if (e.detail === "overview") renderOverview(); });
document.addEventListener("dashboardready", () => { watchProducts(); renderOverview(); });
let ovResize; addEventListener("resize", () => { clearTimeout(ovResize); ovResize = setTimeout(() => { if (!$("#overviewSection").hidden) ovChart(ovBuckets()); }, 200); });
// الوضع التجريبي: اللوحة بتفتح قبل ما الملف ده يتحمّل
if (!$("#dashboard").hidden) { watchProducts(); renderOverview(); }
