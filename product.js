// ============ صفحة المنتج ============
// الصفحات الثابتة p/<رقم>.html (بتاعة جوجل) فيها رقم المنتج في <html data-product>
const productId = +(document.documentElement.dataset.product || new URLSearchParams(location.search).get("id"));

const views = [
  { label: "أمامي", style: "" },
  { label: "جانبي", style: "transform: rotate(-18deg) scale(.95)" },
  { label: "خلفي", style: "transform: scaleX(-1)" },
  { label: "العلبة", icon: "📦", style: "" },
];

let qty = 1;

let trackedView = null;
function notFound() {
  // الصفحة الثابتة فيها نسخة مكتوبة من المنتج، بتفضل ظاهرة لحد ما المنتجات تحمّل (أو لو التحميل فشل)
  if ((!catalogLoaded || catalogFailed) && $(".seo-pd")) return;
  $("#pdTabs").parentElement.hidden = true;
  $("#breadcrumb").innerHTML = "";
  if (!catalogLoaded) {
    $("#productDetail").innerHTML = `<div class="container pd-missing"><span class="spinner"></span><p>جاري تحميل المنتج...</p></div>`;
    return;
  }
  document.title = "GTECH | المنتج غير موجود";
  $("#productDetail").innerHTML = `
    <div class="container pd-missing">
      <span>🔍</span>
      <h1>المنتج ده مش موجود</h1>
      <p>ممكن يكون الرابط غلط أو المنتج اتشال من المتجر.</p>
      <a href="index.html#products" class="btn btn--primary">تصفح المنتجات</a>
    </div>`;
  renderRelated(shopProducts().slice(0, 4));
}

let gallery = views;

function renderDetail(p) {
  gallery = p.images?.length ? p.images.map((src, i) => ({ label: `صورة ${num(i + 1)}`, src })) : views;
  $("#pdTabs").parentElement.hidden = false;
  const esc = escapeHtml;
  const tag = inStock(p) ? productTag(p) : "نفد";
  const off = discount(p);
  const lowStock = p.stock <= 5;
  const soldOut = !inStock(p);
  const delivery = new Date(Date.now() + 2 * 86400000).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });

  document.title = `${p.name} | GTECH`;
  if (typeof track === "function" && trackedView !== p.id) { trackedView = p.id; track("view_item", { items: [{ id: p.id, name: p.name, price: p.price }] }); }
  qty = 1;
  $('meta[name="description"]').setAttribute("content", p.desc);
  if (!$('link[rel="canonical"]')) {
    document.head.insertAdjacentHTML("beforeend", `<link rel="canonical" href="${new URL(productUrl(p.id), document.baseURI).href}" />`);
  }

  $("#breadcrumb").innerHTML = `
    <a href="index.html">الرئيسية</a><span>›</span>
    <a href="index.html?cat=${p.cat}#products">${categoryLabel(p.cat)}</a><span>›</span>
    <b>${esc(p.name)}</b>`;

  const optionsHtml = Object.entries(p.options).filter(([, values]) => values?.length).map(([label, values]) => `
    <div class="pd-option">
      <span class="pd-option__label">${esc(label)}: <b data-opt-value="${esc(label)}">${esc(values[0])}</b></span>
      <div class="chips" data-opt="${esc(label)}">
        ${values.map((v, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-value="${esc(v)}">${esc(v)}</button>`).join("")}
      </div>
    </div>`).join("");

  $("#productDetail").innerHTML = `
    <div class="container pd__grid">
      <div class="gallery">
        <div class="gallery__stage" id="stage" style="--tint:${p.tint}">
          ${tag ? `<span class="product__tag ${tag === "جديد" ? "product__tag--new" : tag === "نفد" ? "product__tag--out" : ""}">${esc(tag)}</span>` : ""}
          ${productVisual(p, gallery[0].src, 'class="gallery__main" id="mainView"')}
        </div>
        <div class="gallery__thumbs">
          ${gallery.map((v, i) => `
            <button class="thumb ${v.src ? "thumb--img" : ""} ${i === 0 ? "active" : ""}" data-view="${i}" style="--tint:${p.tint}" aria-label="${v.label}">
              ${v.src ? productVisual(p, v.src) : `<span style="${v.style}">${v.icon || p.icon}</span><small>${v.label}</small>`}
            </button>`).join("")}
        </div>
      </div>

      <div class="pd__info">
        <a href="index.html?q=${encodeURIComponent(p.brand)}" class="product__brand">${esc(p.brand)}</a>
        <h1>${esc(p.name)}</h1>
        <div class="pd__meta">
          <span id="pdRating"></span>
          <span class="stock ${soldOut ? "stock--out" : lowStock ? "stock--low" : ""}">${soldOut ? "✖ نفد من المخزون" : lowStock ? `⚠️ باقي ${num(p.stock)} قطع بس` : "✔ متوفر في المخزون"}</span>
        </div>

        <div class="pd__price">
          <b>${fmt(p.price)}</b>
          ${p.old ? `<del>${fmt(p.old)}</del><span class="save">وفّر ${fmt(p.old - p.price)} (${num(off)}%)</span>` : ""}
        </div>
        <p class="pd__install">💳 <b>التقسيط هيبقى متاح قريباً</b> على GTECH — تابعنا</p>

        <ul class="pd__highlights">
          ${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}
        </ul>

        ${optionsHtml}

        <div class="pd__buy">
          <div class="stepper">
            <button id="qtyPlus" aria-label="زيادة">+</button>
            <span id="qtyVal">${num(qty)}</span>
            <button id="qtyMinus" aria-label="نقص">−</button>
          </div>
          <button class="btn btn--primary" id="addMain" ${soldOut ? "disabled" : ""}>${soldOut ? "نفد من المخزون" : `${cartPlusIcon} أضف للسلة`}</button>
          <button class="btn btn--ghost" id="buyNow" ${soldOut ? "disabled" : ""}>اشتري الآن</button>
          <button class="icon-btn pd__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heartIcon}</button>
          <button class="icon-btn pd__compare ${compareList.includes(p.id) ? "active" : ""}" data-compare="${p.id}" aria-label="قارن" title="قارن بمنتج تاني">⚖️</button>
          <button class="icon-btn" id="shareBtn" aria-label="مشاركة">
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
        </div>

        <div class="pd__alerts" id="pdAlerts">${alertButtonsHtml(p)}</div>

        <div class="pd__perks">
          <div><span>🚚</span><p>توصيل متوقع <b>${delivery}</b>${p.price >= 1000 ? " — مجاناً" : ""}</p></div>
          <div><span>🛡️</span><p>${hasWarranty(p) ? `ضمان رسمي لمدة <b>${esc(warrantyText(p))}</b>` : "المنتج ده <b>من غير ضمان</b>"}</p></div>
          <div><span>🔄</span><p><a href="policies.html#returns">استرجاع أو استبدال خلال <b>14 يوم</b></a></p></div>
        </div>
      </div>
    </div>

    <div class="buybar" id="buybar">
      <div class="buybar__info">${productVisual(p)}<div><small>${esc(p.name)}</small><b>${fmt(p.price)}</b></div></div>
      <button class="btn btn--primary" id="addBar" ${soldOut ? "disabled" : ""}>${soldOut ? "نفد" : "أضف للسلة"}</button>
    </div>`;

  $("#panel-desc").innerHTML = `
    <div class="desc">
      <div>
        <h3>عن المنتج</h3>
        <p>${esc(p.desc)}</p>
      </div>
      <div class="desc__grid">
        ${p.highlights.map((h, i) => `<div class="desc__card"><span>${["⚡", "✨", "🔋", "🛡️"][i % 4]}</span><p>${esc(h)}</p></div>`).join("")}
      </div>
    </div>`;

  $("#panel-specs").innerHTML = `
    <table class="specs">
      <tbody>
        <tr><th>الماركة</th><td>${esc(p.brand)}</td></tr>
        <tr><th>القسم</th><td>${categoryLabel(p.cat)}</td></tr>
        ${Object.entries(p.specs).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
        <tr><th>الضمان</th><td>${hasWarranty(p) ? `${esc(warrantyText(p))} ضمان رسمي` : "من غير ضمان"}</td></tr>
      </tbody>
    </table>`;

  renderReviews(p);
  bindDetail(p);
}

// ============ التقييمات (من العملاء بس) ============
let reviewFormOpen = false;
function renderReviews(p) {
  const list = reviewsFor(p.id);
  const { count, avg } = reviewSummary(p.id);
  const mine = myReviewFor(p.id);
  $("#reviewsCount").textContent = count ? `(${num(count)})` : "";
  $("#pdRating").innerHTML = count
    ? `<span class="product__rating">${stars(avg)}</span> <b>${num(Number(avg.toFixed(1)))}</b> <a href="#pdTabs" data-goto="reviews">(${num(count)} تقييم)</a><span class="dot"></span>`
    : `<a href="#pdTabs" data-goto="reviews" class="pd-rate-first">⭐ قيّم المنتج ده</a><span class="dot"></span>`;

  const dist = [5, 4, 3, 2, 1].map((s) => {
    const n = list.filter((r) => r.stars === s).length;
    return { s, pct: count ? Math.round((n / count) * 100) : 0 };
  });
  const pickValue = mine?.stars || 5;
  const form = `
    <form class="rv__form" id="reviewForm" ${reviewFormOpen ? "" : "hidden"}>
      <h3>${mine ? "عدّل تقييمك" : "اكتب تقييمك"}</h3>
      <div class="rv__stars" id="starPick" data-value="${pickValue}">
        ${[1, 2, 3, 4, 5].map((s) => `<button type="button" data-star="${s}" class="${s <= pickValue ? "on" : ""}" aria-label="${num(s)} نجوم">★</button>`).join("")}
      </div>
      <textarea name="text" placeholder="إيه رأيك في المنتج؟ (اختياري)" rows="3" maxlength="500">${escapeHtml(mine?.text || "")}</textarea>
      <button class="btn btn--primary" type="submit">${mine ? "حفظ التعديل" : "نشر التقييم"}</button>
    </form>`;

  $("#panel-reviews").innerHTML = `
    <div class="rv ${count ? "" : "rv--empty"}">
      ${count ? `
        <div class="rv__summary">
          <b>${num(Number(avg.toFixed(1)))}</b>
          <span class="product__rating">${stars(avg)}</span>
          <small>من ${num(count)} تقييم</small>
          <div class="rv__bars">
            ${dist.map((d) => `<div class="rv__bar"><span>${num(d.s)} ★</span><i><em style="width:${d.pct}%"></em></i><small>${num(d.pct)}%</small></div>`).join("")}
          </div>
        </div>` : ""}
      <div class="rv__list">
        ${count ? "" : `<div class="rv__none"><span>⭐</span><b>لسه محدش قيّم المنتج ده</b><p class="muted">جرّبته؟ كن أول واحد يقول رأيه ويساعد غيره يختار.</p></div>`}
        <button class="btn ${count ? "btn--ghost" : "btn--primary"}" id="writeReview" ${reviewFormOpen ? "hidden" : ""}>✍️ ${mine ? "عدّل تقييمك" : "قيّم المنتج"}</button>
        ${form}
        ${list.map((r) => `
          <article class="review">
            <div class="stars">${stars(r.stars)}</div>
            ${r.text ? `<p>${escapeHtml(r.text)}</p>` : ""}
            <div class="review__author"><span class="avatar">${escapeHtml(r.name.trim()[0] || "؟")}</span><div><b>${escapeHtml(r.name)}</b><small>${new Date(r.createdAt).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}</small></div></div>
          </article>`).join("")}
      </div>
    </div>`;

  $("#writeReview").addEventListener("click", () => requireLogin(() => {
    reviewFormOpen = true;
    renderReviews(p);
    $("#reviewForm textarea").focus();
  }, "سجّل دخولك عشان تقيّم المنتج"));

  const pick = $("#starPick");
  pick.addEventListener("click", (e) => {
    const b = e.target.closest("[data-star]");
    if (!b) return;
    pick.dataset.value = b.dataset.star;
    pick.querySelectorAll("button").forEach((x) => x.classList.toggle("on", +x.dataset.star <= +b.dataset.star));
  });
  $("#reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "جاري الحفظ...";
    const starsValue = +pick.dataset.value;
    const text = e.target.text.value.trim().slice(0, 500);
    reviewFormOpen = false; // الصفحة بتترسم تاني أول ما التقييم يتحفظ
    try {
      await saveReview(p.id, starsValue, text);
      renderReviews(p);
      toast("⭐ شكراً! تقييمك اتنشر");
    } catch (err) {
      console.error(err);
      reviewFormOpen = true;
      btn.disabled = false;
      btn.textContent = "جرّب تاني";
      toast("❌ التقييم ماتحفظش، جرّب تاني");
    }
  });
}
document.addEventListener("reviewschange", () => {
  const p = findProduct(productId);
  if (p && $("#panel-reviews")) renderReviews(p);
});

function selectedOptions() {
  return [...$$("[data-opt]")].map((g) => g.querySelector(".chip.active").dataset.value).join(" · ");
}

function bindDetail(p) {
  // المعرض
  $$(".thumb").forEach((t) =>
    t.addEventListener("click", () => {
      const v = gallery[+t.dataset.view];
      $$(".thumb").forEach((x) => x.classList.toggle("active", x === t));
      let main = $("#mainView");
      if (v.src) {
        main.outerHTML = productVisual(p, v.src, 'class="gallery__main" id="mainView"');
        main = $("#mainView");
      } else {
        main.textContent = v.icon || p.icon;
        main.style.cssText = v.style;
      }
      main.classList.remove("swap");
      void main.offsetWidth;
      main.classList.add("swap");
    })
  );
  const stage = $("#stage");
  stage.addEventListener("mousemove", (e) => {
    const r = stage.getBoundingClientRect();
    stage.style.setProperty("--x", ((e.clientX - r.left) / r.width - 0.5) * 20 + "deg");
    stage.style.setProperty("--y", ((e.clientY - r.top) / r.height - 0.5) * -20 + "deg");
  });
  stage.addEventListener("mouseleave", () => { stage.style.setProperty("--x", "0deg"); stage.style.setProperty("--y", "0deg"); });

  // الخيارات
  $$("[data-opt]").forEach((group) =>
    group.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
      $(`[data-opt-value="${group.dataset.opt}"]`).textContent = chip.dataset.value;
    })
  );

  // الكمية
  const setQty = (n) => { qty = Math.max(1, Math.min(Math.max(p.stock, 1), n)); $("#qtyVal").textContent = num(qty); };
  $("#qtyPlus").addEventListener("click", () => {
    if (qty >= p.stock) toast(`أقصى كمية متاحة ${num(p.stock)}`);
    setQty(qty + 1);
  });
  $("#qtyMinus").addEventListener("click", () => setQty(qty - 1));

  const add = () => addToCart(p.id, qty, selectedOptions());
  $("#addMain").addEventListener("click", add);
  $("#addBar").addEventListener("click", add);
  $("#buyNow").addEventListener("click", () => { add(); openCart(true); });

  $("#shareBtn").addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.name, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast("🔗 تم نسخ رابط المنتج"); }
    } catch {}
  });

  // شريط الشراء السفلي للموبايل
  new IntersectionObserver(([e]) => $("#buybar").classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0))
    .observe($("#addMain"));
}

function showPanel(name) {
  $$(".pd-tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === name));
  $$(".pd-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
}
// "قيّم المنتج" / "(٣ تقييم)" تحت اسم المنتج ← تاب التقييمات في نفس الصفحة
document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-goto]");
  if (!go) return;
  e.preventDefault(); // من غير ده صفحات p/ (اللي فيها <base>) كانت بتروح للرئيسية
  showPanel(go.dataset.goto);
  $("#pdTabs").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#pdTabs")?.addEventListener("click", (e) => {
  const t = e.target.closest(".pd-tab");
  if (t) showPanel(t.dataset.panel);
});

function renderRelated(list) {
  $("#relatedGrid").innerHTML = list.map(productCard).join("");
}

// بيعرض المنتج، وبيتعاد لو بياناته اتغيرت من لوحة التحكم
let shownVersion = null;
function initPage() {
  const product = findProduct(productId);
  const visible = product && isForSale(product);
  const version = visible ? JSON.stringify(product) : `missing:${catalogLoaded}`;
  if (version === shownVersion) return;
  shownVersion = version;
  if (!visible) return notFound();
  renderDetail(product);
  const same = shopProducts().filter((x) => x.cat === product.cat && x.id !== product.id);
  const others = shopProducts().filter((x) => x.cat !== product.cat);
  renderRelated([...same, ...others].slice(0, 4));
}

document.addEventListener("productschange", initPage);
document.addEventListener("alertschange", () => {
  const p = findProduct(productId);
  if (p && $("#pdAlerts")) $("#pdAlerts").innerHTML = alertButtonsHtml(p);
});
document.addEventListener("catalogloaded", initPage);
initPage();
reveal(".pd-tabs, #related .section__head");
