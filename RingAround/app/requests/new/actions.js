"use server";

import { z } from "zod";
import { getSession } from "@/auth";
import { canStartCalls, startRequestSession } from "@/lib/agent";
import { addLocation, getApplication, getProfile, listLocations, saveProfile } from "@/lib/db";
import { makeRequestSchema, todayIn } from "@/lib/request";
import { userProfileSchema } from "@/lib/user-profile";

const locationSchema = z.object({
  label: z.string().trim().max(60),
  address: z.string().trim().min(8).max(300),
  timeZone: z.string().max(64).optional(),
});

async function signedInUserId() {
  return (await getSession())?.user?.id ?? null;
}

// Saves the profile from the setup dialog. Returns { profile } or { errors }
// keyed by field, or { error } for the form as a whole.
export async function saveProfileAction(input) {
  const userId = await signedInUserId();
  if (!userId) return { error: "Your sign-in expired. Sign in again to save your profile." };
  const result = userProfileSchema.safeParse(input);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) errors[issue.path[0]] ??= issue.message;
    return { errors };
  }
  try {
    await saveProfile(userId, result.data);
  } catch (error) {
    console.error("Failed to save profile", error);
    return { error: "Your profile couldn’t be saved. Try again in a minute." };
  }
  return { profile: result.data };
}

// One-time move of a profile and addresses saved in this browser before they
// were stored on the server. Only runs when the server has no profile yet, so
// it can never overwrite one. Returns what the server now holds.
export async function importBrowserData({ profile, locations }) {
  const userId = await signedInUserId();
  if (!userId) return { profile: null, locations: [] };
  const existing = await getProfile(userId);
  if (existing) return { profile: existing, locations: await listLocations(userId) };

  const parsedProfile = userProfileSchema.safeParse(profile);
  if (parsedProfile.success) await saveProfile(userId, parsedProfile.data);
  for (const location of Array.isArray(locations) ? locations.slice(0, 50) : []) {
    const parsed = locationSchema.safeParse(location);
    if (parsed.success) await addLocation(userId, { ...parsed.data, label: parsed.data.label || parsed.data.address.split(",")[0].trim() });
  }
  return { profile: parsedProfile.success ? parsedProfile.data : null, locations: await listLocations(userId) };
}

// Saves an address from the request form the first time it's used. Returns
// { location, added } or { error }.
export async function saveLocationAction(input) {
  const userId = await signedInUserId();
  if (!userId) return { error: "Your sign-in expired." };
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { error: "That address couldn’t be saved." };
  const before = await listLocations(userId);
  const location = await addLocation(userId, {
    ...parsed.data,
    label: parsed.data.label || parsed.data.address.split(",")[0].trim(),
  });
  return { location, added: !before.some((l) => l.id === location.id) };
}

// Starts the agent on a reviewed request. Returns { sessionId }, { needsAccount,
// hasApplication } for accounts that aren't approved to call yet, or { error }.
export async function sendRequest({ request }) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Your sign-in expired. Sign in again to send this request." };
  // The page hides the button for unapproved accounts; this is the check that counts.
  if (!canStartCalls(session.user.email)) {
    return { needsAccount: true, hasApplication: Boolean(await getApplication(session.user.id)) };
  }

  // Re-validate: everything from the browser is untrusted, including what the
  // form already checked. "Today" is the job site's date, as the form uses.
  const timeZone = typeof request?.timeZone === "string" ? request.timeZone : "UTC";
  const parsedRequest = makeRequestSchema(todayIn(timeZone)).safeParse(request);
  if (!parsedRequest.success) {
    return { error: "Some details are missing or out of date. Edit the request and try again." };
  }
  // The callback number the agent gives out comes from the stored profile,
  // never from the browser.
  const profile = await getProfile(session.user.id);
  if (!profile) return { error: "Finish your profile before sending a request." };

  try {
    const sessionId = await startRequestSession({
      request: parsedRequest.data,
      profile,
      userId: session.user.id,
      email: session.user.email,
    });
    return { sessionId };
  } catch (error) {
    console.error("Failed to start agent session", error);
    return { error: "We couldn’t start the agent. Nothing was sent — try again in a minute." };
  }
}
