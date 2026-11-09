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

// البحث بالاسم أو رقم المنتج (عشان تلاقي منتج معين بسرعة لعميل سأل عليه)
const snQuery = () => ($("#snSearch")?.value || "").trim().toLowerCase().replace(/^#/, "");
function snMatches(p, q) {
  if (!q) return true;
  if (String(p.id) === q) return true;
  const hay = `${p.name || ""} ${p.brand || ""}`.toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function snRenderList() {
  const all = snProducts();
  if (!snTouched && !snSelected.size) snSetLast(3);
  const q = snQuery();
  const list = all.filter((p) => snMatches(p, q));
  if (q && !list.length) {
    $("#snList").innerHTML = `<div class="dash-empty"><span>🔎</span><p>مفيش منتج بالاسم ده</p></div>`;
    snUpdateCount();
    return;
  }
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

const snMode = () => ($("input[name=snMode]:checked") || {}).value || "card";

function snPicked() {
  const sel = snProducts().filter((p) => snSelected.has(p.id));
  if (snMode() === "card") return sel.map((p) => ({ p, card: true }));
  const all = $("#snAllImgs").checked;
  return sel.flatMap((p) => (all ? p.images || [] : (p.images || []).slice(0, 1)).map((src, i) => ({ p, src, i })));
}

// تصميم المنتج (renderPromoCard في admin-promo-card.js) بيتعمل مرة واحدة لكل نسخة من المنتج
const snCardCache = new Map();
function snCard(p) {
  const key = JSON.stringify([p.id, p.name, p.price, p.old, p.warranty, (p.images || [])[0], p.highlights]);
  if (!snCardCache.has(key)) {
    const job = renderPromoCard(p);
    snCardCache.set(key, job);
    job.catch(() => snCardCache.delete(key));
  }
  return snCardCache.get(key);
}

function snUpdateCount() {
  const n = snPicked().length;
  $("#snCount").textContent = n ? `(${num(n)})` : "";
  $("#snShare").disabled = !n;
  $("#snDownload").disabled = !n;
  // الاختيار اتغير: الصورة المجمّعة الجاهزة مابقتش مطابقة
  if (typeof snCollageReady !== "undefined" && snCollageReady) {
    snCollageReady = null;
    $("#snCollage").textContent = "📋 صورة مجمّعة: انسخ وافتح الشات";
  }
}

// بيحوّل الصور لملفات JPG عشان قايمة المشاركة وواتساب يقبلوها
async function snFiles() {
  const out = [];
  for (const { p, src, i, card } of snPicked()) {
    try {
      if (card) {
        const blob = await snCard(p);
        if (blob) out.push(new File([blob], `GTECH-MASR-${p.id}.jpg`, { type: "image/jpeg" }));
        continue;
      }
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

// رسالة بتفاصيل المنتجات المختارة: الاسم والسعر والمميزات (DPI، الأوضاع…) والضمان واللينك
const SN_TEXT_MAX = 3;
const snPriceTxt = (n) => `${Number(n).toLocaleString("en-US")} ج.م`;
function snDetailsText(list) {
  const one = (p) => {
    const lines = [`*${p.name}*`];
    lines.push(`💰 ${snPriceTxt(p.price)}${p.old > p.price ? ` بدل ${snPriceTxt(p.old)}` : ""}`);
    (p.highlights || []).slice(0, 5).forEach((h) => lines.push(`• ${h}`));
    if (hasWarranty(p)) lines.push(`🛡 ضمان ${warrantyText(p)}`);
    lines.push(`🔗 ${siteUrl(`p/${p.id}.html`)}`);
    return lines.join("\n");
  };
  return `أهلاً 👋 معاك GTECH MASR\n\n${list.map(one).join("\n\n")}\n\n💵 الدفع عند الاستلام · 🚚 التوصيل القاهرة والجيزة`;
}

$("#snOpen").addEventListener("click", () => {
  const phone = normalizePhone($("#snPhone").value);
  if (!snValidPhone(phone)) return toast("📱 اكتب رقم موبايل مصري صح (01xxxxxxxxx)");
  snRemember(phone);
  const sel = snProducts().filter((p) => snSelected.has(p.id));
  const withText = $("#snWithText").checked && sel.length;
  if (withText && sel.length > SN_TEXT_MAX) toast(`💬 الرسالة فيها تفاصيل أول ${num(SN_TEXT_MAX)} منتجات بس عشان ماتطولش`);
  // مع رسالة التفاصيل (لو متعلّم عليها) أو من غير نص خالص والصور بس هي اللي هتتبعت
  const text = withText ? `?text=${encodeURIComponent(snDetailsText(sel.slice(0, SN_TEXT_MAX)))}` : "";
  window.open(`https://wa.me/20${phone.slice(1)}${text}`, "_blank", "noopener");
});

$("#snSearch").addEventListener("input", () => {
  // أول ما تدوّر على منتج معين: نلغي الاختيار الافتراضي (آخر 3) عشان مايتبعتش معاه منتجات تانية
  if (!snTouched) { snTouched = true; snSelected = new Set(); }
  snRenderList();
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
$$("input[name=snMode]").forEach((r) => r.addEventListener("change", () => {
  const card = snMode() === "card";
  $("#snAllWrap").hidden = card;
  $("#snPreviewBtn").hidden = !card;
  if (!card) $("#snPreview").hidden = true;
  snUpdateCount();
}));

$("#snPreviewBtn").addEventListener("click", async () => {
  const sel = snProducts().filter((p) => snSelected.has(p.id));
  if (!sel.length) return toast("اختار منتج واحد على الأقل");
  const box = $("#snPreview");
  box.hidden = false;
  box.innerHTML = `<p class="muted">⏳ بجهّز التصميمات...</p>`;
  const urls = [];
  for (const p of sel) {
    try { const b = await snCard(p); if (b) urls.push([p, URL.createObjectURL(b)]); } catch {}
  }
  box.innerHTML = urls.map(([p, u]) => `<a href="${u}" target="_blank" rel="noopener" title="${escapeHtml(p.name)}"><img src="${u}" alt="${escapeHtml(p.name)}" /></a>`).join("")
    || `<p class="muted">مقدرتش أجهّز التصميم</p>`;
});

document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "sendnew") return;
  snRenderRecent();
  snRenderList();
  if (!navigator.share) $("#snNote").textContent = "على الكمبيوتر: دوس «نزّل الصور» وابعتها من واتساب ويب. المشاركة المباشرة بالصور بتشتغل من الموبايل.";
});
document.addEventListener("adminproducts", () => {
  if (!$("#sendnewSection").hidden) snRenderList();
});

// ============ صورة مجمّعة: كل المنتجات المختارة في صورة واحدة ============
// المتصفح بيسمح بنسخ صورة واحدة بس، فبنجمع المنتجات في صورة، ننسخها، ونفتح شات الرقم على طول،
// والأدمن يعمل لصق في الشات.
const SN_COLLAGE_MAX = 8;

async function snRenderCollage(list) {
  await Promise.all(["900 64px Cairo", "800 30px Cairo", "700 26px Cairo"].map((f) => document.fonts.load(f).catch(() => {})));
  const W = 1080, cols = list.length === 1 ? 1 : 2, rows = Math.ceil(list.length / cols);
  const tileW = cols === 1 ? 760 : 470, tileH = cols === 1 ? 760 : 560, gap = 30;
  const top = 250, foot = 190;
  const H = top + rows * tileH + (rows - 1) * gap + foot;
  const c = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#03050b";
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(3,5,11,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(540, 120, 620, "rgba(10,132,255,.35)");
  glow(0, H, 600, "rgba(124,92,255,.28)");

  // اللوجو والعنوان
  ctx.save();
  ctx.direction = "ltr";
  const lg = ctx.createLinearGradient(382, 40, 444, 102);
  lg.addColorStop(0, "#00d4ff");
  lg.addColorStop(1, "#0a84ff");
  ctx.fillStyle = lg;
  roundRect(ctx, 382, 40, 62, 62, 17);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 42px Cairo";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", 413, 73);
  ctx.textAlign = "left";
  ctx.font = "900 50px Cairo";
  ctx.fillText("TECH", 456, 73);
  ctx.fillStyle = "#0a84ff";
  ctx.font = "800 20px Cairo";
  ctx.fillText("MASR", 600, 90);
  ctx.restore();
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2f6ff";
  ctx.font = "900 60px Cairo";
  ctx.fillText("✨ وصل جديد", W / 2, 190);

  // المنتجات
  const imgs = await Promise.all(list.map(async (p) => loadImg(await cardImageSrc(p))));
  const x0 = (W - (cols * tileW + (cols - 1) * gap)) / 2;
  list.forEach((p, k) => {
    // الترتيب من اليمين للشمال
    const col = cols - 1 - (k % cols), row = Math.floor(k / cols);
    const x = x0 + col * (tileW + gap), y = top + row * (tileH + gap);
    ctx.save();
    ctx.fillStyle = "rgba(14,22,44,.95)";
    roundRect(ctx, x, y, tileW, tileH, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,132,255,.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const ih = tileH - 200, pad = 18;
    ctx.fillStyle = "#fff";
    roundRect(ctx, x + pad, y + pad, tileW - pad * 2, ih, 22);
    ctx.fill();
    const im = imgs[k];
    if (im) {
      const bw = tileW - pad * 2 - 30, bh = ih - 30;
      const s = Math.min(bw / im.width, bh / im.height);
      ctx.drawImage(im, x + (tileW - im.width * s) / 2, y + pad + (ih - im.height * s) / 2, im.width * s, im.height * s);
    }
    ctx.fillStyle = "#e8eefc";
    ctx.font = "800 27px Cairo";
    ctx.textAlign = "right";
    wrapLines(ctx, p.name, tileW - 40, 2).forEach((l, i) => ctx.fillText(l, x + tileW - 20, y + ih + 62 + i * 38));
    // السعر
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = "#00d4ff";
    ctx.font = "900 46px Cairo";
    const pt = fmtNum(p.price);
    ctx.fillText(pt, x + 22, y + tileH - 26);
    const pw = ctx.measureText(pt).width;
    ctx.font = "800 24px Cairo";
    ctx.fillText("ج.م", x + 30 + pw, y + tileH - 28);
    if (p.old > p.price) {
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "700 24px Cairo";
      const ox = x + 30 + pw + ctx.measureText("ج.م").width + 16, ot = fmtNum(p.old);
      ctx.fillText(ot, ox, y + tileH - 28);
      ctx.fillRect(ox, y + tileH - 37, ctx.measureText(ot).width, 2);
    }
    ctx.direction = "rtl";
  });

  // الفوتر
  ctx.textAlign = "center";
  ctx.fillStyle = "#7dffb8";
  ctx.font = "700 28px Cairo";
  ctx.fillText("💵 الدفع عند الاستلام  ·  🚚 توصيل القاهرة والجيزة", W / 2, H - 120);
  ctx.fillStyle = "rgba(10,16,34,.92)";
  ctx.fillRect(0, H - 86, W, 86);
  ctx.fillStyle = "#0a84ff";
  ctx.fillRect(0, H - 86, W, 4);
  ctx.fillStyle = "#e8eefc";
  ctx.font = "800 30px Cairo";
  ctx.textAlign = "right";
  ctx.fillText("🛒 اطلب من: gtechmasr.com", W - 40, H - 30);
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(`💬 ${WHATSAPP.replace(/^20/, "0")}`, 40, H - 30);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

let snCollageReady = null; // { key, blob } جاهزة للنسخ (النسخ لازم يحصل وقت الضغطة)
$("#snCollage").addEventListener("click", async () => {
  const btn = $("#snCollage");
  const phone = normalizePhone($("#snPhone").value);
  if (!snValidPhone(phone)) return toast("📱 اكتب رقم موبايل مصري صح (01xxxxxxxxx)");
  const sel = snProducts().filter((p) => snSelected.has(p.id));
  if (!sel.length) return toast("اختار منتج واحد على الأقل");
  const list = sel.slice(0, SN_COLLAGE_MAX);
  const key = JSON.stringify(list.map((p) => [p.id, p.price, p.old, (p.images || [])[0]]));
  // أول ضغطة: نجهّز الصورة (بتاخد ثواني)، والضغطة التانية: ننسخ ونفتح الشات
  if (!snCollageReady || snCollageReady.key !== key) {
    btn.disabled = true;
    btn.textContent = "⏳ بجهّز الصورة...";
    try {
      const blob = await snRenderCollage(list);
      snCollageReady = { key, blob };
      btn.textContent = "✅ جاهزة: دوس تاني عشان تنسخ وتفتح الشات";
      if (sel.length > SN_COLLAGE_MAX) toast(`الصورة المجمّعة فيها أول ${num(SN_COLLAGE_MAX)} منتجات بس`);
    } catch {
      btn.textContent = "📋 صورة مجمّعة: انسخ وافتح الشات";
      toast("❌ مقدرتش أجهّز الصورة");
    } finally {
      btn.disabled = false;
    }
    return;
  }
  snRemember(phone);
  let copied = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": snCollageReady.blob })]);
    copied = true;
  } catch {}
  if (copied) {
    toast("📋 الصورة اتنسخت: في الشات دوس مطوّلاً واختار لصق");
    window.open(`https://wa.me/20${phone.slice(1)}`, "_blank", "noopener");
  } else {
    // الموبايل مش بيسمح بالنسخ: نبعتها بقايمة المشاركة أو ننزّلها
    const f = new File([snCollageReady.blob], "GTECH-MASR-new.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f] }); } catch {}
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      toast("⬇ الموبايل مش بيسمح بالنسخ، فنزّلت الصورة");
    }
  }
  btn.textContent = "📋 صورة مجمّعة: انسخ وافتح الشات";
  snCollageReady = null;
});

// ===== SMS من شريحة الموبايل: نص بس (أسماء وأسعار ولينكات)، لأن الـ SMS مابيشيلش صور =====
const SN_SMS_MAX = 5;
const snShort = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
function snSmsText(list) {
  const lines = list.map((p) => `- ${snShort(p.name, 40)}: ${fmtNum(p.price)} ج\ngtechmasr.com/p/${p.id}.html`);
  return `وصل جديد في GTECH MASR\n${lines.join("\n")}\nالدفع عند الاستلام - توصيل القاهرة والجيزة`;
}
// الرسالة العربي: 70 حرف لو رسالة واحدة، و67 لكل جزء لو اتقسمت
const snSmsParts = (t) => (t.length <= 70 ? 1 : Math.ceil(t.length / 67));

$("#snSms").addEventListener("click", () => {
  const phone = normalizePhone($("#snPhone").value);
  if (!snValidPhone(phone)) return toast("📱 اكتب رقم موبايل مصري صح (01xxxxxxxxx)");
  const sel = snProducts().filter((p) => snSelected.has(p.id));
  if (!sel.length) return toast("اختار منتج واحد على الأقل");
  const list = sel.slice(0, SN_SMS_MAX);
  const text = snSmsText(list);
  const parts = snSmsParts(text);
  const extra = sel.length > SN_SMS_MAX ? `\n(أول ${num(SN_SMS_MAX)} منتجات بس عشان الرسالة ماتطولش)` : "";
  if (parts > 6 && !confirm(`الرسالة هتتحسب ${num(parts)} رسايل من رصيدك.${extra}\nتكمّل؟`)) return;
  if (parts <= 6) toast(`💬 الرسالة = ${num(parts)} ${parts === 1 ? "رسالة" : "رسايل"} من رصيدك${extra ? " · " + extra.trim() : ""}`);
  snRemember(phone);
  // أندرويد بيقرا ?body= والآيفون بيقرا &body=
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "&" : "?";
  location.href = `sms:+20${phone.slice(1)}${sep}body=${encodeURIComponent(text)}`;
});
