package uk.ska97homelab.zenigma;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge starts.
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(ScreenGuardPlugin.class);
        registerPlugin(ShareCardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
