package uk.ska97homelab.zenigma;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/**
 * The home-screen streak widget: a flame, the streak in days and how many of today's puzzles are done.
 * The app writes the numbers (StreakWidgetPlugin); the widget only draws them, so it works with no network.
 * When the next set of puzzles has already arrived since the numbers were written, it says so instead of showing yesterday's count.
 */
public class StreakWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "zenigma_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    /** Redraws every placed widget from the saved numbers. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, StreakWidgetProvider.class));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    private static RemoteViews build(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int streak = prefs.getInt("streak", 0);
        int done = prefs.getInt("done", 0);
        int total = prefs.getInt("total", 0);
        long rollover = prefs.getLong("rollover", 0);
        boolean known = prefs.getBoolean("known", false);
        boolean newDay = rollover > 0 && System.currentTimeMillis() >= rollover;
        if (newDay) {
            done = 0;
        }

        String label;
        boolean atRisk;
        if (!known) {
            label = "Open Zenigma to start";
            atRisk = false;
        } else if (newDay && streak > 0) {
            label = "New puzzles are ready";
            atRisk = true;
        } else if (done == 0) {
            label = streak > 0 ? "Play today to keep it" : "Play today's puzzles";
            atRisk = streak > 0;
        } else {
            label = done + " of " + total + " done today";
            atRisk = false;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
        views.setTextViewText(R.id.widget_count, String.valueOf(streak));
        views.setTextViewText(R.id.widget_days, "day streak");
        views.setTextViewText(R.id.widget_label, label);
        views.setInt(R.id.widget_root, "setBackgroundResource", atRisk ? R.drawable.widget_bg_risk : R.drawable.widget_bg);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        return views;
    }
}
