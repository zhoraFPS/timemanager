import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { registerPushToken } from "./api";
import { useAuthStore } from "./store";

// Push notifications require a real physical device (not an emulator/simulator).
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
  if (!pushSupported) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Thrown when the OS permission is granted but the Expo push token cannot be
 * retrieved — almost always because FCM v1 credentials are missing in EAS.
 */
export class PushTokenError extends Error {
  constructor(cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(msg);
    this.name = "PushTokenError";
  }
}

/**
 * Requests permission and fetches the Expo push token.
 *
 * Returns null  → OS permission denied (user must enable in device settings)
 * Returns token → success
 * Throws PushTokenError → permission granted but token retrieval failed
 *   (most likely cause: FCM v1 credentials not configured in EAS)
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!pushSupported || !Device.isDevice) return null;

  // Request OS permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  // Return null = permission denied → caller shows "enable in settings"
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
    // Log full error for debugging (visible in EAS build logs / Logcat)
    console.error("[Push] getExpoPushTokenAsync failed:", err);
    // Re-throw so the caller can show an accurate error message
    throw new PushTokenError(err);
  }

  // Register token with backend — include platform, model and OS version
  const deviceId = useAuthStore.getState().deviceId;
  if (deviceId) {
    try {
      await registerPushToken(
        deviceId,
        pushToken,
        Platform.OS,
        Device.modelName ?? undefined,
        Device.osVersion ?? undefined,
      );
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
    await registerPushToken(deviceId, "");
  } catch {
    // Silent
  }
}
