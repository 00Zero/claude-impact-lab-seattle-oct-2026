"use client";

import { useEffect, useRef, useState } from "react";
import type { CoverageSummary } from "@/lib/contracts";
import { FIT_TIERS } from "@/lib/taxonomy";
import { formatTimestamp } from "@/lib/dates";
import { devFaults } from "@/lib/services/fixtureServices";
import type { CapabilityMode } from "@/lib/services/types";
import { useExplorer } from "../store";
import type { MapHandle } from "@/map/MapView";
import { IconClose, IconInfo, IconLayers, IconMinus, IconPlus, IconRecenter, IconUser, TierIcon } from "./Icons";

export function MapControls({ map, legendOpen, onLegend }: { map: React.RefObject<MapHandle>; legendOpen: boolean; onLegend(): void }) {
  return (
    <div className="map-controls">
      <div className="control-stack glass">
        <button className="control" onClick={() => map.current?.zoomBy(1.6)} aria-label="Zoom in"><IconPlus size={18} /></button>
        <span className="control-sep" />
        <button className="control" onClick={() => map.current?.zoomBy(1 / 1.6)} aria-label="Zoom out"><IconMinus size={18} /></button>
      </div>
      <button className="control glass control-solo" onClick={() => map.current?.resetToWashington()} aria-label="Reset map to all of Washington" title="Reset to Washington"><IconRecenter size={18} /></button>
      <button className={`control glass control-solo${legendOpen ? " is-on" : ""}`} onClick={onLegend} aria-label="Map legend" aria-expanded={legendOpen} title="Legend"><IconLayers size={18} /></button>
    </div>
  );
}

export function Legend({ personalized, serviceAreaPreview, onClose }: { personalized: boolean; serviceAreaPreview?: boolean; onClose(): void }) {
  return (
    <div className="legend glass-panel" role="region" aria-label="Map legend">
      <div className="legend-head">
        <p className="legend-title">Legend</p>
        <button className="icon-btn icon-btn-small" onClick={onClose} aria-label="Close legend"><IconClose size={14} /></button>
      </div>
      <ul className="legend-list">
        <li><svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="7" className="lg-exact" /></svg>Work site named in the listing</li>
        <li><svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="9.5" className="lg-halo" /><circle r="6.5" className="lg-exact" /></svg>Approximate: city or county center</li>
        <li><svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="10" className="lg-cluster" /><text textAnchor="middle" dy="0.35em" className="lg-cluster-text">3</text></svg>Group of opportunities. Select to zoom in.</li>
        <li><span className="lg-swatch is-service" aria-hidden="true" />Your service area</li>
        {serviceAreaPreview ? (
          <>
            <li><span className="lg-swatch sa-swatch-added" aria-hidden="true" />Added in preview, not saved</li>
            <li><span className="lg-swatch sa-swatch-removed" aria-hidden="true" />Removed in preview, not saved</li>
          </>
        ) : (
          <li><span className="lg-swatch is-filter" aria-hidden="true" />County filter</li>
        )}
      </ul>
      {personalized && (
        <>
          <p className="legend-sub">Fit for your business</p>
          <ul className="legend-list">
            {FIT_TIERS.map((t) => <li key={t.id}><TierIcon tier={t.id} size={18} />{t.label}</li>)}
            <li><svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="7.5" className="lg-unassessed" /></svg>Not assessed yet</li>
          </ul>
        </>
      )}
      <p className="legend-foot">
        {process.env.NEXT_PUBLIC_DATA_MODE === "hybrid"
          ? "Pins show each issuing agency's location; the work site isn't confirmed yet."
          : "Pins show where the work happens, not agency offices."}{" "}
        Statewide and unstated locations are listed under Not on map.
      </p>
    </div>
  );
}

const FAULT_LABEL: Record<keyof typeof devFaults, string> = {
  catalog: "Opportunity service fails",
  interpretation: "Profile reading fails",
  matching: "Matching fails",
  profileSave: "Profile saving fails",
  profileConflict: "Profile saving reports a revision conflict",
};

const MODE_LABEL: Record<CapabilityMode, string> = {
  live: "Connected",
  simulated: "Simulated in the browser",
  fixture: "Development fixtures",
  session_only: "This tab only, not saved",
  unavailable: "Unavailable",
};

export function AccountButton() {
  const { state, actions, dispatch } = useExplorer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("pointerdown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  if (!state.session) return null;
  return (
    <div className="account" ref={ref}>
      <button className="control glass control-solo account-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Account: ${state.session.user.username}`}>
        <IconUser size={17} />
        <span className="account-name">{state.session.user.username}</span>
      </button>
      {open && (
        <div className="menu glass-panel" role="menu">
          <p className="menu-head">{state.session.user.username}</p>
          {state.session.persistence === "session_only" && <p className="menu-note">Development account. Cleared when you reload.</p>}
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); dispatch({ type: "onboarding", value: { mode: state.profile ? "edit" : "new" } }); }}>
            {state.profile ? "Edit business profile" : "Set up business profile"}
          </button>
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); dispatch({ type: "savedOnly", value: true }); }}>Saved opportunities ({state.saved.length})</button>
          <button role="menuitem" className="menu-item" onClick={() => { setOpen(false); dispatch({ type: "sheet", value: "coverage" }); }}>Data and coverage</button>
          <button role="menuitem" className="menu-item is-destructive" onClick={() => { setOpen(false); actions.signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export function DataBanner() {
  const { state, services, dispatch } = useExplorer();
  const meta = state.catalog.meta;
  if (services.integration.catalog !== "fixture" && !meta?.isStale) return null;
  return (
    <button className={`data-banner${meta?.isStale ? " is-stale" : ""}`} onClick={() => dispatch({ type: "sheet", value: "coverage" })}>
      <IconInfo size={15} />
      {services.integration.catalog === "fixture" ? "Sample data for development, not real open work" : `Showing a saved snapshot from ${meta?.sourceSnapshotAt ? formatTimestamp(meta.sourceSnapshotAt) : "an earlier check"}`}
    </button>
  );
}

export function CoverageSheet() {
  const { state, services, dispatch, actions } = useExplorer();
  const [cov, setCov] = useState<CoverageSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    services.catalog.getCoverage().then(setCov, (e) => setErr(e.message ?? "Coverage is unavailable."));
  }, [services]);
  const close = () => dispatch({ type: "sheet", value: null });
  const n = (v: number | null | undefined) => (v == null ? "Unknown" : String(v));
  const i = services.integration;
  const fixtures = i.catalog === "fixture";
  return (
    <div className="modal-scrim" onPointerDown={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="modal is-narrow" role="dialog" aria-modal="true" aria-labelledby="cov-title">
        <div className="modal-bar"><span /><button className="icon-btn" onClick={close} aria-label="Close" autoFocus><IconClose size={18} /></button></div>
        <div className="modal-head"><h2 className="modal-title" id="cov-title">Data and coverage</h2></div>
        <div className="modal-body">
          {err && <p className="form-error">{err}</p>}
          {cov && (
            <dl className="facts is-grid">
              <div className="fact"><dt>Agencies in the target inventory</dt><dd>{n(cov.agenciesInInventory)}</dd></div>
              <div className="fact"><dt>Agencies checked</dt><dd>{n(cov.agenciesChecked)}</dd></div>
              <div className="fact"><dt>Agencies with verified open work</dt><dd>{n(cov.agenciesWithOpenWork)}</dd></div>
              <div className="fact"><dt>Real open opportunities</dt><dd>{n(cov.uniqueOpenOpportunities)}</dd></div>
              <div className="fact"><dt>Last successful source check</dt><dd>{cov.lastSuccessfulCheckAt ? formatTimestamp(cov.lastSuccessfulCheckAt) : "No source checked yet"}</dd></div>
              <div className="fact"><dt>Locations in this catalog</dt><dd>{cov.locationBreakdown.located} pinned, {cov.locationBreakdown.approximate} approximate, {cov.locationBreakdown.statewide} statewide or no site, {cov.locationBreakdown.unknown} unknown</dd></div>
            </dl>
          )}
          {cov?.limitations.map((l, k) => <p key={k} className="meta-note">{l}</p>)}

          <h3 className="section-title">What's connected</h3>
          <dl className="facts">
            <div className="fact"><dt>Opportunities</dt><dd>{MODE_LABEL[i.catalog]}</dd></div>
            <div className="fact"><dt>Profile reading</dt><dd>{MODE_LABEL[i.interpretation]}</dd></div>
            <div className="fact"><dt>Matching</dt><dd>{MODE_LABEL[i.matching]}{state.matching.meta ? `, ranking version ${state.matching.meta.rankingVersion}` : ""}</dd></div>
            <div className="fact"><dt>Accounts</dt><dd>{MODE_LABEL[i.auth]}</dd></div>
            <div className="fact"><dt>Saved items and profile</dt><dd>{MODE_LABEL[i.saving]}</dd></div>
            <div className="fact"><dt>Map</dt><dd>Built-in terrain and county map, no external tiles</dd></div>
          </dl>

          {fixtures && (
            <>
              <h3 className="section-title">Test failure states</h3>
              <p className="meta-note">Development only. These switches make the simulated services fail so error and retry states can be checked.</p>
              {(["catalog", "interpretation", "matching", "profileSave", "profileConflict"] as const).map((k) => (
                <label key={k} className="check-row" htmlFor={`fault-${k}`}>
                  <input id={`fault-${k}`} type="checkbox" checked={devFaults[k]} onChange={(e) => { devFaults[k] = e.target.checked; force((x) => x + 1); if (k === "catalog") actions.retryCatalog(); if (k === "matching") actions.retryMatching(); }} />
                  <span className="check-label">{FAULT_LABEL[k]}</span>
                </label>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const { state, dispatch } = useExplorer();
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "toast", text: null }), 3200);
    return () => clearTimeout(t);
  }, [state.toast, dispatch]);
  return (
    <div className="toast-region" aria-live="polite">
      {state.toast && <div key={state.toast.id} className={`toast glass-panel${state.toast.tone === "error" ? " is-error" : ""}`}>{state.toast.text}</div>}
    </div>
  );
}
