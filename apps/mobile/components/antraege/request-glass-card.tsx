import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Calendar,
  Thermometer,
  Home,
  Clock,
  RotateCcw,
  Undo2,
  RefreshCw,
  Ban,
} from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { GlassCard } from "@/components/ui/glass-card";
import type { AppRequest } from "@/lib/types";

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ size: number; color: string }>; color: string; label: string }
> = {
  VACATION:         { icon: Calendar,    color: "#3b82f6", label: "Urlaub" },
  SICK:             { icon: Thermometer, color: "#ef4444", label: "Krank" },
  HOMEOFFICE:       { icon: Home,        color: "#8b5cf6", label: "Homeoffice" },
  TIME_CORRECTION:  { icon: Clock,       color: "#eab308", label: "Zeitkorrektur" },
  OVERTIME_REDUCE:  { icon: Clock,       color: "#22c55e", label: "Überstunden" },
  SPECIAL_LEAVE:    { icon: Calendar,    color: "#06b6d4", label: "Sonderurlaub" },
  CANCEL_VACATION:  { icon: Ban,         color: "#ef4444", label: "Stornierung" },
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; label: string }
> = {
  PENDING:   { bg: "#eab308", label: "Offen" },
  APPROVED:  { bg: "#22c55e", label: "Genehmigt" },
  REJECTED:  { bg: "#ef4444", label: "Abgelehnt" },
  CANCELLED: { bg: "#6b7280", label: "Storniert" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateRange(from: string, to: string): string {
  const d1 = new Date(from);
  const d2 = new Date(to);
  const pad = (n: number) => String(n).padStart(2, "0");
  const left = `${pad(d1.getDate())}.${pad(d1.getMonth() + 1)}.`;
  const right = `${pad(d2.getDate())}.${pad(d2.getMonth() + 1)}.${d2.getFullYear()}`;
  return d1.toDateString() === d2.toDateString() ? right : `${left} – ${right}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface RequestGlassCardProps {
  request: AppRequest;
  onWithdraw?: (request: AppRequest) => void;
  onCancel?: (request: AppRequest) => void;
  onReschedule?: (request: AppRequest) => void;
  onPress?: (request: AppRequest) => void;
}

export function RequestGlassCard({
  request,
  onWithdraw,
  onCancel,
  onReschedule,
  onPress,
}: RequestGlassCardProps) {
  const { colors } = useTheme();
  const typeConf = TYPE_CONFIG[request.type] ?? TYPE_CONFIG.VACATION;
  const statusConf = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING;
  const Icon = typeConf.icon;

  // Which actions to show
  const showWithdraw =
    request.status === "PENDING" &&
    request.type !== "CANCEL_VACATION" &&
    !!onWithdraw;

  const showCancelAndReschedule =
    request.status === "APPROVED" &&
    (request.type === "VACATION" || request.type === "HOMEOFFICE" || request.type === "SPECIAL_LEAVE") &&
    (!!onCancel || !!onReschedule);

  // Cancellation request pending for an approved vacation
  const isCancelPending = request.type === "CANCEL_VACATION" && request.status === "PENDING";

  const MainRowWrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress: () => onPress(request), activeOpacity: 0.7 }
    : {};

  return (
    <GlassCard style={styles.card}>
      {/* Main row — tappable for detail view */}
      <MainRowWrapper style={styles.mainRow} {...wrapperProps}>
        {/* Left icon */}
        <View style={[styles.iconCircle, { backgroundColor: `${typeConf.color}22` }]}>
          <Icon size={18} color={typeConf.color} />
        </View>

        {/* Center info */}
        <View style={styles.center}>
          <Text style={[styles.typeLabel, { color: colors.foreground }]}>
            {typeConf.label}
          </Text>
          <Text style={[styles.dateRange, { color: colors.mutedForeground }]}>
            {formatDateRange(request.dateFrom, request.dateTo)}
          </Text>
          {request.note ? (
            <Text
              style={[styles.note, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {request.note}
            </Text>
          ) : null}
          {isCancelPending && (
            <Text style={[styles.cancelPendingHint, { color: "#f59e0b" }]}>
              Stornierung wird geprüft…
            </Text>
          )}
        </View>

        {/* Right status badge */}
        <View style={[styles.badge, { backgroundColor: statusConf.bg }]}>
          <Text style={styles.badgeText}>{statusConf.label}</Text>
        </View>
      </MainRowWrapper>

      {/* Action row — PENDING: Zurückziehen */}
      {showWithdraw && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: "#ef444440" }]}
            onPress={() => onWithdraw(request)}
            activeOpacity={0.7}
          >
            <Undo2 size={14} color="#ef4444" />
            <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
              Zurückziehen
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action row — APPROVED: Stornieren + Umplanen */}
      {showCancelAndReschedule && (
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {onCancel && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: "#ef444440" }]}
              onPress={() => onCancel(request)}
              activeOpacity={0.7}
            >
              <RotateCcw size={14} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                Stornieren
              </Text>
            </TouchableOpacity>
          )}
          {onReschedule && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: "#3b82f640" }]}
              onPress={() => onReschedule(request)}
              activeOpacity={0.7}
            >
              <RefreshCw size={14} color="#3b82f6" />
              <Text style={[styles.actionBtnText, { color: "#3b82f6" }]}>
                Umplanen
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: 0,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  center: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  dateRange: {
    fontSize: 12,
  },
  note: {
    fontSize: 12,
  },
  cancelPendingHint: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },

  // Action row
  actionRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
