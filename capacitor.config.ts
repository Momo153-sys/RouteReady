
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.routeready.app',
  appName: 'routeready',
  webDir: 'dist',
  android: {
    useLegacyBridge: true,
  },
};

export default config;
