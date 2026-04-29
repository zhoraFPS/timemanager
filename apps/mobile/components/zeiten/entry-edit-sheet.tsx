import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CheckCircle, Clock, Pencil } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { STAMP_TYPES } from "@/lib/stamp-types";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";
import { getCorrectionPolicy, directEditEntry, createEditRequest } from "@/lib/api";
import { AppEvents } from "@/lib/events";
import type { TimeEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryEditSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  entry: TimeEntry | null;
  onDismiss?: () => void;
}

type CorrectionMode = "direct" | "request" | "blocked";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(date: Date): string {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

function formatDate(date: Date): string {
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  return `${date.getDate()}. ${months[date.getMonth()]}`;
}

function mergeDateAndTime(base: Date, timePick: Date): Date {
  const d = new Date(base);
  d.setHours(timePick.getHours(), timePick.getMinutes(), 0, 0);
  return d;
}

function entryAgeDays(entry: TimeEntry): number {
  return (Date.now() - new Date(entry.clockIn).getTime()) / 86_400_000;
}

// ---------------------------------------------------------------------------
// Mode badge
// ---------------------------------------------------------------------------

function ModeBadge({ mode, directDays, maxDays }: {
  mode: CorrectionMode;
  directDays: number;
  maxDays: number;
}) {
  const { colors } = useTheme();

  if (mode === "direct") {
    return (
      <View style={[badge.wrap, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
        <CheckCircle size={13} color="#22c55e" />
        <Text style={[badge.text, { color: "#22c55e" }]}>
          Direkte Korrektur · wird sofort gespeichert
        </Text>
      </View>
    );
  }

  if (mode === "request") {
    return (
      <View style={[badge.wrap, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}35` }]}>
        <Clock size={13} color={colors.primary} />
        <Text style={[badge.text, { color: colors.primary }]}>
          Korrekturantrag · Vorgesetzter muss genehmigen
        </Text>
      </View>
    );
  }

  return (
    <View style={[badge.wrap, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
      <Text style={[badge.text, { color: "#ef4444" }]}>
        Korrektur nicht mehr möglich (max. {maxDays} Tage)
      </Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 16,
  },
  text: { fontSize: 12, fontWeight: "600", flex: 1 },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntryEditSheet({ bottomSheetRef, entry, onDismiss }: EntryEditSheetProps) {
  const { colors, isDark } = useTheme();

  // Policy
  const [directDays, setDirectDays] = useState(3);
  const [maxDays, setMaxDays] = useState(7);
  const [policyLoaded, setPolicyLoaded] = useState(false);

  // Form state
  const [selectedType, setSelectedType] = useState(entry?.type ?? "WORK");
  const [clockIn, setClockIn] = useState<Date>(entry ? new Date(entry.clockIn) : new Date());
  const [clockOut, setClockOut] = useState<Date | null>(
    entry?.clockOut ? new Date(entry.clockOut) : null
  );
  const [reason, setReason] = useState("");
  // Single-picker pattern: one active time field at a time ("in" | "out" | null).
  // Tapping the already-active card toggles the picker off.
  const [activeTimeField, setActiveTimeField] = useState<"in" | "out" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTimeField(field: "in" | "out") {
    setActiveTimeField((prev) => (prev === field ? null : field));
  }

  // Load policy once
  useEffect(() => {
    getCorrectionPolicy()
      .then(({ directCorrectionDays, maxCorrectionDays }) => {
        setDirectDays(directCorrectionDays);
        setMaxDays(maxCorrectionDays);
      })
      .catch(() => {}) // use defaults on error
      .finally(() => setPolicyLoaded(true));
  }, []);

  // Reset form when entry changes
  useEffect(() => {
    if (!entry) return;
    setSelectedType(entry.type);
    setClockIn(new Date(entry.clockIn));
    setClockOut(entry.clockOut ? new Date(entry.clockOut) : null);
    setReason("");
    setActiveTimeField(null);
  }, [entry?.id]);

  // Derive mode from policy + entry age
  const mode: CorrectionMode = !entry
    ? "blocked"
    : entryAgeDays(entry) <= directDays
    ? "direct"
    : entryAgeDays(entry) <= maxDays
    ? "request"
    : "blocked";

  // Detect changed fields
  const typeChanged    = !!entry && selectedType !== entry.type;
  const clockInChanged = !!entry && clockIn.getTime() !== new Date(entry.clockIn).getTime();
  const clockOutChanged = !!entry &&
    (clockOut?.getTime() ?? null) !== (entry.clockOut ? new Date(entry.clockOut).getTime() : null);
  const hasChanges = typeChanged || clockInChanged || clockOutChanged;

  // ---------------------------------------------------------------------------

  async function handleSubmit() {
    if (!entry || mode === "blocked") return;

    if (!hasChanges) {
      Alert.alert("Keine Änderung", "Du hast nichts geändert.");
      return;
    }

    if (mode === "request" && !reason.trim()) {
      Alert.alert("Begründung fehlt", "Bitte gib einen Grund für die Korrektur an.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        timeEntryId: entry.id,
        ...(typeChanged    ? { newType: selectedType } : {}),
        ...(clockInChanged  ? { newClockIn: clockIn.toISOString() } : {}),
        ...(clockOutChanged && clockOut ? { newClockOut: clockOut.toISOString() } : {}),
      };

      if (mode === "direct") {
        await directEditEntry(payload);
        AppEvents.emit("stamp");
        bottomSheetRef.current?.dismiss();
        onDismiss?.();
        Alert.alert("Gespeichert", "Der Eintrag wurde aktualisiert.", [{ text: "OK" }]);
      } else {
        await createEditRequest({ ...payload, reason: reason.trim() });
        AppEvents.emit("stamp");
        bottomSheetRef.current?.dismiss();
        onDismiss?.();
        Alert.alert(
          "Antrag gestellt",
          "Deine Korrekturanfrage wurde an deinen Vorgesetzten weitergeleitet.",
          [{ text: "OK" }]
        );
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const serverMsg = err?.response?.data?.error;
      const status = err?.response?.status;
      const msg =
        serverMsg ??
        (status === 403
          ? "Keine Berechtigung oder Korrektur-Fenster abgelaufen."
          : status === 404
            ? "Eintrag nicht gefunden — vermutlich wurde er bereits geaendert. Bitte Zeiten neu laden."
            : status === 423
              ? "Der Monat ist bereits abgeschlossen."
              : status
                ? `Server-Fehler (${status}). Bitte spaeter erneut versuchen.`
                : err?.message ?? "Netzwerk-Fehler. Bitte Verbindung pruefen.");
      Alert.alert("Speichern fehlgeschlagen", msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!entry) return null;

  const isBlocked = mode === "blocked";

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={0.88}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pencil size={18} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Eintrag korrigieren
          </Text>
        </View>
        <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
          {formatDate(new Date(entry.clockIn))} · Originaleintrag
        </Text>

        {/* Mode badge */}
        {policyLoaded ? (
          <ModeBadge mode={mode} directDays={directDays} maxDays={maxDays} />
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
        )}

        {/* Blocked state */}
        {isBlocked && (
          <View style={[styles.blockedBox, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
            <Text style={[styles.blockedText, { color: colors.mutedForeground }]}>
              Dieser Eintrag kann nicht mehr korrigiert werden.{"\n"}
              Der zulässige Zeitraum von {maxDays} Tagen ist abgelaufen.
            </Text>
          </View>
        )}

        {!isBlocked && (
          <>
            {/* ── Stamp type ── */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Stempelart
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.chipScroll}
            >
              {STAMP_TYPES.map((t) => {
                const active = selectedType === t.key;
                const Icon = t.icon;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setSelectedType(t.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? t.color : colors.glassBackground,
                        borderColor: active ? t.color : colors.glassBorder,
                      },
                    ]}
                  >
                    <Icon size={13} color={active ? "#fff" : t.color} />
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* ── Times ── */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Zeiten
            </Text>
            <View style={styles.timeRow}>
              <Pressable style={styles.timeCol} onPress={() => toggleTimeField("in")}>
                <GlassCard
                  style={[
                    styles.timeCard,
                    clockInChanged ? { borderColor: colors.primary } : {},
                    activeTimeField === "in" && { borderColor: colors.primary, borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.timeCardLabel, { color: colors.mutedForeground }]}>Kommen</Text>
                  <Text
                    style={[
                      styles.timeCardValue,
                      {
                        color:
                          clockInChanged || activeTimeField === "in"
                            ? colors.primary
                            : colors.foreground,
                      },
                    ]}
                  >
                    {formatTime(clockIn)}
                  </Text>
                  {clockInChanged && (
                    <Text style={[styles.timeCardOld, { color: colors.mutedForeground }]}>
                      war {formatTime(new Date(entry.clockIn))}
                    </Text>
                  )}
                </GlassCard>
              </Pressable>

              <Pressable
                style={[styles.timeCol, !entry.clockOut && { opacity: 0.4 }]}
                onPress={() => { if (entry.clockOut) toggleTimeField("out"); }}
                disabled={!entry.clockOut}
              >
                <GlassCard
                  style={[
                    styles.timeCard,
                    clockOutChanged ? { borderColor: colors.primary } : {},
                    activeTimeField === "out" && { borderColor: colors.primary, borderWidth: 1.5 },
                  ]}
                >
                  <Text style={[styles.timeCardLabel, { color: colors.mutedForeground }]}>Gehen</Text>
                  <Text
                    style={[
                      styles.timeCardValue,
                      {
                        color:
                          clockOutChanged || activeTimeField === "out"
                            ? colors.primary
                            : colors.foreground,
                      },
                    ]}
                  >
                    {clockOut ? formatTime(clockOut) : "laufend"}
                  </Text>
                  {clockOutChanged && entry.clockOut && (
                    <Text style={[styles.timeCardOld, { color: colors.mutedForeground }]}>
                      war {formatTime(new Date(entry.clockOut))}
                    </Text>
                  )}
                </GlassCard>
              </Pressable>
            </View>

            {activeTimeField !== null && (
              <DateTimePicker
                value={activeTimeField === "in" ? clockIn : (clockOut ?? clockIn)}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_e, s) => {
                  // Android: dialog closes itself; iOS spinner stays and user can
                  // switch fields by tapping the cards above.
                  if (Platform.OS !== "ios") setActiveTimeField(null);
                  if (!s) return;
                  if (activeTimeField === "in") {
                    setClockIn(mergeDateAndTime(clockIn, s));
                  } else if (clockOut) {
                    setClockOut(mergeDateAndTime(clockOut, s));
                  }
                }}
                themeVariant={isDark ? "dark" : "light"}
              />
            )}

            {/* ── Reason (only for request mode) ── */}
            {mode === "request" && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Begründung <Text style={{ color: "#ef4444" }}>*</Text>
                </Text>
                <TextInput
                  placeholder="z.B. Habe vergessen auszustempeln …"
                  placeholderTextColor={colors.mutedForeground}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  style={[
                    styles.reasonInput,
                    {
                      backgroundColor: colors.glassBackground,
                      borderColor: reason.trim() ? colors.glassBorder : "#ef444450",
                      color: colors.foreground,
                    },
                  ]}
                />
              </>
            )}

            {/* Submit */}
            <GlassButton
              variant={hasChanges && (mode === "direct" || reason.trim()) ? "gradient" : "default"}
              onPress={handleSubmit}
              style={styles.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[
                  styles.submitText,
                  { color: hasChanges && (mode === "direct" || reason.trim()) ? "#fff" : colors.mutedForeground },
                ]}>
                  {mode === "direct" ? "Speichern" : "Korrektur einreichen"}
                </Text>
              )}
            </GlassButton>
          </>
        )}
      </ScrollView>
    </SimpleBottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  dateLabel: { fontSize: 13, marginBottom: 12 },
  blockedBox: {
    borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16,
  },
  blockedText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  sectionLabel: {
    fontSize: 12, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8,
  },
  chipScroll: { flexGrow: 0, marginBottom: 20 },
  chipRow: { gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  timeRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  timeCol: { flex: 1 },
  timeCard: { padding: 0 },
  timeCardLabel: { fontSize: 11, marginBottom: 4 },
  timeCardValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timeCardOld: { fontSize: 11, marginTop: 2 },
  reasonInput: {
    borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14,
    minHeight: 80, textAlignVertical: "top", marginBottom: 20,
  },
  submitBtn: { marginBottom: 24 },
  submitText: { fontSize: 16, fontWeight: "700", paddingVertical: 4 },
});
