"use server";

import { revalidatePath } from "next/cache";
import { setEventPhoto } from "@/lib/events";
import { removePhotoByUrl, removePhotoFile, uploadPhoto as upload } from "@/lib/photos";
import { getCurrentRestaurant } from "@/lib/session";
import { listSpaces, setRestaurantPhoto } from "@/lib/spaces";

export type PhotoState = { error?: string; saved?: boolean };

const SAVE_FAILED = "We couldn't save that photo. Please try again.";

/** The signed-in restaurant adds or changes its own photo. */
export async function uploadRestaurantPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { error: "Sign in to add a photo." };

  const result = await upload("restaurants", restaurant.id, formData.get("photo") as File);
  if (!result.ok) return { error: result.message };

  try {
    await setRestaurantPhoto(restaurant.id, result.url);
  } catch (err) {
    console.error("uploadRestaurantPhoto: saving the URL failed", err);
    await removePhotoFile(result.path); // don't leave an orphaned file behind
    return { error: SAVE_FAILED };
  }

  await removePhotoByUrl(restaurant.photoUrl); // the one it replaces
  revalidatePath("/", "layout");
  return { saved: true };
}

/** The signed-in restaurant adds or changes the photo of an event held in one of its spaces. */
export async function uploadEventPhoto(_prev: PhotoState, formData: FormData): Promise<PhotoState> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { error: "Sign in to add a photo." };

  // Only events in this restaurant's own spaces can be changed.
  const eventId = String(formData.get("eventId") ?? "");
  const space = (await listSpaces(restaurant.id)).find((s) => s.event?.id === eventId);
  if (!space?.event) return { error: "That event isn't one of your bookings." };

  const result = await upload("events", eventId, formData.get("photo") as File);
  if (!result.ok) return { error: result.message };

  try {
    await setEventPhoto(eventId, result.url);
  } catch (err) {
    console.error("uploadEventPhoto: saving the URL failed", err);
    await removePhotoFile(result.path);
    return { error: SAVE_FAILED };
  }

  await removePhotoByUrl(space.event.photoUrl);
  revalidatePath("/", "layout");
  return { saved: true };
}
