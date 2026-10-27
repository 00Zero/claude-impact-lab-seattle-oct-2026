"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches the current page every few seconds while background AI work
// is running, so results appear without a manual refresh. Render it only
// while something is pending.
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
