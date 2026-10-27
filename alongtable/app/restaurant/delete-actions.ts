"use server";

import { revalidatePath } from "next/cache";
import { cancelEvent } from "@/lib/events";
import { removePhotoByUrl } from "@/lib/photos";
import { getCurrentRestaurant } from "@/lib/session";
import { deleteSpace, listSpaces } from "@/lib/spaces";

export type DeleteState = { error?: string };

const FAILED = "That didn't work. Please try again.";

/** Find one of the signed-in restaurant's own spaces. Anything else is refused. */
async function ownSpace(spaceId: string) {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return { error: "Sign in to do that." } as const;
  const space = (await listSpaces(restaurant.id)).find((s) => s.id === spaceId);
  if (!space) return { error: "That space isn't one of yours." } as const;
  return { space } as const;
}

/** Delete a space together with its event, that event's reservations and its photo. */
export async function deleteSpaceAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const found = await ownSpace(String(formData.get("spaceId") ?? ""));
  if ("error" in found) return { error: found.error };

  try {
    await deleteSpace(found.space.id);
  } catch (err) {
    console.error("deleteSpaceAction failed", err);
    return { error: FAILED };
  }
  await removePhotoByUrl(found.space.event?.photoUrl).catch(() => {}); // best effort
  revalidatePath("/", "layout");
  return {};
}

/** Cancel the event in a space: remove the event and its reservations, and reopen the space. */
export async function cancelEventAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const found = await ownSpace(String(formData.get("spaceId") ?? ""));
  if ("error" in found) return { error: found.error };
  if (!found.space.event) return { error: "This space has no event to cancel." };

  try {
    await cancelEvent(found.space.event.id, found.space.id);
  } catch (err) {
    console.error("cancelEventAction failed", err);
    return { error: FAILED };
  }
  await removePhotoByUrl(found.space.event.photoUrl).catch(() => {}); // best effort
  revalidatePath("/", "layout");
  return {};
}
