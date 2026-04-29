import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Pencil } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import { STAMP_TYPES } from "@/lib/stamp-types";
import type { TimeEntry } from "@/lib/types";

interface EntryCardProps {
  entry: TimeEntry;
  onEditPress?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDuration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "laufend";
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}min`;
}

function getStampInfo(type: string) {
  return STAMP_TYPES.find((s) => s.key === type) ?? STAMP_TYPES[0];
}

export function EntryCard({ entry, onEditPress }: EntryCardProps) {
  const { colors } = useTheme();
  const stamp = getStampInfo(entry.type);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        {/* Left: times */}
        <View style={styles.times}>
          <Text style={[styles.time, { color: colors.foreground }]}>
            {formatTime(entry.clockIn)}
          </Text>
          <Text style={[styles.arrow, { color: colors.mutedForeground }]}>
            {"\u2193"}
          </Text>
          <Text style={[styles.time, { color: colors.foreground }]}>
            {entry.clockOut ? formatTime(entry.clockOut) : "\u2013"}
          </Text>
        </View>

        {/* Center: duration */}
        <View style={styles.center}>
          <Text style={[styles.duration, { color: colors.mutedForeground }]}>
            {formatDuration(entry.clockIn, entry.clockOut)}
          </Text>
        </View>

        {/* Right: badges + edit button */}
        <View style={styles.right}>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: stamp.color + "20" }]}>
              <Text style={[styles.badgeText, { color: stamp.color }]}>
                {stamp.label}
              </Text>
            </View>
            {entry.project && (
              <View
                style={[
                  styles.badge,
                  styles.projectBadge,
                  { backgroundColor: (entry.project.color ?? colors.muted) + "20" },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: entry.project.color ?? colors.mutedForeground }]}
                >
                  {entry.project.name}
                </Text>
              </View>
            )}
          </View>

          {onEditPress && (
            <Pressable
              onPress={onEditPress}
              hitSlop={8}
              style={[styles.editBtn, { backgroundColor: `${colors.primary}15` }]}
            >
              <Pencil size={13} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  times: {
    alignItems: "center",
    width: 50,
  },
  time: {
    fontSize: 14,
    fontWeight: "700",
  },
  arrow: {
    fontSize: 12,
    lineHeight: 16,
  },
  center: {
    flex: 1,
    paddingHorizontal: 12,
  },
  duration: {
    fontSize: 13,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  badges: {
    alignItems: "flex-end",
  },
  editBtn: {
    borderRadius: 8,
    padding: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  projectBadge: {
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
