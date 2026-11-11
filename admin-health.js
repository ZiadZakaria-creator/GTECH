// ============ لوحة التحكم: فحص المنتجات ============
// بيدوّر على المشاكل في المنتجات الظاهرة في المتجر لوحده، وجنب كل مشكلة زرار يصلحها:
// خسارة، سعر قبل الخصم مش منطقي، كلمة "ضمان" على منتج بدون ضمان، كلام ممنوع، خلصان وظاهر، من غير صور أو وصف...
// أسعار السوق من market-prices.json (ملف ثابت في الموقع، مش Firestore).

const HL_BANNED = [
  [/الكمي[ةه] محدود[ةه]/, "«الكمية محدودة» من غير تاريخ انتهاء حقيقي"],
  [/لفتر[ةه] محدود[ةه]/, "«لفترة محدودة» من غير تاريخ انتهاء حقيقي"],
  [/الأ?كثر مبيع/, "«الأكثر مبيعاً» من غير بيانات"],
  [/(لكل|لجميع|كل) (مصر|المحافظات|محافظات)/, "توصيل لكل مصر (التوصيل القاهرة والجيزة بس)"],
];
const HL_LEVELS = { red: "🔴 مهم", orange: "🟠 راجعه", gray: "⚪ تحسين" };
let hlTab = "all";
let hlMarket = null;

const hlText = (p) => [p.name, p.tag, p.desc, ...(p.highlights || []), ...Object.entries(p.specs || {}).flat()].filter(Boolean).join(" \n ");

function productIssues(p) {
  const out = [];
  const add = (level, text, fixes = ["edit"]) => out.push({ level, text, fixes });
  const cost = typeof costOf === "function" ? costOf(p.id) : 0;
  const src = (hlMarket?.items || {})[p.id] || [];
  const usable = src.filter((s) => s.price > 0 && s.stock !== "out");
  const minM = usable.length ? Math.min(...usable.map((s) => s.price)) : 0;
  const maxM = usable.length ? Math.max(...usable.map((s) => s.price)) : 0;
  const all = hlText(p);

  if (cost && p.price < cost) add("red", `بيتباع بخسارة: سعره ${num(p.price)} والتكلفة ${num(cost)}`, ["market", "edit"]);
  if (p.old && p.old <= p.price) add("red", `«السعر قبل الخصم» (${num(p.old)}) مش أعلى من السعر (${num(p.price)})`, ["clearOld"]);
  else if (p.old && maxM && p.old > maxM * 1.15) add("orange", `«السعر قبل الخصم» (${num(p.old)}) أعلى من أغلى سعر في السوق (${num(maxM)}) — شكله خصم مش حقيقي`, ["clearOld"]);
  if (warrantyText(p) && !hasWarranty(p) && /ضمان/.test(all.replace(/بدون ضمان|مفيش ضمان|من غير ضمان|لا يوجد ضمان/g, ""))) {
    const at = all.split(/\n|\.|،/).find((l) => /ضمان/.test(l.replace(/بدون ضمان|مفيش ضمان|من غير ضمان/g, ""))) || "";
    add("red", `المنتج «${escapeHtml(warrantyText(p))}» ومكتوب فيه كلمة ضمان: «${escapeHtml(at.trim().slice(0, 70))}»`);
  }
  for (const [re, label] of HL_BANNED) if (re.test(all)) add("red", `مكتوب فيه ${label}`);
  if ((p.stock ?? 1) <= 0) add("orange", "خلصان من المخزون وظاهر في المتجر بعلامة «نفد»", ["hide", "edit"]);
  if (minM && p.price > minM * 1.10) add("orange", `أغلى من أرخص منافس (${num(minM)}) بـ ${num(Math.round(((p.price - minM) / minM) * 100))}%`, ["market"]);
  if (!warrantyText(p)) add("gray", "الضمان مش مكتوب (اكتب المدة أو «بدون ضمان»)");
  if (!(p.images || []).length) add("gray", "من غير صور", ["img", "edit"]);
  if (String(p.desc || "").trim().length < 40) add("gray", "الوصف فاضي أو قصير أوي");
  return out;
}

const HL_FIX = {
  clearOld: "🧹 امسح السعر قبل الخصم",
  hide: "🚫 اخفيه من المتجر",
  edit: "✏️ عدّل المنتج",
  market: "📈 افتح أسعار السوق",
  img: "📷 ضيف صور",
  cost: "💰 اكتب التكلفة",
};

function renderHealth() {
  if ($("#healthSection").hidden) return;
  if (!productsLoaded) { $("#hlList").innerHTML = `<p class="muted">بنحمّل المنتجات...</p>`; return; }
  const rows = adminProducts.filter((p) => p.active !== false)
    .map((p) => ({ p, issues: productIssues(p) }))
    .filter((r) => r.issues.length);
  const cnt = { all: 0, red: 0, orange: 0, gray: 0 };
  rows.forEach((r) => r.issues.forEach((i) => { cnt[i.level]++; cnt.all++; }));
  $$("#hlTabs [data-hl-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.hlTab === hlTab);
    b.querySelector("b").textContent = num(cnt[b.dataset.hlTab]);
  });
  const rank = { red: 0, orange: 1, gray: 2 };
  const shown = rows
    .map((r) => ({ ...r, issues: r.issues.filter((i) => hlTab === "all" || i.level === hlTab) }))
    .filter((r) => r.issues.length)
    .sort((a, b) => Math.min(...a.issues.map((i) => rank[i.level])) - Math.min(...b.issues.map((i) => rank[i.level])) || b.issues.length - a.issues.length || a.p.id - b.p.id);
  $("#hlSummary").innerHTML = cnt.red
    ? `🔴 فيه <b>${num(cnt.red)}</b> مشكلة مهمة (خسارة أو كلام مخالف) — ابدأ بيهم.`
    : cnt.all ? "✅ مفيش مشاكل مهمة. الباقي تحسينات." : "✅ كل المنتجات الظاهرة سليمة.";
  $("#hlList").innerHTML = shown.length ? shown.map((r) => `
    <div class="hl-row" data-hl="${r.p.id}">
      <div class="mk-name"><b>${escapeHtml(r.p.name)}</b><small>#${r.p.id} · ${fmt(r.p.price)}${r.p.old ? ` · قبل الخصم ${fmt(r.p.old)}` : ""} · الضمان: ${escapeHtml(warrantyText(r.p) || "—")} · المخزون: ${num(r.p.stock ?? 0)}</small></div>
      <ul class="hl-issues">${r.issues.map((i) => `
        <li class="hl-issue hl-issue--${i.level}">
          <span><em>${HL_LEVELS[i.level]}</em> ${i.text}</span>
          <span class="hl-fixes">${i.fixes.map((f) => `<button type="button" class="btn btn--ghost btn--sm" data-hl-fix="${f}">${HL_FIX[f]}</button>`).join("")}</span>
        </li>`).join("")}</ul>
    </div>`).join("") : `<p class="muted">مفيش مشاكل هنا 👌</p>`;
  const badge = $("#healthBadge");
  badge.hidden = !cnt.red;
  badge.textContent = num(cnt.red);
}

// العدّاد اللي جنب القسم بيتحدث حتى لو القسم مقفول
function updateHealthBadge() {
  if (!productsLoaded) return;
  const red = adminProducts.filter((p) => p.active !== false).reduce((s, p) => s + productIssues(p).filter((i) => i.level === "red").length, 0);
  $("#healthBadge").hidden = !red;
  $("#healthBadge").textContent = num(red);
}

$("#hlList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-hl-fix]");
  if (!b) return;
  const p = adminProducts.find((x) => x.id === Number(b.closest("[data-hl]").dataset.hl));
  if (!p) return;
  const fix = b.dataset.hlFix;
  if (fix === "edit") return openEditor(p);
  if (fix === "img") { rowImgTarget = p.id; return $("#rowImgFiles").click(); }
  if (fix === "market" || fix === "cost") {
    showSection(fix === "market" ? "market" : "profit");
    const box = $(fix === "market" ? "#mkSearch" : "#pfSearch");
    box.value = String(p.id);
    box.dispatchEvent(new Event("input"));
    return;
  }
  const msg = fix === "clearOld" ? `هنمسح «السعر قبل الخصم» (${num(p.old)}) من "${p.name}"، والمنتج هيتعرض بسعره ${num(p.price)} من غير خصم. متأكد؟`
    : `هنخفي "${p.name}" من المتجر لحد ما تزوّد المخزون وتظهره تاني من المنتجات. متأكد؟`;
  if (!confirm(msg)) return;
  b.disabled = true;
  try {
    if (fix === "clearOld") await productsStore.update(p.id, { old: null });
    if (fix === "hide") await productsStore.setActive(p.id, false);
    toast(fix === "clearOld" ? "🧹 اتمسح السعر قبل الخصم" : `🚫 "${p.name}" اتخفى من المتجر`);
  } catch (err) {
    console.warn("health fix", err);
    toast("❌ مقدرناش نعدّل المنتج، جرّب تاني");
    b.disabled = false;
  }
});
$("#hlTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hl-tab]");
  if (!b) return;
  hlTab = b.dataset.hlTab;
  renderHealth();
});

document.addEventListener("sectionchange", async (e) => {
  if (e.detail !== "health") return;
  watchProducts();
  renderHealth();
  try { hlMarket = await mkLoad(); } catch (err) { console.warn("health market", err); }
  await privLoad("costs");
  renderHealth();
});
["adminproducts", "privchange"].forEach((ev) => document.addEventListener(ev, () => {
  if (!$("#healthSection").hidden) renderHealth();
  else updateHealthBadge();
}));
