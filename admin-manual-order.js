// ============ طلب من واتساب ============
// العميل بيبعت طلبه على واتساب ← الأدمن يسجّله هنا، فيظهر في الطلبات والإحصائيات زي طلبات الموقع.
// الطلب بيتربط بحساب الأدمن (قواعد الأمان)، فالعميل مش هيشوفه في "طلباتي" — الأدمن بيبلّغه بالحالة على واتساب.
const moShipLabel = "شحن عادي (2-4 أيام)";
const moProducts = () => adminProducts.filter((p) => p.active !== false && inStock(p)).sort((a, b) => a.name.localeCompare(b.name, "ar"));

function moItemRow(id = "") {
  const opts = moProducts().map((p) => `<option value="${p.id}" ${String(p.id) === String(id) ? "selected" : ""}>${escapeHtml(p.name)} — ${fmt(p.price)}</option>`).join("");
  return `<div class="mo-item"><select name="item" required><option value="">اختار المنتج…</option>${opts}</select>
    <input name="qty" type="number" min="1" max="20" value="1" aria-label="الكمية" />
    <button type="button" class="icon-btn" data-mo-del aria-label="شيل المنتج">✕</button></div>`;
}

function moRead() {
  const f = $("#moForm");
  const items = [...f.querySelectorAll(".mo-item")].map((row) => {
    const p = adminProducts.find((x) => String(x.id) === row.querySelector("select").value);
    const qty = Math.max(1, Math.min(20, parseInt(row.querySelector("input").value, 10) || 1));
    return p && { id: p.id, name: p.name, options: "", price: p.price, qty };
  }).filter(Boolean);
  const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  const ship = shipCost(f.gov.value, "standard", sub);
  return { f, items, sub, ship, total: sub + (ship || 0) };
}

function moRender() {
  const { items, sub, ship, total } = moRead();
  $("#moSum").innerHTML = items.length
    ? `<div><span>المنتجات</span><span>${fmt(sub)}</span></div>
       <div><span>الشحن</span><span>${ship === null ? "اختار المحافظة" : fmt(ship)}</span></div>
       <div><span>الإجمالي (عند الاستلام)</span><b>${fmt(total)}</b></div>`
    : `<div class="muted">اختار منتج على الأقل</div>`;
}

function openManualOrder() {
  const f = $("#moForm");
  f.reset();
  $("#moGov").innerHTML = `<option value="">اختار…</option>` + GOVERNORATES.filter((g) => deliversTo(g.name)).map((g) => `<option>${g.name}</option>`).join("");
  $("#moItems").innerHTML = moItemRow();
  moRender();
  $("#moModal").hidden = false;
  f.name.focus();
}
const closeManualOrder = () => { $("#moModal").hidden = true; };

$("#manualOrderBtn").addEventListener("click", openManualOrder);
$("#moAddItem").addEventListener("click", () => { $("#moItems").insertAdjacentHTML("beforeend", moItemRow()); moRender(); });
$("#moModal").addEventListener("click", (e) => {
  if (e.target.id === "moModal" || e.target.closest("[data-close-mo]")) return closeManualOrder();
  const del = e.target.closest("[data-mo-del]");
  if (del && $("#moItems").children.length > 1) { del.closest(".mo-item").remove(); moRender(); }
});
$("#moForm").addEventListener("input", moRender);

$("#moForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { f, items, sub, ship, total } = moRead();
  const name = f.name.value.trim().replace(/\s+/g, " ");
  const err = name.length < 3 ? "اكتب اسم العميل"
    : !isValidPhone(f.phone.value) ? "رقم الموبايل غلط (11 رقم يبدأ بـ 01)"
    : !f.gov.value || ship === null ? "اختار محافظة بنوصّلها"
    : f.city.value.trim().length < 2 ? "اكتب المدينة أو المنطقة"
    : f.address.value.trim().length < 8 ? "اكتب العنوان بالتفصيل"
    : !items.length ? "اختار منتج على الأقل" : "";
  if (err) return toast("⚠️ " + err);

  const order = {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    status: "new",
    customer: { name, phone: normalizePhone(f.phone.value), email: "" },
    address: { gov: f.gov.value, city: f.city.value.trim(), street: f.address.value.trim(), notes: f.notes.value.trim() },
    items,
    shipping: { method: "standard", label: moShipLabel, cost: ship },
    payment: { method: "cod", label: "الدفع عند الاستلام" },
    promo: "",
    source: "whatsapp",
    enteredBy: "admin", // اتسجّل من اللوحة مش من الموقع
    totals: { subtotal: sub, shipping: ship, discount: 0, total },
    bundles: [],
  };
  const btn = $("#moSave");
  btn.disabled = true;
  try {
    await submitOrder(order);
    closeManualOrder();
    toast(`✅ الطلب ${order.id} اتسجّل — ${fmt(total)}`);
  } catch (err) {
    console.error(err);
    toast("❌ الطلب مااتسجّلش، جرّب تاني");
  } finally {
    btn.disabled = false;
  }
});
