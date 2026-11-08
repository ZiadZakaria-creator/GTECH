package com.gtechmasr.app;

import android.app.Application;

import java.io.PrintWriter;
import java.io.StringWriter;

// لو التطبيق قفل فجأة، بنحفظ سبب القفلة عشان نعرضها أول ما يتفتح تاني (نسخة الاختبار)
public class StoreApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            StringWriter text = new StringWriter();
            error.printStackTrace(new PrintWriter(text));
            getSharedPreferences("diag", MODE_PRIVATE).edit().putString("crash", text.toString()).commit();
            if (previous != null) previous.uncaughtException(thread, error);
        });
    }
}
