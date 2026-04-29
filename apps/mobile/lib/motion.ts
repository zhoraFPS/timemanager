import { useEffect, useRef } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Spring configs — mirror the motion tokens in theme.tsx so we can use them
// in hooks without pulling the full ThemeContext on the UI thread.
// ---------------------------------------------------------------------------

export const SPRING_SNAPPY = { damping: 18, stiffness: 260, mass: 0.9 };
export const SPRING_SMOOTH = { damping: 22, stiffness: 180, mass: 1 };
export const SPRING_BOUNCY = { damping: 10, stiffness: 180, mass: 0.9 };
export const SPRING_GENTLE = { damping: 28, stiffness: 120, mass: 1.2 };

// ---------------------------------------------------------------------------
// useEntranceAnimation
// Fade + slide-up entrance, optionally delayed.
// ---------------------------------------------------------------------------

export function useEntranceAnimation(
  delay: number = 0,
  distance: number = 24,
) {
  const progress = useSharedValue(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    progress.value = withDelay(
      delay,
      withSpring(1, SPRING_SMOOTH),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: (1 - progress.value) * distance,
      },
    ],
  }));

  return style;
}

// ---------------------------------------------------------------------------
// useScaleEntrance
// Scale + fade entrance — great for hero icons/logos.
// ---------------------------------------------------------------------------

export function useScaleEntrance(delay: number = 0) {
  const progress = useSharedValue(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    progress.value = withDelay(delay, withSpring(1, SPRING_BOUNCY));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: 0.85 + progress.value * 0.15 },
    ],
  }));

  return style;
}

// ---------------------------------------------------------------------------
// usePressAnimation
// Call onPressIn / onPressOut to get a scale-down press effect.
// ---------------------------------------------------------------------------

export function usePressAnimation(targetScale: number = 0.96) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(targetScale, SPRING_SNAPPY);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_SNAPPY);
  };

  return { style, onPressIn, onPressOut };
}

// ---------------------------------------------------------------------------
// useShake
// Returns { style, trigger } — call trigger() to run a horizontal shake.
// ---------------------------------------------------------------------------

export function useShake(amplitude: number = 8) {
  const offset = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const trigger = () => {
    offset.value = withSequence(
      withTiming(-amplitude, { duration: 60 }),
      withTiming(amplitude, { duration: 60 }),
      withTiming(-amplitude * 0.6, { duration: 60 }),
      withTiming(amplitude * 0.6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  return { style, trigger };
}

// ---------------------------------------------------------------------------
// useDrift
// Endless looping value from 0..1 — used for orbs, ambient animations, etc.
// ---------------------------------------------------------------------------

export function useDrift(
  duration: number,
  delay: number = 0,
): SharedValue<number> {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true, // reverse — creates smooth back-and-forth
      ),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [duration, delay, progress]);

  return progress;
}

// ---------------------------------------------------------------------------
// useRotation
// Endless rotation — ideal for subtle logo idle animations.
// ---------------------------------------------------------------------------

export function useRotation(duration: number = 60000) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [duration, angle]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  return style;
}

// ---------------------------------------------------------------------------
// usePulse
// Breathing/pulsing opacity — for "live" indicators.
// ---------------------------------------------------------------------------

export function usePulse(duration: number = 1400) {
  const progress = useSharedValue(0.4);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return style;
}

// ---------------------------------------------------------------------------
// Stagger helper — just returns delays, consumer passes to useEntranceAnimation
// ---------------------------------------------------------------------------

export function staggerDelay(index: number, base: number = 60, offset: number = 80) {
  return base + index * offset;
}
