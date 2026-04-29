import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import {
  SimpleBottomSheet,
  type BottomSheetHandle,
} from "@/components/ui/bottom-sheet";
import { useTheme } from "@/lib/theme";
import { withdrawRequest, cancelApprovedRequest } from "@/lib/api";
import type { AppRequest } from "@/lib/types";

export interface CancelConfirmSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetHandle | null>;
  request: AppRequest | null;
  onDone: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  VACATION: "Urlaub",
  HOMEOFFICE: "Homeoffice",
  SICK: "Krankmeldung",
  SPECIAL_LEAVE: "Sonderurlaub",
  OVERTIME_REDUCE: "Überstundenabbau",
  TIME_CORRECTION: "Zeitkorrektur",
};

export function CancelConfirmSheet({
  bottomSheetRef,
  request,
  onDone,
}: CancelConfirmSheetProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!request) return null;

  const isPending = request.status === "PENDING";
  const label = TYPE_LABEL[request.type] ?? "Antrag";

  const d1 = new Date(request.dateFrom);
  const d2 = new Date(request.dateTo);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateRange = `${pad(d1.getDate())}.${pad(d1.getMonth() + 1)}. – ${pad(d2.getDate())}.${pad(d2.getMonth() + 1)}.${d2.getFullYear()}`;

  async function handleConfirm() {
    setLoading(true);
    try {
      if (isPending) {
        await withdrawRequest(request!.id);
      } else {
        await cancelApprovedRequest(request!.id, reason.trim() || undefined);
      }
      bottomSheetRef.current?.dismiss();
      setReason("");
      onDone();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? "Ein Fehler ist aufgetreten.";
      Alert.alert("Fehler", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SimpleBottomSheet ref={bottomSheetRef} snapFraction={isPending ? 0.52 : 0.68}>
      <View style={styles.inner}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: "#ef444420" }]}>
          <AlertTriangle size={28} color="#ef4444" />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isPending ? `${label} zurückziehen` : `${label} stornieren`}
        </Text>

        {/* Subtitle */}
        <Text style={[styles.dateRange, { color: colors.mutedForeground }]}>
          {dateRange}
        </Text>

        {/* Info text */}
        <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            {isPending
              ? "Der Antrag wird sofort zurückgezogen. Dein Vorgesetzter erhält keine Benachrichtigung."
              : "Da der Urlaub bereits genehmigt wurde, muss dein Vorgesetzter die Stornierung bestätigen. Bis zur Genehmigung bleibt der Urlaub aktiv."}
          </Text>
        </View>

        {/* Reason input — only for approved cancellations */}
        {!isPending && (
          <View style={styles.inputWrap}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              Grund (optional)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
              value={reason}
              onChangeText={setReason}
              placeholder="z.B. Reiseplanung geändert…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={() => bottomSheetRef.current?.dismiss()}
            activeOpacity={0.7}
          >
            <X size={16} color={colors.foreground} />
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
              Abbrechen
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmBtn, { opacity: loading ? 0.6 : 1 }]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>
                {isPending ? "Zurückziehen" : "Stornierung beantragen"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SimpleBottomSheet>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  dateRange: {
    fontSize: 14,
    marginTop: -6,
  },
  infoBox: {
    width: "100%",
    borderRadius: 12,
    padding: 14,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  inputWrap: {
    width: "100%",
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
