package com.gtechmasr.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaProviderPicker;

// بيفتح المتجر في كروم ملء الشاشة. في نسخة الاختبار (DIAG) بيعرض الأول معلومات المتصفح
// وسبب آخر قفلة لو حصلت، عشان نعرف المشكلة من سكرين شوت.
public class StoreLauncherActivity extends LauncherActivity {

    private String lastCrash() {
        return getSharedPreferences("diag", MODE_PRIVATE).getString("crash", null);
    }

    private boolean launchPending;

    // بنفتح كروم بعد ما شاشة التطبيق تظهر فعلاً مش من onCreate: على أندرويد 15 (اتجرب على vivo)
    // الفتح من onCreate كان بيقفل التطبيق بعد ثانية من غير ما المتجر يظهر.
    @Override
    protected boolean shouldLaunchImmediately() {
        return false;
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && launchPending && !isFinishing()) {
            launchPending = false;
            launchTwa();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Throwable startError = null;
        try {
            super.onCreate(savedInstanceState);
        } catch (Throwable t) {
            if (!BuildConfig.DIAG) throw t;
            startError = t;
        }
        if (startError == null && isFinishing()) return;
        if (!BuildConfig.DIAG) {
            launchPending = true;
            return;
        }

        StringBuilder msg = new StringBuilder();
        msg.append("Device: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
                .append("\nAndroid: ").append(Build.VERSION.RELEASE).append(" (SDK ").append(Build.VERSION.SDK_INT).append(')');
        try {
            PackageManager pm = getPackageManager();
            ResolveInfo def = pm.resolveActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com")),
                    PackageManager.MATCH_DEFAULT_ONLY);
            msg.append("\nDefault browser: ").append(def == null || def.activityInfo == null ? "none" : def.activityInfo.packageName);
            TwaProviderPicker.Action action = TwaProviderPicker.pickProvider(pm);
            String mode = action.launchMode == TwaProviderPicker.LaunchMode.TRUSTED_WEB_ACTIVITY ? "TWA"
                    : action.launchMode == TwaProviderPicker.LaunchMode.CUSTOM_TAB ? "CustomTab" : "Browser/WebView";
            msg.append("\nPicked: ").append(action.provider).append(" / ").append(mode);
            try {
                msg.append("\nChrome: ").append(pm.getPackageInfo("com.android.chrome", 0).versionName)
                        .append(pm.getApplicationInfo("com.android.chrome", 0).enabled ? "" : " (DISABLED)");
            } catch (PackageManager.NameNotFoundException e) {
                msg.append("\nChrome: not installed");
            }
        } catch (Throwable t) {
            msg.append("\nInfo error: ").append(t);
        }
        if (startError != null) msg.append("\n\nStart error: ").append(android.util.Log.getStackTraceString(startError));
        String crash = lastCrash();
        msg.append("\n\nLast crash: ").append(crash == null ? "none" : crash.length() > 1800 ? crash.substring(0, 1800) : crash);

        new AlertDialog.Builder(this)
                .setTitle("GTECH test")
                .setMessage(msg.toString())
                .setCancelable(false)
                .setPositiveButton("Open store", (d, w) -> {
                    getSharedPreferences("diag", MODE_PRIVATE).edit().remove("crash").commit();
                    try {
                        launchTwa();
                    } catch (Throwable t) {
                        new AlertDialog.Builder(this).setTitle("Launch error")
                                .setMessage(android.util.Log.getStackTraceString(t))
                                .setPositiveButton("Close", (d2, w2) -> finish()).show();
                    }
                })
                .setNegativeButton("Close", (d, w) -> finish())
                .show();
    }
}
