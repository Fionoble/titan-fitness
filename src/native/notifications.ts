import { isNative } from './platform';

type TokenCallback = (token: string) => void;

/**
 * Initialize push notifications on native platforms.
 * Pass a callback to receive the device token (APNs on iOS, FCM on Android).
 */
export async function initPushNotifications(onToken?: TokenCallback) {
  if (!isNative) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    console.log('[Push] Registered with token:', token.value);
    onToken?.(token.value);
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('[Push] Registration failed:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Foreground notification:', notification);
    // TODO: Show in-app notification UI
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Notification tapped:', action);
    // TODO: Navigate based on action.notification.data
  });
}
