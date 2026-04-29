import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  type TextInput as RNTextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { Lock, Check, X, ChevronLeft, ShieldAlert } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/lib/theme";
import { useEntranceAnimation, staggerDelay, useShake } from "@/lib/motion";
import { getPasswordPolicy, changePassword } from "@/lib/api";
import type { PasswordPolicy } from "@/lib/types";
import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { GlassInput } from "@/components/ui/glass-input";
import { GradientButton } from "@/components/ui/gradient-button";

export default function PasswortAendernScreen() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ forced?: string }>();
  const forced = params.forced === "1";

  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const newRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const heroStyle = useEntranceAnimation(staggerDelay(0, 80));
  const currentStyle = useEntranceAnimation(staggerDelay(1, 80));
  const newStyle = useEntranceAnimation(staggerDelay(2, 80));
  const confirmStyle = useEntranceAnimation(staggerDelay(3, 80));
  const checklistStyle = useEntranceAnimation(staggerDelay(4, 80));
  const submitStyle = useEntranceAnimation(staggerDelay(5, 80));
  const { style: shakeStyle, trigger: triggerShake } = useShake();

  useEffect(() => {
    getPasswordPolicy()
      .then(setPolicy)
      .catch(() => {
        setPolicy({
          minLength: 8,
          requireUpper: true,
          requireLower: true,
          requireNumber: true,
          requireSymbol: true,
        });
      });
  }, []);

  const rules = policy
    ? [
        {
          key: "length",
          label: `Mindestens ${policy.minLength} Zeichen`,
          ok: newPassword.length >= policy.minLength,
        },
        {
          key: "upper",
          label: "Grossbuchstabe (A-Z, Ä-Ü)",
          ok: !policy.requireUpper || /[A-ZÄÖÜ]/.test(newPassword),
        },
        {
          key: "lower",
          label: "Kleinbuchstabe (a-z, ä-ü)",
          ok: !policy.requireLower || /[a-zäöüß]/.test(newPassword),
        },
        {
          key: "number",
          label: "Ziffer (0-9)",
          ok: !policy.requireNumber || /\d/.test(newPassword),
        },
        {
          key: "symbol",
          label: "Sonderzeichen (!@#$...)",
          ok: !policy.requireSymbol || /[^A-Za-zÄÖÜäöüß0-9]/.test(newPassword),
        },
      ]
    : [];

  const allRulesOk = rules.every((r) => r.ok);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    !loading &&
    allRulesOk &&
    passwordsMatch &&
    (forced || currentPassword.length > 0);

  async function handleSubmit() {
    if (!canSubmit) {
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        currentPassword: forced ? undefined : currentPassword,
        newPassword,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        "Passwort geaendert",
        "Dein neues Passwort ist aktiv.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)"),
          },
        ],
      );
    } catch (err: unknown) {
      triggerShake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const apiError = err as {
        response?: { data?: { error?: string; violations?: string[] } };
      };
      const violations = apiError.response?.data?.violations;
      const msg =
        violations && violations.length > 0
          ? violations.join("\n")
          : apiError.response?.data?.error || "Passwortaenderung fehlgeschlagen";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuroraBackground intensity="subtle" />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {!forced ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <ChevronLeft size={24} color={colors.foreground} />
            </TouchableOpacity>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={[styles.hero, heroStyle]}>
              {forced ? (
                <View
                  style={[
                    styles.forcedBadge,
                    {
                      backgroundColor: colors.destructive + "18",
                      borderColor: colors.destructive + "44",
                    },
                  ]}
                >
                  <ShieldAlert size={14} color={colors.destructive} />
                  <Text
                    style={{
                      color: colors.destructive,
                      fontSize: 12,
                      fontWeight: "600",
                      marginLeft: 6,
                    }}
                  >
                    Passwortaenderung erforderlich
                  </Text>
                </View>
              ) : null}
              <Text
                style={[
                  typography.hero,
                  { color: colors.foreground, textAlign: "center", marginTop: 12 },
                ]}
              >
                Passwort aendern
              </Text>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.mutedForeground,
                    textAlign: "center",
                    marginTop: 8,
                    fontSize: 14,
                  },
                ]}
              >
                {forced
                  ? "Bitte waehle ein neues Passwort, um fortzufahren."
                  : "Waehle ein starkes Passwort, das du dir merken kannst."}
              </Text>
            </Animated.View>

            <Animated.View style={[styles.formSection, shakeStyle]}>
              {!forced ? (
                <Animated.View style={currentStyle}>
                  <GlassInput
                    label="Aktuelles Passwort"
                    icon={<Lock size={18} color={colors.mutedForeground} />}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    returnKeyType="next"
                    onSubmitEditing={() => newRef.current?.focus()}
                  />
                </Animated.View>
              ) : null}

              <Animated.View style={[{ marginTop: forced ? 0 : 14 }, newStyle]}>
                <GlassInput
                  ref={newRef}
                  label="Neues Passwort"
                  icon={<Lock size={18} color={colors.mutedForeground} />}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                />
              </Animated.View>

              <Animated.View style={[{ marginTop: 14 }, confirmStyle]}>
                <GlassInput
                  ref={confirmRef}
                  label="Passwort wiederholen"
                  icon={<Lock size={18} color={colors.mutedForeground} />}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  error={confirmPassword.length > 0 && !passwordsMatch}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.checklist,
                  {
                    backgroundColor: colors.backgroundElevated,
                    borderColor: colors.border,
                  },
                  checklistStyle,
                ]}
              >
                {rules.map((r) => (
                  <View key={r.key} style={styles.checklistRow}>
                    {r.ok ? (
                      <Check size={14} color="#22c55e" />
                    ) : (
                      <X size={14} color={colors.mutedForeground} />
                    )}
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: r.ok ? "#22c55e" : colors.mutedForeground,
                      }}
                    >
                      {r.label}
                    </Text>
                  </View>
                ))}
                <View style={styles.checklistRow}>
                  {passwordsMatch ? (
                    <Check size={14} color="#22c55e" />
                  ) : (
                    <X size={14} color={colors.mutedForeground} />
                  )}
                  <Text
                    style={{
                      marginLeft: 8,
                      fontSize: 12,
                      color: passwordsMatch ? "#22c55e" : colors.mutedForeground,
                    }}
                  >
                    Passwoerter stimmen ueberein
                  </Text>
                </View>
              </Animated.View>

              <Animated.View style={[{ marginTop: 22 }, submitStyle]}>
                <GradientButton
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={!canSubmit}
                  size="lg"
                >
                  Passwort speichern
                </GradientButton>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  forcedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  formSection: {
    width: "100%",
  },
  checklist: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
