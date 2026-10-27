import type { Metadata } from "next";
import { MapsSetup } from "./maps-setup";

export const metadata: Metadata = { title: "List your restaurant · ALongTable" };

export default function SignUpPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <MapsSetup />
    </main>
  );
}
