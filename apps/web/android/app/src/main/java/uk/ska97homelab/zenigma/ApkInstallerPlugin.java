package uk.ska97homelab.zenigma;

import android.content.Context;
import android.content.Intent;
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
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * In-app updater support: downloads a release APK from this project's GitHub Releases and hands it to the
 * system installer. Android itself refuses the install unless the APK is signed with the same key as the
 * installed app, and the optional SHA-256 check guards against a corrupted download.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    /** Only this project's release downloads may be installed. */
    private static final String ALLOWED_PREFIX = "https://github.com/SMARTSKA97/Zenigma/releases/download/";

    private static final String UPDATE_DIR = "updates";
    private static final String UPDATE_FILE = "zenigma-update.apk";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String url = call.getString("url");
        final String expectedSha256 = call.getString("sha256");
        if (url == null || !url.startsWith(ALLOWED_PREFIX)) {
            call.reject("The update URL is not allowed");
            return;
        }
        executor.execute(() -> {
            try {
                File apk = download(url, expectedSha256);
                install(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Update failed" : e.getMessage(), e);
            }
        });
    }

    private File download(String url, String expectedSha256) throws Exception {
        Context context = getContext();
        File dir = new File(context.getCacheDir(), UPDATE_DIR);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Cannot create the update folder");
        }
        File[] old = dir.listFiles();
        if (old != null) {
            for (File f : old) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        File target = new File(dir, UPDATE_FILE);

        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        try {
            int code = connection.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) {
                throw new IOException("Download failed (HTTP " + code + ")");
            }
            long total = connection.getContentLengthLong();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0;
            long lastReport = 0;
            byte[] buffer = new byte[16 * 1024];
            try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(target)) {
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    received += read;
                    long now = System.currentTimeMillis();
                    if (now - lastReport > 250) {
                        lastReport = now;
                        reportProgress(received, total);
                    }
                }
            }
            reportProgress(received, total);

            if (expectedSha256 != null && !expectedSha256.isEmpty()) {
                String actual = toHex(digest.digest());
                String expected = expectedSha256.toLowerCase(Locale.ROOT).replace("sha256:", "");
                if (!actual.equals(expected)) {
                    //noinspection ResultOfMethodCallIgnored
                    target.delete();
                    throw new IOException("The downloaded file is corrupted. Try again.");
                }
            }
            return target;
        } finally {
            connection.disconnect();
        }
    }

    private void reportProgress(long received, long total) {
        JSObject progress = new JSObject();
        progress.put("received", received);
        progress.put("total", total);
        notifyListeners("downloadProgress", progress);
    }

    private void install(File apk) {
        Context context = getContext();
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format(Locale.ROOT, "%02x", b));
        }
        return sb.toString();
    }
}
