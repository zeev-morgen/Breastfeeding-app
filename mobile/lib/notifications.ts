import * as Notifications from 'expo-notifications';

const NEXT_FEED_ID = 'next-feeding';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permissionPromise: Promise<boolean> | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted) return true;
      if (settings.canAskAgain === false) return false;
      const result = await Notifications.requestPermissionsAsync();
      return result.granted;
    })();
  }
  return permissionPromise;
}

export async function scheduleNextFeedingReminder(when: Date, body: string): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  // Cancel any previous reminder before scheduling a fresh one so we never
  // pile up duplicates as guidance gets refreshed.
  await Notifications.cancelScheduledNotificationAsync(NEXT_FEED_ID).catch(() => {});

  // Skip past or imminent triggers — guidance is sometimes "due now" right
  // after a save, and we don't want a buzz the moment the screen reloads.
  if (when.getTime() <= Date.now() + 30_000) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NEXT_FEED_ID,
    content: {
      title: 'זמן הנקה 🍼',
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

export async function cancelNextFeedingReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NEXT_FEED_ID).catch(() => {});
}
