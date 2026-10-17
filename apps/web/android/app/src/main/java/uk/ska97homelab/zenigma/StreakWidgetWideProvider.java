package uk.ska97homelab.zenigma;

/** The wide (4x2) streak widget: the streak, and a bar for how much of today is done. */
public class StreakWidgetWideProvider extends StreakWidgetBase {
    @Override
    int layout() {
        return R.layout.widget_streak_wide;
    }
}
