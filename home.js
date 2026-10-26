// ============ الصفحة الرئيسية ============
const params = new URLSearchParams(location.search);
let filter = params.get("cat") || document.documentElement.dataset.cat || "all";
let query = params.get("q") || "";
const grid = $("#productsGrid");

// ============ الفلاتر المتقدمة ============
// السعر، الماركة، الرام، المساحة، المتوفر بس، والترتيب
const filters = { min: "", max: "", brands: new Set(), ram: new Set(), storage: new Set(), inStockOnly: false, sort: "" };

const lastNumber = (str) => { const m = String(str).match(/[\d.]+(?!.*[\d.])/); return m ? Number(m[0]) : null; };
// "12 جيجا رام" ← 12 جيجا
function ramValues(p) {
  const spec = p.specs["الرام"] || p.specs["الذاكرة"] || "";
  const n = parseFloat(toLatinDigits(String(spec)));
  const fromOpts = (p.options["السعة"] || []).map((o) => /رام/.test(o) ? parseFloat(toLatinDigits(o)) : null);
  return [...new Set([n, ...fromOpts].filter((x) => x > 0 && x <= 128))].map((x) => `${x} جيجا`);
}
// "256 جيجا" / "1 تيرا" / "16 رام / 512 SSD" ← المساحة
function storageValues(p) {
  const raw = [...(p.options["السعة"] || p.options["المساحة"] || []), p.specs["التخزين"] || p.specs["المساحة"] || ""].filter(Boolean);
  return [...new Set(raw.map((v) => {
    const s = toLatinDigits(String(v));
    const n = lastNumber(s);
    if (!n) return null;
    return /تيرا|TB/i.test(s) ? `${n} تيرا` : `${n} جيجا`;
  }).filter(Boolean))];
}
const sizeRank = (v) => parseFloat(v) * (v.includes("تيرا") ? 1024 : 1);

// مجموعات أقسام (شرايط الصفحة الرئيسية بتفتحها بـ "عرض الكل")
const CAT_GROUPS = { gaming: ["mice", "keyboards", "controllers"], sound: ["audio", "earphones", "speakers"] };
const inFilter = (p) => filter === "all" || p.cat === filter || (CAT_GROUPS[filter] || []).includes(p.cat);

function baseList() {
  const q = query.trim().toLowerCase();
  return shopProducts().filter((p) =>
    inFilter(p) &&
    (!q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
  );
}

function applyFilters(list) {
  const min = Number(toLatinDigits(filters.min)) || 0;
  const max = Number(toLatinDigits(filters.max)) || Infinity;
  const out = list.filter((p) =>
    p.price >= min && p.price <= max &&
    (!filters.brands.size || filters.brands.has(p.brand.toUpperCase())) &&
    (!filters.ram.size || ramValues(p).some((v) => filters.ram.has(v))) &&
    (!filters.storage.size || storageValues(p).some((v) => filters.storage.has(v))) &&
    (!filters.inStockOnly || inStock(p))
  );
  const sorters = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    discount: (a, b) => discount(b) - discount(a),
    newest: (a, b) => b.id - a.id,
  };
  // المتوفر الأول دايماً، واللي خلص بيفضل ظاهر بعلامة "نفد" في آخر القسم
  return [...out].sort((a, b) => (inStock(b) - inStock(a)) || (filters.sort ? sorters[filters.sort](a, b) : 0));
}

const activeFilterCount = () =>
  (filters.min ? 1 : 0) + (filters.max ? 1 : 0) + filters.brands.size + filters.ram.size + filters.storage.size + (filters.inStockOnly ? 1 : 0);

function chipGroup(title, key, values) {
  if (values.length < 2 && !filters[key].size) return "";
  return `
    <fieldset class="fp-group">
      <legend>${title}</legend>
      <div class="fp-chips">${values.map((v) => `
        <label class="fp-chip"><input type="checkbox" data-facet="${key}" value="${escapeHtml(v)}" ${filters[key].has(v) ? "checked" : ""}/><span>${escapeHtml(v)}</span></label>`).join("")}
      </div>
    </fieldset>`;
}

function renderFilterPanel(list) {
  const brands = [...new Set(list.map((p) => p.brand.toUpperCase()).filter(Boolean))].sort();
  const rams = [...new Set(list.flatMap(ramValues))].sort((a, b) => sizeRank(a) - sizeRank(b));
  const storages = [...new Set(list.flatMap(storageValues))].sort((a, b) => sizeRank(a) - sizeRank(b));
  // اللي متعلّم ومش موجود في القسم ده يفضل ظاهر عشان يتشال
  filters.brands.forEach((v) => brands.includes(v) || brands.push(v));
  filters.ram.forEach((v) => rams.includes(v) || rams.push(v));
  filters.storage.forEach((v) => storages.includes(v) || storages.push(v));
  const prices = list.map((p) => p.price);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const focused = document.activeElement?.id;
  $("#filterPanel").innerHTML = `
    <fieldset class="fp-group">
      <legend>السعر (ج.م)</legend>
      <div class="fp-price">
        <input type="text" inputmode="numeric" id="fpMin" placeholder="من ${num(lo)}" value="${escapeHtml(filters.min)}" aria-label="أقل سعر" />
        <span>—</span>
        <input type="text" inputmode="numeric" id="fpMax" placeholder="لحد ${num(hi)}" value="${escapeHtml(filters.max)}" aria-label="أعلى سعر" />
      </div>
    </fieldset>
    ${chipGroup("الماركة", "brands", brands)}
    ${chipGroup("الرام", "ram", rams)}
    ${chipGroup("المساحة", "storage", storages)}
    <div class="fp-foot">
      <label class="fp-switch"><input type="checkbox" id="fpStock" ${filters.inStockOnly ? "checked" : ""}/> <span>المتوفر بس</span></label>
      <button type="button" class="link-btn" data-clear-filters ${activeFilterCount() ? "" : "hidden"}>امسح الفلاتر</button>
    </div>`;
  if (focused === "fpMin" || focused === "fpMax") {
    const el = $("#" + focused);
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
}

// ============ شرايط المنتجات ============
// أول ما الصفحة تفتح (من غير قسم ولا بحث ولا فلتر) بتظهر شرايط بتتسحب بدل شبكة كل المنتجات
let showAll = params.has("cat") || params.has("q") || params.has("max");
// لينك مباشر لصفحة "تحت سعر معين": index.html?max=500#products
const BUDGET = 500;
if (params.has("max")) { filters.max = String(Number(toLatinDigits(params.get("max"))) || BUDGET); filters.sort = "price-asc"; }
const SHELF_MAX = 10;
const SHELVES = [
  { key: "deals", icon: "🔥", title: "أقوى الخصومات", sub: "أكبر نسبة خصم حقيقية دلوقتي",
    pick: (all) => all.filter((p) => discount(p) > 0).sort((a, b) => discount(b) - discount(a)) },
  { key: "budget", icon: "💸", title: `تحت ${num(BUDGET)} جنيه`, sub: "أرخص اختيارات في المحل",
    pick: (all) => all.filter((p) => p.price <= BUDGET).sort((a, b) => (inStock(b) - inStock(a)) || a.price - b.price) },
  { key: "gaming", icon: "🎮", title: "للجيمرز", sub: "ماوسات وكيبوردات ودراعات", pick: (all) => all.filter((p) => CAT_GROUPS.gaming.includes(p.cat)) },
  { key: "sound", icon: "🎧", title: "صوت", sub: "سماعات هيدسيت وإيربودز", pick: (all) => all.filter((p) => CAT_GROUPS.sound.includes(p.cat)) },
  { key: "storage", icon: "💾", title: "تخزين", sub: "هاردات SSD وخارجية", pick: (all) => all.filter((p) => p.cat === "storage") },
];
const shelfMode = () => !showAll && filter === "all" && !query.trim() && !activeFilterCount() && !filters.sort;
// المتوفر الأول، وبعدين الأحدث
const shelfOrder = (a, b) => (inStock(b) - inStock(a)) || b.id - a.id;

// الشرايط: "أقوى الخصومات" عرض كبير (منتج بطل + 4 جنبه)، والباقي شريط واحد بتابات بدل 4 شرايط شبه بعض
let shelfTab = "budget";
const floatsFor = (p) => typeof FLOAT_IMAGES !== "undefined" && p.images?.[0] === `fs:${FLOAT_IMAGES[p.id]}`;
function shelfLists() {
  const all = shopProducts();
  return SHELVES.map((sh) => {
    let list = sh.pick(all);
    if (sh.key === "deals") list = [...list].sort((a, b) => (inStock(b) - inStock(a)) || discount(b) - discount(a));
    else if (sh.key !== "budget") list = [...list].sort(shelfOrder); // budget مترتبة بالسعر في pick
    return { ...sh, list };
  }).filter((sh) => sh.list.length >= 2);
}
function spotlightHtml(sh) {
  const live = sh.list.filter(inStock);
  const hero = [...live].sort((a, b) => floatsFor(b) - floatsFor(a) || discount(b) - discount(a))[0] || sh.list[0];
  const side = sh.list.filter((p) => p !== hero).slice(0, 4);
  const save = hero.old ? hero.old - hero.price : 0;
  return `
    <div class="spot" style="--cc:${CATEGORY_COLORS[hero.cat] || "#0a84ff"}">
      <div class="shelf__head">
        <div><h3>${sh.icon} ${sh.title}</h3><small class="muted">${sh.sub}</small></div>
        <div class="shelf__nav"><button type="button" class="shelf__all" data-shelf-all="deals"><span>عرض الكل</span><span class="shelf__count">${num(sh.list.length)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button></div>
      </div>
      <div class="spot__grid">
        <article class="spot__hero">
          <a class="spot__img ${floatsFor(hero) ? "is-float" : ""}" href="${productUrl(hero.id)}" aria-label="${escapeHtml(hero.name)}">
            ${floatsFor(hero) ? `<img src="images/float/${hero.id}.webp" alt="${escapeHtml(hero.name)}" loading="lazy">` : productVisual(hero)}
          </a>
          ${discount(hero) ? `<span class="spot__off"><b>-${num(discount(hero))}%</b>خصم</span>` : ""}
          <div class="spot__info">
            <small>${escapeHtml(hero.brand)}</small>
            <h4><a href="${productUrl(hero.id)}">${escapeHtml(hero.name)}</a></h4>
            <div class="spot__price"><b>${fmt(hero.price)}</b>${hero.old ? `<del>${fmt(hero.old)}</del>` : ""}</div>
            ${save ? `<span class="spot__save">وفّر ${fmt(save)}</span>` : ""}
            <div class="spot__cta">${inStock(hero) ? `<button type="button" class="btn btn--primary" data-add="${hero.id}">🛒 أضف للسلة</button>` : ""}<a class="btn btn--ghost" href="${productUrl(hero.id)}">التفاصيل</a></div>
          </div>
        </article>
        <div class="spot__side">${side.map((p) => `
          <a class="spot__mini ${inStock(p) ? "" : "is-out"}" href="${productUrl(p.id)}">
            <span class="spot__thumb">${productVisual(p)}</span>
            <span class="spot__mtxt"><b>${escapeHtml(p.name)}</b><span><strong>${fmt(p.price)}</strong>${p.old ? ` <del>${fmt(p.old)}</del>` : ""}</span></span>
            ${discount(p) ? `<em>-${num(discount(p))}%</em>` : ""}
          </a>`).join("")}</div>
      </div>
    </div>`;
}
function tabbedShelfHtml(list) {
  if (!list.some((sh) => sh.key === shelfTab)) shelfTab = list[0].key;
  const cur = list.find((sh) => sh.key === shelfTab);
  return `
    <div class="shelf shelf--tabs">
      <div class="shelf__head">
        <div><h3>🧭 اختار على حسب احتياجك</h3>
          <div class="shelf__tabs" role="tablist">${list.map((sh) => `<button type="button" role="tab" class="shelf__tab ${sh.key === shelfTab ? "active" : ""}" aria-selected="${sh.key === shelfTab}" data-shelf-tab="${sh.key}">${sh.icon} ${sh.title}</button>`).join("")}</div>
        </div>
        <div class="shelf__nav">
          <button type="button" class="shelf__arrow" data-shelf-dir="-1" aria-label="السابق">‹</button>
          <button type="button" class="shelf__arrow" data-shelf-dir="1" aria-label="التالي">›</button>
          <button type="button" class="shelf__all" data-shelf-all="${cur.key}"><span>عرض الكل</span><span class="shelf__count">${num(cur.list.length)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        </div>
      </div>
      <p class="muted shelf__sub">${cur.sub}</p>
      <div class="shelf__track">${cur.list.slice(0, SHELF_MAX).map(productCard).join("")}</div>
    </div>`;
}
function renderShelves() {
  const lists = shelfLists();
  const deals = lists.find((sh) => sh.key === "deals");
  const rest = lists.filter((sh) => sh.key !== "deals");
  $("#shelves").innerHTML = (deals ? spotlightHtml(deals) : "") + (rest.length ? tabbedShelfHtml(rest) : "");
  $("#showAllCount").textContent = `(${num(shopProducts().length)})`;
}

$("#shelves").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-shelf-tab]");
  if (tab) {
    shelfTab = tab.dataset.shelfTab;
    const old = $("#shelves .shelf--tabs");
    old.outerHTML = tabbedShelfHtml(shelfLists().filter((sh) => sh.key !== "deals"));
    return;
  }
  const arrow = e.target.closest("[data-shelf-dir]");
  if (arrow) {
    const track = arrow.closest(".shelf").querySelector(".shelf__track");
    // "التالي" في العربي ناحية الشمال
    const dir = Number(arrow.dataset.shelfDir) * (getComputedStyle(track).direction === "rtl" ? -1 : 1);
    track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: "smooth" });
    return;
  }
  const allBtn = e.target.closest("[data-shelf-all]");
  if (!allBtn) return;
  const key = allBtn.dataset.shelfAll;
  showAll = true;
  if (key === "deals") { filters.sort = "discount"; $("#sortSel").value = "discount"; setFilter("all"); }
  else if (key === "budget") { filters.max = String(BUDGET); filters.sort = "price-asc"; $("#sortSel").value = "price-asc"; setFilter("all"); }
  else setFilter(key);
  $("#products").scrollIntoView({ behavior: "smooth" });
});
$("#showAllBtn").addEventListener("click", () => {
  showAll = true;
  renderProducts();
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
});

function renderProducts() {
  const base = baseList();
  const list = applyFilters(base);
  const shelves = shelfMode() && products.length > 0;
  $("#shelves").hidden = !shelves;
  $("#showAllWrap").hidden = !shelves;
  grid.hidden = shelves;
  if (shelves) renderShelves();
  grid.innerHTML = shelves ? "" : list.map(productCard).join("");
  $("#emptyState").hidden = shelves || list.length > 0;
  // قسم لسه مفيهوش منتجات خالص (مش فلتر أو بحث)
  const soonCat = !list.length && filter !== "all" && !shopProducts().some((p) => p.cat === filter);
  $("#emptyText").textContent = !catalogLoaded && !products.length ? "⏳ جاري تحميل المنتجات…" : catalogFailed && !products.length ? "📡 مقدرناش نحمّل المنتجات — اتأكد من النت وجرّب تاني" : soonCat ? `📦 قسم ${categoryLabel(filter)} هينزل فيه منتجات قريب جداً — تابعنا!` : "لا توجد منتجات مطابقة لبحثك 🔍";
  const count = activeFilterCount();
  $("#filterCount").hidden = !count;
  $("#filterCount").textContent = num(count);
  $("#filterResult").textContent = shelves ? "" : `${num(list.length)} منتج`;
  $$("[data-clear-filters]").forEach((b) => { b.hidden = !count; });
  renderFilterPanel(base);
}

$("#filterToggle").addEventListener("click", () => {
  const panel = $("#filterPanel");
  panel.hidden = !panel.hidden;
  $("#filterToggle").setAttribute("aria-expanded", String(!panel.hidden));
  $("#filterToggle").classList.toggle("active", !panel.hidden);
});
$("#sortSel").addEventListener("change", (e) => { filters.sort = e.target.value; renderProducts(); });
if (filters.sort) $("#sortSel").value = filters.sort;
$("#filterPanel").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.facet) filters[t.dataset.facet][t.checked ? "add" : "delete"](t.value);
  else if (t.id === "fpStock") filters.inStockOnly = t.checked;
  else return;
  renderProducts();
});
let priceTimer = null;
$("#filterPanel").addEventListener("input", (e) => {
  if (e.target.id !== "fpMin" && e.target.id !== "fpMax") return;
  filters[e.target.id === "fpMin" ? "min" : "max"] = e.target.value.replace(/[^\d٠-٩]/g, "");
  clearTimeout(priceTimer);
  priceTimer = setTimeout(renderProducts, 350);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-clear-filters]")) return;
  Object.assign(filters, { min: "", max: "", inStockOnly: false });
  ["brands", "ram", "storage"].forEach((k) => filters[k].clear());
  renderProducts();
});

function setFilter(value) {
  filter = value;
  syncTabs();
  renderProducts();
}

$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  showAll = true;
  setFilter(tab.dataset.filter);
  // النتايج بتظهر تحت الفلتر — بننزل لها عشان العميل يشوف إن القسم اتغيّر
  const target = grid.hidden || !grid.children.length ? $("#emptyState") : grid;
  const top = target.getBoundingClientRect().top;
  if (top > innerHeight * 0.6 || top < 0) {
    const header = $(".header")?.offsetHeight || 70;
    scrollTo({ top: scrollY + $("#products .section__head").getBoundingClientRect().bottom - header - 10, behavior: "smooth" });
  }
});

// ============ الأقسام: عدد المنتجات الحقيقي في كل قسم ============
// أيقونات SVG بنفس الستايل ولون لكل قسم (بدل الإيموجي اللي شكله بيختلف من جهاز للتاني)
const CATEGORY_SVG = {
  storage: ["#fbbf24", '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 9h10M7 15h5"/><circle cx="16.5" cy="15" r="1.2"/>'],
  keyboards: ["#3b9bff", '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5"/>'],
  mice: ["#22c55e", '<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 2.5v6.5M6 9h12"/>'],
  audio: ["#a78bfa", '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/>'],
  earphones: ["#ec4899", '<circle cx="7" cy="8" r="3.5"/><path d="M9.2 10.8 10.5 20"/><circle cx="17" cy="8" r="3.5"/><path d="M14.8 10.8 13.5 20"/>'],
  monitors: ["#00d4ff", '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'],
  gpus: ["#ff4d6d", '<rect x="2" y="6" width="20" height="11" rx="2"/><circle cx="8.5" cy="11.5" r="2.8"/><circle cx="15.5" cy="11.5" r="2.8"/><path d="M5 17v2.5M9 17v2.5M13 17v2.5"/>'],
  speakers: ["#2dd4bf", '<rect x="6" y="2.5" width="12" height="19" rx="3"/><circle cx="12" cy="14.5" r="3.5"/><circle cx="12" cy="7" r="1.3"/>'],
  controllers: ["#ff9f0a", '<path d="M6.5 7.5h11a4 4 0 0 1 3.9 3.1l1 4.6a2.6 2.6 0 0 1-4.5 2.2L16 15.5H8l-1.9 1.9a2.6 2.6 0 0 1-4.5-2.2l1-4.6a4 4 0 0 1 3.9-3.1z"/><path d="M7.5 10.5v3M6 12h3"/><path d="M15.5 11h.01M17.5 13h.01"/>'],
  accessories: ["#a3e635", '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
};
const categoryIconHtml = (k) => CATEGORY_SVG[k]
  ? `<span class="category__icon"><svg viewBox="0 0 24 24" aria-hidden="true">${CATEGORY_SVG[k][1]}</svg></span>`
  : `<span class="category__icon">${CATEGORY_ICONS[k] || "📦"}</span>`;
function renderCategories() {
  const counts = {};
  shopProducts().forEach((p) => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  // بينتو: القسم الأكبر بياخد مربع أكبر، وكل مربع فيه صورة منتج حقيقي من القسم وأقل سعر فيه.
  // الأقسام الفاضية مش بتظهر هنا. المربع = رابط حقيقي لصفحة القسم (c/<قسم>.html) عشان جوجل يزحف منها،
  // والـ JS بيعمل preventDefault وبيفلتر على الصفحة فوراً (نفس تجربة المستخدم).
  const tiles = Object.entries(categories).filter(([k]) => counts[k]).sort((a, b) => counts[b[0]] - counts[a[0]]);
  const rest = (tiles.length - 4) % 4; // الصف الأخير بيتملي: أول مربعات فيه بتتمد
  $("#categoryCards").innerHTML = tiles.map(([k, label], i) => {
    const list = shopProducts().filter((p) => p.cat === k);
    const live = list.filter(inStock);
    const from = Math.min(...(live.length ? live : list).map((p) => p.price));
    // أشيك منتج في القسم، ويفضّل اللي ليه صورة عايمة (من غير خلفية — tools/float.py) لو صورته لسه هي نفسها
    const floats = (p) => typeof FLOAT_IMAGES !== "undefined" && p.images?.[0] === `fs:${FLOAT_IMAGES[p.id]}`;
    const rep = [...(live.length ? live : list)].filter((p) => p.images?.length)
      .sort((a, b) => floats(b) - floats(a) || b.price - a.price)[0];
    const float = rep && floats(rep);
    const size = i === 0 ? "xl" : i === 1 ? "wide" : i >= 4 && rest && i - 4 >= tiles.length - 4 - rest
      ? (rest === 1 ? "full" : rest === 2 || i === tiles.length - rest ? "wide" : "") : "";
    return `
    <a class="category bento__tile ${size ? `bento__tile--${size}` : ""} ${float ? "bento__tile--float" : ""}" data-filter="${k}" href="c/${k}.html#products" style="--cc:${CATEGORY_SVG[k]?.[0] || "#0a84ff"}">
      <span class="bento__img">${float
        ? `<img src="images/float/${rep.id}.webp" alt="${escapeHtml(rep.name)}" loading="lazy">`
        : rep ? productVisual(rep) : categoryIconHtml(k)}</span>
      <span class="bento__txt">
        <small class="bento__count">${categoryIconHtml(k)}${num(counts[k])} منتج</small>
        <h3>${label}</h3>
        <span class="bento__from">يبدأ من <b>${fmt(from)}</b></span>
      </span>
      <span class="bento__go" aria-hidden="true">←</span>
    </a>`;
  }).join("");
  const total = shopProducts().length;
  const tabIcon = (k) => `<svg class="tab__icon" viewBox="0 0 24 24" aria-hidden="true">${k === "all" ? '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>' : CATEGORY_SVG[k]?.[1] || ""}</svg>`;
  const tab = (k, label, n) => `
    <button type="button" class="tab" role="tab" data-filter="${k}" style="--tc:${k === "all" ? "#3b9bff" : CATEGORY_SVG[k]?.[0] || "#3b9bff"}">
      ${tabIcon(k)}<span>${label}</span><span class="tab__count">${num(n)}</span>
    </button>`;
  // الأقسام الفاضية مش بتظهر في الشريط (بتفضل ظاهرة "قريباً" في كروت الأقسام فوق)
  const shown = Object.entries(categories).filter(([k]) => counts[k] || k === filter);
  $("#tabs").innerHTML = `<span class="cat-bar__ink no-anim" aria-hidden="true"></span>` + tab("all", "الكل", total) + shown.map(([k, label]) => tab(k, label, counts[k] || 0)).join("");
  syncTabs(false);
}

// ============ شريط الأقسام: المؤشر اللي بيتزحلق + الأسهم + الثبات تحت الهيدر ============
const catBar = $("#catBar");
const tabsTrack = $("#tabs");
function moveInk(animate = true) {
  const ink = tabsTrack.querySelector(".cat-bar__ink");
  const t = tabsTrack.querySelector(".tab.active");
  if (!ink) return;
  ink.style.opacity = t ? "1" : "0";
  if (!t) return;
  ink.classList.toggle("no-anim", !animate);
  ink.style.width = `${t.offsetWidth}px`;
  ink.style.transform = `translateX(${t.offsetLeft}px)`;
  const color = t.style.getPropertyValue("--tc");
  ink.style.setProperty("--tc", color);
  catBar.style.setProperty("--tc", color);
  if (!animate) requestAnimationFrame(() => ink.classList.remove("no-anim"));
}
function scrollActiveTab() {
  const t = tabsTrack.querySelector(".tab.active");
  if (!t || tabsTrack.scrollWidth <= tabsTrack.clientWidth) return;
  tabsTrack.scrollTo({ left: t.offsetLeft - (tabsTrack.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });
}
function updateCatArrows() {
  const over = tabsTrack.scrollWidth > tabsTrack.clientWidth + 2;
  catBar.classList.toggle("has-overflow", over);
  const max = tabsTrack.scrollWidth - tabsTrack.clientWidth;
  const pos = Math.abs(tabsTrack.scrollLeft); // في العربي scrollLeft بيبقى سالب
  catBar.querySelector(".cat-bar__arrow--start").hidden = !over || pos < 4;
  catBar.querySelector(".cat-bar__arrow--end").hidden = !over || pos > max - 4;
}
function syncTabs(animate = true) {
  $$(".tab").forEach((t) => { t.classList.toggle("active", t.dataset.filter === filter); t.setAttribute("aria-selected", String(t.dataset.filter === filter)); });
  moveInk(animate);
  scrollActiveTab();
  updateCatArrows();
}
tabsTrack.addEventListener("scroll", updateCatArrows, { passive: true });
catBar.addEventListener("click", (e) => {
  const a = e.target.closest("[data-catbar-dir]");
  if (!a) return;
  const dir = Number(a.dataset.catbarDir) * (getComputedStyle(tabsTrack).direction === "rtl" ? -1 : 1);
  tabsTrack.scrollBy({ left: dir * tabsTrack.clientWidth * 0.7, behavior: "smooth" });
});
// ارتفاع الهيدر الحقيقي (بيختلف بين الموبايل والكمبيوتر) عشان الشريط يثبت تحته بالظبط
function syncHeaderHeight() { document.documentElement.style.setProperty("--hdr", `${$(".header")?.offsetHeight || 76}px`); }
syncHeaderHeight();
addEventListener("resize", () => { syncHeaderHeight(); moveInk(false); updateCatArrows(); }, { passive: true });
document.fonts?.ready.then(() => moveInk(false));
// لما الشريط يثبت فوق بياخد شكل أوضح
addEventListener("scroll", () => {
  const stuck = catBar.getBoundingClientRect().top <= parseFloat(getComputedStyle(catBar).top) + 1 && scrollY > 200;
  catBar.classList.toggle("is-stuck", stuck);
}, { passive: true });
renderCategories();
document.addEventListener("productschange", renderCategories);

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-filter].category, [data-jump]");
  if (!el) return;
  e.preventDefault();
  showAll = true;
  setFilter(el.dataset.filter || el.dataset.jump);
  $("#products").scrollIntoView({ behavior: "smooth" });
});

$("#searchInput").addEventListener("input", (e) => {
  query = e.target.value;
  if (query) setFilter("all");
  else renderProducts();
});
$(".search").addEventListener("submit", () => $("#products").scrollIntoView({ behavior: "smooth" }));

nav.addEventListener("click", (e) => {
  if (e.target.tagName !== "A") return;
  $$(".nav a").forEach((a) => a.classList.remove("active"));
  e.target.classList.add("active");
});

// ============ بانر العرض: الماوسات (CATEGORY_SALES في data.js) ============
const OFFER_CAT = "mice";

function renderOffer() {
  const pct = categorySale(OFFER_CAT);
  const list = shopProducts().filter((p) => p.cat === OFFER_CAT && inStock(p));
  // لو فيه خصم على القسم (CATEGORY_SALES) البانر بيعلن عنه، ولو مفيش بيفضل بانر عادي للإيربودز
  $("#offerTag").hidden = !pct;
  if (pct) {
    $("#offerTag").textContent = `-${num(pct)}%`;
    $("#offerPill").textContent = "🖱️ عرض GTECH MASR على الماوسات";
    $("#offerTitle").innerHTML = `خصم <span class="gradient-text">${num(pct)}%</span> على أي ماوس<br />في المتجر`;
  }
  if (!list.length) { $("#offerPrice").hidden = true; return; }
  const cheapest = list.reduce((a, b) => (b.price < a.price ? b : a));
  $("#offerPrice").hidden = false;
  $("#offerPrice").innerHTML = `<small>تبدأ من</small> <b>${fmt(cheapest.price)}</b>${cheapest.old ? ` <del>${fmt(cheapest.old)}</del>` : ""}`;
}
renderOffer();
document.addEventListener("productschange", renderOffer);
document.addEventListener("catalogloaded", renderOffer);

// ============ باكدجات السيت أب ============
function renderBundles() {
  const list = (typeof BUNDLES === "undefined" ? [] : BUNDLES).filter(bundleAvailable);
  $("#bundles").hidden = !list.length;
  $("#bundleCards").innerHTML = list.map((b) => {
    const ps = bundleProducts(b);
    return `
      <article class="bundle card-box">
        <span class="bundle__tag">${b.tag}</span>
        <h3>${b.name}</h3>
        <p class="muted">${b.desc}</p>
        <div class="bundle__items">${ps.map((p) => `
          <a href="${productUrl(p.id)}" class="bundle__item">
            <span class="bundle__img">${productVisual(p)}</span>
            <small>${escapeHtml(p.name)}</small>
            <b>${fmt(p.price)}</b>
          </a>`).join('<span class="bundle__plus">+</span>')}
        </div>
        <div class="bundle__foot">
          <div class="bundle__price"><b>${fmt(bundlePrice(b))}</b><del>${fmt(bundleFull(b))}</del><span class="save">وفّر ${fmt(bundleFull(b) - bundlePrice(b))}</span></div>
          <button type="button" class="btn btn--primary" data-bundle="${b.id}">🛒 أضف الباكدج للسلة</button>
        </div>
      </article>`;
  }).join("");
}
$("#bundleCards").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-bundle]");
  if (btn) addBundle(btn.dataset.bundle);
});
renderBundles();
document.addEventListener("productschange", renderBundles);
document.addEventListener("catalogloaded", renderBundles);

// ============ المربعين اللي تحت العرض ============
// 1) عرض التطبيق (حقيقي: بيتحسب في صفحة الدفع) — 2) أرخص سعر في الماوسات والكيبوردات من المنتجات نفسها
function renderMiniOffers() {
  if (isStandalone()) {
    $("#appPromoText").textContent = "إنت فاتح من التطبيق ✅";
    $("#appPromoBtn").hidden = true;
  }
  const from = (cat) => {
    const prices = shopProducts().filter((p) => p.cat === cat && inStock(p)).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  };
  const mice = from("mice"), kb = from("keyboards");
  const parts = [mice && `ماوسات من <b>${fmt(mice)}</b>`, kb && `كيبوردات من <b>${fmt(kb)}</b>`].filter(Boolean);
  if (parts.length) $("#setupPromoText").innerHTML = parts.join(" · ");
  $("#setupPromo").dataset.jump = mice || !kb ? "mice" : "keyboards";
}
renderMiniOffers();
document.addEventListener("productschange", renderMiniOffers);

if (query) {
  $("#searchInput").value = query;
  requestAnimationFrame(() => $("#products").scrollIntoView());
}

document.addEventListener("productschange", renderProducts);

reveal(".section__head, .category, .offer, .mini-offer, .reel, .newsletter, .feature");
setFilter(filter);

// ============ شريط تتبع الطلب ============
// بيظهر للعميل اللي داخل وعنده طلب شغال، وبيتحدث لوحده لما حالته تتغير
const DISMISSED_KEY = "gtech-strip-dismissed"; // { orderId: الحالة اللي اتقفل عليها }
const RECENT_MS = 2 * 86400000; // الطلب اللي اتوصّل أو اتلغى بيفضل ظاهر يومين
let stopStrip = () => {};
let stripNotify = statusChangeNotifier();

function isActive(o) {
  if (["new", "confirmed", "shipped"].includes(o.status)) return true;
  return Date.now() - new Date(o.updatedAt || o.createdAt) < RECENT_MS;
}

function startOrderStrip() {
  stopStrip();
  stripNotify = statusChangeNotifier();
  $("#orderStrip").hidden = true;
  if (!user || !store.get(HAS_ORDERS_KEY, false)) return;
  stopStrip = watchMyOrders(myOrdersPhone(), renderOrderStrip, (err) => console.warn("order strip", err));
}

function renderOrderStrip(list) {
  const orders = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  stripNotify(orders);
  const dismissed = store.get(DISMISSED_KEY, {});
  const active = orders.filter((o) => isActive(o) && dismissed[o.id] !== o.status);
  const strip = $("#orderStrip");
  if (!active.length) return (strip.hidden = true);

  const o = active[0];
  const more = active.length - 1;
  strip.hidden = false;
  strip.innerHTML = `
    <div class="container order-strip__inner status-${o.status}">
      <div class="order-strip__info">
        <small>طلبك <b class="mono">${escapeHtml(o.id)}</b> · ${fmt(o.totals.total)}</small>
        <div class="order-strip__status">${trackPill(o.status)}</div>
        <p>${STATUS_HINTS[o.status]}</p>
      </div>
      <div class="order-strip__track">${trackBar(o.status)}</div>
      <div class="order-strip__actions">
        <a href="myorders.html" class="btn btn--primary btn--sm">تفاصيل الطلب${more ? ` <span class="order-strip__more">+${num(more)}</span>` : ""}</a>
        <button class="icon-btn order-strip__close" data-dismiss="${escapeHtml(o.id)}" data-status="${o.status}" aria-label="إخفاء">✕</button>
      </div>
    </div>`;
}

$("#orderStrip").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dismiss]");
  if (!b) {
    if (e.target.closest(".order-strip__info")) location.href = "myorders.html";
    return;
  }
  // بيتخفى لحد ما حالة الطلب تتغير
  const dismissed = store.get(DISMISSED_KEY, {});
  dismissed[b.dataset.dismiss] = b.dataset.status;
  store.set(DISMISSED_KEY, dismissed);
  startOrderStrip();
});

document.addEventListener("userchange", startOrderStrip);
startOrderStrip();

// ============ زوار إعلان تيك توك ============
// الإعلان بيقول "سيت أب الجيمنج اللاسلكي كامل، اختار اللي يناسبك" ولينكه على الرئيسية،
// فاللي جاي منه بيلاقي منتجات الإعلان نفسها أول حاجة بدل ما يدوّر عليها
const TIKTOK_PICKS = [18, 19, 49]; // G309 · Pulsefire Fuse · Cloud II Core
const fromTikTok = (() => {
  try {
    if (detectSource() === "tiktok") sessionStorage.setItem("gtech-tt-land", "1");
    return sessionStorage.getItem("gtech-tt-land") === "1";
  } catch { return false; }
})();

function renderTikTokLanding() {
  const box = $("#ttLand");
  if (!box || !fromTikTok) return;
  const items = TIKTOK_PICKS.map((id) => shopProducts().find((p) => p.id === id)).filter((p) => p && inStock(p));
  box.hidden = !items.length;
  if (!items.length) return;
  box.innerHTML = `
    <div class="container">
      <div class="tt-land__head">
        <span class="tt-land__eyebrow">🎬 من إعلان تيك توك</span>
        <h2 id="ttLandTitle">السيت أب اللاسلكي اللي شفته 👇</h2>
        <p>اختار اللي يناسبك · الدفع عند الاستلام · توصيل القاهرة والجيزة</p>
      </div>
      <div class="tt-land__grid">${items.map((p) => {
        const off = discount(p);
        return `
        <article class="tt-card" style="--cc:${CATEGORY_COLORS[p.cat] || "#0a84ff"}">
          <a class="tt-card__img" href="${productUrl(p.id)}" aria-label="${escapeHtml(p.name)}">
            ${floatsFor(p) ? `<img src="images/float/${p.id}.webp" alt="${escapeHtml(p.name)}">` : productVisual(p)}
            ${off ? `<em class="tt-card__off" dir="ltr">-${num(off)}%</em>` : ""}
          </a>
          <small>${escapeHtml(p.brand)}</small>
          <h3><a href="${productUrl(p.id)}">${escapeHtml(p.name)}</a></h3>
          ${p.highlights?.[0] ? `<p class="tt-card__hl">${escapeHtml(p.highlights[0])}</p>` : ""}
          <div class="tt-card__price"><b>${fmt(p.price)}</b>${p.old ? `<s>${fmt(p.old)}</s>` : ""}</div>
          <div class="tt-card__cta"><button type="button" class="btn btn--primary" data-add="${p.id}">🛒 أضف للسلة</button><a class="btn btn--ghost" href="${productUrl(p.id)}">التفاصيل</a></div>
        </article>`;
      }).join("")}</div>
    </div>`;
}
document.addEventListener("productschange", renderTikTokLanding);
document.addEventListener("catalogloaded", renderTikTokLanding);
renderTikTokLanding();

// ============ مسرح المنتجات في الواجهة ============
// منتج متاح من كل قسم (من اللي ليهم صورة مقصوصة) بيطلع على المنصة واحد ورا التاني، ووراه اسم القسم وكارت بسعره الحقيقي
const STAGE_PICKS = [["mice", "MOUSE"], ["controllers", "CONTROLLER"], ["audio", "HEADSET"], ["keyboards", "KEYBOARD"], ["earphones", "EARBUDS"], ["speakers", "SPEAKER"]];
const STAGE_MS = 4200;
let stageItems = [], stageIndex = 0, stageTimer = null, stagePaused = false, stageSig = "";

function renderStage() {
  const box = $("#heroStage");
  if (!box) return;
  const live = shopProducts().filter((p) => inStock(p) && floatsFor(p));
  const items = STAGE_PICKS.map(([cat, word]) => {
    const p = live.filter((x) => x.cat === cat).sort((a, b) => discount(b) - discount(a) || a.price - b.price)[0];
    return p && { p, word };
  }).filter(Boolean);
  const sig = items.map(({ p }) => `${p.id}:${p.price}:${p.old}`).join("|");
  if (!items.length || sig === stageSig) return;
  stageSig = sig;
  stageItems = items;
  $("#stageItems").innerHTML = items.map(({ p }, i) =>
    `<img class="stage__img stage__img--${p.cat}" src="images/float/${p.id}.webp" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`).join("");
  $("#stageThumbs").innerHTML = items.map(({ p }, i) =>
    `<button type="button" class="stage__thumb" data-stage="${i}" aria-label="${escapeHtml(p.name)}" style="--cc:${CATEGORY_COLORS[p.cat] || "#0a84ff"}"><img src="images/float/${p.id}.webp" alt="" loading="lazy"></button>`).join("");
  showStage(Math.min(stageIndex, items.length - 1));
}

function showStage(i) {
  const box = $("#heroStage");
  if (!box || !stageItems.length) return;
  stageIndex = (i + stageItems.length) % stageItems.length;
  const { p, word } = stageItems[stageIndex];
  box.style.setProperty("--cc", CATEGORY_COLORS[p.cat] || "#0a84ff");
  box.querySelectorAll(".stage__img").forEach((img, n) => img.classList.toggle("is-active", n === stageIndex));
  box.querySelectorAll(".stage__thumb").forEach((b, n) => b.setAttribute("aria-pressed", n === stageIndex));
  const w = $("#stageWord");
  w.textContent = word;
  w.classList.remove("is-in"); void w.offsetWidth; w.classList.add("is-in");
  const off = discount(p);
  const tag = $("#stageTag");
  tag.href = productUrl(p.id);
  tag.hidden = false;
  tag.innerHTML = `
    <small>${escapeHtml(p.brand)}</small>
    <b>${escapeHtml(p.name)}</b>
    <span class="stage__price">${fmt(p.price)}${p.old ? ` <s>${fmt(p.old)}</s>` : ""}${off ? ` <em dir="ltr">-${num(off)}%</em>` : ""}</span>
    <span class="stage__cta">اطلبه ←</span>`;
  tag.classList.remove("is-in"); void tag.offsetWidth; tag.classList.add("is-in");
  clearTimeout(stageTimer);
  if (!stagePaused && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    stageTimer = setTimeout(() => showStage(stageIndex + 1), STAGE_MS);
  }
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-stage]");
  if (t) showStage(+t.dataset.stage);
});
const stageBox = $("#heroStage");
stageBox?.addEventListener("pointerenter", () => { stagePaused = true; clearTimeout(stageTimer); });
stageBox?.addEventListener("pointerleave", () => { stagePaused = false; showStage(stageIndex); });
document.addEventListener("productschange", renderStage);
document.addEventListener("catalogloaded", renderStage);
renderStage();

// لو تحميل المنتجات فشل (من غير ما تتغير) نحدّث الرسالة بدل "جاري التحميل"
document.addEventListener("catalogloaded", () => { renderProducts(); renderCategories(); renderMiniOffers(); });

// ============ شريط الماركات: الماركات اللي في المتجر فعلاً ============
// بالترتيب حسب عدد المنتجات، والضغط على أي ماركة بيفلتر المنتجات بيها
function renderBrands() {
  const counts = {};
  shopProducts().forEach((p) => { const b = String(p.brand || "").trim().toUpperCase(); if (b) counts[b] = (counts[b] || 0) + 1; });
  const list = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (list.length < 3) return;
  const item = (b, dup) => `<button type="button" class="brands__item" data-brand="${escapeHtml(b)}" ${dup ? 'aria-hidden="true" tabindex="-1"' : ""}>${escapeHtml(b)}</button>`;
  // نسختين ورا بعض عشان الحركة تلف من غير ما تقطع
  $("#brandsTrack").innerHTML = list.map((b) => item(b)).join("") + list.map((b) => item(b, true)).join("");
}
renderBrands();
document.addEventListener("productschange", renderBrands);
document.addEventListener("catalogloaded", renderBrands);

$("#brandsTrack").addEventListener("click", (e) => {
  const b = e.target.closest("[data-brand]");
  if (!b) return;
  filters.brands.clear();
  filters.brands.add(b.dataset.brand);
  showAll = true;
  setFilter("all");
  $("#products").scrollIntoView({ behavior: "smooth" });
});

// ============ فيديوهات المنتجات ============
// الفيديو مش بيتحمّل غير لما يقرب من الشاشة، وبيشتغل وهو ظاهر بس (توفير نت وبطارية)
const reelVideos = $$("#reels video");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
if ("IntersectionObserver" in window && !reduceMotion) {
  const reelObserver = new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.35 });
  reelVideos.forEach((v) => reelObserver.observe(v));
}

// ============ كارت "جهّز سيتك": أقل سعر لسيت جيمنج كامل (ماوس + كيبورد + سماعة) من المتاح ============
function renderSetupPromo() {
  const el = $("#setupPromoFrom");
  if (!el) return;
  const gaming = /جيمنج|gaming/i;
  const cheapest = (cat, needGaming) => shopProducts()
    .filter((p) => inStock(p) && p.price > 0 && productCategory(p) === cat && (!needGaming || gaming.test(p.name)))
    .reduce((m, p) => Math.min(m, p.price), Infinity);
  const from = cheapest("mice", true) + cheapest("keyboards") + cheapest("audio", true);
  el.textContent = Number.isFinite(from) ? ` — سيت كامل يبدأ من ${fmt(from)}` : "";
}
document.addEventListener("productschange", renderSetupPromo);
renderSetupPromo();
