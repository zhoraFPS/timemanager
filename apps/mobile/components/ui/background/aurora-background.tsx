import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";

export interface AuroraBackgroundProps {
  /**
   * Overall visual weight. `subtle` is near-imperceptible,
   * `normal` adds slight warmth, `hero` is slightly stronger (login).
   */
  intensity?: "subtle" | "normal" | "hero";
  /** Whether to render the filmic grain overlay (disabled — too noisy for iOS) */
  showGrain?: boolean;
  /** Kept for API compatibility — no longer used. */
  blurIntensity?: number;
}

/**
 * Clean iOS-style layered background.
 *
 * Instead of gradient orbs, uses the theme background color directly.
 * For `hero` intensity, adds a very subtle warm tint at the top —
 * matching Apple's approach of clean, solid backgrounds with
 * minimal depth cues.
 */
export function AuroraBackground({
  intensity = "normal",
}: AuroraBackgroundProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Subtle top-edge tint for hero screens (login, etc.) */}
      {intensity === "hero" && (
        <View
          style={[
            styles.topTint,
            {
              backgroundColor: isDark
                ? "rgba(59,130,246,0.04)"
                : "rgba(59,130,246,0.02)",
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
});
