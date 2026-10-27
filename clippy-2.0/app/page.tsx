import Image from "next/image";
import Link from "next/link";
import HelperIcon from "@/components/HelperIcon";
import { money, shortDate } from "@/components/format";
import { loadExample } from "@/lib/example";
import { authEnabled } from "@/lib/supabase/config";
import { currentUserEmail } from "@/lib/supabase/server";

// Reads the session cookie at request time.
export const instant = false;

const STEPS = [
  { title: "Upload", text: "Snap a photo of your supply invoice, or type what you buy with pack sizes and quantities." },
  { title: "Compare", text: "Clippy searches real store pages and works out the true cost per unit, shipping included." },
  { title: "Save", text: "See the cheapest store for each item and your savings per order, month and year, with a link to buy." },
];

const FEATURES = [
  { title: "Reads your invoice", text: "Photos, receipts or a typed list. Clippy finds each item, pack size and the price you pay now." },
  { title: "Real prices only", text: "Every price comes from a public store page, with a link and the date it was checked. No guesses." },
  { title: "Fair comparisons", text: "A 25 lb bag and a 50 lb bag are compared per pound, with shipping added in." },
  { title: "You stay in control", text: "Clippy never buys. You see the numbers and decide where to shop." },
];

export default async function Home() {
  const example = loadExample();
  const signedIn = Boolean(await currentUserEmail());
  // With login off, the tool is open to everyone, so every button goes straight to it.
  const start = signedIn || !authEnabled ? "/app" : "/login?mode=signup";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <HelperIcon className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-emerald-900">Clippy</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {authEnabled && !signedIn && (
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Log in
              </Link>
            )}
            <Link
              href={start}
              className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              {signedIn ? "Open Clippy" : "Get started free"}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2">
          <div>
            <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              Supply price comparison for small businesses
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Stop overpaying for supplies.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Upload a photo of your supply invoice. Clippy checks real stores for the same items and shows where each one
              is cheapest, and how much you save every month.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={start}
                className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900"
              >
                {signedIn ? "Compare my prices" : "Try Clippy free"}
              </Link>
              <a href="#how" className="rounded-lg bg-white px-5 py-3 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                See how it works
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-emerald-900/5">
            <Image
              src="/screenshots/results-desktop.png"
              alt="Clippy showing the cheapest store for each item on an invoice and the savings"
              width={1280}
              height={900}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>

        {example && (
          <section className="border-y border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10">
              <p className="text-center text-sm font-medium text-slate-500">
                A real run on a {example.items.length}-item supply invoice, checked {shortDate(example.generatedAt)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Stat label="Saved per order" value={money(example.totalSavingsPerOrder)} />
                <Stat label="Saved per month" value={money(example.totalSavingsPerMonth)} />
                <Stat label="Saved per year" value={money(example.totalSavingsPerYear)} highlight />
              </div>
            </div>
          </section>
        )}

        <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">How Clippy works</h2>
          <p className="mt-1 text-center text-slate-600">Three steps. About a minute.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                  {i + 1}
                </span>
                <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-emerald-950 text-white">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-center text-2xl font-bold tracking-tight">Built for owners, not accountants</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <p className="font-semibold">{f.title}</p>
                  <p className="mt-1 text-sm text-emerald-100/80">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Find out what you could save today.</h2>
          <p className="mt-2 text-slate-600">Bring your latest invoice. Clippy does the searching.</p>
          <Link
            href={start}
            className="mt-6 inline-block rounded-lg bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900"
          >
            {signedIn ? "Open Clippy" : "Get started free"}
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-4">
        <p className="mx-auto max-w-6xl text-center text-xs text-slate-500">
          Prices come from public store pages and can change. Check before you buy. Clippy never buys for you.
        </p>
      </footer>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 text-center ${highlight ? "bg-emerald-800 text-white" : "bg-slate-50 ring-1 ring-slate-200"}`}>
      <p className={`text-3xl font-bold tracking-tight ${highlight ? "" : "text-slate-900"}`}>{value}</p>
      <p className={`mt-1 text-sm ${highlight ? "text-emerald-100" : "text-slate-600"}`}>{label}</p>
    </div>
  );
}
