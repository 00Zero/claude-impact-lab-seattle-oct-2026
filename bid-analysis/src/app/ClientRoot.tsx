"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { createServices } from "@/lib/services";

// The map measures the window and uses browser APIs, so the explorer renders client-side only.
const ExplorerApp = dynamic(() => import("@/explorer/ExplorerApp").then((m) => m.ExplorerApp), { ssr: false });

export function ClientRoot() {
  const services = useMemo(() => createServices(), []);
  return <ExplorerApp services={services} />;
}
