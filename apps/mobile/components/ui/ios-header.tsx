import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/theme";

interface IOSHeaderProps {
  title: string;
  scrollY: SharedValue<number>;
  /** Optional right-side action button */
  rightAction?: React.ReactNode;
}

const LARGE_TITLE_HEIGHT = 52;
const COLLAPSE_DISTANCE = 40;

/**
 * iOS-style collapsing large title header.
 *
 * - Shows large title (34pt bold) when scrollY ≈ 0
 * - Collapses to compact inline title (17pt semibold) with blur bar as user scrolls
 * - Matches Apple HIG large-title navigation bar pattern
 */
export function IOSHeader({ title, scrollY, rightAction }: IOSHeaderProps) {
  const { colors, isDark } = useTheme();

  // Large title: fades out and slides up as scroll increases
  const largeTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [0, -10],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  // Compact title: fades in as scroll increases
  const compactTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * 0.6, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Compact bar separator
  const separatorStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * 0.8, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <View>
      {/* Compact bar (always present, content fades in) */}
      <View style={styles.compactBar}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: isDark
                    ? "rgba(0,0,0,0.3)"
                    : "rgba(255,255,255,0.72)",
                },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark
                  ? "rgba(15,15,20,0.96)"
                  : "rgba(255,255,255,0.97)",
              },
            ]}
          />
        )}
        <Animated.Text
          style={[styles.compactTitle, { color: colors.foreground }, compactTitleStyle]}
          numberOfLines={1}
        >
          {title}
        </Animated.Text>
        <Animated.View style={[styles.separator, { backgroundColor: colors.border }, separatorStyle]} />
      </View>

      {/* Large title row */}
      <Animated.View style={[styles.largeTitleRow, largeTitleStyle]}>
        <Text style={[styles.largeTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        {rightAction}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactBar: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.41,
  },
  separator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  largeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: LARGE_TITLE_HEIGHT,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.37,
    flex: 1,
  },
});
