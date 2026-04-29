import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Bell } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useEntranceAnimation, usePulse, SPRING_SNAPPY } from "@/lib/motion";

interface GreetingHeaderProps {
  name: string;
  notificationCount?: number;
  onBellPress?: () => void;
}

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function formatDateGerman(): string {
  const now = new Date();
  const weekday = WEEKDAYS[now.getDay()];
  const day = now.getDate();
  const month = MONTHS[now.getMonth()];
  const year = now.getFullYear();
  return `${weekday}, ${day}. ${month} ${year}`;
}

export function GreetingHeader({
  name,
  notificationCount,
  onBellPress,
}: GreetingHeaderProps) {
  const { colors, typography } = useTheme();

  const entranceStyle = useEntranceAnimation(0);
  const pulseStyle = usePulse(1800);

  const bellScale = useSharedValue(1);
  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellScale.value }],
  }));
  const onBellPressIn = () => {
    bellScale.value = withSpring(0.88, SPRING_SNAPPY);
  };
  const onBellPressOut = () => {
    bellScale.value = withSpring(1, SPRING_SNAPPY);
  };

  const hasUnread = notificationCount != null && notificationCount > 0;

  return (
    <Animated.View style={[styles.container, entranceStyle]}>
      <View style={styles.textContainer}>
        <Text
          style={[
            typography.hero,
            { color: colors.foreground },
          ]}
        >
          {getGreeting()}, {name}
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.mutedForeground, marginTop: 2 },
          ]}
        >
          {formatDateGerman()}
        </Text>
      </View>

      <Pressable
        onPress={onBellPress}
        onPressIn={onBellPressIn}
        onPressOut={onBellPressOut}
        hitSlop={12}
      >
        <Animated.View
          style={[
            styles.bellContainer,
            {
              backgroundColor: colors.glassBackground,
              borderColor: colors.glassBorder,
            },
            bellAnimStyle,
          ]}
        >
          <Bell size={20} color={colors.foreground} strokeWidth={2.2} />
          {hasUnread ? (
            <>
              {/* Outer pulse ring */}
              <Animated.View
                style={[
                  styles.pulseRing,
                  { backgroundColor: colors.destructive },
                  pulseStyle,
                ]}
              />
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.destructive },
                ]}
              >
                <Text style={styles.badgeText}>
                  {notificationCount! > 99 ? "99+" : notificationCount}
                </Text>
              </View>
            </>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 16,
  },
  textContainer: {
    flex: 1,
  },
  bellContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
});
