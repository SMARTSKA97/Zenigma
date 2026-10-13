package uk.ska97homelab.zenigma;

import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the screen on while a puzzle is open and, for the daily puzzles, blocks screenshots and screen recording
 * (which also blacks out the app in the recent-apps list), so a solved daily cannot be passed around as a picture.
 */
@CapacitorPlugin(name = "ScreenGuard")
public class ScreenGuardPlugin extends Plugin {

    @PluginMethod
    public void enter(PluginCall call) {
        final boolean secure = Boolean.TRUE.equals(call.getBoolean("secure", false));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (secure) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void leave(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
