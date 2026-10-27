import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { Logo } from "@/app/ui/logo";
import { AppTabs } from "./app-tabs";
import { getAvatarUrl } from "@/lib/avatar";
import { requireWorkspace } from "@/lib/workspace";

// Pages under /app still call requireWorkspace() themselves; layouts don't
// re-run on every navigation, so this header isn't an access check.
export default function PortalLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center lg:max-w-6xl justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/app/requests" aria-label="OneTrip requests" className="shrink-0">
              <Logo />
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-1 text-[15px] font-semibold sm:flex">
              <Link href="/app/requests" className="rounded-lg px-2.5 py-2 hover:bg-chip">
                Requests
              </Link>
              <Link href="/app/settings" className="rounded-lg px-2.5 py-2 hover:bg-chip">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <Suspense fallback={<span className="h-5" />}>
              <WorkspaceName />
            </Suspense>
            <form action={logout}>
              <button type="submit" className="min-h-10 text-sm font-semibold text-muted hover:text-ink">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="pb-20 sm:pb-0">{children}</div>
      <Suspense fallback={null}>
        <AppTabs />
      </Suspense>
    </div>
  );
}

async function WorkspaceName() {
  const { user, workspace } = await requireWorkspace();
  const avatarUrl = await getAvatarUrl(user.id);
  return (
    <Link href="/app/settings" className="hidden min-w-0 items-center gap-2 sm:flex">
      {avatarUrl ? (
        // Signed URLs expire, so skip the image optimizer's caching.
        <Image
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="size-8 rounded-full border border-line object-cover"
        />
      ) : null}
      <span className="truncate text-sm text-muted">{workspace.name}</span>
    </Link>
  );
}
