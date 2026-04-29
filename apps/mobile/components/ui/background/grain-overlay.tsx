import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, Filter, FeTurbulence, Rect } from "react-native-svg";

export interface GrainOverlayProps {
  opacity?: number;
}

/**
 * Subtle SVG-based noise overlay. Adds filmic texture to backgrounds.
 * Uses feTurbulence which is GPU-accelerated on both iOS and Android.
 */
export function GrainOverlay({ opacity = 0.08 }: GrainOverlayProps) {
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="none"
    >
      <Defs>
        <Filter id="grain">
          <FeTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            stitchTiles="stitch"
          />
        </Filter>
      </Defs>
      <Rect width="100%" height="100%" filter="url(#grain)" />
    </Svg>
  );
}
