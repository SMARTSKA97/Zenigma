package uk.ska97homelab.zenigma;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Hands the streak numbers to the home-screen widget and asks it to redraw. */
@CapacitorPlugin(name = "StreakWidget")
public class StreakWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor edit = context.getSharedPreferences(StreakWidgetBase.PREFS, Context.MODE_PRIVATE).edit();
        edit.putInt("streak", Math.max(0, call.getInt("streak", 0)));
        edit.putInt("done", Math.max(0, call.getInt("done", 0)));
        edit.putInt("total", Math.max(0, call.getInt("total", 0)));
        Double rollover = call.getDouble("rollover", 0.0);
        edit.putLong("rollover", rollover == null ? 0L : rollover.longValue());
        edit.putBoolean("known", true);
        edit.apply();
        StreakWidgetBase.refresh(context);
        call.resolve();
    }
}
