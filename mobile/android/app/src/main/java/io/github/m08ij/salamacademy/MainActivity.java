package io.github.m08ij.salamacademy;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** The published site. Change this one constant (and capacitor.config.json) when the site moves to its own domain. */
    public static final String BASE = "https://m08ij.github.io/salam-academy/";

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        route(getIntent(), true);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        route(intent, false);
    }

    /** Opens the site path a widget asked for (extra "route", e.g. "values" or "learn/<id>"). Only relative site paths are accepted. */
    private void route(Intent i, boolean cold) {
        if (i == null) return;
        final String r = i.getStringExtra("route");
        if (r == null) return;
        i.removeExtra("route");
        if (!r.matches("[A-Za-z0-9/_-]{0,200}")) return;
        final WebView w = getBridge() != null ? getBridge().getWebView() : null;
        if (w == null) return;
        final String url = BASE + (r.isEmpty() ? "" : r + "/");
        w.postDelayed(() -> w.loadUrl(url), cold ? 150 : 0);
    }
}
