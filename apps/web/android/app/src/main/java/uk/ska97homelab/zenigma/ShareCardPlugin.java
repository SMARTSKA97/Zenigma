package uk.ska97homelab.zenigma;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/** Hands a result card (a PNG made by the web layer) to Android's share sheet, with the text as the caption. */
@CapacitorPlugin(name = "ShareCard")
public class ShareCardPlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("No image");
            return;
        }
        try {
            Context context = getContext();
            File dir = new File(context.getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Could not prepare the image");
                return;
            }
            File file = new File(dir, "zenigma-result.png");
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(Base64.decode(data, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text");
            if (text != null) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, call.getString("title", "Share result"));
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not share: " + e.getMessage());
        }
    }
}
