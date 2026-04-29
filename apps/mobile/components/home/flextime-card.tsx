import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { TrendingUp, TrendingDown } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedNumber } from "@/components/ui/feedback/animated-number";
import { SPRING_SMOOTH } from "@/lib/motion";
import type { FlexMonth } from "@/lib/types";

interface FlextimeCardProps {
  saldoMinutes: number;
  months: FlexMonth[];
}

function formatSaldoHours(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${m.toString().padStart(2, "0")}`;
}

interface AnimatedBarProps {
  heightValue: number;
  color: string;
  delay: number;
  isActive: boolean;
}

function AnimatedBar({ heightValue, color, delay, isActive }: AnimatedBarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, SPRING_SMOOTH));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    height: Math.max(4, heightValue * progress.value),
    opacity: progress.value * (isActive ? 1 : 0.45),
  }));

  return (
    <Animated.View
      style={[
        { width: 14, borderRadius: 4, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function FlextimeCard({ saldoMinutes, months }: FlextimeCardProps) {
  const { colors, typography } = useTheme();

  const isPositive = saldoMinutes >= 0;
  const saldoColor = isPositive ? colors.success : colors.destructive;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  // Last 4 months for sparkline
  const sparkData = months.slice(-4);
  const maxAbs = sparkData.reduce(
    (max, m) => Math.max(max, Math.abs(m.saldoMins)),
    1,
  );

  // AnimatedNumber animates the absolute hours; we keep the sign/colon in format
  const absHours = Math.abs(saldoMinutes) / 60;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.overline,
              { color: colors.mutedForeground, textTransform: "uppercase" },
            ]}
          >
            Gleitzeit-Saldo
          </Text>
          <View style={styles.saldoRow}>
            <AnimatedNumber
              value={absHours}
              duration={900}
              format={(n) => formatSaldoHours(Math.round(n * 60) * (isPositive ? 1 : -1))}
              style={[styles.saldo, { color: saldoColor }]}
            />
            <Text style={[styles.saldoUnit, { color: saldoColor }]}>h</Text>
          </View>
        </View>

        <View
          style={[
            styles.trendBadge,
            { backgroundColor: `${saldoColor}22` },
          ]}
        >
          <TrendIcon size={18} color={saldoColor} strokeWidth={2.5} />
        </View>
      </View>

      {sparkData.length > 0 && (
        <View style={styles.sparkRow}>
          {sparkData.map((m, i) => {
            const barPositive = m.saldoMins >= 0;
            const barColor = barPositive ? colors.success : colors.destructive;
            const targetHeight = Math.round((Math.abs(m.saldoMins) / maxAbs) * 36);
            const isLast = i === sparkData.length - 1;
            return (
              <View key={i} style={styles.sparkBarWrapper}>
                <AnimatedBar
                  heightValue={targetHeight}
                  color={barColor}
                  delay={200 + i * 80}
                  isActive={isLast}
                />
              </View>
            );
          })}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  saldoRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  saldo: {
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
  trendBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 16,
    height: 40,
  },
  sparkBarWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 40,
  },
});
