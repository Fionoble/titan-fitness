import { isNative } from './platform';

export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
}

/**
 * Share content using the native share sheet, or Web Share API as fallback.
 * Returns true if shared successfully, false if dismissed/unsupported.
 */
export async function shareContent(options: ShareOptions): Promise<boolean> {
  if (isNative) {
    const { Share } = await import('@capacitor/share');
    const result = await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.title,
    });
    return result.activityType !== undefined;
  }

  // Web Share API fallback
  if (navigator.share) {
    try {
      await navigator.share(options);
      return true;
    } catch {
      return false; // User dismissed
    }
  }

  return false;
}
