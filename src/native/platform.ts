import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isWeb = Capacitor.getPlatform() === 'web';

export const features = {
  pushNotifications: isNative,
  haptics: isNative,
  healthKit: isIOS,
  googleFit: isAndroid,
  nativeShare: isNative,
  // These work everywhere (PWA + native)
  indexedDB: true,
  serviceWorker: !isNative, // Not needed in native — files are local
  camera: true,
};
