// ============ ترجمة لوحة التحكم (إنجليزي) ============
// بيوسّع قاموس i18n.js بمصطلحات اللوحة. بيتحمّل بعد i18n.js وقبل باقي سكربتات اللوحة.
// الأرقام والعملة بتتعرّب/تتأنجلز لوحدها من core.js (fmt/num) حسب اللغة.
(function () {
  if (typeof I18N_EN === "undefined") return; // i18n.js مش متحمّل
  Object.assign(I18N_EN, {
    // ---- القائمة الجانبية + الهوية ----
    "لوحة التحكم": "Dashboard",
    "الطلبات": "Orders",
    "المنتجات": "Products",
    "العملاء": "Customers",
    "سلات متروكة": "Abandoned Carts",
    "الزوار والتقارير": "Visitors & Reports",
    "الشحن والدفع": "Shipping & Payment",
    "التقييمات": "Reviews",
    "الرئيسية": "Main",
    "إدارة المتجر": "Store Admin",
    "متجرك شغال": "Your store is live",
    "افتح المتجر وشوفه زي العميل ←": "Open the store and see it as a customer ←",

    // ---- الشريط العلوي ----
    "النظام متصل": "System Connected",
    "وضع تجريبي": "Demo Mode",
    "↗ معاينة المتجر": "↗ Preview Store",
    "معاينة المتجر": "Preview Store",
    "📧 تجربة الإيميل": "📧 Test Email",
    "خروج": "Log out",
    "دخول": "Log in",
    "مدير المتجر": "Store Manager",
    "دخول صاحب المتجر": "Store Owner Login",
    "سجّل بحساب الأدمن اللي عملته في Firebase": "Sign in with the admin account you created in Firebase",
    "كلمة المرور": "Password",

    // ---- نظرة عامة ----
    "نظرة عامة على المتجر": "Store Overview",
    "ده ملخص أداء متجرك وأهم الحاجات اللي محتاجة انتباهك.": "A summary of your store's performance and the things that need your attention.",
    "النهارده": "Today",
    "آخر 7 أيام": "Last 7 days",
    "آخر 30 يوم": "Last 30 days",
    "آخر 3 شهور": "Last 3 months",
    "آخر 90 يوم": "Last 90 days",
    "⬇ تصدير التقرير": "⬇ Export Report",

    // ---- كروت KPI ----
    "إجمالي المبيعات": "Total Sales",
    "عدد الطلبات": "Orders Count",
    "متوسط قيمة الطلب": "Average Order Value",
    "مقارنة بالفترة اللي قبلها": "vs. previous period",
    "من غير الملغي": "excluding cancelled",

    // ---- شارت المبيعات والطلبات ----
    "المبيعات والطلبات": "Sales & Orders",
    "المبيعات": "Sales",
    "كل يوم في آخر 30 يوم": "Daily over the last 30 days",
    "كل يوم في آخر 7 أيام": "Daily over the last 7 days",
    "النهارده بالساعة": "Today by hour",
    "كل أسبوع في آخر 3 شهور": "Weekly over the last 3 months",

    // ---- حالة الطلبات ----
    "حالة الطلبات": "Order Status",
    "توزيع طلبات الفترة دي": "Order distribution for this period",
    "جديد": "New",
    "تم التأكيد": "Confirmed",
    "تم الشحن": "Shipped",
    "تم التوصيل": "Delivered",
    "ملغي": "Cancelled",
    "إجمالي الطلبات": "Total Orders",
    "محتاجة تأكيد": "Needs confirmation",
    "متأكدة · جاهزة للشحن": "Confirmed · ready to ship",
    "مع شركة الشحن": "With the courier",
    "اتسلّمت للعميل": "Delivered to customer",
    "اتلغت": "Cancelled",

    // ---- حالة الدفع ----
    "حالة الدفع": "Payment Status",
    "اتدفع": "Paid",
    "عند الاستلام": "Cash on delivery",
    "مستني التحويل": "Awaiting transfer",

    // ---- أحدث الطلبات + الجدول ----
    "أحدث الطلبات": "Recent Orders",
    "محتاج تأكيد": "needs confirmation",
    "كل الطلبات ←": "All orders ←",
    "رقم الطلب": "Order #",
    "العميل": "Customer",
    "المحافظة": "Governorate",
    "الإجمالي": "Total",
    "الدفع": "Payment",
    "الحالة": "Status",
    "التاريخ": "Date",
    "الدفع عند الاستلام": "Cash on Delivery",
    "بطاقة بنكية": "Bank Card",
    "محفظة إلكترونية": "E-Wallet",
    "تقسيط بدون فوائد": "Interest-free Installments",

    // ---- الشحن والتوصيل (الكارت) ----
    "الشحن والتوصيل": "Shipping & Delivery",
    "الطلبات اللي لسه شغالين عليها": "Orders still in progress",
    "في الطريق": "On the way",
    "جاهزة للشحن": "Ready to ship",
    "محتاجة تأكيد": "Needs confirmation",
    "نسبة التسليم في الفترة دي": "Delivery rate this period",
    "اتسلّم": "delivered",
    "اتلغى": "cancelled",

    // ---- الأكثر مبيعاً ----
    "الأكثر مبيعاً": "Best Sellers",
    "حسب قيمة المبيعات في الفترة دي": "By sales value this period",
    "المنتجات ←": "Products ←",

    // ---- تنبيهات المخزون ----
    "تنبيهات المخزون": "Inventory Alerts",
    "كل المنتجات كميتها كويسة": "All products are well stocked",
    "مفيش منتجات قربت تخلص": "No products running low",
    "✅ مفيش منتجات قربت تخلص": "✅ No products running low",

    // ---- الوضع التجريبي ----
    "🧪 وضع تجريبي": "🧪 Demo Mode",
    "إضافة طلبات تجريبية": "Add demo orders",
    "مسح كل الطلبات": "Clear all orders",

    // ---- جداول/فلاتر/أزرار عامة ----
    "كل الأقسام": "All categories",
    "كل الفترات": "All periods",
    "الكل": "All",
    "⬇ تصدير Excel": "⬇ Export Excel",
    "⬆ استيراد من Excel": "⬆ Import from Excel",
    "📷 رفع صور لكذا منتج": "📷 Upload images for multiple products",
    "＋ منتج جديد": "＋ New Product",
    "المنتج": "Product",
    "القسم": "Category",
    "السعر": "Price",
    "المخزون": "Stock",
    "ظاهر في المتجر": "Visible in store",
    "مخفي": "Hidden",
    "مخزون قليل": "Low stock",
    "مخزون قليل أو خلص (أقل من ٣)": "Low or out of stock (under 3)",
    "نفد": "Out of stock",
    "📷 من غير صور": "📷 Without images",
    "استيراد المنتجات": "Import products",

    // ---- حالات فاضية ----
    "مفيش طلبات لسه": "No orders yet",
    "مفيش طلبات لسه — أول ما عميل يطلب هيظهر هنا": "No orders yet — they'll appear here once a customer orders",
    "مفيش منتجات مطابقة": "No matching products",
    "مفيش سلات متروكة دلوقتي": "No abandoned carts right now",
    "لسه مفيش تقييمات من العملاء": "No customer reviews yet",
    "لسه مفيش أرقام عملاء": "No customer numbers yet",
    "مفيش مشاهدات لسه في الفترة دي": "No views yet in this period",

    // ---- الزوار والتقارير ----
    "كل زائر بيتعد مرة واحدة في اليوم. زياراتك إنت من المتصفح ده مش محسوبة.": "Each visitor is counted once per day. Your own visits from this browser aren't counted.",
    "🛒 مسار الشراء": "🛒 Purchase Funnel",
    "من كل اللي دخلوا المتجر، وصلوا لحد فين": "Of everyone who entered the store, how far they got",
    "📣 الزوار جايين منين": "📣 Where visitors come from",
    "والطلبات والمبيعات اللي جت من كل مصدر": "And the orders and sales from each source",
    "📊 التقارير الكاملة": "📊 Full Reports",
    "الزوار في اليوم": "Visitors per day",
    "المنتجات الأكتر مشاهدة": "Most viewed products",
    "المشاهدات": "Views",
    "اتطلب": "Ordered",
    "نسبة الشراء": "Purchase rate",

    // ---- الشحن (الإعدادات) ----
    "أسعار الشحن للعميل": "Customer Shipping Rates",
    "سعر الشحن": "Shipping price",
    "شحن سريع": "Express",
    "بنوصّل": "We deliver",
    "حفظ الأسعار": "Save rates",
    "رجّع الأسعار الافتراضية": "Reset to defaults",
    "💳 الدفع بالتحويل": "💳 Bank Transfer Payment",
    "📦 الربط مع بوسطة": "📦 Bosta Integration",
    "حفظ": "Save",
    "جرّب المفتاح": "Test key",

    // ---- التقييمات ----
    "التقييم": "Rating",
    "الرأي": "Review",

    // ---- محرر المنتج ----
    "منتج جديد": "New Product",
    "تعديل المنتج": "Edit Product",
    "🖼️ الصور": "🖼️ Images",
    "اسم المنتج *": "Product name *",
    "الماركة": "Brand",
    "القسم *": "Category *",
    "السعر (ج.م) *": "Price (EGP) *",
    "السعر قبل الخصم": "Price before discount",
    "الكمية في المخزون *": "Stock quantity *",
    "الضمان": "Warranty",
    "شارة على الصورة": "Image badge",
    "الوصف": "Description",
    "أهم المميزات": "Key highlights",
    "الاختيارات": "Options",
    "المواصفات": "Specifications",
    "＋ إضافة صور": "＋ Add images",
    "🗑 حذف المنتج": "🗑 Delete product",
    "حفظ المنتج": "Save product",

    // ---- عملاء / سلات / حملات ----
    "آخر نشاط": "Last activity",
    "جه منين": "Source",
    "التذكير": "Reminder",
    "📣 ابعت عرض": "📣 Send offer",
    "⬇ تنزيل CSV": "⬇ Download CSV",
    "🟢 اشتروا": "🟢 Bought",
    "🟡 سابوا سلة": "🟡 Left a cart",
    "⚪ لسه ماشتروش": "⚪ Haven't bought yet",

    // ---- مودالات / أزرار مشتركة ----
    "إلغاء": "Cancel",
    "حفظ في قاعدة البيانات": "Save to database",
    "البريد الإلكتروني": "Email",
    "اختياري": "optional",
    "القائمة": "Menu",
    "إغلاق": "Close",
    "صوت الإشعارات": "Notification sound",
    "أقسام لوحة التحكم": "Dashboard sections",
    "الفترة": "Period",

    // ---- حالات الطلبات بالإيموجي (شارات الجدول ودرج الطلب) ----
    "🆕 جديد": "🆕 New",
    "✅ تم التأكيد": "✅ Confirmed",
    "🚚 تم الشحن": "🚚 Shipped",
    "📦 تم التوصيل": "📦 Delivered",
    "✖ ملغي": "✖ Cancelled",

    // ---- أزرار أسفل النظرة العامة ----
    "📦 تحديث المخزون": "📦 Update inventory",
    "مراجعة الطلبات الجديدة": "Review new orders",
    "إعدادات الشحن": "Shipping settings",
  });
})();
