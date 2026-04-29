import AsyncStorage from "@react-native-async-storage/async-storage";
import { postStamp } from "./api";
import type { OfflineStamp } from "./types";

const QUEUE_KEY = "offline_stamps";

export async function getQueue(): Promise<OfflineStamp[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addToQueue(stamp: OfflineStamp): Promise<void> {
  const queue = await getQueue();
  queue.push(stamp);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((s) => s.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function syncQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  const queue = await getQueue();
  let synced = 0;
  let failed = 0;

  for (const stamp of queue) {
    try {
      await postStamp(stamp.type, stamp.projectId, stamp.timestamp);
      await removeFromQueue(stamp.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
