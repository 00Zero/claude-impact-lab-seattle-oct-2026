import Link from "next/link";
import {
  ANALYSIS_STATUS_LABELS,
  INTAKE_STATUS_LABELS,
  requestReference,
  REVIEW_STATUS_LABELS,
  type AnalysisStatus,
  type IntakeStatus,
  type ListedServiceRequest,
  type RequestListParams,
} from "@/lib/service-requests";

// Status pills: grey = waiting, green = ready, red only for failures.
const INTAKE_TONES: Record<IntakeStatus, string> = {
  draft: "bg-wait-soft text-wait",
  shared: "bg-wait-soft text-wait",
  in_progress: "bg-accent-soft text-accent-strong",
  submitted: "bg-ok-soft text-ok",
};

const ANALYSIS_TONES: Record<AnalysisStatus, string> = {
  not_started: "bg-wait-soft text-wait",
  pending: "bg-wait-soft text-wait",
  running: "bg-accent-soft text-accent-strong",
  succeeded: "bg-ok-soft text-ok",
  failed: "bg-danger-soft text-danger",
};

const pillClassName = "rounded-lg px-2 py-0.5 text-xs font-bold";

// The mockup's grouping, on the default view only: search, filters and other
// sorts keep one flat list. Groups cover the current page.
const GROUPS = [
  ["Needs your eyes", (r: ListedServiceRequest) => r.intakeStatus === "submitted" && r.reviewStatus === "unreviewed"],
  ["Waiting on customer", (r: ListedServiceRequest) => r.intakeStatus !== "submitted"],
  ["Done", (r: ListedServiceRequest) => r.intakeStatus === "submitted" && r.reviewStatus !== "unreviewed"],
] as const;

export function GroupedRequests({
  requests,
  grouped,
  sort,
  format,
  compact = false,
  selectedId,
}: {
  requests: ListedServiceRequest[];
  grouped: boolean;
  sort: RequestListParams["sort"];
  format: (iso: string) => string;
  compact?: boolean;
  /** Highlighted card, in the desktop list beside a brief. */
  selectedId?: string;
}) {
  const list = (items: ListedServiceRequest[]) => (
    <ul className="flex flex-col gap-2.5">
      {items.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          sort={sort}
          format={format}
          compact={compact}
          selected={request.id === selectedId}
        />
      ))}
    </ul>
  );
  if (!grouped) return list(requests);
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map(([label, match]) => {
        const items = requests.filter(match);
        if (items.length === 0) return null;
        return (
          <section key={label} aria-label={label}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
              {label} · {items.length}
            </h2>
            {list(items)}
          </section>
        );
      })}
    </div>
  );
}

function RequestRow({
  request,
  sort,
  format,
  compact,
  selected,
}: {
  request: ListedServiceRequest;
  sort: RequestListParams["sort"];
  format: (iso: string) => string;
  compact?: boolean;
  selected?: boolean;
}) {
  // Show the timestamp the list is sorted by.
  const sortedTime =
    sort === "activity"
      ? `Active ${format(request.lastActivityAt)}`
      : sort === "submitted"
        ? request.submittedAt
          ? `Submitted ${format(request.submittedAt)}`
          : "Not submitted"
        : `Created ${format(request.createdAt)}`;
  // Analysis only means something once the customer has submitted.
  const showAnalysis = request.intakeStatus === "submitted";

  return (
    <li>
      <Link
        href={`/app/requests/${request.id}`}
        aria-current={selected ? "page" : undefined}
        className={`flex min-h-[84px] flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-4 hover:border-ink ${
          selected ? "border-ink" : "border-line"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-bold">
            {request.customerName}{" "}
            <span className="font-normal text-muted">{requestReference(request.number)}</span>
          </p>
          {compact ? null : <span className="shrink-0 text-xs text-muted">{sortedTime}</span>}
        </div>
        <p className="truncate text-sm text-muted">{request.serviceAddress ?? "No address yet"}</p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {showAnalysis ? (
            <span className={`${pillClassName} ${ANALYSIS_TONES[request.analysisStatus]}`}>
              {ANALYSIS_STATUS_LABELS[request.analysisStatus]}
            </span>
          ) : (
            <span className={`${pillClassName} ${INTAKE_TONES[request.intakeStatus]}`}>
              {INTAKE_STATUS_LABELS[request.intakeStatus]}
            </span>
          )}
          {request.reviewStatus !== "unreviewed" ? (
            <span className={`${pillClassName} bg-chip text-ink`}>
              {REVIEW_STATUS_LABELS[request.reviewStatus]}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
