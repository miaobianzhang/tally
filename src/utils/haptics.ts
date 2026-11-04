import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function run(task: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  void task().catch(() => {
    // Haptics are best-effort: unsupported devices simply stay silent.
  });
}

export function hapticImpactLight(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticNotificationSuccess(): void {
  run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function hapticSelection(): void {
  run(() => Haptics.selectionAsync());
}
