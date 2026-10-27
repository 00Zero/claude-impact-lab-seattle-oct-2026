import type { Metadata } from "next";
import { ServiceBrief } from "@/app/app/requests/[id]/service-brief";
import { DEMO_BRIEF, DEMO_BRIEF_ANSWERS, DEMO_BRIEF_PHOTOS } from "@/lib/brief-demo";

// Demo-only: the contractor's service brief with sample data and no DB, for
// testing on a phone and recording the demo. Nothing is saved.
export const metadata: Metadata = {
  title: "OneTrip · Sample brief",
  robots: { index: false, follow: false },
};

const CUSTOMER = {
  name: "Drew K.",
  phone: "+14255550123",
  address: "14 Alder Ln, Redmond",
  issue: "AC not cooling",
};

export default function DemoBriefPage() {
  const actions = [
    ["📞 Call", `tel:${CUSTOMER.phone}`],
    ["💬 Text", `sms:${CUSTOMER.phone}`],
    ["🧭 Directions", `https://maps.google.com/?q=${encodeURIComponent(CUSTOMER.address)}`],
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-page px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-line bg-page px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold">{CUSTOMER.name}</h1>
          <span className="rounded-lg bg-ok-soft px-2 py-1 text-xs font-bold text-ok">Brief ready</span>
        </div>
        <p className="truncate text-sm text-muted">
          {CUSTOMER.address} · {CUSTOMER.issue} · sent 2 min ago
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {actions.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="grid min-h-12 place-items-center rounded-xl border-[1.5px] border-line bg-white text-sm font-bold"
            >
              {label}
            </a>
          ))}
        </div>
      </header>
      <ServiceBrief
        brief={DEMO_BRIEF}
        photos={DEMO_BRIEF_PHOTOS}
        answers={DEMO_BRIEF_ANSWERS}
        customerName="Drew"
      />
    </main>
  );
}
