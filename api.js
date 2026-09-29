// ============ إرسال الطلبات ============
// كل التعامل مع الطلبات بيعدّي من هنا.
// دلوقتي الطلب بيتحفظ في المتصفح بس، ولما نعمل الداشبورد وقاعدة البيانات
// هنغيّر submitOrder عشان تبعت الطلب للسيرفر، وباقي الموقع مش هيتغير.

const ORDER_STATUSES = {
  new: "جديد",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

async function submitOrder(order) {
  const orders = store.get("gtech-orders", []);
  orders.unshift(order);
  store.set("gtech-orders", orders.slice(0, 50));
  return { ok: true, id: order.id };
}
