package io.github.m08ij.salamacademy;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * App updater: info() = installed version; install({url, sha256}) downloads the APK (https from the site host only),
 * verifies SHA-256, then opens the Android installer (same signing key required, or Android refuses it).
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String HOST = "m08ij.github.io";
    private static final String PATH = "/salam-academy/apk/";
    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void info(PluginCall call) {
        try {
            Context c = getContext();
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versionName", p.versionName);
            r.put("versionCode", Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode);
            call.resolve(r);
        } catch (Exception e) { call.reject("no info"); }
    }

    @PluginMethod
    public void install(final PluginCall call) {
        final String url = call.getString("url", "");
        final String sha = call.getString("sha256", "");
        final Context c = getContext();
        URL u;
        try { u = new URL(url); } catch (Exception e) { call.reject("bad url"); return; }
        if (!"https".equals(u.getProtocol()) || !HOST.equals(u.getHost()) || !u.getPath().startsWith(PATH) || u.getPath().contains("..")) { call.reject("url not allowed"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !c.getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
            } catch (Exception ignored) { }
            JSObject r = new JSObject(); r.put("needsPermission", true); call.resolve(r);
            return;
        }
        final URL fu = u;
        pool.execute(() -> {
            File dir = new File(c.getCacheDir(), "updates"); dir.mkdirs();
            File out = new File(dir, "update.apk");
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) fu.openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(30000); con.setInstanceFollowRedirects(true);
                if (con.getResponseCode() != 200) { call.reject("http " + con.getResponseCode()); return; }
                long total = con.getContentLengthLong(), got = 0; int lastPct = -1;
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                try (InputStream in = con.getInputStream(); FileOutputStream fo = new FileOutputStream(out)) {
                    byte[] buf = new byte[32768]; int n;
                    while ((n = in.read(buf)) > 0) {
                        fo.write(buf, 0, n); md.update(buf, 0, n); got += n;
                        if (total > 0) { int pct = (int) (got * 100 / total); if (pct != lastPct) { lastPct = pct; JSObject e = new JSObject(); e.put("pct", pct); notifyListeners("progress", e); } }
                    }
                }
                StringBuilder hex = new StringBuilder();
                for (byte b : md.digest()) hex.append(String.format("%02x", b));
                if (sha != null && !sha.isEmpty() && !hex.toString().equalsIgnoreCase(sha)) { out.delete(); call.reject("checksum mismatch"); return; }
                Uri uri = FileProvider.getUriForFile(c, c.getPackageName() + ".fileprovider", out);
                Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                JSObject r = new JSObject(); r.put("started", true); call.resolve(r);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            } finally { if (con != null) con.disconnect(); }
        });
    }
}
