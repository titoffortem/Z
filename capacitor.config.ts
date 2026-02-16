import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zet.app',
  appName: 'Z',
  webDir: 'out',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Вставьте сюда Web Client ID из Firebase Authentication
      serverClientId: '1011787360328-2ev3laqaaslks81lc6077gj216subrpi.apps.googleusercontent.com', 
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;