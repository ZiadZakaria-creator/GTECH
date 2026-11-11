// تحديث أسعار سيجما و2B في market-prices.json (نسخة النشر بس) مع كل نشر للموقع (كل 6 ساعات).
// سيجما: صفحة المنتج على sigma-computer.com. و2B: صفحته على qarenly.com (موقع مقارنة بيتابع 2B يومياً، لأن 2B نفسه بيقفل القراءة).
// بيقرا السعر والتوفر. لو أي صفحة فشلت، السعر القديم بيفضل زي ما هو،
// والنشر عمره ما بيقف بسببه (exit 0 دايماً).
// node tools/sigma-prices.mjs _site/market-prices.json
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] || "_site/market-prices.json";
const data = JSON.parse(readFileSync(file, "utf8"));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readSigma(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" }, signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = (await res.text()).replace(/\\"/g, '"');
    // وصف المنتج عندهم: "... for only 1799 EGP. In Stock. 2 years warranty warranty."
    const m = html.match(/for only ([\d,.]+) EGP\. (In Stock|Out of Stock|Out Of Stock)/i);
    if (!m) throw new Error("price not found");
    return { price: Math.round(Number(m[1].replace(/,/g, ""))), inStock: /^in stock$/i.test(m[2]) };
  } finally {
    clearTimeout(t);
  }
}

// صفحة Qarenly فيها meta tags جاهزة: product:price:amount و product:availability
async function readQarenly(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" }, signal: ctl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    const price = html.match(/<meta name="product:price:amount" content="([\d.]+)"/);
    const avail = html.match(/<meta name="product:availability" content="([^"]+)"/);
    if (!price) throw new Error("price not found");
    return { price: Math.round(Number(price[1])), inStock: !avail || /^in stock$/i.test(avail[1]) };
  } finally {
    clearTimeout(t);
  }
}

let ok = 0, fail = 0, changed = 0;
for (const [id, sources] of Object.entries(data.items || {})) {
  for (const s of sources) {
    const reader = s.store === "Sigma" && s.url ? readSigma
      : s.url && s.url.startsWith("https://qarenly.com/") ? readQarenly : null;
    if (!reader) continue;
    try {
      const r = await reader(s.url);
      if (r.price < 50) throw new Error("price looks wrong: " + r.price);
      const before = `${s.price}/${s.stock || ""}`;
      s.price = r.price;
      if (r.inStock) delete s.stock; else s.stock = "out";
      s.checked = new Date().toISOString();
      if (before !== `${s.price}/${s.stock || ""}`) { changed++; console.log(`#${id} ${s.store}: ${before} → ${s.price}/${s.stock || "in"}`); }
      ok++;
    } catch (err) {
      fail++;
      console.warn(`#${id} ${s.store}: ${err.message} (السعر القديم فضل زي ما هو)`);
    }
    await sleep(800); // بالراحة على موقعهم
  }
}
if (ok) data.sigmaUpdated = new Date().toISOString(); // الاسم القديم: وقت آخر قراءة أوتوماتيك (سيجما و2B)
writeFileSync(file, JSON.stringify(data));
console.log(`Auto market prices (Sigma, 2B): ${ok} ok, ${fail} failed, ${changed} changed`);
