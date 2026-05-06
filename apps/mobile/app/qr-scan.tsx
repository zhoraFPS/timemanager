import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/lib/store";
import { exchangeDeviceToken } from "@/lib/api";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { Platform } from "react-native";

export default function QRScanScreen() {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setDeviceId = useAuthStore((s) => s.setDeviceId);
  const deviceId = useAuthStore((s) => s.deviceId);

  if (!permission) return <View className="flex-1 bg-background" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-foreground text-center mb-4">
          Kamera-Zugriff wird benoetigt
        </Text>
        <TouchableOpacity
          className="bg-primary rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-primary-foreground font-semibold">
            Erlauben
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      let did = deviceId;
      if (!did) {
        did = Crypto.randomUUID();
        await setDeviceId(did);
      }

      const result = await exchangeDeviceToken(data, did, {
        platform: Platform.OS,
        model: Device.modelName ?? undefined,
        osVersion: Device.osVersion ?? undefined,
      });
      await setAuth(result.user, result.accessToken, result.refreshToken);
      router.replace("/(tabs)");
    } catch (error: any) {
      const msg =
        error.response?.data?.error || "QR-Code ungueltig oder abgelaufen";
      Alert.alert("Fehler", msg);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <CameraView
          className="flex-1"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View className="absolute bottom-0 left-0 right-0 bg-background/80 p-6">
          <Text className="text-foreground text-center text-base mb-2">
            QR-Code scannen
          </Text>
          <Text className="text-muted-foreground text-center text-sm">
            Lassen Sie sich den QR-Code von Ihrem Teamleiter zeigen
          </Text>
          {loading && (
            <ActivityIndicator className="mt-4" color="#3b82f6" />
          )}
          <TouchableOpacity
            className="mt-4 items-center py-2"
            onPress={() => router.back()}
          >
            <Text className="text-primary">Zurueck zur Anmeldung</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
