import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Header for the app pages (request form, checkout, account review).
export function AppHeader({ label, children }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="RingAround home">
            <Logo compact />
          </Link>
          {label && (
            <>
              <span className="hidden h-5 w-px bg-line sm:block" />
              <span className="hidden text-sm text-ink-soft sm:block">{label}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {children}
        </div>
      </div>
    </header>
  );
}
