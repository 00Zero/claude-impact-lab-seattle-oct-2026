"use server";

import { revalidatePath } from "next/cache";
import { createEventForSpace, reserveSeat } from "@/lib/events";
import { getCurrentRestaurant } from "@/lib/session";
import { listSpaces, type Space } from "@/lib/spaces";

// Demo-only: stands in for the guest screens (create event, join event) so the
// Booked state can be seen from the restaurant dashboard. Disabled outside `next dev`.
// It writes real rows; run supabase/reset.sql to clear them.

const DEMO_EVENTS = [
  { title: "Debating Pythagoras", organizerName: "Maya Chen" },
  { title: "Sunday Supper Club", organizerName: "Jonas Weber" },
  { title: "Philosophy & Pasta", organizerName: "Priya Nair" },
];

async function ownSpace(spaceId: string): Promise<Space | null> {
  if (process.env.NODE_ENV !== "development") return null;
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return null;
  return (await listSpaces(restaurant.id)).find((s) => s.id === spaceId) ?? null;
}

export async function simulateBookingAction(formData: FormData) {
  const space = await ownSpace(String(formData.get("spaceId")));
  if (!space || space.status !== "available") return;
  const demo = DEMO_EVENTS[Math.floor(Math.random() * DEMO_EVENTS.length)];
  const result = await createEventForSpace({
    spaceId: space.id,
    title: demo.title,
    description: null,
    capacity: space.capacity,
    organizerName: demo.organizerName,
    organizerEmail: `demo-organizer-${space.id.slice(0, 8)}@example.com`,
  });
  if (!result.ok) console.error("simulateBooking:", result.message);
  revalidatePath("/restaurant");
}

export async function simulateReservationAction(formData: FormData) {
  const space = await ownSpace(String(formData.get("spaceId")));
  if (!space?.event) return;
  const eventId = space.event.id;
  const n = space.event.seatsTaken + 1;
  const result = await reserveSeat({ eventId, name: `Demo guest ${n}`, email: `demo-guest-${eventId.slice(0, 8)}-${n}-${Date.now()}@example.com` });
  if (!result.ok) console.error("simulateReservation:", result.message);
  revalidatePath("/restaurant");
}
