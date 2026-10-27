import type { FitTier, Opportunity } from "./contracts";

// Booking a call with Jon from an opportunity that fits. Jon's public Calendly
// page is the default; NEXT_PUBLIC_BOOKING_URL overrides it per deployment.
// If no valid https link is available the UI shows the button as "coming soon"
// and never pretends a call can be booked.

export const BOOKING_HOST = "Jon";

export const DEFAULT_BOOKING_URL = "https://calendly.com/jjcochran-nxvb";

/** Tiers where a call makes sense: the vendor could plausibly go after the work. */
export const BOOKABLE_TIERS: FitTier[] = ["good_fit", "possible_fit"];

export function bookingBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || DEFAULT_BOOKING_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Booking link for one opportunity. Only the opportunity id travels, as a
 * utm_content tag, so Jon can see which listing the call is about. No profile
 * or account details go into the URL.
 */
export function bookingUrlFor(o: Pick<Opportunity, "id">, base = bookingBaseUrl()): string | null {
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("utm_source", "contract-explorer");
  u.searchParams.set("utm_content", o.id);
  return u.toString();
}
