#!/usr/bin/env bash
# ضغط ملفات الموقع المنشورة (JS و CSS): أصغر وأسرع في التحميل، وأصعب في النسخ والفهم.
# الكود الأصلي المقروء بيفضل في الريبو زي ما هو؛ ده بيشتغل على نسخة النشر بس (_site).
set -euo pipefail
SITE="${1:-_site}"
ESBUILD="npx -y esbuild@0.24.0"
BANNER="/*! © $(date +%Y) ZiraTech — GTECH MASR. جميع الحقوق محفوظة. ممنوع النسخ أو إعادة الاستخدام بدون إذن كتابي. */"
mapfile -t files < <(find "$SITE" -maxdepth 2 \( -name "*.js" -o -name "*.css" \) -not -path "*/p/*" -not -path "*/c/*")
before=$(cat "${files[@]}" | wc -c)
for f in "${files[@]}"; do
  case "$f" in *.js) ban="--banner:js=$BANNER" ;; *.css) ban="--banner:css=$BANNER" ;; esac
  # من غير --format: الملفات سكريبتات عادية، فالأسماء العامة (اللي الملفات بتشاركها) بتفضل زي ما هي
  $ESBUILD "$f" --minify --charset=utf8 --legal-comments=none --target=es2020 "$ban" --log-level=warning --allow-overwrite --outfile="$f" </dev/null
done
after=$(cat "${files[@]}" | wc -c)
echo "minified ${#files[@]} files: $before → $after bytes"
