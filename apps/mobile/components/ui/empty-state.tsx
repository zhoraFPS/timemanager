import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SPRING_BOUNCY } from "@/lib/motion";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Modern empty state with:
 * - Floating icon in a glassy circle
 * - Soft breathing animation
 * - Staggered title + description entrance
 * - Optional action slot for CTA button
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const { colors, typography } = useTheme();

  const iconScale = useSharedValue(0.6);
  const iconOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(8);
  const descOpacity = useSharedValue(0);
  const actionOpacity = useSharedValue(0);

  // Breathing float animation on the icon circle
  const floatY = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withDelay(100, withSpring(1, SPRING_BOUNCY));
    iconOpacity.value = withDelay(
      100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    titleOpacity.value = withDelay(
      260,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    titleTranslate.value = withDelay(260, withSpring(0, SPRING_BOUNCY));
    descOpacity.value = withDelay(
      360,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    actionOpacity.value = withDelay(
      480,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );

    // Continuous breathing float
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }, { translateY: floatY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));

  const descStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
  }));

  const actionStyle = useAnimatedStyle(() => ({
    opacity: actionOpacity.value,
    transform: [{ translateY: (1 - actionOpacity.value) * 8 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconCircle,
          {
            backgroundColor: `${colors.primary}15`,
            borderColor: `${colors.primary}28`,
          },
          iconStyle,
        ]}
      >
        <Icon size={32} color={colors.primary} strokeWidth={1.8} />
      </Animated.View>

      <Animated.View style={titleStyle}>
        <Text
          style={[
            typography.heading,
            styles.title,
            { color: colors.foreground },
          ]}
        >
          {title}
        </Text>
      </Animated.View>

      {description ? (
        <Animated.View style={descStyle}>
          <Text
            style={[
              typography.body,
              styles.description,
              { color: colors.mutedForeground },
            ]}
          >
            {description}
          </Text>
        </Animated.View>
      ) : null}

      {action ? (
        <Animated.View style={[styles.action, actionStyle]}>
          {action}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
    lineHeight: 20,
  },
  action: {
    marginTop: 20,
  },
});
