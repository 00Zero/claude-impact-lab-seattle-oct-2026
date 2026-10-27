"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { Agency, Opportunity } from "@/lib/contracts";
import { deadlineLabel } from "@/lib/dates";
import { PRECISION_COPY } from "@/lib/taxonomy";
import { FitBadge } from "@/explorer/components/Fit";
import { IconAlert, IconChevronLeft } from "@/explorer/components/Icons";
import { fitFor, tallyFit } from "./core/assessments";
import type { FitDisplay } from "./core/assessments";
import type { OpportunityChange, ServiceAreaComparison } from "./core/comparison";
import { sortCounties } from "./core/counties";
import type { OpportunityScope, UnknownLocationReason } from "./core/geography";
import { isEmptySelection, profileAreaLabel, selectedCounties, selectionFromProfile } from "./core/serviceArea";
import { CountyPicker } from "./CountyPicker";
import type { ServiceAreaInApp } from "./useServiceAreaInApp";

export interface ServiceAreaExplorerProps {
  sa: ServiceAreaInApp;
  selectedId: string | null;
  hoveredId: string | null;
  /** Discards any preview and returns to the results, restoring the map. */
  onClose(): void;
  /** Opens the shared detail panel for a canonical opportunity ID. */
  onSelectOpportunity(id: string): void;
  onHoverOpportunity(id: string | null): void;
  onStartProfile(): void;
}

const CHIP_LIMIT = 12;

/** Service Area Explorer panel, shown in place of the results list. */
export function ServiceAreaExplorer(props: ServiceAreaExplorerProps) {
  const { sa, onClose } = props;
  const { profile, isExploring, applyState } = sa.state;
  const headingId = useId();
  const saving = applyState.phase === "saving";

  return (
    <section className="sa" aria-labelledby={headingId} aria-busy={saving || undefined}>
      <div className="sa-bar">
        <button className="btn-text btn-back" onClick={onClose} disabled={saving}>
          <IconChevronLeft size={18} />
          Results
        </button>
        <StatusBadge sa={sa} />
      </div>
      <div className="sa-scroll">
        <div className="sa-head">
          <h2 id={headingId} className="sa-title">Explore service area</h2>
          <p className="sa-sub">
            {!profile
              ? "Set up your business profile to choose the counties you serve."
              : isExploring
                ? `Confirmed: ${profileAreaLabel(sa.state.baseline)}`
                : "See which open work your counties reach. Changes stay a preview until you apply them."}
          </p>
          {profile && <Notices sa={sa} />}
          {profile && <Controls sa={sa} />}
        </div>
        {profile ? (
          <div className="sa-body">
            <Summary sa={sa} />
            {isExploring && sa.state.comparison && sa.state.comparison.catalogSize > 0 && <ChangeLists {...props} comparison={sa.state.comparison} />}
            {sa.state.comparison && <Unplaced {...props} comparison={sa.state.comparison} />}
          </div>
        ) : (
          <div className="state-block">
            <button className="btn btn-filled" onClick={props.onStartProfile}>Set up business profile</button>
          </div>
        )}
      </div>
      {profile && <Footer {...props} />}
      <LiveRegion sa={sa} />
    </section>
  );
}

function StatusBadge({ sa }: { sa: ServiceAreaInApp }) {
  const { applyState, isExploring } = sa.state;
  if (applyState.phase === "saving") return <span className="sa-badge">Saving…</span>;
  if (isExploring) return <span className="sa-badge is-preview">Preview · not saved</span>;
  if (applyState.phase === "applied") return <span className="sa-badge is-saved">Saved</span>;
  return null;
}

function Notices({ sa }: { sa: ServiceAreaInApp }) {
  const { baseline, profileChangedDuringDraft } = sa.state;
  if (profileChangedDuringDraft)
    return <p className="sa-notice is-warning" role="status">Your profile changed while you were previewing. Counts now compare against the latest confirmed area.</p>;
  if (baseline.kind === "unsupported")
    return <p className="sa-notice">Your saved area lists {baseline.description.replace(/^Counties the map can't place: /, "")}, which the map can't place. Applying counties here replaces it.</p>;
  if (baseline.kind === "unset") return <p className="sa-notice">No service area is set yet. Add the counties you can work in.</p>;
  return null;
}

function Controls({ sa }: { sa: ServiceAreaInApp }) {
  const { draft, baseline, isExploring, comparison, applyState, onToggleCounty, onSetStatewide, onClear } = sa.state;
  const [expanded, setExpanded] = useState(false);
  const saving = applyState.phase === "saving";
  const selected = new Set(selectedCounties(draft));
  const before = new Set(selectedCounties(selectionFromProfile(baseline)));
  const removed = isExploring ? [...before].filter((c) => !selected.has(c)) : [];
  const names = draft.kind === "statewide" ? [] : sortCounties([...draft.counties, ...removed]);
  const visible = expanded ? names : names.slice(0, CHIP_LIMIT);

  return (
    <div className="sa-controls">
      <div className="segmented segmented-small" role="radiogroup" aria-label="Service area">
        <button role="radio" aria-checked={draft.kind === "counties"} className={draft.kind === "counties" ? "is-on" : ""} disabled={saving} onClick={() => onSetStatewide(false)}>
          Selected counties
        </button>
        <button role="radio" aria-checked={draft.kind === "statewide"} className={draft.kind === "statewide" ? "is-on" : ""} disabled={saving} onClick={() => onSetStatewide(true)}>
          All of Washington
        </button>
      </div>
      <CountyPicker selected={selected} stats={comparison?.countyStats ?? null} disabled={saving} onToggle={onToggleCounty} />
      {draft.kind === "statewide" ? (
        <ul className="sa-chips" aria-label="Selected service area">
          <Chip label="All of Washington" kind={baseline.kind === "statewide" ? "current" : "added"} disabled={saving} action="Remove all of Washington" onAction={() => onSetStatewide(false)} />
        </ul>
      ) : names.length === 0 ? (
        <p className="sa-chips-empty">No counties selected.</p>
      ) : (
        <div className="sa-chips-row">
          <ul className="sa-chips" aria-label="Selected counties">
            {visible.map((name) => {
              const kind = !selected.has(name) ? "removed" : before.has(name) || !isExploring ? "current" : "added";
              return (
                <Chip
                  key={name}
                  label={name}
                  kind={kind}
                  disabled={saving}
                  action={kind === "removed" ? `Restore ${name} County` : `Remove ${name} County`}
                  onAction={() => onToggleCounty(name)}
                />
              );
            })}
            {names.length > CHIP_LIMIT && (
              <li>
                <button className="btn-text" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                  {expanded ? "Show fewer" : `+${names.length - CHIP_LIMIT} more`}
                </button>
              </li>
            )}
          </ul>
          {draft.counties.length > 1 && (
            <button className="btn-text" onClick={onClear} disabled={saving}>Clear all</button>
          )}
        </div>
      )}
      <ul className="sa-legend" aria-label="Map key">
        <li><span className="lg-swatch is-service" aria-hidden="true" />Confirmed</li>
        <li><span className="lg-swatch sa-swatch-added" aria-hidden="true" />Added in preview</li>
        <li><span className="lg-swatch sa-swatch-removed" aria-hidden="true" />Removed in preview</li>
      </ul>
    </div>
  );
}

function Chip({ label, kind, disabled, action, onAction }: { label: string; kind: "current" | "added" | "removed"; disabled: boolean; action: string; onAction(): void }) {
  return (
    <li className={`chip sa-chip is-${kind}`}>
      <span className="sa-chip-label">
        {kind === "added" && <span aria-hidden="true">+ </span>}
        {label}
        {kind !== "current" && <span className="visually-hidden">{kind === "added" ? " (added in preview)" : " (removed in preview)"}</span>}
      </span>
      <button className="sa-chip-action" aria-label={action} title={action} disabled={disabled} onClick={onAction}>
        {kind === "removed" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 8H15a4.5 4.5 0 0 1 0 9H11" /><path d="M8 8l3-3M8 8l3 3" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        )}
      </button>
    </li>
  );
}

function Summary({ sa }: { sa: ServiceAreaInApp }) {
  const { catalog, comparison, isExploring, draft } = sa.state;
  if (catalog.status === "loading")
    return (
      <div className="sa-summary skeleton" role="status" aria-label="Loading opportunities">
        <span /><span /><span />
      </div>
    );
  if (catalog.status === "error" || !comparison)
    return (
      <div className="state-block" role="alert">
        <IconAlert size={22} />
        <p className="state-title">Couldn’t load opportunities to compare</p>
        <p className="state-text">{catalog.status === "error" && catalog.message ? catalog.message : "Counts are unavailable."} This is a loading problem, not an empty result.</p>
        <button className="btn btn-gray" onClick={sa.retryCatalog}>Try again</button>
      </div>
    );
  if (comparison.catalogSize === 0)
    return (
      <div className="state-block">
        <p className="state-title">No open work to compare</p>
        <p className="state-text">Nothing open matches your current filters, so changing counties won’t add anything. Clear filters in the results list to compare the whole catalog.</p>
      </div>
    );

  const { before, after, added, removed, baselineComparable } = comparison;
  return (
    <div className="sa-summary">
      {isExploring ? (
        <>
          <div className="sa-compare">
            <Stat label="Confirmed" value={baselineComparable ? before.included : null} />
            <svg className="sa-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h15m-5-5 5 5-5 5" />
            </svg>
            <Stat label="Preview" value={after.included} strong />
          </div>
          <div className="sa-deltas">
            {!baselineComparable ? (
              <span className="sa-delta">Replaces your current area</span>
            ) : added.length + removed.length === 0 ? (
              <span className="sa-delta">No change in reachable work</span>
            ) : (
              <>
                {added.length > 0 && <span className="sa-delta is-added">+{added.length} newly reachable</span>}
                {removed.length > 0 && <span className="sa-delta is-removed">−{removed.length} no longer reachable</span>}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="sa-stat is-strong">
          <span className="sa-stat-label">Reachable in your service area</span>
          <span className="sa-stat-line">
            <span key={after.included} className="sa-stat-value">{after.included}</span>
            <span className="sa-stat-of">of {comparison.catalogSize} open {comparison.catalogSize === 1 ? "opportunity" : "opportunities"}</span>
          </span>
        </div>
      )}
      <SummaryNotes sa={sa} comparison={comparison} emptyDraft={isEmptySelection(draft)} />
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div className={`sa-stat${strong ? " is-strong" : ""}`}>
      <span className="sa-stat-label">{label}</span>
      {/* Keyed on value so each change replays the entry transition. */}
      <span key={value ?? "none"} className="sa-stat-value">{value ?? "—"}</span>
    </div>
  );
}

function SummaryNotes({ sa, comparison, emptyDraft }: { sa: ServiceAreaInApp; comparison: ServiceAreaComparison<Opportunity>; emptyDraft: boolean }) {
  const { after } = comparison;
  const notes: string[] = [];
  if (emptyDraft) notes.push("Choose at least one county to see reachable work.");
  else if (after.included === 0) notes.push("No open work with a confirmed site in these counties right now.");
  if (after.includedStatewide > 0) notes.push(`Includes ${after.includedStatewide} statewide ${after.includedStatewide === 1 ? "opportunity" : "opportunities"}, which can happen anywhere in Washington.`);
  if (after.outsideWithUnresolvedSites > 0) notes.push(`${after.outsideWithUnresolvedSites} outside these counties also ${after.outsideWithUnresolvedSites === 1 ? "lists a site" : "list sites"} with no confirmed county.`);
  if (comparison.duplicateIdsIgnored > 0) notes.push(`${comparison.duplicateIdsIgnored} repeated ${comparison.duplicateIdsIgnored === 1 ? "record" : "records"} counted once.`);
  if (sa.keptFilters.length) notes.push(`Within your current ${sa.keptFilters.join(", ")} filters.`);
  if (sa.geographyFiltersSetAside) notes.push("County and map-area filters are set aside here so work outside them can show up.");
  if (sa.versionMismatch) notes.push("The catalog was updated while you were comparing. Counts will refresh.");
  if (!notes.length) return null;
  return (
    <ul className="sa-notes">
      {notes.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}

type Tab = "added" | "removed";

function ChangeLists(props: ServiceAreaExplorerProps & { comparison: ServiceAreaComparison<Opportunity> }) {
  const { comparison, sa } = props;
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tabsId = useId();
  const { added, removed } = comparison;
  const tab: Tab = chosen ?? (added.length > 0 || removed.length === 0 ? "added" : "removed");
  const lost = tallyFit(sa.state.fit, removed.map((c) => c.opportunity.id));
  const lostAssessed = [lost.good_fit && `${lost.good_fit} Good fit`, lost.possible_fit && `${lost.possible_fit} Possible fit`].filter(Boolean);
  const addedNote = (
    <p className="sa-list-note">Reachable by location only. Fit for your business is assessed after you apply, so these show no fit label yet.</p>
  );

  // A stored area the map can't place can't be diffed by county; list what the counties include.
  if (!comparison.baselineComparable)
    return (
      <div className="sa-section">
        <p className="sa-list-heading">In the selected counties · {added.length}</p>
        {addedNote}
        <ChangeList changes={added} {...props} />
      </div>
    );

  return (
    <div className="sa-section">
      <div className="segmented segmented-small" role="tablist" aria-label="What changes">
        {(["added", "removed"] as const).map((key) => (
          <button key={key} role="tab" id={`${tabsId}-${key}`} aria-selected={tab === key} aria-controls={`${tabsId}-panel`} className={tab === key ? "is-on" : ""} onClick={() => setChosen(key)}>
            {key === "added" ? `Newly reachable (${added.length})` : `No longer reachable (${removed.length})`}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="sa-tabpanel">
        {tab === "added" ? (
          <>
            {addedNote}
            {added.length ? <ChangeList changes={added} {...props} /> : <p className="sa-list-empty">These counties don’t reach any more open work.</p>}
          </>
        ) : (
          <>
            {lostAssessed.length > 0 && <p className="sa-list-note">Includes {lostAssessed.join(" and ")} for your current profile.</p>}
            {removed.length ? (
              <ChangeList changes={removed} {...props} trailing={(id) => <FitTag fit={fitFor(sa.state.fit, id)} />} />
            ) : (
              <p className="sa-list-empty">Nothing you reach now would drop out.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChangeList(props: ServiceAreaExplorerProps & { changes: readonly OpportunityChange<Opportunity>[]; trailing?: (id: string) => ReactNode }) {
  const { changes, trailing } = props;
  return (
    <ul className="card-list">
      {changes.map((c, i) => (
        <Row key={c.opportunity.id} {...props} o={c.opportunity} location={scopeLine(c.scope, c.viaCounties)} approx={isApprox(c.scope)} index={i} trailing={trailing?.(c.opportunity.id)} />
      ))}
    </ul>
  );
}

function Row(props: ServiceAreaExplorerProps & { o: Opportunity; location: string; approx: boolean | null; index: number; trailing?: ReactNode }) {
  const { o, location, approx, index, trailing, sa, selectedId, hoveredId, onSelectOpportunity, onHoverOpportunity } = props;
  const agency: Agency | undefined = sa.agencies.get(o.agencyId);
  const dl = deadlineLabel(o.deadline);
  return (
    <li className="sa-row" style={{ ["--i" as string]: Math.min(index, 8) }}>
      <button
        type="button"
        data-opp={o.id}
        className={`card${selectedId === o.id ? " is-selected" : ""}${hoveredId === o.id ? " is-hovered" : ""}`}
        aria-pressed={selectedId === o.id}
        onClick={() => onSelectOpportunity(o.id)}
        onPointerEnter={() => onHoverOpportunity(o.id)}
        onPointerLeave={() => onHoverOpportunity(null)}
        onFocus={() => onHoverOpportunity(o.id)}
        onBlur={() => onHoverOpportunity(null)}
      >
        <span className="card-top"><span className="card-agency">{agency?.name ?? "Agency unknown"}</span></span>
        <span className="card-title">{o.title}</span>
        <span className="card-loc">
          <span className={`loc-dot${approx === null ? " is-none" : approx ? " is-approx" : ""}`} aria-hidden="true" />
          {location}
        </span>
        <span className="card-foot">
          <span className={`card-deadline${dl.urgent ? " is-urgent" : ""}`}>{dl.text}</span>
          {trailing}
        </span>
      </button>
    </li>
  );
}

function FitTag({ fit }: { fit: FitDisplay }) {
  if (fit.kind === "assessed") return <FitBadge tier={fit.tier} compact />;
  return <span className="fit-badge is-pending">{fit.kind === "pending" ? "Assessment pending" : fit.kind === "unavailable" ? "Fit unavailable" : "Not assessed"}</span>;
}

function Unplaced(props: ServiceAreaExplorerProps & { comparison: ServiceAreaComparison<Opportunity> }) {
  const { comparison } = props;
  const { unconfirmed, unknown, remote } = comparison;
  if (unconfirmed.length + unknown.length + remote.length === 0) return null;
  const parts = [
    unconfirmed.length && `${unconfirmed.length} location not confirmed`,
    unknown.length && `${unknown.length} location unknown`,
    remote.length && `${remote.length} no physical site`,
  ].filter(Boolean);
  return (
    <details className="sa-unplaced">
      <summary>
        <span>Not tied to a county</span>
        <span className="sa-unplaced-count">{parts.join(" · ")}</span>
      </summary>
      <p className="sa-list-note">Adding or removing counties never adds or removes these. Check each listing for where the work happens.</p>
      {unconfirmed.length > 0 && (
        <>
          <p className="list-divider">Work location not confirmed</p>
          <p className="sa-list-note">The only location on file is the issuing agency’s own address, which isn’t evidence of where the work is.</p>
          <ul className="card-list">
            {unconfirmed.map(({ opportunity, agencyCounties }, i) => (
              <Row key={opportunity.id} {...props} o={opportunity} location={agencyCounties.length ? `Agency in ${countyList(agencyCounties)} · work site not stated` : "Work site not stated"} approx={null} index={i} />
            ))}
          </ul>
        </>
      )}
      {unknown.length > 0 && (
        <>
          <p className="list-divider">Location unknown</p>
          <ul className="card-list">
            {unknown.map(({ opportunity, reason }, i) => (
              <Row key={opportunity.id} {...props} o={opportunity} location={UNKNOWN_COPY[reason]} approx={null} index={i} />
            ))}
          </ul>
        </>
      )}
      {remote.length > 0 && (
        <>
          <p className="list-divider">No physical site</p>
          <ul className="card-list">
            {remote.map((opportunity, i) => (
              <Row key={opportunity.id} {...props} o={opportunity} location={PRECISION_COPY.remote.short} approx={null} index={i} />
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

const UNKNOWN_COPY: Record<UnknownLocationReason, string> = {
  no_location: "Location not stated",
  precision_unknown: "Location not stated",
  county_not_resolved: "City known, county not confirmed",
  not_a_washington_county: "Not matched to a Washington county",
};

const countyList = (names: readonly string[]) => (names.length === 1 ? `${names[0]} County` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} counties`);

function scopeLine(scope: OpportunityScope, via: readonly string[]): string {
  if (scope.kind === "statewide") return "Statewide, anywhere in Washington";
  if (scope.kind !== "counties") return "Location not stated";
  const names = via.length ? via : scope.counties;
  const extra = scope.counties.length - names.length;
  const where = `${countyList(names)}${extra > 0 ? ` +${extra} more` : ""}`;
  return scope.precision === "multiple" ? `${where} · multiple sites` : `${where} · ${PRECISION_COPY[scope.precision].short}`;
}

/** Loc-dot style: solid for named sites, dashed for approximate, hollow for none. */
function isApprox(scope: OpportunityScope): boolean | null {
  if (scope.kind === "statewide") return null;
  if (scope.kind !== "counties") return null;
  return scope.precision === "multiple" || PRECISION_COPY[scope.precision].approximate;
}

function Footer(props: ServiceAreaExplorerProps) {
  const { sa, onClose } = props;
  const { isExploring, draft, applyState, onApply } = sa.state;
  const saving = applyState.phase === "saving";
  const sessionOnly = sa.integration.saving === "session_only";

  if (!isExploring && applyState.phase === "applied") return <Applied {...props} revision={applyState.revision} />;
  if (!isExploring) return <div className="sa-footer"><p className="sa-hint">Add or remove counties to preview what changes. Nothing is saved until you apply.</p></div>;

  const empty = isEmptySelection(draft);
  return (
    <div className="sa-footer">
      {applyState.phase === "save_failed" && (
        <div className="inline-alert" role="alert">
          <IconAlert size={16} />
          <span>{saveErrorCopy(applyState.error)} Your preview is kept.</span>
        </div>
      )}
      <p className="sa-hint">
        {empty ? "Choose at least one county, or all of Washington, to apply." : sessionOnly ? "Preview only. Applying saves it to this development session." : "Preview only. Your profile changes when you apply."}
      </p>
      <div className="sa-actions">
        <button className="btn btn-gray" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-filled" onClick={onApply} disabled={saving || empty}>
          {saving && <span className="sa-spinner" aria-hidden="true" />}
          {saving ? "Saving…" : "Apply to profile"}
        </button>
      </div>
    </div>
  );
}

function saveErrorCopy(error: { code: string; message: string }): string {
  if (error.code === "revision_conflict") return "Your profile changed somewhere else, so this wasn’t saved. Cancel to load the latest, then try again.";
  if (error.code === "unauthenticated") return "Your session ended. Sign in again to save.";
  return `Couldn’t save your service area. ${error.message}`;
}

function Applied(props: ServiceAreaExplorerProps & { revision: number }) {
  const { sa, revision, onClose } = props;
  const sessionOnly = sa.integration.saving === "session_only";
  const saved = sessionOnly ? `Saved for this session as profile revision ${revision}.` : `Saved to your profile as revision ${revision}.`;
  const r = sa.fitRefresh;
  return (
    <div className="sa-footer">
      {!r ? (
        <p className="sa-hint">{saved}</p>
      ) : r.status === "pending" ? (
        <div className="progress-line" role="status"><span />{saved} Updating fit for the new area…</div>
      ) : r.status === "error" ? (
        <div className="inline-alert" role="alert">
          <IconAlert size={16} />
          <span>{saved} Matching didn’t finish, so fit labels are unavailable. {r.message}</span>
          <button className="btn-text" onClick={sa.retryMatching}>Retry</button>
        </div>
      ) : (
        <p className="sa-hint is-done" role="status">
          {saved}{" "}
          {r.mode === "simulated"
            ? "Fit re-checked by simulated development rules, not the real matching service."
            : r.mode === "live"
              ? "Fit recalculated by the matching service."
              : "Fit labels now reflect this revision."}
        </p>
      )}
      <div className="sa-actions is-single">
        <button className="btn btn-gray" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function LiveRegion({ sa }: { sa: ServiceAreaInApp }) {
  const { comparison, isExploring, applyState, profile } = sa.state;
  let text = "";
  if (applyState.phase === "saving") text = "Saving service area.";
  else if (applyState.phase === "save_failed") text = "Service area was not saved.";
  else if (profile && comparison && comparison.catalogSize > 0)
    text = isExploring
      ? `Preview: ${comparison.after.included} reachable, ${comparison.added.length} newly reachable, ${comparison.removed.length} no longer reachable.`
      : `${comparison.after.included} opportunities reachable in your service area.`;
  return <p className="visually-hidden" aria-live="polite">{text}</p>;
}
