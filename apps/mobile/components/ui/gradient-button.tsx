import React from "react";
import {
  Pressable,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { SPRING_SNAPPY } from "@/lib/motion";

export type GradientButtonVariant = "primary" | "destructive" | "success";
export type GradientButtonSize = "md" | "lg";

export interface GradientButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: GradientButtonVariant;
  size?: GradientButtonSize;
  style?: StyleProp<ViewStyle>;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

export function GradientButton({
  onPress,
  children,
  icon,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "lg",
  style,
  hapticStyle = Haptics.ImpactFeedbackStyle.Medium,
}: GradientButtonProps) {
  const { colors, radius } = useTheme();

  const scale = useSharedValue(1);
  const contentOpacity = useSharedValue(1);
  const loaderOpacity = useSharedValue(0);

  React.useEffect(() => {
    contentOpacity.value = withTiming(loading ? 0 : 1, { duration: 180 });
    loaderOpacity.value = withTiming(loading ? 1 : 0, { duration: 180 });
  }, [loading, contentOpacity, loaderOpacity]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const loaderAnimStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.97, SPRING_SNAPPY);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_SNAPPY);
  };

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(hapticStyle).catch(() => {});
    onPress?.();
  };

  // Solid fill color — no gradient
  const fillColor =
    variant === "destructive"
      ? colors.destructive
      : variant === "success"
        ? colors.success
        : colors.primary;

  const height = size === "lg" ? 50 : 44;
  const fontSize = size === "lg" ? 17 : 15;

  const buttonStyle: ViewStyle = {
    borderRadius: radius.md,
    height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: fillColor,
    overflow: "hidden",
  };

  // Subtle neutral shadow — not colored glow
  const shadowStyle: ViewStyle = Platform.OS === "ios"
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      }
    : { elevation: 3 };

  return (
    <Animated.View
      style={[shadowStyle, containerAnimStyle, style]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[buttonStyle, disabled && { opacity: 0.45 }]}
      >
        {/* Label */}
        <Animated.View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            },
            contentAnimStyle,
          ]}
        >
          {icon ? icon : null}
          {typeof children === "string" ? (
            <Text
              style={{
                color: colors.primaryForeground,
                fontSize,
                fontWeight: "600",
                letterSpacing: -0.4,
              }}
            >
              {children}
            </Text>
          ) : (
            children
          )}
        </Animated.View>

        {/* Loader (cross-fades in) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, loaderAnimStyle, {
            alignItems: "center",
            justifyContent: "center",
          }]}
          pointerEvents="none"
        >
          <ActivityIndicator color={colors.primaryForeground} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
