import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/restaurant/signup/actions";
import { getCurrentRestaurant } from "@/lib/session";

const links = [
  { href: "/events", label: "Find events" },
  { href: "/spaces", label: "Host an event" },
  { href: "/restaurant", label: "For restaurants" },
];

const navLink =
  "flex min-h-11 items-center whitespace-nowrap rounded-small px-3 font-semibold text-ink-soft hover:bg-sunken hover:text-ink";

// Surface, not outline: white header on the off-white page, no border.
export function Header() {
  return (
    <header className="bg-surface">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2">
        <Link href="/" className="flex min-h-11 items-center text-xl font-extrabold tracking-tight text-ink">
          ALongTable
        </Link>
        <div className="flex flex-wrap items-center gap-x-1">
          <ul className="flex flex-wrap gap-x-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={navLink}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* Reads the session cookie, so it streams in without blocking the rest of the header. */}
          <Suspense fallback={null}>
            <SignedInRestaurant />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}

async function SignedInRestaurant() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) return null;

  return (
    <div className="ml-2 flex items-center gap-1 rounded-control bg-sunken pl-3">
      <Link
        href="/restaurant"
        className="flex min-h-11 items-center whitespace-nowrap font-semibold text-ink"
        title="Signed in as a restaurant"
      >
        {restaurant.name}
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-11 items-center whitespace-nowrap rounded-small px-3 font-semibold text-ink-soft hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
