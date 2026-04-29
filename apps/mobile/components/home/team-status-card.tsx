import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Users } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import { STAMP_TYPES } from "@/lib/stamp-types";
import { useEntranceAnimation, staggerDelay } from "@/lib/motion";
import type { TeamMember } from "@/lib/types";

interface TeamStatusCardProps {
  members: TeamMember[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] ?? "?").toUpperCase();
}

// Deterministic pastel color from name string so each person has a consistent avatar color
function avatarColor(name: string): string {
  const PALETTE = [
    "#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e",
    "#f97316", "#eab308", "#ec4899", "#14b8a6",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Status chip
// ---------------------------------------------------------------------------

interface StatusChipProps {
  presence: TeamMember["presence"];
}

function StatusChip({ presence }: StatusChipProps) {
  const { colors } = useTheme();

  if (!presence || presence.status === "offline") {
    return (
      <View style={[chipStyles.chip, { backgroundColor: `${colors.mutedForeground}18`, borderColor: `${colors.mutedForeground}30` }]}>
        <View style={[chipStyles.dot, { backgroundColor: colors.mutedForeground }]} />
        <Text style={[chipStyles.label, { color: colors.mutedForeground }]}>Offline</Text>
      </View>
    );
  }

  if (presence.status === "absent") {
    return (
      <View style={[chipStyles.chip, { backgroundColor: "#64748b18", borderColor: "#64748b30" }]}>
        <View style={[chipStyles.dot, { backgroundColor: "#64748b" }]} />
        <Text style={[chipStyles.label, { color: "#64748b" }]}>Abwesend</Text>
      </View>
    );
  }

  // present — look up stamp type for color + label
  const stampType = STAMP_TYPES.find((t) => t.key === presence.stampType);
  const color = stampType?.color ?? "#22c55e";
  const label = stampType?.label ?? "Anwesend";
  const Icon = stampType?.icon;

  return (
    <View style={[chipStyles.chip, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
      {Icon ? (
        <Icon size={11} color={color} />
      ) : (
        <View style={[chipStyles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[chipStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 6;

interface MemberRowProps {
  member: TeamMember;
  index: number;
}

function MemberRow({ member, index }: MemberRowProps) {
  const { colors } = useTheme();
  const style = useEntranceAnimation(staggerDelay(index, 40, 45), 12);
  const color = avatarColor(member.name);

  return (
    <Animated.View style={[styles.row, style]}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: `${color}22`, borderColor: `${color}50` },
        ]}
      >
        <Text style={[styles.initials, { color }]}>{getInitials(member.name)}</Text>
      </View>
      <Text
        style={[styles.name, { color: colors.foreground }]}
        numberOfLines={1}
      >
        {member.name.split(" ")[0]}
      </Text>
      <StatusChip presence={member.presence} />
    </Animated.View>
  );
}

export function TeamStatusCard({ members }: TeamStatusCardProps) {
  const { colors, typography } = useTheme();

  // Sort: present first, then absent, then offline
  const sorted = [...members].sort((a, b) => {
    const order = { present: 0, absent: 1, offline: 2 };
    const aO = order[a.presence?.status ?? "offline"];
    const bO = order[b.presence?.status ?? "offline"];
    return aO - bO;
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - MAX_VISIBLE;

  const presentCount = members.filter((m) => m.presence?.status === "present").length;
  const absentCount  = members.filter((m) => m.presence?.status === "absent").length;

  return (
    <GlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Users size={16} color={colors.mutedForeground} strokeWidth={2.4} />
          <Text
            style={[
              typography.heading,
              { color: colors.foreground, marginLeft: 8 },
            ]}
          >
            Team
          </Text>
        </View>
        <View style={styles.headerStats}>
          {presentCount > 0 && (
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: `${colors.success}18`,
                  borderColor: `${colors.success}40`,
                },
              ]}
            >
              <View
                style={[styles.statDot, { backgroundColor: colors.success }]}
              />
              <Text style={[styles.statText, { color: colors.success }]}>
                {presentCount} da
              </Text>
            </View>
          )}
          {absentCount > 0 && (
            <View
              style={[
                styles.statPill,
                { backgroundColor: "#64748b18", borderColor: "#64748b40" },
              ]}
            >
              <Text style={[styles.statText, { color: "#64748b" }]}>
                {absentCount} abwesend
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Member rows */}
      <View style={styles.list}>
        {visible.map((member, index) => (
          <MemberRow key={member.id} member={member} index={index} />
        ))}

        {overflow > 0 && (
          <Text style={[styles.overflow, { color: colors.mutedForeground }]}>
            +{overflow} weitere
          </Text>
        )}
      </View>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerStats: {
    flexDirection: "row",
    gap: 6,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: "600",
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  initials: {
    fontSize: 13,
    fontWeight: "700",
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  overflow: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
});
