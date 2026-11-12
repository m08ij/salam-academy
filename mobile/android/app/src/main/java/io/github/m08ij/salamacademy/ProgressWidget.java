package io.github.m08ij.salamacademy;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/** "My level": current level, lesson progress, final grade and a shortcut to the next lesson. Data is pushed by the site via WidgetBridge. */
public class ProgressWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, build(c));
    }

    static RemoteViews build(Context c) {
        String lang = WidgetStore.lang(c);
        boolean ar = !"en".equals(lang);
        WidgetStore.Progress p = WidgetStore.loadProgress(c);
        RemoteViews r = new RemoteViews(c.getPackageName(), ar ? R.layout.widget_progress : R.layout.widget_progress_ltr);
        if (p.empty) {
            r.setTextViewText(R.id.p_kicker, ar ? "أكاديمية سلام" : "Salam Academy");
            r.setTextViewText(R.id.p_title, ar ? "مستواي" : "My level");
            r.setTextViewText(R.id.p_meta, ar ? "افتح التطبيق وسجّل الدخول ليظهر تقدّمك هنا." : "Open the app and sign in to see your progress here.");
            r.setViewVisibility(R.id.p_bar, View.GONE);
            r.setViewVisibility(R.id.p_next, View.GONE);
            r.setOnClickPendingIntent(R.id.p_root, WidgetUi.open(c, "learn", 201));
            return r;
        }
        String level = (ar ? "المستوى " : "Level ") + WidgetUi.n(p.level, lang) + " / " + WidgetUi.n(p.levels, lang);
        r.setTextViewText(R.id.p_kicker, p.program + " · " + level);
        r.setTextViewText(R.id.p_title, p.graduated ? (ar ? "تخرّجت! 🎓" : "Graduated! 🎓") : p.levelTitle.replaceFirst("^.*?:\\s*", ""));
        int pct = p.total > 0 ? Math.round(100f * p.done / p.total) : 0;
        StringBuilder meta = new StringBuilder();
        meta.append(WidgetUi.n(p.done, lang)).append("/").append(WidgetUi.n(p.total, lang)).append(ar ? " دروس" : " lessons");
        if (p.finalGrade >= 0) meta.append(ar ? " · العلامة " : " · Grade ").append(WidgetUi.n(p.finalGrade, lang)).append(ar ? "٪" : "%");
        if (p.eligible) meta.append(ar ? " · جاهز للانتقال ✓" : " · Ready to advance ✓");
        r.setTextViewText(R.id.p_meta, meta.toString());
        r.setViewVisibility(R.id.p_bar, p.graduated ? View.GONE : View.VISIBLE);
        r.setProgressBar(R.id.p_bar, 100, pct, false);
        boolean hasNext = !p.graduated && !p.nextTitle.isEmpty() && !p.nextPath.isEmpty();
        r.setViewVisibility(R.id.p_next, hasNext ? View.VISIBLE : View.GONE);
        if (hasNext) {
            r.setTextViewText(R.id.p_next, (ar ? "الدرس التالي: " : "Next: ") + p.nextTitle);
            r.setOnClickPendingIntent(R.id.p_next, WidgetUi.open(c, p.nextPath, 202));
        }
        r.setOnClickPendingIntent(R.id.p_root, WidgetUi.open(c, p.path, 203));
        return r;
    }
}
