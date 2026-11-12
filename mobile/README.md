# أكاديمية سلام — تطبيق أندرويد (Capacitor)

غلاف أندرويد يفتح الموقع المنشور (`https://m08ij.github.io/salam-academy/`). **أي تحديث للموقع يصل للتطبيق مباشرة** دون بناء APK جديد.
لما ينتقل الموقع لدومينه الخاص: غيّر `server.url` في `capacitor.config.json`، و`BASE` في `MainActivity.java`، و`HOST`/`PATH` في `AppUpdaterPlugin.java`.

## الودجتات
| الودجت | المصدر | يعمل دون اتصال؟ |
|---|---|---|
| **قيمة اليوم** (`ValueWidget`) | ملف مضمّن `assets/catalog.json` (209 قيم بموازينها وسلوكياتها)؛ قيمة جديدة كل يوم، وزر ⟳ لقيمة أخرى. الضغط يفتح «منظومة القيم» | نعم |
| **مستواي** (`ProgressWidget`) | لقطة يدفعها الموقع عبر `WidgetBridge.update` عند فتح «مستواي ومقرراتي»: المستوى، الدروس، العلامة، الدرس التالي. تُمسح عند تسجيل الخروج | يعرض آخر لقطة |

إضافتها: من «حسابي والأمان» داخل التطبيق، أو بالضغط المطوّل على الشاشة الرئيسية ← Widgets.
بعد تغيير `salam_payload.json`: `npm run catalog`.

## البناء
```
set JAVA_HOME=C:\Users\Admin\Desktop\Study Space\android-tools\jdk17
set ANDROID_HOME=C:\Users\Admin\Desktop\Study Space\android-tools\sdk
cd mobile
npx cap sync android
cd android
gradlew.bat assembleRelease
```
الناتج: `android\app\build\outputs\apk\release\app-release.apk`.
تحتاج إعادة البناء فقط عند تغيير الكود الأصلي (الودجتات، الأيقونة، الأذونات، الإضافات) — لا عند تغيير الموقع.
الأيقونات وشاشة البداية: `python tools/make-icons.py` (من الشعار في `frontend/public/logo.png`؛ ضع نسخة عالية الدقة وأعد التشغيل).

## التوقيع (مهم جدًا)
`keystore/salam-release.jks` و`keystore.properties` **غير مرفوعين على GitHub**. احتفظ بنسخة احتياطية منهما في مكان آمن:
بدونهما لا يمكن إصدار تحديث يُثبَّت فوق النسخة الحالية، وسيضطر كل مستخدم لحذف التطبيق وتثبيته من جديد.

## إصدار تحديث يصل للمثبّتين
1. ارفع `versionCode` (+1) و`versionName` في `android/app/build.gradle` ثم ابنِ.
2. `node tools/release.js "ملاحظة ١|ملاحظة ٢" --en "Note 1|Note 2"` — ينشئ GitHub Release فيه `SalamAcademy.apk` و`version.json` (مع بصمة SHA-256).
3. سير عمل Pages ينشرهما تحت `/apk/`، والتطبيق يعرض شريط «تحديث جديد»؛ الضغط ينزّل ويتحقق من البصمة ثم يفتح مثبّت أندرويد.
