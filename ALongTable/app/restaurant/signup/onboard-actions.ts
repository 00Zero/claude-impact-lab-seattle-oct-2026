"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { isValidLatLng } from "@/lib/geocode";
import { pinRestaurant } from "@/lib/restaurant-pins";
import {
  OnboardingError,
  profileFromClient,
  suggestSpots,
  type ExistingSpot,
  type SpotSuggestion,
} from "@/lib/onboarding";
import { getCurrentRestaurant, setCurrentRestaurant } from "@/lib/session";
import { AREAS, CAPACITIES, FEATURES, PRICES, SLOTS } from "@/lib/space-options";
import { parseHouseRules } from "@/lib/house-rules";
import { createSpace, listSpaces, registerRestaurant, setHouseRules } from "@/lib/spaces";
import { seattleDateKey, seattleHHMM, seattleToUtc, upcomingDays } from "@/lib/time";

// Server actions for the "Set up from Google Maps" flow on /restaurant/signup.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Register (or sign back in to) the restaurant the owner confirmed. `pin` comes from their
 * Google Maps link; without one, the location is geocoded after the response is sent.
 * `returning` is true when it already has spaces, so the UI can offer a way straight to the dashboard.
 */
export async function registerFromProfile(
  name: string,
  location: string,
  pin?: { lat: number; lng: number } | null,
): Promise<Result<{ returning: boolean }>> {
  name = String(name ?? "").trim();
  location = String(location ?? "").trim();
  if (!name || !location) return { ok: false, error: "Enter your restaurant's name and location." };
  try {
    const restaurant = await registerRestaurant(name.slice(0, 120), location.slice(0, 160));
    await setCurrentRestaurant(restaurant.id);
    after(() => pinRestaurant(restaurant.id, restaurant.name, restaurant.location, isValidLatLng(pin) ? pin : null));
    const returning = (await listSpaces(restaurant.id)).length > 0;
    return { ok: true, returning };
  } catch (err) {
    console.error("registerFromProfile failed", err);
    return { ok: false, error: "We couldn't register your restaurant. Please try again." };
  }
}

/** Suggest spots for the signed-in restaurant, skipping ones it already published. */
export async function getSuggestions(
  profileInput: unknown,
): Promise<Result<{ suggestions: SpotSuggestion[]; basis: "hours" | "estimate" }>> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { ok: false, error: "Please register your restaurant first." };
  const profile = profileFromClient(profileInput);
  if (!profile) return { ok: false, error: "Something was missing from your profile. Please start again." };

  try {
    const existing: ExistingSpot[] = (await listSpaces(restaurant.id)).map((s) => ({
      date: seattleDateKey(new Date(s.startsAt)),
      slot: SLOTS.find((x) => x.start === seattleHHMM(s.startsAt))?.value ?? "other",
      area: s.label,
    }));
    const { suggestions, basis } = await suggestSpots(profile, existing);
    return { ok: true, suggestions, basis };
  } catch (err) {
    console.error("getSuggestions failed", err);
    return {
      ok: false,
      error: err instanceof OnboardingError ? err.message : "We couldn't suggest spots right now. You can publish one yourself.",
    };
  }
}

/** Publish one suggested spot for the signed-in restaurant. Values are re-checked here. */
export async function publishSuggestion(s: SpotSuggestion): Promise<Result> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { ok: false, error: "Please register your restaurant first." };

  const area = AREAS.find((a) => a === s?.area);
  const slot = SLOTS.find((x) => x.value === s?.slot);
  const price = PRICES.find((p) => p.value === s?.price);
  const capacity = (CAPACITIES as readonly number[]).includes(Number(s?.capacity)) ? Number(s.capacity) : null;
  const date = upcomingDays(14).find((d) => d.value === s?.date)?.value;
  const features = (Array.isArray(s?.features) ? s.features : []).filter((f) => (FEATURES as readonly string[]).includes(f));
  if (!area || !slot || !price || !capacity || !date) return { ok: false, error: "That suggestion is no longer valid." };

  const startsAt = seattleToUtc(date, slot.start);
  const endsAt = seattleToUtc(date, slot.end);
  if (startsAt <= new Date()) return { ok: false, error: "That time has already passed." };

  try {
    await createSpace({
      restaurantName: restaurant.name,
      location: restaurant.location,
      label: area,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity,
      description: features.length ? features.join(", ") : null,
      priceInfo: price.info,
    });
  } catch (err) {
    console.error("publishSuggestion failed", err);
    return { ok: false, error: "We couldn't publish that spot. Please try again." };
  }
  revalidatePath("/restaurant");
  return { ok: true };
}

/** Save the house rules the owner chose (cleaned and capped here, whatever the client sent). */
export async function saveHouseRules(rules: unknown): Promise<Result> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { ok: false, error: "Please register your restaurant first." };
  try {
    await setHouseRules(restaurant.id, parseHouseRules(Array.isArray(rules) ? rules.map(String).join("\n") : ""));
  } catch (err) {
    console.error("saveHouseRules failed", err);
    return { ok: false, error: "We couldn't save your house rules. You can publish without them." };
  }
  return { ok: true };
}
