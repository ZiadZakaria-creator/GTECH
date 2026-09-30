// ============ الطلبات ============
// كل التعامل مع الطلبات بيعدّي من هنا، والمتجر والداشبورد بيستخدموا نفس الدوال:
//   submitOrder(order)          العميل بيبعت طلب
//   watchOrders(onData, onErr)  الداشبورد بيتابع الطلبات لحظة بلحظة
//   updateOrder(id, changes)    الداشبورد بيغيّر حالة الطلب
//   watchMyOrders(phone, ...)   العميل بيتابع طلباته في صفحة "طلباتي"
//
// لو FIREBASE_CONFIG فاضي: الطلبات بتتحفظ في المتصفح بس (وضع تجريبي).
// لو متحط: الطلبات بتتحفظ في Firestore وتوصل للداشبورد من أي جهاز.

const ORDER_STATUSES = {
  new: "جديد",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

const ORDERS_KEY = "gtech-orders";
const USE_FIREBASE = !!FIREBASE_CONFIG;

const localOrders = {
  async submit(order) {
    const orders = store.get(ORDERS_KEY, []);
    orders.unshift(order);
    store.set(ORDERS_KEY, orders.slice(0, 500));
    document.dispatchEvent(new Event("orderschange"));
  },
  watch(onData) {
    const emit = () => onData(store.get(ORDERS_KEY, []));
    const onStorage = (e) => e.key === ORDERS_KEY && emit();
    addEventListener("storage", onStorage); // طلبات من تاب تاني في نفس المتصفح
    document.addEventListener("orderschange", emit);
    emit();
    return () => {
      removeEventListener("storage", onStorage);
      document.removeEventListener("orderschange", emit);
    };
  },
  watchMine(phone, onData) {
    return this.watch((all) => onData(all.filter((o) => !phone || o.customer.phone === phone)));
  },
  async update(id, changes) {
    const orders = store.get(ORDERS_KEY, []);
    const order = orders.find((o) => o.id === id);
    if (!order) throw new Error("not found");
    Object.assign(order, changes, { updatedAt: new Date().toISOString() });
    store.set(ORDERS_KEY, orders);
    document.dispatchEvent(new Event("orderschange"));
  },
};

const firebaseOrders = {
  async col() {
    await loadFirebase(["auth", "firestore"]);
    return firebase.firestore().collection("orders");
  },
  async submit(order) {
    const col = await this.col();
    // الطلب بيتربط بحساب Firebase بتاع العميل عشان يقدر يتابعه في "طلباتي"
    try {
      order.customer.uid = (await ensureCustomerAuth()).uid;
    } catch (err) {
      console.warn("customer auth unavailable", err);
    }
    await col.doc(order.id).set({ ...order, serverTime: firebase.firestore.FieldValue.serverTimestamp() });
  },
  watchMine(phone, onData, onError) {
    let stop = () => {};
    Promise.all([this.col(), ensureCustomerAuth()]).then(([col, u]) => {
      stop = col.where("customer.uid", "==", u.uid).onSnapshot(
        (snap) => onData(snap.docs.map((d) => { const { serverTime, ...o } = d.data(); return o; }).filter((o) => !phone || o.customer.phone === phone)),
        onError
      );
    }, onError);
    return () => stop();
  },
  watch(onData, onError) {
    let stop = () => {};
    this.col().then((col) => {
      stop = col.orderBy("createdAt", "desc").limit(500).onSnapshot(
        (snap) => onData(snap.docs.map((d) => { const { serverTime, ...o } = d.data(); return o; })),
        onError
      );
    }, onError);
    return () => stop();
  },
  async update(id, changes) {
    const col = await this.col();
    await col.doc(id).update({ ...changes, updatedAt: new Date().toISOString() });
  },
};

// حساب Firebase للعميل: لو داخل بـ Google يبقى هو، وإلا حساب مجهول (Anonymous)
// محفوظ في المتصفح، وبيفضل ثابت عشان العميل يلاقي طلباته لما يرجع
function firebaseAuthReady() {
  return new Promise((resolve) => {
    const stop = firebase.auth().onAuthStateChanged((u) => { stop(); resolve(u); });
  });
}
async function ensureCustomerAuth() {
  await loadFirebase(["auth", "firestore"]);
  const current = await firebaseAuthReady();
  if (current) return current;
  return (await firebase.auth().signInAnonymously()).user;
}

const ordersBackend = USE_FIREBASE ? firebaseOrders : localOrders;
const submitOrder = (order) => ordersBackend.submit(order);
const watchOrders = (onData, onError) => ordersBackend.watch(onData, onError);
const updateOrder = (id, changes) => ordersBackend.update(id, changes);
const watchMyOrders = (phone, onData, onError) => ordersBackend.watchMine(phone, onData, onError);

// رقم طلب مقروء وصعب يتكرر: GT-يوم الشهر-4 أرقام عشوائية
function newOrderId() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  return `GT-${ymd}-${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
}
