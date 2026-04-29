import React, { useRef, useEffect } from "react";
import {
  Animated,
  Pressable,
  View,
  Text,
  StyleSheet,
  Platform,
  type LayoutChangeEvent,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";

export interface GlassSegmentProps {
  segments: string[];
  active: number;
  onChange: (index: number) => void;
}

export function GlassSegment({
  segments,
  active,
  onChange,
}: GlassSegmentProps) {
  const { colors, isDark } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const containerWidth = useRef(0);

  const segmentCount = segments.length;

  useEffect(() => {
    if (containerWidth.current > 0) {
      const pillWidth = (containerWidth.current - 8) / segmentCount;
      Animated.spring(translateX, {
        toValue: pillWidth * active,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }).start();
    }
  }, [active, segmentCount, translateX]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    containerWidth.current = width;
    const pillWidth = (width - 8) / segmentCount;
    translateX.setValue(pillWidth * active);
  };

  const handlePress = (index: number) => {
    if (index !== active) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(index);
    }
  };

  // iOS-native segmented control: muted background, white/light active pill with shadow
  const trackColor = isDark
    ? "rgba(118,118,128,0.24)"
    : "rgba(118,118,128,0.12)";

  const pillColor = isDark
    ? "rgba(99,99,102,0.65)"
    : "#ffffff";

  const pillShadow = Platform.OS === "ios"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.35 : 0.12,
        shadowRadius: 4,
      }
    : { elevation: 2 };

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      onLayout={handleLayout}
    >
      {/* Sliding active pill — white/light with shadow (iOS native style) */}
      <Animated.View
        style={[
          styles.pill,
          pillShadow,
          {
            backgroundColor: pillColor,
            width: containerWidth.current
              ? (containerWidth.current - 8) / segmentCount
              : `${100 / segmentCount}%` as unknown as number,
            transform: [{ translateX }],
          },
        ]}
      />

      {segments.map((label, index) => (
        <Pressable
          key={label}
          onPress={() => handlePress(index)}
          style={styles.segment}
        >
          <Text
            style={[
              styles.label,
              {
                color: index === active
                  ? (isDark ? "#fff" : "#000")
                  : colors.mutedForeground,
                fontWeight: index === active ? "600" : "500",
              },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 9,
    padding: 4,
    position: "relative",
  },
  pill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 7,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.08,
  },
});
