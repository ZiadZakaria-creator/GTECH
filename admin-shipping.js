// ============ لوحة التحكم: الشحن ============
// 1) أسعار الشحن لكل محافظة (settings/shipping — المتجر بيقراها في صفحة الدفع)
// 2) الربط مع بوسطة: زرار في الطلب بيعمل الشحنة عندهم ويحفظ رقم التتبع في الطلب
//    مفتاح بوسطة بيتحفظ في settings/bosta (الأدمن بس يقدر يقراه)

const BOSTA_API = "https://app.bosta.co/api/v2";
const BOSTA_KEY_LOCAL = "gtech-bosta-key-local"; // الوضع التجريبي
// أسماء المحافظات زي ما بوسطة كاتباها (من app.bosta.co/api/v2/cities)
const BOSTA_CITIES = {
  "EG-01": "Cairo", "EG-02": "Alexandria", "EG-03": "North Coast", "EG-04": "Behira", "EG-05": "Dakahlia",
  "EG-06": "El Kalioubia", "EG-07": "Gharbia", "EG-08": "Kafr Alsheikh", "EG-09": "Monufia", "EG-10": "Sharqia",
  "EG-11": "Ismailia", "EG-12": "Suez", "EG-13": "Port Said", "EG-14": "Damietta", "EG-15": "Fayoum",
  "EG-16": "Bani Suif", "EG-17": "Assuit", "EG-18": "Sohag", "EG-19": "Menya", "EG-20": "Qena",
  "EG-21": "Aswan", "EG-22": "Luxor", "EG-23": "Red Sea", "EG-24": "New Valley", "EG-25": "Giza",
  "EG-26": "South Sinai", "EG-27": "North Sinai", "EG-28": "Matrouh",
};

let bostaKey = "";
const shipSending = new Set();

const settingsStore = USE_FIREBASE
  ? {
      doc: (id) => loadFirebase(["auth", "firestore"]).then(() => firebase.firestore().collection("settings").doc(id)),
      async get(id) { const snap = await (await this.doc(id)).get(); return snap.exists ? snap.data() : null; },
      async set(id, data) { await (await this.doc(id)).set(data); },
    }
  : {
      async get(id) { return id === "bosta" ? store.get(BOSTA_KEY_LOCAL, null) : store.get(SHIPPING_LOCAL, null); },
      async set(id, data) { store.set(id === "bosta" ? BOSTA_KEY_LOCAL : SHIPPING_LOCAL, data); },
    };

// ============ أسعار الشحن ============
function renderShipForm(s = shippingSettings) {
  const f = $("#shipForm");
  f.freeOver.value = s.freeOver;
  f.expressPrice.value = s.express.price;
  $("#shipRatesBody").innerHTML = GOVERNORATES.map((g) => {
    const rate = s.rates[g.name];
    const on = typeof rate === "number";
    return `
      <tr data-gov="${escapeHtml(g.name)}" class="${on ? "" : "is-off"}">
        <td><b>${escapeHtml(g.name)}</b></td>
        <td><input type="checkbox" data-f="on" ${on ? "checked" : ""} aria-label="بنوصّل ${escapeHtml(g.name)}" /></td>
        <td><input type="number" data-f="rate" min="0" step="1" inputmode="numeric" value="${on ? rate : g.rate}" ${on ? "" : "disabled"} aria-label="سعر ${escapeHtml(g.name)}" /></td>
        <td><input type="checkbox" data-f="express" ${s.express.govs.includes(g.name) ? "checked" : ""} aria-label="شحن سريع ${escapeHtml(g.name)}" /></td>
      </tr>`;
  }).join("");
}

$("#shipRatesBody").addEventListener("change", (e) => {
  if (e.target.dataset.f !== "on") return;
  const row = e.target.closest("tr");
  row.classList.toggle("is-off", !e.target.checked);
  row.querySelector('[data-f="rate"]').disabled = !e.target.checked;
});

$("#shipForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const rows = [...$$("#shipRatesBody tr")];
  const bad = rows.find((r) => r.querySelector('[data-f="on"]').checked && !(r.querySelector('[data-f="rate"]').value >= 0 && r.querySelector('[data-f="rate"]').value !== ""));
  if (bad) return toast(`⚠️ اكتب سعر الشحن لـ ${bad.dataset.gov}`);
  const data = {
    freeOver: Math.max(0, Math.round(+f.freeOver.value || 0)),
    express: {
      price: Math.max(0, Math.round(+f.expressPrice.value || 0)),
      govs: rows.filter((r) => r.querySelector('[data-f="express"]').checked).map((r) => r.dataset.gov),
    },
    rates: Object.fromEntries(rows.map((r) => [r.dataset.gov,
      r.querySelector('[data-f="on"]').checked ? Math.round(+r.querySelector('[data-f="rate"]').value) : null])),
    updatedAt: new Date().toISOString(),
  };
  const btn = $("#shipSave");
  btn.disabled = true;
  try {
    await settingsStore.set("shipping", data);
    shippingSettings = withShippingDefaults(data);
    store.set(SHIPPING_CACHE, data);
    toast("✅ أسعار الشحن اتحفظت، والعملاء هيشوفوها على طول");
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase عشان أسعار الشحن تتحفظ" : "❌ مقدرناش نحفظ، جرّب تاني");
  } finally {
    btn.disabled = false;
  }
});

$("#shipReset").addEventListener("click", () => {
  if (confirm("ترجّع كل الأسعار للافتراضي؟ (مش هتتحفظ غير لما تدوس حفظ)")) renderShipForm(withShippingDefaults({}));
});

// ============ مفتاح بوسطة ============
function bostaStatus(text, ok) {
  const el = $("#bostaStatus");
  el.textContent = text;
  el.className = "bosta-status" + (ok === true ? " is-ok" : ok === false ? " is-bad" : "");
}

async function bosta(path, opts = {}) {
  if (!bostaKey) throw new Error("حط مفتاح بوسطة الأول من تاب الشحن");
  const res = await fetch(BOSTA_API + path, {
    ...opts,
    headers: { Authorization: bostaKey, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || `بوسطة ردّت بخطأ ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body.data ?? body;
}

async function testBostaKey() {
  bostaStatus("بنجرّب المفتاح...");
  try {
    await bosta("/deliveries/search", { method: "POST", body: JSON.stringify({ pageSize: 1 }) });
    bostaStatus("✅ المفتاح شغال والربط مع بوسطة جاهز", true);
  } catch (err) {
    bostaStatus(err.status === 401 || /token|key/i.test(err.message) ? "❌ المفتاح ده مش مقبول عند بوسطة، اتأكد إنك نسخته كامل" : `⚠️ ${err.message}`, false);
  }
}

$("#bostaSave").addEventListener("click", async () => {
  const key = $("#bostaKey").value.trim();
  try {
    await settingsStore.set("bosta", { apiKey: key, updatedAt: new Date().toISOString() });
    bostaKey = key;
    if (key) testBostaKey();
    else bostaStatus("المفتاح اتمسح — زرار بوسطة مش هيظهر في الطلبات");
    if (openId) openOrder(openId, false);
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مقدرناش نحفظ المفتاح");
  }
});
$("#bostaTest").addEventListener("click", () => {
  bostaKey = $("#bostaKey").value.trim() || bostaKey;
  testBostaKey();
});

// ============ الشحنة في تفاصيل الطلب ============
function shipmentSection(o) {
  if (o.status === "cancelled" && !o.shipment) return "";
  const sh = o.shipment;
  const sending = shipSending.has(o.id);
  if (sh?.trackingNumber) {
    const url = shipmentTrackUrl(sh);
    return `
      <section class="od-sec">
        <h4>🚚 الشحنة</h4>
        <p>${escapeHtml(carrierName(sh))} — رقم التتبع <b class="mono" dir="ltr">${escapeHtml(sh.trackingNumber)}</b></p>
        <p class="bosta-state" id="shipState"></p>
        <div class="od-contact">
          ${url ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(url)}" target="_blank" rel="noopener">📍 تتبع</a>` : ""}
          ${sh.carrier === "bosta" && bostaKey ? `<button class="btn btn--ghost btn--sm" data-ship="state">🔄 حالتها عند بوسطة</button>` : ""}
          <button class="btn btn--ghost btn--sm" data-ship="clear">✖ شيل رقم التتبع</button>
        </div>
      </section>`;
  }
  return `
    <section class="od-sec">
      <h4>🚚 الشحنة</h4>
      ${bostaKey
        ? `<button class="btn btn--primary btn--block" data-ship="bosta" ${sending ? "disabled" : ""}>${sending ? "بنعمل الشحنة عند بوسطة..." : "📦 ابعت لبوسطة"}</button>
           <small class="muted">${o.payment.method === "cod" ? `المندوب هيحصّل ${fmt(o.totals.total)} من العميل` : "الطلب مدفوع — المندوب مش هيحصّل فلوس"}</small>`
        : `<small class="muted">عشان تعمل الشحنة من هنا بضغطة، حط مفتاح بوسطة من تاب "🚚 الشحن".</small>`}
      <div class="ship-manual">
        <input id="manualTracking" dir="ltr" placeholder="أو اكتب رقم تتبع من أي شركة" />
        <select id="manualCarrier" aria-label="شركة الشحن"><option value="bosta">بوسطة</option><option value="other">شركة تانية</option></select>
        <button class="btn btn--ghost btn--sm" data-ship="manual">حفظ</button>
      </div>
    </section>`;
}

function bostaDelivery(o) {
  const gov = GOVERNORATES.find((g) => g.name === o.address.gov);
  const [firstName, ...rest] = o.customer.name.trim().split(/\s+/);
  const count = itemsCount(o);
  return {
    type: 10, // توصيل طرد
    specs: {
      packageType: "Parcel",
      size: "SMALL",
      packageDetails: {
        itemsCount: count,
        description: o.items.map((i) => `${i.name}${i.options ? ` (${i.options})` : ""} x${i.qty}`).join(" | ").slice(0, 400),
      },
    },
    notes: [`طلب ${o.id}`, o.address.notes].filter(Boolean).join(" — ").slice(0, 300),
    cod: o.payment.method === "cod" ? o.totals.total : 0,
    dropOffAddress: {
      city: BOSTA_CITIES[gov?.code] || o.address.gov,
      firstLine: o.address.street,
      secondLine: o.address.city,
    },
    receiver: {
      firstName,
      lastName: rest.join(" ") || firstName,
      phone: o.customer.phone,
      ...(o.customer.email && { email: o.customer.email }),
    },
    businessReference: o.id,
    allowToOpenPackage: false,
  };
}

async function saveShipment(o, shipment, markShipped) {
  const changes = { shipment };
  if (markShipped && ["new", "confirmed"].includes(o.status)) changes.status = "shipped";
  await updateOrder(o.id, changes);
  if (changes.status) {
    await syncStockForStatus(o, o.status, "shipped");
    if (o.customer.email && EMAIL_ON) {
      sendOrderEmail({ ...o, ...changes }, "shipped")
        .then((sent) => sent && toast("📧 اتبعت للعميل إيميل فيه رقم التتبع"))
        .catch((err) => console.warn("shipped email", err));
    }
  }
}

$("#drawerBody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-ship]");
  if (!b || !openId) return;
  const o = orders.find((x) => x.id === openId);
  const action = b.dataset.ship;

  if (action === "bosta") {
    if (!confirm(`هنعمل شحنة عند بوسطة للطلب ${o.id} لـ ${o.customer.name} (${o.address.gov}). متأكد؟`)) return;
    shipSending.add(o.id);
    openOrder(o.id, false);
    try {
      const d = await bosta("/deliveries?apiVersion=1", { method: "POST", body: JSON.stringify(bostaDelivery(o)) });
      const trackingNumber = String(d.trackingNumber || d.delivery?.trackingNumber || "");
      if (!trackingNumber) throw new Error("بوسطة ماردّتش برقم تتبع");
      await saveShipment(o, { carrier: "bosta", trackingNumber, deliveryId: d._id || d.delivery?._id || "", at: new Date().toISOString() }, true);
      toast(`✅ الشحنة اتعملت — رقم التتبع ${trackingNumber}`);
    } catch (err) {
      console.error(err);
      alert(`❌ بوسطة رفضت الشحنة:\n${err.message}\n\nلو المشكلة في العنوان، اعمل الشحنة من موقع بوسطة واكتب رقم التتبع هنا.`);
    } finally {
      shipSending.delete(o.id);
      if (openId === o.id) openOrder(o.id, false);
    }
  }

  if (action === "manual") {
    const trackingNumber = $("#manualTracking").value.trim();
    if (!trackingNumber) return toast("اكتب رقم التتبع الأول");
    const carrier = $("#manualCarrier").value;
    try {
      await saveShipment(o, { carrier, trackingNumber, at: new Date().toISOString() }, true);
      toast("✅ رقم التتبع اتحفظ والعميل يقدر يشوفه");
    } catch (err) {
      console.error(err);
      toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مقدرناش نحفظ، جرّب تاني");
    }
  }

  if (action === "clear") {
    if (!confirm("تشيل رقم التتبع من الطلب؟ (الشحنة نفسها عند شركة الشحن مش هتتلغي)")) return;
    await updateOrder(o.id, { shipment: null }).catch(() => toast("❌ مقدرناش نحدّث الطلب"));
  }

  if (action === "state") {
    const el = $("#shipState");
    el.textContent = "بنسأل بوسطة...";
    try {
      const d = await bosta(`/deliveries/business/${encodeURIComponent(o.shipment.trackingNumber)}`);
      const state = d.state?.value || d.state?.name || d.maskedState || "—";
      el.textContent = `الحالة عند بوسطة: ${state}`;
      if (d.state?.code === 45 && o.status !== "delivered") el.textContent += " — لو اتسلّمت دوس \"تم التوصيل\" فوق";
    } catch (err) {
      el.textContent = `⚠️ ${err.message}`;
    }
  }
});

// ============ البداية ============
let shippingStarted = false;
async function startShipping() {
  if (shippingStarted) return;
  shippingStarted = true;
  await loadShippingSettings();
  try {
    bostaKey = (await settingsStore.get("bosta"))?.apiKey || "";
  } catch (err) {
    console.warn("bosta key", err);
  }
  $("#bostaKey").value = bostaKey;
  bostaStatus(bostaKey ? "المفتاح محفوظ — دوس \"جرّب المفتاح\" لو عايز تتأكد" : "لسه مفيش مفتاح");
  renderShipForm();
  if (openId) openOrder(openId, false);
}
document.addEventListener("dashboardready", startShipping);
if (!$("#dashboard").hidden) startShipping();
document.addEventListener("sectionchange", (e) => e.detail === "shipping" && renderShipForm());
