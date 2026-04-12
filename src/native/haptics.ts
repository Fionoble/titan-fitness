import { isNative } from './platform';

let Haptics: typeof import('@capacitor/haptics').Haptics | null = null;
let ImpactStyle: typeof import('@capacitor/haptics').ImpactStyle | null = null;
let NotificationType: typeof import('@capacitor/haptics').NotificationType | null = null;

if (isNative) {
  import('@capacitor/haptics').then((mod) => {
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
    NotificationType = mod.NotificationType;
  });
}

/** Light tap — use for button presses, toggles */
export async function hapticTap() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Light });
  }
}

/** Medium impact — use for completing a set */
export async function hapticMedium() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  }
}

/** Heavy impact — use for starting/finishing a workout */
export async function hapticHeavy() {
  if (Haptics && ImpactStyle) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }
}

/** Success notification — use for workout complete, PR achieved */
export async function hapticSuccess() {
  if (Haptics && NotificationType) {
    await Haptics.notification({ type: NotificationType.Success });
  }
}

/** Warning notification — use for rest timer ending */
export async function hapticWarning() {
  if (Haptics && NotificationType) {
    await Haptics.notification({ type: NotificationType.Warning });
  }
}

/** Error notification — use for validation errors */
export async function hapticError() {
  if (Haptics && NotificationType) {
    await Haptics.notification({ type: NotificationType.Error });
  }
}
