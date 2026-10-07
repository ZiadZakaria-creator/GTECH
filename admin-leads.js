// ============ لوحة التحكم: العملاء ============
// قايمة واحدة بكل أرقام العملاء من 3 مصادر — كل رقم بيظهر مرة واحدة:
//   الطلبات (admin.js ← orders)، السلات المتروكة (admin-carts.js ← allCarts)،
//   ونافذة "خصم أول أوردر" (common.js ← saveLead ← Firestore: leads)
// ومنها تبعت واتساب برسالة مناسبة لحالة كل عميل، أو تنزّل CSV.

const LEADS_LOCAL_KEY = "gtech-leads-local";
const LEAD_CODE_ADMIN = "GTECH10";

const leadsStore = USE_FIREBASE
  ? {
      watch(onData, onError) {
        let stop = () => {};
        loadFirebase(["auth", "firestore"]).then(() => {
          stop = firebase.firestore().collection("leads").onSnapshot(
            (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
        }, onError);
        return () => stop();
      },
      remove: (id) => firebase.firestore().collection("leads").doc(id).delete(),
    }
  : {
      watch(onData) {
        const emit = () => onData(store.get(LEADS_LOCAL_KEY, []).map((l, i) => ({ ...l, id: String(i) })));
        addEventListener("storage", (e) => e.key === LEADS_LOCAL_KEY && emit());
        document.addEventListener("localleads", emit);
        emit();
      },
      async remove(id) {
        store.set(LEADS_LOCAL_KEY, store.get(LEADS_LOCAL_KEY, []).filter((_, i) => String(i) !== id));
        document.dispatchEvent(new Event("localleads"));
      },
    };

let allLeads = [];
let custFilter = "all";
let custQuery = "";
const LEADS_SEEN = "gtech-leads-seen"; // آخر مرة الأدمن فتح التاب (عشان عدّاد الجديد)

const STATUS_INFO = {
  buyer: ["🟢 اشترى", "pill--done"],
  cart: ["🟡 ساب سلة", "pill--warn"],
  lead: ["⚪ لسه ماشتراش", "pill--idle"],
};

const cleanPhone = (p) => normalizePhone(String(p || "")).replace(/^\+?20(?=1)/, "0");
const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

// بيجمّع كل مصادر الأرقام في عميل واحد لكل رقم
function buildCustomers() {
  const map = new Map();
  const get = (phone) => {
    phone = cleanPhone(phone);
    if (!/^01\d{9}$/.test(phone)) return null;
    if (!map.has(phone)) map.set(phone, { phone, name: "", gov: "", orders: 0, spent: 0, cancelled: 0, cart: null, leadIds: [], source: "", firstSeen: "", lastActive: "" });
    return map.get(phone);
  };
  const seen = (c, at) => {
    c.lastActive = later(c.lastActive, at);
    c.firstSeen = !c.firstSeen || at < c.firstSeen ? at : c.firstSeen;
  };
  // الطلبات (أحدث الأول، فأول اسم ومحافظة هما الأحدث)
  for (const o of typeof orders !== "undefined" ? orders : []) {
    const c = get(o.customer?.phone);
    if (!c) continue;
    c.name ||= o.customer.name || "";
    c.gov ||= o.address?.gov || "";
    c.source ||= o.source && o.source !== "direct" ? o.source : "";
    if (o.status === "cancelled") c.cancelled++;
    else { c.orders++; c.spent += o.totals?.total || 0; }
    seen(c, o.createdAt);
  }
  // السلات المتروكة (اللي فيها رقم)
  for (const cart of typeof allCarts !== "undefined" ? allCarts : []) {
    if (!cart.items?.length) continue;
    const c = get(cart.phone);
    if (!c) continue;
    c.name ||= cart.name || "";
    // السلة تتحسب بس لو اتعدلت بعد آخر أوردر
    if (!c.orders || cart.updatedAt > c.lastActive) c.cart = cart;
    seen(c, cart.updatedAt);
  }
  // نافذة الخصم
  for (const l of allLeads) {
    const c = get(l.phone);
    if (!c) continue;
    c.leadIds.push(l.id);
    c.source ||= l.source && l.source !== "direct" ? l.source : "";
    seen(c, l.createdAt);
  }
  // صاحبك عليا: كام أوردر جه من لينك كل عميل
  const refs = {};
  for (const o of typeof orders !== "undefined" ? orders : []) {
    if (o.status !== "cancelled" && /^REF-/.test(o.promo || "")) refs[o.promo.slice(4)] = (refs[o.promo.slice(4)] || 0) + 1;
  }
  return [...map.values()].map((c) => ({ ...c, referred: refs[referralCode(c.phone)] || 0, status: c.orders ? "buyer" : c.cart ? "cart" : "lead" }))
    .sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}

// رسالة واتساب مناسبة لحالة العميل
function customerWhatsApp(c) {
  const hi = `أهلاً${c.name ? " " + c.name.split(" ")[0] : ""} 👋 معاك GTECH MASR`;
  const text = c.status === "buyer"
    ? `${hi}\nشكراً إنك اشتريت مننا قبل كده 🙏\nنزلنا منتجات وعروض جديدة، شوفها من هنا 👇\n${siteUrl("index.html")}`
    : c.status === "cart"
      ? `${hi}\nلاحظنا إنك سبت منتجات في السلة:\n${c.cart.items.map((i) => `• ${i.name}${i.qty > 1 ? ` × ${i.qty}` : ""}`).join("\n")}\nالإجمالي: ${egp(c.cart.total)}\n\nتقدر تكمّل طلبك في دقيقة من هنا 👇\n${cartLink(c.cart)}`
      : `${hi}\nشكراً إنك اشتركت في عروضنا 🎁\nكود خصمك 10% على أول أوردر: ${LEAD_CODE_ADMIN}\n\nتقدر تتسوق من هنا 👇\n${siteUrl("index.html")}`;
  return waLink(text, "20" + c.phone.slice(1));
}

function filteredCustomers(list) {
  const q = custQuery.trim().toLowerCase();
  return list.filter((c) => (custFilter === "all" || c.status === custFilter)
    && (!q || c.phone.includes(toLatinDigits(q)) || c.name.toLowerCase().includes(q) || c.gov.includes(q)));
}

function statusDetail(c) {
  const ref = c.referred ? ` · 🤝 جاب ${num(c.referred)} ${c.referred === 1 ? "أوردر" : "أوردرات"}` : "";
  if (c.status === "buyer") return `${num(c.orders)} ${c.orders === 1 ? "أوردر" : "أوردرات"} · ${fmt(c.spent)}${c.cart ? " · وعنده سلة مفتوحة" : ""}${ref}`;
  if (c.status === "cart") return `سلة بـ ${fmt(c.cart.total)}`;
  return c.cancelled ? `${num(c.cancelled)} أوردر اتلغى` : "من نافذة الخصم";
}

function renderLeads() {
  const all = buildCustomers();
  const seenAt = store.get(LEADS_SEEN, "");
  const fresh = all.filter((c) => c.firstSeen > seenAt).length;
  const badge = $("#leadsBadge");
  badge.hidden = !fresh;
  badge.textContent = num(fresh);

  const counts = { all: all.length, buyer: 0, cart: 0, lead: 0 };
  all.forEach((c) => counts[c.status]++);
  $$("#custFilters [data-cf]").forEach((b) => {
    b.classList.toggle("active", b.dataset.cf === custFilter);
    b.querySelector("span").textContent = num(counts[b.dataset.cf]);
  });

  const list = filteredCustomers(all);
  $("#leadsExport").hidden = !list.length;
  $("#leadsEmpty").hidden = !!list.length;
  $("#leadsEmpty p").textContent = all.length ? "مفيش عملاء بالفلتر ده" : "لسه مفيش أرقام عملاء";
  $("#leadsBody").innerHTML = list.map((c) => {
    const [label, cls] = STATUS_INFO[c.status];
    const src = c.source ? (typeof SOURCE_INFO !== "undefined" && SOURCE_INFO[c.source]?.[0]) || c.source : "—";
    return `
      <tr class="${c.firstSeen > seenAt ? "is-new" : ""}">
        <td><b>${escapeHtml(c.name || "—")}</b><br><small class="muted mono" dir="ltr">${escapeHtml(c.phone)}</small></td>
        <td><span class="pill ${cls}">${label}</span><br><small class="muted">${statusDetail(c)}</small></td>
        <td>${escapeHtml(c.gov || "—")}</td>
        <td>${timeAgo(c.lastActive)}</td>
        <td>${escapeHtml(src)}</td>
        <td class="leads-actions">
          <a class="btn btn--sm btn--wa" href="${escapeHtml(customerWhatsApp(c))}" target="_blank" rel="noopener">💬 واتساب</a>
          ${c.status === "lead" && c.leadIds.length ? `<button class="btn btn--ghost btn--sm" data-lead-del="${escapeHtml(c.leadIds.join(","))}" aria-label="حذف" title="امسح الرقم">🗑</button>` : ""}
        </td>
      </tr>`;
  }).join("");
}

$("#custFilters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cf]");
  if (!b) return;
  custFilter = b.dataset.cf;
  renderLeads();
});
$("#custSearch").addEventListener("input", (e) => { custQuery = e.target.value; renderLeads(); });

$("#leadsBody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-lead-del]");
  if (!b || !confirm("تمسح الرقم ده من القايمة؟")) return;
  try {
    await Promise.all(b.dataset.leadDel.split(",").map((id) => leadsStore.remove(id)));
    toast("🗑 الرقم اتمسح");
  } catch (err) {
    console.warn(err);
    toast("❌ ماتمسحش، جرّب تاني");
  }
});

$("#leadsExport").addEventListener("click", () => {
  const status = { buyer: "اشترى", cart: "ساب سلة", lead: "لسه ماشتراش" };
  const rows = [["phone", "name", "status", "orders", "spent", "governorate", "last_active", "source"],
    ...filteredCustomers(buildCustomers()).map((c) => [c.phone, c.name, status[c.status], c.orders, c.spent, c.gov, c.lastActive.slice(0, 10), c.source])];
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `gtech-customers-${custFilter}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
});

document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "leads") return;
  startCarts?.(); // السلات بتتحمّل هنا كمان عشان العملاء اللي سابوا سلة
  // أول ما الأدمن يفتح التاب، العملاء الجداد يبقوا "اتشافوا" (بعد ما يتعرضوا مميزين مرة)
  setTimeout(() => { store.set(LEADS_SEEN, new Date().toISOString()); }, 1500);
});
document.addEventListener("adminorders", renderLeads);
document.addEventListener("admincarts", renderLeads);

let leadsStarted = false;
function startLeads() {
  if (leadsStarted) return;
  leadsStarted = true;
  leadsStore.watch((list) => { allLeads = list.filter((l) => l.phone && l.createdAt); renderLeads(); }, (err) => {
    console.warn("leads", err);
    if (err?.code === "permission-denied") toast("⛔ محتاج تحدّث قواعد الأمان في Firebase عشان أرقام نافذة الخصم تظهر");
    renderLeads();
  });
}
document.addEventListener("dashboardready", startLeads);
if (!$("#dashboard").hidden) startLeads();
