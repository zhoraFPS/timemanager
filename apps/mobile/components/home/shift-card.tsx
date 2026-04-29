import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import { STAMP_TYPES } from "@/lib/stamp-types";
import { usePulse, SPRING_SMOOTH } from "@/lib/motion";
import type { TimeEntry } from "@/lib/types";

interface ShiftCardProps {
  activeEntry: TimeEntry | null;
  stampType?: string;
}

function formatTimer(diffSeconds: number): string {
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  const s = diffSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatElapsedShort(diffSeconds: number): string {
  const h = Math.floor(diffSeconds / 3600);
  const m = Math.floor((diffSeconds % 3600) / 60);
  return `${h}:${m.toString().padStart(2, "0")}h`;
}

const TARGET_SECONDS = 8 * 3600; // 8h target

export function ShiftCard({ activeEntry, stampType }: ShiftCardProps) {
  const { colors, typography } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = activeEntry != null && activeEntry.clockOut == null;

  useEffect(() => {
    if (isActive) {
      const tick = () => {
        const start = new Date(activeEntry.clockIn).getTime();
        const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
        setElapsed(diff);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [isActive, activeEntry?.clockIn]);

  const entryType = activeEntry?.type ?? stampType ?? "WORK";
  const stamp = STAMP_TYPES.find((s) => s.key === entryType) ?? STAMP_TYPES[0];
  const progress = Math.min(elapsed / TARGET_SECONDS, 1);

  // Animated progress bar fill width
  const progressShared = useSharedValue(0);
  useEffect(() => {
    progressShared.value = withTiming(progress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, progressShared]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progressShared.value * 100}%`,
  }));

  // Card scale pulse on mount when active
  const cardScale = useSharedValue(isActive ? 0.98 : 1);
  useEffect(() => {
    if (isActive) {
      cardScale.value = withSpring(1, SPRING_SMOOTH);
    }
  }, [isActive, cardScale]);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  // Live pulse dot on timer
  const pulseStyle = usePulse(1200);

  if (!isActive) {
    return (
      <Animated.View style={cardAnimStyle}>
        <GlassCard style={styles.card}>
          <Text style={[typography.heading, { color: colors.foreground }]}>
            Heute: 8:00 – 16:30 Uhr
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: "0%" },
              ]}
            />
          </View>
          <Text
            style={[
              typography.body,
              { color: colors.mutedForeground, marginTop: 4 },
            ]}
          >
            8h Soll · 30min Pause
          </Text>
        </GlassCard>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={cardAnimStyle}>
      <GlassCard style={styles.card}>
        {/* Gradient tint overlay */}
        <LinearGradient
          colors={[`${stamp.color}22`, `${stamp.color}08`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
          pointerEvents="none"
        />

        {/* Live indicator */}
        <View style={styles.liveRow}>
          <Animated.View
            style={[
              styles.liveDot,
              { backgroundColor: stamp.color },
              pulseStyle,
            ]}
          />
          <Text
            style={[
              typography.overline,
              {
                color: stamp.color,
                textTransform: "uppercase",
                marginLeft: 6,
              },
            ]}
          >
            Live · {stamp.label}
          </Text>
        </View>

        <Text style={[styles.timer, { color: colors.foreground }]}>
          {formatTimer(elapsed)}
        </Text>

        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: stamp.color },
              progressFillStyle,
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <Text style={[typography.body, { color: colors.mutedForeground }]}>
            Soll: 8:00h
          </Text>
          <Text
            style={[
              typography.bodyBold,
              { color: colors.foreground },
            ]}
          >
            Ist: {formatElapsedShort(elapsed)}
          </Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timer: {
    fontSize: 48,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
    textAlign: "left",
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});
