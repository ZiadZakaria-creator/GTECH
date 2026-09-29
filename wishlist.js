// ============ صفحة المفضلة ============
function renderWishlist() {
  const list = wishlist.map(findProduct).filter((p) => p && isForSale(p));
  const has = list.length > 0;
  $("#wishGrid").innerHTML = list.map(productCard).join("");
  $("#wishTotal").textContent = has ? `(${num(list.length)})` : "";
  $("#wishEmpty").hidden = has;
  $("#wishActions").hidden = !has;

  const cats = new Set(list.map((p) => p.cat));
  const suggest = shopProducts()
    .filter((p) => !wishlist.includes(p.id))
    .sort((a, b) => cats.has(b.cat) - cats.has(a.cat) || b.rating - a.rating)
    .slice(0, 4);
  $("#suggestGrid").innerHTML = suggest.map(productCard).join("");
}

$("#allToCart").addEventListener("click", () => {
  wishlist.forEach((id) => {
    const p = findProduct(id);
    if (!p || !isForSale(p) || !inStock(p)) return;
    const item = cart.find((i) => i.id === id && !i.opts);
    item ? item.qty++ : cart.push({ id, qty: 1, opts: "" });
  });
  renderCart();
  toast(`🛒 تم نقل ${num(wishlist.length)} منتج للسلة`);
  openCart(true);
});

$("#clearWish").addEventListener("click", () => {
  if (!confirm("متأكد إنك عايز تمسح كل المفضلة؟")) return;
  wishlist = [];
  store.set("gtech-wish", wishlist);
  $("#wishCount").textContent = num(0);
  renderWishlist();
});

document.addEventListener("wishchange", renderWishlist);
document.addEventListener("productschange", renderWishlist);
renderWishlist();
reveal(".section__head");
