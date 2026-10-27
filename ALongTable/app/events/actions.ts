"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reserveSeat } from "@/lib/events";

export type FormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** The event can't take reservations any more, so the form should point back to /events. */
  closed?: boolean;
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const eventId = str(formData, "eventId");
  const values = { name: str(formData, "name"), email: str(formData, "email") };

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Enter your name.";
  if (!EMAIL_RE.test(values.email)) errors.email = "Enter a valid email address.";
  if (Object.keys(errors).length) return { errors, values };

  let code: string;
  try {
    const result = await reserveSeat({ eventId, name: values.name, email: values.email });
    if (!result.ok) {
      if (result.code === "ALREADY_RESERVED") return { errors: { email: result.message }, values };
      return { errors: { form: result.message }, values, closed: true };
    }
    code = result.data.confirmationCode;
  } catch (err) {
    console.error("joinEvent failed", err);
    return { errors: { form: "Something went wrong and your seat wasn't reserved. Please try again." }, values };
  }

  revalidatePath("/events");
  revalidatePath("/restaurant");
  redirect(`/reservations/${code}`);
}
