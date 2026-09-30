# إيميلات الطلبات (EmailJS)

العميل بيوصله إيميل لما يطلب، ومع كل مرحلة: تم التأكيد، خرج للتوصيل، تم الاستلام، الإلغاء.
الإيميل بيوصل للعميل لو كتب إيميله في صفحة الدفع (أو دخل بحساب Google).
مجاني لحد 200 إيميل في الشهر.

## 1. الحساب
افتح https://www.emailjs.com واعمل حساب مجاني (Sign Up).

## 2. ربط إيميلك (Email Service)
1. **Email Services ← Add New Service ← Gmail**.
2. **Connect Account** واختار الإيميل اللي هتبعت منه (مثلاً إيميل المتجر).
3. **Create Service** ← انسخ **Service ID** (بيبدأ بـ `service_`).

## 3. القالب (Email Template)
1. **Email Templates ← Create New Template**.
2. في خانات الإعدادات:
   - **Subject:** `{{subject}}`
   - **To Email:** `{{to_email}}`
   - **From Name:** `GTECH`
   - **Reply To:** `{{reply_to}}`
3. في **Content**: اختار **Edit Content ← Code Editor**، امسح اللي موجود، واكتب بس:
   ```
   {{{html}}}
   ```
   (تلات أقواس — عشان الإيميل يظهر بالتصميم)
4. **Save** ← انسخ **Template ID** (بيبدأ بـ `template_`).

## 4. المفتاح
**Account ← General ← Public Key** ← انسخه.

## 5. ابعت البيانات
ابعت: Public Key و Service ID و Template ID، وإيميلك لو عايز يوصلك إيميل بكل طلب جديد.
(أو حطهم بنفسك في `EMAIL_CONFIG` في `firebase-config.js`.)
