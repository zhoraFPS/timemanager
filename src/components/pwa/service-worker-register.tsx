"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — not critical
      });

      // Listen for online event to sync offline stamps
      function handleOnline() {
        navigator.serviceWorker.controller?.postMessage({ type: "SYNC_STAMPS" });
      }
      window.addEventListener("online", handleOnline);

      // Listen for sync messages from SW
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "STAMPS_SYNCED" && event.data.synced > 0) {
          // Could show a toast here
          console.log(`${event.data.synced} Offline-Stempel synchronisiert`);
        }
      });

      return () => window.removeEventListener("online", handleOnline);
    }
  }, []);

  return null;
}
