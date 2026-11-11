// ============ لوحة التحكم: تقييم العميل قبل الشحن ============
// من تاريخ طلبات نفس الرقم: 🟢 استلم قبل كده · 🟡 جديد أو متذبذب · 🔴 لغى قبل كده أو المندوب ماقدرش يوصله ومااستلمش ولا مرة.
// "المندوب ماقدرش يوصله" بيتسجل لما تدوس "📵 العميل مابيردش"، وتقدر تعلّم العميل بإيدك (موثوق / مش جاد).
// العلامات في adminData/customers: { "01xxxxxxxxx": { noAnswer, lastNoAnswer, flag: "good"|"bad" } }

const RISK_BIG = 3000; // أوردر أكبر من كده من عميل جديد ← كلّمه قبل الشحن
const RISK_INFO = {
  green: { icon: "🟢", label: "عميل موثوق" },
  yellow: { icon: "🟡", label: "عميل جديد" },
  red: { icon: "🔴", label: "خلي بالك" },
};

function customerRisk(o) {
  const ph = privPhone(o.customer?.phone);
  const past = orders.filter((x) => x.id !== o.id && privPhone(x.customer?.phone) === ph);
  const delivered = past.filter((x) => x.status === "delivered").length;
  const cancelled = past.filter((x) => x.status === "cancelled").length;
  const open = past.filter((x) => ["new", "confirmed", "shipped"].includes(x.status)).length;
  const mark = privGet("customers")[ph] || {};
  const noAnswer = mark.noAnswer || 0;
  const reasons = [];
  if (delivered) reasons.push(`استلم ${num(delivered)} ${delivered === 1 ? "أوردر" : "أوردرات"} قبل كده`);
  if (cancelled) reasons.push(`${num(cancelled)} ${cancelled === 1 ? "أوردر اتلغى" : "أوردرات اتلغت"} قبل كده`);
  if (noAnswer) reasons.push(`المندوب ماقدرش يوصله ${noAnswer === 1 ? "مرة" : `${num(noAnswer)} مرات`}`);
  if (open) reasons.push(`عنده ${num(open)} ${open === 1 ? "أوردر تاني مفتوح" : "أوردرات تانية مفتوحة"}`);
  if (!past.length && !noAnswer) reasons.push("أول أوردر ليه");

  let level;
  if (mark.flag === "bad") { level = "red"; reasons.unshift("إنت علّمته إنه مش جاد"); }
  else if (mark.flag === "good") { level = "green"; reasons.unshift("إنت علّمته إنه موثوق"); }
  else if (!delivered && (cancelled || noAnswer)) level = "red";
  else if (delivered && cancelled < delivered && noAnswer < delivered) level = "green";
  else level = "yellow";

  const total = o.totals?.total || 0;
  const express = o.shipping?.method === "express";
  let advice = "";
  if (level === "red") advice = "كلّمه تليفون بنفسك قبل ما المندوب يتحرك، أو اطلب عربون قبل الشحن.";
  else if (level === "yellow" && (total >= RISK_BIG || express)) advice = `${total >= RISK_BIG ? "أوردر كبير" : "شحن سريع"} من عميل ${delivered ? "متذبذب" : "جديد"}: كلّمه تليفون وأكّد العنوان والميعاد قبل ما المندوب يتحرك.`;
  return { level, reasons, advice, phone: ph, mark, info: RISK_INFO[level] };
}

const riskChip = (o) => {
  const r = customerRisk(o);
  return `<span class="risk-chip risk-chip--${r.level}" title="${escapeHtml(r.reasons.join(" · "))}">${r.info.icon} ${r.info.label}</span>`;
};

// العربون: 10% مقرّب لأقرب 50، وأقل حاجة 200 ج.م
const riskDeposit = (total) => Math.min(total, Math.max(200, Math.round((total * 0.1) / 50) * 50));

function riskBox(o) {
  const r = customerRisk(o);
  const active = ["new", "confirmed"].includes(o.status);
  const ip = transferTarget("instapay"), vf = transferTarget("vodafone");
  const dep = riskDeposit(o.totals?.total || 0);
  const egpTxt = (n) => `${Number(n).toLocaleString("en-US")} ج.م`;
  const depositMsg = [
    `أهلاً ${o.customer.name} 👋`,
    `معاك GTECH MASR بخصوص طلبك رقم ${o.id}`,
    ``,
    `عشان نجهّز الطلب ونحجزله المندوب، محتاجين عربون ${egpTxt(dep)} بيتخصم من الإجمالي (${egpTxt(o.totals.total)})، والباقي ${egpTxt(o.totals.total - dep)} تدفعه عند الاستلام.`,
    ``,
    `تقدر تحوّل على:`,
    ip ? `⚡ إنستاباي: ${ip}` : null,
    vf ? `📱 فودافون كاش: ${vf}` : null,
    ``,
    `وابعتلنا صورة التحويل هنا، وأول ما توصل هنجهّز طلبك على طول 🙏`,
  ].filter((l) => l !== null).join("\n");
  return `
    <div class="risk-box risk-box--${r.level}">
      <p><b>${r.info.icon} ${r.info.label}</b> <small>${escapeHtml(r.reasons.join(" · "))}</small></p>
      ${r.advice && active ? `<p class="risk-advice">💡 ${escapeHtml(r.advice)}</p>` : ""}
      <div class="od-contact">
        ${active && r.level !== "green" && (ip || vf) ? `<a class="btn btn--ghost btn--sm" href="${waLink(depositMsg, "2" + o.customer.phone)}" target="_blank" rel="noopener" title="رسالة بعربون ${egpTxt(dep)} على بيانات التحويل اللي في «الشحن والدفع»">💵 اطلب عربون ${num(dep)}</a>` : ""}
        <button type="button" class="btn btn--ghost btn--sm ${r.mark.flag === "good" ? "is-on" : ""}" data-risk-flag="good">${r.mark.flag === "good" ? "✔ موثوق" : "⭐ علّمه موثوق"}</button>
        <button type="button" class="btn btn--ghost btn--sm ${r.mark.flag === "bad" ? "is-on" : ""}" data-risk-flag="bad">${r.mark.flag === "bad" ? "✔ مش جاد" : "🚩 علّمه مش جاد"}</button>
      </div>
    </div>`;
}

document.addEventListener("click", async (e) => {
  const body = e.target.closest("#drawerBody");
  if (!body || !openId) return;
  const o = orders.find((x) => x.id === openId);
  if (!o) return;
  const ph = privPhone(o.customer.phone);
  const cur = privGet("customers")[ph] || {};
  // "📵 العميل مابيردش": بنسجّل المحاولة على رقم العميل (مرة واحدة لكل أوردر)
  if (e.target.closest("[data-no-answer]")) {
    const seen = cur.noAnswerOrders || [];
    if (!seen.includes(o.id)) {
      await privPatch("customers", { [ph]: { ...cur, noAnswer: (cur.noAnswer || 0) + 1, lastNoAnswer: new Date().toISOString(), noAnswerOrders: [...seen, o.id].slice(-10) } });
    }
    return;
  }
  const f = e.target.closest("[data-risk-flag]");
  if (f) {
    const flag = cur.flag === f.dataset.riskFlag ? null : f.dataset.riskFlag;
    const next = { ...cur };
    if (flag) next.flag = flag; else delete next.flag;
    await privPatch("customers", { [ph]: Object.keys(next).length ? next : null });
    toast(flag === "bad" ? "🚩 اتعلّم إنه مش جاد — هيبان على أي أوردر جاي من الرقم ده" : flag === "good" ? "⭐ اتعلّم إنه موثوق" : "اتشالت العلامة");
  }
});

document.addEventListener("privchange", () => {
  if (typeof render === "function" && orders.length) render();
  if (openId) openOrder(openId, false);
});
document.addEventListener("dashboardready", () => privLoad("customers"));
if (!$("#dashboard").hidden) privLoad("customers");
