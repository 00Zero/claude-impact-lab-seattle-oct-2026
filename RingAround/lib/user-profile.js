import { z } from "zod";

export const userProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120, "Use 120 characters or fewer."),
  phone: z.string().trim().max(40, "Enter a valid phone number.")
    .regex(/^\+?[\d\s().-]+$/, "Enter a valid phone number.")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    }, "Enter a phone number containing 7–15 digits. Include the country code where applicable."),
  company: z.string().trim().max(120, "Use 120 characters or fewer.").default(""),
  defaultAddress: z.string().trim().min(10, "Enter a complete street address, including city and postal code.").max(300, "Use 300 characters or fewer."),
});

// Profiles are stored on the server (lib/db.js). Older ones were saved in the
// browser under this key; these two read and clear that copy so it can be
// moved to the server once.
function profileStorageKey(userId) {
  return `ringaround:user-profile:v1:${encodeURIComponent(userId)}`;
}

export function clearBrowserProfile(userId) {
  try {
    window.localStorage.removeItem(profileStorageKey(userId));
  } catch {
    // Storage blocked: nothing was stored here either.
  }
}

export function readUserProfile(userId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(profileStorageKey(userId)) ?? "null");
    const result = userProfileSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
