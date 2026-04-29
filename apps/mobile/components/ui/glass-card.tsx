import React from "react";
import {
  View,
  StyleSheet,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/theme";

export interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  intensity?: number;
}

export function GlassCard({
  children,
  style,
  intensity = 40,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    // iOS continuous corners (superellipse) — matches Apple's design language
    ...(Platform.OS === "ios" ? { borderCurve: "continuous" as any } : {}),
  };

  const overlayStyle: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glassBackground,
  };

  const contentStyle: ViewStyle = {
    padding: 16,
  };

  return (
    <View style={[containerStyle, style]}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={intensity}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        >
          <View style={overlayStyle} />
        </BlurView>
      ) : (
        <View style={[StyleSheet.absoluteFill, overlayStyle]} />
      )}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
