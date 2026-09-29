// ============ صفحة إتمام الشراء ============
const FREE_SHIP_MIN = 1000;
const shipRates = { standard: 60, express: 150 };
const promos = { GTECH10: 0.1 };
const payLabels = { cod: "الدفع عند الاستلام", card: "بطاقة بنكية", install: "تقسيط بدون فوائد", wallet: "محفظة إلكترونية" };

const form = $("#checkoutForm");
let promo = null;
let placed = false;

const toLatinDigits = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

function totals() {
  const sub = cart.reduce((s, i) => s + i.qty * findProduct(i.id).price, 0);
  const method = form.ship.value;
  const ship = method === "standard" && sub >= FREE_SHIP_MIN ? 0 : shipRates[method];
  const disc = promo ? Math.round(sub * promos[promo]) : 0;
  return { sub, ship, disc, total: sub + ship - disc };
}

function renderSummary() {
  if (placed) return;
  const empty = !cart.length;
  $("#checkoutView").hidden = empty;
  $("#emptyView").hidden = !empty;
  if (empty) return;

  const count = cart.reduce((s, i) => s + i.qty, 0);
  $("#sumCount").textContent = `(${num(count)} منتج)`;
  $("#sumItems").innerHTML = cart.map((i) => {
    const p = findProduct(i.id);
    return `
      <div class="sum-item">
        <span class="sum-item__icon">${p.icon}<i>${num(i.qty)}</i></span>
        <div><b>${p.name}</b>${i.opts ? `<small>${i.opts}</small>` : ""}</div>
        <strong>${fmt(p.price * i.qty)}</strong>
      </div>`;
  }).join("");

  const t = totals();
  const freeStd = t.sub >= FREE_SHIP_MIN;
  $('[data-ship-price="standard"]').textContent = freeStd ? "مجاناً" : fmt(shipRates.standard);
  $('[data-ship-price="express"]').textContent = fmt(shipRates.express);
  $("#sumSub").textContent = fmt(t.sub);
  $("#sumShip").textContent = t.ship ? fmt(t.ship) : "مجاناً";
  $("#sumDiscRow").hidden = !t.disc;
  $("#sumDisc").textContent = "− " + fmt(t.disc);
  $("#sumTotal").textContent = fmt(t.total);
}

// ============ كود الخصم ============
$("#promoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = e.target.code.value.trim().toUpperCase();
  if (!code) return;
  if (promos[code]) {
    promo = code;
    toast(`🎁 تم تطبيق الكود ${code} — خصم ${num(promos[code] * 100)}%`);
  } else {
    promo = null;
    toast("❌ الكود ده مش صالح");
  }
  renderSummary();
});

// ============ التحقق من البيانات ============
const rules = {
  name: (v) => v.trim().length >= 3 || "اكتب اسمك بالكامل",
  phone: (v) => /^01[0125]\d{8}$/.test(toLatinDigits(v).replace(/\s|-/g, "")) || "رقم موبايل غير صحيح (11 رقم يبدأ بـ 01)",
  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "البريد الإلكتروني غير صحيح",
  gov: (v) => !!v || "اختار المحافظة",
  city: (v) => v.trim().length >= 2 || "اكتب المدينة أو المنطقة",
  address: (v) => v.trim().length >= 8 || "اكتب العنوان بالتفصيل",
};

function validateField(el) {
  const rule = rules[el.name];
  if (!rule) return true;
  const res = rule(el.value);
  const field = el.closest(".field");
  field.classList.toggle("invalid", res !== true);
  field.querySelector("em").textContent = res === true ? "" : res;
  return res === true;
}

form.addEventListener("focusout", (e) => { if (e.target.name in rules) validateField(e.target); });
form.addEventListener("input", (e) => {
  if (e.target.closest(".field.invalid")) validateField(e.target);
  if (e.target.name === "ship") renderSummary();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fields = Object.keys(rules).map((n) => form.elements[n]);
  const bad = fields.filter((el) => !validateField(el));
  if (bad.length) {
    bad[0].focus();
    bad[0].scrollIntoView({ behavior: "smooth", block: "center" });
    return toast("⚠️ راجع البيانات المطلوبة");
  }
  if (!form.agree.checked) return toast("⚠️ لازم توافق على الشروط والأحكام");
  placeOrder();
});

// ============ تأكيد الطلب ============
function placeOrder() {
  const t = totals();
  const d = Object.fromEntries(new FormData(form));
  const id = "GT-" + String(Date.now()).slice(-7);
  const days = d.ship === "express" ? 1 : 3;
  const date = new Date(Date.now() + days * 86400000).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });

  const orders = store.get("gtech-orders", []);
  orders.unshift({ id, at: new Date().toISOString(), items: cart, ...t, customer: { name: d.name, phone: d.phone, gov: d.gov, city: d.city, address: d.address }, ship: d.ship, pay: d.pay });
  store.set("gtech-orders", orders.slice(0, 20));

  placed = true;
  cart = [];
  renderCart();

  $("#okName").textContent = d.name.trim();
  $("#okPhone").textContent = toLatinDigits(d.phone);
  $("#okId").textContent = id;
  $("#okTotal").textContent = fmt(t.total);
  $("#okPay").textContent = payLabels[d.pay];
  $("#okDate").textContent = date;
  $("#okAddr").textContent = `${d.address.trim()}، ${d.city.trim()}، ${d.gov}`;

  $("#checkoutView").hidden = true;
  $("#successView").hidden = false;
  document.title = "GTECH | تم تأكيد الطلب";
  scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("cartchange", renderSummary);
renderSummary();
