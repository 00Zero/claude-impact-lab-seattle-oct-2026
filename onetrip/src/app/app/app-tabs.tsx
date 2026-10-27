"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Phone-only bottom tabs, as in the mockup. Hidden on a request's brief,
// which has its own sticky action bar.
export function AppTabs() {
  const pathname = usePathname();
  const onBrief = /^\/app\/requests\/(?!new$)[^/]+$/.test(pathname);
  if (onBrief) return null;
  const tabs = [
    ["/app/requests", "Requests", "📋"],
    ["/app/settings", "Settings", "⚙️"],
  ] as const;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      {tabs.map(([href, label, icon]) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center text-xs font-bold ${active ? "text-ink" : "text-muted"}`}
          >
            <span aria-hidden className="text-lg">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
