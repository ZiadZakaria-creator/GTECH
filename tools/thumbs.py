# نسخ صغيرة (WebP) من صور المنتجات للكروت والسلة والقوائم — بتتعمل وقت النشر بعد build-seo.mjs
# الصورة الأصلية (p/img/<اسم>) بتفضل لصفحة المنتج وجوجل وMerchant Center،
# والنسخة الصغيرة p/img/t/<اسم>.webp (عرضها 600px) هي اللي بتظهر في كروت المنتجات على الموبايل.
# ونفس الكلام لصور images/<منتج>/ ← images/<منتج>/t/<اسم>.webp
# التشغيل: python3 tools/thumbs.py _site
import os
import sys

from PIL import Image

MAX_W = 600       # الكارت حوالي 300px × شاشة 2x
QUALITY = 78

site = sys.argv[1] if len(sys.argv) > 1 else "_site"
before = after = count = 0


def make_thumbs(root):
    """كل صورة في root بتتعمل لها نسخة root/t/<اسم>.webp"""
    global before, after, count
    out = os.path.join(root, "t")
    os.makedirs(out, exist_ok=True)
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


# صور Firestore المحفوظة وقت النشر
make_thumbs(os.path.join(site, "p", "img"))
# صور المنتجات اللي بتترفع مع الريبو (images/<منتج>/...) — catalog.js ← productVisual
# (float صور شفافة للهيرو بمقاسها، مش محتاجة نسخة)
images = os.path.join(site, "images")
if os.path.isdir(images):
    for d in sorted(os.listdir(images)):
        if d not in ("float", "t") and os.path.isdir(os.path.join(images, d)):
            make_thumbs(os.path.join(images, d))
print(f"🖼️ {count} صورة مصغرة: {before / 1e6:.1f}MB ← {after / 1e6:.1f}MB")
