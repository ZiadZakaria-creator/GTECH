# نسخ صغيرة (WebP) من صور المنتجات للكروت والسلة والقوائم — بتتعمل وقت النشر بعد build-seo.mjs
# الصورة الأصلية (p/img/<اسم>) بتفضل لصفحة المنتج وجوجل وMerchant Center،
# والنسخة الصغيرة p/img/t/<اسم>.webp (عرضها 600px) هي اللي بتظهر في كروت المنتجات على الموبايل.
# التشغيل: python3 tools/thumbs.py _site
import os
import sys

from PIL import Image

MAX_W = 600       # الكارت حوالي 300px × شاشة 2x
QUALITY = 78

root = os.path.join(sys.argv[1] if len(sys.argv) > 1 else "_site", "p", "img")
out = os.path.join(root, "t")
os.makedirs(out, exist_ok=True)
before = after = count = 0
for name in sorted(os.listdir(root)):
    src = os.path.join(root, name)
    if not os.path.isfile(src) or not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
        continue
    try:
        with Image.open(src) as im:
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            dst = os.path.join(out, os.path.splitext(name)[0] + ".webp")
            im.save(dst, "WEBP", quality=QUALITY, method=6)
        before += os.path.getsize(src)
        after += os.path.getsize(dst)
        count += 1
    except Exception as err:  # صورة بايظة ماتوقفش النشر — الكارت بيرجع للصورة الأصلية
        print(f"thumb {name}: {err}")
print(f"🖼️ {count} صورة مصغرة: {before / 1e6:.1f}MB ← {after / 1e6:.1f}MB")
