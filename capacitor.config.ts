import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.titanfitness.app',
  appName: 'Titan Fitness',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#102217',
  },
  android: {
    backgroundColor: '#102217',
  },
  // Uncomment for live-reload during development:
  // server: {
  //   url: 'http://YOUR_LOCAL_IP:1337',
  //   cleartext: true,
  // },
};

export default config;
