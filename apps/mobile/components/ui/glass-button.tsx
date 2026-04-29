import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  View,
  StyleSheet,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";

export type GlassButtonVariant = "default" | "destructive" | "gradient";

export interface GlassButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: GlassButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlassButton({
  onPress,
  children,
  variant = "default",
  disabled = false,
  style,
}: GlassButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const containerStyle: ViewStyle = {
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderWidth: variant === "default" ? 1 : 0,
    borderColor: variant === "default" ? colors.glassBorder : "transparent",
  };

  const getBackgroundStyle = (): ViewStyle => {
    switch (variant) {
      case "destructive":
        return {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: `${colors.destructive}33`,
        };
      case "gradient":
        return {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.primary,
        };
      default:
        return {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.glassBackground,
        };
    }
  };

  const useBlur = variant === "default" && Platform.OS === "ios";

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[containerStyle, disabled && { opacity: 0.5 }]}
      >
        {useBlur ? (
          <BlurView
            intensity={40}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          >
            <View style={getBackgroundStyle()} />
          </BlurView>
        ) : (
          <View style={[StyleSheet.absoluteFill, getBackgroundStyle()]} />
        )}
        {children}
      </Pressable>
    </Animated.View>
  );
}
