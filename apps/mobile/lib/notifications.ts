import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { registerPushToken } from "./api";
import { useAuthStore } from "./store";

// Push notifications require a real physical device (not an emulator/simulator).
// Avoid relying on Constants.appOwnership — it can be unreliable in EAS builds.
const pushSupported = Device.isDevice;

// Show alerts even when the app is in foreground
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Returns true if the OS has granted push notification permission. */
export async function getPushPermissionStatus(): Promise<boolean> {
  if (!pushSupported || !Device.isDevice) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Requests permission, fetches the Expo push token, and registers it
 * with the backend for the current device.
 *
 * Returns the token string on success, null if permission was denied or
 * the device/project is not configured for push.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!pushSupported) return null;
  if (!Device.isDevice) {
    console.warn("[Push] Push notifications only work on real devices.");
    return null;
  }

  // Request OS permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "VfL Zeitspiel",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3b82f6",
    });
  }

  // Resolve projectId: EAS > Constants fallback
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  let pushToken: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    pushToken = tokenData.data;
  } catch (err) {
    console.error("[Push] getExpoPushTokenAsync failed:", err);
    return null;
  }

  // Register token with backend (include platform so the device list shows it)
  const deviceId = useAuthStore.getState().deviceId;
  if (deviceId) {
    try {
      await registerPushToken(deviceId, pushToken, Platform.OS);
    } catch {
      // Silent — token stored locally, will sync next time
    }
  }

  return pushToken;
}

/** Removes the push token from the device (called on logout or push disable). */
export async function unregisterPushToken(): Promise<void> {
  const deviceId = useAuthStore.getState().deviceId;
  if (!deviceId) return;
  try {
    await registerPushToken(deviceId, ""); // empty string clears it on backend
  } catch {
    // Silent
  }
}
