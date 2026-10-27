import type { ReactNode } from "react";
import type { RequestIntakeView, StoredBrief } from "@/lib/intake-ai";
import type { RequestPhoto } from "@/lib/intake-photos";
import { formatAnswer } from "@/lib/intake-questions";
import type { IntakeStatus } from "@/lib/service-requests";
import { BringChecklist, CopyText } from "./brief-actions";
import { BriefAutoRefresh, RetryBriefButton } from "./brief-controls";
import { BriefPhotos } from "./brief-photos";
import { ConfidenceBadge } from "./confidence-badge";

// The service brief, split into three tabs (see docs/design/README.md):
// - Brief: what to do, short. Likely cause, bring, confirm on site, photos.
// - Customer answers: what the customer sent, in their own words.
// - Detailed analysis: every AI section in full.
// Everything AI-written is labeled so; every finding cites a photo or answer.

type Refs = {
  photoRef: (ids: string[]) => string | null;
  questionRef: (ids: string[]) => string | null;
};

export function briefRefs(intake: RequestIntakeView, photos: RequestPhoto[]): Refs {
  const photoIds = photos.map((p) => p.id);
  return {
    photoRef: (ids) => refList(ids.map((id) => photoIds.indexOf(id) + 1).filter((n) => n > 0), "Photo"),
    questionRef: (ids) =>
      refList(ids.map((id) => intake.questions.findIndex((q) => q.id === id) + 1).filter((n) => n > 0), "Answer"),
  };
}

// Working / failed / waiting states, shown above whichever tab is open.
export function BriefStatus({
  requestId,
  intakeStatus,
  intake,
  customerName,
}: {
  requestId: string;
  intakeStatus: IntakeStatus;
  intake: RequestIntakeView;
  customerName: string;
}) {
  const { brief, job } = intake;
  const working = job && (job.status === "pending" || job.status === "running") && !job.stale;
  const failed = job && (job.status === "failed" || job.stale);
  const firstName = customerName.split(" ")[0];

  if (working) {
    return (
      <div aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-[15px]">
        <span aria-hidden className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent-strong" />
        Writing the brief… usually under a minute.
        <BriefAutoRefresh />
      </div>
    );
  }
  if (failed) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-danger-soft p-4 text-[15px] text-danger">
        <p>
          {brief
            ? "Updating the brief didn’t work. The last brief is shown and may be out of date."
            : "The brief couldn’t be written. The customer’s answers are complete."}
        </p>
        <RetryBriefButton requestId={requestId} />
      </div>
    );
  }
  if (!brief) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line bg-white p-4">
        <p className="font-display text-lg font-bold">
          {intakeStatus === "submitted" ? "No brief yet" : `Waiting on ${firstName}’s photos`}
        </p>
        <p className="mt-1 text-[15px] text-muted">
          {intakeStatus === "submitted"
            ? "Their photos and answers are in Customer answers."
            : "Once they send photos, you’ll see the likely cause, what to bring, and the photos with AI notes here."}
        </p>
      </div>
    );
  }
  return null;
}

// Tab 1: the mockup's brief. Kept to what a tech needs before driving out.
export function BriefTab({
  brief,
  photos,
  intake,
  customerName,
}: {
  brief: StoredBrief;
  photos: RequestPhoto[];
  intake: RequestIntakeView;
  customerName: string;
}) {
  const [top, ...others] = brief.possible_explanations;
  const bring = brief.bring ?? [];
  const confirm = brief.confirm_on_site ?? brief.unresolved_questions[0] ?? null;
  const why = top?.basis || firstSentence(brief.summary);
  const model = brief.equipment.find((e) => e.model);

  return (
    <div className="flex flex-col gap-3">
      {brief.urgent_concern ? (
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-[15px] font-semibold text-danger">
          ⚠ Possible safety concern: {brief.urgent_concern} Confirm with the customer before the visit.
        </p>
      ) : null}

      <section aria-labelledby="verdict" className="rounded-2xl border-2 border-ink bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{top ? "Likely cause" : "Summary"}</Eyebrow>
          {top?.confidence ? <ConfidenceBadge confidence={top.confidence} /> : null}
        </div>
        <h2 id="verdict" className="mt-1 font-display text-xl font-extrabold leading-tight">
          {top ? top.explanation : brief.summary}
        </h2>
        {top && why ? <p className="mt-1.5 text-base">{why}</p> : null}
        {photos.length ? (
          <a href="#brief-photos" className="mt-1 inline-flex min-h-12 items-center font-bold text-accent-strong">
            See why →
          </a>
        ) : null}
      </section>

      {bring.length ? (
        <Card title="Bring">
          <BringChecklist items={bring} />
        </Card>
      ) : null}

      {confirm || others.length ? (
        <Card title="Confirm on site">
          {confirm ? <p className="mt-1.5">{confirm}</p> : null}
          {others.length ? (
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {others.slice(0, 2).map((o, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  Also possible: {o.explanation}
                  {o.confidence ? <ConfidenceBadge confidence={o.confidence} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <BriefPhotos
        photos={viewerPhotos(photos)}
        notes={photoNotes(brief)}
        answerNotes={answerNotes(brief, intake)}
        customerName={customerName}
      />

      {model ? (
        <p className="flex flex-wrap items-center gap-x-2 px-1 text-sm text-muted">
          {[model.make, model.description].filter(Boolean).join(" ")} · Model{" "}
          <span className="font-mono font-semibold text-ink">{model.model}</span>
          <CopyText value={model.model!} />
        </p>
      ) : null}
    </div>
  );
}

// Tab 2: everything the customer sent, in their words. Nothing AI-written
// except the question wording, which is labeled.
export function CustomerAnswersTab({
  intake,
  photos,
  description,
  limitedVisualInfo,
}: {
  intake: RequestIntakeView;
  photos: RequestPhoto[];
  description: string | null;
  limitedVisualInfo: boolean;
}) {
  const nothing = intake.questions.length === 0 && !intake.customerNote && !description && photos.length === 0;
  if (nothing) {
    return <p className="rounded-2xl border border-line bg-white p-4 text-[15px] text-muted">Nothing sent yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {limitedVisualInfo ? (
        <p className="rounded-2xl bg-caution-soft p-3 text-[15px] text-caution">
          Limited visual information: the customer couldn’t take a photo.
        </p>
      ) : null}

      {intake.questions.length ? (
        <Card title="Answers">
          <p className="mt-0.5 text-xs text-muted">Questions written by AI; answers exactly as given.</p>
          <ol className="mt-1">
            {intake.questions.map((q, i) => (
              <li key={q.id} className="border-t border-line py-3 first:border-t-0">
                <p className="text-sm text-muted">
                  {i + 1}. {q.label}
                </p>
                <p className="mt-0.5 whitespace-pre-line font-semibold">{formatAnswer(q.answer)}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {description ? (
        <Card title="Their description">
          <p className="mt-1.5 whitespace-pre-line">{description}</p>
        </Card>
      ) : null}

      {intake.customerNote ? (
        <Card title="Anything else">
          <p className="mt-1.5 whitespace-pre-line">“{intake.customerNote}”</p>
        </Card>
      ) : null}

      {photos.length ? (
        <Card title={`Photos (${photos.length})`}>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                <a
                  href={photo.fullUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-xl bg-chip"
                >
                  {photo.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                    <img src={photo.thumbnailUrl} alt={photo.caption ?? `Photo ${index + 1}`} className="size-full object-contain" />
                  ) : null}
                </a>
                <p className="mt-1 text-sm">
                  <b>Photo {index + 1}</b>
                  {photo.caption ? <span className="text-muted"> · “{photo.caption}”</span> : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

// Tab 3: the whole AI analysis, for when the tech wants the reasoning.
export function DetailedAnalysisTab({
  brief,
  refs,
  meta,
}: {
  brief: StoredBrief;
  refs: Refs;
  meta: string;
}) {
  const { photoRef, questionRef } = refs;
  return (
    <div className="flex flex-col gap-3">
      <Card title="Summary">
        <p className="mt-1.5">{brief.summary}</p>
      </Card>
      <ListCard title="Possible causes (unconfirmed)">
        {brief.possible_explanations.map((item, i) => (
          <li key={i}>
            <span className="flex flex-wrap items-center gap-2">
              {item.explanation}
              {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
            </span>
            {item.basis ? <span className="block text-sm text-muted">Based on: {item.basis}</span> : null}
          </li>
        ))}
      </ListCard>
      <ListCard title="What the photos show">
        {brief.visual_observations.map((item, i) => (
          <li key={i}>
            {item.observation} <Ref text={photoRef(item.photo_ids)} />
          </li>
        ))}
      </ListCard>
      <ListCard title="What the customer reported">
        {brief.customer_reported.map((item, i) => (
          <li key={i}>
            {item.fact} <Ref text={questionRef(item.question_ids) ?? sourceLabel(item.sources)} />
          </li>
        ))}
      </ListCard>
      <ListCard title="Equipment">
        {brief.equipment.map((item, i) => (
          <li key={i}>
            {[item.make, item.description].filter(Boolean).join(" ")}
            <span className="block text-sm text-muted">
              Model <span className="font-mono text-ink">{item.model ?? "not legible"}</span>
              {item.serial ? (
                <>
                  {" "}· Serial <span className="font-mono text-ink">{item.serial}</span>
                </>
              ) : null}{" "}
              <Ref text={photoRef(item.photo_ids)} />
            </span>
          </li>
        ))}
      </ListCard>
      {brief.symptom_timeline ? (
        <Card title="Timeline">
          <p className="mt-1.5">{brief.symptom_timeline}</p>
        </Card>
      ) : null}
      <ListCard title="Still to confirm">
        {brief.unresolved_questions.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListCard>
      <ListCard title="Conflicting information">
        {brief.contradictions.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListCard>
      <p className="px-1 text-xs text-muted">{meta}</p>
    </div>
  );
}

/* ---------- helpers ---------- */

function viewerPhotos(photos: RequestPhoto[]) {
  return photos
    .filter((p) => p.fullUrl ?? p.thumbnailUrl)
    .map((p, i) => ({ id: p.id, title: p.caption ?? `Photo ${i + 1}`, url: (p.fullUrl ?? p.thumbnailUrl)! }));
}

// Observations become notes on each photo they cite; the pin goes on the
// first cited photo only, since the position was given for that one.
function photoNotes(brief: StoredBrief) {
  return [
    ...brief.visual_observations.flatMap((o) =>
      o.photo_ids.map((photoId, i) => ({
        photoId,
        x: i === 0 ? (o.x ?? null) : null,
        y: i === 0 ? (o.y ?? null) : null,
        text: o.observation,
      })),
    ),
    ...brief.equipment.flatMap((e) =>
      e.photo_ids.map((photoId) => ({
        photoId,
        x: null,
        y: null,
        text: [e.make, e.description].filter(Boolean).join(" "),
        supports: e.model ? `Model ${e.model}${e.serial ? ` · Serial ${e.serial}` : ""}` : undefined,
      })),
    ),
  ];
}

function answerNotes(brief: StoredBrief, intake: RequestIntakeView) {
  return brief.customer_reported
    .filter((r) => r.question_ids.length)
    .map((r) => ({
      quote: r.fact,
      supports: r.question_ids
        .map((id) => intake.questions.find((q) => q.id === id)?.label)
        .filter(Boolean)
        .join(" · "),
    }));
}

function firstSentence(text: string) {
  const match = text.match(/^.+?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </section>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <Card title={title}>
      <ul className="mt-1.5 list-disc space-y-2 pl-5">{children}</ul>
    </Card>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold uppercase tracking-wider text-muted">{children}</span>;
}

function Ref({ text }: { text: string | null }) {
  return text ? <span className="text-sm text-muted">({text})</span> : null;
}

function refList(numbers: number[], noun: string) {
  if (numbers.length === 0) return null;
  return numbers.length === 1 ? `${noun} ${numbers[0]}` : `${noun}s ${numbers.join(", ")}`;
}

function sourceLabel(sources: string[]) {
  const labels: Record<string, string> = { description: "description", note: "closing note", caption: "photo caption" };
  const named = sources.map((s) => labels[s]).filter(Boolean);
  return named.length ? named.join(", ") : null;
}
