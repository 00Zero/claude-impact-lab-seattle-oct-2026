import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// A value that only exists in the browser; null while server-rendering and hydrating.
export function useBrowserValue(read) {
  return useSyncExternalStore(noopSubscribe, read, () => null);
}
