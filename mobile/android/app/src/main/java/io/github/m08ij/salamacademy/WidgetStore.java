package io.github.m08ij.salamacademy;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Persists what the widgets show: the learner's progress snapshot (pushed by the site) and widget preferences. */
public final class WidgetStore {
    private static final String PREFS = "salam_widget";
    private static final String KEY_PROGRESS = "progress", KEY_LANG = "lang", KEY_VALUE_SHIFT = "value_shift";
    private WidgetStore() {}

    private static SharedPreferences p(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Progress snapshot as pushed by the site. Shape: {lang,program,level,levels,levelTitle,done,total,final,eligible,graduated,next:{t,path},path,at}. */
    public static final class Progress {
        public boolean empty = true;
        public String program = "", levelTitle = "", nextTitle = "", nextPath = "", path = "learn";
        public int level = 0, levels = 0, done = 0, total = 0, finalGrade = -1;
        public boolean eligible = false, graduated = false;
        public long at = 0;
    }

    public static void saveProgress(Context c, String json) {
        SharedPreferences.Editor e = p(c).edit().putString(KEY_PROGRESS, json);
        try { String l = new JSONObject(json).optString("lang", ""); if ("ar".equals(l) || "en".equals(l)) e.putString(KEY_LANG, l); } catch (Exception ignored) { }
        e.apply();
    }

    public static void clearProgress(Context c) { p(c).edit().remove(KEY_PROGRESS).apply(); }

    public static Progress loadProgress(Context c) {
        Progress pr = new Progress();
        String raw = p(c).getString(KEY_PROGRESS, null);
        if (raw == null) return pr;
        try {
            JSONObject o = new JSONObject(raw);
            pr.program = o.optString("program", "");
            pr.levelTitle = o.optString("levelTitle", "");
            pr.level = o.optInt("level", 0);
            pr.levels = o.optInt("levels", 0);
            pr.done = o.optInt("done", 0);
            pr.total = o.optInt("total", 0);
            pr.finalGrade = o.isNull("final") ? -1 : o.optInt("final", -1);
            pr.eligible = o.optBoolean("eligible", false);
            pr.graduated = o.optBoolean("graduated", false);
            pr.path = safePath(o.optString("path", "learn"), "learn");
            JSONObject n = o.optJSONObject("next");
            if (n != null) { pr.nextTitle = n.optString("t", ""); pr.nextPath = safePath(n.optString("path", ""), ""); }
            pr.at = o.optLong("at", 0);
            pr.empty = false;
        } catch (Exception e) { return new Progress(); }
        return pr;
    }

    /** Only relative site paths made of safe characters are ever handed to MainActivity. */
    static String safePath(String s, String fallback) {
        if (s == null) return fallback;
        s = s.replaceAll("^/+|/+$", "");
        return s.matches("[A-Za-z0-9/_-]{0,200}") ? s : fallback;
    }

    public static String lang(Context c) { return p(c).getString(KEY_LANG, "ar"); }
    public static void setLang(Context c, String l) { if ("ar".equals(l) || "en".equals(l)) p(c).edit().putString(KEY_LANG, l).apply(); }

    /** "Next value" taps shift the value of the day; the shift resets every day. Stored as "yyyymmdd:shift". */
    public static int valueShift(Context c, int today) {
        String s = p(c).getString(KEY_VALUE_SHIFT, "");
        String[] a = s.split(":");
        try { return a.length == 2 && Integer.parseInt(a[0]) == today ? Integer.parseInt(a[1]) : 0; } catch (Exception e) { return 0; }
    }

    public static void bumpValueShift(Context c, int today) {
        p(c).edit().putString(KEY_VALUE_SHIFT, today + ":" + (valueShift(c, today) + 1)).apply();
    }
}
