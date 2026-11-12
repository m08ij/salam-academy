package io.github.m08ij.salamacademy;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Site ↔ widgets bridge.
 * update({data})  stores the learner's progress snapshot and refreshes the widgets.
 * clear()         forgets it (sign-out), so no personal data stays on the home screen.
 * setLang({lang}) widget language.
 * pin({type})     asks the launcher to add a widget ("value" | "progress").
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 20000) { call.reject("bad data"); return; }
        Context c = getContext();
        WidgetStore.saveProgress(c, data);
        WidgetUi.refreshAll(c);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context c = getContext();
        WidgetStore.clearProgress(c);
        WidgetUi.refreshAll(c);
        call.resolve();
    }

    @PluginMethod
    public void setLang(PluginCall call) {
        Context c = getContext();
        WidgetStore.setLang(c, call.getString("lang", "ar"));
        WidgetUi.refreshAll(c);
        call.resolve();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        Class<?> k = "progress".equals(call.getString("type", "value")) ? ProgressWidget.class : ValueWidget.class;
        Context c = getContext();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        boolean ok = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported();
        if (ok) {
            try { ok = m.requestPinAppWidget(new ComponentName(c, k), null, null); } catch (Exception e) { ok = false; }
        }
        JSObject r = new JSObject();
        r.put("requested", ok);
        call.resolve(r);
    }
}
