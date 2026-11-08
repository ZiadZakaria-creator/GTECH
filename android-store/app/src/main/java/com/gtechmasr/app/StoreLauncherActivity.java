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

    // سجل بسيط لنسخة الاختبار: إيه اللي حصل في آخر فتحة (بيتعرض في الرسالة)
    void logEvent(String event) {
        if (!BuildConfig.DIAG) return;
        android.content.SharedPreferences p = getSharedPreferences("diag", MODE_PRIVATE);
        String old = p.getString("events", "");
        if (old.length() > 1500) old = old.substring(old.length() - 1500);
        long t = android.os.SystemClock.uptimeMillis() % 100000;
        p.edit().putString("events", old + t + " " + event + "\n").commit();
    }

    @Override
    protected androidx.browser.customtabs.CustomTabsCallback getCustomTabsCallback() {
        final androidx.browser.customtabs.CustomTabsCallback quality = super.getCustomTabsCallback();
        return new androidx.browser.customtabs.CustomTabsCallback() {
            @Override
            public void onNavigationEvent(int navigationEvent, Bundle extras) {
                logEvent("nav " + navigationEvent);
                quality.onNavigationEvent(navigationEvent, extras);
            }

            @Override
            public void extraCallback(String callbackName, Bundle args) {
                logEvent("extra " + callbackName + " " + args);
                quality.extraCallback(callbackName, args);
            }

            @Override
            public Bundle extraCallbackWithResult(String callbackName, Bundle args) {
                logEvent("extraR " + callbackName + " " + args);
                return quality.extraCallbackWithResult(callbackName, args);
            }
        };
    }

    @Override
    protected void onPause() { super.onPause(); logEvent("pause"); }

    @Override
    protected void onStop() { super.onStop(); logEvent("stop"); }

    @Override
    protected void onDestroy() { logEvent("destroy finishing=" + isFinishing()); super.onDestroy(); }

    private boolean hasReport() {
        android.content.SharedPreferences p = getSharedPreferences("diag", MODE_PRIVATE);
        return p.contains("crash") || p.contains("events");
    }

    // النسخة العادية بتفتح المتجر على طول. نسخة الاختبار بتعرض تقرير آخر فتحة لو فيه.
    @Override
    protected boolean shouldLaunchImmediately() {
        return !(BuildConfig.DIAG && hasReport());
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
        if (startError == null && (isFinishing() || shouldLaunchImmediately())) {
            logEvent("create, launched=" + !isFinishing());
            return;
        }
        android.content.SharedPreferences diag = getSharedPreferences("diag", MODE_PRIVATE);

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
        msg.append("\n\nEvents:\n").append(diag.getString("events", "none"));

        new AlertDialog.Builder(this)
                .setTitle("GTECH test")
                .setMessage(msg.toString())
                .setCancelable(false)
                .setPositiveButton("Open store", (d, w) -> {
                    getSharedPreferences("diag", MODE_PRIVATE).edit().remove("crash").remove("events").commit();
                    logEvent("open tapped");
                    try {
                        launchTwa();
                    } catch (Throwable t) {
                        new AlertDialog.Builder(this).setTitle("Launch error")
                                .setMessage(android.util.Log.getStackTraceString(t))
                                .setPositiveButton("Close", (d2, w2) -> finish()).show();
                    }
                })
                .setNegativeButton("Clear", (d, w) -> {
                    getSharedPreferences("diag", MODE_PRIVATE).edit().remove("crash").remove("events").commit();
                    finish();
                })
                .show();
    }
}
