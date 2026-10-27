import Link from "next/link";
import { Suspense } from "react";
import { requireWorkspace } from "@/lib/workspace";
import { createServiceRequest } from "../actions";
import { RequestForm } from "../request-form";

export default function NewRequestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Link href="/app/requests" className="inline-flex min-h-10 items-center self-start text-sm font-bold text-accent-strong">
          ← Requests
        </Link>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight">New request</h1>
        <p className="text-base leading-7 text-muted">
          Add what you already know. You&apos;ll get a private link to send the
          customer so they can photograph the problem and answer a few
          questions.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <Suspense
          fallback={<p className="text-sm text-muted">Loading…</p>}
        >
          <Form />
        </Suspense>
      </div>
    </main>
  );
}

async function Form() {
  const { workspace } = await requireWorkspace();
  return (
    <RequestForm
      action={createServiceRequest}
      initialValues={{
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        serviceAddress: "",
        trade: workspace.trade,
        tradeOther: workspace.tradeOther ?? "",
        issueDescription: "",
      }}
      workspaceTrade={{
        trade: workspace.trade,
        tradeOther: workspace.tradeOther,
      }}
      submitLabel="Create request and link"
      pendingLabel="Creating…"
      cancelHref="/app/requests"
    />
  );
}
