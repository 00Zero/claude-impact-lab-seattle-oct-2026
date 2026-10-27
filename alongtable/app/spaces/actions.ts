"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createEventForSpace, setEventPhoto } from "@/lib/events";
import { checkPhoto, removePhotoFile, uploadPhoto } from "@/lib/photos";
import { getSpace } from "@/lib/spaces";

export type FormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** The space can't be booked any more, so the form should point back to /spaces. */
  spaceGone?: boolean;
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const spaceId = str(formData, "spaceId");
  const values = Object.fromEntries(
    ["title", "description", "capacity", "organizerName", "organizerEmail"].map((k) => [k, str(formData, k)]),
  );

  const space = await getSpace(spaceId);
  if (!space || space.status !== "available" || new Date(space.startsAt) <= new Date()) {
    return {
      errors: { form: "This space isn't available any more. Someone may have just booked it." },
      values,
      spaceGone: true,
    };
  }

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "Give your event a title.";
  const capacity = Number(values.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > space.capacity) {
    errors.capacity = `Enter a number from 1 to ${space.capacity}.`;
  }
  if (!values.organizerName) errors.organizerName = "Enter your name.";
  if (!EMAIL_RE.test(values.organizerEmail)) errors.organizerEmail = "Enter a valid email address.";
  // The photo is optional, but if there is one, check it now, before the space is booked.
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const problem = checkPhoto(photo);
    if (problem) errors.photo = problem;
  }
  if (Object.keys(errors).length) return { errors, values };

  let eventId: string;
  try {
    const result = await createEventForSpace({
      spaceId,
      title: values.title,
      description: values.description || null,
      capacity,
      organizerName: values.organizerName,
      organizerEmail: values.organizerEmail,
    });
    if (!result.ok) {
      if (result.code === "CAPACITY_INVALID") return { errors: { capacity: result.message }, values };
      return { errors: { form: result.message }, values, spaceGone: true };
    }
    eventId = result.data.id;
  } catch (err) {
    console.error("createEvent failed", err);
    return { errors: { form: "Something went wrong and the event wasn't created. Please try again." }, values };
  }

  // The event exists now, so a photo problem must not undo it: carry on and tell the organizer.
  let photoFailed = false;
  if (hasPhoto) {
    const result = await uploadPhoto("events", eventId, photo);
    if (!result.ok) photoFailed = true;
    else {
      try {
        await setEventPhoto(eventId, result.url);
      } catch (err) {
        console.error("createEvent: saving the photo failed", err);
        await removePhotoFile(result.path);
        photoFailed = true;
      }
    }
  }

  revalidatePath("/spaces");
  revalidatePath("/events");
  revalidatePath("/restaurant");
  redirect(`/events/${eventId}/created${photoFailed ? "?photo=failed" : ""}`);
}
