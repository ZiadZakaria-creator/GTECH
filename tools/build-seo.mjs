// ============ صفحات المنتجات لجوجل (SEO) ============
// بيتشغل في GitHub Actions وقت النشر (ومرة كل يوم): بيجيب المنتجات من Firestore
// ويعمل لكل منتج صفحة ثابتة p/<رقم>.html فيها الاسم والسعر والصورة والوصف مكتوبين جاهزين
// (عشان جوجل وفيسبوك وواتساب يقروها من غير JavaScript) + sitemap.xml.
// الصفحة نفسها هي product.html بالظبط، فالعميل بيشوف نفس الصفحة ونفس المميزات.
//
// التشغيل: node tools/build-seo.mjs <فولدر الموقع> <رابط الموقع>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || "_site";
const DEFAULT_SITE = "https://ziadzakaria-creator.github.io/GTECH/";
const SITE = (process.argv[3] || DEFAULT_SITE).replace(/\/?$/, "/");

const cfg = readFileSync("firebase-config.js", "utf8").split(/^const FIREBASE_CONFIG = /m)[1] || ""; // مش المثال المتعلّق
const projectId = cfg.match(/projectId:\s*"([^"]+)"/)?.[1];
const apiKey = cfg.match(/apiKey:\s*"([^"]+)"/)?.[1];
const FS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

// نفس عرض القسم اللي في data.js (CATEGORY_SALES) عشان السعر في جوجل يطابق المتجر
const CATEGORY_SALES = JSON.parse(readFileSync("data.js", "utf8").match(/const CATEGORY_SALES = (\{[^}]*\});/)?.[1] || "{}");
const CATEGORIES = Object.fromEntries(
  [...readFileSync("data.js", "utf8").match(/const categories = \{([\s\S]*?)\};/)[1].matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

function fromFirestore(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestore);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFirestore(x)]));
  return null;
}
const docToObject = (doc) => fromFirestore({ mapValue: { fields: doc.fields || {} } });

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/key=.*/, "")}`);
  return res.json();
}

// الشحن والاسترجاع في بيانات المنتج (جوجل بيعرضهم تحت المنتج في البحث)
// التوصيل للقاهرة والجيزة بس، وسعر كل محافظة من اللوحة (settings/shipping) ولو مش متظبط بالافتراضي
const SHIP_GOVS = [["القاهرة", "C"], ["الجيزة", "GZ"]]; // كود المحافظة ISO 3166-2 من غير EG-
let shipRates = { "القاهرة": 60, "الجيزة": 60 };
const shippingDetails = () => SHIP_GOVS.filter(([g]) => shipRates[g] != null).map(([g, code]) => ({
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: shipRates[g], currency: "EGP" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "EG", addressRegion: code },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 3, unitCode: "DAY" },
  },
}));
// زي policies.html: 14 يوم، مصاريف شحن الإرجاع على العميل لو غيّر رأيه (وعلينا لو عيب صناعة)
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "EG",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  refundType: "https://schema.org/FullRefund",
  merchantReturnLink: `${SITE}policies.html#returns`,
};

// Google Merchant Center: ملف منتجات (merchant-feed.xml) بيتعمل مع كل نشر
// الشحن مش في الملف — بيتظبط من Merchant Center (القاهرة والجيزة بس)
const FEED = [];
const feedItem = (p, url, images, inStock, descText) => {
  const money = (n) => `${Number(n).toFixed(2)} EGP`;
  const sale = p.old && p.old > p.price;
  FEED.push(`    <item>
      <g:id>${p.id}</g:id>
      <g:title>${esc(clip(p.name, 150))}</g:title>
      <g:description>${esc(clip(descText, 4900))}</g:description>
      <g:link>${esc(url)}</g:link>
${images.length ? `      <g:image_link>${esc(images[0])}</g:image_link>\n${images.slice(1, 10).map((u) => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n")}` : ""}
      <g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${money(sale ? p.old : p.price)}</g:price>
${sale ? `      <g:sale_price>${money(p.price)}</g:sale_price>` : ""}
      <g:condition>new</g:condition>
${p.brand ? `      <g:brand>${esc(p.brand)}</g:brand>` : ""}
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${esc(CATEGORIES[p.cat] || "منتجات")}</g:product_type>
    </item>`.replace(/\n\s*\n/g, "\n"));
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
const price = (n) => Number(n).toLocaleString("en-US");
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// الصور المرفوعة من اللوحة متخزنة جوه Firestore، فبنطلعها ملفات عادية عشان جوجل يقدر يفهرسها
async function imageUrls(p) {
  const urls = [];
  for (const [i, src] of (p.images || []).slice(0, 4).entries()) {
    try {
      if (src.startsWith("fs:")) {
        const data = docToObject(await getJson(`${FS}/productImages/${encodeURIComponent(src.slice(3))}?key=${apiKey}`)).data;
        const m = data?.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!m) continue;
        const name = `${p.id}-${i + 1}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
        writeFileSync(join(OUT, "p/img", name), Buffer.from(m[2], "base64"));
        urls.push(`${SITE}p/img/${name}`);
      } else if (/^https?:/.test(src)) {
        urls.push(src);
      } else if (!src.startsWith("data:")) {
        urls.push(SITE + src.replace(/^\.?\//, ""));
      }
    } catch (err) {
      console.warn(`image ${p.id}#${i + 1}:`, err.message);
    }
  }
  return urls;
}

// نفس تخمين القسم اللي في catalog.js للمنتجات اللي اتسجلت قبل الأقسام الجديدة
const CATEGORY_GUESS = [
  ["controllers", /دراع|ذراع|يد تحكم|controller|gamepad|جيم ?باد/i],
  ["speakers", /سبيكر|سماعة (?:محمولة|بلوتوث محمولة)|speaker|soundbar|ساوند ?بار/i],
  ["mice", /ماوس|mouse/i], ["keyboards", /كيبورد|keyboard/i], ["gpus", /كارت شاشة|كروت شاشة|rtx|gtx|radeon|graphics card/i],
  ["monitors", /شاشة|شاشه|monitor/i], ["storage", /هارد|ssd|hdd|nvme|فلاشة|flash/i],
  ["earphones", /إيربودز|ايربودز|إيربدز|earbud|earphone|airpods|buds|tws|in-ear|سماعة (?:سلك|أذن|اذن|بلوتوث)/i],
  ["audio", /سماع|headset|headphone/i],
];
const productCategory = (p) => (CATEGORIES[p.cat] ? p.cat
  : CATEGORY_GUESS.find(([, re]) => re.test(`${p.name || ""} ${p.specs?.["النوع"] || ""}`))?.[0] || p.cat || "");

function productPage(template, p, images, reviews = []) {
  const url = `${SITE}p/${p.id}.html`;
  p = { ...p, cat: productCategory(p) };
  const sale = Number(CATEGORY_SALES[p.cat]) || 0;
  if (sale && p.price > 0) p = { ...p, old: p.price, price: Math.round(p.price * (1 - sale / 100)) };
  const cat = CATEGORIES[p.cat] || "منتجات";
  const inStock = (p.stock ?? 1) > 0;
  const specs = Object.entries(p.specs || {}).filter(([, v]) => v);
  const highlights = (p.highlights || []).filter(Boolean);
  const descText = (p.desc || highlights.join("، ") || p.name).replace(/\s+/g, " ").trim();
  const title = `${p.name} بسعر ${price(p.price)} جنيه | GTECH MASR`;
  const description = clip(`${p.name} — ${descText}`, 160);
  const model = specs.find(([k]) => /موديل/.test(k))?.[1];
  if (images.length && p.price > 0) feedItem(p, url, images, inStock, descText);

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: String(p.id),
    ...(model && { mpn: model }),
    ...(images.length && { image: images }),
    description: descText,
    ...(p.brand && { brand: { "@type": "Brand", name: p.brand } }),
    category: cat,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EGP",
      price: p.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "GTECH MASR" },
      shippingDetails: shippingDetails(),
      hasMerchantReturnPolicy: RETURN_POLICY,
    },
  };
  // تقييمات العملاء الحقيقية بس (لو مفيش، مفيش نجوم)
  if (reviews.length) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number((reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1)),
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1,
    };
    product.review = reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      datePublished: String(r.createdAt).slice(0, 10),
      reviewRating: { "@type": "Rating", ratingValue: r.stars, bestRating: 5 },
      ...(r.text && { reviewBody: r.text }),
    }));
  }
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE },
      { "@type": "ListItem", position: 2, name: cat, item: `${SITE}?cat=${p.cat}` },
      { "@type": "ListItem", position: 3, name: p.name, item: url },
    ],
  };

  const head = `
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="GTECH MASR" />
  <meta property="og:locale" content="ar_EG" />
  <meta property="og:title" content="${esc(p.name)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${esc(images[0] || SITE + "images/og-cover.jpg?v=3")}" />
  <meta property="product:price:amount" content="${p.price}" />
  <meta property="product:price:currency" content="EGP" />
  <meta name="twitter:card" content="summary_large_image" />
  ${jsonLd(product)}
  ${jsonLd(crumbs)}`;

  // نسخة مكتوبة من المنتج بتظهر لحد ما الصفحة تحمّل (وهي اللي جوجل بيقراها)
  const body = `
    <div class="container seo-pd">
      ${images[0] ? `<img src="${esc(images[0])}" alt="${esc(p.name)}" width="600" height="600" />` : ""}
      <div>
        <p class="seo-pd__crumbs"><a href="index.html">الرئيسية</a> › <a href="index.html?cat=${esc(p.cat)}#products">${esc(cat)}</a></p>
        <h1>${esc(p.name)}</h1>
        <p class="seo-pd__price"><b>${price(p.price)} ج.م</b>${p.old ? ` <s>${price(p.old)} ج.م</s>` : ""} — ${inStock ? "متوفر" : "نفد من المخزون"}</p>
        ${p.brand ? `<p>الماركة: ${esc(p.brand)}</p>` : ""}
        ${p.warranty ? `<p>الضمان: ${esc(p.warranty)}</p>` : ""}
        ${p.desc ? `<p>${esc(p.desc)}</p>` : ""}
        ${highlights.length ? `<ul>${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
        ${specs.length ? `<table>${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>` : ""}
      </div>
    </div>`;

  return template
    .replace('<html lang="ar" dir="rtl">', `<html lang="ar" dir="rtl" data-product="${p.id}">`)
    .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n  <base href="../" />')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />${head}`)
    .replace('<section class="pd" id="productDetail"></section>', `<section class="pd" id="productDetail">${body}</section>`);
}

function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map((e) => `  <url>
    <loc>${esc(e.url)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ""}${(e.images || []).map((i) => `\n    <image:image><image:loc>${esc(i)}</image:loc></image:image>`).join("")}
  </url>`).join("\n")}
</urlset>
`;
}

// روابط عادية لكل المنتجات في الصفحة الرئيسية، متقسمة بالأقسام،
// عشان جوجل يلاقي صفحات المنتجات من غير ما يستنى الـ JavaScript
function productLinks(list) {
  const index = join(OUT, "index.html");
  const groups = {};
  for (const p of list) (groups[productCategory(p)] ||= []).push(p);
  const cats = [...Object.keys(CATEGORIES).filter((c) => groups[c]), ...Object.keys(groups).filter((c) => !CATEGORIES[c])];
  const html = `<section class="container all-links" aria-label="كل المنتجات">
    <details>
      <summary>كل منتجات GTECH MASR (${list.length})</summary>
      ${cats.map((c) => `<div class="all-links__cat">
        <h3><a href="index.html?cat=${esc(c)}#products">${esc(CATEGORIES[c] || "منتجات تانية")}</a></h3>
        <ul>${groups[c].map((p) => `<li><a href="p/${p.id}.html">${esc(p.name)}</a></li>`).join("")}</ul>
      </div>`).join("\n      ")}
    </details>
  </section>`;
  writeFileSync(index, readFileSync(index, "utf8").replace("<!--SEO-PRODUCT-LINKS-->", html));
}

const template = readFileSync("product.html", "utf8");
mkdirSync(join(OUT, "p/img"), { recursive: true });
const entries = [{ url: SITE }, { url: `${SITE}policies.html` }];
try {
  const s = docToObject(await getJson(`${FS}/settings/shipping?key=${apiKey}`));
  for (const [g] of SHIP_GOVS) if (s.rates && g in s.rates) shipRates[g] = s.rates[g] == null ? null : Number(s.rates[g]);
} catch (err) {
  console.warn("shipping settings (بنستخدم الافتراضي):", err.message);
}
try {
  const docs = (await getJson(`${FS}/products?pageSize=300&key=${apiKey}`)).documents || [];
  const list = docs.map(docToObject).filter((p) => p.active !== false && p.id).sort((a, b) => a.id - b.id);
  let reviews = [];
  try {
    let token = "";
    do {
      const body = await getJson(`${FS}/reviews?pageSize=300&key=${apiKey}${token ? `&pageToken=${token}` : ""}`);
      reviews.push(...(body.documents || []).map(docToObject));
      token = body.nextPageToken || "";
    } while (token);
  } catch (err) {
    console.warn("reviews:", err.message);
  }
  for (const p of list) {
    const images = await imageUrls(p);
    const mine = reviews.filter((r) => r.productId === p.id && r.stars >= 1 && r.stars <= 5)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    writeFileSync(join(OUT, `p/${p.id}.html`), productPage(template, p, images, mine));
    entries.push({ url: `${SITE}p/${p.id}.html`, lastmod: p.updatedAt, images });
  }
  console.log(`✅ ${list.length} صفحة منتج`);
  productLinks(list);
} catch (err) {
  // لو Firestore مردّش مانوقفش النشر: روابط p/ هتتحول لـ product.html من 404.html
  console.warn("⚠️ مقدرناش نجيب المنتجات:", err.message);
}
writeFileSync(join(OUT, "sitemap.xml"), sitemap(entries));
writeFileSync(join(OUT, "merchant-feed.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>GTECH MASR</title>
    <link>${SITE}</link>
    <description>إكسسوارات جيمنج وكمبيوتر أصلية — توصيل القاهرة والجيزة</description>
${FEED.join("\n")}
  </channel>
</rss>
`);
console.log(`🛒 merchant-feed.xml: ${FEED.length} منتج`);

// لو الموقع اتنقل على دومين تاني، روابط الصفحة الرئيسية بتتظبط لوحدها
if (SITE !== DEFAULT_SITE) {
  const index = join(OUT, "index.html");
  writeFileSync(index, readFileSync(index, "utf8").replaceAll(DEFAULT_SITE, SITE));
}
