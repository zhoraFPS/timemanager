import "../global.css";
import { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants from "expo-constants";
import { useAuthStore } from "@/lib/store";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { registerForPushNotifications } from "@/lib/notifications";
import { getProfile } from "@/lib/api";

// Expo Go can't use native modules like FaceID — detect it to skip biometric
const isExpoGo = Constants.appOwnership === "expo";

function RootLayoutInner() {
  const { colors, isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const didInit = useRef(false);
  const router = useRouter();
  const segments = useSegments();

  // Load stored auth once
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function init() {
      try {
        const hasAuth = await useAuthStore.getState().loadStoredAuth();
        const { biometrieEnabled: bio, pushEnabled } = useAuthStore.getState();
        // Re-register push token silently if user had it enabled
        if (hasAuth && pushEnabled) {
          registerForPushNotifications().catch(() => {});
        }

        // After refresh succeeds, verify server-side password-change flag so
        // admin-forced changes take effect on next app launch, not next login.
        let mustChange = false;
        if (hasAuth) {
          try {
            const me = await getProfile();
            mustChange = Boolean(me?.mustChangePassword);
          } catch {
            /* network error — skip guard, let normal flow run */
          }
        }

        setIsReady(true);

        // Small delay to ensure router is mounted
        setTimeout(() => {
          if (!hasAuth) {
            router.replace("/login");
          } else if (mustChange) {
            router.replace("/passwort-aendern?forced=1");
          } else if (bio && !isExpoGo) {
            router.replace("/biometric");
          } else {
            router.replace("/(tabs)");
          }
        }, 50);
      } catch (e) {
        console.error("[INIT] error:", e);
        setIsReady(true);
        setTimeout(() => router.replace("/login"), 50);
      }
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
