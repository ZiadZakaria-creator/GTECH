// ============ تقييمات العملاء (حقيقية) ============
// كل عميل داخل بحسابه يقدر يقيّم المنتج مرة واحدة (ويعدّل تقييمه بعدين).
// التقييمات متخزنة في Firestore: reviews/{رقم المنتج}_{UID العميل} — أي حد يقراها،
// والعميل يكتب تقييمه هو بس، والأدمن يقدر يمسح أي تقييم من اللوحة.
// مفيش أي تقييم أو نجوم بتظهر غير لما عميل حقيقي يقيّم.

const REVIEWS_CACHE = "gtech-reviews";
const REVIEWS_LOCAL = "gtech-reviews-local"; // الوضع التجريبي
const MY_REVIEWS = "gtech-my-reviews";       // { رقم المنتج: رقم التقييم } عشان نعرض "عدّل تقييمك"

let allReviews = store.get(FIREBASE_CONFIG ? REVIEWS_CACHE : REVIEWS_LOCAL, []);

const reviewsFor = (id) => allReviews.filter((r) => r.productId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
function reviewSummary(id) {
  const list = reviewsFor(id);
  return { count: list.length, avg: list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0 };
}
const ratingInner = ({ count, avg }) => `${stars(avg)} <small>(${num(count)})</small>`;

// النجوم في كارت المنتج: بتظهر بس لو فيه تقييمات فعلاً
function ratingHtml(id) {
  const s = reviewSummary(id);
  return `<div class="product__rating" data-rating="${id}" ${s.count ? "" : "hidden"}>${s.count ? ratingInner(s) : ""}</div>`;
}
function paintRatings() {
  $$("[data-rating]").forEach((el) => {
    const s = reviewSummary(+el.dataset.rating);
    el.hidden = !s.count;
    el.innerHTML = s.count ? ratingInner(s) : "";
  });
}

function setReviews(list) {
  allReviews = list.filter((r) => r.productId && r.stars >= 1 && r.stars <= 5);
  paintRatings();
  document.dispatchEvent(new Event("reviewschange"));
}

async function loadReviews() {
  if (!FIREBASE_CONFIG) return setReviews(store.get(REVIEWS_LOCAL, []));
  const root = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
  try {
    const list = [];
    let token = "";
    do {
      const res = await fetch(`${root}/reviews?pageSize=300&key=${FIREBASE_CONFIG.apiKey}${token ? `&pageToken=${token}` : ""}`);
      if (!res.ok) throw new Error("reviews " + res.status);
      const body = await res.json();
      (body.documents || []).forEach((d) => list.push({ ...docToObject(d), id: d.name.split("/").pop() }));
      token = body.nextPageToken || "";
    } while (token);
    store.set(REVIEWS_CACHE, list);
    setReviews(list);
  } catch (err) {
    console.warn("reviews", err);
  }
}

// العميل لازم يكون داخل بحسابه (requireLogin) قبل ما يوصل هنا
async function saveReview(productId, starsValue, text) {
  const now = new Date().toISOString();
  const name = (user?.name || "عميل").trim().slice(0, 60);
  const mine = store.get(MY_REVIEWS, {});
  if (!FIREBASE_CONFIG) {
    const list = store.get(REVIEWS_LOCAL, []);
    const id = mine[productId] || `${productId}_${Date.now()}`;
    const old = list.find((r) => r.id === id);
    const review = { id, productId, uid: "local", name, stars: starsValue, text, createdAt: old?.createdAt || now, updatedAt: now };
    store.set(REVIEWS_LOCAL, [...list.filter((r) => r.id !== id), review]);
    store.set(MY_REVIEWS, { ...mine, [productId]: id });
    return setReviews(store.get(REVIEWS_LOCAL, []));
  }
  const u = await ensureCustomerAuth();
  const id = `${productId}_${u.uid}`;
  const old = allReviews.find((r) => r.id === id);
  const review = { productId, uid: u.uid, name, stars: starsValue, text, createdAt: old?.createdAt || now, updatedAt: now };
  await firebase.firestore().collection("reviews").doc(id).set(review);
  store.set(MY_REVIEWS, { ...mine, [productId]: id });
  setReviews([...allReviews.filter((r) => r.id !== id), { ...review, id }]);
}

const myReviewFor = (productId) => {
  const id = store.get(MY_REVIEWS, {})[productId];
  return id ? allReviews.find((r) => r.id === id) : null;
};

loadReviews();
