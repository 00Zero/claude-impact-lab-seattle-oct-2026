"use server";

import { redirect } from "next/navigation";
import { clearCurrentRestaurant } from "@/lib/session";

export async function signOut() {
  await clearCurrentRestaurant();
  redirect("/restaurant/signup");
}
