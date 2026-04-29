import { useEffect } from "react";

type Listener = () => void;

const registry = new Map<string, Set<Listener>>();

export const AppEvents = {
  emit(event: string) {
    registry.get(event)?.forEach((fn) => fn());
  },
  on(event: string, fn: Listener): () => void {
    if (!registry.has(event)) registry.set(event, new Set());
    registry.get(event)!.add(fn);
    return () => registry.get(event)?.delete(fn);
  },
};

/** Subscribe a screen to an app event. Cleans up on unmount. */
export function useAppEvent(event: string, fn: Listener) {
  useEffect(() => AppEvents.on(event, fn), []);
}
