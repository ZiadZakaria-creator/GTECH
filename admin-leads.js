// ============ لوحة التحكم: أرقام العملاء ============
// الأرقام اللي الزوار سابوها في نافذة "خصم أول أوردر" (common.js ← saveLead).
// من هنا تبعتلهم عروض واتساب أو تنزّلهم ملف CSV.

const LEADS_LOCAL_KEY = "gtech-leads-local";

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
const LEADS_SEEN = "gtech-leads-seen"; // آخر مرة الأدمن فتح التاب (عشان عدّاد الجديد)

// نفس الرقم ممكن يتسجل أكتر من مرة (من أجهزة مختلفة) — بنعرضه مرة واحدة بأقدم تاريخ
function uniqueLeads() {
  const byPhone = new Map();
  for (const l of allLeads) {
    const prev = byPhone.get(l.phone);
    if (!prev || l.createdAt < prev.createdAt) byPhone.set(l.phone, { ...l, ids: [...(prev?.ids || []), l.id] });
    else prev.ids.push(l.id);
  }
  return [...byPhone.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const leadWhatsApp = (l) => waLink(
  `أهلاً 👋 معاك GTECH\nشكراً إنك اشتركت في عروضنا 🎁\nكود خصمك 10% على أول أوردر: ${LEAD_CODE_ADMIN}\n\nتقدر تتسوق من هنا 👇\n${siteUrl("index.html")}`,
  "20" + l.phone.replace(/^0/, ""));
const LEAD_CODE_ADMIN = "GTECH10";

function renderLeads() {
  const list = uniqueLeads();
  const seen = store.get(LEADS_SEEN, "");
  const fresh = list.filter((l) => l.createdAt > seen).length;
  const badge = $("#leadsBadge");
  badge.hidden = !fresh;
  badge.textContent = num(fresh);
  $("#leadsCount").textContent = list.length ? `${num(list.length)} رقم` : "";
  $("#leadsExport").hidden = !list.length;
  $("#leadsEmpty").hidden = !!list.length;
  $("#leadsBody").innerHTML = list.map((l) => {
    const src = (typeof SOURCE_INFO !== "undefined" && SOURCE_INFO[l.source]?.[0]) || l.source || "—";
    return `
      <tr class="${l.createdAt > seen ? "is-new" : ""}">
        <td><b dir="ltr">${escapeHtml(l.phone)}</b></td>
        <td>${new Date(l.createdAt).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })} <small class="muted">${timeAgo(l.createdAt)}</small></td>
        <td>${escapeHtml(src)}</td>
        <td><small class="muted" dir="ltr">${escapeHtml(l.page || "")}</small></td>
        <td class="leads-actions">
          <a class="btn btn--sm btn--wa" href="${escapeHtml(leadWhatsApp(l))}" target="_blank" rel="noopener">💬 واتساب</a>
          <button class="btn btn--ghost btn--sm" data-lead-del="${escapeHtml(l.ids.join(","))}" aria-label="حذف">🗑</button>
        </td>
      </tr>`;
  }).join("");
}

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
  const rows = [["phone", "date", "source", "page"], ...uniqueLeads().map((l) => [l.phone, l.createdAt.slice(0, 10), l.source || "", l.page || ""])];
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "gtech-leads.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
});

document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "leads") return;
  // أول ما الأدمن يفتح التاب، الأرقام تبقى "اتشافت" (بعد ما تتعرض مميزة مرة)
  setTimeout(() => { store.set(LEADS_SEEN, new Date().toISOString()); }, 1500);
});

let leadsStarted = false;
function startLeads() {
  if (leadsStarted) return;
  leadsStarted = true;
  leadsStore.watch((list) => { allLeads = list.filter((l) => l.phone && l.createdAt); renderLeads(); }, (err) => {
    console.warn("leads", err);
    if (err?.code === "permission-denied") $("#leadsEmpty").querySelector("p").textContent = "⛔ محتاج تحدّث قواعد الأمان في Firebase عشان الأرقام تظهر";
    $("#leadsEmpty").hidden = false;
  });
}
document.addEventListener("dashboardready", startLeads);
if (!$("#dashboard").hidden) startLeads();
