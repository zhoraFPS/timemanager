import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import * as LocalAuthentication from "expo-local-authentication";
import { ScanFace } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { SPRING_SMOOTH, SPRING_SNAPPY } from "@/lib/motion";

export default function BiometricScreen() {
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { colors } = useTheme();

  // Entrance animation
  const iconScale = useSharedValue(0.8);
  const iconOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    iconOpacity.value = withSpring(1, SPRING_SMOOTH);
    iconScale.value = withSpring(1, SPRING_SMOOTH);
    textOpacity.value = withDelay(150, withSpring(1, SPRING_SMOOTH));

    // Auto-trigger FaceID on mount
    authenticate();
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  async function authenticate() {
    setError(null);

    // Check hardware availability
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setError("Biometrie nicht verfügbar. Bitte mit Passwort anmelden.");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Mit Face ID anmelden",
      cancelLabel: "Abbrechen",
      // Don't fall back to device passcode — we handle fallback ourselves
      disableDeviceFallback: true,
      fallbackLabel: "Erneut versuchen",
    });

    if (result.success) {
      // Verify session is still valid before navigating
      const store = useAuthStore.getState();
      if (store.isAuthenticated && store.accessToken) {
        router.replace("/(tabs)");
      } else {
        // Token expired — try refresh
        const refreshed = await store.refresh();
        if (refreshed) {
          router.replace("/(tabs)");
        } else {
          // Session dead — back to login
          await store.logout();
          router.replace("/login");
        }
      }
    } else {
      const next = attempts + 1;
      setAttempts(next);

      if (result.error === "user_cancel") {
        // User tapped cancel — stay on screen, don't count as failed attempt
        setAttempts(attempts);
        return;
      }

      if (next >= 3) {
        await useAuthStore.getState().logout();
        router.replace("/login");
      } else {
        setError("Erkennung fehlgeschlagen. Versuche es erneut.");
      }
    }
  }

  async function goToLogin() {
    await useAuthStore.getState().logout();
    router.replace("/login");
  }

  // Press animation for retry button
  const retryScale = useSharedValue(1);
  const retryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: retryScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* FaceID icon */}
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: `${colors.primary}12` },
          ]}
        >
          <ScanFace size={56} color={colors.primary} strokeWidth={1.4} />
        </View>
      </Animated.View>

      {/* Text */}
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          VfL Zeitspiel
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Zum Entsperren Face ID verwenden
        </Text>
      </Animated.View>

      {/* Error */}
      {error && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      {/* Retry button */}
      <Animated.View style={retryStyle}>
        <Pressable
          onPress={authenticate}
          onPressIn={() => {
            retryScale.value = withSpring(0.96, SPRING_SNAPPY);
          }}
          onPressOut={() => {
            retryScale.value = withSpring(1, SPRING_SNAPPY);
          }}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.retryText}>
            {Platform.OS === "ios" ? "Face ID verwenden" : "Biometrie verwenden"}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Fallback to password */}
      <Pressable onPress={goToLogin} hitSlop={12}>
        <Text style={[styles.fallbackText, { color: colors.primary }]}>
          Mit Passwort anmelden
        </Text>
      </Pressable>

      {/* Attempt counter */}
      {attempts > 0 && (
        <Text style={[styles.attemptText, { color: colors.mutedForeground }]}>
          Versuch {attempts}/3
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    letterSpacing: -0.24,
    textAlign: "center",
  },
  error: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  retryBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    marginBottom: 16,
    minWidth: 240,
  },
  retryText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.41,
  },
  fallbackText: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: -0.24,
    marginBottom: 16,
  },
  attemptText: {
    fontSize: 12,
    marginTop: 8,
  },
});
