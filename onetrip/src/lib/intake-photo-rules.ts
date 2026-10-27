// Shared by the intake wizard (early feedback) and the server (enforced).
// The photo count is also enforced by reserve_intake_photo.
export const INTAKE_PHOTO_MAX_COUNT = 5;
export const INTAKE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

// At least one photo, or a written description, is needed to continue.
export const INTAKE_PHOTO_MIN_COUNT = 1;
// Matches the intake_photos.caption check.
export const INTAKE_CAPTION_MAX_LENGTH = 300;
// Matches the service_requests.customer_description check.
export const INTAKE_DESCRIPTION_MAX_LENGTH = 2000;

// What the customer's browser knows about a saved photo.
export type IntakePhoto = {
  id: string;
  caption: string;
  thumbnailUrl: string;
};
