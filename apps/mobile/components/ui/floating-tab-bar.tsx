import React, { useEffect } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Home, Calendar, FileText, User, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { SPRING_BOUNCY, SPRING_SNAPPY } from "@/lib/motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloatingTabBarProps extends BottomTabBarProps {
  onStampPress?: () => void;
}

// ---------------------------------------------------------------------------
// Route → icon mapping
// ---------------------------------------------------------------------------

const ROUTE_ICONS: Record<string, typeof Home> = {
  index: Home,
  zeiten: Calendar,
  antraege: FileText,
  profil: User,
};

// ---------------------------------------------------------------------------
// Individual tab
// ---------------------------------------------------------------------------

interface TabButtonProps {
  icon: typeof Home;
  label: string;
  isFocused: boolean;
  color: string;
  focusedColor: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabButton({
  icon: Icon,
  label,
  isFocused,
  color,
  focusedColor,
  onPress,
  onLongPress,
}: TabButtonProps) {
  const scale = useSharedValue(1);

  // Subtle scale on focus
  useEffect(() => {
    if (isFocused) {
      scale.value = withSequence(
        withTiming(1.08, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withSpring(1, SPRING_BOUNCY),
      );
    }
  }, [isFocused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (!isFocused) {
      Haptics.selectionAsync();
    }
    onPress();
  }

  const currentColor = isFocused ? focusedColor : color;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={currentColor} strokeWidth={isFocused ? 2.4 : 1.8} />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          {
            color: currentColor,
            fontWeight: isFocused ? "600" : "400",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  onStampPress,
}: FloatingTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Stamp button press animation (Reanimated)
  const stampScale = useSharedValue(1);
  const stampRotation = useSharedValue(0);

  const stampAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: stampScale.value },
      { rotate: `${stampRotation.value}deg` },
    ],
  }));

  function handleStampPressIn() {
    stampScale.value = withSpring(0.88, SPRING_SNAPPY);
  }

  function handleStampPressOut() {
    stampScale.value = withSpring(1, SPRING_BOUNCY);
  }

  function handleStampPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    stampRotation.value = withSequence(
      withTiming(90, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    onStampPress?.();
  }

  // Split routes into left/right around the center button
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  function renderTab(routeIndex: number) {
    const route = state.routes[routeIndex];
    const { options } = descriptors[route.key];
    const isFocused = state.index === routeIndex;
    const label = (options.title ?? route.name) as string;
    const IconComponent = ROUTE_ICONS[route.name] ?? Home;

    function onPress() {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    }

    function onLongPress() {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    }

    return (
      <TabButton
        key={route.key}
        icon={IconComponent}
        label={label}
        isFocused={isFocused}
        color={colors.mutedForeground}
        focusedColor={colors.primary}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  }

  // Bottom padding: safe area inset (for home indicator) or fallback
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPadding }]}>
      {/* Translucent background */}
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        >
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: isDark
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.72)",
              },
            ]}
          />
        </BlurView>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? "rgba(15,15,20,0.96)"
                : "rgba(255,255,255,0.97)",
            },
          ]}
        />
      )}

      {/* Top separator line */}
      <View
        style={[
          styles.separator,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)",
          },
        ]}
      />

      {/* Tab row */}
      <View style={styles.row}>
        {leftRoutes.map((_, i) => renderTab(i))}

        {/* Center stamp button */}
        <View style={styles.centerSlot}>
          <Animated.View style={stampAnimStyle}>
            <Pressable
              onPress={handleStampPress}
              onPressIn={handleStampPressIn}
              onPressOut={handleStampPressOut}
              style={[
                styles.stampBtn,
                {
                  backgroundColor: colors.primary,
                  ...(Platform.OS === "ios"
                    ? {
                        shadowColor: colors.primary,
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                      }
                    : { elevation: 8 }),
                },
              ]}
            >
              <Plus size={22} color="#ffffff" strokeWidth={2.4} />
            </Pressable>
          </Animated.View>
        </View>

        {rightRoutes.map((_, i) => renderTab(i + 2))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    // Edge-attached — no absolute positioning, no margin, no border-radius
    // This sits at the natural bottom of the Tabs layout
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    height: 50,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  centerSlot: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  stampBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
