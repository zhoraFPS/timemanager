import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
  eachDayOfInterval,
  isSameDay,
  isToday,
} from "date-fns";
import { de } from "date-fns/locale";
import { useTheme } from "@/lib/theme";

interface WeekDaySelectorProps {
  weekOffset: number;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onWeekChange: (offset: number) => void;
  entriesByDay: Record<string, boolean>;
}

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function WeekDaySelector({
  weekOffset,
  selectedDate,
  onSelectDate,
  onWeekChange,
  entriesByDay,
}: WeekDaySelectorProps) {
  const { colors } = useTheme();

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weekLabel = `${format(weekStart, "d.", { locale: de })} \u2013 ${format(weekEnd, "d. MMMM yyyy", { locale: de })}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => onWeekChange(weekOffset - 1)}
          style={styles.chevron}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.weekLabel, { color: colors.foreground }]}>
          {weekLabel}
        </Text>
        <TouchableOpacity
          onPress={() => onWeekChange(weekOffset + 1)}
          style={styles.chevron}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronRight size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.daysRow}>
        {days.map((day, index) => {
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);
          const key = format(day, "yyyy-MM-dd");
          const hasEntries = entriesByDay[key] ?? false;

          return (
            <TouchableOpacity
              key={key}
              style={styles.dayColumn}
              onPress={() => onSelectDate(day)}
              activeOpacity={0.6}
            >
              <Text
                style={[styles.dayLabel, { color: colors.mutedForeground }]}
              >
                {DAY_LABELS[index]}
              </Text>
              <View
                style={[
                  styles.dayCircle,
                  selected && { backgroundColor: colors.primary },
                  !selected &&
                    today && {
                      borderWidth: 2,
                      borderColor: colors.primary,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: selected
                        ? "#ffffff"
                        : today
                          ? colors.primary
                          : colors.foreground,
                    },
                  ]}
                >
                  {format(day, "d")}
                </Text>
              </View>
              {hasEntries && (
                <View
                  style={[styles.dot, { backgroundColor: colors.primary }]}
                />
              )}
              {!hasEntries && <View style={styles.dotPlaceholder} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chevron: {
    padding: 4,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayColumn: {
    alignItems: "center",
    flex: 1,
  },
  dayLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  dotPlaceholder: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
});
