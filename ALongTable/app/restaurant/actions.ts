"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/session";
import { AREAS, CAPACITIES, FEATURES, PRICES, SLOTS } from "@/lib/space-options";
import { createSpace } from "@/lib/spaces";
import { seattleToUtc } from "@/lib/time";

export type FormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function publishSpace(_prev: FormState, formData: FormData): Promise<FormState> {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/restaurant/signup");

  const area = AREAS.find((a) => a === str(formData, "area"));
  const slot = SLOTS.find((s) => s.value === str(formData, "slot"));
  const price = PRICES.find((p) => p.value === str(formData, "price"));
  const capacity = Number(str(formData, "capacity"));
  const date = str(formData, "date");
  const features = formData.getAll("features").filter((f) => FEATURES.includes(f as (typeof FEATURES)[number]));

  const errors: Record<string, string> = {};
  if (!area) errors.area = "Pick an area.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "Pick a day.";
  if (!slot) errors.slot = "Pick a time.";
  if (!(CAPACITIES as readonly number[]).includes(capacity)) errors.capacity = "Pick the number of seats.";
  if (!price) errors.price = "Pick a minimum spend.";

  let startsAt: Date | undefined;
  let endsAt: Date | undefined;
  if (!errors.date && slot) {
    startsAt = seattleToUtc(date, slot.start);
    endsAt = seattleToUtc(date, slot.end);
    if (startsAt <= new Date()) errors.slot = "That time has already passed. Pick a later time or day.";
  }

  if (Object.keys(errors).length || !area || !startsAt || !endsAt || !price) return { errors };

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
    console.error("publishSpace failed", err);
    return { errors: { form: "Something went wrong and the space wasn't published. Please try again." } };
  }

  revalidatePath("/restaurant");
  redirect("/restaurant?published=1");
}
