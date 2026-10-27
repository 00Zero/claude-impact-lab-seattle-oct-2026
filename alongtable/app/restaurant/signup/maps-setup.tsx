"use client";

import { useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { Switch } from "@base-ui/react/switch";
import { Check, CheckCircle, CircleNotch, Info, Plus, WarningCircle, X } from "@phosphor-icons/react/ssr";
import { HouseRules } from "@/components/house-rules";
import { StepBar, Steps, type Step } from "@/components/onboarding/steps";
import { AiTag } from "@/components/ui/ai-tag";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeatRow } from "@/components/ui/seat-row";
import { TileSelect } from "@/components/ui/tiles";
import { MAX_RULE_LENGTH, MAX_RULES, parseHouseRules, RULE_SUGGESTIONS } from "@/lib/house-rules";
import type { RestaurantProfile, SpotSuggestion } from "@/lib/onboarding";
import { AREAS, CAPACITIES, PRICES, SLOTS } from "@/lib/space-options";
import { upcomingDays } from "@/lib/time";
import { getSuggestions, publishSuggestion, registerFromProfile, saveHouseRules } from "./onboard-actions";
import { SAMPLE_PROFILE } from "./sample-profile";

// The owner sign-up flow (/restaurant/signup), laid out like the design prototype:
// Find your restaurant → Confirm details → Pick dates → House rules → Review and publish,
// then a Live screen. The Google Maps link is how we find the restaurant. ALong AI
// researches it and suggests dates; nothing is published until the owner taps Publish
// on the last step.

type Stage = "find" | "researching" | "confirm" | "suggesting" | "dates" | "rules" | "saving-rules" | "publish" | "live";
type Source = "live" | "sample" | "manual";
type Slot = (typeof SLOTS)[number]["value"];
type Price = (typeof PRICES)[number]["value"];
type Area = (typeof AREAS)[number];
type Capacity = (typeof CAPACITIES)[number];
/** A date after a publish attempt. */
type DateState = { status: "published" } | { status: "failed"; error: string };

const STEP_OF: Record<Stage, Step> = {
  find: 1,
  researching: 1,
  confirm: 2,
  suggesting: 2,
  dates: 3,
  rules: 4,
  "saving-rules": 4,
  publish: 5,
  live: 6,
};

const icon = { size: 24, "aria-hidden": true, className: "alt-icon" } as const;
/** Underlined basil text link, 44px tall, as in the prototype ("Back", "Not yours? Add it yourself"). */
const textLink = "alt-link inline-flex min-h-11 items-center underline";
const FIRST_ROWS = 6; // date rows shown before "Show more dates"

/** The step list (desktop) or progress bar (mobile) beside the current step's card. */
function Layout({ step, back, children, after }: { step: Step; back: boolean; children: ReactNode; after?: ReactNode }) {
  return (
    <div className="flex items-start gap-12">
      <aside className="hidden w-64 shrink-0 pt-8 lg:block">
        <Steps current={step} />
      </aside>
      <div className="flex min-w-0 max-w-[640px] flex-1 flex-col gap-6">
        <div className="lg:hidden">
          <StepBar current={step} />
        </div>
        <div key={step} className={`alt-step-in ${back ? "alt-step-in--back" : ""} flex flex-col gap-6`}>
          <div className="alt-card flex flex-col gap-6 !p-6 sm:!p-10">{children}</div>
          {after}
        </div>
      </div>
    </div>
  );
}

function Heading({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="alt-h2">{title}</h1>
      {lead && <p className="alt-lead alt-secondary">{lead}</p>}
    </header>
  );
}

/** "Back" on the left, the step's one primary action on the right. */
function Footer({ back, children }: { back: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 pt-2">{back}{children}</div>;
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={textLink} onClick={onClick} disabled={disabled}>
      Back
    </button>
  );
}

/** A profile with only what the owner typed; suggestSpots treats it as "estimate". */
function manualProfile(name: string, location: string): RestaurantProfile {
  return { name, location, address: null, cuisine: null, priceRange: null, summary: null, hours: [], areas: [], sources: [], confidence: "low", missing: [], lat: null, lng: null };
}

export function MapsSetup() {
  const [stage, setStageRaw] = useState<Stage>("find");
  const stageRef = useRef<Stage>("find");
  const [back, setBack] = useState(false);

  // Find
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [findError, setFindError] = useState<string | null>(null);
  const [match, setMatch] = useState<RestaurantProfile | null>(null);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualErrors, setManualErrors] = useState<{ name?: string; location?: string }>({});
  const manualNameRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Confirm
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [source, setSource] = useState<Source>("live");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  // Pick dates
  const [days, setDays] = useState<{ value: string; label: string }[]>([]);
  const [suggested, setSuggested] = useState<Record<string, SpotSuggestion>>({});
  const [basis, setBasis] = useState<"hours" | "estimate" | "none">("hours");
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showAllDays, setShowAllDays] = useState(false);
  const [slot, setSlot] = useState<Slot>("dinner");
  const [capacity, setCapacity] = useState<Capacity>(10);
  const [area, setArea] = useState<Area>("Main dining");
  const [price, setPrice] = useState<Price>("none");
  const [pickError, setPickError] = useState(false);
  const [shake, setShake] = useState(0);

  // House rules
  const [rules, setRules] = useState<string[]>([]);
  const [ruleDraft, setRuleDraft] = useState("");
  const [rulesError, setRulesError] = useState<string | null>(null);

  // Review and publish
  const [dateStates, setDateStates] = useState<Record<string, DateState>>({});
  const [publishing, setPublishing] = useState(false);
  const [failure, setFailure] = useState<{ failed: number; of: number } | null>(null);

  // Remember the direction so the next step card slides in from the correct side.
  function setStage(next: Stage) {
    setBack(STEP_OF[next] < STEP_OF[stageRef.current]);
    stageRef.current = next;
    setStageRaw(next);
  }

  function toConfirm(p: RestaurantProfile, from: Source) {
    setProfile(p);
    setSource(from);
    setName(p.name);
    setLocation(p.location);
    setEditing(from === "sample"); // a sample's name and location are meant to be replaced
    setError(null);
    setStage("confirm");
  }

  /** "Add it yourself" / "Enter my details myself": switch to the manual form, cursor in Restaurant name. */
  function openManual() {
    flushSync(() => setManual(true));
    manualNameRef.current?.focus();
  }

  // ---- Find: look the link up (streamed research) -------------------------
  async function lookUp(e: FormEvent) {
    e.preventDefault();
    if (!link.trim()) {
      setLinkError("Paste your restaurant's Google Maps link.");
      return;
    }
    setLinkError(null);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const timeout = setTimeout(() => abort.abort(), 120_000);
    setStage("researching");
    setSteps([]);
    setFindError(null);
    setMatch(null);

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: link.trim() }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "We couldn't look up your restaurant.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "step") setSteps((s) => [...s, msg.message]);
          else if (msg.type === "profile") {
            setMatch(msg.profile);
            setStage("find");
            return;
          } else if (msg.type === "error") throw new Error(msg.message);
        }
      }
      throw new Error("The lookup stopped before finishing. Please try again.");
    } catch (err) {
      if (abort.signal.aborted && abortRef.current !== abort) return;
      setFindError(abort.signal.aborted ? "The lookup took too long. Please try again." : (err as Error).message);
      setStage("find");
    } finally {
      clearTimeout(timeout);
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    const n = manualName.trim();
    const loc = manualLocation.trim();
    const errors = { name: n ? undefined : "Enter the restaurant name.", location: loc ? undefined : "Enter the neighborhood and city." };
    setManualErrors(errors);
    if (errors.name || errors.location) return;
    toConfirm(manualProfile(n, loc), "manual");
  }

  // ---- Confirm: register (or sign back in), then ask ALong AI for dates ----
  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const n = name.trim();
    const loc = location.trim();
    if (!n || !loc) {
      setEditing(true);
      setError("Enter your restaurant's name and neighborhood.");
      return;
    }
    setError(null);
    setStage("suggesting");
    const pin = profile.lat != null && profile.lng != null ? { lat: profile.lat, lng: profile.lng } : null;
    const reg = await registerFromProfile(n, loc, pin);
    if (!reg.ok) {
      setError(reg.error);
      setStage("confirm");
      return;
    }
    setReturning(reg.returning);
    const res = await getSuggestions({ ...profile, name: n, location: loc });
    const picks = res.ok ? res.suggestions : [];
    setSuggestError(res.ok ? null : res.error);
    setBasis(res.ok ? res.basis : "none");

    // Every day the publish form offers, from tomorrow, on days the restaurant opens.
    const openDays = new Set(profile.hours.map((h) => h.day));
    const all = upcomingDays(14)
      .slice(1)
      .filter((d) => openDays.size === 0 || openDays.has(weekdayOf(d.value)) || picks.some((p) => p.date === d.value))
      .map((d) => ({ value: d.value, label: formatDay(d.value) }));
    setDays(all);
    setSuggested(Object.fromEntries(picks.map((p) => [p.date, p])));
    // ALong AI's top two dates start switched on; the rest are the owner's call.
    setSelected(Object.fromEntries(picks.slice(0, 2).map((p) => [p.date, true])));
    const top = picks[0];
    if (top) {
      setSlot(top.slot);
      setCapacity(top.capacity);
      setArea(top.area);
      setPrice(top.price);
    } else if (profile.areas[0]) {
      setArea(profile.areas[0]);
    }
    setShowAllDays(false);
    setDateStates({});
    setFailure(null);
    setPickError(false);
    setStage("dates");
  }

  // Once a date is live, going back to Confirm details would re-run setup and could publish it twice.
  const anyPublished = Object.values(dateStates).some((d) => d.status === "published");
  const chosenDates = days.filter((d) => selected[d.value] || dateStates[d.value]?.status === "published").map((d) => d.value);

  function continueFromDates() {
    if (chosenDates.length === 0) {
      setPickError(true);
      setShake((k) => k + 1);
      return;
    }
    setPickError(false);
    setStage("rules");
  }

  // ---- House rules ---------------------------------------------------------
  function addRule(rule: string) {
    const next = parseHouseRules([...rules, rule].join("\n"));
    setRules(next);
    setRuleDraft("");
  }

  async function continueFromRules() {
    setStage("saving-rules");
    const res = await saveHouseRules(rules);
    setRulesError(res.ok ? null : res.error);
    setStage("publish");
  }

  // ---- Review and publish ----------------------------------------------------
  /**
   * Publish every chosen date that isn't live yet, one after another so each error
   * stays with its date. ALong AI only suggested; this runs on the owner's tap.
   */
  async function publishChosen() {
    const todo = chosenDates.filter((d) => dateStates[d]?.status !== "published");
    if (todo.length === 0) return setStage("live");
    setPublishing(true);
    const next = { ...dateStates };
    let failed = 0;
    for (const date of todo) {
      const res = await publishSuggestion({
        date,
        slot,
        area,
        capacity,
        price,
        features: suggested[date]?.features ?? [],
        reason: "",
      });
      next[date] = res.ok ? { status: "published" } : { status: "failed", error: res.error };
      if (!res.ok) failed++;
      setDateStates({ ...next });
    }
    setPublishing(false);
    setFailure(failed ? { failed, of: todo.length } : null);
    if (!failed) setStage("live");
  }

  const slotInfo = SLOTS.find((s) => s.value === slot)!;
  const priceInfo = PRICES.find((p) => p.value === price)!;
  const step = STEP_OF[stage];

  // ---- Step 1: Find your restaurant -------------------------------------------
  if (stage === "find" || stage === "researching") {
    const running = stage === "researching";
    return (
      <Layout
        step={step}
        back={back}
        after={
          <p className="alt-notice alt-notice--info">
            <Info {...icon} />
            Already registered? Find your restaurant again, or add the same name and neighborhood, to sign back in.
          </p>
        }
      >
        <Heading title="Find your restaurant" lead="We'll fill in the details from your Google listing." />

        {manual ? (
          <form onSubmit={submitManual} noValidate className="flex flex-col gap-6">
            <span className="alt-chip self-start">Added by you</span>
            <TextInput
              id="manual-name"
              label="Restaurant name"
              value={manualName}
              onChange={setManualName}
              error={manualErrors.name}
              placeholder="Il Nido"
              inputRef={manualNameRef}
            />
            <TextInput
              id="manual-location"
              label="Neighborhood and city"
              value={manualLocation}
              onChange={setManualLocation}
              error={manualErrors.location}
              placeholder="West Seattle, Seattle, WA"
            />
            <Footer back={<BackButton onClick={() => setManual(false)} />}>
              <Button type="submit">Continue</Button>
            </Footer>
          </form>
        ) : (
          <>
            <form onSubmit={lookUp} noValidate className="flex flex-col gap-2">
              <label htmlFor="maps-link" className="alt-label">
                Google Maps link
              </label>
              <div className="flex gap-3">
                <input
                  id="maps-link"
                  type="url"
                  inputMode="url"
                  className="alt-input min-w-0 flex-1"
                  placeholder="https://maps.app.goo.gl/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  disabled={running}
                  aria-invalid={linkError ? true : undefined}
                  aria-describedby={linkError ? "maps-link-help maps-link-error" : "maps-link-help"}
                />
                <Button type="submit" variant="secondary" disabled={running}>
                  {running ? "Searching…" : "Search"}
                </Button>
              </div>
              <p id="maps-link-help" className="alt-help">
                In Google Maps, open your restaurant, tap Share, then Copy link.
              </p>
              {linkError && (
                <p id="maps-link-error" role="alert" className="alt-error">
                  {linkError}
                </p>
              )}
            </form>

            {running && (
              <ol aria-live="polite" aria-label="Progress" className="alt-list">
                {(steps.length ? steps : ["Reading your link"]).map((s, i, all) => (
                  <li key={i} className={`alt-row ${i === all.length - 1 ? "alt-pulse" : ""}`}>
                    <span className={i === all.length - 1 ? "text-ink" : "alt-secondary"}>{s}</span>
                    {i < all.length - 1 && <CheckCircle size={20} aria-hidden="true" className="text-basil" />}
                  </li>
                ))}
              </ol>
            )}

            {match && !running && (
              <div className="flex flex-col gap-3">
                <p className="alt-secondary" aria-live="polite">
                  1 match
                </p>
                <div className="alt-rise flex items-center justify-between gap-4 rounded-control bg-mint p-5">
                  <div className="flex min-w-0 flex-col">
                    <span className="alt-title">{match.name}</span>
                    <span className="alt-secondary">{match.location}</span>
                  </div>
                  <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-basil text-surface">
                    <Check size={20} weight="bold" />
                  </span>
                </div>
                <button type="button" className={`${textLink} self-start`} onClick={openManual}>
                  Not yours? Add it yourself
                </button>
              </div>
            )}

            {findError && !running && (
              <div role="alert" className="alt-notice alt-notice--problem">
                <WarningCircle {...icon} />
                <div className="flex flex-col items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <span>We couldn&apos;t find that restaurant</span>
                    <span className="font-normal">{findError}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" onClick={openManual}>
                      Enter my details myself
                    </Button>
                    <Button variant="quiet" onClick={() => toConfirm(SAMPLE_PROFILE, "sample")}>
                      Try with a sample restaurant
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!match && !findError && !running && (
              <button type="button" className={`${textLink} self-start`} onClick={openManual}>
                No Google listing? Add it yourself
              </button>
            )}

            <Footer back={<Link href="/restaurant" className={textLink}>Back</Link>}>
              {match && !running && <Button onClick={() => toConfirm(match, "live")}>This is my restaurant</Button>}
            </Footer>
          </>
        )}
      </Layout>
    );
  }

  // ---- Step 2: Confirm details ----------------------------------------------------
  if ((stage === "confirm" || stage === "suggesting") && profile) {
    const busy = stage === "suggesting";
    const facts = [
      profile.address && ["Address", profile.address],
      profile.hours.length > 0 && ["Hours", formatHours(profile.hours)],
      profile.cuisine && ["Cuisine", [profile.cuisine, profile.priceRange].filter(Boolean).join(" · ")],
      profile.areas.length > 0 && ["Seating", profile.areas.join(", ")],
    ].filter(Boolean) as [string, string][];
    return (
      <Layout step={step} back={back}>
        <form onSubmit={confirm} noValidate className="flex flex-col gap-6">
          <Heading title="Is this right?" />
          {source === "live" ? (
            <AiTag>found this on your Google listing and the web.</AiTag>
          ) : (
            <span className="alt-chip self-start">{source === "sample" ? "Sample restaurant" : "Added by you"}</span>
          )}
          {source === "sample" && (
            <p className="alt-notice alt-notice--info">
              <Info {...icon} />
              This is a sample restaurant so you can see how setup works. Change the name and neighborhood to your own.
            </p>
          )}

          <section aria-label="Your restaurant" className="rounded-control bg-sunken px-6 py-2">
            <dl className="alt-list">
              {editing ? (
                <div className="alt-row !block !py-4">
                  <div className="flex flex-col gap-4">
                    <TextInput id="profile-name" label="Name" value={name} onChange={setName} disabled={busy} />
                    <TextInput id="profile-location" label="Neighborhood and city" value={location} onChange={setLocation} disabled={busy} />
                  </div>
                </div>
              ) : (
                <>
                  <Fact label="Name" value={name} action={!busy && <EditButton label="Edit name and neighborhood" onClick={() => setEditing(true)} />} />
                  <Fact label="Neighborhood" value={location} />
                </>
              )}
              {facts.map(([k, v]) => (
                <Fact key={k} label={k} value={v} />
              ))}
            </dl>
          </section>
          {profile.missing.length > 0 && <p className="alt-help">We couldn&apos;t confirm: {profile.missing.join("; ")}.</p>}
          {profile.sources.length > 0 && (
            <p className="alt-help">
              Sources:{" "}
              {profile.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ", "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="alt-link">
                    {s.title || new URL(s.url).hostname}
                  </a>
                </span>
              ))}
            </p>
          )}
          <p className="alt-secondary">Hosts and guests see your name and neighborhood.</p>

          {error && (
            <p role="alert" className="alt-notice alt-notice--problem">
              <WarningCircle {...icon} />
              {error}
            </p>
          )}
          <Footer back={<BackButton onClick={() => setStage("find")} disabled={busy} />}>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <>
                  <CircleNotch size={20} aria-hidden="true" className="motion-safe:animate-spin" />
                  Finding good dates…
                </>
              ) : (
                "Looks right"
              )}
            </Button>
          </Footer>
        </form>
      </Layout>
    );
  }

  // ---- Step 3: Pick dates ------------------------------------------------------------
  if (stage === "dates") {
    const suggestedCount = Object.keys(suggested).length;
    const visible = showAllDays ? days : days.filter((d, i) => i < FIRST_ROWS || suggested[d.value]);
    const capIndex = CAPACITIES.indexOf(capacity);
    return (
      <Layout step={step} back={back}>
        <Heading
          title="Which dates could use more guests?"
          lead={
            basis === "hours"
              ? "We picked quieter times from your opening hours. Change them any time."
              : basis === "estimate"
                ? "We couldn't confirm your opening hours, so these suggestions are estimates. Check them before you publish."
                : "Pick the dates you'd like to fill."
          }
        />
        {suggestedCount > 0 ? (
          <AiTag>
            suggested {suggestedCount} {suggestedCount === 1 ? "date" : "dates"}. Only you can publish them.
          </AiTag>
        ) : (
          suggestError && (
            <p className="alt-notice alt-notice--info">
              <Info {...icon} />
              {suggestError} Pick your dates below.
            </p>
          )
        )}

        <div className="flex flex-col gap-2">
          <ul key={shake} className={`alt-list rounded-control bg-sunken !px-6 ${shake ? "alt-shake" : ""}`} aria-label="Dates">
            {visible.map((d, i) => {
              const published = dateStates[d.value]?.status === "published";
              return (
                <li key={d.value} className="alt-row alt-rise min-h-[72px]" style={{ animationDelay: `calc(var(--alt-stagger-row) * ${Math.min(i, 8)})` }}>
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="alt-lead font-semibold tabular-nums">{d.label}</span>
                    {suggested[d.value] && <span className="alt-chip alt-chip--info">Suggested</span>}
                  </span>
                  {published ? (
                    <span className="alt-chip alt-chip--booked shrink-0">Published</span>
                  ) : (
                    <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
                      <Switch.Root
                        className="alt-switch"
                        checked={!!selected[d.value]}
                        onCheckedChange={(on) => {
                          setSelected((x) => ({ ...x, [d.value]: on }));
                          if (on) setPickError(false);
                        }}
                        aria-label={d.label}
                      >
                        <Switch.Thumb className="alt-switch__thumb" />
                      </Switch.Root>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          {visible.length < days.length && (
            <button type="button" className={`${textLink} self-start`} onClick={() => setShowAllDays(true)}>
              Show {days.length - visible.length} more {days.length - visible.length === 1 ? "date" : "dates"}
            </button>
          )}
          {pickError && (
            <p id="pick-error" role="alert" className="alt-error">
              Pick at least one date to continue.
            </p>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
          <TileSelect
            name="slot"
            label="Time"
            hint="Seattle time (Pacific)."
            columns="grid-cols-2"
            value={slot}
            onValueChange={(v) => setSlot(v as Slot)}
            tiles={SLOTS.map((s) => ({ value: s.value, label: s.hint.replace(/ – /g, " to ") }))}
          />
          <div className="alt-field">
            <span className="alt-label" id="seats-label">
              Seats per date
            </span>
            <div className="flex items-center gap-3" role="group" aria-labelledby="seats-label">
              <Button
                variant="secondary"
                className="!w-12 !px-0"
                aria-label="Fewer seats"
                disabled={capIndex <= 0}
                onClick={() => setCapacity(CAPACITIES[capIndex - 1])}
              >
                −
              </Button>
              <span className="alt-answer w-14 text-center" aria-live="polite">
                {capacity}
              </span>
              <Button
                variant="secondary"
                className="!w-12 !px-0"
                aria-label="More seats"
                disabled={capIndex >= CAPACITIES.length - 1}
                onClick={() => setCapacity(CAPACITIES[capIndex + 1])}
              >
                +
              </Button>
            </div>
          </div>
        </div>
        <TileSelect
          name="area"
          label="Where in the restaurant?"
          value={area}
          onValueChange={(v) => setArea(v as Area)}
          tiles={AREAS.map((a) => ({ value: a, label: a }))}
        />
        <TileSelect
          name="price"
          label="Minimum spend per person"
          hint="Shown to people booking the space. No payments are collected yet."
          columns="grid-cols-2 sm:grid-cols-4"
          value={price}
          onValueChange={(v) => setPrice(v as Price)}
          tiles={PRICES.map((p) => ({ value: p.value, label: p.label }))}
        />

        <Footer back={anyPublished ? <span /> : <BackButton onClick={() => setStage("confirm")} />}>
          <Button onClick={continueFromDates} aria-describedby={pickError ? "pick-error" : undefined}>
            Continue
          </Button>
        </Footer>
      </Layout>
    );
  }

  // ---- Step 4: House rules ------------------------------------------------------------
  if (stage === "rules" || stage === "saving-rules") {
    const busy = stage === "saving-rules";
    const full = rules.length >= MAX_RULES;
    return (
      <Layout step={step} back={back}>
        <Heading title="Any house rules?" lead="Hosts and guests see these on your space and event pages before they book or join. Skip this if you don't have any." />

        <div className="flex flex-col gap-3">
          <p className="alt-label">Common rules</p>
          <ul className="flex flex-wrap gap-2">
            {RULE_SUGGESTIONS.map((r) => {
              const on = rules.includes(r);
              return (
                <li key={r}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={busy || (!on && full)}
                    onClick={() => (on ? setRules(rules.filter((x) => x !== r)) : addRule(r))}
                    className={`alt-button !min-h-11 !px-4 ${on ? "!bg-ink !text-surface" : ""}`}
                  >
                    {on ? <Check size={16} weight="bold" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    {r}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ruleDraft.trim()) addRule(ruleDraft);
          }}
        >
          <label htmlFor="rule-draft" className="alt-label">
            Add your own
          </label>
          <div className="flex gap-3">
            <input
              id="rule-draft"
              className="alt-input min-w-0 flex-1"
              value={ruleDraft}
              maxLength={MAX_RULE_LENGTH}
              placeholder="e.g. Corkage is $15 a bottle"
              onChange={(e) => setRuleDraft(e.target.value)}
              disabled={busy || full}
            />
            <Button type="submit" variant="secondary" disabled={busy || full || !ruleDraft.trim()}>
              Add
            </Button>
          </div>
          <p className="alt-help">{full ? `That's the most you can add (${MAX_RULES}).` : `Up to ${MAX_RULES} rules, one at a time.`}</p>
        </form>

        {rules.length > 0 && (
          <section aria-label="Your house rules" className="flex flex-col gap-3">
            <p className="alt-label">Your house rules</p>
            <ul className="alt-list rounded-control bg-sunken !px-6">
              {rules.map((r) => (
                <li key={r} className="alt-row">
                  <span>{r}</span>
                  <Button
                    variant="quiet"
                    className="!w-11 !px-0"
                    aria-label={`Remove "${r}"`}
                    disabled={busy}
                    onClick={() => setRules(rules.filter((x) => x !== r))}
                  >
                    <X size={20} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Footer back={<BackButton onClick={() => setStage("dates")} disabled={busy} />}>
          <Button onClick={continueFromRules} disabled={busy}>
            {busy ? "Saving…" : rules.length ? "Continue" : "Skip for now"}
          </Button>
        </Footer>
      </Layout>
    );
  }

  // ---- Step 5: Review and publish ---------------------------------------------------
  if (stage === "publish") {
    const remaining = chosenDates.filter((d) => dateStates[d]?.status !== "published").length;
    return (
      <Layout step={step} back={back}>
        <Heading title="Review and publish" lead="Check everything once more. Nothing is posted until you tap Publish." />

        <section aria-label="Summary" className="rounded-control bg-sunken px-6 py-2">
          <dl className="alt-list">
            <Fact label="Restaurant" value={`${name} · ${location}`} action={!publishing && !anyPublished && <EditButton label="Edit restaurant" onClick={() => setStage("confirm")} />} />
            <Fact
              label={chosenDates.length === 1 ? "Date" : `${chosenDates.length} dates`}
              action={!publishing && <EditButton label="Edit dates" onClick={() => setStage("dates")} />}
              value={
                <ul className="flex flex-col gap-2">
                  {chosenDates.map((d) => {
                    const s = dateStates[d];
                    return (
                      <li key={d} className="flex flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">{formatDay(d)}</span>
                          {s?.status === "published" && <span className="alt-chip alt-chip--booked">Published</span>}
                        </span>
                        {s?.status === "failed" && (
                          <span className="alt-error flex items-center gap-2">
                            <WarningCircle size={20} aria-hidden="true" />
                            {s.error}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              }
            />
            <Fact label="Time" value={`${slotInfo.label}, ${slotInfo.hint.replace(/ – /g, " to ")}`} />
            <Fact label="Seats per date" value={String(capacity)} />
            <Fact label="Where" value={area} />
            <Fact label="Minimum spend" value={priceInfo.label} />
            <Fact
              label="House rules"
              action={!publishing && <EditButton label="Edit house rules" onClick={() => setStage("rules")} />}
              value={rules.length ? <HouseRules rules={rules} className="[&>h2]:sr-only" /> : "None"}
            />
          </dl>
        </section>
        {rulesError && (
          <p className="alt-notice alt-notice--filling">
            <Info {...icon} />
            {rulesError}
          </p>
        )}

        {failure && !publishing && (
          <div role="status" className="alt-notice alt-notice--filling">
            <Info {...icon} />
            <div className="flex flex-col gap-1">
              <span className="font-semibold">
                We couldn&apos;t publish {failure.failed} of {failure.of} {failure.of === 1 ? "date" : "dates"}
              </span>
              <span>Your choices are saved. Check your connection and try again.</span>
            </div>
          </div>
        )}

        <Footer back={<BackButton onClick={() => setStage("rules")} disabled={publishing} />}>
          <Button onClick={publishChosen} disabled={publishing}>
            {publishing ? (
              <>
                <CircleNotch size={20} aria-hidden="true" className="motion-safe:animate-spin" />
                Publishing…
              </>
            ) : failure ? (
              "Try again"
            ) : (
              `Publish ${remaining} ${remaining === 1 ? "space" : "spaces"}`
            )}
          </Button>
        </Footer>
      </Layout>
    );
  }

  // ---- Live ------------------------------------------------------------------------------
  const live = chosenDates.filter((d) => dateStates[d]?.status === "published");
  const one = live.length === 1;
  return (
    <Layout step={step} back={back}>
      <span className="inline-flex size-[72px] items-center justify-center rounded-full bg-mint" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
          <path
            className="alt-draw"
            d="M5 12.5l4.5 4.5L19 7.5"
            style={{ stroke: "var(--alt-basil)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}
          />
        </svg>
      </span>
      <Heading
        title={one ? "Your space is live" : `Your ${live.length} spaces are live`}
        lead={`Hosts can book ${one ? "it" : "them"} now. You'll see bookings on your dashboard.`}
      />
      <ul className="flex flex-col gap-3" aria-label="Published spaces">
        {live.map((d, i) => (
          <li key={d} className="alt-rise flex flex-col gap-3 rounded-control bg-sunken p-4" style={{ animationDelay: `calc(var(--alt-stagger-row) * ${i})` }}>
            <div className="alt-row__main">
              <span className="alt-row__title">
                {formatDay(d)} · {slotInfo.label} {slotInfo.hint.replace(/ – /g, "–")}
              </span>
              <span className="alt-secondary">
                {area} · {capacity} seats open
              </span>
            </div>
            <SeatRow total={capacity} taken={0} pop count={false} />
          </li>
        ))}
      </ul>
      <ButtonLink href={returning ? "/restaurant" : "/restaurant?registered=1"} className="alt-button--block">
        Go to my dashboard
      </ButtonLink>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

function Fact({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className="alt-row !items-start !py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="alt-secondary">{label}</dt>
        <dd className="alt-lead font-semibold">{value}</dd>
      </div>
      {action}
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={`${textLink} shrink-0`} onClick={onClick} aria-label={label}>
      Edit
    </button>
  );
}

function TextInput({ id, label, value, onChange, error, help, placeholder, inputRef, disabled }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="alt-field">
      <label htmlFor={id} className="alt-label">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="alt-input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {help && (
        <p id={`${id}-help`} className="alt-help">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="alt-error">
          {error}
        </p>
      )}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekdayOf(date: string): RestaurantProfile["hours"][number]["day"] {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()] as RestaurantProfile["hours"][number]["day"];
}

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "Tue–Thu 11:30 AM–9:30 PM; Fri–Sat 10 AM–11 PM" */
function formatHours(hours: RestaurantProfile["hours"]): string {
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byDay = new Map<string, string>();
  for (const h of hours) {
    const range = `${formatTime(h.opens)}–${formatTime(h.closes)}`;
    byDay.set(h.day, byDay.has(h.day) ? `${byDay.get(h.day)}, ${range}` : range);
  }
  const groups: { from: string; to: string; range: string }[] = [];
  for (const day of order) {
    const range = byDay.get(day);
    if (!range) continue;
    const last = groups[groups.length - 1];
    if (last && last.range === range && order.indexOf(day) === order.indexOf(last.to) + 1) last.to = day;
    else groups.push({ from: day, to: day, range });
  }
  return groups.map((g) => `${g.from === g.to ? g.from : `${g.from}–${g.to}`} ${g.range}`).join("; ");
}
