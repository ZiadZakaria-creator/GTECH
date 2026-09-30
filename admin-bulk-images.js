// ============ رفع صور لكذا منتج مرة واحدة ============
// بتختار (أو تسحب) صور كتير، وكل صورة بتتربط بالمنتج بتاعها من اسم الملف:
//   13.jpg / 13-2.jpg / 13 (3).png  ← المنتج رقم 13
//   logitech-g102-white.jpg         ← المنتج اللي اسمه أو ماركته فيها نفس الكلمات
// وبعدين تراجع وتحفظ كله بضغطة واحدة.

const MAX_PRODUCT_IMAGES = 6;
let bulkItems = []; // [{ file, url, pid }]

// "1.jpg" قبل "1-2.jpg" عشان أول صورة تبقى الرئيسية
const stem = (name) => name.replace(/\.[^.]+$/, "");
const naturalSort = (a, b) => stem(a).localeCompare(stem(b), undefined, { numeric: true, sensitivity: "base" });
const words = (s) => toLatinDigits(String(s).toLowerCase())
  .replace(/\.[a-z0-9]+$/, "")
  .split(/[^a-z0-9؀-ۿ]+/)
  .filter((w) => w.length >= 2);

function guessProduct(fileName, list) {
  const base = toLatinDigits(fileName.trim());
  const byId = base.match(/^#?(\d+)(?=$|[\s._\-(])/);
  if (byId) {
    const p = list.find((x) => x.id === Number(byId[1]));
    if (p) return p.id;
  }
  const fw = words(base).filter((w) => !/^\d{1,2}$/.test(w)); // "-1", "-2" مش كلمات مميزة
  if (!fw.length) return null;
  let best = null, bestScore = 0, tie = false;
  list.forEach((p) => {
    const pw = new Set(words(`${p.name} ${p.brand} ${Object.values(p.specs || {}).join(" ")}`));
    // الكلمات اللي فيها أرقام (زي g102 أو s26) أقوى من الكلام العادي
    const score = fw.reduce((s, w) => s + (pw.has(w) ? (/\d/.test(w) ? 3 : 1) : 0), 0);
    if (score > bestScore) { best = p; bestScore = score; tie = false; }
    else if (score && score === bestScore) tie = true;
  });
  return best && !tie && bestScore >= 2 ? best.id : null;
}

function openBulk(files) {
  if (!productsLoaded || !adminProducts.length) return toast("استنى لحد ما المنتجات تتحمّل (أو استوردها الأول)");
  const imgs = [...files].filter((f) => f.type.startsWith("image/")).sort((a, b) => naturalSort(a.name, b.name));
  if (!imgs.length) return toast("اختار صور (JPG أو PNG)");
  bulkItems.forEach((i) => URL.revokeObjectURL(i.url));
  bulkItems = imgs.map((file) => ({ file, url: URL.createObjectURL(file), pid: guessProduct(file.name, adminProducts) }));
  $("#bulkReplace").checked = false;
  renderBulk();
  $("#bulkImgModal").hidden = false;
}

function bulkPlan() {
  const replace = $("#bulkReplace").checked;
  const groups = new Map();
  bulkItems.forEach((it) => {
    if (!it.pid) return;
    if (!groups.has(it.pid)) groups.set(it.pid, []);
    groups.get(it.pid).push(it);
  });
  return [...groups.entries()].map(([pid, items]) => {
    const p = adminProducts.find((x) => x.id === pid);
    const kept = replace ? [] : [...p.images];
    const room = Math.max(0, MAX_PRODUCT_IMAGES - kept.length);
    return { p, kept, add: items.slice(0, room), skipped: items.slice(room) };
  });
}

function renderBulk() {
  const plan = bulkPlan();
  const unmatched = bulkItems.filter((i) => !i.pid).length;
  const skipped = plan.reduce((s, g) => s + g.skipped.length, 0);
  const adding = plan.reduce((s, g) => s + g.add.length, 0);
  $("#bulkSummary").innerHTML = `
    <div class="excel-stats bulk-stats">
      <div class="excel-stat"><b>${num(bulkItems.length)}</b><span>صورة</span></div>
      <div class="excel-stat excel-stat--new"><b>${num(adding)}</b><span>هتترفع</span></div>
      <div class="excel-stat excel-stat--upd"><b>${num(plan.length)}</b><span>منتج</span></div>
      <div class="excel-stat ${unmatched ? "excel-stat--err" : ""}"><b>${num(unmatched)}</b><span>محتاجة تختار منتجها</span></div>
    </div>
    ${skipped ? `<p class="bulk-warn">⚠️ ${num(skipped)} صورة مش هتترفع عشان المنتج وصل لـ ${num(MAX_PRODUCT_IMAGES)} صور (فعّل "امسح الصور القديمة" أو امسح صور من المنتج)</p>` : ""}`;

  const options = adminProducts.map((p) => `<option value="${p.id}">#${p.id} — ${escapeHtml(p.name)}</option>`).join("");
  const skippedSet = new Set(plan.flatMap((g) => g.skipped));
  $("#bulkList").innerHTML = bulkItems.map((it, i) => `
    <div class="bulk-item ${it.pid ? "" : "is-unmatched"} ${skippedSet.has(it) ? "is-skipped" : ""}">
      <img src="${it.url}" alt="" />
      <div>
        <small dir="ltr">${escapeHtml(it.file.name)}</small>
        <select data-bulk="${i}" aria-label="المنتج">
          <option value="">— اختار المنتج (أو سيبها عشان تتجاهل) —</option>
          ${options}
        </select>
      </div>
    </div>`).join("");
  bulkItems.forEach((it, i) => { $(`[data-bulk="${i}"]`).value = it.pid ? String(it.pid) : ""; });
  $("#bulkApply").disabled = !adding;
  $("#bulkApply").textContent = adding ? `حفظ ${num(adding)} صورة` : "حفظ الصور";
}

function closeBulk() {
  $("#bulkImgModal").hidden = true;
  bulkItems.forEach((i) => URL.revokeObjectURL(i.url));
  bulkItems = [];
}

$("#bulkImgFiles").addEventListener("change", (e) => {
  const files = e.target.files;
  openBulk(files);
  e.target.value = "";
});
$("#bulkList").addEventListener("change", (e) => {
  const sel = e.target.closest("[data-bulk]");
  if (!sel) return;
  bulkItems[+sel.dataset.bulk].pid = sel.value ? Number(sel.value) : null;
  renderBulk();
});
$("#bulkReplace").addEventListener("change", renderBulk);
$("#bulkImgModal").addEventListener("click", (e) => {
  if (e.target.id === "bulkImgModal" || e.target.closest("[data-close-bulk]")) closeBulk();
});

// اسحب الصور من الكمبيوتر وارميها على صفحة المنتجات
const productsSection = $("#productsSection");
productsSection.addEventListener("dragover", (e) => {
  if (![...e.dataTransfer.types].includes("Files")) return;
  e.preventDefault();
  productsSection.classList.add("is-dropping");
});
productsSection.addEventListener("dragleave", (e) => {
  if (!productsSection.contains(e.relatedTarget)) productsSection.classList.remove("is-dropping");
});
productsSection.addEventListener("drop", (e) => {
  if (!e.dataTransfer.files.length) return;
  e.preventDefault();
  productsSection.classList.remove("is-dropping");
  if (!$("#editor").classList.contains("open")) openBulk(e.dataTransfer.files);
});

$("#bulkApply").addEventListener("click", async () => {
  const plan = bulkPlan().filter((g) => g.add.length);
  const total = plan.reduce((s, g) => s + g.add.length, 0);
  if (!total) return;
  const btn = $("#bulkApply");
  btn.disabled = true;
  let done = 0, failed = 0, savedProducts = 0;
  const replace = $("#bulkReplace").checked;
  for (const g of plan) {
    const fresh = [];
    for (const it of g.add) {
      btn.textContent = `جاري الرفع ${num(done + 1)} من ${num(total)}...`;
      try {
        const prepared = await compressImage(it.file);
        fresh.push(await productsStore.saveImage(prepared.data, prepared.bg));
      } catch (err) {
        console.warn("bulk image", it.file.name, err);
        failed++;
      }
      done++;
    }
    if (!fresh.length) continue;
    try {
      const current = adminProducts.find((x) => x.id === g.p.id) || g.p;
      const oldImages = current.images || [];
      const images = [...(replace ? [] : oldImages), ...fresh].slice(0, MAX_PRODUCT_IMAGES);
      await productsStore.save({ ...current, images, updatedAt: new Date().toISOString() });
      if (replace) {
        await Promise.all(oldImages.filter((k) => String(k).startsWith("fs:"))
          .map((k) => productsStore.removeImage(k.slice(3)).catch(() => {})));
      }
      savedProducts++;
    } catch (err) {
      console.error(err);
      failed += fresh.length;
    }
  }
  btn.disabled = false;
  closeBulk();
  toast(failed
    ? `⚠️ اترفع ${num(total - failed)} صورة، و ${num(failed)} فشلت — جرّب تاني بيهم`
    : `✅ اترفعت ${num(total)} صورة على ${num(savedProducts)} منتج`);
});
