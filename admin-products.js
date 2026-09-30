// ============ لوحة التحكم: المنتجات ============
// الكتابة بتتم من هنا (الأدمن بس)، والمتجر بيقرا عن طريق catalog.js

// ============ التخزين ============
const productsStore = USE_FIREBASE
  ? {
      async db() {
        await loadFirebase(["auth", "firestore"]);
        return firebase.firestore();
      },
      watch(onData, onError) {
        let stop = () => {};
        this.db().then((db) => {
          stop = db.collection("products").onSnapshot((snap) => onData(snap.docs.map((d) => d.data())), onError);
        }, onError);
        return () => stop();
      },
      async save(p) { await (await this.db()).collection("products").doc(String(p.id)).set(p); },
      async remove(id) { await (await this.db()).collection("products").doc(String(id)).delete(); },
      async setActive(id, active) { await (await this.db()).collection("products").doc(String(id)).update({ active, updatedAt: new Date().toISOString() }); },
      async saveImage(data, bg = null) {
        const col = (await this.db()).collection("productImages");
        const id = col.doc().id;
        const ref = col.doc(bg ? `cfit-${bg}-${id}` : id);
        await ref.set({ data, createdAt: new Date().toISOString() });
        return "fs:" + ref.id;
      },
      async removeImage(key) { await (await this.db()).collection("productImages").doc(key).delete(); },
      async importAll(list) {
        const db = await this.db();
        for (let i = 0; i < list.length; i += 400) {
          const batch = db.batch();
          list.slice(i, i + 400).forEach((p) => batch.set(db.collection("products").doc(String(p.id)), p));
          await batch.commit();
        }
      },
      async adjustStock(changes) {
        const db = await this.db();
        const inc = firebase.firestore.FieldValue.increment;
        await Promise.all(changes.map(({ id, delta }) =>
          db.collection("products").doc(String(id)).update({ stock: inc(delta) }).catch(() => {})));
      },
    }
  : {
      // الوضع التجريبي: كل حاجة في المتصفح
      read: () => store.get(LOCAL_PRODUCTS, []),
      write(list) {
        store.set(LOCAL_PRODUCTS, list);
        document.dispatchEvent(new Event("localproducts"));
      },
      watch(onData) {
        const emit = () => onData(this.read());
        document.addEventListener("localproducts", emit);
        emit();
        return () => document.removeEventListener("localproducts", emit);
      },
      async save(p) { this.write([...this.read().filter((x) => x.id !== p.id), p]); },
      async remove(id) { this.write(this.read().filter((x) => x.id !== id)); },
      async setActive(id, active) { this.write(this.read().map((x) => (x.id === id ? { ...x, active } : x))); },
      async saveImage(data, bg = null) {
        const key = (bg ? `cfit-${bg}-` : "") + "img" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const imgs = store.get(LOCAL_IMAGES, {});
        imgs[key] = data;
        store.set(LOCAL_IMAGES, imgs);
        return "fs:" + key;
      },
      async removeImage(key) {
        const imgs = store.get(LOCAL_IMAGES, {});
        delete imgs[key];
        store.set(LOCAL_IMAGES, imgs);
      },
      async importAll(list) {
        const byId = new Map(this.read().map((p) => [p.id, p]));
        list.forEach((p) => byId.set(p.id, p));
        this.write([...byId.values()]);
      },
      async adjustStock(changes) {
        this.write(this.read().map((p) => {
          const c = changes.find((x) => x.id === p.id);
          return c ? { ...p, stock: Math.max(0, (p.stock || 0) + c.delta) } : p;
        }));
      },
    };

// حدود منطقية للأرقام (عشان الأخطاء في الكتابة زي أصفار زيادة)
const MAX_PRICE = 100000000;
const MAX_STOCK = 1000000;

// ============ الحالة ============
let adminProducts = [];
let productsLoaded = false;
let editing = null;      // المنتج اللي بيتعدّل (null = جديد)
let edImages = [];       // الصور في المحرر: نص (صورة محفوظة) أو { data } (صورة جديدة لسه هتترفع)
let removedImages = [];  // صور محفوظة اتشالت وهتتمسح بعد الحفظ

const catOptions = Object.entries(categories).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("#prodCat").insertAdjacentHTML("beforeend", catOptions);
$("#peCat").innerHTML = `<option value="">اختار القسم</option>${catOptions}`;
$("#defaultCount").textContent = num(DEFAULT_PRODUCTS.length);

// ============ الأقسام (طلبات / منتجات) ============
let productsWatching = false;
function showSection(name) {
  $$(".ad-sec").forEach((b) => b.classList.toggle("active", b.dataset.section === name));
  $$(".ad-section").forEach((sec) => { sec.hidden = sec.id !== name + "Section"; });
  history.replaceState(null, "", location.pathname + (name === "orders" ? "" : "#" + name));
  if (name === "products") watchProducts();
  document.dispatchEvent(new CustomEvent("sectionchange", { detail: name }));
}
function watchProducts() {
  if (productsWatching) return;
  productsWatching = true;
  productsStore.watch(onProducts, (err) => {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مشكلة في تحميل المنتجات");
  });
}
$("#adSections").addEventListener("click", (e) => {
  const b = e.target.closest("[data-section]");
  if (b) showSection(b.dataset.section);
});
if (["#products", "#carts", "#visits"].includes(location.hash)) {
  // نستنى لحد ما الأدمن يدخل
  const section = location.hash.slice(1);
  const wait = setInterval(() => {
    if (!$("#dashboard").hidden) { clearInterval(wait); showSection(section); }
  }, 200);
}

function onProducts(list) {
  adminProducts = list.map(normalizeProduct).sort((a, b) => a.id - b.id);
  productsLoaded = true;
  renderProductsTable();
  document.dispatchEvent(new Event("adminproducts"));
  if (editing) {
    const fresh = adminProducts.find((p) => p.id === editing.id);
    if (!fresh) closeEditor();
  }
}

// ============ جدول المنتجات ============
function stockBadge(p) {
  if (p.stock <= 0) return `<span class="stock-badge stock-badge--out">نفد</span>`;
  if (p.stock <= 5) return `<span class="stock-badge stock-badge--low">${num(p.stock)}</span>`;
  return `<span class="stock-badge">${num(p.stock)}</span>`;
}

function renderProductsTable() {
  $("#importNote").hidden = !productsLoaded || adminProducts.length > 0;
  const q = toLatinDigits($("#prodSearch").value.trim().toLowerCase());
  const cat = $("#prodCat").value;
  const state = $("#prodState").value;
  const list = adminProducts.filter((p) =>
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) &&
    (cat === "all" || p.cat === cat) &&
    (state === "all" || (state === "active" && p.active) || (state === "hidden" && !p.active) ||
      (state === "low" && p.stock > 0 && p.stock <= 5) || (state === "out" && p.stock <= 0) ||
      (state === "noimg" && !p.images.length))
  );

  $("#productsBody").innerHTML = list.map((p) => `
    <tr data-pid="${p.id}" class="${p.active ? "" : "is-hidden"}">
      <td class="pt-img">
        <span class="pt-thumb">${productVisual(p)}</span>
        <button type="button" class="pt-addimg ${p.images.length ? "" : "is-empty"}" data-add-img="${p.id}" title="ضيف صور للمنتج ده" aria-label="ضيف صور لـ ${escapeHtml(p.name)}">📷 ${p.images.length ? `${num(p.images.length)}/${num(6)}` : "ضيف صور"}</button>
      </td>
      <td data-label="المنتج"><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand)} · #${p.id}</small></td>
      <td data-label="القسم">${categories[p.cat] || "—"}</td>
      <td data-label="السعر"><b>${fmt(p.price)}</b>${p.old ? `<small><del>${fmt(p.old)}</del></small>` : ""}</td>
      <td data-label="المخزون">${stockBadge(p)}</td>
      <td data-label="الحالة"><button class="vis-toggle ${p.active ? "on" : ""}" data-toggle="${p.id}">${p.active ? "👁 ظاهر" : "🚫 مخفي"}</button></td>
    </tr>`).join("");
  $("#productsEmpty").hidden = !!list.length || !productsLoaded;
  $("#productsEmpty").querySelector("p").textContent = adminProducts.length ? "مفيش منتجات مطابقة" : "مفيش منتجات لسه";
}

["prodSearch", "prodCat", "prodState"].forEach((id) => $("#" + id).addEventListener("input", renderProductsTable));

$("#productsBody").addEventListener("click", async (e) => {
  const add = e.target.closest("[data-add-img]");
  if (add) {
    rowImgTarget = +add.dataset.addImg;
    $("#rowImgFiles").click();
    return;
  }
  const t = e.target.closest("[data-toggle]");
  if (t) {
    const p = adminProducts.find((x) => x.id === +t.dataset.toggle);
    t.disabled = true;
    try {
      await productsStore.setActive(p.id, !p.active);
      toast(p.active ? `🚫 "${p.name}" اتخفى من المتجر` : `👁 "${p.name}" بقى ظاهر في المتجر`);
    } catch {
      toast("❌ مقدرناش نحدّث المنتج");
      t.disabled = false;
    }
    return;
  }
  const row = e.target.closest("tr[data-pid]");
  if (row) openEditor(adminProducts.find((x) => x.id === +row.dataset.pid));
});

$("#importBtn").addEventListener("click", async () => {
  const btn = $("#importBtn");
  btn.disabled = true;
  btn.textContent = "جاري الاستيراد...";
  try {
    const now = new Date().toISOString();
    await productsStore.importAll(DEFAULT_PRODUCTS.map((p) => ({ ...normalizeProduct(p), updatedAt: now })));
    toast(`📥 اتستورد ${num(DEFAULT_PRODUCTS.length)} منتج — تقدر تعدّلهم دلوقتي`);
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ الاستيراد فشل، جرّب تاني");
  } finally {
    btn.disabled = false;
    btn.textContent = "استيراد المنتجات";
  }
});

// ============ المحرر ============
const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const splitList = (s) => s.split(/[،,]/).map((x) => x.trim()).filter(Boolean);

function openEditor(p = null) {
  editing = p;
  edImages = [...(p?.images || [])];
  removedImages = [];
  const f = $("#productForm");
  f.reset();
  f.querySelectorAll(".field.invalid").forEach((x) => x.classList.remove("invalid"));
  $("#editorTitle").textContent = p ? `تعديل: ${p.name}` : "منتج جديد";
  $("#deleteProductBtn").hidden = !p;
  if (p) {
    f.name.value = p.name;
    f.brand.value = p.brand;
    f.cat.value = p.cat;
    f.price.value = p.price;
    f.old.value = p.old || "";
    f.stock.value = p.stock;
    f.tag.value = p.tag || "";
    f.warranty.value = p.warranty || "";
    f.active.checked = p.active;
    f.desc.value = p.desc;
    f.highlights.value = p.highlights.join("\n");
    f.options.value = Object.entries(p.options).map(([k, v]) => `${k}: ${v.join("، ")}`).join("\n");
    f.specs.value = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join("\n");
  } else {
    f.stock.value = 1;
  }
  renderEditorImages();
  $("#editor").classList.add("open");
  $("#overlay").classList.add("show");
  $("#productForm").scrollTop = 0;
}

function closeEditor() {
  editing = null;
  $("#editor").classList.remove("open");
  if (!$("#drawer").classList.contains("open")) $("#overlay").classList.remove("show");
}
$("#newProductBtn").addEventListener("click", () => openEditor(null));
$("#editorClose").addEventListener("click", closeEditor);
$("#overlay").addEventListener("click", closeEditor);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeEditor());

function renderEditorImages() {
  const p = { name: $("#productForm").name.value || "صورة", icon: "🖼️" };
  $("#peImages").innerHTML = edImages.map((img, i) => `
    <div class="pe-img ${i === 0 ? "is-main" : ""}">
      ${typeof img === "string" ? productVisual(p, img) : `<img src="${img.data}" alt=""${img.bg ? ` style="object-fit:contain;background:#${img.bg}"` : ""}>`}
      ${i === 0 ? `<span class="pe-img__main">رئيسية</span>` : ""}
      <div class="pe-img__tools">
        ${i > 0 ? `<button type="button" data-img-move="${i}" data-dir="-1" title="قدّم">→</button>` : ""}
        ${i < edImages.length - 1 ? `<button type="button" data-img-move="${i}" data-dir="1" title="أخّر">←</button>` : ""}
        <button type="button" data-img-del="${i}" title="حذف">✕</button>
      </div>
    </div>`).join("") || `<p class="muted pe-noimg">مفيش صور — هيظهر إيموجي القسم بدالها</p>`;
}

$("#peImages").addEventListener("click", (e) => {
  const mv = e.target.closest("[data-img-move]");
  const del = e.target.closest("[data-img-del]");
  if (mv) {
    const i = +mv.dataset.imgMove, j = i + +mv.dataset.dir;
    [edImages[i], edImages[j]] = [edImages[j], edImages[i]];
  }
  if (del) {
    const [gone] = edImages.splice(+del.dataset.imgDel, 1);
    if (typeof gone === "string" && gone.startsWith("fs:")) removedImages.push(gone);
  }
  if (mv || del) renderEditorImages();
});

// ============ تجهيز الصورة قبل الرفع ============
// لو خلفية الصورة سادة (أبيض مثلاً): بنقص الفراغ اللي حوالين المنتج، ونحطه في نص مربع بهامش صغير،
// عشان كل الصور تملا المربع بتاعها في المتجر بنفس الشكل. لو الخلفية مش سادة (صورة عادية) بتفضل زي ما هي.
// الجودة: لحد 1200 بكسل، وجودة JPEG عالية، ومن غير تكبير الصور الصغيرة عشان ماتبوظش.
const IMG_OUT = 1200;
const IMG_MARGIN = 0.07; // هامش حوالين المنتج من كل ناحية

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      try {
        resolve(prepareImage(img));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return [c, ctx];
}

// بندوّر على حدود المنتج جوه الخلفية السادة
function findProductBox(img) {
  const k = Math.min(1, 800 / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const [, ctx] = makeCanvas(w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const bg = at(0, 0);
  const diff = (c) => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
  const corners = [at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  if (corners.some((c) => diff(c) > 45)) return null; // الخلفية مش سادة
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (diff(at(x, y)) > 50) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // الصورة كلها لون واحد
  const pad = 1; // بكسل زيادة احتياطي
  return {
    bg: bg.map((v) => v.toString(16).padStart(2, "0")).join(""),
    x: Math.max(0, (minX - pad) / k), y: Math.max(0, (minY - pad) / k),
    w: Math.min(img.width, (maxX - minX + 1 + pad * 2) / k), h: Math.min(img.height, (maxY - minY + 1 + pad * 2) / k),
  };
}

function prepareImage(img) {
  const box = findProductBox(img);
  let c, ctx;
  if (box) {
    // المنتج في نص مربع، بنفس لون الخلفية
    const side = Math.max(box.w, box.h) / (1 - IMG_MARGIN * 2);
    const out = Math.round(Math.min(IMG_OUT, side));
    const k = out / side;
    [c, ctx] = makeCanvas(out, out);
    ctx.fillStyle = "#" + box.bg;
    ctx.fillRect(0, 0, out, out);
    const dw = box.w * k, dh = box.h * k;
    ctx.drawImage(img, box.x, box.y, box.w, box.h, (out - dw) / 2, (out - dh) / 2, dw, dh);
  } else {
    const k = Math.min(1, IMG_OUT / Math.max(img.width, img.height));
    [c, ctx] = makeCanvas(Math.round(img.width * k), Math.round(img.height * k));
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  // لازم تفضل أقل من ~700KB عشان تتخزن في قاعدة البيانات
  let q = 0.9, data = c.toDataURL("image/jpeg", q);
  while (data.length > 700000 && q > 0.45) data = c.toDataURL("image/jpeg", (q -= 0.08));
  if (data.length > 900000) throw new Error("too big");
  // الصورة الصغيرة (زي الصور المصغّرة بتاعة بحث جوجل) بتبان مش واضحة في المتجر
  const size = Math.round(box ? Math.max(box.w, box.h) : Math.max(img.width, img.height));
  return { data, bg: box ? box.bg : null, size, lowRes: size < LOW_RES }; // bg = لون الخلفية لو المنتج اتحط في مربع
}

const LOW_RES = 500; // أقل من كده الصورة بتبان مش واضحة في صفحة المنتج
function lowResWarning(count, size) {
  return count === 1
    ? `⚠️ الصورة صغيرة (${num(size)} بكسل) وهتبان مش واضحة في المتجر — نزّل نسخة أكبر من موقع الشركة`
    : `⚠️ ${num(count)} صور صغيرة وهتبان مش واضحة في المتجر — نزّل نسخ أكبر من موقع الشركة`;
}

$("#peFiles").addEventListener("change", async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  e.target.value = "";
  if (edImages.length + files.length > 6) return toast("أقصى عدد 6 صور للمنتج");
  for (const file of files) {
    try {
      const prepared = await compressImage(file);
      edImages.push(prepared);
      if (prepared.lowRes) setTimeout(() => toast(lowResWarning(1, prepared.size)), 50);
    } catch {
      toast(`❌ مقدرناش نقرا الصورة ${file.name}`);
    }
  }
  renderEditorImages();
});

function parseForm() {
  const f = $("#productForm");
  const errors = [];
  const mark = (el, msg) => {
    el.closest(".field").classList.toggle("invalid", !!msg);
    const em = el.closest(".field").querySelector("em");
    if (em) em.textContent = msg || "";
    if (msg) errors.push(el);
  };
  const int = (el) => Number(toLatinDigits(String(el.value)));
  mark(f.name, f.name.value.trim().length < 2 && "اكتب اسم المنتج");
  mark(f.cat, !f.cat.value && "اختار القسم");
  const price = int(f.price), old = f.old.value === "" ? null : int(f.old), stock = int(f.stock);
  mark(f.price, !(Number.isInteger(price) && price > 0 && price <= MAX_PRICE) && "السعر لازم يكون رقم صحيح بين 1 و 100 مليون");
  mark(f.old, old !== null && !(Number.isInteger(old) && old > price && old <= MAX_PRICE) && "لازم يكون أكبر من السعر الحالي (وأقل من 100 مليون)، أو سيبه فاضي");
  mark(f.stock, !(Number.isInteger(stock) && stock >= 0 && stock <= MAX_STOCK) && "الكمية لازم تكون من صفر لـ مليون");
  if (errors.length) {
    errors[0].focus();
    return null;
  }
  const options = {};
  lines(f.options.value).forEach((l) => {
    const i = l.indexOf(":");
    if (i > 0) {
      const vals = splitList(l.slice(i + 1));
      if (vals.length) options[l.slice(0, i).trim()] = vals;
    }
  });
  const specs = {};
  lines(f.specs.value).forEach((l) => {
    const i = l.indexOf(":");
    if (i > 0 && l.slice(i + 1).trim()) specs[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
  return {
    name: f.name.value.trim(),
    brand: f.brand.value.trim().toUpperCase(),
    cat: f.cat.value,
    price, old, stock,
    tag: f.tag.value.trim(),
    warranty: f.warranty.value.trim(),
    active: f.active.checked,
    desc: f.desc.value.trim(),
    highlights: lines(f.highlights.value),
    options, specs,
  };
}

$("#productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = parseForm();
  if (!data) return toast("⚠️ راجع البيانات المطلوبة");
  const btn = $("#saveProductBtn");
  btn.disabled = true;
  btn.textContent = "جاري الحفظ...";
  try {
    const images = [];
    for (const img of edImages) images.push(typeof img === "string" ? img : await productsStore.saveImage(img.data, img.bg));
    const allIds = [...adminProducts, ...DEFAULT_PRODUCTS].map((p) => p.id);
    const base = editing || { id: Math.max(0, ...allIds) + 1, rating: 5, reviews: 0 };
    // الإيموجي واللون بيتحسبوا من القسم، إلا لو المنتج قديم وقسمه متغيرش
    const keepLook = editing && editing.cat === data.cat;
    const product = {
      ...normalizeProduct({ ...base, ...data, images, icon: keepLook ? editing.icon : null, tint: keepLook ? editing.tint : null }),
      updatedAt: new Date().toISOString(),
    };
    const wasEditing = !!editing, toRemove = [...removedImages];
    await productsStore.save(product);
    await Promise.all(toRemove.map((k) => productsStore.removeImage(k.slice(3)).catch(() => {})));
    toast(wasEditing ? "✅ اتحفظت التعديلات" : `✅ اتضاف "${product.name}" للمتجر`);
    closeEditor();
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ الحفظ فشل، جرّب تاني");
  } finally {
    btn.disabled = false;
    btn.textContent = "حفظ المنتج";
  }
});

$("#deleteProductBtn").addEventListener("click", async () => {
  const p = editing; // الاحتفاظ بيه لأن القايمة بتتحدث أثناء الحذف
  if (!p || !confirm(`متأكد إنك عايز تحذف "${p.name}" نهائياً؟\nلو عايز توقف بيعه مؤقتاً خليه "مخفي" بدل الحذف.`)) return;
  try {
    await productsStore.remove(p.id);
    await Promise.all(p.images.filter((s) => s.startsWith("fs:")).map((k) => productsStore.removeImage(k.slice(3)).catch(() => {})));
    toast("🗑 المنتج اتحذف");
    closeEditor();
  } catch {
    toast("❌ الحذف فشل");
  }
});

// ============ المخزون مع حالة الطلب ============
// الطلب بيحجز من المخزون لما يتأكد (أو يتشحن/يتوصّل)، وبيرجّعه لو اتلغى أو رجع "جديد"
const HOLDS_STOCK = (s) => ["confirmed", "shipped", "delivered"].includes(s);
async function syncStockForStatus(order, from, to) {
  if (HOLDS_STOCK(from) === HOLDS_STOCK(to)) return;
  const sign = HOLDS_STOCK(to) ? -1 : 1;
  const totals = {};
  order.items.forEach((i) => (totals[i.id] = (totals[i.id] || 0) + i.qty));
  try {
    await productsStore.adjustStock(Object.entries(totals).map(([id, qty]) => ({ id: +id, delta: sign * qty })));
  } catch (err) {
    console.warn("stock", err);
  }
}

// ============ زرار 📷 جنب كل منتج: اختار الصور وتترفع على طول ============
let rowImgTarget = null;
$("#rowImgFiles").addEventListener("change", async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  e.target.value = "";
  const p = adminProducts.find((x) => x.id === rowImgTarget);
  if (!p || !files.length) return;
  const room = 6 - p.images.length;
  if (room <= 0) return toast("المنتج ده فيه 6 صور خلاص — افتحه وامسح صورة الأول");
  const picked = files.slice(0, room);
  const fresh = [], lowRes = [];
  for (const [i, file] of picked.entries()) {
    toast(`⏳ بنرفع صورة ${num(i + 1)} من ${num(picked.length)}...`);
    try {
      const prepared = await compressImage(file);
      if (prepared.lowRes) lowRes.push(prepared.size);
      fresh.push(await productsStore.saveImage(prepared.data, prepared.bg));
    } catch (err) {
      console.warn("row image", err);
    }
  }
  if (!fresh.length) return toast("❌ الصور مااترفعتش، جرّب تاني");
  try {
    const current = adminProducts.find((x) => x.id === p.id) || p;
    await productsStore.save({ ...current, images: [...current.images, ...fresh].slice(0, 6), updatedAt: new Date().toISOString() });
    const extra = files.length - picked.length;
    toast(`✅ اتضافت ${num(fresh.length)} صورة لـ "${p.name}"${extra > 0 ? ` (${num(extra)} مااتضافتش عشان الحد 6 صور)` : ""}`);
    if (lowRes.length) setTimeout(() => toast(lowResWarning(lowRes.length, lowRes[0])), 2600);
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ الحفظ فشل، جرّب تاني");
  }
});
