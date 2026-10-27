import Link from "next/link";
import { ActionButton } from "@/app/ui/action-button";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { textLinkClassName } from "@/app/ui/form-styles";
import { lineRange } from "@/lib/estimate-math";
import type { Estimate, RequestEstimates } from "@/lib/estimates";
import { formatRange, minorToInput } from "@/lib/money";
import { unitLabel } from "@/lib/price-book-rules";
import {
  newEstimateVersionAction,
  regenerateEstimateAction,
  releaseEstimateAction,
} from "../actions";
import { EstimateEditor } from "./estimate-editor";

const STATUS_LABELS: Record<Estimate["status"], string> = {
  draft: "Draft",
  approved: "Approved, not sent",
  released: "Sent to customer",
  superseded: "Replaced",
};

// The Estimate section of request detail (spec B9). Drafts come from AI;
// the contractor edits, approves, then releases. Only released estimates
// reach the customer.
export function EstimatePanel({
  requestId,
  data,
  canApprove,
  hasActiveLink,
  formatDateTime,
}: {
  requestId: string;
  data: RequestEstimates;
  canApprove: boolean;
  hasActiveLink: boolean;
  formatDateTime: (iso: string) => string;
}) {
  const { estimates, job, readiness, latestBriefVersion, priceBook } = data;
  const current = estimates.find((e) => e.status !== "superseded") ?? estimates[0];
  const released = estimates.find((e) => e.status === "released");
  const drafting = job && (job.status === "pending" || job.status === "running") && !job.stale;
  const failed = job && (job.status === "failed" || job.stale) && (!current || current.status !== "draft");

  return (
    <section aria-labelledby="estimate-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="estimate-heading" className="font-display text-lg font-bold">
          Estimate
        </h2>
        <span className="text-xs text-muted">Drafted by AI from your price book · you approve before the customer sees it</span>
      </div>

      {!readiness.ready ? (
        <p className="rounded-xl bg-caution-soft p-4 text-[15px] text-caution">
          {readiness.reason === "no_service_fee"
            ? "Estimates need a priced service call / diagnostic fee in your price book."
            : "Add items to your price book to get estimates."}{" "}
          <Link href="/app/settings/price-book" className={textLinkClassName}>
            Open price book
          </Link>
        </p>
      ) : null}

      {drafting ? (
        <div aria-live="polite" className="rounded-xl bg-chip p-4 text-[15px]">
          Drafting the estimate from the brief and your price book…
          <AutoRefresh />
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-danger-soft p-4 text-[15px] text-danger">
          <p>The estimate couldn’t be drafted.</p>
          <ActionButton action={regenerateEstimateAction.bind(null, requestId)} label="Try again" pendingLabel="Starting…" />
        </div>
      ) : null}

      {!current && !drafting && !failed && readiness.ready ? (
        <p className="text-[15px] text-muted">
          {latestBriefVersion
            ? "No estimate yet."
            : "A draft appears here after the customer sends their photos and the brief is written."}
        </p>
      ) : null}

      {current ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-chip px-2 py-1 font-bold">
              Version {current.version} · {STATUS_LABELS[current.status]}
            </span>
            {current.briefVersion ? <span className="text-muted">Based on brief version {current.briefVersion}</span> : null}
            {current.status === "draft" && latestBriefVersion && current.briefVersion && current.briefVersion < latestBriefVersion ? (
              <span className="rounded-lg bg-caution-soft px-2 py-1 font-bold text-caution">Out of date: the brief changed</span>
            ) : null}
          </div>

          {released && released.id !== current.id ? (
            <p className="text-sm text-muted">
              The customer currently sees version {released.version}, sent {formatDateTime(released.releasedAt!)}.
            </p>
          ) : null}

          {current.status === "draft" ? (
            <EstimateEditor
              key={`${current.id}:${current.totalLowMinor}:${current.totalHighMinor}:${current.lines.length}`}
              requestId={requestId}
              estimateId={current.id}
              currency={current.currency}
              canApprove={canApprove}
              priceBook={priceBook.map((i) => ({
                id: i.id,
                name: i.name,
                description: i.description,
                unit: i.unit,
                priceLowMinor: i.priceLowMinor,
                priceHighMinor: i.priceHighMinor,
              }))}
              initialAssumptions={current.assumptions}
              initialExclusions={current.exclusions}
              initialLines={current.lines.map((l) => ({
                key: l.id,
                id: l.id,
                priceBookItemId: l.priceBookItemId,
                description: l.description,
                quantityLow: String(l.quantityLow),
                quantityHigh: String(l.quantityHigh),
                unit: l.unit,
                unitPriceLow: minorToInput(l.unitPriceLowMinor),
                unitPriceHigh: minorToInput(l.unitPriceHighMinor),
                aiReason: l.aiReason,
                contractorEdited: l.contractorEdited,
              }))}
            />
          ) : (
            <>
              <EstimateSummary estimate={current} />
              {current.status === "released" ? (
                <p className="text-sm text-muted">Sent to the customer {formatDateTime(current.releasedAt!)}.</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {current.status === "approved" && canApprove ? (
                  hasActiveLink ? (
                    <ActionButton
                      action={releaseEstimateAction.bind(null, requestId, current.id)}
                      label="Send to customer"
                      pendingLabel="Sending…"
                      variant="primary"
                      confirm="Show this estimate to the customer on their link?"
                    />
                  ) : (
                    <p className="text-sm text-muted">Create a new link on this request to send the estimate.</p>
                  )
                ) : null}
                <ActionButton
                  action={newEstimateVersionAction.bind(null, requestId, current.id)}
                  label="Edit as a new version"
                  pendingLabel="Creating…"
                />
              </div>
            </>
          )}

          {readiness.ready && latestBriefVersion && !drafting ? (
            <ActionButton
              action={regenerateEstimateAction.bind(null, requestId)}
              label="Redraft with AI"
              pendingLabel="Starting…"
              variant="link"
              confirm="Draft a new estimate from the latest brief? Your current draft is kept in the version history."
            />
          ) : null}
        </div>
      ) : null}

      {estimates.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-muted">Version history</summary>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {estimates.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 px-3 py-2">
                <span>
                  Version {e.version} · {STATUS_LABELS[e.status]}
                  {e.draftedByAi ? " · AI draft" : ""}
                </span>
                <span className="text-muted">
                  {formatRange(e.totalLowMinor, e.totalHighMinor, e.currency)} · {formatDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function EstimateSummary({ estimate }: { estimate: Estimate }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {estimate.lines.map((line) => {
          const range = lineRange(line);
          const qty =
            line.quantityLow === line.quantityHigh ? `${line.quantityLow}` : `${line.quantityLow}–${line.quantityHigh}`;
          return (
            <li key={line.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-bold">{line.description}</span>
                <span className="shrink-0 font-bold">
                  {range ? formatRange(range.low, range.high, estimate.currency) : "Needs a price"}
                </span>
              </div>
              <span className="text-muted">
                {qty} × {unitLabel(line.unit).toLowerCase()}
                {line.contractorEdited ? " · edited" : ""}
              </span>
              {line.aiReason ? <span className="text-muted">AI: {line.aiReason}</span> : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between gap-3 rounded-xl bg-chip px-4 py-3">
        <span className="text-sm font-bold">Estimated total</span>
        <span className="font-display text-xl font-bold">
          {formatRange(estimate.totalLowMinor, estimate.totalHighMinor, estimate.currency)}
        </span>
      </div>
      {estimate.assumptions.length ? <List title="Assumptions" items={estimate.assumptions} /> : null}
      {estimate.exclusions.length ? <List title="Not included" items={estimate.exclusions} /> : null}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="text-sm">
      <p className="font-bold">{title}</p>
      <ul className="list-disc pl-5 text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
