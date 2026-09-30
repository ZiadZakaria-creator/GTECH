// ============ صفحة المقارنة ============
const cmpIds = new URLSearchParams(location.search).get("ids");
if (cmpIds) {
  // رابط مقارنة متشارك: ?ids=1,2,3
  compareList = cmpIds.split(",").map(Number).filter((id) => findProduct(id)).slice(0, COMPARE_MAX);
  store.set("gtech-compare", compareList);
}

function cmpRow(label, cells, { key = label, html = false } = {}) {
  const vals = cells.map((c) => (c === undefined || c === null || c === "" ? "—" : c));
  const same = vals.every((v) => String(v) === String(vals[0]));
  return { key, same, html: `
    <tr class="${same ? "is-same" : "is-diff"}">
      <th>${escapeHtml(label)}</th>
      ${vals.map((v) => `<td>${html ? v : escapeHtml(v)}</td>`).join("")}
    </tr>` };
}

function renderCompare() {
  const items = compareList.map(findProduct).filter((p) => p && isForSale(p));
  $("#cmpEmpty").hidden = items.length >= 2;
  $("#cmpWrap").hidden = items.length < 2;
  $("#compareActions").hidden = !items.length;
  $("#addToCompare").innerHTML = `<option value="">＋ ضيف منتج</option>` + shopProducts()
    .filter((p) => !compareList.includes(p.id))
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  $("#addToCompare").disabled = compareList.length >= COMPARE_MAX;
  if (items.length < 2) {
    $("#cmpWrap").innerHTML = "";
    return;
  }

  // صفوف المواصفات: كل المواصفات اللي في أي منتج، بنفس الترتيب
  const specKeys = [...new Set(items.flatMap((p) => Object.keys(p.specs)))];
  const optKeys = [...new Set(items.flatMap((p) => Object.keys(p.options)))];
  const cheapest = Math.min(...items.map((p) => p.price));
  const bestRated = Math.max(...items.map((p) => p.rating));

  const rows = [
    cmpRow("السعر", items.map((p) => `<b class="${p.price === cheapest ? "cmp-best" : ""}">${fmt(p.price)}</b>${p.price === cheapest ? ` <span class="cmp-badge">الأرخص</span>` : ""}`), { html: true }),
    cmpRow("الخصم", items.map((p) => (p.old ? `${num(discount(p))}% (وفّر ${fmt(p.old - p.price)})` : ""))),
    cmpRow("التقييم", items.map((p) => `<span class="product__rating">${stars(p.rating)}</span> ${num(p.rating)}${p.rating === bestRated ? ` <span class="cmp-badge">الأعلى</span>` : ""}`), { html: true }),
    cmpRow("المخزون", items.map((p) => (inStock(p) ? (p.stock <= 5 ? `باقي ${num(p.stock)}` : "متوفر") : "نفد"))),
    cmpRow("الماركة", items.map((p) => p.brand)),
    cmpRow("الضمان", items.map((p) => (hasWarranty(p) ? warrantyText(p) : "من غير ضمان"))),
    cmpRow("القسم", items.map((p) => categories[p.cat])),
    ...optKeys.map((k) => cmpRow(k, items.map((p) => (p.options[k] || []).join("، ")))),
    ...specKeys.map((k) => cmpRow(k, items.map((p) => p.specs[k]))),
    cmpRow("أهم المميزات", items.map((p) => (p.highlights.length ? `<ul>${p.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>` : "")), { html: true }),
  ];

  const diffOnly = $("#diffOnly").checked;
  $("#cmpWrap").innerHTML = `
    <table class="cmp ${diffOnly ? "cmp--diff" : ""}" style="--cols:${items.length}">
      <thead>
        <tr>
          <th></th>
          ${items.map((p) => `
            <td>
              <div class="cmp-head">
                <button class="cmp-remove" data-compare="${p.id}" aria-label="شيل من المقارنة">✕</button>
                <a href="${productUrl(p.id)}" class="cmp-img" style="--tint:${p.tint}">${productVisual(p)}</a>
                <a href="${productUrl(p.id)}" class="cmp-name">${escapeHtml(p.name)}</a>
                <button class="btn btn--primary btn--sm" data-add="${p.id}" ${inStock(p) ? "" : "disabled"}>${inStock(p) ? "أضف للسلة" : "نفد"}</button>
              </div>
            </td>`).join("")}
        </tr>
      </thead>
      <tbody>${rows.map((r) => r.html).join("")}</tbody>
    </table>
    ${items[0].cat !== items[1].cat || (items[2] && items[2].cat !== items[0].cat) ? `<p class="muted cmp-note">💡 المنتجات دي من أقسام مختلفة، فمواصفات كتير هتبقى فاضية.</p>` : ""}`;
}

$("#diffOnly").addEventListener("change", renderCompare);
$("#addToCompare").addEventListener("change", (e) => {
  if (e.target.value) toggleCompare(+e.target.value);
});
document.addEventListener("comparechange", renderCompare);
document.addEventListener("productschange", renderCompare);
renderCompare();
