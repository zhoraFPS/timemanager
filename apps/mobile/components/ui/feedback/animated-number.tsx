import React, { useEffect, useState } from "react";
import { Text, type TextStyle, type StyleProp } from "react-native";
import {
  useSharedValue,
  withTiming,
  Easing,
  runOnJS,
  useAnimatedReaction,
} from "react-native-reanimated";

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}

/**
 * Animates a number value smoothly to a new target. Useful for balances,
 * counters, hours — anywhere you want the number to "count up" rather than
 * snap.
 */
export function AnimatedNumber({
  value,
  duration = 800,
  format = (n) => Math.round(n).toString(),
  style,
}: AnimatedNumberProps) {
  const progress = useSharedValue(value);
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    progress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, progress]);

  useAnimatedReaction(
    () => progress.value,
    (current) => {
      runOnJS(setDisplayValue)(current);
    },
  );

  return <Text style={style}>{format(displayValue)}</Text>;
}
