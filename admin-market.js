// ============ لوحة التحكم: أسعار السوق ============
// بيقرا market-prices.json (ملف ثابت في الموقع، مش Firestore) وبيقترح سعر لكل منتج على أساس أرخص منافس موثوق.
// مفيش حاجة بتتغير لوحدها: الأدمن بيراجع ويختار ويدوس "طبّق".
const MK_FLOOR_KEY = "gtech-market-floor"; // أقل سعر يقبله لكل منتج (على الجهاز ده بس، عشان التكلفة ماتبقاش في ملف عام)
const MK_TRUST_KEY = "gtech-market-trust"; // المنافسين اللي الاقتراح بيتحسب عليهم (الأدمن بيختارهم)
const MK_KEEP_PCT = 0.02; // الفرق أقل من 2% ← سيبه زي ما هو
let mkData = null;
let mkRows = []; // { p, ref, sugg, floor, on, newPrice, clearOld }

// أقرب سعر ينتهي بـ 49 أو 99 تحت الرقم (4,454 ← 4,449)
const mkRound = (v) => Math.max(49, Math.floor((v + 1) / 50) * 50 - 1);
const mkFloors = () => store.get(MK_FLOOR_KEY, {});

const mkTrusted = () => store.get(MK_TRUST_KEY, null) || mkData.trusted || [];
// المنافس اللي المنتج خلص عنده مابيتحسبش في الاقتراح (سعر قديم غالباً)
const mkUsable = (s) => s.price > 0 && s.stock !== "out";

function mkSuggest(p, sources) {
  const trusted = mkTrusted();
  const tr = sources.filter((s) => trusted.includes(s.store) && mkUsable(s));
  const pool = tr.length ? tr : sources.filter(mkUsable);
  if (!pool.length) return null;
  const ref = Math.min(...pool.map((s) => s.price));
  let sugg = mkRound(ref - Math.max(20, ref * 0.01)); // أرخص من أرخص منافس بحاجة بسيطة
  const floor = Number(mkFloors()[p.id]) || 0;
  const floored = floor && sugg < floor;
  if (floored) sugg = floor;
  const keep = Math.abs(sugg - p.price) / p.price < MK_KEEP_PCT;
  return { ref, refTrusted: tr.length > 0, sugg: keep ? p.price : sugg, keep, floor, floored };
}

async function mkLoad() {
  if (mkData) return mkData;
  const res = await fetch("market-prices.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("market-prices.json " + res.status);
  mkData = await res.json();
  return mkData;
}

function mkRender() {
  const box = $("#mkList");
  if (!mkData) return;
  $("#mkUpdated").textContent = (mkData.updated ? dateFmt(mkData.updated, { day: "numeric", month: "long" }) : "—")
    + (mkData.sigmaUpdated ? ` · سيجما: ${dateFmt(mkData.sigmaUpdated, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}` : "");
  const byId = new Map(adminProducts.map((p) => [p.id, p]));
  const prev = new Map(mkRows.map((r) => [r.p.id, r]));
  mkRows = Object.entries(mkData.items || {}).map(([id, sources]) => {
    const p = byId.get(Number(id));
    if (!p) return null;
    const s = mkSuggest(p, sources);
    if (!s) return null;
    const old = prev.get(p.id);
    const maxMarket = Math.max(...sources.filter(mkUsable).map((x) => x.price), 0) || Math.max(...sources.map((x) => x.price || 0));
    // السعر قبل الخصم بيتمسح لو: السعر هيزيد (يبقى الخصم خلص)، أو بقى أقل من الجديد، أو أعلى من السوق كله بكتير
    const oldBad = (np) => !!p.old && (np > p.price || p.old <= np || p.old > maxMarket * 1.15);
    const newPrice = old?.edited ? old.newPrice : s.sugg;
    return { p, sources, ...s, maxMarket, oldBad, newPrice, edited: !!old?.edited,
      // فرق أكبر من 10% مش متعلّم من الأول: غالباً سعر عرض أو منتج مختلف، فلازم تتأكد بنفسك
      big: Math.abs(newPrice - p.price) / p.price > 0.10,
      on: old ? old.on : !s.keep && Math.abs(newPrice - p.price) / p.price <= 0.10, clearOld: old ? old.clearOld : oldBad(newPrice) };
  }).filter(Boolean).sort((a, b) => Math.abs(b.newPrice - b.p.price) / b.p.price - Math.abs(a.newPrice - a.p.price) / a.p.price);

  if (!productsLoaded) { box.innerHTML = `<p class="muted">بنحمّل المنتجات...</p>`; return; }
  if (!mkRows.length) { box.innerHTML = `<p class="muted">مفيش منتجات عليها أسعار سوق لسه.</p>`; return; }
  box.innerHTML = mkRows.map((r) => {
    const d = r.newPrice - r.p.price, pct = Math.round((d / r.p.price) * 100);
    const tag = r.keep && !r.edited ? `<span class="mk-tag">⚪ مظبوط</span>`
      : d > 0 ? `<span class="mk-tag mk-tag--up">⬆ +${num(d)} (${pct}%)</span>`
      : d < 0 ? `<span class="mk-tag mk-tag--down">⬇ ${num(d)} (${pct}%)</span>` : `<span class="mk-tag">⚪ زي ما هو</span>`;
    const src = r.sources.map((s) => {
      const out = s.stock === "out";
      const t = `${escapeHtml(s.store)} <b>${num(s.price)}</b>${out ? ` <small>مش متوفر عندهم</small>` : ""}${s.note ? ` <small>${escapeHtml(s.note)}</small>` : ""}`;
      const cls = "mk-src" + (mkTrusted().includes(s.store) ? " mk-src--trusted" : "") + (out ? " mk-src--out" : "");
      return s.url ? `<a class="${cls}" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${t} ↗</a>` : `<span class="${cls}">${t}</span>`;
    }).join("");
    return `
      <div class="mk-row ${r.on ? "is-on" : ""}" data-mk="${r.p.id}">
        <label class="mk-pick"><input type="checkbox" data-mk-on ${r.on ? "checked" : ""} /></label>
        <div class="mk-main">
          <div class="mk-name"><b>${escapeHtml(r.p.name)}</b><small>#${r.p.id} · الضمان: ${escapeHtml(r.p.warranty || "—")} · المخزون: ${num(r.p.stock ?? 0)}</small></div>
          <div class="mk-srcs">${src}</div>
          ${r.big ? `<small class="mk-warn">⚠️ فرق كبير (أكتر من 10%): افتح لينك المنافس واتأكد إنه نفس المنتج ومش عرض مؤقت قبل ما تعلّم عليه</small>` : ""}
          ${r.floored ? `<small class="mk-warn">السعر المقترح كان أقل من «أقل سعر» بتاعك، فوقفناه عنده</small>` : ""}
          ${!r.refTrusted ? `<small class="mk-warn">مفيش سعر متوفر من المنافسين اللي اخترتهم، فالاقتراح من باقي المحلات</small>` : ""}
          ${r.p.old ? `<label class="mk-old"><input type="checkbox" data-mk-clear ${r.clearOld ? "checked" : ""} /> امسح «السعر قبل الخصم» (${num(r.p.old)})${r.p.old > r.maxMarket * 1.15 ? ` <small class="mk-warn">أعلى من السوق كله</small>` : ""}</label>` : ""}
        </div>
        <div class="mk-prices">
          <div><small>سعرك</small><b>${num(r.p.price)}</b></div>
          <div><small>أرخص منافس</small><b>${num(r.ref)}</b></div>
          <div class="mk-new"><small>الجديد</small><input type="number" inputmode="numeric" min="1" step="1" value="${r.newPrice}" data-mk-price /></div>
          <div class="mk-floor"><small>أقل سعر ليك</small><input type="number" inputmode="numeric" min="0" step="1" value="${r.floor || ""}" placeholder="اختياري" data-mk-floor /></div>
          ${tag}
        </div>
      </div>`;
  }).join("");
  mkCount();
}

function mkRenderTrust() {
  const stores = [...new Set(Object.values(mkData.items || {}).flat().map((s) => s.store))];
  const on = mkTrusted();
  $("#mkTrust").innerHTML = `<span class="muted">الاقتراح على أساس:</span> ` + stores.map((st) =>
    `<label class="mk-chip ${on.includes(st) ? "is-on" : ""}"><input type="checkbox" value="${escapeHtml(st)}" ${on.includes(st) ? "checked" : ""} />${escapeHtml(st)}</label>`).join("");
}
$("#mkTrust").addEventListener("change", (e) => {
  if (!e.target.matches("input")) return;
  const on = [...$$("#mkTrust input:checked")].map((i) => i.value);
  store.set(MK_TRUST_KEY, on);
  mkRows.forEach((r) => { r.edited = false; });
  mkRenderTrust();
  mkRender();
});

function mkCount() {
  const n = mkRows.filter((r) => r.on && (r.newPrice !== r.p.price || (r.clearOld && r.p.old))).length;
  $("#mkApply").disabled = !n;
  $("#mkApply").textContent = n ? `✅ طبّق على ${num(n)} منتج` : "✅ طبّق";
}

$("#mkList").addEventListener("change", (e) => {
  const row = e.target.closest("[data-mk]");
  if (!row) return;
  const r = mkRows.find((x) => x.p.id === Number(row.dataset.mk));
  if (e.target.matches("[data-mk-on]")) { r.on = e.target.checked; row.classList.toggle("is-on", r.on); }
  if (e.target.matches("[data-mk-clear]")) r.clearOld = e.target.checked;
  if (e.target.matches("[data-mk-price]")) {
    const v = Math.round(Number(toLatinDigits(e.target.value)));
    if (v > 0) {
      r.newPrice = v; r.edited = true; r.on = true;
      if (r.p.old) r.clearOld = r.oldBad(v);
      if (r.floor && v < r.floor) toast(`⚠️ ${num(v)} أقل من «أقل سعر» اللي كتبته (${num(r.floor)})`);
      mkRender();
      return;
    }
  }
  if (e.target.matches("[data-mk-floor]")) {
    const v = Math.round(Number(toLatinDigits(e.target.value))) || 0;
    const all = mkFloors();
    if (v > 0) all[r.p.id] = v; else delete all[r.p.id];
    store.set(MK_FLOOR_KEY, all);
    r.edited = false; // الاقتراح يتحسب تاني على الحد الجديد
    mkRender();
    return;
  }
  mkCount();
});

$("#mkAll").addEventListener("click", () => {
  const all = mkRows.every((r) => r.on);
  mkRows.forEach((r) => { r.on = !all; });
  mkRender();
});

$("#mkApply").addEventListener("click", async () => {
  const list = mkRows.filter((r) => r.on && (r.newPrice !== r.p.price || (r.clearOld && r.p.old)));
  if (!list.length) return;
  const below = list.filter((r) => r.floor && r.newPrice < r.floor);
  const lines = list.map((r) => `• ${r.p.name.slice(0, 40)}: ${num(r.p.price)} ← ${num(r.newPrice)}${r.clearOld && r.p.old ? " (والسعر قبل الخصم يتمسح)" : ""}`);
  if (!confirm(`هتتغير أسعار ${num(list.length)} منتج في المتجر:\n\n${lines.join("\n")}${below.length ? `\n\n⚠️ ${num(below.length)} منهم أقل من «أقل سعر» بتاعك.` : ""}\n\nمتأكد؟`)) return;
  const btn = $("#mkApply");
  btn.disabled = true;
  let ok = 0;
  for (const r of list) {
    const changes = { price: r.newPrice };
    if (r.clearOld && r.p.old) changes.old = null;
    else if (r.p.old && r.p.old <= r.newPrice) changes.old = null; // خصم بالسالب مالوش معنى
    try { await productsStore.update(r.p.id, changes); ok++; }
    catch (err) { console.warn("market price", r.p.id, err); }
  }
  mkRows.forEach((r) => { r.edited = false; });
  toast(ok === list.length
    ? `✅ اتغيرت أسعار ${num(ok)} منتج، والمتجر هيعرضها خلال دقايق`
    : `⚠️ اتغير ${num(ok)} من ${num(list.length)} بس، جرّب الباقي تاني`);
  btn.disabled = false;
});

document.addEventListener("sectionchange", async (e) => {
  if (e.detail !== "market") return;
  try { await mkLoad(); mkRenderTrust(); mkRender(); }
  catch (err) { console.warn("market", err); $("#mkList").innerHTML = `<p class="muted">مقدرناش نجيب ملف أسعار السوق، جرّب تاني.</p>`; }
});
document.addEventListener("adminproducts", () => { if (!$("#marketSection").hidden && mkData) mkRender(); });
