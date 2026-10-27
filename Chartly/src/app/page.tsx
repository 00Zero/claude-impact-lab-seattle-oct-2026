import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/app/ui/logo";

const HERO_PINS = [
  { n: 1, x: 66.5, y: 43 },
  { n: 2, x: 47, y: 59 },
  { n: 3, x: 71.5, y: 47 },
];

const STEPS = [
  { tag: "1 · 10 seconds", title: "Add the request", body: "Name, number, and what they said." },
  { tag: "2 · 90 seconds", title: "They snap photos", body: "From a text. Questions are written from their photos." },
  {
    tag: "3 · Before you leave",
    title: "You load the right parts",
    body: "Model, likely cause, and why, with every reason pinned on the photo.",
  },
];

const VALUES = [
  {
    tag: "No guesswork",
    title: "Know the cost and time before you go",
    body: "Likely cause, parts list, and a price range before you roll, so neither of you gets surprised on site.",
  },
  {
    tag: "No missed jobs",
    title: "Don’t lose the job to a second visit",
    body: "A customer who waits two days for a part calls someone else. Fix it the first time and keep them.",
  },
  {
    tag: "Near misses",
    title: "See the trips you almost lost",
    body: "Every brief that changed what you loaded is counted, so you can see the second trips you avoided.",
  },
];

const FUNNEL = [
  { who: "Not us", title: "Customer finds you", body: "Google, Thumbtack, referrals, your truck wrap" },
  { who: "Not us", title: "You book the job", body: "Phone, text, Jobber, Housecall Pro, a paper calendar" },
  { who: "OneTrip", title: "Before the visit", body: "Photos, the right questions, a brief, the right parts", us: true },
  { who: "You", title: "Fix it in one trip", body: "No second visit, no lost afternoon" },
];

const STATS = [
  { big: "1 in 4", body: "field service visits don’t fix the problem on the first trip", src: "The Service Council, 2017" },
  { big: "51%", body: "of those failed first visits come down to missing or wrong parts", src: "Aberdeen Group, 2013" },
  { big: "$0", body: "OneTrip is free and open source", src: "MIT license" },
];

const TRADES = ["HVAC", "Electrical", "Plumbing", "Appliance repair", "Garage doors", "Handyman"];

export default function Home() {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex items-center gap-4">
          <a
            href="https://github.com/AmoghAtreya/Claude-Impact-Lab"
            className="hidden text-sm font-bold text-accent-strong sm:inline"
          >
            GitHub
          </a>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-bold"
          >
            Log in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-4 md:grid-cols-[1.05fr_1fr] md:pt-8">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight md:text-[56px]">
              Know what’s broken{" "}
              <span className="bg-[linear-gradient(transparent_58%,var(--color-accent)_58%)]">
                before you roll the truck.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[17px] text-muted">
              <b className="text-ink">One trip, not two.</b> Your customer sends photos from a text, and you get a
              one-screen brief: what’s wrong, why, and what to load in the truck.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/signup"
                className="inline-flex h-[52px] items-center rounded-2xl bg-accent px-5 font-bold text-accent-ink"
              >
                Start free
              </Link>
              <a
                href="#how"
                className="inline-flex h-[52px] items-center rounded-2xl border-[1.5px] border-line bg-white px-5 font-bold"
              >
                See how it works
              </a>
            </div>
            <p className="mt-3 text-sm text-muted">Free · Open source · No app for your customers</p>
          </div>
          <HeroDemo />
        </section>

        <Section>
          <div className="grid gap-3 md:grid-cols-3">
            {VALUES.map((v) => (
              <Card key={v.title} tag={v.tag} title={v.title} body={v.body} />
            ))}
          </div>
        </Section>

        <Section id="how">
          <div className="grid gap-3 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.title} tag={s.tag} title={s.title} body={s.body} />
            ))}
          </div>
        </Section>

        <Section>
          <Eyebrow>Where OneTrip fits</Eyebrow>
          <ol className="mt-3 grid gap-2 md:grid-cols-4">
            {FUNNEL.map((f) => (
              <li
                key={f.title}
                className={`flex flex-col gap-0.5 rounded-2xl border-[1.5px] p-4 ${
                  f.us ? "border-accent-strong bg-accent text-accent-ink" : "border-line bg-white"
                }`}
              >
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${f.us ? "" : "text-muted"}`}>
                  {f.who}
                </span>
                <b>{f.title}</b>
                <span className={`text-sm ${f.us ? "" : "text-muted"}`}>{f.body}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 max-w-3xl text-muted">
            <b className="text-ink">We don’t sell leads or match you with customers.</b> No lead fees, no bidding.
            OneTrip starts after you’ve won the job, and makes that first visit count. It works alongside whatever
            you already use.
          </p>
        </Section>

        <Section>
          <Eyebrow>For any trade</Eyebrow>
          <div className="mt-3 flex flex-wrap gap-2">
            {TRADES.map((t) => (
              <span key={t} className="rounded-full bg-chip px-3 py-2 text-sm font-semibold">
                {t}
              </span>
            ))}
          </div>
        </Section>

        <Section>
          <div className="grid gap-5 rounded-3xl bg-ink p-6 text-white md:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.big}>
                <b className="block font-display text-3xl text-accent">{s.big}</b>
                {s.body}
                <span className="mt-1.5 block text-xs opacity-60">{s.src}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div>
              <b>Your customers’ photos stay private.</b>
              <p className="text-sm text-muted">
                Stored privately, location data removed, deleted automatically after the job.
              </p>
            </div>
          </div>
        </Section>
      </main>

      <footer className="mx-auto flex max-w-6xl justify-between border-t border-line px-5 py-5 text-sm text-muted">
        <span>OneTrip · MIT licensed</span>
        <a href="https://github.com/AmoghAtreya/Claude-Impact-Lab">GitHub</a>
      </footer>
    </div>
  );
}

function HeroDemo() {
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <Image
          src="/landing/ac-condenser.jpg"
          alt="A customer’s photo of a Carrier outdoor AC unit"
          width={1920}
          height={1337}
          priority
          className="block h-auto w-full"
        />
        {HERO_PINS.map((p, i) => (
          <span
            key={p.n}
            aria-hidden
            className="absolute grid h-7 w-7 place-items-center rounded-full border-[2.5px] border-ink bg-accent text-[13px] font-extrabold text-accent-ink shadow-md"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animation: `pin-pop 0.45s ease ${0.5 + i * 0.6}s both`,
            }}
          >
            {p.n}
          </span>
        ))}
        <span className="absolute left-3 top-2.5 rounded-lg bg-black/70 px-2 py-1 text-xs font-bold text-white">
          Customer’s photo, read by OneTrip
        </span>
        <span className="absolute right-2.5 top-2.5 rounded-md bg-black/55 px-2 py-0.5 text-[10.5px] text-white">
          Photo:{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:Carrier_Outdoor_Split_Air_Conditioner_Heat_Pump_System_(55005181522).jpg"
            className="underline"
          >
            Tony Webster
          </a>
          , CC BY 4.0
        </span>
      </div>
      <div
        className="relative -mt-8 ml-[12%] mr-[4%] rounded-2xl border border-line bg-white p-4 shadow-xl"
        style={{ animation: "rise-in 0.5s ease 2.4s both" }}
      >
        <div className="flex items-center justify-between">
          <Eyebrow>Likely cause</Eyebrow>
          <span className="inline-flex items-center gap-1 rounded-lg border-[1.5px] border-ok px-2 py-0.5 text-xs font-bold text-ok">
            ● High
          </span>
        </div>
        <p className="mb-2 mt-1 font-display text-lg font-extrabold">Failed run capacitor</p>
        <p className="text-sm">
          <b>①</b> Carrier outdoor unit · <b>②</b> fan not spinning · <b>③</b> lines intact, no ice
        </p>
        <p className="mt-1.5 text-sm">
          <b>Bring:</b> run capacitor · contactor · multimeter
        </p>
      </div>
    </div>
  );
}


function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 pb-8">
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-[11.5px] font-bold uppercase tracking-widest text-muted">{children}</span>;
}

function Card({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <span className="text-[12.5px] font-extrabold uppercase text-accent-strong">{tag}</span>
      <h3 className="mb-1 mt-1.5 font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}
