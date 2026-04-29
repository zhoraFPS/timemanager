import { useCallback, useRef, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAppEvent } from "@/lib/events";
import {
  startOfWeek,
  addWeeks,
  format,
  eachDayOfInterval,
  endOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { useTheme } from "@/lib/theme";
import { getWeekEntries } from "@/lib/api";
import type { TimeEntry } from "@/lib/types";
import type { BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { WeekDaySelector } from "@/components/zeiten/week-day-selector";
import { WeekSummaryCard } from "@/components/zeiten/week-summary-card";
import { DayTimeline } from "@/components/zeiten/day-timeline";
import { EntryCard } from "@/components/zeiten/entry-card";
import { EntryEditSheet } from "@/components/zeiten/entry-edit-sheet";
import { NewEntrySheet } from "@/components/zeiten/new-entry-sheet";
import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { EmptyState } from "@/components/ui/empty-state";
import { useEntranceAnimation, staggerDelay } from "@/lib/motion";
import { CalendarX } from "lucide-react-native";

interface AnimatedEntryRowProps {
  entry: TimeEntry;
  index: number;
  onEditPress: () => void;
}

function AnimatedEntryRow({ entry, index, onEditPress }: AnimatedEntryRowProps) {
  const style = useEntranceAnimation(staggerDelay(4 + index, 60, 50));
  return (
    <Animated.View style={[{ opacity: 0 }, style]}>
      <EntryCard entry={entry} onEditPress={onEditPress} />
    </Animated.View>
  );
}

export default function ZeitenScreen() {
  const { colors } = useTheme();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const editSheetRef = useRef<BottomSheetHandle>(null);
  const newEntrySheetRef = useRef<BottomSheetHandle>(null);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useFocusEffect(
    useCallback(() => {
      loadWeek();
    }, [weekOffset])
  );

  // Reload instantly after any stamp action (even while screen is focused)
  useAppEvent("stamp", loadWeek);

  async function loadWeek() {
    try {
      const data = await getWeekEntries(weekStart.toISOString());
      if (Array.isArray(data)) setEntries(data);
    } catch {
      /* silent */
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadWeek();
    setRefreshing(false);
  }

  // Before opening the edit sheet, refresh the entry from the server so the
  // form doesn't show stale values (e.g. after an HR edit on the web).
  async function openEditWithFresh(entry: TimeEntry) {
    try {
      const fresh = await getWeekEntries(weekStart.toISOString());
      if (Array.isArray(fresh)) {
        setEntries(fresh);
        const freshEntry = fresh.find((e) => e.id === entry.id);
        setEditEntry(freshEntry ?? entry);
      } else {
        setEditEntry(entry);
      }
    } catch {
      setEditEntry(entry);
    }
    editSheetRef.current?.present();
  }

  // Build entriesByDay lookup for the day selector dots
  const entriesByDay: Record<string, boolean> = {};
  for (const day of days) {
    const key = format(day, "yyyy-MM-dd");
    entriesByDay[key] = entries.some(
      (e) => format(new Date(e.clockIn), "yyyy-MM-dd") === key
    );
  }

  // Filter entries for selected day
  const selectedDayStr = format(selectedDate, "yyyy-MM-dd");
  const dayEntries = entries.filter(
    (e) => format(new Date(e.clockIn), "yyyy-MM-dd") === selectedDayStr
  );

  // Week totals
  const totalActual = entries.reduce((sum, e) => {
    if (!e.clockOut) return sum;
    return (
      sum +
      (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) /
        3600000
    );
  }, 0);
  const workingDays = days.filter(
    (d) => d.getDay() !== 0 && d.getDay() !== 6
  ).length;
  const totalTarget = workingDays * 8;

  // Format selected day as headline
  const dayHeadline = format(selectedDate, "EEEE, d. MMMM", { locale: de });
  const dayHeadlineCap =
    dayHeadline.charAt(0).toUpperCase() + dayHeadline.slice(1);

  // Entrance animations for sections
  const selectorStyle = useEntranceAnimation(staggerDelay(0, 80));
  const summaryStyle = useEntranceAnimation(staggerDelay(1, 80));
  const dayHeaderStyle = useEntranceAnimation(staggerDelay(2, 80));
  const timelineStyle = useEntranceAnimation(staggerDelay(3, 80));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground intensity="subtle" blurIntensity={100} showGrain={false} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <Animated.View style={[{ opacity: 0 }, selectorStyle]}>
          <WeekDaySelector
            weekOffset={weekOffset}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onWeekChange={setWeekOffset}
            entriesByDay={entriesByDay}
          />
        </Animated.View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Animated.View style={[{ opacity: 0 }, summaryStyle]}>
            <WeekSummaryCard
              actualHours={totalActual}
              targetHours={totalTarget}
            />
          </Animated.View>
          <Animated.View style={[{ opacity: 0 }, styles.dayHeadlineRow, dayHeaderStyle]}>
            <Text style={[styles.dayHeadline, { color: colors.foreground }]}>
              {dayHeadlineCap}
            </Text>
            <Pressable
              onPress={() => newEntrySheetRef.current?.present()}
              style={[styles.addBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }]}
              hitSlop={8}
            >
              <Text style={[styles.addBtnText, { color: colors.primary }]}>+ Nachtragen</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[{ opacity: 0 }, timelineStyle]}>
            <DayTimeline entries={dayEntries} />
          </Animated.View>
          {dayEntries.length === 0 ? (
            <EmptyState
              icon={CalendarX}
              title="Keine Einträge"
              description="Für diesen Tag sind keine Zeiterfassungen vorhanden. Stempele dich über den + Button ein oder trage einen Eintrag nach."
            />
          ) : (
            dayEntries.map((entry, idx) => (
              <AnimatedEntryRow
                key={entry.id}
                entry={entry}
                index={idx}
                onEditPress={() => openEditWithFresh(entry)}
              />
            ))
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <EntryEditSheet
        bottomSheetRef={editSheetRef}
        entry={editEntry}
        onDismiss={() => setEditEntry(null)}
      />
      <NewEntrySheet
        bottomSheetRef={newEntrySheetRef}
        date={selectedDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  dayHeadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 12,
  },
  dayHeadline: {
    fontSize: 18,
    fontWeight: "700",
  },
  addBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 20,
  },
});
