import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { AuthShell } from "@/app/auth/auth-shell";
import { getCurrentWorkspace } from "@/lib/workspace";
import { TIME_ZONES } from "@/lib/workspace-schema";
import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Set up your shop"
      intro="About a minute. Customers see your business name and contact details when they open a link."
      footer={
        <form action={logout}>
          <button type="submit" className="min-h-10 text-sm font-bold text-accent-strong">
            Log out
          </button>
        </form>
      }
    >
      <Suspense fallback={<p className="text-base leading-7 text-muted">Loading…</p>}>
        <Onboarding />
      </Suspense>
    </AuthShell>
  );
}

async function Onboarding() {
  const { user, workspace } = await getCurrentWorkspace();
  if (workspace) {
    redirect("/app");
  }
  return <OnboardingForm defaultEmail={user.email} timeZones={TIME_ZONES} />;
}
