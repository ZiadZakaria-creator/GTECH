// ============ لوحة التحكم: تقييمات العملاء ============
// بتعرض التقييمات الحقيقية اللي العملاء كتبوها، والأدمن يقدر يمسح أي تقييم مش مناسب

const REVIEWS_LOCAL_KEY = "gtech-reviews-local";
let adminReviews = [];

const reviewsStore = USE_FIREBASE
  ? {
      watch(onData, onError) {
        loadFirebase(["auth", "firestore"]).then(() => {
          firebase.firestore().collection("reviews").onSnapshot(
            (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError);
        }, onError);
      },
      remove: (id) => firebase.firestore().collection("reviews").doc(id).delete(),
    }
  : {
      watch(onData) {
        const emit = () => onData(store.get(REVIEWS_LOCAL_KEY, []));
        addEventListener("storage", (e) => e.key === REVIEWS_LOCAL_KEY && emit());
        document.addEventListener("localreviews", emit);
        emit();
      },
      async remove(id) {
        store.set(REVIEWS_LOCAL_KEY, store.get(REVIEWS_LOCAL_KEY, []).filter((r) => r.id !== id));
        document.dispatchEvent(new Event("localreviews"));
      },
    };

function renderAdminReviews() {
  const list = [...adminReviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const catalogList = alertProducts();
  $("#reviewsEmpty").hidden = list.length > 0;
  $("#reviewsBody").innerHTML = list.map((r) => `
    <tr>
      <td><b>${escapeHtml(catalogList.find((p) => p.id === r.productId)?.name || `منتج #${r.productId}`)}</b></td>
      <td>${escapeHtml(r.name)}</td>
      <td class="ad-stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</td>
      <td class="ad-review-text">${r.text ? escapeHtml(r.text) : `<span class="muted">—</span>`}</td>
      <td>${new Date(r.createdAt).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" })}</td>
      <td><button class="btn btn--ghost btn--sm" data-del-review="${escapeHtml(r.id)}">🗑 امسح</button></td>
    </tr>`).join("");
}

$("#reviewsBody").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del-review]");
  if (!b || !confirm("تمسح التقييم ده من المتجر؟")) return;
  try {
    await reviewsStore.remove(b.dataset.delReview);
    toast("🗑 التقييم اتمسح");
  } catch (err) {
    console.error(err);
    toast(err?.code === "permission-denied" ? "⛔ محتاج تحدّث قواعد الأمان في Firebase" : "❌ مقدرناش نمسح التقييم");
  }
});

let reviewsStarted = false;
document.addEventListener("sectionchange", (e) => {
  if (e.detail !== "reviews") return;
  if (!reviewsStarted) {
    reviewsStarted = true;
    watchProducts(); // أسماء المنتجات
    reviewsStore.watch((list) => { adminReviews = list; renderAdminReviews(); }, (err) => {
      console.warn("reviews", err);
      if (err?.code === "permission-denied") toast("⛔ محتاج تحدّث قواعد الأمان في Firebase عشان التقييمات تظهر");
    });
  }
  renderAdminReviews();
});
document.addEventListener("adminproducts", () => reviewsStarted && renderAdminReviews());
