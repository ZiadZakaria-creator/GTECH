// ============ لوحة التحكم: صورة عرض للمنتج (بوستر 1080×1350) ============
// بترسم بوستر للمنتج من بياناته (الصورة، المميزات، السعر) عشان يتبعت للعملاء مع رسالة الحملة
// أو يتنزّل ويتحط في الستوري/قايمة البث في واتساب.

const CARD_W = 1080;
const CARD_H = 1350;

function cardImageSrc(p) {
  const src = (p.images || [])[0];
  if (!src) return Promise.resolve("");
  if (src.startsWith("fs:")) return fetchStoredImage(src.slice(3)).catch(() => "");
  return Promise.resolve(/^(https?:|data:)/.test(src) ? src : siteUrl(src));
}

function loadImg(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// بيقسّم النص على سطور بعرض أقصى (بالكلمات)
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

const fmtNum = (n) => Number(n).toLocaleString("en-US");

async function renderPromoCard(p) {
  await Promise.all(["900 80px Cairo", "800 40px Cairo", "700 30px Cairo"].map((f) => document.fonts.load(f).catch(() => {})));
  const img = await loadImg(await cardImageSrc(p));
  const c = Object.assign(document.createElement("canvas"), { width: CARD_W, height: CARD_H });
  const ctx = c.getContext("2d");
  ctx.direction = "rtl";

  // الخلفية
  ctx.fillStyle = "#03050b";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(3,5,11,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  };
  glow(540, 560, 620, "rgba(10,132,255,.42)");
  glow(0, 1350, 520, "rgba(124,92,255,.35)");
  glow(1080, 0, 420, "rgba(0,212,255,.2)");

  // اللوجو
  ctx.save();
  ctx.direction = "ltr";
  const lg = ctx.createLinearGradient(380, 40, 440, 100);
  lg.addColorStop(0, "#00d4ff");
  lg.addColorStop(1, "#0a84ff");
  ctx.fillStyle = lg;
  roundRect(ctx, 382, 42, 62, 62, 17);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 42px Cairo";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("G", 413, 76);
  ctx.textAlign = "left";
  ctx.font = "900 50px Cairo";
  ctx.fillText("TECH", 456, 76);
  ctx.fillStyle = "#0a84ff";
  ctx.font = "800 20px Cairo";
  ctx.letterSpacing = "5px";
  ctx.fillText("MASR", 600, 92);
  ctx.restore();

  // الماركة والاسم
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (p.brand) {
    ctx.fillStyle = "#00d4ff";
    ctx.font = "800 30px Cairo";
    ctx.fillText(String(p.brand).toUpperCase(), 540, 160);
  }
  ctx.fillStyle = "#f2f6ff";
  ctx.font = "900 46px Cairo";
  const nameLines = wrapLines(ctx, p.name, 960, 2);
  nameLines.forEach((l, i) => ctx.fillText(l, 540, 218 + i * 60));

  // صورة المنتج على كارت أبيض
  const boxY = 340, boxH = 520, boxX = 150, boxW = 780;
  ctx.save();
  ctx.shadowColor = "rgba(10,132,255,.55)";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "#fff";
  roundRect(ctx, boxX, boxY, boxW, boxH, 40);
  ctx.fill();
  ctx.restore();
  if (img) {
    const s = Math.min((boxW - 60) / img.width, (boxH - 60) / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.save();
    roundRect(ctx, boxX, boxY, boxW, boxH, 40);
    ctx.clip();
    ctx.drawImage(img, boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h);
    ctx.restore();
  }
  // شارة الخصم
  const off = p.old > p.price ? Math.round((1 - p.price / p.old) * 100) : 0;
  if (off) {
    ctx.save();
    ctx.fillStyle = "#ff2d55";
    ctx.shadowColor = "rgba(255,45,85,.6)";
    ctx.shadowBlur = 24;
    roundRect(ctx, boxX + boxW - 170, boxY - 26, 190, 70, 35);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "900 38px Cairo";
    ctx.direction = "ltr";
    ctx.fillText(`-${off}%`, boxX + boxW - 75, boxY + 22);
    ctx.direction = "rtl";
  }

  // المميزات (لحد 4)
  const feats = (p.highlights || []).filter(Boolean).slice(0, 4);
  ctx.font = "700 27px Cairo";
  feats.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const w = 440, h = 62;
    const x = col === 0 ? 560 : 80, y = 888 + row * 74;
    ctx.fillStyle = "rgba(10,18,40,.9)";
    roundRect(ctx, x, y, w, h, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,132,255,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#e8eefc";
    ctx.textAlign = "right";
    ctx.fillText("✓ " + wrapLines(ctx, f, w - 40, 1)[0], x + w - 18, y + 42);
  });
  ctx.textAlign = "center";

  // السعر (والسعر القديم مشطوب جوه نفس الكارت)
  const py = feats.length > 2 ? 1052 : feats.length ? 980 : 900;
  const pg = ctx.createLinearGradient(190, py, 890, py + 110);
  pg.addColorStop(0, "#0a84ff");
  pg.addColorStop(1, "#7c5cff");
  ctx.save();
  ctx.shadowColor = "rgba(10,132,255,.5)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = pg;
  roundRect(ctx, 190, py, 700, 110, 34);
  ctx.fill();
  ctx.restore();
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  const priceTxt = fmtNum(p.price);
  ctx.font = "900 72px Cairo";
  const pw = ctx.measureText(priceTxt).width;
  ctx.font = "800 36px Cairo";
  const cw = ctx.measureText("ج.م").width;
  const oldTxt = off ? fmtNum(p.old) : "";
  ctx.font = "700 34px Cairo";
  const ow = off ? ctx.measureText(oldTxt).width + 30 : 0;
  let x0 = 540 - (cw + 14 + pw + ow) / 2;
  ctx.fillStyle = "#fff";
  ctx.font = "800 36px Cairo";
  ctx.fillText("ج.م", x0, py + 74);
  ctx.font = "900 72px Cairo";
  ctx.fillText(priceTxt, x0 + cw + 14, py + 80);
  if (off) {
    const ox = x0 + cw + 14 + pw + 30;
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "700 34px Cairo";
    ctx.fillText(oldTxt, ox, py + 72);
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox - 2, py + 61);
    ctx.lineTo(ox + ow - 28, py + 61);
    ctx.stroke();
  }
  ctx.direction = "rtl";
  ctx.textAlign = "center";

  // الفوتر
  ctx.fillStyle = "rgba(10,16,34,.92)";
  ctx.fillRect(0, CARD_H - 96, CARD_W, 96);
  ctx.fillStyle = "#0a84ff";
  ctx.fillRect(0, CARD_H - 96, CARD_W, 4);
  ctx.fillStyle = "#e8eefc";
  ctx.font = "800 30px Cairo";
  ctx.textAlign = "right";
  ctx.fillText("🛒 اطلب من: tinyurl.com/gtech-store", 1040, CARD_H - 36);
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText(`💬 ${WHATSAPP.replace(/^20/, "0")}`, 40, CARD_H - 36);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#7dffb8";
  ctx.font = "700 26px Cairo";
  ctx.fillText("💵 الدفع عند الاستلام  ·  🚚 توصيل القاهرة والجيزة", 540, CARD_H - 128);

  return new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.92));
}
