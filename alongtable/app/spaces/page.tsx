import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SpacesMap } from "@/components/spaces-map";
import { listAvailableSpaces } from "@/lib/spaces";
import { Planner } from "./planner";

export const metadata: Metadata = { title: "Host an event · ALongTable" };

type Tab = "browse" | "plan";

const tabs: { id: Tab; label: string; href: string }[] = [
  { id: "browse", label: "Browse spaces", href: "/spaces" },
  { id: "plan", label: "Plan with AI", href: "/spaces?tab=plan" },
];

export default function SpacesPage({ searchParams }: PageProps<"/spaces">) {
  return (
    // Wide for the Browse tab's map; the Plan with AI tab keeps a narrow column below.
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <h1 className="alt-h2">Host an event</h1>
      <Suspense fallback={<p className="alt-secondary mt-6">Loading…</p>}>
        <HostOptions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HostOptions({ searchParams }: { searchParams: PageProps<"/spaces">["searchParams"] }) {
  const tab: Tab = (await searchParams).tab === "plan" ? "plan" : "browse";

  return (
    <>
      {/* Surfaces, not outlines: the active tab is a white surface on a sunken track. */}
      <nav aria-label="Ways to host" className="mb-4 mt-4 inline-flex gap-1 rounded-control bg-sunken p-1">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-11 items-center whitespace-nowrap rounded-small px-4 font-semibold ${
              t.id === tab ? "bg-surface text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "plan" ? (
        <div className="max-w-2xl">
          <p className="alt-secondary mb-6">
            Describe the gathering you have in mind. We&apos;ll search available restaurant spaces, suggest the best
            fits and draft your event. Nothing is booked until you review it and publish.
          </p>
          <Planner />
        </div>
      ) : (
        <>
          <p className="alt-secondary mb-4">
            Pick an available restaurant space and turn it into an event others can join.
          </p>
          <Suspense fallback={<p className="alt-secondary">Loading spaces…</p>}>
            <Spaces />
          </Suspense>
        </>
      )}
    </>
  );
}

async function Spaces() {
  const spaces = await listAvailableSpaces();

  if (spaces.length === 0) {
    return (
      <div className="rounded-card bg-surface p-10 text-center">
        <p className="font-semibold">No spaces available right now</p>
        <p className="alt-secondary mt-1">
          Check back soon, or{" "}
          <Link href="/spaces?tab=plan" className="underline">
            plan with AI
          </Link>
          .
        </p>
      </div>
    );
  }

  return <SpacesMap spaces={spaces} />;
}
