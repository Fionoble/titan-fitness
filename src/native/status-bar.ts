import { isNative } from './platform';

export async function configureStatusBar() {
  if (!isNative) return;

  const { StatusBar, Style } = await import('@capacitor/status-bar');

  // Dark style = light text on dark background (matches #102217 theme)
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: '#102217' });
}
