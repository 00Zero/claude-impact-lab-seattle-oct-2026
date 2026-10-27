"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { inputClassName } from "@/app/ui/form-styles";
import { demoAnalysis } from "@/lib/intake-demo";
import {
  INTAKE_CAPTION_MAX_LENGTH,
  INTAKE_DESCRIPTION_MAX_LENGTH,
  INTAKE_PHOTO_MAX_BYTES,
  INTAKE_PHOTO_MAX_COUNT,
  INTAKE_PHOTO_MIN_COUNT,
  type IntakePhoto,
} from "@/lib/intake-photo-rules";
import {
  formatAnswer,
  MAX_TEXT_ANSWER_LENGTH,
  YES_NO_UNKNOWN_OPTIONS,
  type AnswerValue,
  type IntakeAnalysisView,
  type IntakeQuestion,
} from "@/lib/intake-questions";
import {
  analyzeIntakeAction,
  captionPhotoAction,
  removePhotoAction,
  rotatePhotoAction,
  saveAnswerAction,
  saveDescriptionAction,
  submitIntakeAction,
} from "./[token]/actions";

// Where a photo is in being saved. "local" photos (preview, demo) are never uploaded.
type PhotoUpload =
  | { status: "local" }
  | { status: "uploading"; progress: number }
  | { status: "saved"; id: string }
  | { status: "failed"; error: string; retryable: boolean; file: File; replaces: string | null };
type Photo = {
  /** Stable React key; survives replacing the photo. */
  key: string;
  url: string;
  caption: string;
  /** The caption the server has, to skip no-op saves. */
  savedCaption: string;
  upload: PhotoUpload;
  /** Local-only rotation for previews; live photos are rotated on the server. */
  rotation: number;
  busy: "rotating" | "removing" | null;
  error: string | null;
};
type Step =
  | { kind: "welcome" }
  | { kind: "photos" }
  | { kind: "no-photo" }
  | { kind: "reading" }
  | { kind: "question"; index: number }
  | { kind: "note" }
  | { kind: "review" }
  | { kind: "done" };
type Analysis =
  | { status: "loading" }
  | { status: "ready"; view: IntakeAnalysisView }
  | { status: "failed"; error: string };

const EMPTY_ANALYSIS: IntakeAnalysisView = { seen: [], questions: [], photoIssues: [], urgentConcern: null };

// Photo-first customer intake: 1–5 photos (or a description if no photo is
// possible) → AI looks at them and writes a few questions → answers → review
// → sent. Previews and the demo run the same screens with sample questions.
// Look and feel: docs/design/README.md and the v3 prototype.
export function IntakeWizard({
  businessName,
  customerName,
  businessPhone,
  embedded = false,
  estimatesEnabled = false,
  live,
}: {
  businessName: string;
  customerName: string;
  businessPhone?: string | null;
  /** Inside the contractor preview card instead of full screen. */
  embedded?: boolean;
  /** The business uses estimates, so the confirmation mentions one may follow (C10). */
  estimatesEnabled?: boolean;
  /** A real intake link: everything is saved as it's entered and restored on reload. */
  live?: {
    token: string;
    photos: IntakePhoto[];
    description: string;
    answers: Record<string, AnswerValue>;
  };
}) {
  const [step, setStep] = useState<Step>({ kind: "welcome" });
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (live?.photos ?? []).map((saved) => ({
      key: saved.id,
      url: saved.thumbnailUrl,
      caption: saved.caption,
      savedCaption: saved.caption,
      upload: { status: "saved", id: saved.id },
      rotation: 0,
      busy: null,
      error: null,
    })),
  );
  const [description, setDescription] = useState(live?.description ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>({ status: "loading" });
  // Set when the customer chooses to send without the AI questions.
  const [skipQuestions, setSkipQuestions] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(live?.answers ?? {});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Every preview URL we create, revoked when the wizard unmounts.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Uploads run one at a time so several photos picked at once don't
  // compete for a phone's connection.
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  // Latest typed caption per photo, read when an upload finishes.
  const latestCaption = useRef(new Map<string, string>());

  const firstName = businessName.split(" ")[0];
  const savedCount = photos.filter((p) => p.upload.status === "saved" || p.upload.status === "local").length;
  const pending = photos.some((p) => p.upload.status === "uploading" || p.busy);
  const failedCount = photos.filter((p) => p.upload.status === "failed").length;
  const canContinue = savedCount >= INTAKE_PHOTO_MIN_COUNT && !pending && failedCount === 0;
  const view = analysis.status === "ready" && !skipQuestions ? analysis.view : EMPTY_ANALYSIS;
  const questions = view.questions;

  // The AI looks at whatever was sent. It starts as soon as the photos finish
  // saving (CLAUDE.md: analyze while the customer continues), keyed by the
  // saved photo set; unchanged photos reuse the stored result on the server,
  // so going back and forth doesn't repeat the work or change the questions.
  const photoSetKey = photos.map((p) => (p.upload.status === "saved" ? p.upload.id : p.key)).sort().join(",");
  const startedKey = useRef<string | null>(null);
  const [analysisStartedAt, setAnalysisStartedAt] = useState(0);

  async function runAnalysis() {
    const key = photoSetKey;
    startedKey.current = key;
    setAnalysisStartedAt(Date.now());
    setAnalysis({ status: "loading" });
    setSkipQuestions(false);
    if (!live) {
      const view = await demoAnalysis();
      if (startedKey.current === key) setAnalysis({ status: "ready", view });
      return;
    }
    const result = await analyzeIntakeAction(live.token);
    // A newer photo set started its own analysis; ignore this one.
    if (startedKey.current !== key) return;
    setAnalysis(result.ok ? { status: "ready", view: result.analysis } : { status: "failed", error: result.error });
  }

  // Start reading a moment after the last photo saves, while the customer
  // is still on the photo screen.
  useEffect(() => {
    if (step.kind !== "photos" || !canContinue || startedKey.current === photoSetKey) return;
    const timer = setTimeout(() => void runAnalysis(), 1500);
    return () => clearTimeout(timer);
    // runAnalysis reads the latest state; re-run only when the inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind, canContinue, photoSetKey]);

  function goToReading() {
    setStep({ kind: "reading" });
    if (startedKey.current !== photoSetKey || analysis.status === "failed") void runAnalysis();
  }

  function afterReading() {
    setStep(questions.length ? { kind: "question", index: 0 } : { kind: "note" });
  }

  function afterQuestions(index: number) {
    setStep(index + 1 < questions.length ? { kind: "question", index: index + 1 } : { kind: "note" });
  }

  function updatePhoto(key: string, change: Partial<Photo> | ((photo: Photo) => Partial<Photo>)) {
    setPhotos((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...(typeof change === "function" ? change(p) : change) } : p)),
    );
  }

  // Ignores progress from an upload that was since replaced.
  function setUpload(key: string, url: string, upload: PhotoUpload) {
    setPhotos((prev) => prev.map((p) => (p.key === key && p.url === url ? { ...p, upload } : p)));
  }

  async function saveCaption(key: string, photoId: string, caption: string) {
    if (!live) return;
    const result = await captionPhotoAction(live.token, photoId, caption);
    updatePhoto(key, result.ok ? { savedCaption: caption, error: null } : { error: result.error });
  }

  // Network failures retry automatically before asking the customer.
  async function savePhoto(key: string, url: string, file: File, replaces: string | null) {
    if (!live) return;
    for (let attempt = 0; ; attempt++) {
      setUpload(key, url, { status: "uploading", progress: 0 });
      const result = await uploadPhoto(live.token, file, replaces, (progress) =>
        setUpload(key, url, { status: "uploading", progress }),
      );
      if (result.ok) {
        setUpload(key, url, { status: "saved", id: result.photo.id });
        // A caption typed while the photo was uploading (or kept from a
        // replaced photo) is saved onto the new one.
        const typed = latestCaption.current.get(key)?.trim();
        if (typed) void saveCaption(key, result.photo.id, typed);
        else updatePhoto(key, { savedCaption: "" });
        return;
      }
      if (!result.retryable || attempt >= 2) {
        setUpload(key, url, { status: "failed", error: result.error, retryable: result.retryable, file, replaces });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }

  function queueUpload(key: string, url: string, file: File, replaces: string | null) {
    uploadQueue.current = uploadQueue.current.then(() => savePhoto(key, url, file, replaces));
  }

  function initialUpload(file: File, replaces: string | null): PhotoUpload {
    if (!live) return { status: "local" };
    if (file.size > INTAKE_PHOTO_MAX_BYTES) {
      return {
        status: "failed",
        error: "This photo is larger than 10 MB. Retake it or choose a smaller one.",
        retryable: false,
        file,
        replaces,
      };
    }
    return { status: "uploading", progress: 0 };
  }

  // Returns the keys of the photos added.
  function addPhotos(files: File[]): string[] {
    setNotice(null);
    const room = INTAKE_PHOTO_MAX_COUNT - photos.length;
    if (files.length > room) {
      setNotice(`You can add up to ${INTAKE_PHOTO_MAX_COUNT} photos, so only the first ${room} were added.`);
    }
    const added = files.slice(0, Math.max(room, 0)).map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      const photo: Photo = {
        key: crypto.randomUUID(),
        url,
        caption: "",
        savedCaption: "",
        upload: initialUpload(file, null),
        rotation: 0,
        busy: null,
        error: null,
      };
      return { file, photo };
    });
    setPhotos((prev) => [...prev, ...added.map((a) => a.photo)]);
    for (const { file, photo } of added) {
      if (photo.upload.status === "uploading") queueUpload(photo.key, photo.url, file, null);
    }
    return added.map((a) => a.photo.key);
  }

  // Replaces a photo in place. A saved photo is swapped on the server only
  // once the new one is stored, so a failed upload never loses the old one.
  function replacePhoto(photo: Photo, file: File) {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const replaces =
      photo.upload.status === "saved"
        ? photo.upload.id
        : photo.upload.status === "failed"
          ? photo.upload.replaces
          : null;
    const upload = initialUpload(file, replaces);
    latestCaption.current.set(photo.key, photo.caption);
    updatePhoto(photo.key, { url, upload, rotation: 0, error: null });
    if (upload.status === "uploading") queueUpload(photo.key, url, file, replaces);
  }

  async function removePhoto(photo: Photo) {
    if (live && photo.upload.status === "saved") {
      updatePhoto(photo.key, { busy: "removing", error: null });
      const result = await removePhotoAction(live.token, photo.upload.id);
      if (!result.ok) {
        updatePhoto(photo.key, { busy: null, error: result.error });
        return;
      }
    }
    // Failed uploads were already cleaned up on the server.
    setPhotos((prev) => prev.filter((p) => p.key !== photo.key));
    setNotice(null);
  }

  async function rotatePhoto(photo: Photo) {
    if (!live) {
      updatePhoto(photo.key, (p) => ({ rotation: (p.rotation + 90) % 360 }));
      return;
    }
    if (photo.upload.status !== "saved") return;
    updatePhoto(photo.key, { busy: "rotating", error: null });
    const result = await rotatePhotoAction(live.token, photo.upload.id);
    updatePhoto(
      photo.key,
      result.ok ? { busy: null, url: result.thumbnailUrl } : { busy: null, error: result.error },
    );
  }

  function commitCaption(photo: Photo) {
    const caption = photo.caption.trim();
    if (photo.upload.status === "saved" && caption !== photo.savedCaption) {
      void saveCaption(photo.key, photo.upload.id, caption);
    }
  }

  // Saves one answer. Returns an error message, or null when saved.
  async function saveAnswer(question: IntakeQuestion, value: AnswerValue): Promise<string | null> {
    if (live) {
      const result = await saveAnswerAction(live.token, question.id, value);
      if (!result.ok) return result.error;
      value = result.value;
    }
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    return null;
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    if (live) {
      const result = await submitIntakeAction(live.token, note);
      if (!result.ok) {
        setSubmitting(false);
        setSubmitError(result.error);
        return;
      }
    }
    setStep({ kind: "done" });
  }

  if (step.kind === "welcome") {
    return (
      <Screen
        embedded={embedded}
        action={<Primary onClick={() => setStep({ kind: "photos" })}>Start with a photo</Primary>}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-ink font-display font-extrabold text-white">
            {initials(businessName)}
          </div>
          <div>
            <b>{businessName}</b>
            {businessPhone ? <p className="text-sm text-muted">{businessPhone}</p> : null}
          </div>
        </div>
        <h1 className="mt-6 font-display text-[30px] font-bold leading-[1.08] tracking-tight">
          Hi {customerName}, help us fix it in one trip.
        </h1>
        <p className="mt-2 text-muted">
          {businessName} asked for a few photos and quick answers so they bring the right parts.
        </p>
        <div className="my-5 grid grid-cols-3 gap-2.5 text-center text-sm">
          <Effort big={`${INTAKE_PHOTO_MIN_COUNT}–${INTAKE_PHOTO_MAX_COUNT}`} label="photos" />
          <Effort big="~3" label="quick taps" />
          <Effort big="2 min" label="total" />
        </div>
        <p className="text-sm text-muted">
          No app or account. Only {businessName} sees your photos. We’ll never ask you to open covers or touch
          wiring. Submitting doesn’t book an appointment.
        </p>
      </Screen>
    );
  }

  if (step.kind === "photos") {
    const full = photos.length >= INTAKE_PHOTO_MAX_COUNT;
    const blocker = pending
      ? "Wait for your photos to finish saving."
      : failedCount > 0
        ? "Try again or remove the photo that didn’t save."
        : null;
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "welcome" })}
        corner={`${photos.length} of ${INTAKE_PHOTO_MAX_COUNT}`}
        action={
          photos.length > 0 ? (
            <Primary onClick={goToReading} disabled={!canContinue}>
              {pending ? "Saving…" : "Done with photos"}
            </Primary>
          ) : (
            <>
              <PhotoInput multiple onFiles={addPhotos} variant="secondary">
                Upload
              </PhotoInput>
              <PhotoInput capture onFiles={addPhotos} grow>
                📷 Take photo
              </PhotoInput>
            </>
          )
        }
      >
        <h1 className="font-display text-2xl font-bold leading-tight">Show us the problem</h1>
        <p className="mb-3 mt-1 text-[15px] text-muted">These help most. Don’t open covers.</p>
        <PhotoChecklist count={photos.length} />

        {photos.length === 0 ? (
          <figure className="relative mt-4 overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- static example */}
            <img src="/landing/ac-condenser.jpg" alt="Example: a whole outdoor AC unit in frame" className="aspect-[4/3] w-full object-cover" />
            <span className="absolute left-2.5 top-2.5 rounded-lg bg-black/70 px-2 py-1 text-xs font-bold text-white">Like this</span>
            <figcaption className="bg-white px-3 py-2 text-sm text-muted">
              The whole thing in frame, from a few steps back. Photo: Tony Webster, CC BY 4.0
            </figcaption>
          </figure>
        ) : null}

        {photos.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {photos.map((photo, index) => (
              <PhotoCard
                key={photo.key}
                photo={photo}
                index={index}
                canRotate={!live || photo.upload.status === "saved"}
                onCaption={(caption) => {
                  latestCaption.current.set(photo.key, caption);
                  updatePhoto(photo.key, { caption });
                }}
                onCaptionDone={() => commitCaption(photo)}
                onRotate={() => void rotatePhoto(photo)}
                onReplace={(file) => replacePhoto(photo, file)}
                onRemove={() => void removePhoto(photo)}
                onRetry={(failed) => {
                  setUpload(photo.key, photo.url, { status: "uploading", progress: 0 });
                  queueUpload(photo.key, photo.url, failed.file, failed.replaces);
                }}
              />
            ))}
          </ul>
        ) : null}

        {notice ? (
          <p role="status" className="mt-3 rounded-xl bg-chip p-3 text-[15px]">
            {notice}
          </p>
        ) : null}
        {blocker ? <p className="mt-3 text-sm text-muted">{blocker}</p> : null}

        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => setStep({ kind: "no-photo" })}
            className="mt-4 min-h-12 font-bold text-accent-strong"
          >
            I can’t take a photo
          </button>
        ) : full ? (
          <p className="mt-3 text-sm text-muted">That’s the most photos you can add. Remove one to add another.</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <PhotoInput multiple onFiles={addPhotos} variant="secondary">
              Upload another
            </PhotoInput>
            <PhotoInput capture onFiles={addPhotos} variant="secondary">
              📷 Take another
            </PhotoInput>
          </div>
        )}
      </Screen>
    );
  }

  if (step.kind === "no-photo") {
    return (
      <NoPhotoStep
        embedded={embedded}
        initial={description}
        onBack={() => setStep({ kind: "photos" })}
        onSave={async (text) => {
          if (live) {
            const result = await saveDescriptionAction(live.token, text);
            if (!result.ok) return result.error;
          }
          setDescription(text);
          goToReading();
          return null;
        }}
      />
    );
  }

  if (step.kind === "reading") {
    const backToSend = () => setStep(savedCount > 0 ? { kind: "photos" } : { kind: "no-photo" });
    if (analysis.status === "loading") {
      return (
        <Screen embedded={embedded} action={<Primary disabled onClick={() => {}}>Almost ready…</Primary>}>
          <h1 className="mt-2 font-display text-2xl font-bold">
            {savedCount > 0 ? "Looking at your photos…" : "Reading your description…"}
          </h1>
          <p className="mb-4 mt-1.5 text-[15px] text-muted">Usually under a minute. Keep this page open.</p>
          <ReadingProgress startedAt={analysisStartedAt} photoCount={savedCount} />
        </Screen>
      );
    }
    if (analysis.status === "failed") {
      return (
        <Screen
          embedded={embedded}
          back={backToSend}
          action={
            <>
              <Secondary
                onClick={() => {
                  setSkipQuestions(true);
                  setStep({ kind: "note" });
                }}
              >
                Send without
              </Secondary>
              <Primary onClick={() => void runAnalysis()}>Try again</Primary>
            </>
          }
        >
          <h1 className="font-display text-2xl font-bold">We couldn’t finish that</h1>
          <p role="alert" className="mt-1.5 text-[15px]">
            {analysis.error}
          </p>
          <p className="mt-2 text-sm text-muted">Your photos are saved. {firstName} will still see everything you send.</p>
        </Screen>
      );
    }

    const issues = analysis.view.photoIssues;
    const seen = analysis.view.seen;
    return (
      <Screen
        embedded={embedded}
        back={backToSend}
        action={
          issues.length > 0 ? (
            <>
              <Secondary onClick={() => afterReading()}>Continue anyway</Secondary>
              <Primary onClick={() => setStep({ kind: "photos" })}>Fix my photos</Primary>
            </>
          ) : (
            <Primary onClick={() => afterReading()}>
              {questions.length ? "Answer a few quick questions" : "Continue"}
            </Primary>
          )
        }
      >
        <h1 className="mt-2 font-display text-2xl font-bold">
          {issues.length ? "A photo could be better" : "Thanks, that helps"}
        </h1>
        <p className="mb-3 mt-1.5 text-[15px] text-muted">
          {issues.length
            ? "Fixing this helps them bring the right parts, but you can continue if you can’t."
            : questions.length
              ? `${questions.length} quick question${questions.length === 1 ? "" : "s"} about what the photos can’t show.`
              : "That’s all we need from the photos."}
        </p>
        <ul aria-live="polite">
          {seen.length ? (
            seen.map((line) => <ReadingLine key={line} state="done" label="We read" result={line} />)
          ) : (
            <ReadingLine state="done" label={savedCount > 0 ? "Your photos" : "Your description"} result="Received" />
          )}
          {questions.length ? <ReadingLine state="done" label="Your questions" result="Written for your job" /> : null}
        </ul>
        {issues.length ? (
          <ul className="mt-4 flex flex-col gap-2.5">
            {issues.map((issue) => {
              const index = photos.findIndex((p) => p.upload.status === "saved" && p.upload.id === issue.photoId);
              return (
                <li key={issue.photoId} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
                  {index >= 0 ? (
                    <div className="w-20 shrink-0">
                      <PhotoImage photo={photos[index]} alt={`Photo ${index + 1}`} />
                    </div>
                  ) : null}
                  <div className="text-[15px]">
                    <b>{index >= 0 ? `Photo ${index + 1}` : "A photo"}</b>
                    <p>{issue.message}</p>
                    {issue.requestedView ? <p className="text-sm text-muted">Try: {issue.requestedView}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        <SafetyNotice concern={analysis.view.urgentConcern} firstName={firstName} />
      </Screen>
    );
  }

  if (step.kind === "question") {
    const question = questions[step.index];
    if (!question) {
      return <p className="p-6 text-muted">Loading questions…</p>;
    }
    return (
      <QuestionStep
        key={question.id}
        embedded={embedded}
        question={question}
        number={step.index + 1}
        saved={answers[question.id]}
        urgentConcern={view.urgentConcern}
        firstName={firstName}
        canAddPhoto={photos.length < INTAKE_PHOTO_MAX_COUNT}
        photos={photos}
        onAddPhoto={(file) => addPhotos([file])[0] ?? null}
        onBack={() =>
          setStep(step.index > 0 ? { kind: "question", index: step.index - 1 } : { kind: "reading" })
        }
        onSave={async (value) => {
          const error = await saveAnswer(question, value);
          if (!error) afterQuestions(step.index);
          return error;
        }}
      />
    );
  }

  if (step.kind === "note") {
    return (
      <Screen
        embedded={embedded}
        back={() =>
          setStep(questions.length ? { kind: "question", index: questions.length - 1 } : { kind: "reading" })
        }
        corner="Last one, optional"
        action={<Primary onClick={() => setStep({ kind: "review" })}>Review and send</Primary>}
      >
        <label htmlFor="intake-note" className="block font-display text-2xl font-bold leading-tight">
          Anything else {firstName} should know?
        </label>
        <p className="mb-3 mt-1.5 text-[15px] text-muted">In your own words. Your keyboard’s mic works here too.</p>
        <textarea
          id="intake-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="e.g. It stopped after the heat wave"
          className={`${inputClassName} h-auto w-full py-3 text-[17px]`}
        />
      </Screen>
    );
  }

  if (step.kind === "review") {
    return (
      <Screen
        embedded={embedded}
        back={() => setStep({ kind: "note" })}
        action={
          <Primary onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Sending…" : `Send to ${firstName}`}
          </Primary>
        }
      >
        <h1 className="font-display text-2xl font-bold">Look right?</h1>
        <p className="mb-3 mt-1 text-[15px] text-muted">Tap anything to change it.</p>
        {photos.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo.key}
                type="button"
                onClick={() => setStep({ kind: "photos" })}
                className="text-left"
              >
                <PhotoImage photo={photo} alt={photo.caption || `Photo ${index + 1}`} />
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl border border-line bg-white px-4">
          {savedCount === 0 ? (
            <ReviewRow
              label="Your description"
              value={description ? `“${description}”` : "Nothing added"}
              onClick={() => setStep({ kind: "no-photo" })}
            />
          ) : null}
          {questions.map((q, i) => (
            <ReviewRow
              key={q.id}
              label={q.label}
              value={formatAnswer(answers[q.id])}
              onClick={() => setStep({ kind: "question", index: i })}
            />
          ))}
          <ReviewRow label="Anything else" value={note ? `“${note}”` : "Nothing added"} onClick={() => setStep({ kind: "note" })} />
        </div>
        {submitError ? (
          <p role="alert" className="mt-3 rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
            {submitError}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-muted">
          {questions.length ? "Questions were written by AI from what you sent; the answers are yours. " : ""}
          Your photos and answers are processed with AI and shared with {businessName} to prepare for the visit.
        </p>
      </Screen>
    );
  }

  return (
    <Screen embedded={embedded}>
      <div className="pt-8 text-center">
        <div className="mx-auto grid h-19 w-19 place-items-center rounded-full bg-ok-soft text-4xl text-ok">✓</div>
        <h1 className="mt-4 font-display text-[28px] font-bold">Sent to {firstName}</h1>
        <p className="mt-1 text-muted">
          They’ll be in touch{businessPhone ? ` from ${businessPhone}` : ""} to set a time.
        </p>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-white p-4">
        <span className="text-[11.5px] font-bold uppercase tracking-widest text-muted">What happens next</span>
        <p className="mt-1.5">{firstName} reviews what you sent and brings the likely part, so it can be one visit.</p>
        {estimatesEnabled ? (
          <p className="mt-2 text-muted">
            They may also send a preliminary estimate after reviewing. If they do, you’ll see it at this same link.
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-center text-sm text-muted">This isn’t a confirmed appointment. You can close this page.</p>
    </Screen>
  );
}

/* ---------- pieces ---------- */

// Mobile-first column with a sticky action bar at the bottom.
function Screen({
  children,
  action,
  embedded,
  back,
  corner,
}: {
  children: ReactNode;
  action?: ReactNode;
  back?: () => void;
  corner?: string;
  embedded?: boolean;
}) {
  return (
    <div className={`flex flex-col bg-page text-[17px] text-ink ${embedded ? "min-h-[640px] rounded-lg" : "min-h-dvh"}`}>
      <div className="mx-auto w-full max-w-[520px] flex-1 px-5 pb-6 pt-5">
        {back || corner ? (
          <div className="mb-3 flex items-center justify-between">
            {back ? (
              <button type="button" onClick={back} className="min-h-12 font-bold text-accent-strong">
                ← Back
              </button>
            ) : (
              <span />
            )}
            {corner ? <span className="text-sm text-muted">{corner}</span> : null}
          </div>
        ) : null}
        {children}
      </div>
      {action ? (
        <div className="sticky bottom-0 border-t border-line bg-page">
          <div className="mx-auto flex w-full max-w-[520px] gap-2 px-5 pb-5 pt-3">{action}</div>
        </div>
      ) : null}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-5 font-bold disabled:cursor-not-allowed disabled:opacity-40";

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${buttonBase} flex-[2] bg-accent text-accent-ink`}>
      {children}
    </button>
  );
}

function Secondary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${buttonBase} flex-1 border-[1.5px] border-line bg-white`}>
      {children}
    </button>
  );
}

// The shots that help most, ticked off as photos are added. Generic on
// purpose: the link doesn't know the trade.
const PHOTO_CHECKLIST = [
  ["The whole thing", "the unit, appliance, or area that isn’t working"],
  ["A close-up of the problem", "a leak, damage, or an error on a screen"],
  ["The brand or model sticker", "only if it’s easy to see"],
] as const;

function PhotoChecklist({ count }: { count: number }) {
  return (
    <ol className="rounded-2xl border border-line bg-white px-4">
      {PHOTO_CHECKLIST.map(([title, hint], i) => {
        const done = i < count;
        return (
          <li key={title} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
            <span
              aria-hidden
              className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${
                done ? "bg-accent text-accent-ink" : "bg-chip text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <div className="text-[15px]">
              <b>{title}</b>
              <span className="sr-only">{done ? " (added)" : ""}</span>
              <p className="text-sm text-muted">{hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Time-based: the AI call reports no progress, so the bar eases toward 90%
// and the next screen replaces it the moment the questions arrive. Stage
// labels follow typical timing.
function ReadingProgress({ startedAt, photoCount }: { startedAt: number; photoCount: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, (now - (startedAt || now)) / 1000);
  const percent = Math.round(90 * (1 - Math.exp(-seconds / 14)));
  const photoStage = photoCount > 0 && seconds < photoCount * 4;
  const stage = photoStage
    ? `Looking at photo ${Math.min(photoCount, Math.floor(seconds / 4) + 1)} of ${photoCount}…`
    : seconds < photoCount * 4 + 8
      ? "Reading labels and details…"
      : "Writing your questions…";
  return (
    <div>
      <div
        role="progressbar"
        aria-label="Reading what you sent"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-3 overflow-hidden rounded-full bg-chip"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p aria-live="polite" className="mt-2 flex justify-between text-sm text-muted">
        <span>{stage}</span>
        <span>{percent}%</span>
      </p>
      <ul className="mt-3">
        <ReadingLine state={photoStage ? "active" : "done"} label={photoCount > 0 ? "Your photos" : "Your description"} result={photoStage ? undefined : "Read"} />
        <ReadingLine state={photoStage ? "todo" : "active"} label="Your questions" />
      </ul>
    </div>
  );
}

function ReadingLine({
  state,
  label,
  result,
}: {
  state: "done" | "active" | "todo";
  label: string;
  result?: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-line py-3">
      <span
        aria-hidden
        className={`grid h-6.5 w-6.5 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${
          state === "done"
            ? "bg-accent text-accent-ink"
            : state === "active"
              ? "animate-spin border-[3px] border-line border-t-accent-strong"
              : "bg-chip"
        }`}
      >
        {state === "done" ? "✓" : ""}
      </span>
      <div>
        <b>{label}</b>
        <p className="text-sm text-muted">{result ?? "…"}</p>
      </div>
    </li>
  );
}

// General safety guidance only; never repair instructions (spec §6).
function SafetyNotice({ concern, firstName }: { concern: string | null; firstName: string }) {
  if (!concern) return null;
  return (
    <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-[15px] font-semibold text-danger">
      ⚠ Something you sent may need attention soon. If you smell gas, see smoke or sparks, or there’s water near
      anything electrical, leave the area and call 911 or your utility’s emergency line. We’ve flagged this for{" "}
      {firstName}.
    </p>
  );
}

function QuestionStep({
  embedded,
  question,
  number,
  saved,
  urgentConcern,
  firstName,
  canAddPhoto,
  photos,
  onAddPhoto,
  onBack,
  onSave,
}: {
  embedded: boolean;
  question: IntakeQuestion;
  number: number;
  saved: AnswerValue | undefined;
  urgentConcern: string | null;
  firstName: string;
  canAddPhoto: boolean;
  photos: Photo[];
  /** Adds a photo to the intake; returns its key. */
  onAddPhoto: (file: File) => string | null;
  onBack: () => void;
  /** Returns an error message, or null when saved. */
  onSave: (value: AnswerValue) => Promise<string | null>;
}) {
  const [text, setText] = useState(saved?.kind === "text" ? saved.text : "");
  const [choice, setChoice] = useState(saved?.kind === "choice" ? saved.choice : "");
  const [choices, setChoices] = useState<string[]>(saved?.kind === "choices" ? saved.choices : []);
  const [numberText, setNumberText] = useState(saved?.kind === "number" ? String(saved.value) : "");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photo = photoKey ? photos.find((p) => p.key === photoKey) : undefined;
  const options = question.type === "yes_no_unknown" ? [...YES_NO_UNKNOWN_OPTIONS] : question.options;

  // The answer as currently entered, or null if nothing is entered yet.
  function current(): AnswerValue | null {
    switch (question.type) {
      case "short_text":
      case "long_text":
        return text.trim() ? { kind: "text", text: text.trim() } : null;
      case "single_select":
      case "yes_no_unknown":
        return choice ? { kind: "choice", choice } : null;
      case "multi_select":
        return choices.length ? { kind: "choices", choices } : null;
      case "number_with_units": {
        const value = Number(numberText);
        return numberText.trim() && Number.isFinite(value) ? { kind: "number", value, unit: question.unit } : null;
      }
      case "photo_request":
        if (photo?.upload.status === "saved") return { kind: "photo", photoId: photo.upload.id };
        // Previews and the demo don't upload; any photo counts.
        if (photo?.upload.status === "local") return { kind: "photo", photoId: photo.key };
        if (saved?.kind === "photo") return saved;
        return null;
    }
  }

  const answer = current();
  const photoPending = photo?.upload.status === "uploading";

  async function save(value: AnswerValue) {
    setSaving(true);
    setError(null);
    // Answers stay on screen if saving fails, so nothing typed is lost.
    const failure = await onSave(value);
    setSaving(false);
    setError(failure);
  }

  return (
    <Screen
      embedded={embedded}
      back={onBack}
      corner={`Question ${number}`}
      action={
        <>
          {question.allowUnknown && question.type !== "yes_no_unknown" ? (
            <Secondary disabled={saving} onClick={() => void save({ kind: "unknown" })}>
              I don’t know
            </Secondary>
          ) : null}
          <Primary
            disabled={saving || photoPending || (question.required && !answer)}
            onClick={() => void save(answer ?? { kind: "skipped" })}
          >
            {saving ? "Saving…" : answer || question.required ? "Next" : "Skip"}
          </Primary>
        </>
      }
    >
      {/* No total: the number of questions can change as the customer answers. */}
      <p className="mb-3 flex gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
        <span aria-hidden>💡</span>
        <span>{question.reason}</span>
      </p>
      <fieldset>
        <legend className="font-display text-2xl font-bold leading-tight">
          {question.label}
          {question.required ? <span className="sr-only"> (required)</span> : null}
        </legend>
        {question.help ? <p className="mb-4 mt-1.5 text-[15px] text-muted">{question.help}</p> : <div className="mb-4" />}

        {question.type === "short_text" || question.type === "long_text" ? (
          <>
            <label htmlFor={`answer-${question.id}`} className="sr-only">
              Your answer
            </label>
            {question.type === "short_text" ? (
              <input
                id={`answer-${question.id}`}
                type="text"
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                className={`${inputClassName} w-full text-[17px]`}
              />
            ) : (
              <textarea
                id={`answer-${question.id}`}
                value={text}
                rows={4}
                maxLength={MAX_TEXT_ANSWER_LENGTH}
                onChange={(e) => setText(e.target.value)}
                className={`${inputClassName} h-auto w-full py-3 text-[17px]`}
              />
            )}
          </>
        ) : null}

        {question.type === "single_select" || question.type === "yes_no_unknown" || question.type === "multi_select" ? (
          <div className="flex flex-col gap-2.5">
            {options.map((option) => {
              const multi = question.type === "multi_select";
              const selected = multi ? choices.includes(option) : choice === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    multi
                      ? setChoices((prev) => (prev.includes(option) ? prev.filter((c) => c !== option) : [...prev, option]))
                      : setChoice(option)
                  }
                  className={`flex min-h-[58px] items-center justify-between rounded-2xl border-[1.5px] px-4 text-left font-semibold ${
                    selected ? "border-accent-strong bg-accent-soft" : "border-line bg-white"
                  }`}
                >
                  {option}
                  {selected ? <span className="font-extrabold text-accent-strong">✓</span> : null}
                </button>
              );
            })}
            {question.type === "multi_select" ? <p className="text-sm text-muted">Choose all that apply.</p> : null}
          </div>
        ) : null}

        {question.type === "number_with_units" ? (
          <div className="flex items-center gap-2">
            <label htmlFor={`answer-${question.id}`} className="sr-only">
              Your answer{question.unit ? ` in ${question.unit}` : ""}
            </label>
            <input
              id={`answer-${question.id}`}
              type="number"
              inputMode="decimal"
              value={numberText}
              onChange={(e) => setNumberText(e.target.value)}
              className={`${inputClassName} w-32 text-[17px]`}
            />
            {question.unit ? <span className="text-muted">{question.unit}</span> : null}
          </div>
        ) : null}

        {question.type === "photo_request" ? (
          <div className="flex flex-col gap-3">
            {photo ? (
              <>
                <PhotoImage photo={photo} alt={question.label} />
                <UploadStatus upload={photo.upload} onRetry={() => setPhotoKey(null)} />
              </>
            ) : saved?.kind === "photo" ? (
              <p className="text-sm text-muted">You already sent a photo for this.</p>
            ) : null}
            {canAddPhoto || photo ? (
              <div className="flex gap-2">
                <PhotoInput disabled={photoPending} variant="secondary" onFiles={(files) => setPhotoKey(onAddPhoto(files[0]))}>
                  Upload
                </PhotoInput>
                <PhotoInput
                  capture
                  grow
                  disabled={photoPending}
                  variant={photo ? "secondary" : "primary"}
                  onFiles={(files) => setPhotoKey(onAddPhoto(files[0]))}
                >
                  {photo ? "📷 Retake" : "📷 Take photo"}
                </PhotoInput>
              </div>
            ) : (
              <p className="text-sm text-muted">You’ve added the most photos you can. You can skip this one.</p>
            )}
          </div>
        ) : null}
      </fieldset>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <SafetyNotice concern={urgentConcern} firstName={firstName} />
    </Screen>
  );
}

function PhotoInput({
  children,
  onFiles,
  capture,
  multiple,
  variant = "primary",
  grow,
  disabled,
  compact,
}: {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  capture?: boolean;
  multiple?: boolean;
  variant?: "primary" | "secondary";
  grow?: boolean;
  disabled?: boolean;
  /** A small text-style control, for photo card actions. */
  compact?: boolean;
}) {
  const className = compact
    ? "inline-flex min-h-10 items-center text-sm font-bold text-accent-strong"
    : `${buttonBase} ${grow ? "flex-[2]" : "flex-1"} ${
        variant === "primary" ? "bg-accent text-accent-ink" : "border-[1.5px] border-line bg-white"
      }`;
  return (
    <label
      aria-disabled={disabled}
      className={`${className} ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-strong`}
    >
      {children}
      <input
        type="file"
        disabled={disabled}
        multiple={multiple}
        // JPEG first so iOS Safari converts HEIC on the phone (see
        // docs/design/research); HEIC that still arrives is converted on the server.
        accept="image/jpeg,image/png,image/webp,image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function PhotoImage({ photo, alt }: { photo: Photo; alt: string }) {
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-chip">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob or short-lived signed URL */}
      <img
        src={photo.url}
        alt={alt}
        style={photo.rotation ? { transform: `rotate(${photo.rotation}deg)` } : undefined}
        className="size-full object-contain"
      />
    </div>
  );
}

function PhotoCard({
  photo,
  index,
  canRotate,
  onCaption,
  onCaptionDone,
  onRotate,
  onReplace,
  onRemove,
  onRetry,
}: {
  photo: Photo;
  index: number;
  canRotate: boolean;
  onCaption: (caption: string) => void;
  onCaptionDone: () => void;
  onRotate: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
  onRetry: (failed: Extract<PhotoUpload, { status: "failed" }>) => void;
}) {
  const label = `Photo ${index + 1}`;
  const busy = photo.busy !== null || photo.upload.status === "uploading";
  const actionClassName = "min-h-10 text-sm font-bold text-accent-strong disabled:opacity-40";
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3">
      <PhotoImage photo={photo} alt={photo.caption || label} />
      <UploadStatus upload={photo.upload} onRetry={onRetry} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`caption-${photo.key}`} className="text-[13px] font-bold">
          What does this show? <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={`caption-${photo.key}`}
          type="text"
          value={photo.caption}
          maxLength={INTAKE_CAPTION_MAX_LENGTH}
          placeholder="e.g. The outdoor unit"
          onChange={(e) => onCaption(e.target.value)}
          onBlur={onCaptionDone}
          className={inputClassName}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4">
        <span className="text-sm font-bold text-muted">{label}</span>
        <button type="button" onClick={onRotate} disabled={!canRotate || busy} className={actionClassName}>
          {photo.busy === "rotating" ? "Rotating…" : "Rotate"}
        </button>
        <PhotoInput compact onFiles={(files) => onReplace(files[0])} disabled={busy}>
          Retake
        </PhotoInput>
        <button type="button" onClick={onRemove} disabled={busy} className={actionClassName}>
          {photo.busy === "removing" ? "Removing…" : "Remove"}
        </button>
      </div>
      {photo.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {photo.error}
        </p>
      ) : null}
    </li>
  );
}

function NoPhotoStep({
  embedded,
  initial,
  onBack,
  onSave,
}: {
  embedded: boolean;
  initial: string;
  onBack: () => void;
  /** Returns an error message, or null on success. */
  onSave: (description: string) => Promise<string | null>;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Screen
      embedded={embedded}
      back={onBack}
      action={
        <Primary
          disabled={saving}
          onClick={async () => {
            if (!text.trim()) {
              setError("Describe the problem so they know what to expect.");
              return;
            }
            setSaving(true);
            const failure = await onSave(text.trim());
            setSaving(false);
            setError(failure);
          }}
        >
          {saving ? "Saving…" : "Continue"}
        </Primary>
      }
    >
      <label htmlFor="no-photo-description" className="block font-display text-2xl font-bold leading-tight">
        Tell us what’s wrong
      </label>
      <p className="mb-3 mt-1.5 text-[15px] text-muted">
        No problem if you can’t take a photo. Describe what you see, hear, or smell, where it is, and when it started.
      </p>
      <textarea
        id="no-photo-description"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        rows={6}
        maxLength={INTAKE_DESCRIPTION_MAX_LENGTH}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "no-photo-error" : undefined}
        placeholder="e.g. The AC runs but the air is warm. The outdoor fan isn’t spinning. Started yesterday."
        className={`${inputClassName} h-auto w-full py-3 text-[17px]`}
      />
      {error ? (
        <p id="no-photo-error" role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={onBack} className="mt-3 min-h-12 font-bold text-accent-strong">
        Add a photo instead
      </button>
    </Screen>
  );
}

// Upload progress for live links. Previews and the demo show nothing.
function UploadStatus({
  upload,
  onRetry,
}: {
  upload: PhotoUpload;
  onRetry: (failed: Extract<PhotoUpload, { status: "failed" }>) => void;
}) {
  if (upload.status === "local") return null;
  if (upload.status === "saved") {
    return <p className="text-sm font-semibold text-ok">✓ Photo saved</p>;
  }
  if (upload.status === "uploading") {
    const percent = Math.round(upload.progress * 100);
    return (
      <div aria-live="polite" className="space-y-1">
        <p className="text-sm text-muted">{percent < 100 ? `Saving photo… ${percent}%` : "Saving photo…"}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-chip">
          <div className="h-full bg-accent-strong transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-danger-soft p-3 text-[15px] text-danger">
      <span>{upload.error}</span>
      {upload.retryable ? (
        <button type="button" onClick={() => onRetry(upload)} className="shrink-0 font-bold underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

// XMLHttpRequest rather than fetch, which can't report upload progress.
function uploadPhoto(
  token: string,
  file: File,
  replaces: string | null,
  onProgress: (progress: number) => void,
): Promise<{ ok: true; photo: IntakePhoto } | { ok: false; error: string; retryable: boolean }> {
  const failed = { ok: false as const, error: "Your photo didn’t save. Check your connection.", retryable: true };
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/i/${token}/photos`);
    xhr.setRequestHeader("X-Intake-Upload", "1");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body = xhr.response as { photo?: IntakePhoto; error?: string } | null;
      if (xhr.status === 200 && body?.photo) resolve({ ok: true, photo: body.photo });
      // 4xx: the photo or link was rejected; retrying won't help.
      else if (xhr.status >= 400 && xhr.status < 500 && body?.error) resolve({ ok: false, error: body.error, retryable: false });
      else resolve(failed);
    };
    xhr.onerror = () => resolve(failed);

    const form = new FormData();
    form.append("photo", file);
    if (replaces) form.append("replaces", replaces);
    xhr.send(form);
  });
}

function ReviewRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 w-full justify-between gap-3 border-t border-line py-3 text-left first:border-t-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </button>
  );
}

function Effort({ big, label }: { big: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <b className="block font-display text-2xl">{big}</b>
      {label}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
