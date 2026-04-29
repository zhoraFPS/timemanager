import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Calendar,
  Thermometer,
  Home,
  Clock,
} from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewRequestSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  onSubmit: (data: {
    type: string;
    dateFrom: string;
    dateTo: string;
    note?: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------

interface TypeOption {
  key: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

const TYPES: TypeOption[] = [
  { key: "VACATION", label: "Urlaub", icon: Calendar, color: "#3b82f6" },
  { key: "SICK", label: "Krank", icon: Thermometer, color: "#ef4444" },
  { key: "HOMEOFFICE", label: "Homeoffice", icon: Home, color: "#8b5cf6" },
  { key: "TIME_CORRECTION", label: "Zeitkorrektur", icon: Clock, color: "#eab308" },
  { key: "OVERTIME_REDUCE", label: "\u00dcberstunden", icon: Clock, color: "#22c55e" },
  { key: "SPECIAL_LEAVE", label: "Sonderurlaub", icon: Calendar, color: "#06b6d4" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateDisplay(date: Date): string {
  const months = [
    "Jan", "Feb", "M\u00e4r", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ];
  return `${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewRequestSheet({ bottomSheetRef, onSubmit }: NewRequestSheetProps) {
  const { colors, isDark } = useTheme();

  const [selectedType, setSelectedType] = useState("VACATION");
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date());
  const [note, setNote] = useState("");

  // Single-picker pattern: exactly one picker at a time, switchable between
  // "from" and "to". Tapping the active field again closes it (toggle).
  const [activeDateField, setActiveDateField] = useState<"from" | "to" | null>(null);

  function toggleField(field: "from" | "to") {
    setActiveDateField((prev) => (prev === field ? null : field));
  }

  function handleSubmit() {
    onSubmit({
      type: selectedType,
      dateFrom: toISODate(dateFrom),
      dateTo: toISODate(dateTo),
      note: note.trim() || undefined,
    });
    bottomSheetRef.current?.dismiss();
    // Reset form
    setSelectedType("VACATION");
    setDateFrom(new Date());
    setDateTo(new Date());
    setNote("");
    setActiveDateField(null);
  }

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={0.85}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[styles.header, { color: colors.foreground }]}>
          Neuer Antrag
        </Text>

        {/* Type chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {TYPES.map((t) => {
            const active = selectedType === t.key;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.key}
                onPress={() => setSelectedType(t.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.glassBackground,
                    borderColor: active
                      ? colors.primary
                      : colors.glassBorder,
                  },
                ]}
              >
                <Icon size={14} color={active ? "#fff" : t.color} />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Date pickers — one single picker that swaps between "from" and "to" */}
        <View style={styles.dateRow}>
          <Pressable style={styles.dateCol} onPress={() => toggleField("from")}>
            <GlassCard
              style={[
                styles.dateCard,
                activeDateField === "from" && { borderColor: colors.primary, borderWidth: 1.5 },
              ]}
            >
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                Von
              </Text>
              <Text
                style={[
                  styles.dateValue,
                  { color: activeDateField === "from" ? colors.primary : colors.foreground },
                ]}
              >
                {formatDateDisplay(dateFrom)}
              </Text>
            </GlassCard>
          </Pressable>
          <Pressable style={styles.dateCol} onPress={() => toggleField("to")}>
            <GlassCard
              style={[
                styles.dateCard,
                activeDateField === "to" && { borderColor: colors.primary, borderWidth: 1.5 },
              ]}
            >
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                Bis
              </Text>
              <Text
                style={[
                  styles.dateValue,
                  { color: activeDateField === "to" ? colors.primary : colors.foreground },
                ]}
              >
                {formatDateDisplay(dateTo)}
              </Text>
            </GlassCard>
          </Pressable>
        </View>

        {activeDateField !== null && (
          <DateTimePicker
            value={activeDateField === "from" ? dateFrom : dateTo}
            mode="date"
            minimumDate={activeDateField === "to" ? dateFrom : undefined}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_event, selected) => {
              // Android: dialog closes itself after selection; iOS inline stays open
              // so the user can fluidly switch to the other field via the cards above.
              if (Platform.OS !== "ios") setActiveDateField(null);
              if (!selected) return;
              if (activeDateField === "from") {
                setDateFrom(selected);
                if (selected > dateTo) setDateTo(selected);
              } else {
                setDateTo(selected);
              }
            }}
            themeVariant={isDark ? "dark" : "light"}
          />
        )}

        {/* Note field */}
        <TextInput
          placeholder="Notiz (optional)"
          placeholderTextColor={colors.mutedForeground}
          value={note}
          onChangeText={setNote}
          multiline
          style={[
            styles.noteInput,
            {
              backgroundColor: colors.glassBackground,
              borderColor: colors.glassBorder,
              color: colors.foreground,
            },
          ]}
        />

        {/* Submit button */}
        <GlassButton variant="gradient" onPress={handleSubmit} style={styles.submitBtn}>
          <Text style={styles.submitText}>Absenden</Text>
        </GlassButton>
      </ScrollView>
    </SimpleBottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 20,
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  dateCol: {
    flex: 1,
  },
  dateCard: {
    padding: 0,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitBtn: {
    marginBottom: 20,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 4,
  },
});
