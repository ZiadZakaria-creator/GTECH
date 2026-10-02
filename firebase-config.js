// ============ إعدادات Firebase ============
// تسجيل الدخول بـ Google و Facebook بيشتغل عن طريق Firebase Authentication.
// لتفعيله: اعمل مشروع على https://console.firebase.google.com
// وضيف Web App، وانسخ الـ config هنا بدل null. مثال:
//
// const FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "gtech-store.firebaseapp.com",
//   projectId: "gtech-store",
//   appId: "1:123:web:abc",
// };
//
// لحد ما يتحط، أزرار Google و Facebook بتظهر رسالة إنها لسه مش متفعلة.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCDeWPb6h3weh-bOX6-c_yS6WU_adwehmY",
  authDomain: "g-tech-4b9b1.firebaseapp.com",
  projectId: "g-tech-4b9b1",
  storageBucket: "g-tech-4b9b1.firebasestorage.app",
  messagingSenderId: "259915634001",
  appId: "1:259915634001:web:e7ce53ddb4e55f4dbcaf70",
};

// ============ الدخول بحسابات التواصل ============
// الأزرار اللي بتظهر في نافذة الدخول. لازم كل واحد يكون متفعّل في
// Firebase ← Authentication ← Sign-in method. المتاح: "google"، "facebook"
const SOCIAL_PROVIDERS = ["google"];

// ============ كود تأكيد الموبايل (SMS) ============
// true = العميل لازم يأكد رقمه بكود SMS قبل ما يطلب
// false = مقفول (تقدر تجربه بس بإضافة ?sms=1 لآخر رابط الموقع)
// قبل ما تخليه true: ضيف دومين الموقع في Firebase ← Authentication ← Settings ← Authorized domains
// ملحوظة: الخطة المجانية فيها 10 رسايل بس في اليوم
// مقفول مؤقتاً: Firebase رافض يبعت رسايل حقيقية (auth/billing-not-enabled) لحد ما يتضاف حساب دفع (Blaze)
const PHONE_VERIFICATION = false;

// الحد اليومي لرسايل SMS (للعدّاد اللي في لوحة التحكم). لو فعّلت خطة Blaze خليه null
const SMS_DAILY_LIMIT = 10;

// ============ إيميلات الطلبات (EmailJS) ============
// إيميل للعميل لما يطلب، ومع كل مرحلة (تأكيد، خرج للتوصيل، تم الاستلام، إلغاء).
// الخطوات في EMAIL_SETUP.md. لحد ما البيانات دي تتحط، الإيميلات مقفولة.
const EMAIL_CONFIG = {
  publicKey: "nJuOxvKa6B0JK-d0z",
  serviceId: "service_0mvogqa",
  templateId: "template_1a7i7tf",
  storeEmail: "ziadzakaria966@gmail.com", // بيوصله إيميل بكل طلب جديد — امسح السطر ده لو مش عايز
};

// ============ قياس الزوار والإعلانات ============
// ga4: من Google Analytics ← Admin ← Data streams (شكله G-XXXXXXXXXX)
// metaPixel: من Meta Events Manager ← Data sources (رقم 15-16 خانة)
// سيبهم فاضيين لحد ما تعمل الحسابات — مفيش حاجة بتتحمّل وهما فاضيين
const ANALYTICS_IDS = { ga4: "", metaPixel: "" };

// ============ إشعار فوري على موبايلك بكل أوردر جديد (ntfy — مجاني) ============
// نزّل تطبيق ntfy على موبايلك ← + ← اكتب اسم القناة دي بالظبط ← Subscribe.
// القناة دي سرية: ماتنشرهاش. الإشعار فيه المنتجات والمبلغ والمحافظة بس (من غير اسم العميل أو رقمه).
// لو اتسرّبت أو عايز توقفها: غيّر الاسم هنا (أو امسح السطر) واشترك في الجديد.
const ORDER_PUSH_TOPIC = "gtech-orders-5d31c3d785f3de02";

// مثال:
// const EMAIL_CONFIG = {
//   publicKey: "xxxxxxxxxxxx",      // Account ← General ← Public Key
//   serviceId: "service_xxxxxxx",   // Email Services
//   templateId: "template_xxxxxxx", // Email Templates
//   storeEmail: "you@gmail.com",    // (اختياري) يوصلك إيميل بكل طلب جديد، والعميل يرد عليه
// };

// ============ حسابات التواصل (أيقونات في الموبايل اللي في الواجهة) ============
// امسح أي لينك مش عايزه يظهر
const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=61582595856275",
  tiktok: "https://www.tiktok.com/@ziadzkariaebrahim",
};
