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
      async saveImage(data) {
        const ref = (await this.db()).collection("productImages").doc();
        await ref.set({ data, createdAt: new Date().toISOString() });
        return "fs:" + ref.id;
      },
      async removeImage(key) { await (await this.db()).collection("productImages").doc(key).delete(); },
      async importAll(list) {
        const db = await this.db();
        const batch = db.batch();
        list.forEach((p) => batch.set(db.collection("products").doc(String(p.id)), p));
        await batch.commit();
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
      async saveImage(data) {
        const key = "img" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
      async importAll(list) { this.write(list); },
      async adjustStock(changes) {
        this.write(this.read().map((p) => {
          const c = changes.find((x) => x.id === p.id);
          return c ? { ...p, stock: Math.max(0, (p.stock || 0) + c.delta) } : p;
        }));
      },
    };

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
  $("#ordersSection").hidden = name !== "orders";
  $("#productsSection").hidden = name !== "products";
  history.replaceState(null, "", name === "products" ? "#products" : "#");
  if (name === "products" && !productsWatching) {
    productsWatching = true;
    productsStore.watch(onProducts, (err) => {
      console.error(err);
      toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مشكلة في تحميل المنتجات");
    });
  }
}
$("#adSections").addEventListener("click", (e) => {
  const b = e.target.closest("[data-section]");
  if (b) showSection(b.dataset.section);
});
if (location.hash === "#products") {
  // نستنى لحد ما الأدمن يدخل
  const wait = setInterval(() => {
    if (!$("#dashboard").hidden) { clearInterval(wait); showSection("products"); }
  }, 200);
}

function onProducts(list) {
  adminProducts = list.map(normalizeProduct).sort((a, b) => a.id - b.id);
  productsLoaded = true;
  renderProductsTable();
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
      (state === "low" && p.stock > 0 && p.stock <= 5) || (state === "out" && p.stock <= 0))
  );

  $("#productsBody").innerHTML = list.map((p) => `
    <tr data-pid="${p.id}" class="${p.active ? "" : "is-hidden"}">
      <td class="pt-img"><span class="pt-thumb">${productVisual(p)}</span></td>
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
      ${typeof img === "string" ? productVisual(p, img) : `<img src="${img.data}" alt="">`}
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

// بنصغّر الصورة لحد أقصى 900 بكسل وأقل من ~700KB عشان تتخزن في قاعدة البيانات
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      let q = 0.8, data = c.toDataURL("image/jpeg", q);
      while (data.length > 700000 && q > 0.35) data = c.toDataURL("image/jpeg", (q -= 0.1));
      data.length > 900000 ? reject(new Error("too big")) : resolve(data);
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });
}

$("#peFiles").addEventListener("change", async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  e.target.value = "";
  if (edImages.length + files.length > 6) return toast("أقصى عدد 6 صور للمنتج");
  for (const file of files) {
    try {
      edImages.push({ data: await compressImage(file) });
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
  mark(f.price, !(Number.isInteger(price) && price > 0) && "السعر لازم يكون رقم صحيح أكبر من صفر");
  mark(f.old, old !== null && !(Number.isInteger(old) && old > price) && "لازم يكون أكبر من السعر الحالي، أو سيبه فاضي");
  mark(f.stock, !(Number.isInteger(stock) && stock >= 0) && "الكمية لازم تكون صفر أو أكتر");
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
    for (const img of edImages) images.push(typeof img === "string" ? img : await productsStore.saveImage(img.data));
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
