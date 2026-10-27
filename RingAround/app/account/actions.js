"use server";

import { z } from "zod";
import { getSession } from "@/auth";
import { getApplication, saveApplication } from "@/lib/db";
import { findPlan } from "@/lib/plans";

// The fields checkout collects. Card details are deliberately absent: they
// never leave the checkout form.
const applicationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(120).default(""),
  role: z.string().trim().max(60).default(""),
  plan: z.string().refine((id) => Boolean(findPlan(id))),
});

// Saves the checkout application for the signed-in user. Returns { ok } or { error }.
export async function submitApplication(input) {
  const userId = (await getSession())?.user?.id;
  if (!userId) return { error: "Your sign-in expired. Sign in again to finish checkout." };
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { error: "Some details are missing. Check the form and try again." };
  try {
    await saveApplication(userId, parsed.data);
  } catch (error) {
    console.error("Failed to save application", error);
    return { error: "We couldn’t save your application. Try again in a minute." };
  }
  return { ok: true };
}

// One-time move of an application saved in this browser before applications
// were stored on the server. Never overwrites one the server already has.
// Returns what the server now holds, or null.
export async function importBrowserApplication(input) {
  const userId = (await getSession())?.user?.id;
  if (!userId) return null;
  const existing = await getApplication(userId);
  if (existing) return existing;
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return null;
  await saveApplication(userId, parsed.data);
  return getApplication(userId);
}
