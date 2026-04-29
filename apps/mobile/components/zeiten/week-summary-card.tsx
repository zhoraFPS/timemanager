import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";

interface WeekSummaryCardProps {
  actualHours: number;
  targetHours: number;
}

function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hStr = String(h);
  const mStr = String(m).padStart(2, "0");
  return `${hStr}:${mStr} h`;
}

function formatDifference(hours: number): string {
  const totalMinutes = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hStr = String(h);
  const mStr = String(m).padStart(2, "0");
  const sign = hours >= 0 ? "+" : "-";
  return `${sign}${hStr}:${mStr} h`;
}

export function WeekSummaryCard({
  actualHours,
  targetHours,
}: WeekSummaryCardProps) {
  const { colors } = useTheme();
  const difference = actualHours - targetHours;

  const diffColor =
    difference >= 0 ? colors.success : colors.destructive;

  return (
    <GlassCard>
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {formatHoursMinutes(actualHours)}
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Ist
          </Text>
        </View>

        <View
          style={[styles.separator, { backgroundColor: colors.border }]}
        />

        <View style={styles.column}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {formatHoursMinutes(targetHours)}
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Soll
          </Text>
        </View>

        <View
          style={[styles.separator, { backgroundColor: colors.border }]}
        />

        <View style={styles.column}>
          <Text style={[styles.value, { color: diffColor }]}>
            {formatDifference(difference)}
          </Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Differenz
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  separator: {
    width: 1,
    height: 32,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});
