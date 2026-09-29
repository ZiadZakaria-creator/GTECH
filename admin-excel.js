// ============ استيراد وتصدير المنتجات من Excel ============
// التصدير بيطلّع ملف بكل المنتجات، تعدّل فيه أو تضيف صفوف، وترفعه تاني بزرار الاستيراد.
// - الصف اللي فيه "رقم" موجود ← بيتحدّث (الخانات الفاضية بتفضل زي ما هي)
// - الصف من غير رقم، أو برقم جديد ← منتج جديد
// - الصف اللي اسمه نفس اسم منتج موجود ومن غير رقم ← بيتحدّث المنتج ده

const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
const loadXlsx = async () => window.XLSX || (await loadScript(XLSX_URL), window.XLSX);

// الأعمدة: الاسم في الملف ← الخانة في المنتج (بنقبل العربي والإنجليزي)
const EXCEL_COLUMNS = [
  { key: "id", head: "رقم", alt: ["id", "#", "الرقم"] },
  { key: "name", head: "الاسم", alt: ["name", "اسم المنتج"] },
  { key: "brand", head: "الماركة", alt: ["brand"] },
  { key: "cat", head: "القسم", alt: ["category", "cat"] },
  { key: "price", head: "السعر", alt: ["price"] },
  { key: "old", head: "السعر قبل الخصم", alt: ["old", "old price", "compare price"] },
  { key: "stock", head: "المخزون", alt: ["stock", "الكمية", "qty"] },
  { key: "tag", head: "الشارة", alt: ["tag", "badge"] },
  { key: "active", head: "ظاهر", alt: ["active", "visible", "الحالة"] },
  { key: "desc", head: "الوصف", alt: ["description", "desc"] },
  { key: "highlights", head: "المميزات", alt: ["highlights"] },
  { key: "options", head: "الاختيارات", alt: ["options"] },
  { key: "specs", head: "المواصفات", alt: ["specs"] },
  { key: "images", head: "الصور", alt: ["images", "image"] },
];
const SEP = " | "; // الفاصل بين العناصر في الخانة الواحدة

const catByLabel = Object.fromEntries(Object.entries(categories).map(([k, v]) => [v, k]));
const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());
const toNum = (v) => {
  const s = toLatinDigits(clean(v)).replace(/[,\s٬]/g, "");
  return s === "" ? null : Number(s);
};
const splitCell = (v) => clean(v).split(/\s*[|\n]\s*/).map((x) => x.trim()).filter(Boolean);
const pairs = (v) => splitCell(v).map((l) => {
  const i = l.indexOf(":");
  return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null;
}).filter((x) => x && x[1]);

// ============ التصدير ============
function productToRow(p) {
  return {
    "رقم": p.id,
    "الاسم": p.name,
    "الماركة": p.brand,
    "القسم": categories[p.cat] || p.cat,
    "السعر": p.price,
    "السعر قبل الخصم": p.old || "",
    "المخزون": p.stock,
    "الشارة": p.tag || "",
    "ظاهر": p.active ? "نعم" : "لا",
    "الوصف": p.desc,
    "المميزات": p.highlights.join(SEP),
    "الاختيارات": Object.entries(p.options).map(([k, v]) => `${k}: ${v.join("، ")}`).join(SEP),
    "المواصفات": Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(SEP),
    // الصور المرفوعة من اللوحة بتفضل زي ما هي (بتتكتب fs:...)، وتقدر تحط روابط صور هنا
    "الصور": p.images.join(SEP),
  };
}

$("#excelExportBtn").addEventListener("click", async () => {
  const btn = $("#excelExportBtn");
  btn.disabled = true;
  try {
    const XLSX = await loadXlsx();
    const list = adminProducts.length ? adminProducts : DEFAULT_PRODUCTS.map(normalizeProduct);
    const sheet = XLSX.utils.json_to_sheet(list.map(productToRow), { header: EXCEL_COLUMNS.map((c) => c.head) });
    sheet["!cols"] = EXCEL_COLUMNS.map((c) => ({ wch: ["desc", "specs", "options", "highlights", "images"].includes(c.key) ? 50 : c.key === "name" ? 36 : 14 }));
    const help = XLSX.utils.aoa_to_sheet([
      ["طريقة الاستخدام"],
      ["• عدّل أي خانة في شيت المنتجات، أو ضيف صف جديد لمنتج جديد (سيب خانة الرقم فاضية)."],
      ["• الخانات الفاضية في منتج موجود بتفضل زي ما هي."],
      ["• القسم: " + Object.values(categories).join("، ")],
      ["• ظاهر: نعم أو لا"],
      ["• المميزات والصور: افصل بين كل عنصر بـ |"],
      ["• الاختيارات: اللون: أسود، أبيض | السعة: 128، 256"],
      ["• المواصفات: الشاشة: 6.7 بوصة | المعالج: A19"],
      ["• الصور: روابط صور (https://...). الصور المرفوعة من اللوحة بتظهر كده fs:... سيبها زي ما هي."],
    ]);
    help["!cols"] = [{ wch: 90 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, sheet, "المنتجات");
    XLSX.utils.book_append_sheet(wb, help, "تعليمات");
    XLSX.writeFile(wb, `gtech-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(`⬇ اتصدّر ${num(list.length)} منتج`);
  } catch (err) {
    console.error(err);
    toast("❌ مقدرناش نحمّل مكتبة Excel، اتأكد من الإنترنت");
  } finally {
    btn.disabled = false;
  }
});

// ============ الاستيراد ============
let pendingImport = null;

function readRow(raw) {
  // بنطابق أسماء الأعمدة حتى لو فيها مسافات أو حروف كبيرة/صغيرة
  const norm = Object.fromEntries(Object.entries(raw).map(([k, v]) => [clean(k).toLowerCase(), v]));
  const row = {};
  EXCEL_COLUMNS.forEach((c) => {
    const hit = [c.head, ...c.alt].map((h) => h.toLowerCase()).find((h) => h in norm);
    row[c.key] = hit ? norm[hit] : undefined;
  });
  return row;
}

function buildFromRow(row, existing, nextId) {
  const errors = [];
  const has = (k) => clean(row[k]) !== "";
  const p = existing ? JSON.parse(JSON.stringify(existing)) : { id: nextId, rating: 5, reviews: 0, images: [], active: true, stock: 0 };

  if (has("name")) p.name = clean(row.name);
  if (has("brand")) p.brand = clean(row.brand).toUpperCase();
  if (has("cat")) {
    const c = clean(row.cat);
    const key = categories[c] ? c : catByLabel[c];
    if (!key) errors.push(`القسم "${c}" مش معروف`);
    else if (key !== p.cat) {
      p.cat = key;
      delete p.icon; delete p.tint; // يتحسبوا من القسم الجديد
    }
  }
  if (has("price")) p.price = toNum(row.price);
  if (has("old")) p.old = toNum(row.old) || null;
  if (has("stock")) p.stock = toNum(row.stock);
  if (has("tag")) p.tag = clean(row.tag);
  if (has("active")) p.active = !/^(لا|no|false|0|مخفي|hidden)$/i.test(clean(row.active));
  if (has("desc")) p.desc = clean(row.desc);
  if (has("highlights")) p.highlights = splitCell(row.highlights);
  if (has("options")) p.options = Object.fromEntries(pairs(row.options).map(([k, v]) => [k, v.split(/\s*[،,]\s*/).filter(Boolean)]));
  if (has("specs")) p.specs = Object.fromEntries(pairs(row.specs));
  if (has("images")) p.images = splitCell(row.images);

  if (!p.name || p.name.length < 2) errors.push("الاسم ناقص");
  if (!p.cat && !has("cat")) errors.push("القسم ناقص");
  if (!(Number.isInteger(p.price) && p.price > 0 && p.price <= MAX_PRICE)) errors.push("السعر لازم يكون رقم صحيح بين 1 و 100 مليون");
  if (p.old !== null && p.old !== undefined && !(Number.isInteger(p.old) && p.old > p.price && p.old <= MAX_PRICE)) errors.push("السعر قبل الخصم لازم يكون أكبر من السعر وأقل من 100 مليون");
  if (!(Number.isInteger(p.stock) && p.stock >= 0 && p.stock <= MAX_STOCK)) errors.push("المخزون لازم يكون من صفر لـ مليون");
  const badImg = (p.images || []).find((s) => !/^(https?:\/\/|images\/|fs:)/.test(s));
  if (badImg) errors.push(`رابط صورة مش صحيح: ${badImg.slice(0, 40)}`);
  return { product: p, errors };
}

$("#excelFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!productsLoaded) return toast("استنى لحد ما المنتجات تتحمّل");
  try {
    const XLSX = await loadXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = wb.SheetNames.includes("المنتجات") ? "المنتجات" : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    if (!rows.length) return toast("الملف فاضي");
    if (rows.every((r) => readRow(r).name === undefined)) {
      return toast('❌ مش لاقي عمود "الاسم" — نزّل الملف من زرار التصدير واشتغل عليه');
    }

    const byId = new Map(adminProducts.map((p) => [p.id, p]));
    const byName = new Map(adminProducts.map((p) => [p.name.trim(), p]));
    let nextId = Math.max(0, ...adminProducts.map((p) => p.id), ...DEFAULT_PRODUCTS.map((p) => p.id)) + 1;
    const result = { created: [], updated: [], unchanged: 0, errors: [] };
    const seen = new Set();

    rows.forEach((raw, i) => {
      const row = readRow(raw);
      if (EXCEL_COLUMNS.every((c) => clean(row[c.key]) === "")) return; // صف فاضي
      const line = i + 2; // رقم الصف في Excel (الصف 1 هو العناوين)
      const id = toNum(row.id);
      const existing = id ? byId.get(id) : byName.get(clean(row.name));
      const { product, errors } = buildFromRow(row, existing, id && !existing ? id : nextId);
      if (seen.has(product.id)) errors.push(`الرقم ${product.id} متكرر في الملف`);
      if (errors.length) return result.errors.push({ line, name: clean(row.name) || "—", errors });
      seen.add(product.id);
      if (!existing) {
        if (product.id >= nextId) nextId = product.id + 1;
        result.created.push(product);
      } else if (JSON.stringify(normalizeProduct(product)) !== JSON.stringify(normalizeProduct(existing))) {
        result.updated.push(product);
      } else {
        result.unchanged++;
      }
    });

    pendingImport = result;
    showExcelSummary(result, file.name);
  } catch (err) {
    console.error(err);
    toast("❌ مقدرناش نقرا الملف — اتأكد إنه Excel (xlsx) أو CSV");
  }
});

function showExcelSummary(r, fileName) {
  const list = (items) => items.slice(0, 8).map((p) => `<li>${escapeHtml(p.name)} <small>· ${fmt(p.price)} · مخزون ${num(p.stock)}</small></li>`).join("")
    + (items.length > 8 ? `<li class="muted">و ${num(items.length - 8)} كمان...</li>` : "");
  $("#excelSummary").innerHTML = `
    <p class="muted">${escapeHtml(fileName)}</p>
    <div class="excel-stats">
      <div class="excel-stat excel-stat--new"><b>${num(r.created.length)}</b><span>منتج جديد</span></div>
      <div class="excel-stat excel-stat--upd"><b>${num(r.updated.length)}</b><span>هيتحدّث</span></div>
      <div class="excel-stat"><b>${num(r.unchanged)}</b><span>من غير تغيير</span></div>
      <div class="excel-stat excel-stat--err"><b>${num(r.errors.length)}</b><span>فيه مشكلة</span></div>
    </div>
    ${r.created.length ? `<h4>➕ منتجات جديدة</h4><ul class="excel-list">${list(r.created)}</ul>` : ""}
    ${r.updated.length ? `<h4>✏️ هيتحدّث</h4><ul class="excel-list">${list(r.updated)}</ul>` : ""}
    ${r.errors.length ? `<h4>⚠️ صفوف مش هتتحفظ</h4><ul class="excel-list excel-list--err">${r.errors.slice(0, 10).map((e) =>
      `<li><b>صف ${num(e.line)}</b> (${escapeHtml(e.name)}): ${e.errors.map(escapeHtml).join("، ")}</li>`).join("")}</ul>` : ""}`;
  const count = r.created.length + r.updated.length;
  $("#excelApply").disabled = !count;
  $("#excelApply").textContent = count ? `حفظ ${num(count)} منتج` : "مفيش حاجة تتحفظ";
  $("#excelModal").hidden = false;
}

function closeExcel() {
  $("#excelModal").hidden = true;
  pendingImport = null;
}
$("#excelModal").addEventListener("click", (e) => {
  if (e.target.id === "excelModal" || e.target.closest("[data-close-excel]")) closeExcel();
});

$("#excelApply").addEventListener("click", async () => {
  if (!pendingImport) return;
  const btn = $("#excelApply");
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";
  const now = new Date().toISOString();
  const list = [...pendingImport.created, ...pendingImport.updated].map((p) => ({ ...normalizeProduct(p), updatedAt: now }));
  try {
    await productsStore.importAll(list);
    toast(`✅ اتحفظ ${num(list.length)} منتج (${num(pendingImport.created.length)} جديد، ${num(pendingImport.updated.length)} متحدّث)`);
    closeExcel();
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ الحفظ فشل، جرّب تاني");
    btn.disabled = false;
    btn.textContent = "حفظ في قاعدة البيانات";
  }
});
