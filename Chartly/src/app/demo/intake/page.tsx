import type { Metadata } from "next";
import { IntakeWizard } from "@/app/i/intake-wizard";

// Demo-only: the customer flow with sample data and no intake link, for
// testing on a phone and recording the demo. Nothing is saved.
export const metadata: Metadata = {
  title: "OneTrip · Customer demo",
  robots: { index: false, follow: false },
};

export default function DemoIntakePage() {
  return (
    <main className="min-h-dvh">
      <IntakeWizard businessName="Coolside Heating & Air" customerName="Drew" businessPhone="(425) 555-0190" />
    </main>
  );
}
