const CACHE_NAME = "zeiterfassung-v1";
const OFFLINE_STAMPS_KEY = "offline-stamps";

// Pages and assets to cache for offline use
const PRECACHE_URLS = [
  "/dashboard",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept stamp POST when offline
  if (url.pathname === "/api/time-entries" && event.request.method === "POST") {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        // Offline: queue the stamp
        const body = await event.request.json();
        const stamps = JSON.parse(await getFromIDB(OFFLINE_STAMPS_KEY) || "[]");
        stamps.push({ ...body, timestamp: new Date().toISOString() });
        await saveToIDB(OFFLINE_STAMPS_KEY, JSON.stringify(stamps));
        return new Response(JSON.stringify({ action: "queued", offline: true }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // For navigation requests, try network first, fall back to cache
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/dashboard"))
    );
    return;
  }

  // For other requests, try network first, fall back to cache.
  // Only cache static/public assets — never API responses (may contain
  // personal data and should not outlive a session on shared devices).
  const isApi = url.pathname.startsWith("/api/");
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.method === "GET" && !isApi) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Sync offline stamps when back online
self.addEventListener("message", async (event) => {
  if (event.data?.type === "SYNC_STAMPS") {
    const stamps = JSON.parse(await getFromIDB(OFFLINE_STAMPS_KEY) || "[]");
    if (stamps.length === 0) return;

    const synced = [];
    for (const stamp of stamps) {
      try {
        const res = await fetch("/api/time-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stamp),
        });
        if (res.ok) synced.push(stamp);
      } catch {
        break; // Still offline
      }
    }

    const remaining = stamps.filter((s) => !synced.includes(s));
    await saveToIDB(OFFLINE_STAMPS_KEY, JSON.stringify(remaining));

    // Notify clients
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({
        type: "STAMPS_SYNCED",
        synced: synced.length,
        remaining: remaining.length,
      });
    }
  }
});

// Simple IndexedDB helpers for the service worker
function getFromIDB(key) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sw-store", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readonly");
      const get = tx.objectStore("kv").get(key);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}

function saveToIDB(key, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sw-store", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
