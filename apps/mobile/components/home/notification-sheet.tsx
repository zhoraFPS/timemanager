import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";
import {
  CheckCircle,
  XCircle,
  Clock,
  Bell,
  Info,
  ChevronRight,
  CheckCheck,
  Calendar,
  FileEdit,
  Timer,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { SimpleBottomSheet, type BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useTheme } from "@/lib/theme";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

// ---------------------------------------------------------------------------
// Public handle
// ---------------------------------------------------------------------------

export interface NotificationSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface NotificationSheetProps {
  onRead?: () => void;
}

// ---------------------------------------------------------------------------
// Type → visual meta
// ---------------------------------------------------------------------------

interface NotifMeta {
  accent: string;
  label: string;
  route: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

function getMeta(type: string): NotifMeta {
  switch (type) {
    case "REQUEST_APPROVED":
      return { accent: "#22c55e", label: "Genehmigt", route: "/(tabs)/antraege", Icon: CheckCircle };
    case "REQUEST_REJECTED":
      return { accent: "#ef4444", label: "Abgelehnt", route: "/(tabs)/antraege", Icon: XCircle };
    case "REQUEST_PENDING":
    case "NEW_REQUEST":
      return { accent: "#f59e0b", label: "Neuer Antrag", route: "/(tabs)/antraege", Icon: Clock };
    case "TIME_CORRECTION":
    case "MISSING_ENTRY":
      return { accent: "#3b82f6", label: "Zeitkorrektur", route: "/(tabs)/zeiten", Icon: FileEdit };
    case "STAMP_REMINDER":
      return { accent: "#8b5cf6", label: "Stempelung", route: "/(tabs)/zeiten", Icon: Timer };
    case "VACATION_REMINDER":
      return { accent: "#06b6d4", label: "Urlaub", route: "/(tabs)/antraege", Icon: Calendar };
    default:
      return { accent: "#6b7280", label: "Info", route: "/(tabs)/", Icon: Info };
  }
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(dateStr).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function NotificationRow({
  item,
  colors,
  onPress,
}: {
  item: AppNotification;
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: (item: AppNotification) => void;
}) {
  const meta = getMeta(item.type);
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(item)}
        style={[
          styles.row,
          { borderBottomColor: colors.border },
          !item.isRead && { backgroundColor: meta.accent + "0d" },
        ]}
      >
        {/* Unread stripe */}
        {!item.isRead && (
          <View style={[styles.stripe, { backgroundColor: meta.accent }]} />
        )}

        {/* Icon bubble */}
        <View style={[styles.iconBubble, { backgroundColor: meta.accent + "20" }]}>
          <meta.Icon size={20} color={meta.accent} />
        </View>

        {/* Text block */}
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground },
                !item.isRead && styles.titleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {/* Type pill */}
            <View style={[styles.pill, { backgroundColor: meta.accent + "22" }]}>
              <Text style={[styles.pillText, { color: meta.accent }]}>{meta.label}</Text>
            </View>
          </View>

          <Text
            style={[styles.body, { color: colors.mutedForeground }]}
            numberOfLines={3}
          >
            {item.body}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {timeAgo(item.createdAt)}
              {item.sender?.name ? ` · ${item.sender.name}` : ""}
            </Text>
            {!item.isRead && (
              <View style={[styles.unreadDot, { backgroundColor: meta.accent }]} />
            )}
          </View>
        </View>

        {/* Chevron */}
        <ChevronRight size={16} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ colors }: { colors: ReturnType<typeof useTheme>["colors"] }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Bell size={32} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Alles erledigt
      </Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        Du hast keine neuen Benachrichtigungen.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export const NotificationSheet = forwardRef<NotificationSheetHandle, NotificationSheetProps>(
  function NotificationSheet({ onRead }, ref) {
    const { colors } = useTheme();
    const router = useRouter();
    const sheetRef = useRef<BottomSheetHandle>(null);
    const [items, setItems] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
      setLoading(true);
      try {
        const data = await getNotifications(40);
        setItems(data);
        onRead?.();
      } catch {
        /* silent */
      } finally {
        setLoading(false);
      }
    }, [onRead]);

    useImperativeHandle(ref, () => ({
      present() {
        sheetRef.current?.present();
        load();
      },
      dismiss() {
        sheetRef.current?.dismiss();
      },
    }));

    async function handleMarkAllRead() {
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await markAllNotificationsRead().catch(() => {});
      onRead?.();
    }

    async function handleRowPress(item: AppNotification) {
      // 1. Mark as read locally + on backend
      if (!item.isRead) {
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        markNotificationRead(item.id).catch(() => {});
      }

      // 2. Dismiss sheet
      sheetRef.current?.dismiss();

      // 3. Navigate after a short delay so the dismiss animation plays
      const route = getMeta(item.type).route;
      setTimeout(() => {
        router.push(route as any);
      }, 280);
    }

    const unread = items.filter((n) => !n.isRead).length;

    return (
      <SimpleBottomSheet ref={sheetRef} snapFraction={0.88}>
        {/* ---- Header ---- */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Benachrichtigungen
            </Text>
            {unread > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.countBadgeText}>{unread}</Text>
              </View>
            )}
          </View>
          {unread > 0 && (
            <TouchableOpacity
              style={[styles.markAllBtn, { borderColor: colors.border }]}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <CheckCheck size={14} color={colors.primary} />
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Alle gelesen
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ---- Content ---- */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : items.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Section: Ungelesen */}
            {unread > 0 && (
              <>
                <SectionLabel label="Neu" colors={colors} />
                {items
                  .filter((n) => !n.isRead)
                  .map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      colors={colors}
                      onPress={handleRowPress}
                    />
                  ))}
              </>
            )}

            {/* Section: Gelesen */}
            {items.some((n) => n.isRead) && (
              <>
                <SectionLabel label="Früher" colors={colors} />
                {items
                  .filter((n) => n.isRead)
                  .map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      colors={colors}
                      onPress={handleRowPress}
                    />
                  ))}
              </>
            )}
          </ScrollView>
        )}
      </SimpleBottomSheet>
    );
  }
);

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
      {label}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  countBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Loading / empty
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingLeft: 24,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
    position: "relative",
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  titleUnread: {
    fontWeight: "700",
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
