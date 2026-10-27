import Link from "next/link";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/app/requests" className="inline-flex min-h-10 items-center self-start text-sm font-bold text-accent-strong">
        ← Requests
      </Link>
      <h1 className="font-display text-[28px] font-extrabold tracking-tight">Settings</h1>
      <SettingsNav />
      {children}
    </main>
  );
}
