import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IntakeWelcome } from "@/app/i/intake-welcome";
import { getServiceRequest } from "@/lib/service-requests";
import { requireWorkspace } from "@/lib/workspace";

// Renders the customer experience from request data without touching the
// live link, so previewing never changes the intake.
export default function PreviewPage({
  params,
}: PageProps<"/app/requests/[id]/preview">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Loading…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({
  params,
}: Pick<PageProps<"/app/requests/[id]/preview">, "params">) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const request = await getServiceRequest(workspace.id, id);
  if (!request) {
    notFound();
  }

  return (
    <>
      <div className="border-b border-caution/40 bg-caution-soft">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-6">
          <p className="text-caution">
            Preview of what {request.customerName} sees. Nothing here is saved.
          </p>
          <Link href={`/app/requests/${request.id}`} className="font-bold text-accent-strong underline">
            Back to request
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-md px-6 py-10">
        <div className="rounded-2xl border border-line bg-white">
          <IntakeWelcome
            businessName={workspace.name}
            customerName={request.customerName}
            embedded
          />
        </div>
      </main>
    </>
  );
}
