"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Arrow, CheckGlyph } from "@/components/icons";
import { FieldError, RadioDot, cardChoiceClass, inputClass } from "@/components/form-parts";
import { hasRequestDraft } from "@/lib/account";
import { submitApplication } from "@/app/account/actions";
import { PLANS, PLAN_FEATURES, findPlan } from "@/lib/plans";
import { useBrowserValue } from "@/lib/use-browser-value";

const ROLES = ["Property manager", "Facilities manager", "Office manager", "Business owner", "Operations lead", "Procurement", "Other"];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Australia", "Other"];

const EMPTY_DETAILS = { name: "", email: "", company: "", role: "" };
// Payment fields live only in this component's state: they have no `name`
// attributes, the form never posts, and they're cleared before leaving the
// page. Card details are never sent or stored.
const EMPTY_CARD = { number: "", expiry: "", cvc: "", holder: "", country: "United States", postal: "" };

const FIELD_ORDER = ["name", "email", "number", "expiry", "cvc", "holder", "postal"];

const digits = (value) => value.replace(/\D/g, "");

function formatCardNumber(value) {
  return digits(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value) {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

function cardBrand(number) {
  const d = digits(number);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(d)) return "Discover";
  return null;
}

function passesLuhn(number) {
  const d = digits(number);
  let sum = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return d.length >= 13 && sum % 10 === 0;
}

function validate(details, card, now) {
  const errors = {};
  if (!details.name.trim()) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) errors.email = "Enter a valid work email.";
  if (!passesLuhn(card.number)) errors.number = "Enter a valid card number.";
  const expiry = digits(card.expiry);
  if (expiry.length !== 4) {
    errors.expiry = "Enter the expiry as MM / YY.";
  } else {
    const month = Number(expiry.slice(0, 2));
    const year = 2000 + Number(expiry.slice(2));
    if (month < 1 || month > 12) errors.expiry = "Enter a month from 01 to 12.";
    else if (new Date(year, month, 1) <= now) errors.expiry = "This card has expired.";
  }
  const cvcLength = cardBrand(card.number) === "Amex" ? 4 : 3;
  if (digits(card.cvc).length !== cvcLength) errors.cvc = `Enter the ${cvcLength}-digit security code.`;
  if (!card.holder.trim()) errors.holder = "Enter the name on the card.";
  const us = card.country === "United States";
  if (us ? !/^\d{5}(-\d{4})?$/.test(card.postal.trim()) : !card.postal.trim()) {
    errors.postal = us ? "Enter a 5-digit ZIP code." : "Enter your postal code.";
  }
  return errors;
}

export default function CheckoutForm({ initialPlanId, defaults }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(initialPlanId);
  const [details, setDetails] = useState(() => ({ ...EMPTY_DETAILS, ...defaults }));
  const [card, setCard] = useState(EMPTY_CARD);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const requestWaiting = useBrowserValue(hasRequestDraft);
  const plan = findPlan(planId);
  const brand = cardBrand(card.number);

  function editDetails(patch) {
    setDetails((current) => ({ ...current, ...patch }));
    clearErrors(Object.keys(patch));
  }

  function editCard(patch) {
    setCard((current) => ({ ...current, ...patch }));
    clearErrors(Object.keys(patch));
  }

  function clearErrors(fields) {
    if (Object.keys(errors).length === 0) return;
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== "form" && !fields.includes(key))));
  }

  function choosePlan(id) {
    setPlanId(id);
    window.history.replaceState(null, "", `/checkout/${id}`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const found = validate(details, card, new Date());
    if (Object.keys(found).length > 0) {
      setErrors({ ...found, form: "Check the highlighted fields." });
      const first = FIELD_ORDER.find((field) => found[field]);
      document.getElementById(`field-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    // Card fields stay in this component: only contact details and the plan
    // are sent.
    submitApplication({
      name: details.name.trim(),
      email: details.email.trim(),
      company: details.company.trim(),
      role: details.role,
      plan: planId,
    })
      .catch(() => ({ error: "We couldn’t save your application. Try again in a minute." }))
      .then((result) => {
        if (result.error) {
          setErrors({ form: result.error });
          setSubmitting(false);
          return;
        }
        setCard(EMPTY_CARD);
        router.push("/account/pending");
      });
  }

  const describedBy = (field) => (errors[field] ? `field-${field}-error` : undefined);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 md:pt-14">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Checkout</p>
      <h1 className="mt-3 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
        Set up your <em>account.</em>
      </h1>
      <p className="mt-4 max-w-xl text-ink-soft">
        New accounts are reviewed by our team before they go live. You won’t be charged until yours is approved.
      </p>
      {requestWaiting && (
        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-sage/30 bg-sage-soft px-4 py-2 text-sm text-sage">
          <CheckGlyph className="h-3.5 w-3.5" />
          Your request draft is saved. Finish setting up your account to send it.
        </p>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <form noValidate onSubmit={handleSubmit} aria-label="Checkout" className="min-w-0 space-y-5">
          <Section n="01" title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" field="name" error={errors.name}>
                <input id="field-name" autoComplete="name" value={details.name} onChange={(e) => editDetails({ name: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.name)} aria-describedby={describedBy("name")} />
              </Field>
              <Field label="Work email" field="email" error={errors.email}>
                <input id="field-email" type="email" autoComplete="email" value={details.email} onChange={(e) => editDetails({ email: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.email)} aria-describedby={describedBy("email")} />
              </Field>
              <Field label="Company" optional field="company">
                <input id="field-company" autoComplete="organization" value={details.company} onChange={(e) => editDetails({ company: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Your role" optional field="role">
                <select id="field-role" value={details.role} onChange={(e) => editDetails({ role: e.target.value })} className={inputClass}>
                  <option value="">Select a role</option>
                  {ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section n="02" title="Plan">
            <fieldset>
              <legend className="sr-only">Plan</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {PLANS.map((p) => (
                  <label key={p.id} className={cardChoiceClass}>
                    <input type="radio" name="plan" value={p.id} checked={planId === p.id} onChange={() => choosePlan(p.id)} className="sr-only" />
                    <RadioDot />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-display text-2xl leading-none">
                          ${p.price}
                          <span className="font-sans text-xs text-ink-soft"> / mo</span>
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-ink-soft">{p.quota}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section n="03" title="Payment method" hint="You won’t be charged until your account is approved.">
            <div className="grid gap-4">
              <Field label="Card number" field="number" error={errors.number}>
                <div className="relative">
                  <input id="field-number" inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={card.number} onChange={(e) => editCard({ number: formatCardNumber(e.target.value) })} className={`${inputClass} pr-28 tabular-nums`} aria-invalid={Boolean(errors.number)} aria-describedby={describedBy("number")} />
                  <span className="pointer-events-none absolute right-4 top-1/2 mt-1 -translate-y-1/2 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{brand ?? "Card"}</span>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry" field="expiry" error={errors.expiry}>
                  <input id="field-expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={card.expiry} onChange={(e) => editCard({ expiry: formatExpiry(e.target.value) })} className={`${inputClass} tabular-nums`} aria-invalid={Boolean(errors.expiry)} aria-describedby={describedBy("expiry")} />
                </Field>
                <Field label="Security code" field="cvc" error={errors.cvc}>
                  <input id="field-cvc" inputMode="numeric" autoComplete="cc-csc" placeholder={brand === "Amex" ? "4 digits" : "3 digits"} value={card.cvc} onChange={(e) => editCard({ cvc: digits(e.target.value).slice(0, 4) })} className={`${inputClass} tabular-nums`} aria-invalid={Boolean(errors.cvc)} aria-describedby={describedBy("cvc")} />
                </Field>
              </div>
              <Field label="Name on card" field="holder" error={errors.holder}>
                <input id="field-holder" autoComplete="cc-name" value={card.holder} onChange={(e) => editCard({ holder: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.holder)} aria-describedby={describedBy("holder")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Country" field="country">
                  <select id="field-country" autoComplete="country-name" value={card.country} onChange={(e) => editCard({ country: e.target.value })} className={inputClass}>
                    {COUNTRIES.map((country) => (
                      <option key={country}>{country}</option>
                    ))}
                  </select>
                </Field>
                <Field label={card.country === "United States" ? "ZIP code" : "Postal code"} field="postal" error={errors.postal}>
                  <input id="field-postal" autoComplete="postal-code" value={card.postal} onChange={(e) => editCard({ postal: e.target.value })} className={inputClass} aria-invalid={Boolean(errors.postal)} aria-describedby={describedBy("postal")} />
                </Field>
              </div>
            </div>
          </Section>

          <div className="border-t border-line pt-6">
            {errors.form && (
              <p role="alert" className="mb-4 text-sm font-medium text-signal">
                {errors.form}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-sm text-xs leading-relaxed text-ink-soft">
                By submitting, you’re asking us to review your account. Nothing is charged today.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-signal px-7 py-3.5 font-medium text-white shadow-[0_10px_30px_-10px_var(--signal)] transition hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-70"
              >
                {submitting ? "Submitting…" : "Submit for approval"} {!submitting && <Arrow />}
              </button>
            </div>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary plan={plan} />
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, hint, children }) {
  return (
    <section aria-labelledby={`${n}-title`} className="rounded-[28px] border border-line bg-surface/70 p-6 sm:p-8">
      <div className="flex items-baseline gap-4">
        <span className="w-5 shrink-0 font-mono text-sm text-signal">{n}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`${n}-title`} className="font-display text-[1.9rem] leading-tight tracking-tight">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
        </div>
      </div>
      <div className="mt-6 sm:pl-9">{children}</div>
    </section>
  );
}

function Field({ label, field, optional = false, error, children }) {
  return (
    <div>
      <label htmlFor={`field-${field}`} className="text-sm font-medium">
        {label} {optional && <span className="font-normal text-ink-soft">(optional)</span>}
      </label>
      {children}
      <FieldError field={field} message={error} />
    </div>
  );
}

function OrderSummary({ plan }) {
  return (
    <div className="rounded-[28px] border border-line bg-surface/80 p-2 shadow-[0_30px_80px_-40px_rgb(21_20_15/0.35)]">
      <div className="rounded-[22px] bg-night p-6 text-on-night">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-on-night/50">Order summary</p>
        <p className="mt-3 font-display text-3xl leading-tight">{plan.name} plan</p>
        <p className="mt-1 text-sm text-on-night/60">{plan.quota}</p>
        <p className="mt-6 flex items-end gap-2">
          <span className="font-display text-6xl leading-[0.85]">${plan.price}</span>
          <span className="pb-1 text-on-night/60">/ month</span>
        </p>
      </div>
      <dl className="divide-y divide-line/70 px-4 text-sm">
        <div className="flex justify-between gap-4 py-3.5">
          <dt className="text-ink-soft">Billing</dt>
          <dd>Monthly, after approval</dd>
        </div>
        <div className="flex justify-between gap-4 py-3.5">
          <dt className="text-ink-soft">Due today</dt>
          <dd className="font-semibold">$0.00</dd>
        </div>
      </dl>
      <ul className="space-y-2.5 px-4 pb-2 pt-1 text-sm text-ink-soft">
        {PLAN_FEATURES.slice(0, 4).map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-sage-soft text-sage">
              <CheckGlyph className="h-2.5 w-2.5" />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <p className="mx-2 mt-3 rounded-[18px] bg-paper-2/70 px-4 py-3 text-xs leading-relaxed text-ink-soft">
        Every new account is reviewed before activation. We’ll email you as soon as yours is approved.
      </p>
    </div>
  );
}
