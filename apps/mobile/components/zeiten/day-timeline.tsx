import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";
import { STAMP_TYPES } from "@/lib/stamp-types";
import type { TimeEntry } from "@/lib/types";

interface DayTimelineProps {
  entries: TimeEntry[];
}

const RANGE_START = 6; // 6:00
const RANGE_END = 20; // 20:00
const RANGE_HOURS = RANGE_END - RANGE_START; // 14

const SOLL_START = 8; // 8:00
const SOLL_END = 16.5; // 16:30

function getStampColor(type: string): string {
  const stamp = STAMP_TYPES.find((s) => s.key === type);
  return stamp?.color ?? "#3b82f6";
}

function hourFromISO(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DayTimeline({ entries }: DayTimelineProps) {
  const { colors } = useTheme();

  const sollLeftPct =
    ((SOLL_START - RANGE_START) / RANGE_HOURS) * 100;
  const sollWidthPct =
    ((SOLL_END - SOLL_START) / RANGE_HOURS) * 100;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bar, { backgroundColor: colors.muted }]}>
        {/* Soll range indicator */}
        <View
          style={[
            styles.sollRange,
            {
              left: `${sollLeftPct}%`,
              width: `${sollWidthPct}%`,
              backgroundColor: colors.border,
            },
          ]}
        />

        {/* Work blocks */}
        {entries.map((entry) => {
          const startHour = hourFromISO(entry.clockIn);
          const endHour = entry.clockOut
            ? hourFromISO(entry.clockOut)
            : hourFromISO(new Date().toISOString());

          const leftPct =
            (clamp(startHour, RANGE_START, RANGE_END) - RANGE_START) /
            RANGE_HOURS *
            100;
          const rightPct =
            (clamp(endHour, RANGE_START, RANGE_END) - RANGE_START) /
            RANGE_HOURS *
            100;
          const widthPct = Math.max(rightPct - leftPct, 1);

          return (
            <View
              key={entry.id}
              style={[
                styles.block,
                {
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: getStampColor(entry.type),
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.labels}>
        <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
          6:00
        </Text>
        <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
          20:00
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  bar: {
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  sollRange: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
  block: {
    position: "absolute",
    top: 2,
    bottom: 2,
    borderRadius: 6,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 9,
  },
});
