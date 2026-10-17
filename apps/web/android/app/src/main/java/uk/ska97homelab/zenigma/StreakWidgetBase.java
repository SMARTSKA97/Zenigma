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
 * The home-screen streak widgets (small, medium and wide share this drawing code): a flame, the streak in days and how many of today's puzzles are done.
 * The app writes the numbers (StreakWidgetPlugin); the widget only draws them, so it works with no network.
 * When the next set of puzzles has already arrived since the numbers were written, it says so instead of showing yesterday's count.
 */
public abstract class StreakWidgetBase extends AppWidgetProvider {

    static final String PREFS = "zenigma_widget";

    /** The layout this size of widget uses (all of them carry the same view ids). */
    abstract int layout();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, layout()));
        }
    }

    /** Redraws every placed widget, of every size, from the saved numbers. */
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        redraw(context, manager, StreakWidgetProvider.class, R.layout.widget_streak);
        redraw(context, manager, StreakWidgetSmallProvider.class, R.layout.widget_streak_small);
        redraw(context, manager, StreakWidgetWideProvider.class, R.layout.widget_streak_wide);
    }

    private static void redraw(Context context, AppWidgetManager manager, Class<?> provider, int layout) {
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        for (int id : ids) {
            manager.updateAppWidget(id, build(context, layout));
        }
    }

    private static RemoteViews build(Context context, int layout) {
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

        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setTextViewText(R.id.widget_count, String.valueOf(streak));
        views.setTextViewText(R.id.widget_days, "day streak");
        views.setTextViewText(R.id.widget_label, label);
        views.setProgressBar(R.id.widget_progress, Math.max(1, total), Math.min(done, Math.max(1, total)), false);
        views.setInt(R.id.widget_root, "setBackgroundResource", atRisk ? R.drawable.widget_bg_risk : R.drawable.widget_bg);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        return views;
    }
}
