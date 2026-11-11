// ============ لوحة التحكم: ردود جاهزة ============
// الردود اللي بتتكرر على واتساب وتيك توك وإنستجرام: ضغطة تنسخ الرد، وبعض الردود ليها نسخة قصيرة للتعليقات.
// الردود الأساسية هنا في الكود، وأي رد تعدّله أو تضيفه بيتحفظ في adminData/replies:
// { "<id>": { title, cat, text, short } | "hidden" }

const RP_CATS = { pay: "💵 الدفع", ship: "🚚 التوصيل", product: "📦 المنتجات", order: "🧾 الطلب", other: "💬 عام" };
const RP_DEFAULTS = [
  { id: "install", cat: "pay", title: "فيه تقسيط؟",
    text: "أهلاً بيك 🙏\nالتقسيط مش متاح عندنا دلوقتي. تقدر تدفع كاش لما تستلم الطلب، والتوصيل في القاهرة والجيزة.\nولو التقسيط بقى متاح هنعلن عنه على صفحاتنا.\nقولنا عينك على أنهي منتج ونقولك سعره 👇",
    short: "التقسيط مش متاح دلوقتي 🙏 الدفع كاش عند الاستلام (القاهرة والجيزة). قولنا عينك على أنهي منتج ونقولك سعره 👇" },
  { id: "cod", cat: "pay", title: "الدفع إزاي؟",
    text: "الدفع كاش للمندوب لما الطلب يوصلك 💵\nمش هتدفع أي حاجة قبل الاستلام.",
    short: "الدفع كاش عند الاستلام 💵" },
  { id: "areas", cat: "ship", title: "بتوصّلوا محافظتي؟",
    text: "أهلاً بيك 🙏\nحالياً التوصيل في القاهرة والجيزة بس.\nلو عندك عنوان في القاهرة أو الجيزة (شغل، قرايب، صحاب) نقدر نبعتلك الطلب عليه.",
    short: "التوصيل حالياً القاهرة والجيزة بس 🙏 لو عندك عنوان هناك نبعتلك عليه." },
  { id: "time", cat: "ship", title: "الطلب بيوصل إمتى؟",
    text: "الطلب بيتبعت خلال 4 أيام عمل من تأكيده 📦\nوالمندوب بيكلمك قبل ما يوصل، فخلي موبايلك جنبك 🙏",
    short: "بيوصل خلال 4 أيام عمل من التأكيد، والمندوب بيكلمك قبلها 📦" },
  { id: "warranty", cat: "product", title: "الضمان كام؟",
    text: "الضمان بيختلف من منتج للتاني، ومكتوب في صفحة كل منتج على الموقع.\nابعتلنا اسم المنتج ونقولك ضمانه بالظبط 🙏",
    short: "الضمان مكتوب في صفحة كل منتج، ابعتلنا اسمه ونقولك 🙏" },
  { id: "avail", cat: "product", title: "متوفر؟ وبكام؟",
    text: "أيوه متوفر ✅\n💰 السعر: [السعر] ج.م\nتقدر تطلبه من هنا 👇\n[اللينك]\nالتوصيل في القاهرة والجيزة، والدفع عند الاستلام.",
    short: "متوفر ✅ وسعره [السعر] ج.م، اللينك في البايو 👆" },
  { id: "cheaper", cat: "product", title: "لقيته أرخص في حتة تانية",
    text: "شكراً إنك قولتلنا 🙏\nابعتلنا لينك المكان اللي لقيته فيه، ولو نفس المنتج بالظبط ومتوفر عندهم، هنراجع سعرنا ونرد عليك.",
    short: "ابعتلنا اللينك في رسالة ونراجع سعرنا ونرد عليك 🙏" },
  { id: "how", cat: "order", title: "أطلب إزاي؟",
    text: `بسيطة 👇\n1️⃣ ادخل على ${siteUrl("")}\n2️⃣ اختار المنتج ودوس «اطلب»\n3️⃣ اكتب اسمك ورقمك وعنوانك\nوهنكلمك على واتساب نأكد الطلب ✅`,
    short: "اللينك في البايو 👆 اختار المنتج واكتب بياناتك وهنكلمك نأكد ✅" },
  { id: "track", cat: "order", title: "طلبي فين؟",
    text: `تقدر تتابع حالة طلبك من هنا 👇\n${siteUrl("myorders.html")}\nولو محتاج أي حاجة ابعتلنا رقم الطلب ونشوفهولك على طول 🙏` },
  { id: "thanks", cat: "other", title: "شكر بعد الاستلام",
    text: "شكراً إنك اشتريت من GTECH MASR 💙\nلو احتجت أي حاجة أو عندك سؤال عن المنتج، إحنا هنا." },
  { id: "later", cat: "other", title: "هنرد عليك قريب",
    text: "شكراً لرسالتك 🙏 هنرد عليك في أقرب وقت." },
];
let rpQuery = "";
let rpEditing = null;

function rpList() {
  const saved = privGet("replies");
  const base = RP_DEFAULTS.map((d) => (saved[d.id] === "hidden" ? null : { ...d, ...(saved[d.id] || {}), builtIn: true }));
  const custom = Object.entries(saved).filter(([id, v]) => v && v !== "hidden" && !RP_DEFAULTS.some((d) => d.id === id))
    .map(([id, v]) => ({ id, ...v }));
  return [...base.filter(Boolean), ...custom];
}

function renderReplies() {
  if ($("#repliesSection").hidden) return;
  $("#rpNote").innerHTML = privNote();
  const q = mkNorm(rpQuery.trim());
  const list = rpList().filter((r) => !q || mkNorm(r.title + " " + r.text + " " + (r.short || "")).includes(q));
  const cats = Object.keys(RP_CATS).filter((c) => list.some((r) => (r.cat || "other") === c));
  $("#rpList").innerHTML = cats.length ? cats.map((c) => `
    <h4 class="rp-cat">${RP_CATS[c]}</h4>
    ${list.filter((r) => (r.cat || "other") === c).map((r) => `
      <div class="rp-card" data-rp="${escapeHtml(r.id)}">
        <div class="rp-head"><b>${escapeHtml(r.title)}</b>
          <span class="rp-tools"><button type="button" class="icon-btn" data-rp-edit title="عدّل">✏️</button><button type="button" class="icon-btn" data-rp-del title="${r.builtIn ? "اخفيه" : "امسحه"}">🗑</button></span></div>
        <p class="rp-text">${escapeHtml(r.text)}</p>
        <div class="rp-btns">
          <button type="button" class="btn btn--primary btn--sm" data-rp-copy="text">📋 انسخ الرد</button>
          ${r.short ? `<button type="button" class="btn btn--ghost btn--sm" data-rp-copy="short" title="${escapeHtml(r.short)}">💬 نسخة تعليق قصيرة</button>` : ""}
          <a class="btn btn--wa btn--sm" href="https://wa.me/?text=${encodeURIComponent(r.text)}" target="_blank" rel="noopener" title="بيفتح واتساب تختار الشات">واتساب ↗</a>
        </div>
        ${/\[(السعر|اللينك)\]/.test(r.text) ? `<small class="muted">غيّر [السعر] و[اللينك] قبل ما تبعت.</small>` : ""}
      </div>`).join("")}`).join("") : `<p class="muted">مفيش ردود مطابقة.</p>`;
  const hidden = RP_DEFAULTS.filter((d) => privGet("replies")[d.id] === "hidden").length;
  $("#rpRestore").hidden = !hidden;
  $("#rpRestore").textContent = `↩️ رجّع ${num(hidden)} ${hidden === 1 ? "رد مخفي" : "ردود مخفية"}`;
}

function rpOpenForm(r = null) {
  rpEditing = r;
  const f = $("#rpForm");
  f.hidden = false;
  f.rtitle.value = r?.title || "";
  f.cat.value = r?.cat || "other";
  f.text.value = r?.text || "";
  f.short.value = r?.short || "";
  $("#rpFormHead").textContent = r ? "تعديل الرد" : "رد جديد";
  f.rtitle.focus();
  f.scrollIntoView({ behavior: "smooth", block: "center" });
}

$("#rpList").addEventListener("click", async (e) => {
  const card = e.target.closest("[data-rp]");
  if (!card) return;
  const r = rpList().find((x) => x.id === card.dataset.rp);
  if (!r) return;
  const copy = e.target.closest("[data-rp-copy]");
  if (copy) {
    const txt = copy.dataset.rpCopy === "short" ? r.short : r.text;
    try { await navigator.clipboard.writeText(txt); toast("📋 الرد اتنسخ — الصقه في الشات"); }
    catch { prompt("انسخ الرد:", txt); }
    return;
  }
  if (e.target.closest("[data-rp-edit]")) return rpOpenForm(r);
  if (e.target.closest("[data-rp-del]")) {
    if (!confirm(r.builtIn ? `هنخفي «${r.title}» (تقدر ترجّعه بعدين).` : `هنمسح «${r.title}» نهائياً. متأكد؟`)) return;
    await privPatch("replies", { [r.id]: r.builtIn ? "hidden" : null });
    toast(r.builtIn ? "الرد اتخفى" : "🗑 الرد اتمسح");
  }
});

$("#rpNew").addEventListener("click", () => rpOpenForm(null));
$("#rpCancel").addEventListener("click", () => { $("#rpForm").hidden = true; rpEditing = null; });
$("#rpRestore").addEventListener("click", async () => {
  const saved = privGet("replies");
  await privPatch("replies", Object.fromEntries(RP_DEFAULTS.filter((d) => saved[d.id] === "hidden").map((d) => [d.id, null])));
  toast("↩️ الردود رجعت");
});
$("#rpForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const v = { title: f.rtitle.value.trim().slice(0, 80), cat: f.cat.value, text: f.text.value.trim().slice(0, 2000), short: f.short.value.trim().slice(0, 300) };
  if (!v.title || !v.text) return toast("اكتب عنوان الرد والرد نفسه");
  if (!v.short && !rpEditing?.builtIn) delete v.short; // الرد الأساسي: نسخة التعليق الفاضية بتفضل فاضية
  const id = rpEditing?.id || "c" + Date.now().toString(36);
  await privPatch("replies", { [id]: v });
  f.hidden = true;
  rpEditing = null;
  toast("✅ الرد اتحفظ");
});
$("#rpSearch").addEventListener("input", (e) => { rpQuery = e.target.value; renderReplies(); });
$("#rpForm").cat.innerHTML = Object.entries(RP_CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");

document.addEventListener("sectionchange", async (e) => {
  if (e.detail !== "replies") return;
  renderReplies();
  await privLoad("replies");
  renderReplies();
});
document.addEventListener("privchange", () => { if (!$("#repliesSection").hidden) renderReplies(); });
