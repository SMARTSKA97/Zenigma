import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.ska97homelab.zenigma',
  appName: 'Zenigma',
  webDir: 'dist/web/browser',
  server: {
    // The WebView origin becomes https://localhost; the API must allow it in CORS.
    androidScheme: 'https',
  },
};

export default config;
