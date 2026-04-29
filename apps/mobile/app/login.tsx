import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StatusBar,
  type TextInput as RNTextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated from "react-native-reanimated";
import { Clock, User as UserIcon, Lock, Fingerprint, QrCode, ChevronRight } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";

import { useAuthStore } from "@/lib/store";
import { loginWithCredentials } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import {
  useEntranceAnimation,
  useScaleEntrance,
  useShake,
  useRotation,
  staggerDelay,
} from "@/lib/motion";

import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { GlassInput } from "@/components/ui/glass-input";
import { GradientButton } from "@/components/ui/gradient-button";

export default function LoginScreen() {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const router = useRouter();
  const { colors, isDark, typography } = useTheme();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const biometrieEnabled = useAuthStore((s) => s.biometrieEnabled);

  const passwordRef = useRef<RNTextInput>(null);

  // Entrance animations — staggered
  const logoStyle = useScaleEntrance(0);
  const welcomeStyle = useEntranceAnimation(staggerDelay(1, 120));
  const card1Style = useEntranceAnimation(staggerDelay(2, 120));
  const card2Style = useEntranceAnimation(staggerDelay(3, 120));
  const buttonStyle = useEntranceAnimation(staggerDelay(4, 120));
  const footerStyle = useEntranceAnimation(staggerDelay(5, 120));

  // Clock icon idle rotation
  const clockRotation = useRotation(120000); // full rotation every 2 min

  // Shake on error
  const { style: shakeStyle, trigger: triggerShake } = useShake();

  // Check biometric availability on mount
  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled && biometrieEnabled);
    })();
  }, [biometrieEnabled]);

  async function handleLogin() {
    if (!employeeNumber.trim() || !password.trim()) {
      setError(true);
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert("Fehlende Angaben", "Bitte Mitarbeiternummer und Passwort eingeben");
      return;
    }

    setError(false);
    setLoading(true);
    try {
      let did = deviceId;
      if (!did) {
        did = Crypto.randomUUID();
        await setDeviceId(did);
      }

      const result = await loginWithCredentials(
        employeeNumber.trim(),
        password,
        did,
      );
      await setAuth(result.user, result.accessToken, result.refreshToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (result.user.mustChangePassword) {
        router.replace("/passwort-aendern?forced=1");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      setError(true);
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const apiError = err as { response?: { data?: { error?: string } } };
      const msg = apiError.response?.data?.error || "Anmeldung fehlgeschlagen";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Mit Biometrie anmelden",
        fallbackLabel: "Passwort verwenden",
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Biometric unlock flow is handled in app/biometric.tsx
        router.replace("/biometric");
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Aurora atmospheric background */}
      <AuroraBackground intensity="normal" />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.container}>
            {/* ---- Logo + Hero ---- */}
            <View style={styles.heroSection}>
              <Animated.View
                style={[styles.logoCircle, {
                  backgroundColor: colors.glassBackground,
                  borderColor: colors.glassBorder,
                }, logoStyle]}
              >
                <Animated.View style={clockRotation}>
                  <Clock size={40} color={colors.primary} strokeWidth={2.2} />
                </Animated.View>
              </Animated.View>

              <Animated.View style={welcomeStyle}>
                <Text style={[typography.hero, { color: colors.foreground, textAlign: "center", marginTop: 24 }]}>
                  Willkommen zurück
                </Text>
                <Text style={[typography.body, { color: colors.mutedForeground, textAlign: "center", marginTop: 8, fontSize: 15 }]}>
                  Melde dich an, um deine Zeit{"\n"}zu verwalten
                </Text>
              </Animated.View>
            </View>

            {/* ---- Form ---- */}
            <Animated.View style={[styles.formSection, shakeStyle]}>
              <Animated.View style={card1Style}>
                <GlassInput
                  label="Mitarbeiternummer"
                  icon={<UserIcon size={18} color={colors.mutedForeground} />}
                  value={employeeNumber}
                  onChangeText={(t) => {
                    setEmployeeNumber(t);
                    if (error) setError(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  error={error}
                />
              </Animated.View>

              <Animated.View style={[{ marginTop: 14 }, card2Style]}>
                <GlassInput
                  ref={passwordRef}
                  label="Passwort"
                  icon={<Lock size={18} color={colors.mutedForeground} />}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (error) setError(false);
                  }}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  error={error}
                />
              </Animated.View>

              <Animated.View style={[{ marginTop: 22 }, buttonStyle]}>
                <GradientButton
                  onPress={handleLogin}
                  loading={loading}
                  size="lg"
                  icon={!loading ? <ChevronRight size={20} color={colors.primaryForeground} /> : undefined}
                >
                  Anmelden
                </GradientButton>
              </Animated.View>

              {biometricAvailable ? (
                <Animated.View style={[{ marginTop: 16 }, buttonStyle]}>
                  <TouchableOpacity
                    onPress={handleBiometricLogin}
                    style={[styles.biometricButton, {
                      borderColor: colors.glassBorder,
                      backgroundColor: colors.glassBackground,
                    }]}
                    activeOpacity={0.7}
                  >
                    <Fingerprint size={18} color={colors.primary} />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginLeft: 8 }}>
                      Mit Biometrie anmelden
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
            </Animated.View>

            {/* ---- Footer ---- */}
            <Animated.View style={[styles.footer, footerStyle]}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={() => router.push("/qr-scan")}
                style={styles.qrButton}
                activeOpacity={0.7}
              >
                <QrCode size={16} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "500", marginLeft: 8 }}>
                  Mit QR-Code koppeln
                </Text>
                <ChevronRight size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: "center",
    marginTop: 60,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  formSection: {
    width: "100%",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  divider: {
    width: "40%",
    height: 1,
    marginBottom: 20,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
