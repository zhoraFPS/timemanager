import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Smartphone, Trash2, ShieldCheck } from "lucide-react-native";

import { useTheme } from "@/lib/theme";
import { useAuthStore } from "@/lib/store";
import { getMyDevices, deleteMyDevice } from "@/lib/api";
import type { DeviceInfo } from "@/lib/types";
import { AuroraBackground } from "@/components/ui/background/aurora-background";

function formatLastUsed(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return new Date(iso).toLocaleDateString("de-DE");
}

export default function GeraeteScreen() {
  const { colors, typography } = useTheme();
  const router = useRouter();
  const currentDeviceId = useAuthStore((s) => s.deviceId);
  const logout = useAuthStore((s) => s.logout);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getMyDevices();
      setDevices(list);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function handleDelete(device: DeviceInfo) {
    const isCurrent = device.deviceId === currentDeviceId;
    Alert.alert(
      "Geraet entfernen?",
      isCurrent
        ? "Dies ist dein aktuelles Geraet. Du wirst sofort abgemeldet."
        : `"${device.name ?? device.deviceId}" wird entfernt. Alle aktiven Anmeldungen werden beendet.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyDevice(device.id);
              if (isCurrent) {
                await logout();
                router.replace("/login");
                return;
              }
              setDevices((prev) => prev.filter((d) => d.id !== device.id));
            } catch (err: unknown) {
              const apiError = err as { response?: { data?: { error?: string } } };
              Alert.alert(
                "Fehler",
                apiError.response?.data?.error || "Geraet konnte nicht entfernt werden",
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AuroraBackground intensity="subtle" showGrain={false} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <ChevronLeft size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[typography.title, { color: colors.foreground, flex: 1, textAlign: "center" }]}
          >
            Geraete
          </Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Hier siehst du alle Geraete, die mit deinem Konto gekoppelt sind.
            Entfernte Geraete werden sofort abgemeldet.
          </Text>

          {loading ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : devices.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
              <Smartphone size={24} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>
                Keine Geraete registriert
              </Text>
            </View>
          ) : (
            <View style={[styles.groupedCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
              {devices.map((device, i) => {
                const isCurrent = device.deviceId === currentDeviceId;
                const isLast = i === devices.length - 1;
                return (
                  <View
                    key={device.id}
                    style={[
                      styles.deviceRow,
                      !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={styles.deviceIcon}>
                      <Smartphone size={18} color={colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={[styles.deviceName, { color: colors.foreground }]}>
                          {device.name ?? "Unbekanntes Geraet"}
                        </Text>
                        {isCurrent ? (
                          <View
                            style={[
                              styles.currentBadge,
                              {
                                backgroundColor: colors.primary + "22",
                                borderColor: colors.primary + "44",
                              },
                            ]}
                          >
                            <ShieldCheck size={10} color={colors.primary} />
                            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600", marginLeft: 4 }}>
                              Aktuell
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.deviceMeta, { color: colors.mutedForeground }]}>
                        Zuletzt aktiv {formatLastUsed(device.lastUsed)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(device)}
                      hitSlop={8}
                      style={styles.trashButton}
                    >
                      <Trash2 size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    marginTop: 4,
  },
  groupedCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  deviceIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceName: {
    fontSize: 14,
    fontWeight: "600",
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginLeft: 8,
  },
  deviceMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  trashButton: {
    padding: 6,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: "center",
  },
});
