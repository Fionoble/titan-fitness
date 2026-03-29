// Native integration layer
// All exports gracefully no-op on web — safe to import anywhere.

export { isNative, isIOS, isAndroid, isWeb, features } from './platform';
export { hapticTap, hapticMedium, hapticHeavy, hapticSuccess, hapticWarning, hapticError } from './haptics';
export { configureStatusBar } from './status-bar';
export { shareContent } from './share';
export { initPushNotifications } from './notifications';
