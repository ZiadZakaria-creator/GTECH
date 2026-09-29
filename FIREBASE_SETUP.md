# ربط المتجر بـ Firebase (الداشبورد + تسجيل الدخول)

الخطوات دي بتتعمل مرة واحدة. بعدها الطلبات بتوصل للوحة التحكم من أي جهاز لحظة بلحظة.

## 1. إنشاء المشروع
1. افتح https://console.firebase.google.com وسجّل بحساب Google بتاعك.
2. **Create a project** ← اسم المشروع مثلاً `gtech-store` ← كمّل (Google Analytics اختياري).

## 2. إضافة الموقع للمشروع
1. من صفحة المشروع اضغط أيقونة الويب **</>**.
2. اكتب اسم مثلاً `GTECH Web` ← **Register app**.
3. هيظهرلك كود فيه `const firebaseConfig = {...}` — انسخ اللي بين القوسين `{ }` وابعته (أو حطه في `firebase-config.js` بدل `null`).

## 3. قاعدة البيانات (Firestore)
1. من القائمة: **Build ← Firestore Database ← Create database**.
2. اختار مكان قريب (مثلاً `eur3 (europe-west)`) ← **Start in production mode**.
3. من تبويب **Rules** امسح اللي موجود والصق محتوى ملف `firestore.rules` ← **Publish**.

## 4. حساب صاحب المتجر (الأدمن)
1. **Build ← Authentication ← Get started ← Sign-in method** ← فعّل **Email/Password**.
2. تبويب **Users ← Add user** ← اكتب إيميلك وكلمة سر قوية.
3. انسخ الـ **User UID** اللي ظهر للمستخدم ده.
4. ارجع لـ **Firestore Database ← Start collection**:
   - Collection ID: `admins`
   - Document ID: الصق الـ UID
   - ضيف حقل: `role` = `owner` ← **Save**.

## 5. صفحة "طلباتي" للعملاء
- **Authentication ← Sign-in method ← Add new provider ← Anonymous ← Enable**.
- العميل بياخد حساب مجهول في المتصفح، والطلب بيتربط بيه عشان يشوف طلباته هو بس.

## 6. كود تأكيد SMS
1. **Authentication ← Sign-in method ← Phone ← Enable**.
2. **Authentication ← Settings ← Authorized domains ← Add domain**: `ziadzakaria-creator.github.io`
3. للتجربة من غير ما تصرف رسايل: **Phone ← Phone numbers for testing** وضيف رقم تجريبي وكود ثابت.
4. جرّب على `https://ziadzakaria-creator.github.io/GTECH/?sms=1`، ولما يشتغل خلّي `PHONE_VERIFICATION = true` في `firebase-config.js`.
- الخطة المجانية فيها 10 رسايل في اليوم؛ لأكتر من كده لازم تضيف وسيلة دفع (Blaze).

## 7. تسجيل الدخول بـ Google و Facebook (اختياري)
- **Authentication ← Sign-in method ← Google ← Enable**.
- **Facebook**: محتاج تطبيق من https://developers.facebook.com (App ID + App Secret) تحطهم في Firebase، وتنسخ الـ OAuth redirect URI من Firebase لإعدادات تطبيق Facebook.
- **Authentication ← Settings ← Authorized domains ← Add domain**: `ziadzakaria-creator.github.io`

## بعد الربط
- لوحة التحكم: https://ziadzakaria-creator.github.io/GTECH/admin.html
- ادخل بالإيميل وكلمة السر اللي عملتهم في خطوة 4.
- العلامة فوق هتتغير من **🧪 تجريبي** لـ **🟢 مباشر**.
