import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  Platform,
  KeyboardAvoidingView,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/theme";
import { SPRING_SMOOTH } from "@/lib/motion";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Gesture tuning
// ---------------------------------------------------------------------------

// How far the finger must travel down before the pan gesture actually starts.
// Positive-only so upward gestures (like scrolling in content) are ignored.
const ACTIVATE_OFFSET_Y: [number, number] = [12, 9999];

// A drag past this fraction of the sheet's own height → dismiss.
const DISMISS_FRACTION = 0.3;

// A fling faster than this (px/s) dismisses regardless of distance.
const DISMISS_VELOCITY = 650;

// ---------------------------------------------------------------------------
// Public handle (replaces BottomSheetModal ref)
// ---------------------------------------------------------------------------

export interface BottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimpleBottomSheetProps {
  /** Fraction of screen height (0-1). Default 0.6 */
  snapFraction?: number;
  children: React.ReactNode;
  onDismiss?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SimpleBottomSheet = forwardRef<BottomSheetHandle, SimpleBottomSheetProps>(
  function SimpleBottomSheet({ snapFraction = 0.6, children, onDismiss }, ref) {
    const { colors, isDark } = useTheme();
    const [visible, setVisible] = useState(false);

    const sheetHeight = SCREEN_HEIGHT * snapFraction;

    // Shared values — driven by Reanimated worklets so gesture handling is
    // 60fps on the UI thread.
    const translateY = useSharedValue(sheetHeight);
    const panStartY = useSharedValue(0);

    // ---- Animation control ----

    const hide = useCallback(() => {
      setVisible(false);
    }, []);

    const fireOnDismiss = useCallback(() => {
      onDismiss?.();
    }, [onDismiss]);

    const animateIn = useCallback(() => {
      translateY.value = withSpring(0, SPRING_SMOOTH);
    }, [translateY]);

    const animateOut = useCallback(() => {
      translateY.value = withTiming(
        sheetHeight,
        { duration: 240, easing: Easing.out(Easing.cubic) },
        (finished) => {
          "worklet";
          if (finished) {
            runOnJS(hide)();
            runOnJS(fireOnDismiss)();
          }
        },
      );
    }, [translateY, sheetHeight, hide, fireOnDismiss]);

    // ---- Imperative handle ----

    useImperativeHandle(ref, () => ({
      present() {
        translateY.value = sheetHeight;
        setVisible(true);
        // Kick off the entrance in the next frame so the Modal can mount first
        requestAnimationFrame(() => animateIn());
      },
      dismiss() {
        animateOut();
      },
    }));

    // ---- Pan gesture — drag-to-dismiss ----

    const panGesture = Gesture.Pan()
      .activeOffsetY(ACTIVATE_OFFSET_Y)
      .onStart(() => {
        panStartY.value = translateY.value;
      })
      .onUpdate((e) => {
        // Allow downward drag, rubber-band upward pull
        const next = panStartY.value + e.translationY;
        translateY.value = next < 0 ? next * 0.25 : next;
      })
      .onEnd((e) => {
        const shouldDismiss =
          translateY.value > sheetHeight * DISMISS_FRACTION ||
          (e.velocityY > DISMISS_VELOCITY && translateY.value > 10);

        if (shouldDismiss) {
          translateY.value = withTiming(
            sheetHeight,
            { duration: 220, easing: Easing.out(Easing.cubic) },
            (finished) => {
              "worklet";
              if (finished) {
                runOnJS(hide)();
                runOnJS(fireOnDismiss)();
              }
            },
          );
        } else {
          translateY.value = withSpring(0, SPRING_SMOOTH);
        }
      });

    // ---- Derived styles ----

    const sheetAnimStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        translateY.value,
        [0, sheetHeight],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }));

    const sheetBg: ViewStyle = {
      backgroundColor: isDark
        ? "rgba(20,20,22,0.94)"
        : "rgba(245,245,247,0.94)",
    };

    // ---- Render ----

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={animateOut}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Backdrop (tap outside to dismiss) */}
          <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={animateOut}
            />
          </Animated.View>

          {/* Sheet — drag anywhere on it to dismiss. The pan gesture has a
              positive activeOffsetY so upward gestures (like scrolling in
              content) remain unaffected. */}
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                sheetBg,
                { height: sheetHeight },
                sheetAnimStyle,
              ]}
            >
              {/* Blur on iOS (behind everything else) */}
              {Platform.OS === "ios" && (
                <BlurView
                  intensity={60}
                  tint={isDark ? "dark" : "light"}
                  style={StyleSheet.absoluteFill}
                />
              )}

              {/* Drag handle — purely visual now, gesture works on full sheet */}
              <View style={styles.handleContainer}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: colors.mutedForeground },
                  ]}
                />
              </View>

              {/* Content */}
              <View style={styles.content}>{children}</View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

// ---------------------------------------------------------------------------
// Provider stub (no-op, keeps import compatibility)
// ---------------------------------------------------------------------------

export function BottomSheetProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 6,
    zIndex: 10,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.3,
  },
  content: {
    flex: 1,
    zIndex: 5,
  },
});
