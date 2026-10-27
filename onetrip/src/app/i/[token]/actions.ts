"use server";

import { after } from "next/server";
import {
  analyzeIntake,
  runBriefJob,
  saveIntakeAnswer,
  submitIntake,
  type IntakeActionResult,
} from "@/lib/intake-ai";
import { isIntakeToken } from "@/lib/intake-links";
import {
  removeIntakePhoto,
  rotateIntakePhoto,
  saveIntakeDescription,
  setIntakePhotoCaption,
  type IntakeResult,
} from "@/lib/intake-photos";
import type { AnswerValue, IntakeAnalysisView } from "@/lib/intake-questions";

// Customer intake actions. Customers aren't signed in: every call is
// authorized by the link token, which is checked (active, unexpired, not
// submitted) before anything changes. Uploads go through ./photos/route.ts
// instead so the browser can show progress.

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;
const invalid = { ok: false as const, error: "Something went wrong. Please refresh the page." };

function validIds(token: unknown, photoId?: unknown) {
  return (
    typeof token === "string" &&
    isIntakeToken(token) &&
    (photoId === undefined || (typeof photoId === "string" && UUID_PATTERN.test(photoId)))
  );
}

export async function removePhotoAction(token: string, photoId: string): Promise<IntakeResult> {
  if (!validIds(token, photoId)) return invalid;
  return removeIntakePhoto(token, photoId);
}

export async function rotatePhotoAction(
  token: string,
  photoId: string,
): Promise<IntakeResult<{ thumbnailUrl: string }>> {
  if (!validIds(token, photoId)) return invalid;
  return rotateIntakePhoto(token, photoId);
}

export async function captionPhotoAction(
  token: string,
  photoId: string,
  caption: string,
): Promise<IntakeResult> {
  if (!validIds(token, photoId) || typeof caption !== "string") return invalid;
  return setIntakePhotoCaption(token, photoId, caption);
}

export async function saveDescriptionAction(token: string, description: string): Promise<IntakeResult> {
  if (!validIds(token) || typeof description !== "string") return invalid;
  return saveIntakeDescription(token, description);
}

// Looks at the photos and writes the first questions (C4, C5). Reuses the
// stored result when the photos haven't changed.
export async function analyzeIntakeAction(
  token: string,
): Promise<IntakeActionResult<{ analysis: IntakeAnalysisView }>> {
  if (!validIds(token)) return invalid;
  return analyzeIntake(token);
}

export async function saveAnswerAction(
  token: string,
  questionId: string,
  value: unknown,
): Promise<IntakeActionResult<{ value: AnswerValue }>> {
  if (!validIds(token, questionId)) return invalid;
  return saveIntakeAnswer(token, questionId, value);
}

// Final submission. Safe to repeat: a second call reports success without
// sending twice. The brief is written after the response so the customer
// isn't kept waiting; the job record makes a failure visible and retryable.
export async function submitIntakeAction(
  token: string,
  note: string,
): Promise<IntakeActionResult> {
  if (!validIds(token) || typeof note !== "string") return invalid;
  const result = await submitIntake(token, note);
  if (!result.ok) return result;
  if (result.jobId) {
    const jobId = result.jobId;
    after(() => runBriefJob(jobId));
  }
  return { ok: true };
}
