"use client";

import { useEffect, useRef, useState } from "react";
import type { Agency, DateValue, Opportunity } from "@/lib/contracts";
import { AGENCY_TYPE_LABEL, categoryLabel, PRECISION_COPY } from "@/lib/taxonomy";
import { deadlineLabel, formatDateValue, formatTimestamp } from "@/lib/dates";
import { useExplorer } from "../store";
import { FitExplanation, FitState } from "./Fit";
import { BookCallButton, BookCallCard } from "./BookCall";
import { BOOKABLE_TIERS } from "@/lib/booking";
import { fitLabel } from "@/lib/taxonomy";
import {
  IconBookmark, IconBuilding, IconCalendar, IconChevronLeft, IconClose, IconCopy, IconDoc, IconExternal, IconGlobe, IconMail, IconPhone, IconPin, IconAlert, IconCheck,
} from "./Icons";

export function DetailPanel({ onClose, showBack, previewReachable }: {
  onClose(): void;
  showBack?: boolean;
  /** Reachable only in an unsaved service area preview: the confirmed revision's fit doesn't apply. */
  previewReachable?: boolean;
}) {
  const { state, actions, services, dispatch } = useExplorer();
  const id = state.selectedId!;
  const listItem = state.catalog.data.find((o) => o.id === id) ?? null;
  const o: Opportunity | null = state.detail.opportunity ?? listItem;
  const agency: Agency | null = state.detail.agency ?? state.catalog.agencies.find((a) => a.id === o?.agencyId) ?? null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLElement>(null);
  const bookRef = useRef<HTMLElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  if (!o) {
    return (
      <div className="detail">
        <div className="detail-bar">
          <button className="icon-btn" onClick={onClose} aria-label="Close details"><IconClose size={18} /></button>
        </div>
        <div className="state-block" role="alert">
          {state.detail.status === "error" ? (
            <>
              <p className="state-title">Couldn't open this opportunity</p>
              <p className="state-text">{state.detail.error?.message}</p>
            </>
          ) : <p className="state-text">Loading…</p>}
        </div>
      </div>
    );
  }

  // A preview-only reachable job keeps no label from the confirmed area (often Not a fit for being outside it).
  const assessment = !previewReachable && state.profile && state.matching.forRevision === state.profile.revision ? state.matching.byId[o.id] : undefined;
  const saved = state.saved.includes(o.id);
  const dl = deadlineLabel(o.deadline);
  const originalUrl = o.sourceReferences.find((r) => r.url)?.url ?? null;
  const simulatedFit = services.integration.matching === "simulated";
  const canBook = !!assessment?.tier && BOOKABLE_TIERS.includes(assessment.tier);

  return (
    <div className="detail" aria-labelledby="detail-title">
      <div className="detail-bar">
        {showBack ? (
          <button className="btn-text btn-back" onClick={onClose}><IconChevronLeft size={18} />Results</button>
        ) : <span />}
        <button className="icon-btn" onClick={onClose} aria-label="Close details"><IconClose size={18} /></button>
      </div>

      <div className="detail-scroll" ref={scrollRef}>
        <header className="detail-head">
          {o.isDevelopmentFixture && <p className="sample-tag">Sample listing for development. Not a real solicitation.</p>}
          <p className="detail-type">
            {[o.solicitationType.sourceLabel ?? "Solicitation type not stated", o.sourceReferences[0]?.sourceNativeId].filter(Boolean).join(", ")}
          </p>
          <h2 className="detail-title" id="detail-title" tabIndex={-1} ref={headingRef}>{o.title}</h2>
          <p className="detail-agency">{agency?.name ?? "Issuing agency unknown"}</p>
          <div className="detail-status">
            <span className={`status-pill is-${o.status}`}>{o.status === "open" ? "Open" : o.status[0].toUpperCase() + o.status.slice(1)}</span>
            <span className={`detail-deadline${dl.urgent ? " is-urgent" : ""}`}>{dl.text}</span>
            {previewReachable ? (
              <span className="fit-badge is-pending">Not assessed for this preview</span>
            ) : (
              <FitState assessment={assessment} personalized={!!assessment} pending={!!state.profile && state.matching.status === "pending"} failed={!!state.profile && state.matching.status === "error"} />
            )}
          </div>
          <div className="detail-actions">
            {canBook && <BookCallButton onClick={() => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />}
            {originalUrl ? (
              <a className={`btn ${canBook ? "btn-gray" : "btn-filled"}`} href={originalUrl} target="_blank" rel="noopener noreferrer"><IconExternal size={16} />View original posting</a>
            ) : (
              <button className={`btn ${canBook ? "btn-gray" : "btn-filled"}`} disabled title="No source link for this record"><IconExternal size={16} />View original posting</button>
            )}
            <button className={`btn btn-gray${saved ? " is-on" : ""}`} onClick={() => actions.toggleSaved(o.id)} aria-pressed={saved}>
              <IconBookmark size={16} filled={saved} />{saved ? "Saved" : "Save"}
            </button>
            <button className="btn btn-gray" onClick={() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <IconPhone size={16} />Contact agency
            </button>
          </div>
          {!originalUrl && <p className="detail-note">{o.isDevelopmentFixture ? "Sample listings have no original posting to open." : "The source link for this listing isn't available."}</p>}
        </header>

        {previewReachable ? (
          <section className="detail-section personalize-inline">
            <p>Your service area preview reaches this work. Fit so far was judged for your confirmed area (profile revision {state.profile?.revision}), which doesn’t include it. Apply the preview to have it assessed for the new area.</p>
          </section>
        ) : assessment?.tier ? (
          <>
            <FitExplanation a={assessment} simulated={simulatedFit} />
            {canBook && <BookCallCard ref={bookRef} o={o} tierLabel={fitLabel(assessment.tier)} />}
          </>
        ) : !state.profile ? (
          <section className="detail-section personalize-inline">
            <p>Add your business profile to see whether this job fits your services, area, and qualifications.</p>
            <button className="btn btn-gray btn-small" onClick={() => dispatch({ type: "onboarding", value: { mode: "new" } })}>Personalize</button>
          </section>
        ) : null}

        <Section title="Scope">
          {o.summary ? (
            <>
              <p className="prose">{o.summary}</p>
              {o.summaryIsGenerated && <p className="meta-note">Summary generated from the listing text. Check the original posting for the full scope.</p>}
            </>
          ) : (
            <p className="prose is-unknown">The listing doesn't describe the scope. It may be in the solicitation documents.</p>
          )}
          {o.workCategories.length > 0 && (
            <div className="tag-row">
              {o.workCategories.map((c) => <span key={c.id} className="tag">{categoryLabel(c.id)}</span>)}
            </div>
          )}
        </Section>

        <Section title="Where the work happens" icon={<IconPin size={16} />}>
          <ul className="loc-list">
            {o.locations.map((l) => {
              const p = PRECISION_COPY[l.precision];
              return (
                <li key={l.id} className="loc-item">
                  <div className="loc-head">
                    <span className="loc-label">{l.label}</span>
                    <span className={`precision-pill${p.approximate ? " is-approx" : ""}`}>{p.short}</span>
                  </div>
                  <p className="meta-note">{p.long}</p>
                  {l.rawLocationText && l.rawLocationText !== l.label && <p className="quote">Listing says: “{l.rawLocationText}”</p>}
                </li>
              );
            })}
          </ul>
          {o.locations.length > 1 && <p className="meta-note">One opportunity with {o.locations.length} sites. It counts once in totals.</p>}
        </Section>

        <Section title="Dates" icon={<IconCalendar size={16} />}>
          <dl className="facts">
            <Fact label="Bid deadline" value={o.deadline} empty="Not published" showTimeNote />
            <Fact label="Published by agency" value={o.publication} empty="Not stated on the listing" />
            <Fact label="Last amended" value={o.amendment} empty="No amendment found" />
            <div className="fact"><dt>First found by us</dt><dd>{o.firstSeenAt ? formatTimestamp(o.firstSeenAt) : "Unknown"}</dd></div>
            <div className="fact"><dt>Last verified open</dt><dd>{o.lastVerifiedAt ? formatTimestamp(o.lastVerifiedAt) : "Unknown"}</dd></div>
          </dl>
        </Section>

        <Section title="Published requirements" icon={<IconDoc size={16} />}>
          {o.requirements.length ? (
            <ul className="req-list">
              {o.requirements.map((r) => (
                <li key={r.id} className="req">
                  <span className={`req-flag ${r.mandatory === true ? "is-mandatory" : r.mandatory === false ? "is-optional" : "is-unclear"}`}>
                    {r.mandatory === true ? "Required" : r.mandatory === false ? "Optional" : "Unclear"}
                  </span>
                  <span>{r.text}{r.extractionStatus === "needs_review" && <em className="meta-inline"> Extraction needs review.</em>}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="prose is-unknown">No requirements were extracted. That doesn't mean there aren't any.</p>
          )}
          {o.requirementsCompleteness !== "complete" && o.requirements.length > 0 && <p className="meta-note">This list may be incomplete. The solicitation documents are the authority.</p>}
        </Section>

        {o.publishedValue && (
          <Section title="Published value">
            <p className="prose">{o.publishedValue.rawText}</p>
            <p className="meta-note">As published by the agency. We never estimate contract values.</p>
          </Section>
        )}

        <Section title="Documents and source" icon={<IconExternal size={16} />}>
          <ul className="doc-list">
            {o.documentLinks.map((d, i) => (
              <li key={i}>
                {d.url && d.access === "public" ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="doc-link"><IconDoc size={16} />{d.label}</a>
                ) : (
                  <span className="doc-link is-disabled"><IconDoc size={16} />{d.label}<span className="meta-inline">{d.access === "login_required" ? " Requires a portal login" : " Link not available"}</span></span>
                )}
              </li>
            ))}
          </ul>
          <p className="meta-note">
            {o.isDevelopmentFixture ? "Source: development fixture, no real source." : `Collected ${o.extractedAt ? formatTimestamp(o.extractedAt) : "at an unknown time"}.`}
            {o.completeness.length > 0 && ` ${o.completeness.join(". ")}.`}
          </p>
        </Section>

        <section className="detail-section contact" ref={contactRef} aria-labelledby="contact-title">
          <h3 className="section-title" id="contact-title"><IconBuilding size={16} />Contact agency</h3>
          <p className="prose">Reach out to the agency directly about this opportunity.</p>
          <div className="contact-card">
            <p className="contact-name">{agency?.name ?? "Agency unknown"}</p>
            {agency && <p className="meta-note">{agency.jurisdiction?.includes(AGENCY_TYPE_LABEL[agency.agencyType]) ? agency.jurisdiction : `${AGENCY_TYPE_LABEL[agency.agencyType]}${agency.jurisdiction ? `, ${agency.jurisdiction}` : ""}`}</p>}
            <ContactRow icon={<IconGlobe size={16} />} label="Website" value={agency?.websiteUrl ?? null} href={agency?.websiteUrl ?? undefined} />
            <ContactRow icon={<IconMail size={16} />} label="Email" value={agency?.email ?? null} href={agency?.email ? `mailto:${agency.email}` : undefined} />
            <ContactRow icon={<IconPhone size={16} />} label="Phone" value={agency?.phone ?? null} href={agency?.phone ? `tel:${agency.phone.replace(/[^\d+]/g, "")}` : undefined} />
          </div>
          {o.publicContact && (
            <div className="contact-card">
              <p className="contact-name">{o.publicContact.name ?? "Solicitation contact"}</p>
              {o.publicContact.role && <p className="meta-note">Listed on the solicitation as {o.publicContact.role}</p>}
              <ContactRow icon={<IconMail size={16} />} label="Email" value={o.publicContact.email} href={o.publicContact.email ? `mailto:${o.publicContact.email}` : undefined} />
              <ContactRow icon={<IconPhone size={16} />} label="Phone" value={o.publicContact.phone} href={o.publicContact.phone ? `tel:${o.publicContact.phone.replace(/[^\d+]/g, "")}` : undefined} />
            </div>
          )}
          <p className="meta-note">
            Nothing is sent to the agency for you. Listing contact details here doesn't mean the agency endorses any vendor.
            {o.isDevelopmentFixture && " Sample records use placeholder email addresses and 555 phone numbers."}
          </p>
        </section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h3 className="section-title">{icon}{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value, empty, showTimeNote }: { label: string; value: DateValue | null; empty: string; showTimeNote?: boolean }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={value ? "" : "is-unknown"}>{value ? formatDateValue(value, { timeNote: showTimeNote }) : empty}</dd>
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string | null; href?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value)
    return (
      <div className="contact-row">
        {icon}
        <span className="contact-label">{label}</span>
        <span className="contact-value is-unknown">Not available</span>
      </div>
    );
  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      const r = document.createRange();
      const el = document.getElementById(`cv-${label}-${value}`);
      if (el) { r.selectNodeContents(el); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); }
    }
  }
  return (
    <div className="contact-row">
      {icon}
      <span className="contact-label">{label}</span>
      <a className="contact-value" id={`cv-${label}-${value}`} href={href} target={label === "Website" ? "_blank" : undefined} rel="noopener noreferrer">{value}</a>
      <button className="icon-btn icon-btn-small" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
      </button>
    </div>
  );
}
