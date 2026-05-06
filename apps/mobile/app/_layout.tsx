import "../global.css";
import { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useRootNavigationState } from "expo-router";
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
  // target is null while auth is still loading, then set to the route to open
  const [target, setTarget] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const didInit = useRef(false);
  const didNavigate = useRef(false);
  const router = useRouter();
  // navState?.key is defined only once Expo Router's navigator has mounted
  const navState = useRootNavigationState();

  // Phase 1 — load stored auth (doesn't need the router to be ready yet)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    async function init() {
      try {
        const hasAuth = await useAuthStore.getState().loadStoredAuth();
        const { biometrieEnabled: bio, pushEnabled } = useAuthStore.getState();

        if (hasAuth && pushEnabled) {
          registerForPushNotifications().catch(() => {});
        }

        let mustChange = false;
        if (hasAuth) {
          try {
            const me = await getProfile();
            mustChange = Boolean(me?.mustChangePassword);
          } catch {
            /* network error — skip forced-change guard */
          }
        }

        setTarget(
          !hasAuth
            ? "/login"
            : mustChange
            ? "/passwort-aendern?forced=1"
            : bio && !isExpoGo
            ? "/biometric"
            : "/(tabs)"
        );
      } catch (e) {
        console.error("[INIT] error:", e);
        setTarget("/login");
      }
    }
    init();
  }, []);

  // Phase 2 — navigate once BOTH auth AND the router are ready
  // navState?.key is the signal that Expo Router's navigator has mounted
  useEffect(() => {
    if (!target || !navState?.key || didNavigate.current) return;
    didNavigate.current = true;

    router.replace(target as Parameters<typeof router.replace>[0]);

    // Show the slot one frame after the replace so the navigator has time
    // to process the new route before we unmount the splash spinner
    const t = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(t);
  }, [target, navState?.key]);

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
