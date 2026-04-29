import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Platform, useColorScheme, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeColors {
  background: string;
  backgroundElevated: string;
  foreground: string;
  card: string;
  cardBorder: string;
  cardBlur: number;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  primaryGradient: [string, string];
  accent: string;
  accent2: string;
  auroraGradient: [string, string, string];
  secondary: string;
  destructive: string;
  destructiveGradient: [string, string];
  success: string;
  successGradient: [string, string];
  warning: string;
  border: string;
  glassBackground: string;
  glassBorder: string;
  glassHighlight: string;
  tabBarBackground: string;
  // Aurora background orbs
  orb1: string;
  orb2: string;
  orb3: string;
}

export interface Elevation {
  card: ViewStyle;
  floating: ViewStyle;
  modal: ViewStyle;
  hero: ViewStyle;
}

export interface MotionTokens {
  spring: {
    snappy: { damping: number; stiffness: number; mass: number };
    smooth: { damping: number; stiffness: number; mass: number };
    bouncy: { damping: number; stiffness: number; mass: number };
    gentle: { damping: number; stiffness: number; mass: number };
  };
  timing: {
    fast: number;
    base: number;
    slow: number;
    hero: number;
  };
  stagger: number;
}

export interface Typography {
  hero: { fontSize: number; fontWeight: "700"; letterSpacing: number };
  title: { fontSize: number; fontWeight: "700"; letterSpacing: number };
  heading: { fontSize: number; fontWeight: "600"; letterSpacing: number };
  body: { fontSize: number; fontWeight: "400"; letterSpacing: number };
  bodyBold: { fontSize: number; fontWeight: "600"; letterSpacing: number };
  caption: { fontSize: number; fontWeight: "400" | "500"; letterSpacing: number };
  overline: { fontSize: number; fontWeight: "600"; letterSpacing: number };
}

export interface Radius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ThemeContextValue {
  colors: ThemeColors;
  elevation: Elevation;
  motion: MotionTokens;
  typography: Typography;
  radius: Radius;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const darkColors: ThemeColors = {
  background: "#07070b",
  backgroundElevated: "#0f0f14",
  foreground: "#fafafa",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.1)",
  cardBlur: 28,
  muted: "#27272a",
  mutedForeground: "#a1a1aa",
  primary: "#3b82f6",
  primaryForeground: "#ffffff",
  primaryGradient: ["#60a5fa", "#2563eb"],
  accent: "#a855f7",
  accent2: "#22d3ee",
  auroraGradient: ["#3b82f6", "#a855f7", "#22d3ee"],
  secondary: "#27272a",
  destructive: "#ef4444",
  destructiveGradient: ["#f87171", "#dc2626"],
  success: "#22c55e",
  successGradient: ["#4ade80", "#16a34a"],
  warning: "#f59e0b",
  border: "rgba(255,255,255,0.08)",
  glassBackground: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.1)",
  glassHighlight: "rgba(255,255,255,0.15)",
  tabBarBackground: "rgba(15,15,20,0.75)",
  orb1: "#3b82f6",
  orb2: "#a855f7",
  orb3: "#0ea5e9",
};

const lightColors: ThemeColors = {
  background: "#f6f7fb",
  backgroundElevated: "#ffffff",
  foreground: "#09090b",
  card: "rgba(255,255,255,0.72)",
  cardBorder: "rgba(0,0,0,0.06)",
  cardBlur: 28,
  muted: "#e5e7eb",
  mutedForeground: "#6b7280",
  primary: "#2563eb",
  primaryForeground: "#ffffff",
  primaryGradient: ["#3b82f6", "#1d4ed8"],
  accent: "#9333ea",
  accent2: "#06b6d4",
  auroraGradient: ["#60a5fa", "#c084fc", "#67e8f9"],
  secondary: "#e5e7eb",
  destructive: "#dc2626",
  destructiveGradient: ["#f87171", "#b91c1c"],
  success: "#16a34a",
  successGradient: ["#4ade80", "#15803d"],
  warning: "#d97706",
  border: "rgba(0,0,0,0.06)",
  glassBackground: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(0,0,0,0.08)",
  glassHighlight: "rgba(255,255,255,0.9)",
  tabBarBackground: "rgba(255,255,255,0.82)",
  orb1: "#93c5fd",
  orb2: "#c4b5fd",
  orb3: "#a5f3fc",
};

// ---------------------------------------------------------------------------
// Elevation (platform-aware shadows)
// ---------------------------------------------------------------------------

function buildElevation(isDark: boolean): Elevation {
  const shadowColor = isDark ? "#000" : "#0f172a";
  const opacityMul = isDark ? 1 : 0.6;

  const make = (
    radius: number,
    opacity: number,
    offset: number,
    androidElev: number,
  ): ViewStyle =>
    Platform.OS === "ios"
      ? {
          shadowColor,
          shadowOffset: { width: 0, height: offset },
          shadowOpacity: opacity * opacityMul,
          shadowRadius: radius,
        }
      : { elevation: androidElev };

  // iOS-style: very subtle, diffused, neutral shadows
  return {
    card: make(8, 0.06, 2, 1),
    floating: make(12, 0.1, 4, 3),
    modal: make(20, 0.16, 8, 6),
    hero: make(28, 0.2, 10, 8),
  };
}

// ---------------------------------------------------------------------------
// Motion tokens (Reanimated spring configs)
// ---------------------------------------------------------------------------

const motion: MotionTokens = {
  spring: {
    // Quick interactive feedback (buttons, toggles)
    snappy: { damping: 18, stiffness: 260, mass: 0.9 },
    // Smooth entrance (cards, sheets)
    smooth: { damping: 22, stiffness: 180, mass: 1 },
    // Playful bounce (success states, delight moments)
    bouncy: { damping: 10, stiffness: 180, mass: 0.9 },
    // Slow elegant motion (hero elements)
    gentle: { damping: 28, stiffness: 120, mass: 1.2 },
  },
  timing: {
    fast: 180,
    base: 280,
    slow: 420,
    hero: 680,
  },
  stagger: 80,
};

// ---------------------------------------------------------------------------
// Typography scale
// ---------------------------------------------------------------------------

const typography: Typography = {
  hero: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: 0.35 },
  heading: { fontSize: 17, fontWeight: "600", letterSpacing: -0.41 },
  body: { fontSize: 15, fontWeight: "400", letterSpacing: -0.24 },
  bodyBold: { fontSize: 15, fontWeight: "600", letterSpacing: -0.24 },
  caption: { fontSize: 12, fontWeight: "400", letterSpacing: 0 },
  overline: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6 },
};

// ---------------------------------------------------------------------------
// Border radius scale
// ---------------------------------------------------------------------------

const radius: Radius = {
  sm: 10,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 9999,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const STORAGE_KEY = "themeMode";

const defaultValue: ThemeContextValue = {
  colors: darkColors,
  elevation: buildElevation(true),
  motion,
  typography,
  radius,
  isDark: true,
  mode: "system",
  setMode: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system") {
          setModeState(value);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = useMemo(() => {
    if (mode === "system") {
      return systemScheme !== "light"; // default to dark when null
    }
    return mode === "dark";
  }, [mode, systemScheme]);

  const colors = isDark ? darkColors : lightColors;
  const elevation = useMemo(() => buildElevation(isDark), [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      elevation,
      motion,
      typography,
      radius,
      isDark,
      mode,
      setMode,
    }),
    [colors, elevation, isDark, mode, setMode],
  );

  // Don't render children until we've loaded the persisted preference to
  // avoid a flash of the wrong theme.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
