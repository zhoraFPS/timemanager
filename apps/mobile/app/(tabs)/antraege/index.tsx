import { useCallback, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { AppEvents, useAppEvent } from "@/lib/events";
import { Plus, Inbox, CheckCircle2, XCircle, Ban } from "lucide-react-native";
import type { BottomSheetHandle } from "@/components/ui/bottom-sheet";
import { useTheme } from "@/lib/theme";
import { getRequests, createRequest } from "@/lib/api";
import type { AppRequest } from "@/lib/types";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassSegment } from "@/components/ui/glass-segment";
import { RequestGlassCard } from "@/components/antraege/request-glass-card";
import { NewRequestSheet } from "@/components/antraege/new-request-sheet";
import { CancelConfirmSheet } from "@/components/antraege/cancel-confirm-sheet";
import { RequestDetailSheet } from "@/components/antraege/request-detail-sheet";
import { AuroraBackground } from "@/components/ui/background/aurora-background";
import { EmptyState } from "@/components/ui/empty-state";
import { IOSHeader } from "@/components/ui/ios-header";
import { useEntranceAnimation, staggerDelay } from "@/lib/motion";

const EMPTY_META = [
  {
    icon: Inbox,
    title: "Keine offenen Anträge",
    description:
      "Du hast derzeit keine ausstehenden Anträge. Stelle einen neuen Antrag für Urlaub oder Krankmeldung.",
  },
  {
    icon: CheckCircle2,
    title: "Keine genehmigten Anträge",
    description: "Hier erscheinen alle genehmigten Anträge der letzten Zeit.",
  },
  {
    icon: XCircle,
    title: "Keine abgelehnten Anträge",
    description: "Alles gut — keine Ablehnungen in deiner Historie.",
  },
  {
    icon: Ban,
    title: "Keine stornierten Anträge",
    description: "Hier landen Anträge, die du oder dein Vorgesetzter storniert hat.",
  },
];

interface AnimatedRequestRowProps {
  request: AppRequest;
  index: number;
  onWithdraw: (r: AppRequest) => void;
  onCancel: (r: AppRequest) => void;
  onReschedule: (r: AppRequest) => void;
  onPress: (r: AppRequest) => void;
}

function AnimatedRequestRow({
  request,
  index,
  onWithdraw,
  onCancel,
  onReschedule,
  onPress,
}: AnimatedRequestRowProps) {
  const style = useEntranceAnimation(staggerDelay(index, 50, 45));
  return (
    <Animated.View style={[{ opacity: 0 }, style]}>
      <RequestGlassCard
        request={request}
        onWithdraw={onWithdraw}
        onCancel={onCancel}
        onReschedule={onReschedule}
        onPress={onPress}
      />
    </Animated.View>
  );
}

const SEGMENTS = ["Offen", "Genehmigt", "Abgelehnt", "Storniert"];
const STATUS_MAP: Record<number, string> = {
  0: "PENDING",
  1: "APPROVED",
  2: "REJECTED",
  3: "CANCELLED",
};
export default function AntraegeScreen() {
  const { colors } = useTheme();
  const [requests, setRequests] = useState<AppRequest[]>([]);
  const [segment, setSegment] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Selected request for cancellation flow
  const [targetRequest, setTargetRequest] = useState<AppRequest | null>(null);

  const newSheetRef = useRef<BottomSheetHandle>(null);
  const cancelSheetRef = useRef<BottomSheetHandle>(null);
  const detailSheetRef = useRef<BottomSheetHandle>(null);
  const [detailRequest, setDetailRequest] = useState<AppRequest | null>(null);

  // Pre-filled dates for "Umplanen" flow
  const [rescheduleFrom, setRescheduleFrom] = useState<Date | undefined>();
  const [rescheduleTo, setRescheduleTo] = useState<Date | undefined>();

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, []),
  );

  useAppEvent("request", loadRequests);

  async function loadRequests() {
    try {
      const data = await getRequests();
      if (Array.isArray(data)) setRequests(data);
    } catch {
      /* silent */
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }

  async function handleSubmit(data: {
    type: string;
    dateFrom: string;
    dateTo: string;
    note?: string;
  }) {
    try {
      await createRequest(data);
      newSheetRef.current?.dismiss();
      AppEvents.emit("request");
    } catch (e) {
      console.error("Create request failed:", e);
    }
  }

  function handleWithdraw(req: AppRequest) {
    setTargetRequest(req);
    cancelSheetRef.current?.present();
  }

  function handleCancel(req: AppRequest) {
    setTargetRequest(req);
    cancelSheetRef.current?.present();
  }

  function handleOpenDetail(req: AppRequest) {
    setDetailRequest(req);
    detailSheetRef.current?.present();
  }

  function handleReschedule(req: AppRequest) {
    // Open CancelConfirmSheet first, then on done open new request sheet
    // We signal "reschedule mode" by setting rescheduleFrom/To
    setTargetRequest(req);
    setRescheduleFrom(new Date(req.dateFrom));
    setRescheduleTo(new Date(req.dateTo));
    cancelSheetRef.current?.present();
  }

  function handleCancelDone() {
    loadRequests();
    AppEvents.emit("request");
    // If rescheduling, open the new-request sheet after a brief delay
    if (rescheduleFrom) {
      setTimeout(() => {
        newSheetRef.current?.present();
      }, 400);
    }
    setRescheduleFrom(undefined);
    setRescheduleTo(undefined);
    setTargetRequest(null);
  }

  // Filter — show CANCEL_VACATION requests inside "Offen" tab if PENDING,
  // otherwise inside "Storniert" tab
  const filtered = requests.filter((r) => {
    const target = STATUS_MAP[segment];
    if (target === "PENDING") return r.status === "PENDING";
    if (target === "APPROVED") return r.status === "APPROVED";
    if (target === "REJECTED") return r.status === "REJECTED";
    if (target === "CANCELLED") return r.status === "CANCELLED";
    return false;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const segmentLabels = [
    `Offen${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
    "Genehmigt",
    "Abgelehnt",
    "Storniert",
  ];

  const segmentStyle = useEntranceAnimation(staggerDelay(0, 80));

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<AppRequest>);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AuroraBackground intensity="subtle" blurIntensity={100} showGrain={false} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* iOS collapsing large title header */}
        <IOSHeader
          title="Anträge"
          scrollY={scrollY}
          rightAction={
            <GlassButton
              variant="gradient"
              onPress={() => {
                setRescheduleFrom(undefined);
                setRescheduleTo(undefined);
                newSheetRef.current?.present();
              }}
              style={{ borderRadius: 12 }}
            >
              <View style={styles.addBtnContent}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnText}>Neu</Text>
              </View>
            </GlassButton>
          }
        />

        {/* Segmented control */}
        <Animated.View style={[{ opacity: 0 }, styles.segmentWrap, segmentStyle]}>
          <GlassSegment
            segments={segmentLabels}
            active={segment}
            onChange={setSegment}
          />
        </Animated.View>

        {/* Request list */}
        <AnimatedFlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <AnimatedRequestRow
              request={item}
              index={index}
              onWithdraw={handleWithdraw}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
              onPress={handleOpenDetail}
            />
          )}
          contentContainerStyle={styles.list}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={EMPTY_META[segment].icon}
              title={EMPTY_META[segment].title}
              description={EMPTY_META[segment].description}
              action={
                segment === 0 ? (
                  <GlassButton
                    variant="gradient"
                    onPress={() => newSheetRef.current?.present()}
                  >
                    <Text style={styles.addBtnText}>Antrag stellen</Text>
                  </GlassButton>
                ) : undefined
              }
            />
          }
        />
      </SafeAreaView>

      {/* Sheets */}
      <NewRequestSheet
        bottomSheetRef={newSheetRef}
        onSubmit={handleSubmit}
      />
      <CancelConfirmSheet
        bottomSheetRef={cancelSheetRef}
        request={targetRequest}
        onDone={handleCancelDone}
      />
      <RequestDetailSheet
        bottomSheetRef={detailSheetRef}
        request={detailRequest}
        onWithdraw={handleWithdraw}
        onCancel={handleCancel}
        onReschedule={handleReschedule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtnContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  segmentWrap: { paddingHorizontal: 20, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
});
