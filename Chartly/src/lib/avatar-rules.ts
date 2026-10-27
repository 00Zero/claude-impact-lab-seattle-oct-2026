// Shared by the onboarding form (early feedback) and the server (enforced).
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

// iOS converts HEIC photos to JPEG when the picker only accepts these types.
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_ACCEPTED_TYPES = AVATAR_ACCEPT.split(",");
