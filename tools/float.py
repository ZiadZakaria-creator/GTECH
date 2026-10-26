"""صور المنتجات "العايمة" لمربعات الأقسام في الصفحة الرئيسية (من غير الخلفية البيضا).
بياخد أغلى 3 منتجات متوفرة في كل قسم من الموقع المنشور (catalog.json و p/img/map.json)، يشيل الخلفية بـ rembg (BiRefNet)،
ويكتب images/float/<رقم المنتج>.webp و float-images.js (رقم المنتج ← مفتاح الصورة اللي اتقصت منها).
المتجر بيستخدم الصورة العايمة بس لو أول صورة للمنتج لسه هي نفسها، وإلا بيرجع للصورة العادية.

التشغيل (مرة كل ما تتغير صور المنتجات الأغلى):  pip install "rembg[cpu]" && python3 tools/float.py
"""
import io, json, os, subprocess, sys, urllib.request
import cv2
import numpy as np
from PIL import Image
from rembg import remove, new_session

SITE = "https://ziadzakaria-creator.github.io/GTECH/"
OUT = "images/float"
get = lambda path: urllib.request.urlopen(SITE + path).read()

def cut_one(pid, file):
    """صورة واحدة في process لوحدها: BiRefNet بيمسك الذاكرة بعد كل صورة (أكتر من 13 جيجا من تاني صورة)."""
    session = new_session("birefnet-general")  # أدق من isnet: بيحافظ على الأجزاء البيضا زي تاتش باد دراع PS5
    im = Image.open(io.BytesIO(get("p/img/" + file))).convert("RGB")
    im.thumbnail((1280, 1280), Image.LANCZOS)  # الموديل بيشتغل على 1024 أصلاً
    cut = np.array(remove(im, session=session, post_process_mask=True))
    # شيل أي حتت صغيرة منفصلة عن المنتج (لوجوهات أو شارات جنب الصورة)
    a = cut[..., 3]
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 8).astype(np.uint8))
    if n > 2:
        big = st[1:, 4].max()
        keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] >= 0.03 * big])
        cut[..., 3] = np.where(keep, a, 0)
    ys, xs = np.where(cut[..., 3] > 8)
    pad = int(0.04 * max(cut.shape[:2]))
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, cut.shape[1]), min(ys.max() + pad, cut.shape[0]))
    out = Image.fromarray(cut).crop(box)
    out.thumbnail((520, 520), Image.LANCZOS)
    out.save(f"{OUT}/{pid}.webp", "WEBP", quality=88, method=6)
    print(pid, out.size, flush=True)


if len(sys.argv) == 4 and sys.argv[1] == "--one":
    cut_one(sys.argv[2], sys.argv[3])
    sys.exit(0)

catalog = json.loads(get("catalog.json"))["items"]
img_map = json.loads(get("p/img/map.json"))
by_cat = {}
for p in catalog:
    if p.get("active") is not False and p.get("images"):
        by_cat.setdefault(p.get("cat", ""), []).append(p)

os.makedirs(OUT, exist_ok=True)
done = {}
for items in by_cat.values():
    live = [p for p in items if (p.get("stock") or 0) > 0] or items
    for p in sorted(live, key=lambda p: -p["price"])[:3]:
        src = p["images"][0]
        if not src.startswith("fs:") or src[3:] not in img_map:
            continue
        if subprocess.run([sys.executable, __file__, "--one", str(p["id"]), img_map[src[3:]]]).returncode == 0:
            done[p["id"]] = src[3:]

with open("float-images.js", "w") as f:
    f.write("// اتعمل بـ tools/float.py — رقم المنتج ← مفتاح الصورة اللي اتقصت منها (images/float/<رقم>.webp)\n")
    f.write("const FLOAT_IMAGES = " + json.dumps(dict(sorted(done.items())), indent=0) + ";\n")
print(len(done), "صورة")
