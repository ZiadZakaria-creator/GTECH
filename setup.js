// ============ جهّز سيتك بميزانيتك ============
// العميل يختار الميزانية والقطع (ماوس، كيبورد، سماعة، دراع) ← بنختار له أحسن تشكيلة من المتاح فعلاً
// بأسعار الموقع الحالية. "أحسن" = أعلى مجموع لـ log(السعر): بيصرف الميزانية بتوازن بدل ما يحطها كلها في قطعة.
// كل قطعة ليها زرارين يبدّلوها بغيرها من نفس القسم من غير ما الإجمالي يعدّي الميزانية.
// الحالة في اللينك (setup.html?b=1500&p=mkh) عشان الإعلانات والمشاركة.

// gaming: في الماوسات والسماعات بناخد موديلات الجيمنج بس (مش ماوس مكتب ولا سماعة بلوتوث عادية)
const GAMING = /جيمنج|gaming/i;
const SLOTS = [
  { key: "m", cat: "mice", label: "ماوس", icon: "🖱️", gaming: true },
  { key: "k", cat: "keyboards", label: "كيبورد", icon: "⌨️" },
  { key: "h", cat: "audio", label: "سماعة", icon: "🎧", gaming: true },
  { key: "c", cat: "controllers", label: "دراع", icon: "🎮" },
];
const BUDGETS = [1000, 1500, 2000, 3000, 5000];
const sp = new URLSearchParams(location.search);
let budget = Math.max(0, Math.round(Number(toLatinDigits(sp.get("b") || "")) || 1500));
let picked = new Set((sp.get("p") || "mkh").split("").filter((k) => SLOTS.some((s) => s.key === k)));
if (!picked.size) picked = new Set(["m", "k", "h"]);
let combo = {}; // key ← رقم المنتج

const pool = (s) => shopProducts()
  .filter((p) => inStock(p) && p.price > 0 && productCategory(p) === s.cat && (!s.gaming || GAMING.test(p.name)))
  .sort((a, b) => a.price - b.price);
const activeSlots = () => SLOTS.filter((s) => picked.has(s.key));
const total = () => activeSlots().reduce((s, x) => s + (findProduct(combo[x.key])?.price || 0), 0);

// أحسن تشكيلة في الميزانية (القوائم صغيرة، فبنجرب كل الاحتمالات)
function bestCombo() {
  const lists = activeSlots().map((s) => pool(s));
  if (lists.some((l) => !l.length)) return null;
  let best = null;
  let bestScore = -Infinity;
  const walk = (i, sum, score, chosen) => {
    if (sum > budget) return;
    if (i === lists.length) {
      if (score > bestScore) { bestScore = score; best = [...chosen]; }
      return;
    }
    for (const p of lists[i]) {
      if (sum + p.price > budget) break; // مترتبين بالسعر
      chosen.push(p.id);
      walk(i + 1, sum + p.price, score + Math.log(p.price), chosen);
      chosen.pop();
    }
  };
  walk(0, 0, 0, []);
  return best && Object.fromEntries(activeSlots().map((s, i) => [s.key, best[i]]));
}
const minNeeded = () => activeSlots().reduce((s, x) => s + (pool(x)[0]?.price || 0), 0);

function syncUrl() {
  const p = SLOTS.filter((s) => picked.has(s.key)).map((s) => s.key).join("");
  history.replaceState(null, "", `${location.pathname}?b=${budget}&p=${p}`);
}

function renderControls() {
  $("#budgetChips").innerHTML = BUDGETS.map((b) => `<button type="button" class="chip ${b === budget ? "active" : ""}" data-budget="${b}" aria-pressed="${b === budget}">${fmt(b)}</button>`).join("");
  $("#budgetInput").value = budget;
  $("#slotChips").innerHTML = SLOTS.map((s) => {
    const on = picked.has(s.key);
    return `<button type="button" class="chip ${on ? "active" : ""}" data-slot="${s.key}" aria-pressed="${on}">${s.icon} ${s.label}</button>`;
  }).join("");
}

function slotCard(s) {
  const p = findProduct(combo[s.key]);
  if (!p) return "";
  const others = total() - p.price;
  const fits = pool(s).filter((x) => x.price + others <= budget); // نفس قايمة swap()
  const i = fits.findIndex((x) => x.id === p.id);
  return `
    <article class="setup-item card-box">
      <span class="setup-item__label">${s.icon} ${s.label}</span>
      <a class="setup-item__img" href="${productUrl(p.id)}">${productVisual(p)}</a>
      <a class="setup-item__name" href="${productUrl(p.id)}">${escapeHtml(p.name)}</a>
      <div class="setup-item__meta">
        <b class="setup-item__price">${fmt(p.price)}</b>
        <small>${hasWarranty(p) ? `🛡️ ضمان ${escapeHtml(warrantyText(p))}` : "بدون ضمان"}</small>
      </div>
      <div class="setup-item__swap">
        <button type="button" class="btn btn--ghost btn--sm" data-swap="${s.key}" data-dir="-1" ${i > 0 ? "" : "disabled"} aria-label="بديل أرخص">↓ أرخص</button>
        <button type="button" class="btn btn--ghost btn--sm" data-swap="${s.key}" data-dir="1" ${i < fits.length - 1 ? "" : "disabled"} aria-label="بديل أغلى">أغلى ↑</button>
      </div>
    </article>`;
}

function render() {
  renderControls();
  if (!products.length) return;
  const slots = activeSlots();
  const ok = slots.length && slots.every((s) => findProduct(combo[s.key]));
  $("#setupGrid").innerHTML = ok ? slots.map(slotCard).join("") : "";
  $("#setupEmpty").hidden = ok;
  $("#setupBar").hidden = !ok;
  if (!ok) {
    const need = minNeeded();
    $("#setupEmptyText").textContent = need > budget
      ? `أقل سيت بالقطع دي بيبدأ من ${fmt(need)}. زوّد الميزانية أو شيل قطعة.`
      : "اختار قطعة واحدة على الأقل.";
    return;
  }
  const t = total();
  $("#setupTotal").textContent = fmt(t);
  $("#setupLeft").textContent = budget - t > 0 ? `باقي من ميزانيتك ${fmt(budget - t)}` : "على قد ميزانيتك بالظبط";
}

function rebuild() {
  combo = bestCombo() || {};
  syncUrl();
  render();
}

function swap(key, dir) {
  const s = SLOTS.find((x) => x.key === key);
  const cur = findProduct(combo[key]);
  if (!s || !cur) return;
  const others = total() - cur.price;
  const list = pool(s).filter((x) => x.price + others <= budget);
  const i = list.findIndex((x) => x.id === cur.id);
  const next = list[i + dir];
  if (!next) return;
  combo[key] = next.id;
  render();
}

$("#budgetChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-budget]");
  if (!b) return;
  budget = +b.dataset.budget;
  rebuild();
});
$("#budgetForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = Math.round(Number(toLatinDigits($("#budgetInput").value)));
  if (!(v > 0)) return toast("اكتب الميزانية بالأرقام");
  budget = Math.min(v, 100000);
  rebuild();
});
$("#slotChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-slot]");
  if (!b) return;
  picked.has(b.dataset.slot) ? picked.delete(b.dataset.slot) : picked.add(b.dataset.slot);
  rebuild();
});
$("#setupGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-swap]");
  if (b) swap(b.dataset.swap, +b.dataset.dir);
});
$("#setupAdd").addEventListener("click", () => {
  const ids = activeSlots().map((s) => combo[s.key]).filter(Boolean);
  ids.forEach((id) => {
    const item = cart.find((i) => i.id === id && !i.opts);
    item ? item.qty++ : cart.push({ id, qty: 1, opts: "" });
  });
  renderCart();
  if (typeof track === "function") track("add_to_cart", { items: ids.map((id) => ({ ...findProduct(id), qty: 1 })) });
  toast(`🛒 السيت (${num(ids.length)} قطع) اتضاف للسلة`);
  openCart(true);
});

document.addEventListener("productschange", rebuild);
rebuild();
