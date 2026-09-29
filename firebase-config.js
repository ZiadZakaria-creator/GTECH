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

// ============ كود تأكيد الموبايل (SMS) ============
// true = العميل لازم يأكد رقمه بكود SMS قبل ما يطلب
// false = مقفول (تقدر تجربه بس بإضافة ?sms=1 لآخر رابط الموقع)
// قبل ما تخليه true: ضيف دومين الموقع في Firebase ← Authentication ← Settings ← Authorized domains
// ملحوظة: الخطة المجانية فيها 10 رسايل بس في اليوم
const PHONE_VERIFICATION = true;
