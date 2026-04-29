import { useCallback, useRef, useState } from "react";
import { ScrollView, View, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";
import { useAppEvent } from "@/lib/events";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { useAuthStore } from "@/lib/store";
import {
  getActiveEntry,
  getFlextime,
  getTeamMembers,
  getUnreadNotificationCount,
} from "@/lib/api";
import type { TimeEntry, FlexData, TeamMember } from "@/lib/types";
import { GreetingHeader } from "@/components/home/greeting-header";
import { ShiftCard } from "@/components/home/shift-card";
import { FlextimeCard } from "@/components/home/flextime-card";
import { TeamStatusCard } from "@/components/home/team-status-card";
import {
  NotificationSheet,
  type NotificationSheetHandle,
} from "@/components/home/notification-sheet";
import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { useEntranceAnimation, staggerDelay } from "@/lib/motion";

export default function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [flexData, setFlexData] = useState<FlexData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationSheetRef = useRef<NotificationSheetHandle>(null);

  // Staggered entrance for each card
  const shiftEntrance = useEntranceAnimation(staggerDelay(1, 100));
  const flextimeEntrance = useEntranceAnimation(staggerDelay(2, 100));
  const teamEntrance = useEntranceAnimation(staggerDelay(3, 100));

  const loadData = useCallback(async () => {
    const [entry, flex, team, unread] = await Promise.allSettled([
      getActiveEntry(),
      getFlextime(4),
      getTeamMembers(),
      getUnreadNotificationCount(),
    ]);
    if (entry.status === "fulfilled") setActiveEntry(entry.value);
    if (flex.status === "fulfilled" && flex.value) setFlexData(flex.value);
    if (team.status === "fulfilled" && Array.isArray(team.value))
      setMembers(team.value);
    if (unread.status === "fulfilled") setUnreadCount(unread.value);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Reload instantly after any stamp action (even while screen is focused)
  useAppEvent("stamp", loadData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const firstName = user?.name?.split(" ")[0] ?? "Hallo";
  const months = flexData?.months ?? [];
  const currentSaldo =
    months.length > 0 ? months[months.length - 1].cumulativeMins : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Subtle aurora — less intense than login to not distract from content */}
      <AuroraBackground intensity="subtle" blurIntensity={100} showGrain={false} />

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <GreetingHeader
            name={firstName}
            notificationCount={unreadCount}
            onBellPress={() => notificationSheetRef.current?.present()}
          />
          <Animated.View style={[{ opacity: 0 }, shiftEntrance]}>
            <ShiftCard activeEntry={activeEntry} />
          </Animated.View>
          <Animated.View style={[{ opacity: 0 }, flextimeEntrance]}>
            <FlextimeCard saldoMinutes={currentSaldo} months={months} />
          </Animated.View>
          <Animated.View style={[{ opacity: 0 }, teamEntrance]}>
            <TeamStatusCard members={members} />
          </Animated.View>
          {/* Bottom padding for tab bar */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>

      <NotificationSheet
        ref={notificationSheetRef}
        onRead={() => setUnreadCount(0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
});
