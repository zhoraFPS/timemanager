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
import { CheckCircle, Clock, PlusCircle } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { STAMP_TYPES } from "@/lib/stamp-types";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";
import { getCorrectionPolicy, createMissingEntry } from "@/lib/api";
import { AppEvents } from "@/lib/events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewEntrySheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  /** Pre-selected date (the day the user is viewing) */
  date: Date;
  onDismiss?: () => void;
}

type CorrectionMode = "direct" | "request" | "blocked";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(d: Date) {
  return `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
}

function formatDate(d: Date) {
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function setTimeOnDate(base: Date, timePick: Date): Date {
  const d = new Date(base);
  d.setHours(timePick.getHours(), timePick.getMinutes(), 0, 0);
  return d;
}

function ageDays(date: Date): number {
  return (Date.now() - date.getTime()) / 86_400_000;
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
      <View style={[b.wrap, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
        <CheckCircle size={13} color="#22c55e" />
        <Text style={[b.text, { color: "#22c55e" }]}>
          Direkte Erstellung · wird sofort gespeichert
        </Text>
      </View>
    );
  }

  if (mode === "request") {
    return (
      <View style={[b.wrap, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}35` }]}>
        <Clock size={13} color={colors.primary} />
        <Text style={[b.text, { color: colors.primary }]}>
          Nachtrag-Antrag · HR muss den Eintrag genehmigen
        </Text>
      </View>
    );
  }

  return (
    <View style={[b.wrap, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
      <Text style={[b.text, { color: "#ef4444" }]}>
        Nachtrag nicht mehr möglich (max. {maxDays} Tage)
      </Text>
    </View>
  );
}

const b = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 16,
  },
  text: { fontSize: 12, fontWeight: "600", flex: 1 },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewEntrySheet({ bottomSheetRef, date, onDismiss }: NewEntrySheetProps) {
  const { colors, isDark } = useTheme();

  // Policy
  const [directDays, setDirectDays] = useState(3);
  const [maxDays, setMaxDays]       = useState(7);
  const [policyLoaded, setPolicyLoaded] = useState(false);

  // Form
  const [selectedType, setSelectedType] = useState("WORK");
  const [clockIn, setClockIn]   = useState<Date>(() => setTimeOnDate(date, new Date()));
  const [clockOut, setClockOut] = useState<Date | null>(null);
  const [reason, setReason]     = useState("");
  const [showInPicker, setShowInPicker]   = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // Reload form when date changes
  useEffect(() => {
    setSelectedType("WORK");
    setClockIn(setTimeOnDate(date, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0)));
    setClockOut(setTimeOnDate(date, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 30)));
    setReason("");
  }, [date.toDateString()]);

  // Load policy once
  useEffect(() => {
    getCorrectionPolicy()
      .then(({ directCorrectionDays, maxCorrectionDays }) => {
        setDirectDays(directCorrectionDays);
        setMaxDays(maxCorrectionDays);
      })
      .catch(() => {})
      .finally(() => setPolicyLoaded(true));
  }, []);

  const mode: CorrectionMode =
    ageDays(date) <= directDays ? "direct" :
    ageDays(date) <= maxDays    ? "request" :
    "blocked";

  const isToday = ageDays(date) < 1;

  // Validate: clockOut must be after clockIn (if set)
  const timeError =
    clockOut && clockOut <= clockIn
      ? "Gehzeit muss nach der Kommenzeit liegen."
      : null;

  const canSubmit =
    !timeError &&
    mode !== "blocked" &&
    (mode === "direct" || reason.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit) return;
    if (timeError) { Alert.alert("Fehler", timeError); return; }

    setSubmitting(true);
    try {
      const { mode: resultMode } = await createMissingEntry({
        clockIn: clockIn.toISOString(),
        clockOut: clockOut?.toISOString(),
        type: selectedType,
        reason: reason.trim() || undefined,
      });

      AppEvents.emit("stamp");
      bottomSheetRef.current?.dismiss();
      onDismiss?.();

      if (resultMode === "direct") {
        Alert.alert("Gespeichert", "Der Eintrag wurde erstellt.", [{ text: "OK" }]);
      } else {
        Alert.alert(
          "Antrag gestellt",
          "Dein Nachtrag wurde zur Genehmigung weitergeleitet.",
          [{ text: "OK" }]
        );
      }
    } catch (e: any) {
      Alert.alert("Fehler", e?.response?.data?.error ?? "Eintrag konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={0.9}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <PlusCircle size={18} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Eintrag nachtragen
          </Text>
        </View>
        <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
          {isToday ? "Heute" : formatDate(date)}
        </Text>

        {/* Mode badge */}
        {policyLoaded ? (
          <ModeBadge mode={mode} directDays={directDays} maxDays={maxDays} />
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 16 }} />
        )}

        {mode === "blocked" ? (
          <View style={[styles.blockedBox, { backgroundColor: colors.glassBackground, borderColor: colors.glassBorder }]}>
            <Text style={[styles.blockedText, { color: colors.mutedForeground }]}>
              Einträge können für dieses Datum nicht mehr nachgetragen werden.{"\n"}
              Der zulässige Zeitraum von {maxDays} Tagen ist abgelaufen.
            </Text>
          </View>
        ) : (
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
              {/* Clock-in */}
              <Pressable style={styles.timeCol} onPress={() => setShowInPicker(true)}>
                <GlassCard style={styles.timeCard}>
                  <Text style={[styles.timeCardLabel, { color: colors.mutedForeground }]}>Kommen</Text>
                  <Text style={[styles.timeCardValue, { color: colors.foreground }]}>
                    {formatTime(clockIn)}
                  </Text>
                </GlassCard>
              </Pressable>

              {/* Clock-out */}
              <Pressable
                style={styles.timeCol}
                onPress={() => setShowOutPicker(true)}
              >
                <GlassCard
                  style={[
                    styles.timeCard,
                    timeError ? { borderColor: "#ef4444" } : {},
                  ]}
                >
                  <Text style={[styles.timeCardLabel, { color: colors.mutedForeground }]}>Gehen</Text>
                  <Text style={[styles.timeCardValue, { color: timeError ? "#ef4444" : colors.foreground }]}>
                    {clockOut ? formatTime(clockOut) : "–"}
                  </Text>
                  {!clockOut && (
                    <Text style={[styles.timeCardHint, { color: colors.mutedForeground }]}>
                      tippen
                    </Text>
                  )}
                </GlassCard>
              </Pressable>
            </View>

            {timeError && (
              <Text style={styles.timeError}>{timeError}</Text>
            )}

            {showInPicker && (
              <DateTimePicker
                value={clockIn}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_e, s) => {
                  setShowInPicker(Platform.OS === "ios");
                  if (s) setClockIn(setTimeOnDate(date, s));
                }}
                themeVariant={isDark ? "dark" : "light"}
              />
            )}
            {showOutPicker && (
              <DateTimePicker
                value={clockOut ?? clockIn}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_e, s) => {
                  setShowOutPicker(Platform.OS === "ios");
                  if (s) setClockOut(setTimeOnDate(date, s));
                }}
                themeVariant={isDark ? "dark" : "light"}
              />
            )}

            {/* ── Reason (request mode only) ── */}
            {mode === "request" && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Begründung <Text style={{ color: "#ef4444" }}>*</Text>
                </Text>
                <TextInput
                  placeholder="z.B. Habe vergessen zu stempeln …"
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
              variant={canSubmit ? "gradient" : "default"}
              onPress={handleSubmit}
              style={styles.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.submitText, { color: canSubmit ? "#fff" : colors.mutedForeground }]}>
                  {mode === "direct" ? "Eintrag erstellen" : "Nachtrag beantragen"}
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
  blockedBox: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
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
  timeRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  timeCol: { flex: 1 },
  timeCard: { padding: 0 },
  timeCardLabel: { fontSize: 11, marginBottom: 4 },
  timeCardValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timeCardHint: { fontSize: 10, marginTop: 2 },
  timeError: { color: "#ef4444", fontSize: 12, marginBottom: 16, marginTop: 4 },
  reasonInput: {
    borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14,
    minHeight: 80, textAlignVertical: "top", marginBottom: 20,
  },
  submitBtn: { marginBottom: 24 },
  submitText: { fontSize: 16, fontWeight: "700", paddingVertical: 4 },
});
