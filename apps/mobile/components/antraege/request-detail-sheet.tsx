import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import {
  Calendar,
  Thermometer,
  Home,
  Clock,
  Ban,
  X,
  CheckCircle2,
  XCircle,
  CircleDot,
  Undo2,
  RotateCcw,
  RefreshCw,
} from "lucide-react-native";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";
import { useTheme } from "@/lib/theme";
import type { AppRequest } from "@/lib/types";

const TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ size: number; color: string }>; color: string; label: string }
> = {
  VACATION:        { icon: Calendar,    color: "#3b82f6", label: "Urlaub" },
  SICK:            { icon: Thermometer, color: "#ef4444", label: "Krankmeldung" },
  HOMEOFFICE:      { icon: Home,        color: "#8b5cf6", label: "Homeoffice" },
  TIME_CORRECTION: { icon: Clock,       color: "#eab308", label: "Zeitkorrektur" },
  OVERTIME_REDUCE: { icon: Clock,       color: "#22c55e", label: "Ueberstundenabbau" },
  SPECIAL_LEAVE:   { icon: Calendar,    color: "#06b6d4", label: "Sonderurlaub" },
  CANCEL_VACATION: { icon: Ban,         color: "#ef4444", label: "Urlaubsstornierung" },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Offen",
  APPROVED: "Genehmigt",
  REJECTED: "Abgelehnt",
  CANCELLED: "Storniert",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
  );
}

export interface RequestDetailSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  request: AppRequest | null;
  onWithdraw?: (r: AppRequest) => void;
  onCancel?: (r: AppRequest) => void;
  onReschedule?: (r: AppRequest) => void;
}

export function RequestDetailSheet({
  bottomSheetRef,
  request,
  onWithdraw,
  onCancel,
  onReschedule,
}: RequestDetailSheetProps) {
  const { colors } = useTheme();

  if (!request) return null;

  const typeConf = TYPE_CONFIG[request.type] ?? TYPE_CONFIG.VACATION;
  const Icon = typeConf.icon;
  const statusColor = STATUS_COLORS[request.status] ?? "#6b7280";
  const sameDay =
    new Date(request.dateFrom).toDateString() === new Date(request.dateTo).toDateString();

  const showWithdraw = request.status === "PENDING" && request.type !== "CANCEL_VACATION" && !!onWithdraw;
  const showCancelReschedule =
    request.status === "APPROVED" &&
    (request.type === "VACATION" || request.type === "HOMEOFFICE" || request.type === "SPECIAL_LEAVE");

  function close() {
    bottomSheetRef.current?.dismiss();
  }

  // ---- Timeline events ----
  const events: Array<{
    icon: React.ComponentType<{ size: number; color: string }>;
    color: string;
    label: string;
    meta: string;
  }> = [
    {
      icon: CircleDot,
      color: colors.primary,
      label: "Eingereicht",
      meta: fmtDateTime(request.createdAt),
    },
  ];

  const approvals = request.approvals ?? [];
  for (const a of approvals) {
    const isApproved = a.status === "APPROVED";
    events.push({
      icon: isApproved ? CheckCircle2 : XCircle,
      color: isApproved ? "#22c55e" : "#ef4444",
      label: `${isApproved ? "Genehmigt" : "Abgelehnt"}${a.approver?.name ? ` von ${a.approver.name}` : ""}`,
      meta: a.decidedAt ? fmtDateTime(a.decidedAt) : "",
    });
  }

  if (request.status === "CANCELLED" && !approvals.some((a) => a.status === "REJECTED")) {
    events.push({
      icon: Ban,
      color: "#6b7280",
      label: "Storniert",
      meta: "",
    });
  }

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={0.82}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${typeConf.color}22` }]}>
            <Icon size={22} color={typeConf.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.typeLabel, { color: colors.foreground }]}>
              {typeConf.label}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>
                {STATUS_LABELS[request.status] ?? request.status}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={close} hitSlop={10} style={styles.closeBtn}>
            <X size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Date range */}
        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
            {sameDay ? "DATUM" : "ZEITRAUM"}
          </Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {sameDay ? fmtDate(request.dateFrom) : `${fmtDate(request.dateFrom)}\nbis ${fmtDate(request.dateTo)}`}
          </Text>
        </View>

        {/* Note */}
        {request.note ? (
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>NOTIZ</Text>
            <Text style={[styles.infoValue, { color: colors.foreground, fontSize: 14 }]}>
              {request.note}
            </Text>
          </View>
        ) : null}

        {/* Timeline */}
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>VERLAUF</Text>
        <View style={[styles.timelineCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
          {events.map((ev, i) => {
            const EventIcon = ev.icon;
            const isLast = i === events.length - 1;
            return (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineIconCol}>
                  <View style={[styles.timelineIconCircle, { backgroundColor: `${ev.color}22` }]}>
                    <EventIcon size={14} color={ev.color} />
                  </View>
                  {!isLast ? (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: colors.foreground }]}>
                    {ev.label}
                  </Text>
                  {ev.meta ? (
                    <Text style={[styles.timelineMeta, { color: colors.mutedForeground }]}>
                      {ev.meta}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Actions */}
        {(showWithdraw || showCancelReschedule) && (
          <View style={styles.actionSection}>
            {showWithdraw && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: "#ef444440" }]}
                onPress={() => {
                  close();
                  onWithdraw?.(request);
                }}
                activeOpacity={0.7}
              >
                <Undo2 size={16} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                  Antrag zurueckziehen
                </Text>
              </TouchableOpacity>
            )}
            {showCancelReschedule && onCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: "#ef444440" }]}
                onPress={() => {
                  close();
                  onCancel(request);
                }}
                activeOpacity={0.7}
              >
                <RotateCcw size={16} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                  Stornieren
                </Text>
              </TouchableOpacity>
            )}
            {showCancelReschedule && onReschedule && (
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: "#3b82f640" }]}
                onPress={() => {
                  close();
                  onReschedule(request);
                }}
                activeOpacity={0.7}
              >
                <RefreshCw size={16} color="#3b82f6" />
                <Text style={[styles.actionBtnText, { color: "#3b82f6" }]}>
                  Umplanen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SimpleBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  closeBtn: {
    padding: 6,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  timelineCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineIconCol: {
    alignItems: "center",
    width: 24,
  },
  timelineIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    minHeight: 20,
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 18,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  timelineMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  actionSection: {
    marginTop: 20,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
