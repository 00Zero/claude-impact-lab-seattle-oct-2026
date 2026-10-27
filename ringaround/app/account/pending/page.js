import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSession } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { canStartCalls } from "@/lib/agent";
import { getApplication } from "@/lib/db";
import { PendingStatus } from "./pending-status";

export const metadata = {
  title: "Account in review — RingAround",
  robots: { index: false, follow: false },
};

export default async function AccountPendingPage() {
  // Accounts on ALLOWED_EMAILS are already approved, so there's nothing to wait for.
  await connection();
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in?next=/account/pending");
  if (canStartCalls(session.user.email)) redirect("/requests/new");
  const application = await getApplication(session.user.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader label="Account" />
      <main className="flex-1">
        <PendingStatus initialApplication={application} />
      </main>
    </div>
  );
}
