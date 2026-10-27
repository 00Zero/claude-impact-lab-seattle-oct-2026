"use client";

import { useEffect, useRef, useState } from "react";
import type { FieldProvenance, FollowUpQuestion, ProfileField, ServiceArea, TriState, VendorProfileFields, WorkCategoryId } from "@/lib/contracts";
import { WA_COUNTIES, WORK_CATEGORIES } from "@/lib/taxonomy";
import { emptyProfileFields } from "@/lib/sim/interpret";
import { isServiceError } from "@/lib/services/types";
import { useExplorer } from "../store";
import { IconClose, IconSparkle, IconAlert, IconChevronLeft } from "./Icons";

type Step = "describe" | "interpreting" | "questions" | "review";

const EXAMPLE = "We're a 6-person asphalt crew based in Tacoma. We do pothole patching, small paving jobs, and crack sealing in Pierce, King, and Kitsap counties. We don't do concrete work.";

export function Onboarding() {
  const { state, services, actions, dispatch } = useExplorer();
  const editing = state.onboarding?.mode === "edit" && !!state.profile;
  const [step, setStep] = useState<Step>(editing ? "review" : "describe");
  const [description, setDescription] = useState(editing ? state.profile!.originalDescription : "");
  const [baseHint, setBaseHint] = useState("");
  const [fields, setFields] = useState<VendorProfileFields>(() => (editing ? pickFields(state.profile!) : emptyProfileFields()));
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fromAI, setFromAI] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = () => dispatch({ type: "onboarding", value: null });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && dialogRef.current) {
        const els = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, select, textarea, a[href]");
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [step, qIndex]);

  async function interpret() {
    setStep("interpreting");
    setError(null);
    try {
      const r = await services.profile.interpret(description, { baseLocation: baseHint || undefined });
      setFields(r.draft);
      setQuestions(r.followUps);
      setQIndex(0);
      setFromAI(true);
      setStep(r.followUps.length ? "questions" : "review");
    } catch (e) {
      setError(isServiceError(e) ? e.message : "Couldn't read your description.");
      setStep("describe");
    }
  }

  function answer(q: FollowUpQuestion, value: unknown) {
    if (value !== undefined && value !== "unknown") setFields((f) => ({ ...f, [q.field]: { value, provenance: "user" } }));
    if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
    else setStep("review");
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await actions.confirmProfile(fields, description);
      dispatch({ type: "toast", text: editing ? "Profile updated. Rechecking your matches." : "Profile saved. Matching opportunities to your business." });
      close();
    } catch (e) {
      setError(isServiceError(e) ? e.message : "Couldn't save your profile.");
      setSaving(false);
    }
  }

  const title = editing ? "Edit your business profile" : step === "review" ? "Review your profile" : "Find work for your business";

  return (
    <div className="modal-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="onb-title" ref={dialogRef}>
        <div className="modal-bar">
          {step === "review" && !editing && fromAI ? (
            <button className="btn-text btn-back" onClick={() => setStep("describe")}><IconChevronLeft size={18} />Description</button>
          ) : <span />}
          <button className="icon-btn" onClick={close} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <div className="modal-head">
          {!editing && <Steps step={step} />}
          <h2 id="onb-title" className="modal-title">{title}</h2>
        </div>

        {step === "describe" && (
          <div className="modal-body">
            <label className="field">
              <span className="field-label is-large">What does your business do, and where do you work?</span>
              <textarea id="onb-description" data-autofocus className="input textarea" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={EXAMPLE} />
              <span className="field-hint">Write it the way you'd tell a customer. Leave out prices and rates. We never ask for them.</span>
            </label>
            {!description && <button className="btn-text" onClick={() => setDescription(EXAMPLE)}>Use an example description</button>}
            <label className="field">
              <span className="field-label">Where is your business based? <span className="optional">Optional</span></span>
              <input id="onb-base" className="input" value={baseHint} onChange={(e) => setBaseHint(e.target.value)} placeholder="City or ZIP code" />
            </label>
            {error && (
              <div className="inline-alert" role="alert">
                <IconAlert size={16} />
                <span>{error} You can try again, or fill in the fields yourself.</span>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-plain" onClick={() => { setFields(emptyProfileFields()); setFromAI(false); setStep("review"); }}>Fill in fields myself</button>
              <button className="btn btn-filled" disabled={description.trim().length < 12} onClick={interpret}>
                <IconSparkle size={16} />{error ? "Try again" : "Continue"}
              </button>
            </div>
            {services.integration.interpretation === "simulated" && (
              <p className="meta-note">Development mode: a keyword reader stands in for the AI profile service. It only picks up what you write.</p>
            )}
          </div>
        )}

        {step === "interpreting" && (
          <div className="modal-body is-center" role="status">
            <div className="spinner" aria-hidden="true" />
            <p className="state-title">Reading your description</p>
            <p className="state-text">Pulling out services, service area, and anything you said about crews or qualifications.</p>
            <button className="btn btn-plain" onClick={() => { setFields(emptyProfileFields()); setStep("review"); }}>Fill in fields myself instead</button>
          </div>
        )}

        {step === "questions" && questions[qIndex] && (
          <Question key={questions[qIndex].id} q={questions[qIndex]} n={qIndex + 1} total={questions.length} onAnswer={answer} />
        )}

        {step === "review" && (
          <ProfileForm fields={fields} setFields={setFields} fromAI={fromAI && !editing} error={error} saving={saving} editing={editing} onConfirm={confirm} onCancel={close} />
        )}
      </div>
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ["describe", "questions", "review"];
  const idx = step === "interpreting" ? 0 : order.indexOf(step);
  return (
    <ol className="steps" aria-label="Progress">
      {["Describe", "A few questions", "Review"].map((l, i) => (
        <li key={l} className={i < idx ? "is-done" : i === idx ? "is-current" : ""} aria-current={i === idx ? "step" : undefined}>{l}</li>
      ))}
    </ol>
  );
}

function Question({ q, n, total, onAnswer }: { q: FollowUpQuestion; n: number; total: number; onAnswer(q: FollowUpQuestion, v: unknown): void }) {
  const [multi, setMulti] = useState<string[]>([]);
  const isArea = q.field === "serviceArea";
  const isServices = q.field === "coreServices";
  return (
    <div className="modal-body">
      <p className="q-count">Question {n} of {total}</p>
      <p className="q-prompt">{q.prompt}</p>
      <p className="field-hint">{q.why}</p>
      {isArea || isServices ? (
        <>
          <div className="pick-grid">
            {(isArea ? WA_COUNTIES : WORK_CATEGORIES.map((c) => c.id)).map((v, i) => (
              <button key={v} data-autofocus={i === 0 || undefined} className={`pick${multi.includes(v) ? " is-on" : ""}`} aria-pressed={multi.includes(v)} onClick={() => setMulti((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]))}>
                {isArea ? v : WORK_CATEGORIES.find((c) => c.id === v)!.label}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn btn-plain" onClick={() => onAnswer(q, undefined)}>Skip for now</button>
            {isArea && <button className="btn btn-gray" onClick={() => onAnswer(q, { kind: "statewide" } satisfies ServiceArea)}>All of Washington</button>}
            <button className="btn btn-filled" disabled={!multi.length} onClick={() => onAnswer(q, isArea ? ({ kind: "counties", counties: multi } satisfies ServiceArea) : multi)}>Continue</button>
          </div>
        </>
      ) : (
        <div className="option-col">
          {q.options.map((o, i) => (
            <button key={String(o.value)} data-autofocus={i === 0 || undefined} className="option" onClick={() => onAnswer(q, o.value)}>{o.label}</button>
          ))}
          <button className="btn btn-plain" onClick={() => onAnswer(q, undefined)}>Skip for now</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Review / edit form ---------- */

function pickFields(p: VendorProfileFields): VendorProfileFields {
  const out = emptyProfileFields();
  for (const k of Object.keys(out) as (keyof VendorProfileFields)[]) (out as unknown as Record<string, unknown>)[k] = p[k];
  return out;
}

const PROV_LABEL: Record<FieldProvenance, string> = { inferred: "From your description", user: "You entered", confirmed: "Confirmed", unknown: "Not provided" };

function Prov({ f }: { f: ProfileField<unknown> }) {
  const p = f.value == null || (Array.isArray(f.value) && !f.value.length) ? "unknown" : f.provenance;
  return <span className={`prov is-${p}`}>{PROV_LABEL[p]}</span>;
}

function ProfileForm({ fields, setFields, fromAI, error, saving, editing, onConfirm, onCancel }: {
  fields: VendorProfileFields; setFields: React.Dispatch<React.SetStateAction<VendorProfileFields>>; fromAI: boolean; error: string | null; saving: boolean; editing: boolean; onConfirm(): void; onCancel(): void;
}) {
  const set = <K extends keyof VendorProfileFields>(k: K, value: VendorProfileFields[K]["value"]) =>
    setFields((f) => ({ ...f, [k]: { value: value === "" || (Array.isArray(value) && !value.length) ? null : value, provenance: "user" } }));
  const area = fields.serviceArea.value;
  const services = fields.coreServices.value ?? [];
  const exclusions = fields.exclusions.value ?? [];
  const missing = [!services.length && "at least one service", !area && "a service area"].filter(Boolean) as string[];
  const inferredCount = Object.values(fields).filter((f) => f.provenance === "inferred" && f.value != null).length;

  const csv = (v: string[] | null) => (v ?? []).join(", ");
  const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const toggle = (arr: WorkCategoryId[], v: WorkCategoryId) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="modal-body profile-form">
      {fromAI && inferredCount > 0 && (
        <p className="review-intro">
          We filled in {inferredCount} {inferredCount === 1 ? "field" : "fields"} from your description. Each one is marked <span className="prov is-inferred">From your description</span>. Fix anything that's wrong. Anything you didn't mention stays unknown.
        </p>
      )}

      <fieldset className="form-group">
        <legend>What you do</legend>
        <div className="form-row">
          <span className="field-label">Services <Prov f={fields.coreServices} /></span>
          <div className="pick-grid">
            {WORK_CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={`pick${services.includes(c.id) ? " is-on" : ""}`} aria-pressed={services.includes(c.id)}
                onClick={() => { set("coreServices", toggle(services, c.id)); if (exclusions.includes(c.id)) set("exclusions", exclusions.filter((x) => x !== c.id)); }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <span className="field-label">Work you don't do <Prov f={fields.exclusions} /></span>
          <div className="pick-grid">
            {WORK_CATEGORIES.filter((c) => c.groundwork).map((c) => (
              <button type="button" key={c.id} className={`pick is-exclude${exclusions.includes(c.id) ? " is-on" : ""}`} aria-pressed={exclusions.includes(c.id)}
                onClick={() => { set("exclusions", toggle(exclusions, c.id)); if (services.includes(c.id)) set("coreServices", services.filter((x) => x !== c.id)); }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <TextField id="pf-specialties" label="Specialties" f={fields.specialties} value={csv(fields.specialties.value)} onChange={(v) => set("specialties", parseCsv(v))} hint="Separate with commas, for example crack sealing, ADA ramps" />
      </fieldset>

      <fieldset className="form-group">
        <legend>Where you work</legend>
        <TextField id="pf-name" label="Business name" f={fields.businessName} value={fields.businessName.value ?? ""} onChange={(v) => set("businessName", v)} optional />
        <TextField id="pf-base" label="Based in" f={fields.baseLocation} value={fields.baseLocation.value ?? ""} onChange={(v) => set("baseLocation", v)} hint="City or ZIP code" />
        <div className="form-row">
          <span className="field-label">Service area <Prov f={fields.serviceArea} /></span>
          <div className="segmented segmented-small">
            <button type="button" className={area?.kind !== "statewide" ? "is-on" : ""} onClick={() => set("serviceArea", { kind: "counties", counties: area?.kind === "counties" ? area.counties : [] })}>Selected counties</button>
            <button type="button" className={area?.kind === "statewide" ? "is-on" : ""} onClick={() => set("serviceArea", { kind: "statewide" })}>All of Washington</button>
          </div>
          {area?.kind !== "statewide" && (
            <div className="pick-grid is-dense">
              {WA_COUNTIES.map((c) => {
                const on = area?.kind === "counties" && area.counties.includes(c);
                return (
                  <button type="button" key={c} className={`pick${on ? " is-on" : ""}`} aria-pressed={on}
                    onClick={() => { const cur = area?.kind === "counties" ? area.counties : []; const next = on ? cur.filter((x) => x !== c) : [...cur, c]; set("serviceArea", next.length ? { kind: "counties", counties: next } : null); }}>
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend>Crew and equipment</legend>
        <TextField id="pf-crew" label="Crew size" f={fields.crewSize} value={fields.crewSize.value ?? ""} onChange={(v) => set("crewSize", v)} hint="A number or a range" optional />
        <TextField id="pf-equipment" label="Equipment you own or can get" f={fields.equipment} value={csv(fields.equipment.value)} onChange={(v) => set("equipment", parseCsv(v))} hint="Separate with commas" optional />
        <SelectField id="pf-scale" label="Typical project size" f={fields.projectScale} onChange={(v) => set("projectScale", v as VendorProfileFields["projectScale"]["value"])}
          options={[["small_repairs", "Small repairs"], ["maintenance", "Ongoing maintenance"], ["multi_crew", "Multi-crew jobs"], ["larger_projects", "Larger projects"]]} />
        <TextField id="pf-experience" label="Relevant past work" f={fields.relevantExperience} value={fields.relevantExperience.value ?? ""} onChange={(v) => set("relevantExperience", v)} hint="A short example or two" optional />
      </fieldset>

      <fieldset className="form-group">
        <legend>Qualifications</legend>
        <p className="field-hint">Answer only what you know. Unknown stays unknown and is never treated as a no.</p>
        <TriField id="pf-reg" label="Washington contractor registration" f={fields.contractorRegistration} onChange={(v) => set("contractorRegistration", v)} />
        <TriField id="pf-bond" label="Can meet bonding requirements on bids" f={fields.bonding} onChange={(v) => set("bonding", v)} />
        <TriField id="pf-ins" label="Carries general liability insurance" f={fields.insurance} onChange={(v) => set("insurance", v)} />
        <TextField id="pf-licenses" label="Other licenses" f={fields.licenses} value={csv(fields.licenses.value)} onChange={(v) => set("licenses", parseCsv(v))} optional />
        <TextField id="pf-certs" label="Certifications" f={fields.certifications} value={csv(fields.certifications.value)} onChange={(v) => set("certifications", parseCsv(v))} hint="For example DBE or small business certifications" optional />
      </fieldset>

      <fieldset className="form-group">
        <legend>How you want to work</legend>
        <SelectField id="pf-role" label="Bid as" f={fields.roleInterest} onChange={(v) => set("roleInterest", v as VendorProfileFields["roleInterest"]["value"])}
          options={[["prime", "Prime contractor"], ["subcontract", "Subcontractor"], ["both", "Either"], ["unsure", "Not sure yet"]]} />
        <SelectField id="pf-gov" label="Government work so far" f={fields.governmentExperience} onChange={(v) => set("governmentExperience", v as VendorProfileFields["governmentExperience"]["value"])}
          options={[["first_time", "None yet"], ["subcontractor", "As a subcontractor"], ["prime", "As a prime contractor"]]} />
        <TextField id="pf-avail" label="Availability" f={fields.availability} value={fields.availability.value ?? ""} onChange={(v) => set("availability", v)} hint="Available now, or a start date" optional />
        <TextField id="pf-constraints" label="Working hours" f={fields.workingConstraints} value={csv(fields.workingConstraints.value)} onChange={(v) => set("workingConstraints", parseCsv(v))} hint="For example nights, weekends, emergency call-outs" optional />
      </fieldset>

      {error && <div className="inline-alert" role="alert"><IconAlert size={16} /><span>{error}</span></div>}
      <div className="modal-actions is-sticky">
        {missing.length > 0 && <p className="field-hint">Add {missing.join(" and ")} to continue.</p>}
        <button className="btn btn-plain" onClick={onCancel}>Cancel</button>
        <button className="btn btn-filled" disabled={!!missing.length || saving} onClick={onConfirm}>
          {saving ? "Saving…" : editing ? "Save changes" : "Confirm and see matches"}
        </button>
      </div>
    </div>
  );
}

function TextField({ id, label, f, value, onChange, hint, optional }: { id: string; label: string; f: ProfileField<unknown>; value: string; onChange(v: string): void; hint?: string; optional?: boolean }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="form-row" htmlFor={id}>
      <span className="field-label">{label}{optional && <span className="optional"> Optional</span>} <Prov f={f} /></span>
      <input id={id} className={`input${f.provenance === "inferred" && f.value != null ? " is-inferred" : ""}`} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => local !== value && onChange(local)} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function SelectField({ id, label, f, onChange, options }: { id: string; label: string; f: ProfileField<string>; onChange(v: string | null): void; options: [string, string][] }) {
  return (
    <label className="form-row" htmlFor={id}>
      <span className="field-label">{label} <Prov f={f} /></span>
      <select id={id} className={`input${f.provenance === "inferred" && f.value != null ? " is-inferred" : ""}`} value={f.value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Not provided</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function TriField({ id, label, f, onChange }: { id: string; label: string; f: ProfileField<TriState>; onChange(v: TriState | null): void }) {
  const v = f.value ?? "unknown";
  return (
    <div className="form-row tri" role="radiogroup" aria-labelledby={`${id}-l`}>
      <span className="field-label" id={`${id}-l`}>{label} <Prov f={f} /></span>
      <div className="segmented segmented-small">
        {(["yes", "no", "unknown"] as const).map((o) => (
          <button type="button" key={o} role="radio" aria-checked={v === o} className={v === o ? "is-on" : ""} onClick={() => onChange(o === "unknown" ? null : o)}>
            {o === "yes" ? "Yes" : o === "no" ? "No" : "Not sure"}
          </button>
        ))}
      </div>
    </div>
  );
}
