package io.github.m08ij.salamacademy;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

/** Shared helpers for widget click intents and refreshes. */
public final class WidgetUi {
    private WidgetUi() {}

    /** Opens the app on a site path (see MainActivity.route). Distinct request codes keep the PendingIntents apart. */
    public static PendingIntent open(Context c, String route, int requestCode) {
        Intent i = new Intent(c, MainActivity.class)
            .setAction("io.github.m08ij.salamacademy.OPEN." + requestCode)
            .putExtra("route", route)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** A broadcast to one of our own widget providers (e.g. "next value"). */
    public static PendingIntent broadcast(Context c, Class<?> provider, String action, int requestCode) {
        Intent i = new Intent(c, provider).setAction(action);
        return PendingIntent.getBroadcast(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void refresh(Context c, Class<?> provider) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, provider));
        if (ids.length == 0) return;
        Intent i = new Intent(c, provider).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        c.sendBroadcast(i);
    }

    public static void refreshAll(Context c) {
        refresh(c, ValueWidget.class);
        refresh(c, ProgressWidget.class);
    }

    /** Western or Arabic-Indic digits to match the widget language. */
    public static String n(int v, String lang) {
        String s = String.valueOf(v);
        if (!"ar".equals(lang)) return s;
        StringBuilder b = new StringBuilder();
        for (char ch : s.toCharArray()) b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        return b.toString();
    }
}
