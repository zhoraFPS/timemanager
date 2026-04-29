import { useRef, useState, useCallback } from "react";
import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/ui/floating-tab-bar";
import { StampSheet } from "@/components/stamp-sheet";
import { postStamp, getActiveEntry } from "@/lib/api";
import { AppEvents } from "@/lib/events";
import type { TimeEntry } from "@/lib/types";
import type { BottomSheetHandle } from "@/components/ui/bottom-sheet";

export default function TabLayout() {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);

  const openSheet = useCallback(async () => {
    try {
      const entry = await getActiveEntry();
      setActiveEntry(entry);
    } catch {
      setActiveEntry(null);
    }
    sheetRef.current?.present();
  }, []);

  const handleStampIn = useCallback(async (type: string) => {
    try {
      await postStamp(type);
      const entry = await getActiveEntry();
      setActiveEntry(entry);
      AppEvents.emit("stamp");
    } catch (e) {
      console.error("Stamp in failed:", e);
    }
  }, []);

  const handleStampOut = useCallback(async () => {
    try {
      await postStamp("LEAVE");
      setActiveEntry(null);
      AppEvents.emit("stamp");
    } catch (e) {
      console.error("Stamp out failed:", e);
    }
  }, []);

  return (
    <>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar {...props} onStampPress={openSheet} />
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="zeiten" options={{ title: "Zeiten" }} />
        <Tabs.Screen name="antraege" options={{ title: "Anträge" }} />
        <Tabs.Screen name="profil" options={{ title: "Profil" }} />
      </Tabs>
      <StampSheet
        bottomSheetRef={sheetRef}
        activeEntry={activeEntry}
        onStampIn={handleStampIn}
        onStampOut={handleStampOut}
      />
    </>
  );
}
