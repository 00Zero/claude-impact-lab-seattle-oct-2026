"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow } from "@/components/icons";
import { FieldError, RadioDot, cardChoiceClass, fieldBase, focusRing, inputClass } from "@/components/form-parts";
import { PENDING_REQUEST_KEY, REQUEST_DRAFT_KEY } from "@/lib/account";
import {
  ARRIVAL_WINDOWS,
  INSTRUCTIONS_LIMIT,
  TIME_ZONES,
  TIMING_OPTIONS,
  describeArrival,
  describeBudget,
  describeTiming,
  makeRequestSchema,
  timeZoneLabel,
  todayIn,
} from "@/lib/request";
import { SERVICE_CATEGORIES, categoryLabel, suggestCategory } from "@/lib/service-categories";
import { useBrowserValue } from "@/lib/use-browser-value";
import { RequestSummary, ReviewPanel } from "./request-summary";
import { saveLocationAction, sendRequest } from "./actions";

const DRAFT_KEY = REQUEST_DRAFT_KEY;

const EMPTY_FORM = {
  service: "",
  category: null, // null = use the suggestion from the description
  locationId: "other", // a saved location id, or "other" for a new address
  otherAddress: "",
  otherLabel: "",
  saveLocation: true,
  timing: "asap",
  date: "",
  rangeStart: "",
  rangeEnd: "",
  arrival: "any",
  timeZone: "", // "" = follow the location, then the browser
  budget: "unsure",
  budgetMin: "",
  budgetMax: "",
  instructions: "",
};

// Schema issue path -> form field. Inputs use the id `field-<name>`.
const FIELD_FOR_PATH = {
  serviceDescription: "service",
  serviceCategory: "service",
  "location.formattedAddress": "otherAddress",
  "location.label": "otherLabel",
  timing: "timing",
  "timing.mode": "timing",
  "timing.date": "date",
  "timing.start": "rangeStart",
  "timing.end": "rangeEnd",
  "budget.min": "budgetMin",
  "budget.max": "budgetMax",
  specialInstructions: "instructions",
};
const FIELD_ORDER = Object.values(FIELD_FOR_PATH);

// Editing a field also clears errors on the fields it's checked against.
const RELATED_FIELDS = {
  locationId: ["otherAddress", "otherLabel"],
  timing: ["date", "rangeStart", "rangeEnd"],
  rangeStart: ["rangeEnd"],
  budget: ["budgetMin", "budgetMax"],
  budgetMin: ["budgetMax"],
  budgetMax: ["budgetMin"],
};

const cardClass = "rounded-[28px] border bg-surface/70 p-6 transition-colors sm:p-8";
const segmentClass = `flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-3 py-3 text-sm font-medium transition hover:border-ink/40 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper ${focusRing}`;
const chipClass = `inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm transition hover:border-ink/40 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper ${focusRing}`;

function readDraft(locations, draftKey) {
  const emptyForm = { ...EMPTY_FORM, locationId: locations.find((location) => location.isDefault)?.id || locations[0]?.id || "other" };
  try {
    const saved = JSON.parse(window.localStorage.getItem(draftKey) ?? "null");
    if (!saved || typeof saved !== "object") return emptyForm;
    // Keep only fields the form knows, with the right types and ids that still
    // exist; a stale or hand-edited draft could otherwise submit unknown values.
    const draft = Object.fromEntries(
      Object.entries(emptyForm).map(([key, fallback]) => [
        key,
        typeof fallback === "string" && typeof saved[key] !== "string" ? fallback : (saved[key] ?? fallback),
      ]),
    );
    const known = (value, options) => options.some((o) => o.id === value);
    if (!known(draft.category, SERVICE_CATEGORIES)) draft.category = null;
    if (draft.locationId !== "other" && !known(draft.locationId, locations)) draft.locationId = emptyForm.locationId;
    if (!known(draft.timing, TIMING_OPTIONS)) draft.timing = emptyForm.timing;
    if (!known(draft.arrival, ARRIVAL_WINDOWS)) draft.arrival = emptyForm.arrival;
    if (draft.budget !== "unsure" && draft.budget !== "range") draft.budget = emptyForm.budget;
    if (typeof draft.saveLocation !== "boolean") draft.saveLocation = emptyForm.saveLocation;
    return draft;
  } catch {
    return emptyForm;
  }
}

function toAmount(value) {
  const cleaned = value.replace(/,/g, "").trim();
  return cleaned === "" ? null : Number(cleaned);
}

function timingFromForm(form) {
  if (form.timing === "date") return { mode: "date", date: form.date };
  if (form.timing === "range") return { mode: "range", start: form.rangeStart, end: form.rangeEnd };
  return { mode: form.timing };
}

function budgetFromForm(form) {
  if (form.budget !== "range") return { mode: "unsure" };
  return { mode: "range", min: toAmount(form.budgetMin), max: toAmount(form.budgetMax) };
}

function isVague(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length < 4;
}

function listAssumptions(view, form, savedNow) {
  const notes = [];
  if (view.category?.source === "suggested") {
    notes.push(`We guessed the category from your description: ${view.category.label}.`);
  } else if (!view.category) {
    notes.push("No category picked — the agent will go by your description.");
  }
  if (savedNow) {
    notes.push("We saved this address to your locations.");
  } else if (view.location.isNew) {
    notes.push("This address won’t be saved to your locations.");
  } else if (!view.location.isDefault) {
    notes.push(`This request is for ${view.location.label}, not your default location.`);
  }
  if (form.arrival === "any") notes.push("Any arrival time works for you.");
  notes.push(`Times are in ${view.timeZone.label} time (${view.timeZone.id}), ${view.timeZone.source}.`);
  if (form.budget === "unsure") notes.push("No budget yet — you’ll compare quotes before deciding.");
  return notes;
}

export default function RequestForm({ profile, initialLocations, userId, canCall, hasApplication }) {
  const inBrowser = useBrowserValue(() => true);
  const profileLocation = profile
    ? { id: "profile-default", label: "Default address", address: profile.defaultAddress, isDefault: true }
    : null;
  const draftKey = userId ? `${DRAFT_KEY}:${encodeURIComponent(userId)}` : DRAFT_KEY;
  return inBrowser ? (
    <RequestFormBody
      profileLocation={profileLocation}
      initialLocations={initialLocations}
      draftKey={draftKey}
      canCall={canCall}
      hasApplication={hasApplication}
    />
  ) : (
    <FormSkeleton />
  );
}

function RequestFormBody({ profileLocation, initialLocations, draftKey, canCall, hasApplication }) {
  const router = useRouter();
  // The profile address comes first as the default; addresses saved from this form follow.
  const [savedLocations, setSavedLocations] = useState(initialLocations);
  const locations = profileLocation ? [profileLocation, ...savedLocations] : savedLocations;
  const [form, setForm] = useState(() => readDraft(locations, draftKey));
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState("idle");
  const [review, setReview] = useState(null);
  const saveTimer = useRef(null);
  const browserTimeZone = useBrowserValue(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const suggested = suggestCategory(form.service);
  const categoryId = form.category ?? suggested;
  const savedLocation = locations.find((l) => l.id === form.locationId) ?? null;
  const timeZone = form.timeZone || savedLocation?.timeZone || browserTimeZone || "America/Los_Angeles";
  const timeZoneSource = form.timeZone
    ? "chosen by you"
    : savedLocation?.timeZone
      ? `from ${savedLocation.label}`
      : "from your browser";
  // Today where the job is, re-read every render so it can't go stale overnight.
  const today = useBrowserValue(() => todayIn(timeZone));
  const timeZoneOptions = TIME_ZONES.some((z) => z.id === timeZone)
    ? TIME_ZONES
    : [...TIME_ZONES, { id: timeZone, label: timeZone }];

  const timing = timingFromForm(form);
  const budget = budgetFromForm(form);
  const timingText = describeTiming(timing);
  const budgetText = describeBudget(budget);
  const view = {
    service: form.service.trim(),
    category: categoryId ? { label: categoryLabel(categoryId), source: form.category ? "chosen" : "suggested" } : null,
    location: savedLocation
      ? { label: savedLocation.label, address: savedLocation.address, isDefault: savedLocation.isDefault }
      : { label: form.otherLabel.trim() || "New address", address: form.otherAddress.trim(), isDefault: false, isNew: true },
    timing: timingText,
    arrival: describeArrival(form.arrival),
    timeZone: { id: timeZone, label: timeZoneLabel(timeZone), source: timeZoneSource },
    budget: budgetText,
    instructions: form.instructions.trim(),
    answered: [
      form.service.trim() !== "",
      savedLocation !== null || form.otherAddress.trim() !== "",
      timingText !== null && (timing.mode !== "range" || Boolean(timing.end)),
      budgetText !== null,
    ],
  };

  function update(patch) {
    const next = { ...form, ...patch };
    setForm(next);
    if (Object.keys(errors).length > 0) {
      const cleared = Object.keys(patch).flatMap((key) => [key, ...(RELATED_FIELDS[key] ?? [])]);
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => key !== "form" && !cleared.includes(key))),
      );
    }
    clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(next));
        setSaveState("saved");
      } catch {
        setSaveState("unavailable");
      }
    }, 500);
  }

  function startOver() {
    clearTimeout(saveTimer.current);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Storage blocked: nothing to clear.
    }
    setForm(readDraft(locations, draftKey));
    setErrors({});
    setSaveState("idle");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const request = {
      serviceDescription: form.service,
      serviceCategory: categoryId ?? "other",
      location: savedLocation
        ? { savedLocationId: savedLocation.id, label: savedLocation.label, formattedAddress: savedLocation.address }
        : { savedLocationId: null, label: form.otherLabel, formattedAddress: form.otherAddress },
      timing,
      arrivalWindow: form.arrival,
      timeZone,
      budget,
      specialInstructions: form.instructions,
    };
    const result = makeRequestSchema(todayIn(timeZone)).safeParse(request);
    if (!result.success) {
      const next = {};
      for (const issue of result.error.issues) {
        const field = FIELD_FOR_PATH[issue.path.join(".")];
        if (field && !next[field]) next[field] = issue.message;
      }
      next.form = "A few answers need attention — check the highlighted fields.";
      setErrors(next);
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setErrors({});
    let reviewView = view;
    let savedNow = false;
    if (!savedLocation && form.saveLocation) {
      const address = result.data.location.formattedAddress;
      const match = locations.find((l) => l.address.toLowerCase() === address.toLowerCase());
      let location = match;
      if (!match) {
        const saved = await saveLocationAction({ label: result.data.location.label, address, timeZone });
        if (saved.location) {
          setSavedLocations((current) =>
            current.some((l) => l.id === saved.location.id) ? current : [...current, saved.location],
          );
          location = saved.location;
          savedNow = saved.added;
        }
      }
      // Saving the address is a convenience: if it failed, the request still
      // goes ahead with the address as typed.
      if (location) {
        update({ locationId: location.id, otherAddress: "", otherLabel: "" });
        reviewView = { ...view, location: { label: location.label, address: location.address, isDefault: location.isDefault } };
      }
    }
    setReview({ request: result.data, view: reviewView, assumptions: listAssumptions(reviewView, form, savedNow) });
    window.scrollTo({ top: 0 });
  }

  // Approved accounts start the agent; the server checks again. Everyone else
  // goes to checkout or the account review page, and the draft stays saved.
  // Resolves with an error message, or navigates away.
  async function send() {
    let applied = hasApplication;
    if (canCall) {
      const result = await sendRequest({ request: review.request });
      if (result.sessionId) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // Storage blocked: the stale draft is harmless.
        }
        router.push(`/requests/${result.sessionId}`);
        return null;
      }
      if (!result.needsAccount) return result.error;
      applied = result.hasApplication;
    }
    try {
      window.sessionStorage.setItem(PENDING_REQUEST_KEY, "1");
    } catch {
      // Storage blocked: the draft itself is still saved.
    }
    router.push(applied ? "/account/pending" : "/checkout/starter");
    return null;
  }

  if (review) {
    return <ReviewPanel {...review} canCall={canCall} onEdit={() => setReview(null)} onSend={send} />;
  }

  const describedBy = (field) => (errors[field] ? `field-${field}-error` : undefined);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      <FormHeading saveState={saveState} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <form noValidate onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <Question
            n="01"
            id="q-service"
            title="What service do you need?"
            hint="Describe the job in your own words."
            invalid={Boolean(errors.service)}
          >
            <label htmlFor="field-service" className="sr-only">
              Describe the job
            </label>
            <textarea
              id="field-service"
              rows={3}
              maxLength={1000}
              value={form.service}
              onChange={(e) => update({ service: e.target.value })}
              placeholder="e.g. Deep cleaning for a 2-bedroom apartment before move-in"
              className={`${inputClass} resize-y`}
              aria-invalid={Boolean(errors.service)}
              aria-describedby={describedBy("service")}
            />
            <FieldError field="service" message={errors.service} />
            {!errors.service && isVague(form.service) && (
              <p className="mt-2 text-sm text-amber">
                Add a detail or two — size, what’s wrong, or how often — so providers can quote accurately.
              </p>
            )}

            <fieldset className="mt-6">
              <legend className="text-sm font-medium">
                Category{" "}
                <span className="font-normal text-ink-soft">
                  {form.category ? "" : suggested ? "— suggested from your description" : "— optional"}
                </span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {SERVICE_CATEGORIES.map((c) => (
                  <label key={c.id} className={chipClass}>
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      checked={categoryId === c.id}
                      onChange={() => update({ category: c.id })}
                      className="sr-only"
                    />
                    {c.label}
                    {!form.category && suggested === c.id && (
                      <>
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />
                        <span className="sr-only">(suggested)</span>
                      </>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          </Question>

          <Question
            n="02"
            id="q-where"
            title="Where is the service needed?"
            hint={
              locations.length > 0
                ? "Your default location is selected — pick another for this request only."
                : "Add the address where the work happens."
            }
            invalid={Boolean(errors.otherAddress || errors.otherLabel)}
          >
            {locations.length > 0 && (
              <fieldset>
                <legend className="sr-only">Service location</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {locations.map((loc) => (
                    <label key={loc.id} className={cardChoiceClass}>
                      <input
                        type="radio"
                        name="location"
                        value={loc.id}
                        checked={form.locationId === loc.id}
                        onChange={() => update({ locationId: loc.id, timeZone: "" })}
                        className="sr-only"
                      />
                      <RadioDot />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {loc.label}
                          {loc.isDefault && (
                            <span className="rounded-full bg-sage-soft px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage">
                              Default
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-soft">{loc.address}</span>
                      </span>
                    </label>
                  ))}
                  <label className={`${cardChoiceClass} border-dashed sm:col-span-2`}>
                    <input
                      type="radio"
                      name="location"
                      value="other"
                      checked={!savedLocation}
                      onChange={() => update({ locationId: "other", timeZone: "" })}
                      className="sr-only"
                    />
                    <RadioDot />
                    <span>
                      <span className="block font-medium">Use another address</span>
                      <span className="mt-0.5 block text-sm text-ink-soft">For a job somewhere else</span>
                    </span>
                  </label>
                </div>
              </fieldset>
            )}

            {!savedLocation && (
              <div className={locations.length > 0 ? "mt-5" : ""}>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                  <div>
                    <label htmlFor="field-otherAddress" className="text-sm font-medium">
                      Address
                    </label>
                    <input
                      id="field-otherAddress"
                      autoComplete="street-address"
                      value={form.otherAddress}
                      onChange={(e) => update({ otherAddress: e.target.value })}
                      placeholder="Street, city, state, ZIP"
                      className={inputClass}
                      aria-invalid={Boolean(errors.otherAddress)}
                      aria-describedby={describedBy("otherAddress")}
                    />
                    <FieldError field="otherAddress" message={errors.otherAddress} />
                  </div>
                  <div>
                    <label htmlFor="field-otherLabel" className="text-sm font-medium">
                      Label <span className="font-normal text-ink-soft">(optional)</span>
                    </label>
                    <input
                      id="field-otherLabel"
                      maxLength={60}
                      value={form.otherLabel}
                      onChange={(e) => update({ otherLabel: e.target.value })}
                      placeholder="e.g. Eastside office"
                      className={inputClass}
                      aria-invalid={Boolean(errors.otherLabel)}
                      aria-describedby={describedBy("otherLabel")}
                    />
                    <FieldError field="otherLabel" message={errors.otherLabel} />
                  </div>
                </div>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.saveLocation}
                    onChange={(e) => update({ saveLocation: e.target.checked })}
                    className="h-4 w-4 accent-signal"
                  />
                  Save to my locations
                </label>
              </div>
            )}
            {locations.length > 0 && <p className="mt-4 text-xs text-ink-soft">Choosing a location here doesn’t change your default.</p>}
          </Question>

          <Question
            n="03"
            id="q-when"
            title="When do you need it?"
            invalid={Boolean(errors.timing || errors.date || errors.rangeStart || errors.rangeEnd)}
          >
            <fieldset>
              <legend className="sr-only">Timing</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TIMING_OPTIONS.map((opt, i) => (
                  <label key={opt.id} className={segmentClass}>
                    <input
                      id={i === 0 ? "field-timing" : undefined}
                      type="radio"
                      name="timing"
                      value={opt.id}
                      checked={form.timing === opt.id}
                      onChange={() => update({ timing: opt.id })}
                      className="sr-only"
                      aria-describedby={describedBy("timing")}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <FieldError field="timing" message={errors.timing} />
            </fieldset>

            {form.timing === "date" && (
              <div className="mt-4 max-w-xs">
                <label htmlFor="field-date" className="text-sm font-medium">
                  Date
                </label>
                <input
                  id="field-date"
                  type="date"
                  min={today}
                  value={form.date}
                  onChange={(e) => update({ date: e.target.value })}
                  className={inputClass}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={describedBy("date")}
                />
                <FieldError field="date" message={errors.date} />
              </div>
            )}
            {form.timing === "range" && (
              <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                <div>
                  <label htmlFor="field-rangeStart" className="text-sm font-medium">
                    From
                  </label>
                  <input
                    id="field-rangeStart"
                    type="date"
                    min={today}
                    value={form.rangeStart}
                    onChange={(e) => update({ rangeStart: e.target.value })}
                    className={inputClass}
                    aria-invalid={Boolean(errors.rangeStart)}
                    aria-describedby={describedBy("rangeStart")}
                  />
                  <FieldError field="rangeStart" message={errors.rangeStart} />
                </div>
                <div>
                  <label htmlFor="field-rangeEnd" className="text-sm font-medium">
                    To
                  </label>
                  <input
                    id="field-rangeEnd"
                    type="date"
                    min={form.rangeStart || today}
                    value={form.rangeEnd}
                    onChange={(e) => update({ rangeEnd: e.target.value })}
                    className={inputClass}
                    aria-invalid={Boolean(errors.rangeEnd)}
                    aria-describedby={describedBy("rangeEnd")}
                  />
                  <FieldError field="rangeEnd" message={errors.rangeEnd} />
                </div>
              </div>
            )}

            <fieldset className="mt-6">
              <legend className="text-sm font-medium">
                Preferred arrival <span className="font-normal text-ink-soft">(optional)</span>
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {ARRIVAL_WINDOWS.map((slot) => (
                  <label key={slot.id} className={chipClass}>
                    <input
                      type="radio"
                      name="arrival"
                      value={slot.id}
                      checked={form.arrival === slot.id}
                      onChange={() => update({ arrival: slot.id })}
                      className="sr-only"
                    />
                    {slot.label}
                    {slot.hint && <span className="opacity-60">{slot.hint}</span>}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <label htmlFor="field-timeZone" className="text-ink-soft">
                Time zone
              </label>
              <select
                id="field-timeZone"
                value={timeZone}
                onChange={(e) => update({ timeZone: e.target.value })}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-ink/5"
              >
                {timeZoneOptions.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label} — {z.id}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-soft">{timeZoneSource}</span>
            </div>
          </Question>

          <Question
            n="04"
            id="q-budget"
            title="What’s your budget?"
            hint="Optional — it’s fine to get quotes first."
            invalid={Boolean(errors.budgetMin || errors.budgetMax)}
          >
            <fieldset>
              <legend className="sr-only">Budget</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={cardChoiceClass}>
                  <input
                    type="radio"
                    name="budget"
                    value="unsure"
                    checked={form.budget === "unsure"}
                    onChange={() => update({ budget: "unsure" })}
                    className="sr-only"
                  />
                  <RadioDot />
                  <span>
                    <span className="block font-medium">Not sure — get quotes first</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">Compare prices before setting a number.</span>
                  </span>
                </label>
                <label className={cardChoiceClass}>
                  <input
                    type="radio"
                    name="budget"
                    value="range"
                    checked={form.budget === "range"}
                    onChange={() => update({ budget: "range" })}
                    className="sr-only"
                  />
                  <RadioDot />
                  <span>
                    <span className="block font-medium">I have a budget</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">Set a minimum, maximum, or both.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            {form.budget === "range" && (
              <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                <MoneyField
                  field="budgetMin"
                  label="Minimum"
                  placeholder="150"
                  value={form.budgetMin}
                  error={errors.budgetMin}
                  onChange={(value) => update({ budgetMin: value })}
                />
                <MoneyField
                  field="budgetMax"
                  label="Maximum"
                  placeholder="300"
                  value={form.budgetMax}
                  error={errors.budgetMax}
                  onChange={(value) => update({ budgetMax: value })}
                />
              </div>
            )}
          </Question>

          <Question
            id="q-notes"
            title="Special agent instructions"
            hint="Preferences the agent should mention or ask about."
            optional
            invalid={Boolean(errors.instructions)}
          >
            <label htmlFor="field-instructions" className="sr-only">
              Special agent instructions
            </label>
            <textarea
              id="field-instructions"
              rows={4}
              maxLength={INSTRUCTIONS_LIMIT}
              value={form.instructions}
              onChange={(e) => update({ instructions: e.target.value })}
              placeholder="Anything else the agent should know? e.g., pet-friendly products, weekend visits only, licensed/insured, do not call before 10 a.m."
              className={`${inputClass} resize-y`}
              aria-invalid={Boolean(errors.instructions)}
              aria-describedby={errors.instructions ? "field-instructions-error" : "instructions-help"}
            />
            <div className="mt-2 flex items-start justify-between gap-4 text-xs text-ink-soft">
              <p id="instructions-help">
                Treated as preferences — they don’t override your approvals or the agent’s call rules.
              </p>
              <span className="shrink-0 tabular-nums">
                {form.instructions.length}/{INSTRUCTIONS_LIMIT}
              </span>
            </div>
            <FieldError field="instructions" message={errors.instructions} />
          </Question>

          <div className="lg:hidden">
            <RequestSummary view={view} />
          </div>

          <div className="border-t border-line pt-6">
            {errors.form && (
              <p role="alert" className="mb-4 text-sm font-medium text-signal">
                {errors.form}
              </p>
            )}
            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={startOver}
                className="self-start text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                Start over
              </button>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <button
                  type="submit"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal px-7 py-3.5 font-medium text-white shadow-[0_10px_30px_-10px_var(--signal)] transition hover:bg-ink hover:text-paper"
                >
                  Review request <Arrow />
                </button>
                <p className="text-xs text-ink-soft">You’ll review everything before it’s sent.</p>
              </div>
            </div>
          </div>
        </form>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <RequestSummary view={view} />
            <p className="px-2 text-xs leading-relaxed text-ink-soft">
              You’ll review this and approve the provider shortlist before any calls are made.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormHeading({ saveState }) {
  const status = {
    idle: "Drafts save on this device",
    saving: "Saving draft…",
    saved: "Draft saved on this device",
    unavailable: "Drafts can’t be saved in this browser",
  }[saveState];
  const dot = { idle: "bg-ink/25", saving: "bg-amber", saved: "bg-sage", unavailable: "bg-signal" }[saveState];
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">New request</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          What do you need <em>quoted?</em>
        </h1>
        <p className="mt-4 max-w-xl text-ink-soft">
          Four questions. You’ll review everything — and approve who gets called — before a single call goes out.
        </p>
      </div>
      <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {status}
      </p>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 md:pt-14" aria-busy="true">
      <FormHeading saveState="idle" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="space-y-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-[28px] border border-line bg-surface/50" />
          ))}
        </div>
        <div className="hidden h-96 animate-pulse rounded-[28px] border border-line bg-surface/50 lg:block" />
      </div>
    </div>
  );
}

function Question({ n, id, title, hint, optional = false, invalid = false, children }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`${cardClass} ${invalid ? "border-signal/50" : "border-line"}`}>
      <div className="flex items-baseline gap-4">
        <span className={`w-5 shrink-0 font-mono text-sm text-signal ${n ? "" : "hidden sm:block"}`}>{n}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-display text-[1.9rem] leading-tight tracking-tight">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
        </div>
        {optional && (
          <span className="shrink-0 rounded-full bg-paper-2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            Optional
          </span>
        )}
      </div>
      <div className="mt-6 sm:pl-9">{children}</div>
    </section>
  );
}

function MoneyField({ field, label, placeholder, value, error, onChange }) {
  return (
    <div>
      <label htmlFor={`field-${field}`} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-ink-soft">$</span>
        <input
          id={`field-${field}`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder={placeholder}
          className={`${fieldBase} pl-8 pr-4`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `field-${field}-error` : undefined}
        />
      </div>
      <FieldError field={field} message={error} />
    </div>
  );
}
