import { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StyleSheet,
} from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Constants from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import {
  LogOut,
  Shield,
  Bell,
  Sun,
  Moon,
  Briefcase,
  Calendar,
  Clock,
  KeyRound,
  Smartphone,
  ChevronRight,
} from "lucide-react-native";
import { useAuthStore } from "@/lib/store";
import { getProfile, getFlextime, getVacationBalance, type VacationBalance } from "@/lib/api";
import {
  registerForPushNotifications,
  unregisterPushToken,
  getPushPermissionStatus,
  PushTokenError,
} from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { AnimatedNumber } from "@/components/ui/feedback/animated-number";
import {
  useEntranceAnimation,
  useScaleEntrance,
  staggerDelay,
} from "@/lib/motion";
import type { User, FlexData } from "@/lib/types";

export default function ProfilScreen() {
  const { user, biometrieEnabled, setBiometrie, logout, pushEnabled, setPushEnabled } = useAuthStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [flexData, setFlexData] = useState<FlexData | null>(null);
  const [vacation, setVacation] = useState<VacationBalance | null>(null);
  const router = useRouter();
  const { colors, isDark, mode, setMode, typography } = useTheme();

  // Staggered entrances
  const avatarStyle = useScaleEntrance(0);
  const nameStyle = useEntranceAnimation(staggerDelay(1, 80));
  const saldoStyle = useEntranceAnimation(staggerDelay(2, 80));
  const infoCardStyle = useEntranceAnimation(staggerDelay(3, 80));
  const settingsCardStyle = useEntranceAnimation(staggerDelay(4, 80));
  const securityCardStyle = useEntranceAnimation(staggerDelay(5, 80));
  const logoutStyle = useEntranceAnimation(staggerDelay(6, 80));

  useFocusEffect(
    useCallback(() => {
      loadData();
      // Sync switch with real OS permission status on every focus.
      // No dependency on pushEnabled — otherwise setPushEnabled(false) would
      // change the callback reference and re-trigger this effect in a loop.
      getPushPermissionStatus().then((granted) => {
        if (!granted) setPushEnabled(false);
      });
    }, [])
  );

  async function loadData() {
    const [prof, flex, vac] = await Promise.allSettled([
      getProfile(),
      getFlextime(4),
      getVacationBalance(),
    ]);
    if (prof.status === "fulfilled") setProfile(prof.value);
    if (flex.status === "fulfilled") setFlexData(flex.value);
    if (vac.status === "fulfilled") setVacation(vac.value);
  }

  async function toggleBiometrie(value: boolean) {
    // Expo Go doesn't support real biometric auth
    const isExpoGo = Constants.appOwnership === "expo";
    if (value && isExpoGo) {
      Alert.alert(
        "Nicht verfügbar",
        "Face ID funktioniert nicht in Expo Go. Erstelle einen Dev Build mit 'npx expo run:ios' um Biometrie zu testen."
      );
      return;
    }
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          "Nicht verfügbar",
          "Biometrie ist auf diesem Gerät nicht eingerichtet"
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Biometrie aktivieren",
        disableDeviceFallback: true,
        fallbackLabel: "Erneut versuchen",
      });
      if (!result.success) return;
    }
    await setBiometrie(value);
  }

  async function togglePush(value: boolean) {
    if (value) {
      try {
        const token = await registerForPushNotifications();
        if (!token) {
          // null = OS permission denied
          Alert.alert(
            "Berechtigung fehlt",
            "Bitte erlaube Benachrichtigungen für diese App in den Geräte-Einstellungen."
          );
          return;
        }
        await setPushEnabled(true);
      } catch (err) {
        if (err instanceof PushTokenError) {
          // Token retrieval failed — most likely FCM not configured
          Alert.alert(
            "Push nicht verfügbar",
            "Der Benachrichtigungs-Token konnte nicht abgerufen werden. " +
            "Bitte wende dich an den Administrator (FCM-Konfiguration erforderlich)."
          );
        } else {
          Alert.alert("Fehler", "Push-Benachrichtigungen konnten nicht aktiviert werden.");
        }
      }
    } else {
      await unregisterPushToken();
      await setPushEnabled(false);
    }
  }

  function toggleAppearance() {
    // Toggle based on what's currently visible
    setMode(isDark ? "light" : "dark");
  }

  async function handleLogout() {
    Alert.alert("Abmelden", "Moechten Sie sich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Abmelden",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  // ---------- Derived values ----------

  const initials = (user?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const months = flexData?.months ?? [];
  const currentSaldo =
    months.length > 0 ? months[months.length - 1]?.cumulativeMins ?? 0 : 0;
  const saldoH = Math.floor(Math.abs(currentSaldo) / 60);
  const saldoM = Math.abs(currentSaldo) % 60;
  const saldoFormatted = `${currentSaldo >= 0 ? "+" : "-"}${saldoH}:${saldoM
    .toString()
    .padStart(2, "0")}`;
  const saldoColor = currentSaldo >= 0 ? "#22c55e" : "#ef4444";

  const displayName = profile?.name ?? user?.name ?? "";
  const department = profile?.department ?? user?.department ?? "";
  const employeeNumber = profile?.employeeNumber ?? user?.employeeNumber ?? "";
  const contractType =
    profile?.contractType ?? user?.contractType ?? "Vollzeit 40h";

  const departmentLine = [department, employeeNumber ? `#${employeeNumber}` : ""]
    .filter(Boolean)
    .join(" \u00B7 ");

  // Vacation — real data from API
  const vacationTotal = vacation?.totalAvailable ?? 28;
  const vacationUsed = vacation?.usedDays ?? 0;
  const vacationPending = vacation?.pendingDays ?? 0;
  const vacationLeft = vacation?.remainingDays ?? vacationTotal;
  const vacationProgress = vacationTotal > 0 ? vacationLeft / vacationTotal : 0;

  const appearanceIsDark = isDark;
  const AppearanceIcon = appearanceIsDark ? Moon : Sun;

  // ---------- Sparkline ----------

  function renderSparkline() {
    if (months.length < 2) return null;
    const maxAbs = Math.max(
      ...months.map((mm) => Math.abs(mm.saldoMins)),
      1
    );
    return (
      <View style={styles.sparklineRow}>
        {months.map((m, i) => {
          const height = Math.max(
            4,
            (Math.abs(m.saldoMins) / maxAbs) * 32
          );
          return (
            <View
              key={i}
              style={[
                styles.sparklineBar,
                {
                  height,
                  backgroundColor: m.saldoMins >= 0 ? "#22c55e" : "#ef4444",
                  opacity: i === months.length - 1 ? 0.3 : 0.15,
                },
              ]}
            />
          );
        })}
      </View>
    );
  }

  // ---------- Render helpers ----------

  function renderInfoRow(
    icon: React.ReactNode,
    label: string,
    value: React.ReactNode,
    isLast = false
  ) {
    return (
      <View
        style={[
          styles.infoRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        ]}
      >
        {icon}
        <Text style={[styles.infoLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <View style={styles.infoValueContainer}>{typeof value === "string" ? (
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {value}
          </Text>
        ) : (
          value
        )}</View>
      </View>
    );
  }

  function renderSettingsRow(
    icon: React.ReactNode,
    label: string,
    switchValue: boolean,
    onToggle: (v: boolean) => void,
    isLast = false
  ) {
    return (
      <View
        style={[
          styles.settingsRow,
          !isLast && {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.settingsLeft}>
          {icon}
          <Text style={[styles.settingsLabel, { color: colors.foreground }]}>
            {label}
          </Text>
        </View>
        <Switch
          value={switchValue}
          onValueChange={onToggle}
          trackColor={{
            false: colors.muted,
            true: "#34C759",
          }}
          thumbColor="#fff"
          ios_backgroundColor={colors.muted}
        />
      </View>
    );
  }

  // ---------- Main render ----------

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <AuroraBackground intensity="subtle" blurIntensity={100} showGrain={false} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Hero Header ---- */}
        <View style={styles.hero}>
          {/* Avatar */}
          <Animated.View
            style={[
              styles.avatar,
              { opacity: 0 },
              {
                backgroundColor: colors.primary + "22",
                borderColor: colors.primary + "44",
              },
              avatarStyle,
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {initials}
            </Text>
          </Animated.View>

          {/* Name */}
          <Animated.View style={[{ opacity: 0 }, nameStyle]}>
            <Text style={[styles.heroName, { color: colors.foreground }]}>
              {displayName}
            </Text>

            {/* Department + employee number */}
            {departmentLine ? (
              <Text
                style={[styles.heroDepartment, { color: colors.mutedForeground }]}
              >
                {departmentLine}
              </Text>
            ) : null}
          </Animated.View>

          {/* Sparkline background decoration */}
          {renderSparkline()}

          {/* Flextime saldo */}
          <Animated.View style={[{ alignItems: "center", opacity: 0 }, saldoStyle]}>
            <Text
              style={[styles.saldoLabel, { color: colors.mutedForeground }]}
            >
              Gleitzeit-Saldo
            </Text>
            <View style={styles.saldoRow}>
              <AnimatedNumber
                value={Math.abs(currentSaldo) / 60}
                duration={1000}
                format={(n) => {
                  const totalMins = Math.round(n * 60);
                  const h = Math.floor(totalMins / 60);
                  const m = totalMins % 60;
                  const sign = currentSaldo >= 0 ? "+" : "-";
                  return `${sign}${h}:${m.toString().padStart(2, "0")}`;
                }}
                style={[styles.saldoValue, { color: saldoColor }]}
              />
              <Text style={[styles.saldoUnit, { color: saldoColor }]}>h</Text>
            </View>
          </Animated.View>
        </View>

        {/* ---- Info Section (iOS grouped inset) ---- */}
        <Animated.View style={[{ opacity: 0 }, infoCardStyle]}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
            INFORMATIONEN
          </Text>
          <View style={[styles.groupedCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            {renderInfoRow(
              <Briefcase size={18} color={colors.mutedForeground} />,
              "Vertrag",
              contractType
            )}
            {renderInfoRow(
              <Calendar size={18} color={colors.mutedForeground} />,
              "Urlaubstage",
              <View style={styles.vacationValue}>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  {vacationLeft} von {vacationTotal} übrig
                </Text>
                {vacationPending > 0 && (
                  <Text style={[styles.vacationPending, { color: "#f59e0b" }]}>
                    {vacationPending} Tage offen
                  </Text>
                )}
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <View
                    style={{
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: colors.primary,
                      flex: vacationProgress,
                    }}
                  />
                  <View style={{ flex: 1 - vacationProgress }} />
                </View>
              </View>
            )}
            {renderInfoRow(
              <Clock size={18} color={colors.mutedForeground} />,
              "Arbeitszeit",
              "08:00 \u2013 16:30 \u00B7 30min Pause",
              true
            )}
          </View>
        </Animated.View>

        {/* ---- Settings Section (iOS grouped inset) ---- */}
        <Animated.View style={[{ opacity: 0 }, settingsCardStyle]}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
            EINSTELLUNGEN
          </Text>
          <View style={[styles.groupedCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            {renderSettingsRow(
              <AppearanceIcon size={18} color={colors.mutedForeground} />,
              "Erscheinungsbild",
              appearanceIsDark,
              toggleAppearance
            )}
            {renderSettingsRow(
              <Shield size={18} color={colors.mutedForeground} />,
              "Biometrie",
              biometrieEnabled,
              toggleBiometrie
            )}
            {renderSettingsRow(
              <Bell size={18} color={colors.mutedForeground} />,
              "Push-Benachrichtigungen",
              pushEnabled,
              togglePush,
              true
            )}
          </View>
        </Animated.View>

        {/* ---- Security Section ---- */}
        <Animated.View style={[{ opacity: 0 }, securityCardStyle]}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
            SICHERHEIT
          </Text>
          <View style={[styles.groupedCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.linkRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => router.push("/passwort-aendern")}
              activeOpacity={0.6}
            >
              <KeyRound size={18} color={colors.mutedForeground} />
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>
                Passwort aendern
              </Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push("/geraete")}
              activeOpacity={0.6}
            >
              <Smartphone size={18} color={colors.mutedForeground} />
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>
                Registrierte Geraete
              </Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ---- Logout Button ---- */}
        <Animated.View style={[{ opacity: 0 }, logoutStyle]}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>
            Abmelden
          </Text>
        </TouchableOpacity>
        </Animated.View>

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Hero
  hero: {
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  heroName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.36,
  },
  heroDepartment: {
    fontSize: 13,
    marginTop: 4,
  },
  sparklineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 32,
    gap: 4,
    marginTop: 16,
    width: "60%",
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 2,
  },
  saldoLabel: {
    fontSize: 11,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  saldoRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 2,
  },
  saldoValue: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  saldoUnit: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 4,
    opacity: 0.85,
  },

  // iOS grouped inset section header
  sectionHeader: {
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: -0.08,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
    textTransform: "uppercase",
  },
  groupedCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 13,
    flex: 1,
    marginLeft: 12,
  },
  infoValueContainer: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 13,
  },
  vacationValue: {
    alignItems: "flex-end",
  },
  vacationPending: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  progressBar: {
    width: 80,
    height: 3,
    borderRadius: 1.5,
    marginTop: 6,
    overflow: "hidden",
    flexDirection: "row",
  },

  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  settingsLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingsLabel: {
    fontSize: 13,
    marginLeft: 12,
  },

  // Security link rows
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  linkLabel: {
    fontSize: 13,
    flex: 1,
  },

  // Logout
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },

  // Bottom spacer
  bottomSpacer: {
    height: 20,
  },
});
