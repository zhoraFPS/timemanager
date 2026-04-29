import React, { useState, forwardRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SPRING_SMOOTH } from "@/lib/motion";

export interface GlassInputProps
  extends Omit<TextInputProps, "style" | "placeholder"> {
  label: string;
  icon?: React.ReactNode;
  error?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  secureTextEntry?: boolean;
}

// ---------------------------------------------------------------------------
// Layout constants — every measurement is relative to these so centering
// holds no matter what content renders inside the pill.
// ---------------------------------------------------------------------------

const FIELD_HEIGHT = 60;
const LABEL_FONT = 14;
const INPUT_FONT = 15;
// Half the visual height of the label, used to vertically center it via
// transform translateY (the standard "top:50% + translateY(-50%)" trick).
const LABEL_HALF_HEIGHT = 9;
// How far the label floats UP from the centered position when focused/filled.
const LABEL_FLOAT_OFFSET = 13;
// When the label is floated, the input text moves DOWN a touch so the two
// don't visually collide.
const INPUT_OFFSET_WHEN_FLOATED = 9;

export const GlassInput = forwardRef<TextInput, GlassInputProps>(
  function GlassInput(
    {
      label,
      icon,
      error,
      containerStyle,
      value,
      onFocus,
      onBlur,
      secureTextEntry,
      ...inputProps
    },
    ref,
  ) {
    const { colors, radius, isDark } = useTheme();
    const [focused, setFocused] = useState(false);
    const [hidePassword, setHidePassword] = useState(!!secureTextEntry);

    const focusProgress = useSharedValue(0);
    const labelProgress = useSharedValue(value ? 1 : 0);
    const errorProgress = useSharedValue(0);

    // Keep label up when value becomes non-empty programmatically
    React.useEffect(() => {
      if (value && labelProgress.value === 0) {
        labelProgress.value = withSpring(1, SPRING_SMOOTH);
      } else if (!value && !focused && labelProgress.value === 1) {
        labelProgress.value = withSpring(0, SPRING_SMOOTH);
      }
    }, [value, focused, labelProgress]);

    React.useEffect(() => {
      errorProgress.value = withTiming(error ? 1 : 0, { duration: 220 });
    }, [error, errorProgress]);

    const handleFocus: TextInputProps["onFocus"] = (e) => {
      setFocused(true);
      focusProgress.value = withSpring(1, SPRING_SMOOTH);
      labelProgress.value = withSpring(1, SPRING_SMOOTH);
      onFocus?.(e);
    };

    const handleBlur: TextInputProps["onBlur"] = (e) => {
      setFocused(false);
      focusProgress.value = withSpring(0, SPRING_SMOOTH);
      if (!value) {
        labelProgress.value = withSpring(0, SPRING_SMOOTH);
      }
      onBlur?.(e);
    };

    // Animated border color (muted → primary → destructive)
    const borderAnimStyle = useAnimatedStyle(() => {
      const normalColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        [colors.glassBorder, colors.primary],
      );
      const finalColor = interpolateColor(
        errorProgress.value,
        [0, 1],
        [normalColor, colors.destructive],
      );
      return { borderColor: finalColor };
    });

    // Floating label position + scale. Starts visually centered (translated
    // up by half its height), moves further up and shrinks when focused.
    const labelStyle = useAnimatedStyle(() => {
      const translateY =
        -LABEL_HALF_HEIGHT - labelProgress.value * LABEL_FLOAT_OFFSET;
      const scale = 1 - labelProgress.value * 0.18;
      return {
        transform: [{ translateY }, { scale }],
      };
    });

    const labelColorStyle = useAnimatedStyle(() => {
      const normalColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        [colors.mutedForeground, colors.primary],
      );
      const finalColor = interpolateColor(
        errorProgress.value,
        [0, 1],
        [normalColor, colors.destructive],
      );
      return { color: finalColor };
    });

    // When label is floated, push the input text down a touch
    const inputWrapStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: labelProgress.value * INPUT_OFFSET_WHEN_FLOATED }],
    }));

    const outerStyle: ViewStyle = {
      borderRadius: radius.md,
      overflow: "hidden",
      borderWidth: 1.5,
      height: FIELD_HEIGHT,
    };

    return (
      <Animated.View style={[outerStyle, borderAnimStyle, containerStyle]}>
        {/* Glass backdrop */}
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={30}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.glassBackground },
              ]}
            />
          </BlurView>
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.glassBackground },
            ]}
          />
        )}

        <View style={styles.row}>
          {icon ? <View style={styles.iconSlot}>{icon}</View> : null}

          {/* Input column — relative so the floating label can absolute-
              position itself within it */}
          <View style={styles.inputCol}>
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.label,
                { fontSize: LABEL_FONT },
                labelStyle,
                labelColorStyle,
              ]}
              numberOfLines={1}
            >
              {label}
            </Animated.Text>

            <Animated.View style={[styles.inputWrap, inputWrapStyle]}>
              <TextInput
                ref={ref}
                {...inputProps}
                value={value}
                onFocus={handleFocus}
                onBlur={handleBlur}
                secureTextEntry={hidePassword}
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    fontSize: INPUT_FONT,
                  },
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as object)
                    : null,
                ]}
                placeholderTextColor="transparent"
                underlineColorAndroid="transparent"
                textAlignVertical="center"
              />
            </Animated.View>
          </View>

          {secureTextEntry ? (
            <Pressable
              onPress={() => setHidePassword((h) => !h)}
              hitSlop={12}
              style={styles.eyeSlot}
            >
              {hidePassword ? (
                <Eye size={18} color={colors.mutedForeground} />
              ) : (
                <EyeOff size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles — everything centered against FIELD_HEIGHT
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    height: FIELD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  iconSlot: {
    width: 22,
    height: FIELD_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  inputCol: {
    flex: 1,
    height: FIELD_HEIGHT,
    justifyContent: "center",
    position: "relative",
  },
  label: {
    position: "absolute",
    top: "50%",
    left: 0,
    fontWeight: "500",
    transformOrigin: "left center",
    includeFontPadding: false,
  },
  inputWrap: {
    justifyContent: "center",
  },
  input: {
    fontWeight: "500",
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  eyeSlot: {
    height: FIELD_HEIGHT,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
