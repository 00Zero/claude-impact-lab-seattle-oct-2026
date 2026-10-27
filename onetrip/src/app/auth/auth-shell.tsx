import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/app/ui/logo";

// Page frame for login, signup and password reset: logo, title, form, footer
// links. Mobile-first, one column. See the prototype's login screen.
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 pb-12 pt-10 sm:justify-center sm:pt-12">
        <Link href="/" aria-label="OneTrip home" className="self-start">
          <Logo className="text-2xl" />
        </Link>
        <div className="mt-4 space-y-2">
          <h1 className="font-display text-[30px] font-extrabold leading-tight">{title}</h1>
          {intro ? <p className="text-base leading-7 text-muted">{intro}</p> : null}
        </div>
        {children}
        {footer ? <div className="flex flex-col gap-3 text-[15px] text-muted">{footer}</div> : null}
      </main>
    </div>
  );
}
