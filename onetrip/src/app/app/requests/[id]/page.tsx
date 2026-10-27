import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { statusClassName } from "@/app/ui/form-styles";
import { getRequestEstimates } from "@/lib/estimates";
import { getRequestIntake } from "@/lib/intake-ai";
import { intakeUrl } from "@/lib/intake-links";
import { listRequestPhotos } from "@/lib/intake-photos";
import {
  getServiceRequest,
  parseRequestListParams,
  searchServiceRequests,
  INTAKE_STATUS_LABELS,
  requestReference,
} from "@/lib/service-requests";
import { tradeLabel } from "@/lib/trades";
import { GroupedRequests } from "../request-cards";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";
import { MarkReviewedButton } from "./brief-actions";
import { BriefStatus, BriefTab, briefRefs, CustomerAnswersTab, DetailedAnalysisTab } from "./brief-panel";
import { EstimatePanel } from "./estimate-panel";
import { IntakeLinkPanel } from "./intake-link-panel";
import { ManageRequestPanel } from "./manage-request-panel";

// Retrying a brief or redrafting an estimate runs AI work after the action
// responds; give it room.
export const maxDuration = 300;

export default function RequestPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  return (
    <div className="mx-auto max-w-3xl lg:grid lg:max-w-6xl lg:grid-cols-[21rem_1fr] lg:gap-6 lg:px-6">
      {/* Desktop: the requests list beside the brief (CLAUDE.md UI conventions). */}
      <aside aria-label="Requests" className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] overflow-y-auto py-4 lg:block">
        <Suspense fallback={null}>
          <RequestsColumn params={params} />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-col gap-4 px-4 pb-10 pt-3 sm:px-6 lg:px-0">
        <Link href="/app/requests" className="inline-flex min-h-10 items-center self-start text-sm font-bold text-accent-strong lg:hidden">
          ← Requests
        </Link>
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <RequestDetail params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function RequestsColumn({ params }: Pick<PageProps<"/app/requests/[id]">, "params">) {
  const [{ id }, { workspace }] = await Promise.all([params, requireWorkspace()]);
  const { requests } = await searchServiceRequests(workspace.id, parseRequestListParams({}));
  const format = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: workspace.timezone });
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/app/requests" className="font-display text-lg font-bold">
          Requests
        </Link>
        <Link href="/app/requests/new" className="text-sm font-bold text-accent-strong">
          + New
        </Link>
      </div>
      <GroupedRequests
        requests={requests}
        grouped
        sort="created"
        compact
        selectedId={id}
        format={(iso) => format.format(new Date(iso))}
      />
    </>
  );
}

async function RequestDetail({
  params,
  searchParams,
}: Pick<PageProps<"/app/requests/[id]">, "params" | "searchParams">) {
  const [{ id }, { created, updated, tab: tabParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { workspace } = await requireWorkspace();
  const request = await getServiceRequest(workspace.id, id);
  if (!request) {
    notFound();
  }

  const formatDateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: workspace.timezone,
  });
  const link = request.activeLink;
  const expiresAt = link ? new Date(link.expiresAt) : null;
  const [photos, intake, estimates] = await Promise.all([
    listRequestPhotos(workspace.id, request.id),
    getRequestIntake(workspace.id, request.id),
    workspace.estimatesEnabled ? getRequestEstimates(workspace.id, request.id) : null,
  ]);

  const tab = tabParam === "answers" || tabParam === "analysis" ? tabParam : "brief";
  const showTabs = request.intakeStatus === "submitted" || Boolean(intake.brief);
  const linkPanel = (
    <IntakeLinkPanel
      requestId={request.id}
      customerName={request.customerName}
      businessName={workspace.name}
      url={link ? await intakeUrl(link.id) : null}
      expiresLabel={expiresAt ? formatDateTime.format(expiresAt) : null}
      expired={link?.expired ?? false}
    />
  );
  const quickActions = [
    request.customerPhone ? ["📞 Call", `tel:${request.customerPhone}`] : null,
    request.customerPhone ? ["💬 Text", `sms:${request.customerPhone}`] : null,
    request.serviceAddress
      ? ["🧭 Directions", `https://maps.google.com/?q=${encodeURIComponent(request.serviceAddress)}`]
      : null,
  ].filter((a): a is string[] => a !== null);

  const details: [string, string | null][] = [
    ["Phone", request.customerPhone],
    ["Email", request.customerEmail],
    ["Service address", request.serviceAddress],
    ["Trade", tradeLabel(request.trade, request.tradeOther)],
    ["Issue", request.issueDescription],
  ];

  return (
    <>
      <header className="sticky top-16 z-10 -mx-4 border-b border-line bg-page px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold leading-tight">
            {request.customerName}{" "}
            <span className="font-normal text-muted">{requestReference(request.number)}</span>
          </h1>
          <span
            className={`mt-1.5 shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
              request.intakeStatus === "submitted" ? "bg-ok-soft text-ok" : "bg-wait-soft text-wait"
            }`}
          >
            {request.reviewStatus === "archived" ? "Archived" : INTAKE_STATUS_LABELS[request.intakeStatus]}
          </span>
        </div>
        <p className="truncate text-sm text-muted">
          {[request.serviceAddress, request.issueDescription?.split("\n")[0]].filter(Boolean).join(" · ") ||
            `Created ${formatDateTime.format(new Date(request.createdAt))}`}
        </p>
      </header>

      {created ? (
        <p role="status" className={statusClassName}>
          Request created. Copy or share the link below to send it to{" "}
          {request.customerName}.
        </p>
      ) : updated ? (
        <p role="status" className={statusClassName}>
          Changes saved.
        </p>
      ) : null}

      <BriefStatus
        requestId={request.id}
        intakeStatus={request.intakeStatus}
        intake={intake}
        customerName={request.customerName}
      />

      {/* Before the customer sends anything, the job is sending the link. */}
      {showTabs ? null : linkPanel}

      {showTabs ? (
        <>
          <nav aria-label="Brief sections" className="grid grid-cols-3 gap-1 rounded-2xl bg-chip p-1">
            {TABS.map(([key, label]) => (
              <Link
                key={key}
                href={key === "brief" ? `/app/requests/${request.id}` : `/app/requests/${request.id}?tab=${key}`}
                scroll={false}
                aria-current={tab === key ? "page" : undefined}
                className={`grid min-h-11 place-items-center rounded-xl px-2 text-center text-sm font-bold leading-tight ${
                  tab === key ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {tab === "answers" ? (
            <CustomerAnswersTab
              intake={intake}
              photos={photos}
              description={request.customerDescription}
              limitedVisualInfo={request.limitedVisualInfo}
            />
          ) : tab === "analysis" ? (
            intake.brief ? (
              <DetailedAnalysisTab
                brief={intake.brief.brief}
                refs={briefRefs(intake, photos)}
                meta={`Written by AI · version ${intake.brief.version} · ${formatDateTime.format(new Date(intake.brief.createdAt))} · ${intake.brief.model}`}
              />
            ) : (
              <p className="rounded-2xl border border-line bg-white p-4 text-[15px] text-muted">No analysis yet.</p>
            )
          ) : intake.brief ? (
            <BriefTab brief={intake.brief.brief} photos={photos} intake={intake} customerName={request.customerName} />
          ) : null}
        </>
      ) : null}

      {estimates ? (
        <EstimatePanel
          requestId={request.id}
          data={estimates}
          canApprove={canManageWorkspace(workspace)}
          hasActiveLink={Boolean(link && !link.expired)}
          formatDateTime={(iso) => formatDateTime.format(new Date(iso))}
        />
      ) : null}

      <details className="rounded-2xl border border-line bg-white px-4 py-3">
        <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 font-bold">
          Job details
          <span className="text-sm font-normal text-muted">Call · Text · Directions</span>
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          {quickActions.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {quickActions.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="grid min-h-12 place-items-center rounded-xl border-[1.5px] border-line bg-white text-sm font-bold"
                >
                  {label}
                </a>
              ))}
            </div>
          ) : null}
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Customer and job</span>
              <Link
                href={`/app/requests/${request.id}/edit`}
                className="inline-flex min-h-10 items-center rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-bold"
              >
                Edit
              </Link>
            </div>
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-[15px]">
              {details.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="whitespace-pre-line">{value ?? <span className="text-muted/70">Not provided</span>}</dd>
                </div>
              ))}
            </dl>
          </div>
          {showTabs ? linkPanel : null}
          <ManageRequestPanel
            requestId={request.id}
            requestNumber={request.number}
            archived={request.reviewStatus === "archived"}
            canDelete={canManageWorkspace(workspace)}
            photoCount={photos.length}
            hasActiveLink={Boolean(link && !link.expired)}
          />
        </div>
      </details>

      {intake.brief ? (
        <div className="sticky bottom-0 -mx-4 mt-2 border-t border-line bg-page px-4 pb-4 pt-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex gap-2">
            {request.customerPhone ? (
              <a
                href={`sms:${request.customerPhone}?&body=${encodeURIComponent(
                  `Hi ${request.customerName.split(" ")[0]}, it’s ${workspace.name}. Could you text me one more photo of the problem? Thanks!`,
                )}`}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border-[1.5px] border-line bg-white px-4 font-bold"
              >
                Ask for a photo
              </a>
            ) : null}
            <MarkReviewedButton requestId={request.id} reviewed={request.reviewStatus === "reviewed"} />
          </div>
        </div>
      ) : null}
    </>
  );
}

const TABS = [
  ["brief", "Brief"],
  ["answers", "Customer answers"],
  ["analysis", "Detailed analysis"],
] as const;
