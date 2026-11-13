import { useSyncExternalStore } from "react";

const MAX_OVERRIDES = 500;
const overrides = new Map<string, boolean>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  for (const listener of Array.from(listeners.get(key) ?? [])) listener();
}

export function getReasoningOverride(key: string): boolean | undefined {
  return overrides.get(key);
}

export function setReasoningOverride(key: string, open: boolean): void {
  overrides.delete(key);
  overrides.set(key, open);
  if (overrides.size > MAX_OVERRIDES) overrides.delete(overrides.keys().next().value!);
  notify(key);
}

/** Preserves the user's open/collapsed choice when a streaming item is swapped for its saved message. */
export function transferReasoningOverride(fromKey: string, toKey: string): void {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const choice = overrides.get(fromKey);
  if (choice === undefined) return;
  overrides.delete(fromKey);
  overrides.delete(toKey);
  overrides.set(toKey, choice);
  notify(toKey);
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export function useReasoningOverride(key: string): boolean | undefined {
  return useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => getReasoningOverride(key),
    () => undefined,
  );
}

/** Tests only. */
export function resetReasoningOverrides(): void {
  overrides.clear();
}
