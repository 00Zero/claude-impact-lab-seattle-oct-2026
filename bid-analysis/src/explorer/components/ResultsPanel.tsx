"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Agency, FitAssessment, Opportunity } from "@/lib/contracts";
import { categoryLabel, PRECISION_COPY } from "@/lib/taxonomy";
import { deadlineLabel, postedLabel } from "@/lib/dates";
import { hasMapPoint } from "@/lib/catalogQuery";
import { selectResults, useExplorer } from "../store";
import { FilterBar } from "./Filters";
import { FitState } from "./Fit";
import { IconBookmark, IconEdit, IconSearch, IconSparkle, IconClose, IconAlert, IconChevronRight, IconMap } from "./Icons";

export function locationLine(o: Opportunity): string {
  if (o.locations.length > 1) {
    const counties = [...new Set(o.locations.flatMap((l) => l.countyNames))];
    return `${o.locations.length} work sites in ${counties.join(" and ")} County`;
  }
  const l = o.locations[0];
  if (!l) return "Location not stated";
  const p = PRECISION_COPY[l.precision];
  if (l.precision === "statewide" || l.precision === "remote" || l.precision === "unknown") return p.short;
  if (l.precision === "city") return `${l.cityName}, site not specified`;
  if (l.precision === "county") return `${l.countyNames[0]} County, site not specified`;
  return l.cityName ? `${l.label.split(",")[0]}, ${l.cityName}` : `${l.label.split(",")[0]}, ${l.countyNames[0]} County`;
}

export function ResultsPanel({ onSelect, onExploreServiceArea }: { onSelect(id: string): void; onExploreServiceArea?: () => void }) {
  const { state, actions, dispatch, services } = useExplorer();
  const { all, shown, mapped, unmapped, personalized } = selectResults(state);
  const [query, setQuery] = useState(state.filter.query);
  const listRef = useRef<HTMLDivElement>(null);
  const agencies = new Map(state.catalog.agencies.map((a) => [a.id, a]));
  const loading = state.catalog.status === "loading";
  const failed = state.catalog.status === "error";
  const firstLoad = loading && !state.catalog.meta;
  const matching = state.matching;

  // Debounced keyword search
  useEffect(() => {
    if (query === state.filter.query) return;
    const t = setTimeout(() => actions.setFilter({ query }), 220);
    return () => clearTimeout(t);
  }, [query, state.filter.query, actions]);

  // Keep the selected card in view when selection comes from the map.
  useEffect(() => {
    if (!state.selectedId) return;
    const el = listRef.current?.querySelector(`[data-opp="${state.selectedId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [state.selectedId]);

  const filtersActive = JSON.stringify({ ...state.filter, sort: null, query: null }) !== JSON.stringify({ ...defaultFilterShape, sort: null, query: null }) || state.savedOnly || !!state.filter.query;

  return (
    <div className="results">
      <div className="results-head">
        <div className="search-field">
          <IconSearch size={17} className="search-icon" />
          <input id="search" className="search-input" type="search" placeholder="Search work, agencies, places" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search opportunities" />
          {query && (
            <button className="icon-btn icon-btn-small" onClick={() => { setQuery(""); actions.setFilter({ query: "" }); }} aria-label="Clear search">
              <IconClose size={14} />
            </button>
          )}
        </div>

        <ProfileStrip onExploreServiceArea={onExploreServiceArea} />
        <FilterBar />

        <div className="results-meta" aria-live="polite">
          <p className="count-line">
            {firstLoad ? "Loading opportunities…" : failed && !state.catalog.meta ? "Results unavailable" : (
              <>
                <strong>{all.length}</strong> {all.length === 1 ? "opportunity" : "opportunities"}
                <span className="count-sub"> {mapped.length} on the map, {unmapped.length} without a pin</span>
              </>
            )}
          </p>
          <label className="sort">
            <span className="visually-hidden">Sort by</span>
            <select id="sort" value={state.filter.sort} onChange={(e) => actions.setFilter({ sort: e.target.value as typeof state.filter.sort })}>
              {state.profile && <option value="recommended">Best fit first</option>}
              <option value="closing_soonest">Closing soonest</option>
              <option value="newly_posted">Newly posted</option>
            </select>
          </label>
        </div>

        <div className="segmented segmented-small" role="tablist" aria-label="Which results to list">
          {(["all", "mapped", "unmapped"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={state.listMode === m} className={state.listMode === m ? "is-on" : ""} onClick={() => dispatch({ type: "listMode", value: m })}>
              {m === "all" ? "All" : m === "mapped" ? `On map (${mapped.length})` : `Not on map (${unmapped.length})`}
            </button>
          ))}
        </div>

        {state.profile && matching.status === "pending" && <div className="progress-line" role="status"><span />Updating matches for profile revision {state.profile.revision}…</div>}
        {state.profile && matching.status === "error" && (
          <div className="inline-alert" role="alert">
            <IconAlert size={16} />
            <span>Matching didn't finish. {matching.error?.message} Results below are unranked.</span>
            <button className="btn-text" onClick={actions.retryMatching}>Retry</button>
          </div>
        )}
      </div>

      <div className={`results-list${loading && !firstLoad ? " is-refreshing" : ""}`} ref={listRef} aria-busy={loading}>
        {firstLoad && <Skeleton />}
        {failed && (
          <div className="state-block" role="alert">
            <IconAlert size={22} />
            <p className="state-title">Couldn't load opportunities</p>
            <p className="state-text">{state.catalog.error?.message} {state.catalog.meta ? "Showing the last results we loaded." : ""}</p>
            <button className="btn btn-gray" onClick={actions.retryCatalog}>Try again</button>
          </div>
        )}
        {!firstLoad && !failed && shown.length === 0 && (
          <div className="state-block">
            <p className="state-title">{state.savedOnly ? "Nothing saved yet" : state.listMode !== "all" ? "Nothing in this group" : "No open work matches these filters"}</p>
            <p className="state-text">
              {state.savedOnly
                ? "Save opportunities from their details to keep a shortlist here."
                : state.filter.viewportBounds
                  ? "Nothing open is pinned inside this part of the map. Remove the map area filter or zoom out and search again."
                  : "Try fewer work types, a wider deadline, or more counties."}
            </p>
            {filtersActive && <button className="btn btn-gray" onClick={() => { setQuery(""); dispatch({ type: "filter/reset" }); }}>Clear all filters</button>}
          </div>
        )}
        {(!failed || state.catalog.meta) && shown.length > 0 && (
          <ul className="card-list">
            {shown.map((o, i) => {
              const showDivider = state.listMode === "all" && i > 0 && hasMapPoint(shown[i - 1]) !== hasMapPoint(o) && state.filter.sort !== "recommended";
              return (
                <li key={o.id}>
                  {showDivider && <p className="list-divider">Not on the map</p>}
                  <OpportunityCard
                    o={o}
                    agency={agencies.get(o.agencyId)}
                    assessment={matching.forRevision === state.profile?.revision ? matching.byId[o.id] : undefined}
                    personalized={personalized}
                    pending={!!state.profile && matching.status === "pending"}
                    failed={!!state.profile && matching.status === "error"}
                    selected={state.selectedId === o.id}
                    hovered={state.hoveredId === o.id}
                    saved={state.saved.includes(o.id)}
                    onSelect={onSelect}
                    onHover={(id) => dispatch({ type: "hover", id })}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {services.integration.catalog === "fixture" && !firstLoad && <p className="list-foot">Sample listings for development. Real solicitations will come from the data team's collected catalog.</p>}
      </div>
    </div>
  );
}

const defaultFilterShape = {
  query: "", workCategories: [], agencyIds: [], agencyTypes: [], countyNames: [], publishedWithinDays: null, deadlineWithinDays: null,
  includeUnknownDates: true, includeStatewide: true, includeUnknownLocations: true, viewportBounds: null, fitTiers: [], sort: null,
};

function ProfileStrip({ onExploreServiceArea }: { onExploreServiceArea?: () => void }) {
  const { state, dispatch } = useExplorer();
  const p = state.profile;
  if (!p)
    return (
      <div className="personalize">
        <div>
          <p className="personalize-title">See which jobs fit your business</p>
          <p className="personalize-text">Describe what you do and where you work. You'll review everything before it's used.</p>
        </div>
        <button className="btn btn-filled" onClick={() => dispatch({ type: "onboarding", value: { mode: "new" } })}>
          <IconSparkle size={16} />
          Find work for my business
        </button>
      </div>
    );
  const area = p.serviceArea.value;
  const services = (p.coreServices.value ?? []).map(categoryLabel);
  return (
    <div className="profile-strip">
      <div className="profile-strip-text">
        <p className="profile-strip-name">{p.businessName.value ?? "Your business"}</p>
        <p className="profile-strip-sub">
          {services.slice(0, 3).join(", ") || "No services set"}
          {services.length > 3 ? ` and ${services.length - 3} more` : ""}
          {" in "}
          {area ? (area.kind === "statewide" ? "all of Washington" : area.counties.length > 2 ? `${area.counties.length} counties` : area.counties.map((c) => `${c} County`).join(" and ")) : "an unset area"}
        </p>
      </div>
      <button className="btn btn-gray btn-small" onClick={() => dispatch({ type: "onboarding", value: { mode: "edit" } })}>
        <IconEdit size={15} />
        Edit profile
      </button>
      {onExploreServiceArea && (
        <button className="sa-entry" onClick={onExploreServiceArea}>
          <IconMap size={16} />
          <span className="sa-entry-label">Explore service area</span>
          <span className="sa-entry-hint">Preview other counties</span>
          <IconChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

const OpportunityCard = memo(function OpportunityCard({ o, agency, assessment, personalized, pending, failed, selected, hovered, saved, onSelect, onHover }: {
  o: Opportunity; agency?: Agency; assessment?: FitAssessment; personalized: boolean; pending: boolean; failed: boolean; selected: boolean; hovered: boolean; saved: boolean;
  onSelect(id: string): void; onHover(id: string | null): void;
}) {
  const dl = deadlineLabel(o.deadline);
  const approx = !o.locations.some((l) => l.displayPoint && !PRECISION_COPY[l.precision].approximate);
  return (
    <button
      type="button"
      data-opp={o.id}
      className={`card${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(o.id)}
      onPointerEnter={() => onHover(o.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(o.id)}
      onBlur={() => onHover(null)}
    >
      <span className="card-top">
        <span className="card-agency">{agency?.name ?? "Agency unknown"}</span>
        {saved && <IconBookmark size={14} filled className="card-saved" />}
      </span>
      <span className="card-title">{o.title}</span>
      <span className="card-loc">
        <span className={`loc-dot${!hasMapPoint(o) ? " is-none" : approx ? " is-approx" : ""}`} aria-hidden="true" />
        {locationLine(o)}
      </span>
      <span className="card-foot">
        <span className={`card-deadline${dl.urgent ? " is-urgent" : ""}`}>{dl.text}</span>
        <span className="card-posted">{postedLabel(o.publication)}</span>
        <FitState assessment={assessment} personalized={personalized} pending={pending} failed={failed} compact />
      </span>
    </button>
  );
});

function Skeleton() {
  return (
    <ul className="card-list" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i}><div className="card skeleton"><span /><span /><span /></div></li>
      ))}
    </ul>
  );
}
