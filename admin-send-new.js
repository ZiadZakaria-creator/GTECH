// ============ لوحة التحكم: ابعت المنتجات الجديدة لرقم واتساب (صور بس) ============
// واتساب مالوش طريقة مجانية تبعت صور لوحدها، فالإرسال بيتم من موبايل الأدمن في خطوتين:
// 1) نفتح شات الرقم (wa.me) عشان الشات يبقى أول واحد في القايمة.
// 2) قايمة المشاركة بتاعة الموبايل (navigator.share) بالصور، والأدمن يختار واتساب والشات.
// الصور بتتجاب من الملفات الثابتة على الموقع (p/img و images/) عشان مانصرفش قراءات Firestore،
// ولو صورة لسه ماتنشرتش (fs: مش في map.json) بس بنرجع لـ fetchStoredImage.

const SN_RECENT_KEY = "gtech-sendnew-recent"; // آخر أرقام اتبعتلها (على الجهاز ده بس)
const SN_MAX_RECENT = 8;
let snSelected = new Set();
let snTouched = false; // الأدمن غيّر الاختيار بنفسه؟ (عشان مانرجّعش الاختيار الافتراضي)

let snMapJob = null;
const snStaticMap = () => (snMapJob ||= fetch("p/img/map.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

// رابط الصورة من غير قراءة Firestore لو ينفع
async function snImageUrl(src, allowFirestore) {
  if (!src) return "";
  if (src.startsWith("fs:")) {
    const file = (await snStaticMap())[src.slice(3)];
    if (file) return siteUrl("p/img/" + file);
    return allowFirestore ? fetchStoredImage(src.slice(3)).catch(() => "") : "";
  }
  return /^(https?:|data:)/.test(src) ? src : siteUrl(src);
}

const snProducts = () => (productsLoaded && adminProducts.length ? adminProducts : products)
  .filter((p) => p.active !== false)
  .slice()
  .sort((a, b) => b.id - a.id); // الأحدث (أكبر رقم) الأول

const snValidPhone = (v) => /^01[0125]\d{8}$/.test(normalizePhone(v || ""));
const snRecent = () => store.get(SN_RECENT_KEY, []);

function snRenderRecent() {
  const list = snRecent();
  $("#snRecent").innerHTML = list.length
    ? `<span class="muted">آخر أرقام:</span> ${list.map((n) => `<button class="sendnew__chip" data-sn-num="${escapeHtml(n)}" dir="ltr">${escapeHtml(n)}</button>`).join("")}`
    : "";
}

function snSetLast(n) {
  snSelected = new Set(snProducts().slice(0, n).map((p) => p.id));
}

function snRenderList() {
  const list = snProducts();
  if (!snTouched && !snSelected.size) snSetLast(3);
  $("#snList").innerHTML = list.length ? list.map((p) => `
    <label class="sendnew__item ${snSelected.has(p.id) ? "is-on" : ""}">
      <input type="checkbox" data-sn-id="${p.id}" ${snSelected.has(p.id) ? "checked" : ""} />
      <span class="sendnew__thumb"><img alt="" data-sn-img="${escapeHtml((p.images || [])[0] || "")}" /></span>
      <span class="sendnew__info"><b>${escapeHtml(p.name)}</b><small>#${p.id} · ${fmt(p.price)}${(p.images || []).length ? ` · ${num((p.images || []).length)} صور` : " · مفيش صور"}</small></span>
    </label>`).join("") : `<div class="dash-empty"><span>📦</span><p>استنى لحد ما المنتجات تتحمّل</p></div>`;
  // الصور المصغرة: من الملفات الثابتة بس (من غير قراءات Firestore)
  $$("#snList img[data-sn-img]").forEach(async (img) => {
    const url = await snImageUrl(img.dataset.snImg, false);
    if (url) img.src = url; else img.closest(".sendnew__thumb").classList.add("is-empty");
  });
  snUpdateCount();
}

function snPicked() {
  const all = $("#snAllImgs").checked;
  return snProducts().filter((p) => snSelected.has(p.id))
    .flatMap((p) => (all ? p.images || [] : (p.images || []).slice(0, 1)).map((src, i) => ({ p, src, i })));
}

function snUpdateCount() {
  const n = snPicked().length;
  $("#snCount").textContent = n ? `(${num(n)})` : "";
  $("#snShare").disabled = !n;
  $("#snDownload").disabled = !n;
}

// بيحوّل الصور لملفات JPG عشان قايمة المشاركة وواتساب يقبلوها
async function snFiles() {
  const out = [];
  for (const { p, src, i } of snPicked()) {
    try {
      const url = await snImageUrl(src, true);
      if (!url) continue;
      const blob = await (await fetch(url)).blob();
      const type = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : "image/jpeg";
      const ext = type.split("/")[1].replace("jpeg", "jpg");
      out.push(new File([blob], `GTECH-MASR-${p.id}${i ? "-" + (i + 1) : ""}.${ext}`, { type }));
    } catch {}
  }
  return out;
}

function snRemember(phone) {
  const list = [phone, ...snRecent().filter((n) => n !== phone)].slice(0, SN_MAX_RECENT);
  store.set(SN_RECENT_KEY, list);
  snRenderRecent();
}

$("#snOpen").addEventListener("click", () => {
  const phone = normalizePhone($("#snPhone").value);
  if (!snValidPhone(phone)) return toast("📱 اكتب رقم موبايل مصري صح (01xxxxxxxxx)");
  snRemember(phone);
  // من غير أي نص: الصور بس هي اللي هتتبعت
  window.open(`https://wa.me/20${phone.slice(1)}`, "_blank", "noopener");
});

$("#snShare").addEventListener("click", async () => {
  const btn = $("#snShare");
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.textContent = "⏳ بجهّز الصور...";
  try {
    const files = await snFiles();
    if (!files.length) return toast("❌ مالقيتش صور للمنتجات دي");
    if (!(navigator.canShare && navigator.canShare({ files }))) {
      return toast("📸 المشاركة بالصور بتشتغل من الموبايل بس. افتح اللوحة من موبايلك، أو دوس «نزّل الصور»");
    }
    await navigator.share({ files });
    toast(`✅ اتجهّزت ${num(files.length)} صور للإرسال`);
  } catch (e) {
    if (e?.name !== "AbortError") toast("❌ الصور مااتبعتتش، جرّب «نزّل الصور» وابعتها يدوي");
  } finally {
    btn.innerHTML = label;
    snUpdateCount();
  }
});

$("#snDownload").addEventListener("click", async () => {
  const files = await snFiles();
  if (!files.length) return toast("❌ مالقيتش صور للمنتجات دي");
  files.forEach((f, k) => setTimeout(() => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, k * 350));
  toast(`⬇ بنزّل ${num(files.length)} صور`);
});

$("#snRecent").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sn-num]");
  if (b) $("#snPhone").value = b.dataset.snNum;
});

$(".sendnew__quick").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sn-last]");
  if (!b) return;
  snTouched = true;
  snSetLast(+b.dataset.snLast);
  snRenderList();
});

$("#snList").addEventListener("change", (e) => {
  const c = e.target.closest("[data-sn-id]");
  if (!c) return;
  snTouched = true;
  const id = +c.dataset.snId;
  c.checked ? snSelected.add(id) : snSelected.delete(id);
  c.closest(".sendnew__item").classList.toggle("is-on", c.checked);
  snUpdateCount();
});

$("#snAllImgs").addEventListener("change", snUpdateCount);

document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "sendnew") return;
  snRenderRecent();
  snRenderList();
  if (!navigator.share) $("#snNote").textContent = "على الكمبيوتر: دوس «نزّل الصور» وابعتها من واتساب ويب. المشاركة المباشرة بالصور بتشتغل من الموبايل.";
});
document.addEventListener("adminproducts", () => {
  if (!$("#sendnewSection").hidden) snRenderList();
});
