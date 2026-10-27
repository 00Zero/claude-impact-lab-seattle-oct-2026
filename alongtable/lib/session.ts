import { cookies } from "next/headers";
import { getRestaurant, type Restaurant } from "@/lib/spaces";

// V0 has no auth: the signed-in restaurant is just an id remembered in a cookie.
const COOKIE = "restaurant_id";

export async function getCurrentRestaurant(): Promise<Restaurant | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  return id ? getRestaurant(id) : null;
}

export async function setCurrentRestaurant(id: string) {
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearCurrentRestaurant() {
  (await cookies()).delete(COOKIE);
}
