"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useState, type ReactNode } from "react";

export type SpaceItem = {
  id: string;
  /** "booked" = a guest has turned the space into an event; "open" = still waiting for one. */
  kind: "booked" | "open";
  /** The pre-rendered card (an <li>), so server actions inside it keep working. */
  node: ReactNode;
};

type Filter = "all" | "booked" | "open";

const EMPTY: Record<Filter, string> = {
  all: "No spaces yet.",
  booked: "No booked spaces yet. They show up here once a guest turns one into an event.",
  open: "Every space is booked. Publish another to keep guests coming.",
};

/** Filter tabs plus the list of space cards. Counts sit in the tab labels. */
export function SpacesFilter({ items }: { items: SpaceItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const count = (f: Filter) => (f === "all" ? items.length : items.filter((i) => i.kind === f).length);
  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "booked", label: "Booked" },
    { value: "open", label: "Open" },
  ];

  return (
    <Tabs.Root value={filter} onValueChange={(v) => setFilter(v as Filter)} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="alt-h2">My spaces</h2>
        <Tabs.List className="alt-tabs" aria-label="Filter spaces">
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} className="alt-tab !min-h-11">
              {t.label} <span className="tabular-nums">{count(t.value)}</span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </div>

      {tabs.map((t) => (
        <Tabs.Panel key={t.value} value={t.value} className="outline-none">
          {count(t.value) === 0 ? (
            <p className="alt-card alt-secondary">{EMPTY[t.value]}</p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {items.filter((i) => t.value === "all" || i.kind === t.value).map((i) => i.node)}
            </ul>
          )}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
