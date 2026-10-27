"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AgencyType, CatalogFilter, FitTier, WorkCategoryId } from "@/lib/contracts";
import { AGENCY_TYPE_LABEL, FIT_TIERS, WA_COUNTIES, WORK_CATEGORIES } from "@/lib/taxonomy";
import { selectResults, useExplorer } from "../store";
import { IconChevronDown, IconClose, IconBookmark, TierIcon } from "./Icons";

function Popover({ label, active, children, wide }: { label: string; active: boolean; children: (close: () => void) => React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); (ref.current?.querySelector("button") as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className={`chip${active ? " is-active" : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {label}
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div className={`popover${wide ? " is-wide" : ""}`} id={id} role="dialog" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Check({ checked, onChange, label, count, id }: { checked: boolean; onChange(v: boolean): void; label: React.ReactNode; count?: number; id: string }) {
  return (
    <label className="check-row" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-label">{label}</span>
      {count != null && <span className="check-count">{count}</span>}
    </label>
  );
}

function Radio<T extends string | number | null>({ name, value, current, onChange, label }: { name: string; value: T; current: T; onChange(v: T): void; label: string }) {
  const id = `${name}-${String(value)}`;
  return (
    <label className="check-row" htmlFor={id}>
      <input id={id} type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      <span className="check-label">{label}</span>
    </label>
  );
}

const toggle = <T,>(arr: T[], v: T, on: boolean) => (on ? [...new Set([...arr, v])] : arr.filter((x) => x !== v));
const chipLabel = (name: string, values: string[]) => (values.length === 0 ? name : values.length === 1 ? values[0] : `${values[0]} +${values.length - 1}`);

export function FilterBar() {
  const { state, actions, dispatch } = useExplorer();
  const f = state.filter;
  const facets = state.catalog.facets;
  const set = (patch: Partial<CatalogFilter>) => actions.setFilter(patch);
  const personalized = selectResults(state).personalized;
  const [countyQuery, setCountyQuery] = useState("");

  const agencyNames = new Map(state.catalog.agencies.map((a) => [a.id, a.name]));
  const serviceArea = state.profile?.serviceArea.value;

  return (
    <div className="filter-bar" role="toolbar" aria-label="Filters">
      <Popover label={chipLabel("Work type", f.workCategories.map((c) => WORK_CATEGORIES.find((w) => w.id === c)!.label))} active={f.workCategories.length > 0}>
        {() => (
          <div className="popover-body">
            <p className="popover-title">Work type</p>
            <p className="popover-sub">Groundwork and public works</p>
            {WORK_CATEGORIES.filter((c) => c.groundwork).map((c) => (
              <Check key={c.id} id={`wc-${c.id}`} label={c.label} count={facets?.workCategories[c.id] ?? 0} checked={f.workCategories.includes(c.id)} onChange={(v) => set({ workCategories: toggle<WorkCategoryId>(f.workCategories, c.id, v) })} />
            ))}
            <p className="popover-sub">Other categories</p>
            {WORK_CATEGORIES.filter((c) => !c.groundwork).map((c) => (
              <Check key={c.id} id={`wc-${c.id}`} label={c.label} count={facets?.workCategories[c.id] ?? 0} checked={f.workCategories.includes(c.id)} onChange={(v) => set({ workCategories: toggle<WorkCategoryId>(f.workCategories, c.id, v) })} />
            ))}
            {f.workCategories.length > 0 && <button className="btn-text" onClick={() => set({ workCategories: [] })}>Clear work types</button>}
          </div>
        )}
      </Popover>

      <Popover label={chipLabel("County", f.countyNames.map((c) => `${c} County`))} active={f.countyNames.length > 0} wide>
        {() => (
          <div className="popover-body">
            <p className="popover-title">County</p>
            {serviceArea?.kind === "counties" && (
              <button className="btn btn-gray btn-small" onClick={() => set({ countyNames: serviceArea.counties })}>Use my service area</button>
            )}
            <input id="county-search" className="input input-small" placeholder="Find a county" value={countyQuery} onChange={(e) => setCountyQuery(e.target.value)} aria-label="Find a county" />
            <div className="check-grid">
              {WA_COUNTIES.filter((c) => c.toLowerCase().includes(countyQuery.toLowerCase())).map((c) => (
                <Check key={c} id={`county-${c}`} label={c} count={facets?.counties[c] ?? 0} checked={f.countyNames.includes(c)} onChange={(v) => set({ countyNames: toggle(f.countyNames, c, v) })} />
              ))}
            </div>
            <p className="popover-note">Statewide work counts in every county. Work with no stated location appears when that option is on below.</p>
            {f.countyNames.length > 0 && <button className="btn-text" onClick={() => set({ countyNames: [] })}>Clear counties</button>}
          </div>
        )}
      </Popover>

      <Popover label={chipLabel("Agency", f.agencyIds.map((a) => agencyNames.get(a) ?? a).concat(f.agencyTypes.map((t) => AGENCY_TYPE_LABEL[t])))} active={f.agencyIds.length + f.agencyTypes.length > 0} wide>
        {() => (
          <div className="popover-body">
            <p className="popover-title">Agency type</p>
            <div className="check-grid">
              {(["city", "county", "state", "utility", "port", "school", "university"] as AgencyType[]).map((t) => (
                <Check key={t} id={`at-${t}`} label={AGENCY_TYPE_LABEL[t]} checked={f.agencyTypes.includes(t)} onChange={(v) => set({ agencyTypes: toggle(f.agencyTypes, t, v) })} />
              ))}
            </div>
            <p className="popover-title">Agency</p>
            <div className="check-scroll">
              {[...state.catalog.agencies].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
                <Check key={a.id} id={`ag-${a.id}`} label={a.name} count={facets?.agencies[a.id] ?? 0} checked={f.agencyIds.includes(a.id)} onChange={(v) => set({ agencyIds: toggle(f.agencyIds, a.id, v) })} />
              ))}
            </div>
            {f.agencyIds.length + f.agencyTypes.length > 0 && <button className="btn-text" onClick={() => set({ agencyIds: [], agencyTypes: [] })}>Clear agencies</button>}
          </div>
        )}
      </Popover>

      <Popover label={f.publishedWithinDays ? `Posted in ${f.publishedWithinDays} days` : "Posted"} active={f.publishedWithinDays != null}>
        {() => (
          <div className="popover-body">
            <p className="popover-title">Publication date</p>
            <Radio name="pub" value={null} current={f.publishedWithinDays} onChange={(v) => set({ publishedWithinDays: v })} label="Any time" />
            <Radio name="pub" value={7} current={f.publishedWithinDays} onChange={(v) => set({ publishedWithinDays: v })} label="Last 7 days" />
            <Radio name="pub" value={30} current={f.publishedWithinDays} onChange={(v) => set({ publishedWithinDays: v })} label="Last 30 days" />
            <Check id="pub-unknown" label="Include listings with no publication date" checked={f.includeUnknownDates} onChange={(v) => set({ includeUnknownDates: v })} />
            <p className="popover-note">Uses the date the agency published the listing, not when we first found it.</p>
          </div>
        )}
      </Popover>

      <Popover label={f.deadlineWithinDays === "unknown" ? "No deadline posted" : f.deadlineWithinDays ? `Closes in ${f.deadlineWithinDays} days` : "Closing"} active={f.deadlineWithinDays != null}>
        {() => (
          <div className="popover-body">
            <p className="popover-title">Bid deadline</p>
            <Radio name="dl" value={null} current={f.deadlineWithinDays} onChange={(v) => set({ deadlineWithinDays: v })} label="Any open deadline" />
            <Radio name="dl" value={7} current={f.deadlineWithinDays} onChange={(v) => set({ deadlineWithinDays: v })} label="Next 7 days" />
            <Radio name="dl" value={30} current={f.deadlineWithinDays} onChange={(v) => set({ deadlineWithinDays: v })} label="Next 30 days" />
            <Radio name="dl" value={"unknown"} current={f.deadlineWithinDays} onChange={(v) => set({ deadlineWithinDays: v })} label="Deadline not published" />
          </div>
        )}
      </Popover>

      {personalized && (
        <Popover label={chipLabel("Fit", f.fitTiers.map((t) => FIT_TIERS.find((x) => x.id === t)!.label))} active={f.fitTiers.length > 0}>
          {() => (
            <div className="popover-body">
              <p className="popover-title">Fit for your business</p>
              {FIT_TIERS.map((t) => (
                <Check key={t.id} id={`fit-${t.id}`} label={<span className="fit-check"><TierIcon tier={t.id} size={14} />{t.label}</span>} checked={f.fitTiers.includes(t.id)} onChange={(v) => set({ fitTiers: toggle<FitTier>(f.fitTiers, t.id, v) })} />
              ))}
            </div>
          )}
        </Popover>
      )}

      <Popover label="Location types" active={!f.includeStatewide || !f.includeUnknownLocations}>
        {() => (
          <div className="popover-body">
            <p className="popover-title">Work without a map pin</p>
            <Check id="inc-statewide" label="Statewide or no physical site" checked={f.includeStatewide} onChange={(v) => set({ includeStatewide: v })} />
            <Check id="inc-unknown" label="Location not stated" checked={f.includeUnknownLocations} onChange={(v) => set({ includeUnknownLocations: v })} />
            <p className="popover-note">These appear in the list under Not on map. They are never given invented coordinates.</p>
          </div>
        )}
      </Popover>

      <button type="button" className={`chip${state.savedOnly ? " is-active" : ""}`} aria-pressed={state.savedOnly} onClick={() => dispatch({ type: "savedOnly", value: !state.savedOnly })}>
        <IconBookmark size={14} filled={state.savedOnly} />
        Saved{state.saved.length ? ` (${state.saved.length})` : ""}
      </button>

      {f.viewportBounds && (
        <button type="button" className="chip is-active is-removable" onClick={() => set({ viewportBounds: null })} aria-label="Remove map area filter">
          In map area
          <IconClose size={13} />
        </button>
      )}
    </div>
  );
}
