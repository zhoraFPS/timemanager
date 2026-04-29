import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/lib/theme";
import { STAMP_TYPES } from "@/lib/stamp-types";
import { GlassButton } from "@/components/ui/glass-button";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";
import type { TimeEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StampSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  activeEntry: TimeEntry | null;
  onStampIn: (type: string) => void;
  onStampOut: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${padTwo(h)}:${padTwo(m)}:${padTwo(s)}`;
}

function formatClockIn(date: Date): string {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())} Uhr`;
}

// ---------------------------------------------------------------------------
// TypeTile — single stamp type button
// ---------------------------------------------------------------------------

interface TypeTileProps {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  active: boolean;
  onPress: () => void;
}

function TypeTile({ label, icon: Icon, color, active, onPress }: TypeTileProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }

  function handlePress() {
    Haptics.selectionAsync();
    onPress();
  }

  const tileStyle = {
    backgroundColor: active ? color : colors.glassBackground,
    borderColor: active ? color : colors.glassBorder,
    shadowColor: active ? color : "transparent",
    shadowOpacity: active ? 0.45 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: active ? 6 : 0,
  };

  return (
    <Animated.View style={[styles.tileWrapper, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.tile, tileStyle]}
      >
        <Icon size={28} color={active ? "#fff" : color} />
        <Text
          style={[
            styles.tileLabel,
            { color: active ? "#fff" : colors.mutedForeground },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StampSheet({
  bottomSheetRef,
  activeEntry,
  onStampIn,
  onStampOut,
}: StampSheetProps) {
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const [switching, setSwitching] = useState(false);

  // Live timer
  useEffect(() => {
    if (!activeEntry) {
      setElapsed(0);
      return;
    }
    function tick() {
      const start = new Date(activeEntry!.clockIn).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  const activeType = activeEntry
    ? STAMP_TYPES.find((t) => t.key === activeEntry.type) ?? STAMP_TYPES[0]
    : null;

  // ---- Handle type tap ----

  async function handleTypeTap(typeKey: string) {
    if (activeEntry && typeKey === activeEntry.type) {
      // Already this type — no-op
      return;
    }
    setSwitching(true);
    await onStampIn(typeKey);
    setSwitching(false);
    if (!activeEntry) {
      // First stamp-in → close sheet
      bottomSheetRef.current?.dismiss();
    }
  }

  // ---- Type grid ----

  function renderTypeGrid() {
    // Split into rows of 4
    const rows: (typeof STAMP_TYPES)[] = [];
    for (let i = 0; i < STAMP_TYPES.length; i += 4) {
      rows.push(STAMP_TYPES.slice(i, i + 4));
    }

    return (
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((t) => (
              <TypeTile
                key={t.key}
                label={t.label}
                icon={t.icon}
                color={t.color}
                active={!!activeEntry && activeEntry.type === t.key}
                onPress={() => handleTypeTap(t.key)}
              />
            ))}
            {/* Fill empty slots in the last row */}
            {row.length < 4 &&
              Array.from({ length: 4 - row.length }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.tileWrapper} />
              ))}
          </View>
        ))}
      </View>
    );
  }

  // ---- Render ----

  const isActive = !!activeEntry;

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={isActive ? 0.72 : 0.62}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* ── Header ── */}
        {isActive ? (
          <View style={styles.activeHeader}>
            {/* Status pill */}
            <View style={[styles.statusPill, { backgroundColor: `${activeType?.color ?? colors.primary}22`, borderColor: activeType?.color ?? colors.primary }]}>
              <View style={[styles.activeDot, { backgroundColor: activeType?.color ?? colors.primary }]} />
              <Text style={[styles.statusText, { color: activeType?.color ?? colors.primary }]}>
                Aktiv seit {activeEntry ? formatClockIn(new Date(activeEntry.clockIn)) : "--:--"}
              </Text>
            </View>

            {/* Live timer */}
            <Text style={[styles.timer, { color: colors.foreground }]}>
              {formatElapsed(elapsed)}
            </Text>
          </View>
        ) : (
          <View style={styles.idleHeader}>
            <Text style={[styles.idleTitle, { color: colors.foreground }]}>
              Wie kommst du heute?
            </Text>
            <Text style={[styles.idleSubtitle, { color: colors.mutedForeground }]}>
              Tippe auf deinen Arbeitsmodus
            </Text>
          </View>
        )}

        {/* ── Type switch hint (only when active) ── */}
        {isActive && (
          <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>
            {switching ? "Wechsle Modus…" : "Modus wechseln — tippe eine andere Kachel"}
          </Text>
        )}

        {/* ── Type grid ── */}
        {renderTypeGrid()}

        {/* ── Clock-out button ── */}
        {isActive && (
          <GlassButton
            variant="destructive"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onStampOut();
              bottomSheetRef.current?.dismiss();
            }}
            style={styles.clockOutBtn}
          >
            <Text style={[styles.clockOutText, { color: colors.destructive }]}>
              Ausstempeln
            </Text>
          </GlassButton>
        )}
      </ScrollView>
    </SimpleBottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // ── Active header ──
  activeHeader: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  timer: {
    fontSize: 52,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    letterSpacing: 3,
  },

  // ── Idle header ──
  idleHeader: {
    paddingTop: 4,
    paddingBottom: 16,
  },
  idleTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  idleSubtitle: {
    fontSize: 14,
  },

  // ── Switch hint ──
  switchHint: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: "center",
  },

  // ── Type grid ──
  grid: {
    gap: 8,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  tileWrapper: {
    flex: 1,
  },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    // aspectRatio forces every tile to be a perfect square —
    // no matter how long the label is, all tiles stay identical size.
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 6,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },

  // ── Clock-out ──
  clockOutBtn: {
    marginBottom: 8,
  },
  clockOutText: {
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 4,
  },
});
