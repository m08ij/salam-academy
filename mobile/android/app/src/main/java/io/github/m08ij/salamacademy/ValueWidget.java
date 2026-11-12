package io.github.m08ij.salamacademy;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

/** "Value of the day": a value from the Salam system with its balance point and one practical behavior. Works offline. */
public class ValueWidget extends AppWidgetProvider {
    static final String ACTION_NEXT = "io.github.m08ij.salamacademy.VALUE_NEXT";

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
    }

    @Override public void onReceive(Context c, Intent i) {
        if (ACTION_NEXT.equals(i.getAction())) {
            WidgetStore.bumpValueShift(c, Catalog.today());
            WidgetUi.refresh(c, ValueWidget.class);
            return;
        }
        super.onReceive(c, i);
    }

    static RemoteViews build(Context c) {
        String lang = WidgetStore.lang(c);
        boolean ar = !"en".equals(lang);
        Catalog.Value v = Catalog.ofTheDay(c, lang);
        RemoteViews r = new RemoteViews(c.getPackageName(), ar ? R.layout.widget_value : R.layout.widget_value_ltr);
        r.setTextViewText(R.id.v_kicker, ar ? "قيمة اليوم" : "Value of the day");
        r.setTextViewText(R.id.v_relation, v.relation);
        r.setTextViewText(R.id.v_title, v.title.isEmpty() ? (ar ? "منظومة سلام" : "The Salam system") : v.title);
        r.setTextViewText(R.id.v_balance, v.balance.isEmpty() ? "" : (ar ? "الاتزان: " : "Balance: ") + v.balance);
        r.setViewVisibility(R.id.v_balance, v.balance.isEmpty() ? View.GONE : View.VISIBLE);
        r.setTextViewText(R.id.v_behavior, v.behavior.isEmpty() ? "" : "« " + v.behavior + " »");
        r.setViewVisibility(R.id.v_behavior, v.behavior.isEmpty() ? View.GONE : View.VISIBLE);
        int color = v.relationId == 1 ? 0xFFA8800C : v.relationId == 3 ? 0xFF7A4E8F : 0xFF0B7F7A;
        r.setInt(R.id.v_bar, "setBackgroundColor", color);
        r.setTextColor(R.id.v_relation, color);
        r.setOnClickPendingIntent(R.id.v_root, WidgetUi.open(c, "values", 101));
        r.setOnClickPendingIntent(R.id.v_next, WidgetUi.broadcast(c, ValueWidget.class, ACTION_NEXT, 102));
        return r;
    }
}
