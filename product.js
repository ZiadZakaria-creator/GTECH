// ============ صفحة المنتج ============
const productId = +new URLSearchParams(location.search).get("id");
const product = findProduct(productId);

const reviewPool = [
  { name: "أحمد محمود", city: "القاهرة", stars: 5, text: "المنتج أصلي ووصل في معاده، والتغليف ممتاز. أنصح بيه جداً." },
  { name: "سارة علي", city: "الإسكندرية", stars: 5, text: "أحسن سعر لقيته في السوق، وخدمة العملاء ردّت على كل أسئلتي بسرعة." },
  { name: "محمد حسن", city: "المنصورة", stars: 4, text: "أداء ممتاز وجودة عالية، بس كنت أتمنى التوصيل يبقى أسرع شوية." },
  { name: "نورهان سامي", city: "الجيزة", stars: 5, text: "اشتريته بالتقسيط والإجراءات كانت سهلة جداً. الجهاز فوق الممتاز." },
  { name: "كريم عادل", city: "طنطا", stars: 4, text: "يستاهل كل جنيه، والضمان الرسمي مطمّني." },
  { name: "ياسمين خالد", city: "أسيوط", stars: 5, text: "تاني مرة أشتري من GTECH ومش هتكون الأخيرة. شكراً ليكم!" },
];
const views = [
  { label: "أمامي", style: "" },
  { label: "جانبي", style: "transform: rotate(-18deg) scale(.95)" },
  { label: "خلفي", style: "transform: scaleX(-1)" },
  { label: "العلبة", icon: "📦", style: "" },
];

let qty = 1;
let userReviews = [];

function notFound() {
  document.title = "GTECH | المنتج غير موجود";
  $("#productDetail").innerHTML = `
    <div class="container pd-missing">
      <span>🔍</span>
      <h1>المنتج ده مش موجود</h1>
      <p>ممكن يكون الرابط غلط أو المنتج اتشال من المتجر.</p>
      <a href="index.html#products" class="btn btn--primary">تصفح المنتجات</a>
    </div>`;
  $("#pdTabs").parentElement.remove();
  renderRelated(products.slice(0, 4));
}

let gallery = views;

function renderDetail(p) {
  if (p.images?.length) gallery = p.images.map((src, i) => ({ label: `صورة ${num(i + 1)}`, src }));
  const off = discount(p);
  const monthly = Math.ceil(p.price / 12);
  const lowStock = p.stock <= 5;
  const delivery = new Date(Date.now() + 2 * 86400000).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

  document.title = `${p.name} | GTECH`;
  $('meta[name="description"]').setAttribute("content", p.desc);

  $("#breadcrumb").innerHTML = `
    <a href="index.html">الرئيسية</a><span>›</span>
    <a href="index.html?cat=${p.cat}#products">${categories[p.cat]}</a><span>›</span>
    <b>${p.name}</b>`;

  const optionsHtml = Object.entries(p.options).map(([label, values]) => `
    <div class="pd-option">
      <span class="pd-option__label">${label}: <b data-opt-value="${label}">${values[0]}</b></span>
      <div class="chips" data-opt="${label}">
        ${values.map((v, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-value="${v}">${v}</button>`).join("")}
      </div>
    </div>`).join("");

  $("#productDetail").innerHTML = `
    <div class="container pd__grid">
      <div class="gallery">
        <div class="gallery__stage" id="stage" style="--tint:${p.tint}">
          ${p.tag ? `<span class="product__tag ${p.tag === "جديد" ? "product__tag--new" : ""}">${p.tag}</span>` : ""}
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
        <a href="index.html?q=${encodeURIComponent(p.brand)}" class="product__brand">${p.brand}</a>
        <h1>${p.name}</h1>
        <div class="pd__meta">
          <span class="product__rating">${stars(p.rating)}</span>
          <b>${num(p.rating)}</b>
          <a href="#pdTabs" data-goto="reviews">(${num(p.reviews)} تقييم)</a>
          <span class="dot"></span>
          <span class="stock ${lowStock ? "stock--low" : ""}">${lowStock ? `⚠️ باقي ${num(p.stock)} قطع بس` : "✔ متوفر في المخزون"}</span>
        </div>

        <div class="pd__price">
          <b>${fmt(p.price)}</b>
          ${p.old ? `<del>${fmt(p.old)}</del><span class="save">وفّر ${fmt(p.old - p.price)} (${num(off)}%)</span>` : ""}
        </div>
        <p class="pd__install">💳 أو قسّطها على 12 شهر بـ <b>${fmt(monthly)}</b> شهرياً بدون فوائد</p>

        <ul class="pd__highlights">
          ${p.highlights.map((h) => `<li>${h}</li>`).join("")}
        </ul>

        ${optionsHtml}

        <div class="pd__buy">
          <div class="stepper">
            <button id="qtyPlus" aria-label="زيادة">+</button>
            <span id="qtyVal">${num(qty)}</span>
            <button id="qtyMinus" aria-label="نقص">−</button>
          </div>
          <button class="btn btn--primary" id="addMain">${cartPlusIcon} أضف للسلة</button>
          <button class="btn btn--ghost" id="buyNow">اشتري الآن</button>
          <button class="icon-btn pd__wish ${wishlist.includes(p.id) ? "active" : ""}" data-wish="${p.id}" aria-label="أضف للمفضلة">${heartIcon}</button>
          <button class="icon-btn" id="shareBtn" aria-label="مشاركة">
            <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
          </button>
        </div>

        <div class="pd__perks">
          <div><span>🚚</span><p>توصيل متوقع <b>${delivery}</b>${p.price >= 1000 ? " — مجاناً" : ""}</p></div>
          <div><span>🛡️</span><p>ضمان رسمي من الوكيل لمدة <b>${p.cat === "accessories" ? "سنة" : "سنتين"}</b></p></div>
          <div><span>🔄</span><p>استرجاع أو استبدال مجاني خلال <b>14 يوم</b></p></div>
        </div>
      </div>
    </div>

    <div class="buybar" id="buybar">
      <div class="buybar__info">${productVisual(p)}<div><small>${p.name}</small><b>${fmt(p.price)}</b></div></div>
      <button class="btn btn--primary" id="addBar">أضف للسلة</button>
    </div>`;

  $("#panel-desc").innerHTML = `
    <div class="desc">
      <div>
        <h3>عن المنتج</h3>
        <p>${p.desc}</p>
      </div>
      <div class="desc__grid">
        ${p.highlights.map((h, i) => `<div class="desc__card"><span>${["⚡", "✨", "🔋", "🛡️"][i % 4]}</span><p>${h}</p></div>`).join("")}
      </div>
    </div>`;

  $("#panel-specs").innerHTML = `
    <table class="specs">
      <tbody>
        <tr><th>الماركة</th><td>${p.brand}</td></tr>
        <tr><th>القسم</th><td>${categories[p.cat]}</td></tr>
        ${Object.entries(p.specs).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}
        <tr><th>الضمان</th><td>${p.cat === "accessories" ? "سنة" : "سنتين"} ضمان الوكيل</td></tr>
      </tbody>
    </table>`;

  renderReviews(p);
  bindDetail(p);
}

function renderReviews(p) {
  const base = [0, 1, 2].map((i) => reviewPool[(p.id + i * 2) % reviewPool.length]);
  const list = [...userReviews, ...base];
  const dist = [5, 4, 3, 2, 1].map((s) => {
    const pct = s === 5 ? Math.round((p.rating - 3.8) * 70) : s === 4 ? Math.round((5 - p.rating) * 60) + 10 : s === 3 ? 5 : s === 2 ? 2 : 1;
    return { s, pct: Math.max(1, Math.min(95, pct)) };
  });

  $("#panel-reviews").innerHTML = `
    <div class="rv">
      <div class="rv__summary">
        <b>${num(p.rating)}</b>
        <span class="product__rating">${stars(p.rating)}</span>
        <small>بناءً على ${num(p.reviews + userReviews.length)} تقييم</small>
        <div class="rv__bars">
          ${dist.map((d) => `<div class="rv__bar"><span>${num(d.s)} ★</span><i><em style="width:${d.pct}%"></em></i><small>${num(d.pct)}%</small></div>`).join("")}
        </div>
      </div>
      <div class="rv__list">
        ${list.map((r) => `
          <article class="review">
            <div class="stars">${stars(r.stars)}</div>
            <p>"${r.text}"</p>
            <div class="review__author"><span class="avatar">${r.name[0]}</span><div><b>${r.name}</b><small>${r.city} · مشتري موثّق ✔</small></div></div>
          </article>`).join("")}
        <form class="rv__form" id="reviewForm">
          <h3>اكتب تقييمك</h3>
          <div class="rv__stars" id="starPick" data-value="5">
            ${[1, 2, 3, 4, 5].map((s) => `<button type="button" data-star="${s}" class="on" aria-label="${s} نجوم">★</button>`).join("")}
          </div>
          <input name="name" placeholder="اسمك" required maxlength="40" />
          <textarea name="text" placeholder="إيه رأيك في المنتج؟" required rows="3" maxlength="400"></textarea>
          <button class="btn btn--primary" type="submit">نشر التقييم</button>
        </form>
      </div>
    </div>`;

  const pick = $("#starPick");
  pick.addEventListener("click", (e) => {
    const b = e.target.closest("[data-star]");
    if (!b) return;
    pick.dataset.value = b.dataset.star;
    pick.querySelectorAll("button").forEach((x) => x.classList.toggle("on", +x.dataset.star <= +b.dataset.star));
  });
  $("#reviewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const esc = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    userReviews.unshift({ name: esc(f.get("name").trim()), city: "الآن", stars: +pick.dataset.value, text: esc(f.get("text").trim()) });
    renderReviews(p);
    toast("⭐ شكراً! تم نشر تقييمك");
  });
}

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
  const setQty = (n) => { qty = Math.max(1, Math.min(p.stock, n)); $("#qtyVal").textContent = num(qty); };
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

  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-goto]");
    if (go) showPanel(go.dataset.goto);
  });

  // شريط الشراء السفلي للموبايل
  new IntersectionObserver(([e]) => $("#buybar").classList.toggle("show", !e.isIntersecting && e.boundingClientRect.top < 0))
    .observe($("#addMain"));
}

function showPanel(name) {
  $$(".pd-tab").forEach((t) => t.classList.toggle("active", t.dataset.panel === name));
  $$(".pd-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
}
$("#pdTabs")?.addEventListener("click", (e) => {
  const t = e.target.closest(".pd-tab");
  if (t) showPanel(t.dataset.panel);
});

function renderRelated(list) {
  $("#relatedGrid").innerHTML = list.map(productCard).join("");
}

if (product) {
  renderDetail(product);
  const same = products.filter((x) => x.cat === product.cat && x.id !== product.id);
  const others = products.filter((x) => x.cat !== product.cat);
  renderRelated([...same, ...others].slice(0, 4));
  reveal(".pd-tabs, #related .section__head");
} else {
  notFound();
}
