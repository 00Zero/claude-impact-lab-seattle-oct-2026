# Washington Contract Explorer
## Software Requirements Specification and Parallel Build Handoff

**Version:** 1.1  
**Date:** October 25, 2026 (v1.1 amendments the same day; see Section 23)  
**Product owner:** Ashwin Subramanian  
**Business stakeholder:** Jon  
**Delivery window:** Four-hour hackathon build; schedule below is relative to implementation kickoff.  
**Status:** Implementation baseline. Confirmed requirements are separated from proposed defaults and pending external inputs.  
**Working name:** Washington Contract Explorer. Naming is provisional; no branding from Jon has been supplied.

## 0. Instructions for teammates and coding agents

Read Sections 1-5, 12-15, and your workstream in Section 6 before implementing. Use the requirement identifiers when reporting progress. This document is both a product specification and a coordination contract between three engineering owners.

Begin useful work immediately. Pending inputs are not reasons to stop unrelated implementation. Build against the agreed schemas and isolated development fixtures while real-source ingestion proceeds.

Teammates and Claude agents may extend this document with source discoveries, implementation decisions, endpoint examples, and additional acceptance cases. Preserve confirmed product requirements. Identify proposed changes explicitly, update the change log, and notify owners affected by shared contracts. An implementation assumption must not be recorded as a user-approved decision.

Do not build a general-purpose procurement CRM, bidding agent, pricing engine, or government contact enrichment system. The deliverable is an opportunity visualization and recommendation experience that connects interested vendors with the agencies issuing the work.

## 1. Product definition

### 1.1 Problem

Washington vendors must navigate fragmented government procurement websites to discover relevant work. Opportunity descriptions are inconsistent, locations are often buried in documents, and vendors may not understand industry codes or procurement terminology. A vendor needs to answer three practical questions quickly:

1. What open work is available near the areas I serve?
2. Which opportunities fit what my business can actually do?
3. Who at the agency do I contact about the work?

### 1.2 Product outcome

Build a visually strong, map-first website that aggregates real open government opportunities from a declared set of Washington agencies, helps vendors describe their capabilities, and produces explained fit recommendations. Each opportunity ends in a clear handoff: the issuing agency's name, website, email, and phone, so the vendor can contact the agency directly. All use requires a signed-in account.

### 1.3 Core journey

Create an account (username and password) -> explore Washington opportunities -> describe the business -> review and correct an AI-assisted profile -> see personalized matches on the same map and list -> inspect fit reasons and requirements -> save opportunities -> contact the agency using its name, website, email, and phone.

### 1.4 Primary user

A business owner or operator capable of performing government-contracted work. The initial demonstration emphasizes groundwork and related public works: paving, pothole repair, excavation, grading, drainage, landscaping, site preparation, and concrete work.

The product should accept broader vendor capabilities without requiring the entire catalog or onboarding experience to be specialized for every industry today.

### 1.5 Business purpose

The website is built for Jon's consulting business. In this build the in-product handoff is the agency's own contact information; there is no Calendly booking or automatic lead routing to Jon. Jon provides additional relationships, judgment, proprietary information, and pricing expertise outside the product. These assets are not inputs to AI, matching, onboarding, or public display.

### 1.6 Success statement

A judge can enter a realistic vendor profile, watch relevant opportunities and map results change, understand why a project fits or does not fit, verify its government source, and see the issuing agency's name, website, email, and phone with working links. The demonstration must be grounded in real listings rather than fabricated map activity.

## 2. Decision register

### 2.1 Confirmed requirements

| ID | Decision |
| --- | --- |
| D-01 | Deliver a hackathon demonstration within a four-hour implementation window. |
| D-02 | Use three workstreams, one person each: Frontend (A), Embeddings & matching (B), and Data collection & storage (C). *(Amended v1.1.)* |
| D-03 | Ashwin owns the main frontend and visualization experience. |
| D-04 | Washington is the geographic focus. An agency spreadsheet will define the target universe once supplied. |
| D-05 | Groundwork and related public works are the main demonstration focus. |
| D-06 | The map should be visually strong, zoomable, and show where work occurs, what agencies want, and recency where supported. |
| D-07 | Use a dark terrain-oriented visual direction with restrained bright markers, smooth navigation, clusters, and county context. |
| D-08 | Onboarding combines a natural-language business description with editable structured fields and targeted follow-ups. |
| D-09 | Do not ask vendors for pricing information. |
| D-10 | An account is required for all use: browsing, onboarding, personalized recommendations, and saving. *(Amended v1.1; previously anonymous use was allowed.)* |
| D-11 | Fit labels are Good fit, Possible fit, Not a fit, and Needs review. |
| D-12 | Detail views include scope, agency, work location, dates, published requirements, source documents, and fit reasons. |
| D-13 | Recommendations assess vendor suitability, not probability of winning. |
| D-14 | Use real sourced opportunities. No fabricated live opportunities. |
| D-15 | Jon's proprietary relationships, information, and pricing stay outside AI. The handoff is the agency's contact information; no Calendly. *(Amended v1.1.)* |
| D-16 | Use React/Next.js. Data owners may choose backend, vector database, and ingestion implementation details consistent with shared contracts. |
| D-17 | Claude API credits are available. Other service credentials and provisioning are not yet confirmed. |
| D-18 | Washington only. Oregon, Idaho, and federal (SAM.gov) sources are out of scope. *(Added v1.1.)* |
| D-19 | Collect opportunities ahead of time into stored snapshots. No scraping or open-web search when a user opens the page or requests matches. *(Added v1.1.)* |
| D-20 | The user record stores username, password (only as a salted hash), a text summary of the confirmed profile, and its vector embedding. *(Added v1.1.)* |
| D-21 | The handoff shows the issuing agency's name, website, email, and phone. *(Added v1.1.)* |

### 2.2 Proposed implementation defaults

These defaults make the specification executable without further product discussion. They were proposed during planning but not individually approved. They may be refined without changing the confirmed purpose.

| ID | Default | Reason |
| --- | --- | --- |
| A-01 | Target approximately 10 agencies and 30-50 unique, verified open opportunities. | Gives a concrete discovery target without pretending coverage is guaranteed. |
| A-02 | Collect broader categories when easy; default the demo to groundwork/public works. | Preserves breadth while making the primary journey coherent. |
| A-03 | *Removed in v1.1: the Calendly handoff is replaced by agency contact info (D-21).* | — |
| A-04 | Natural-language map search is an enhancement after deterministic filters and matching work. | Strong demonstration value without making baseline navigation depend on AI. |
| A-05 | Compare up to three opportunities only after the core journey is complete. | Useful, but not required for the initial product loop. |
| A-06 | Show agency name, website, email, and phone only when supplied by the agency spreadsheet or another verified public source. | Delivers the D-21 handoff without contact enrichment. |
| A-07 | Desktop is the main judging surface; narrow-screen access remains usable. | The visual map experience is central. |
| A-08 | Use cached real-source snapshots during the demo if live source refresh is unavailable. | Reduces network dependence while preserving provenance. |

### 2.3 Pending external inputs

| Input | Owner | Effect if missing |
| --- | --- | --- |
| Agency spreadsheet | Ashwin | Source targeting remains provisional; implement import and start from verified public sources. |
| Embedding provider credentials | B | Embeddings cannot be generated; matching falls back to structured signals with a visible degraded state. |
| Existing repository and deployment target | Team | Choose once at kickoff; do not create incompatible parallel applications. |
| Map provider credentials, if needed | Experience owner | Use an approved alternative; do not assume a free hosted tile service permits arbitrary use. |
| Auth/storage configuration | C | Accounts are required for all use (D-10), so the product is unusable until sign-up and login work. Configure first. |
| Final name and brand | Product owner | Keep the neutral working name and consistent provisional identity. |

## 3. Scope and priorities

### 3.1 Priority definitions

- **P0:** Required for the intended end-to-end product demonstration.
- **P1:** Implement after the connected P0 journey works; does not block core exploration and recommendation acceptance.
- **P2:** Explicitly deferred beyond this hackathon.

The full P0 set is the target. If a P0 dependency cannot be completed, report the exact gap. Do not silently redefine it as complete or substitute simulated behavior.

### 3.2 P0 scope

- Source inventory and agency spreadsheet import path.
- Real opportunity ingestion from accessible sources, collected ahead of time (D-19); provenance and collection timestamps.
- Normalized opportunity records and duplicate handling.
- Work-location extraction with clear precision and uncertainty.
- Zoomable Washington map, clustering, synchronized result list, selection, and location disclosure.
- Deterministic filters for location, work category, agency, recency, and deadline where data exists.
- Opportunity detail panel with original source and available documents.
- Hybrid vendor onboarding and editable profile review.
- Personalized ranking using semantic capability matching plus structured factors.
- Evidence-based fit labels and explanations, including missing-information treatment.
- Required accounts (username/password) with durable profile, text summary, embedding, and saved opportunities.
- Agency contact handoff: the issuing agency's name, website, email, and phone on every opportunity detail.
- Real-data snapshot fallback, clear empty/error states, deployment, and integrated demonstration.

### 3.3 P1 scope

- Natural-language search that converts supported phrases into visible filters.
- Comparison of up to three opportunities.
- Capability statement upload and extraction.
- Free-text follow-up conversation beyond essential profile clarification.
- Map heatmap or density view and a compact timeline visualization.
- Reusable shareable opportunity URLs and accessible standalone detail routes.
- Simple aggregate funnel event counts without a CRM or personal-data dashboard.

### 3.4 P2 / out of scope

- Automatic bid preparation, bid submission, or government outreach.
- Pricing recommendations, competitor bid inference, or proprietary intelligence ingestion.
- Win probabilities or claims of award certainty.
- Exhaustive statewide coverage claims without evidence.
- Private roster invitations, inaccessible portals, or authentication bypass.
- Nationwide expansion, procurement CRM, payments, subscriptions, multi-user organizations.
- Historical award analytics, incumbent research, and contract value forecasting.
- Automated certification or license verification against every registry.
- Automated recurring alerts, email campaigns, or sending user data to Jon.
- Calendly or any booking handoff to Jon; anonymous (no-account) use.
- Oregon, Idaho, and federal (SAM.gov) sources; live runtime scraping or open-web search.

## 4. Coverage model and terminology

### 4.1 Opportunity versus contract

Use **opportunity** for an open solicitation that a vendor might pursue. An awarded contract is not an open opportunity merely because its performance period is active. Preserve source-native type labels such as ITB, RFP, RFQ, or invitation to bid.

Exclude awarded, canceled, and closed items from the default open catalog. Do not mislabel forecasts, sources-sought notices, or vendor roster registrations as jobs accepting bids. Such records may be retained separately with explicit types and statuses if useful.

### 4.2 Agency universe

The agency spreadsheet, when received, is the target inventory. It is not evidence that every agency has open work or that every linked system is accessible. Classify agencies by their real procurement systems, including shared portal tenants.

State, municipal, county, port, school, transit, university, utility, or tribal entries are included only when present in the inventory or deliberately added and recorded. Federal sources are out of scope (D-18). Until inventory review, do not imply that all these classes are covered.

### 4.3 Coverage counts

Display separately:

- Agencies in the target inventory.
- Agencies successfully checked.
- Agencies with verified open opportunities.
- Unique open opportunities collected.
- Opportunities whose work location is known, approximate, statewide, or unknown.
- Time of the last successful source check.

An agency with no current opportunities can count as checked, but not as an agency with open work. A failed refresh does not mean zero opportunities. Inventory counts and filtered result counts must not be conflated.

The 10-agency / 30-50-opportunity target is a planning goal, not a reason to manufacture records or count expired listings. If fewer qualifying records exist or are accessible, show the actual number and document the shortfall.

### 4.4 Location meaning

The primary map represents **place of performance**: where the contracted work is expected to happen. Agency headquarters is a separate fact. Never substitute headquarters as a work location without labeling the substitution explicitly in a separate agency view.

Valid work-location cases include an exact site, approximate address or road segment, city, county, multiple sites, statewide scope, remote work, and unknown location. A county centroid is a display anchor for a county-level opportunity, not evidence of an exact job site.

## 5. User journeys

### J-01: Sign up and explore

1. Visitor opens the website and creates an account with a username and password, or signs in.
2. A Washington overview and synchronized list show real available opportunities.
3. Visitor zooms or selects a county and applies work-type or recency filters.
4. Visible counts and markers reflect the same logical results.
5. Selecting a marker or card opens the same detail panel and highlights the selection.
6. Visitor can open the original listing without completing onboarding.

### J-02: Personalized discovery

1. Signed-in user selects Find work for my business.
2. They describe services in their own words and provide their business base and service area.
3. AI proposes a structured profile and asks a small number of useful questions.
4. User reviews and corrects the profile before it becomes active. On confirmation, the system stores a text summary of the profile and its vector embedding on the user record.
5. The existing map and list change to personalized results.
6. The vendor sees a fit label, specific reasons, and requirement gaps on each assessed opportunity.
7. Changing a service area or capability changes the results without restarting onboarding.

### J-03: Contact the agency

1. Vendor views an opportunity or their personalized shortlist.
2. A Contact agency section shows the issuing agency's name, website, email, and phone, plus the solicitation contact when the listing publishes one.
3. Website, email (`mailto:`), and phone (`tel:`) are working links; missing values show Not available.
4. The product does not claim that contact was made or that the agency endorses the vendor.
5. Nothing is sent automatically to the agency or to Jon.

### J-04: Save and return

1. Signed-in vendor selects Save opportunity.
2. The confirmed profile, its text summary and embedding, and explicit saves persist to their account.
3. Signing in again restores saved data and recomputes recommendations when the profile or catalog has changed.

## 6. Three workstreams and ownership

### 6.1 Workstream A: Frontend

**Owner:** Ashwin (one person).  
**Goal:** A polished, comprehensible map-first experience that makes the real data and recommendation behavior visible.

**Owns**

- Next.js application shell, visual system, responsive layout, and primary routes.
- Map rendering, clusters, county context, camera transitions, selection, and synchronized list.
- Filter controls and their representation in the URL or client state.
- Hybrid onboarding screens, profile review, correction controls, and loading states.
- Opportunity cards, detail panel, fit explanations, source links, and saved-state UI.
- Sign-up, login, and sign-out screens; agency contact panel (name, website, email, phone).
- User-facing empty, partial-data, unavailable, and error states.
- Visual QA and the judge-facing demonstration script.

**Does not independently redefine** source status, work coordinates, fit tiers, eligibility rules, API schemas, or coverage totals.

**Deliverables**

1. Connected map/list/detail experience.
2. Complete onboarding/profile-editing flow.
3. Personalized result presentation with unknown-data handling.
4. Sign-up/login, save, and agency contact UI wired to actual behavior.
5. Responsive and keyboard-usable main journey.

**Can start immediately with** contract-valid fixtures clearly confined to development, an opportunity API adapter, and matching response examples.

### 6.2 Workstream B: Embeddings and matching

**Owner:** Engineer 2 (one person).  
**Goal:** Convert vendor descriptions into confirmed capability profiles, text summaries, and embeddings, and produce defensible, explained suitability rankings.

**Owns**

- Profile field definitions in collaboration with A and C.
- Claude prompts for structured capability extraction and targeted follow-ups.
- Industry/work-category suggestions and code mapping where evidence supports them.
- Embedding model choice; profile text-summary generation; vendor and opportunity embeddings; retrieval and matching implementation.
- Structured factors, known-mismatch rules, missing-information treatment, tiers, and explanations.
- Profile revision identifiers, ranking version, and consistency of cached assessments.
- Evaluation cases showing meaningful differences between vendors.

**Does not own** source crawling, canonical opportunity status, database storage, public API routing, or the map renderer.

**Deliverables**

1. Profile interpretation interface with draft fields and follow-ups.
2. Ranking interface accepting canonical opportunities and a confirmed profile revision.
3. Structured fit assessment with reasons, evidence, known gaps, and uncertainty.
4. Small meaningful evaluation set and documented scoring configuration.
5. Clear degraded behavior when AI or embeddings are unavailable.

**Can start immediately with** canonical opportunity examples and synthetic vendor profiles isolated from the real opportunity catalog.

### 6.3 Workstream C: Data collection and storage

**Owner:** Engineer 3 (one person).  
**Goal:** Collect real opportunities ahead of time, store them with agency and user data, and expose stable application interfaces.

**Owns**

- Agency spreadsheet import, source registry, source adapters, and refresh execution. All collection runs ahead of time (D-19).
- HTML/document extraction, normalization, duplicate grouping, and lifecycle status.
- Work-location resolution and geocoding provenance.
- Canonical storage, record validation, source evidence, and snapshot generation.
- Public HTTP API and integration with B's matching/profile interfaces.
- User database (username, password hash, text summary, embedding), username/password auth, ownership checks, and saved opportunities.
- Storage for opportunity embeddings produced by B, and agency contact data (website, email, phone).
- Source health, coverage counts, deployment backend configuration, and secrets handling.

**Does not own** frontend design or independently invent matching rules.

**Deliverables**

1. Agency/source inventory with honest source health.
2. Real normalized opportunity catalog and exportable snapshot.
3. Versioned application APIs and error shapes.
4. Working accounts and persistence for profiles, embeddings, and saved opportunities.
5. Run instructions, configured deployment, and freshness/coverage metadata.

### 6.4 Joint decisions and coordination rules

| Topic | Responsible owner | Required coordination |
| --- | --- | --- |
| Product scope and prioritization | Ashwin | All owners acknowledge scope changes. |
| Canonical opportunity and agency schema | C | A and B agree before integration. |
| Vendor profile and fit assessment schema | B | A and C agree before integration. |
| User record and embedding storage | C | B supplies embedding dimensions and model version; A supplies sign-up/login needs. |
| HTTP request/response envelopes | C | A supplies consumption needs; B supplies matching fields. |
| Filter semantics and counts | C | A validates UX; B validates effects on matching. |
| Visual appearance | A | No matching/backend redesign needed for visual edits. |
| Location precision and source truth | C | A must preserve disclosure. |
| Match labels and uncertainty | B | A must preserve meaning and wording. |
| Integrated demo and release readiness | Ashwin | Every owner reports acceptance evidence and gaps. |

One repository and one shared schema baseline are preferred. Use separate branches or isolated agent worktrees to avoid concurrent file edits. Each owner delegates bounded sub-tasks to agents but remains accountable for integration. Additional agents are not additional product decision makers.

## 7. Functional requirements: catalog and ingestion

| ID | Priority | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| SRC-01 | P0 | Import an agency spreadsheet after mapping its actual columns. Preserve original agency names and supplied URLs. | Import summary identifies imported, duplicate, invalid, and unresolved rows. |
| SRC-02 | P0 | Assign stable agency and source identifiers. Store agency type, jurisdiction, source URL, portal platform, and access status when known. | Registry can be inspected independently of opportunities. |
| SRC-03 | P0 | Inspect agency links for their real bid portals; group shared platforms into reusable adapters. | At least one real source produces valid records; unsupported sources are visible. |
| SRC-04 | P0 | Collect real open solicitations with source-native identifiers when available. | Each displayed item links to a real source and has a collection timestamp. |
| SRC-05 | P0 | Extract title, buyer/agency, scope or description, status, deadline, location evidence, documents, and publication/amendment dates where available. | Missing fields are null/unknown, never invented. |
| SRC-06 | P0 | Preserve raw source evidence or retrievable excerpts sufficient to inspect material extractions. | A requirement or location shown in the app can be traced to its source. |
| SRC-07 | P0 | Separate first discovery, last successful verification, last extraction, publication, and amendment timestamps. | Newly discovered old work is not labeled newly posted. |
| SRC-08 | P0 | Deduplicate within and across sources. Prefer source ID plus agency; use conservative title/date/location comparisons for cross-posts. | One cross-posted job appears once, with alternate source references retained. |
| SRC-09 | P0 | Do not merge different lots or distinct jobs solely because titles are similar. | A review case preserves similar but independently bid records. |
| SRC-10 | P0 | Record refresh success, partial success, failure, and last successful check separately. | A failed scrape retains a prior snapshot with a stale indicator. |
| SRC-11 | P0 | Exclude known closed, canceled, or awarded work from the default open catalog. | Status and elapsed deadline cases behave consistently. |
| SRC-12 | P0 | Retain real-source snapshots for the demonstration and label their as-of time. | App remains usable when a source temporarily fails. |
| SRC-13 | P0 | Treat an attachment access wall as missing document access, not missing opportunity existence. | Source links and known metadata remain available with a limitation note. |
| SRC-14 | P0 | Keep extraction content separate from instructions. Source documents cannot alter prompts, application policies, or data destinations. | A prompt-injection fixture cannot trigger actions or change output schema. |
| SRC-15 | P0 | Record checked source coverage without claiming all Washington procurement is covered. | Coverage summary reconciles with registry counts. |
| SRC-16 | P0 | Store each agency's website, email, and phone from the agency spreadsheet or a verified public source, and extract the solicitation contact (name, role, email, phone) when the listing publishes one. *(Moved from P1 in v1.1.)* | Values have direct evidence; no guessed contact enrichment. |

### 7.1 Source collection approach

Prefer a source's documented public API or public feed when available. Otherwise use accessible public listing pages and targeted document extraction. A public JSON endpoint discovered in a web application is not automatically a supported long-term API; mark that adapter accordingly and test it against the actual source.

Use deterministic parsing for known fields when possible. Apply Claude to inconsistent scope text and documents, with schema validation and evidence retention. Do not use a model as the source of procurement facts.

Time-box source research during implementation. An inaccessible portal should become a recorded limitation while other sources proceed. Observe source restrictions and reasonable rate limits. Do not build access-control bypass, CAPTCHA circumvention, or private invitations scraping.

### 7.2 Initial source candidates

These are research leads, not a claim that ingestion has already been implemented:

- Washington WEBS public bid calendar: statewide and participating public-agency listings.
- Official agency procurement pages identified in the spreadsheet.
- OpenGov or Bonfire portals linked by those agencies.
- Direct public works/project bid pages and public documents where accessible.

MRSC Rosters is an agency/vendor roster system; its FAQ says project opportunities are not posted on the roster platform. Do not assume it is an open statewide job feed. See source references in Section 22.

## 8. Functional requirements: map and discovery

### 8.1 Visual and interaction requirements

The main surface is a map, with a readable side panel rather than a wall of charts. Use a dark base, terrain/context where feasible, muted labels, and restrained colors. The visual hierarchy should emphasize work locations, selected projects, and the user's service area.

Map animation must serve navigation: smooth zoom to a selected county/site, cluster expansion, and subtle transitions when filters change. Avoid continuous glowing/pulsing markers, decorative motion, and random geographic scattering.

| ID | Priority | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| MAP-01 | P0 | Open on a Washington overview immediately after sign-in. *(Amended v1.1: login required.)* | A signed-in session lands on the map without further steps. |
| MAP-02 | P0 | Support pan, zoom, cluster expansion, marker selection, and list selection. | All interactions remain connected to the same selected opportunity. |
| MAP-03 | P0 | Cluster nearby display anchors at lower zoom levels and reveal individual items at higher zoom. | Dense areas remain navigable; cluster counts represent unique opportunities. |
| MAP-04 | P0 | Synchronize card and marker selection with a detail panel. | Clicking either representation opens the same record. |
| MAP-05 | P0 | Distinguish location precision in details and marker styling or labels. | City/county-level records do not appear to be exact sites. |
| MAP-06 | P0 | Provide a visible place for statewide, remote, and unknown-location results. | Those records remain discoverable without fake point coordinates. |
| MAP-07 | P0 | Show county context and allow county-based filtering. | Selecting a county updates the list and map consistently. |
| MAP-08 | P0 | Keep filter state while opening/closing details and editing the profile. | Navigation does not unexpectedly reset the user's work. |
| MAP-09 | P0 | Show filtered opportunity count, mapped count, and relevant unmapped count where needed. | Counts reconcile; multi-site records are counted once. |
| MAP-10 | P0 | Make Search this area an explicit action or clearly labeled toggle. | Panning alone does not silently change the result set under the default behavior. |
| MAP-11 | P0 | Render the results list if map tiles fail. | Opportunity discovery remains possible with a map error notice. |
| MAP-12 | P0 | After personalization, show assessed fit tiers on cards and appropriate markers with a legend. | Color is not the only way to identify a tier. |
| MAP-13 | P1 | Offer a density layer for the collected catalog. | Legend explains density of sourced opportunities, not all government spending. |
| MAP-14 | P1 | Display a compact posting timeline. | Unknown publication dates stay separate rather than being assigned dates. |

### 8.2 Filters and sorting

P0 filters:

- Keyword/title/scope search.
- Work category, including multiple categories.
- County or user service area.
- Agency and agency type when known.
- Published recency: any time, last 7 days, last 30 days, custom range if easy.
- Deadline: any open, next 7 days, next 30 days, date unknown.
- Personalized fit tier after profile activation.

Sort options:

- Recommended, when a confirmed profile exists.
- Closing soonest, with unknown deadlines last.
- Newly posted, with unknown publication dates last.
- Distance, only when work-location precision supports a meaningful comparison.

Before personalization, default to closing soonest or newly posted and invite the vendor to personalize. Never show unassessed items as Not a fit. They are unassessed until matching runs.

Recency means source publication date. First discovered and amended dates can be displayed as separate facts. If a recency filter excludes unknown dates, explain that unknown-date records are excluded and allow the user to inspect them separately.

### 8.3 Map query semantics

The result list, map, counts, and facets must refer to a shared filter expression and catalog version. For a small demo catalog, returning all filtered display features is acceptable. If pagination is introduced, the map must not pretend a single result page is the full filtered set.

For multi-location records, filtering matches if any known performance location intersects the selected service area. Count the opportunity once even if multiple markers are drawn. A statewide or unknown location requires explicit inclusion semantics; do not treat an arbitrary display centroid as a travel-distance fact.

## 9. Functional requirements: opportunity details

| ID | Priority | Requirement |
| --- | --- | --- |
| DET-01 | P0 | Show source title, agency, source-native solicitation type/reference, and current known status. |
| DET-02 | P0 | Show a concise plain-English scope grounded in the source; identify it as a summary when model-generated. |
| DET-03 | P0 | Show work location, its precision, and the location evidence or explanation. |
| DET-04 | P0 | Show publication, amendment, deadline, and last-checked information when known, with distinct labels. |
| DET-05 | P0 | Show published mandatory qualifications and important operational constraints; separate unknown from absent. |
| DET-06 | P0 | Link to the original solicitation and available public documents. |
| DET-07 | P0 | Show the active vendor's fit tier, concrete reasons, missing information, and known conflicts. |
| DET-08 | P0 | Offer View original posting, Save opportunity, and Contact agency. |
| DET-09 | P0 | Show contract budget/value only if explicitly published and sourced. Otherwise show Not published or omit the field. Never estimate it. |
| DET-10 | P0 | Show the issuing agency's name, website, email, and phone, plus any directly sourced solicitation contact, without implying a personal introduction. *(Moved from P1 in v1.1.)* |

The detail panel must not imply that the website is accepting a bid. View original posting leads to the procurement source; Contact agency shows the agency's own contact details.

## 10. Functional requirements: hybrid onboarding

### 10.1 Interaction sequence

1. Start with a simple prompt: Tell us what your business does and where you work.
2. Accept a natural-language response, plus explicit business base/service-area inputs if missing.
3. Extract a draft profile. Mark inferred fields and preserve the user's original description.
4. Ask no more than roughly three targeted clarification prompts in the initial flow; use structured fields for remaining optional detail.
5. Show an editable summary with explicit unknown values.
6. User confirms the profile and sees personalized results.

Three prompts is a proposed UX limit, not a model correctness requirement. A short step-based form must remain available if Claude is slow or unavailable.

### 10.2 Profile fields

| Field | Expected input | Initial-flow treatment | Use |
| --- | --- | --- | --- |
| Business name | Optional text | Optional | Profile identity and saving. |
| Business description | Free text | Required, or equivalent structured capabilities | Capability interpretation. |
| Base location | City/postcode or selected location | Request explicitly | Geographic context. |
| Service area | Counties, radius, drawn area if supported, or statewide | Required for geographic personalization | Operational location fit. |
| Core services | Editable multi-select/free text | Required | Main capability match. |
| Specialties | Free text/tags | Optional | More precise matching. |
| Explicit exclusions | Free text/tags | Optional | Prevent misleading matches. |
| Crew size | Exact count, range, or unknown | Optional | Operational context, not revenue inference. |
| Equipment | Owned/available equipment and capabilities | Optional | Published equipment/capacity fit. |
| Relevant experience | Short past project examples | Optional | Experience-based matching where explicit requirements exist. |
| Government experience | First-time, subcontractor, prime, unknown | Optional | Context and follow-ups. |
| Typical operational project scale | Small repairs, maintenance, multi-crew, larger projects, unknown | Optional | Vendor suitability without financial pricing inputs. |
| Licenses/registrations | Self-reported type/status, unknown allowed | Targeted where relevant | Requirement checks; no automatic verified claim. |
| Bonding and insurance | Status/capability/unknown; no monetary amounts | Optional | Flag known requirement gaps without collecting pricing. |
| Certifications | Self-reported certification names/status | Optional | Eligibility context. |
| Prime/subcontract interest | Prime, subcontract, both, unsure | Optional | Role alignment without inventing subcontract openings. |
| Availability | Available now or start date | Optional | Timing fit. |
| Mobilization lead time | Days/weeks or unknown | Optional | Operational timing. |
| Working constraints | Nights/weekends/emergency/seasonality | Optional | Published work-schedule fit. |
| Vendor registration readiness | Known registrations and unknown values | Optional | Actionable readiness gaps. |
| Capability statement | Optional document | P1 | Extract additional capability evidence after user review. |

### 10.3 Onboarding requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| ONB-01 | P0 | Require a signed-in account to start and complete personalization. *(Amended v1.1.)* |
| ONB-02 | P0 | Interpret a plain-language business description into a structured draft. |
| ONB-03 | P0 | Distinguish user-entered, inferred, confirmed, and unknown fields. |
| ONB-04 | P0 | Let the user correct any inferred capability or service area before applying it. |
| ONB-05 | P0 | Ask follow-ups based on missing information that materially affects matching. |
| ONB-06 | P0 | Do not ask for rates, hourly pricing, margins, bids, revenue, or pricing strategy. |
| ONB-07 | P0 | Do not infer licenses, certifications, bonding, insurance, experience, or equipment from the business name or an industry stereotype. |
| ONB-08 | P0 | Keep classification codes optional and understandable; suggest them rather than requiring the user to know them. |
| ONB-09 | P0 | Support editing an active profile and recomputing matches using a new revision. |
| ONB-10 | P0 | Offer a working manual-field fallback when profile interpretation fails. |
| ONB-11 | P0 | Avoid requesting unnecessary personal information, license document images, tax IDs, bank details, or identity documents. |
| ONB-12 | P1 | Extract a capability statement with a file-size/type limit, server-side handling, and explicit user review. |
| ONB-13 | P0 | On each confirmed profile revision, generate a plain-language text summary of the profile and its vector embedding, and store both on the user record. *(Added v1.1.)* |

## 11. Functional requirements: recommendation and fit

### 11.1 Matching intent

Rank suitability based on what the vendor can perform and where they can work. Use semantic scope matching together with structured work categories, geography, known requirements, explicit exclusions, and timing.

NAICS can be useful but must not be the sole matching mechanism. Preserve source-native classification schemes, such as NIGP or other commodity/work codes, and record any inferred crosswalk separately. Do not invent a NAICS code simply to fill a required database field.

### 11.2 Logical matching pipeline

1. Apply user-selected catalog filters and exclude known non-open records.
2. Retrieve potentially relevant opportunities by comparing the user's stored profile embedding with precomputed opportunity embeddings, plus structured signals.
3. Evaluate known operational conflicts and published mandatory requirements.
4. Assign a suitability tier and separate assessment completeness.
5. Produce structured reasons grounded in confirmed profile fields and opportunity evidence.
6. Sort consistently and return the assessed opportunity set with coverage metadata.

For the small demo catalog, assess all filtered opportunities when feasible. If only a top-K subset is assessed, the remainder are unassessed, not Not a fit. Map tier filters and tier counts must reflect this distinction.

### 11.3 Fit label semantics

| Label | Meaning | Example |
| --- | --- | --- |
| Good fit | Strong supported capability alignment, service-area compatibility, and no known disqualifying mismatch; material eligibility information is sufficient to support the label. | Vendor confirms asphalt patching and relevant readiness; project seeks local pavement repairs in their service county. |
| Possible fit | Some supported alignment, but the scope is adjacent, a role/capacity question remains, or the opportunity needs closer evaluation. | Excavation vendor matches site preparation but the job also includes work they did not claim. |
| Not a fit | A clear, supported capability, geography, availability, exclusion, or published mandatory requirement conflict exists. | Vendor explicitly excludes concrete work and the opportunity is concrete-only. |
| Needs review | Missing or unreliable material information prevents a defensible suitability conclusion. | Scope is too vague, work location is unknown for an on-site-only vendor, or essential qualification status is unknown. |

Unknown is not false. A vendor who has not answered an insurance question is not automatically uninsured. A solicitation without an extracted requirement is not evidence that no requirement exists.

An unassessed item is a separate processing state, not a fifth suitability tier. Show Personalize to assess or Assessment pending as appropriate.

### 11.4 Initial scoring configuration

The following is a proposed starting configuration for ordering results within tiers, not an empirically calibrated model:

| Signal | Proposed weight | Constraint |
| --- | --- | --- |
| Semantic scope and services alignment | 45% | Use actual work descriptions and confirmed vendor capabilities. |
| Structured category/code alignment | 20% | Missing codes are neutral; inferred codes carry a provenance flag. |
| Geographic alignment | 20% | Respect place-of-performance precision and service-area definitions. |
| Explicit experience/equipment/capacity alignment | 10% | Score only what source and profile substantiate. |
| Availability and schedule compatibility | 5% | Do not infer a work start date from a bid deadline. |

Normalize across supported factors while separately measuring information completeness. Missing data must not inflate a candidate into Good fit. Published mandatory conflicts override a high similarity score. Unknown material eligibility prevents a strong verified-sounding label; use Possible fit or Needs review according to the documented rule.

Do not display a numerical percentage as a chance of award. A user-facing fit percentage is unnecessary for this demo. If shown later, label it as a suitability score and explain its basis.

Tier thresholds and evidence rules must be versioned and validated on representative cases rather than chosen solely to generate attractive demo results.

### 11.5 Required assessment output

- Opportunity ID and opportunity record version.
- Profile ID and confirmed profile revision.
- Assessment state: assessed, pending, or unavailable.
- Fit tier when assessed.
- Internal ranking score when available; not a win probability.
- Specific positive reasons.
- Known mismatches and published mandatory gaps.
- Material unknowns and recommended profile clarifications.
- Evidence references for opportunity facts and profile field paths for vendor facts.
- Assessment timestamp and ranking version.

### 11.6 Recommendation requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| REC-01 | P0 | Combine semantic matching with structured signals; category/code equality alone is insufficient. |
| REC-02 | P0 | Respect confirmed explicit exclusions and known service-area conflicts. |
| REC-03 | P0 | Assign tiers using the meanings above and preserve unknown-data states. |
| REC-04 | P0 | Generate concrete explanations tied to source and profile evidence. |
| REC-05 | P0 | Do not claim guaranteed eligibility, legal compliance, award likelihood, or Jon's endorsement. |
| REC-06 | P0 | Recompute or invalidate assessments after material profile edits or opportunity changes. |
| REC-07 | P0 | Return profile revision and catalog/ranking versions so stale responses cannot overwrite newer ones. |
| REC-08 | P0 | Handle no matches honestly; suggest editable constraints without inventing opportunities. |
| REC-09 | P0 | Keep personalized ranking unavailable, pending, or clearly degraded when its service fails; never substitute fake tiers. |
| REC-10 | P0 | Evaluate prime/subcontract preferences without inventing an available subcontract role from a prime solicitation. |
| REC-11 | P0 | Make results stable for identical profile, catalog, filters, and ranking version within a demo session. |
| REC-12 | P1 | Translate supported natural-language queries into visible, editable filters and ask clarification for ambiguous intent. |

## 12. Shared data contract

The following fields define integration behavior. They do not mandate a particular database, vector store, geospatial extension, ORM, or service framework. C owns canonical opportunity transport; B owns the fit/profile schema; changes require coordination.

### 12.1 Common conventions

- IDs are opaque strings, stable across refreshes where possible.
- Unknown scalar values are `null`; unknown arrays must be distinguished from known empty arrays through a completeness/status field where the distinction matters.
- JSON keys use camelCase. Documented enums use lowercase snake_case except the displayed fit labels.
- Full timestamps use ISO 8601 with an offset or UTC. Preserve source timezone information when known.
- Date-only source fields remain date-only. Do not fabricate a midnight timestamp and present it as an exact deadline.
- Longitude/latitude geometry uses GeoJSON coordinate order: `[longitude, latitude]`.
- Scores, fit tiers, and source statuses are separate concepts.
- Every user-specific result includes the applicable profile revision.
- Public opportunities and user-owned profiles/saves have separate access rules.

### 12.2 Agency

| Field | Type / meaning |
| --- | --- |
| id | Stable agency ID. |
| name | Canonical display name. |
| sourceNames | Original spreadsheet/source variants. |
| agencyType | State, county, city, port, school, university, utility, transit, tribal, federal, other, or unknown. |
| jurisdiction | Named jurisdiction when known. |
| websiteUrl | Official agency URL, nullable. |
| email, phone | Agency contact email and phone, nullable; shown in the contact handoff. |
| contactSource | Where the contact values came from (spreadsheet row or verified public URL). |
| sourceIds | Registry references. |
| inventoryOrigin | Spreadsheet row reference or documented manual addition. |
| procurementCoverage | Checked, partial, inaccessible, not_checked, or no_public_listing_found. |

### 12.3 Source registry entry

| Field | Type / meaning |
| --- | --- |
| id, agencyIds | Source ID and participating agency references. |
| url, platform | Public entry point and portal family, if identified. |
| accessMode | Public API/feed, public HTML, public document, login_required, or unknown. |
| collectionStatus | Not_started, running, success, partial, failed, or blocked. |
| lastAttemptAt, lastSuccessfulCheckAt | Separate attempt/success timestamps. |
| lastErrorCode | Sanitized operational error, nullable. |
| adapterVersion | Collector implementation version. |
| limitations | Plain-language coverage/access notes. |

### 12.4 Opportunity

| Field | Type / meaning |
| --- | --- |
| id, version | Stable canonical identity and record revision. |
| sourceReferences | One or more source IDs, source-native IDs, URLs, and evidence references. |
| agencyId | Canonical buyer/issuing agency. |
| title | Source-grounded title. |
| solicitationType | Source-native type plus normalized type if reliable. |
| status | Open, closed, awarded, canceled, forecast, unknown. |
| statusBasis | Source status, deadline-based conclusion, or other documented evidence. |
| description, summary | Available source text and optional grounded summary. |
| workCategories | Normalized work categories with source/inferred provenance. |
| classificationCodes | Array of scheme, code, label, and provenance; may be empty or incomplete. |
| publication, amendment, deadline | DateValue objects; nullable. |
| performanceStart, performanceEnd | DateValue objects only when published. |
| locations | PerformanceLocation array. |
| locationStatus | Located, approximate, multiple, statewide, remote, or unknown. |
| requirements | Requirement array plus extraction completeness. |
| documentLinks | Public or access-restricted document references, with access status. |
| publicContact | Directly sourced contact fields and evidence, nullable. |
| publishedValue | Amount/range/currency/source only if published; nullable. |
| firstSeenAt, lastVerifiedAt, extractedAt | Distinct operational timestamps. |
| sourceSnapshotAt | Time represented by a cached source snapshot, nullable. |
| completeness | Known missing or unverified material fields. |

### 12.5 DateValue

| Field | Meaning |
| --- | --- |
| rawText | Original date wording when available. |
| value | ISO date or ISO timestamp. |
| precision | Date or datetime. |
| timeZone | IANA timezone or documented source offset, nullable. |
| evidenceRef | Link to source evidence. |

For a date-only closing date, display the date without an invented hour. An elapsed date is closed for default discovery unless better source evidence indicates otherwise. On the listed closing day with no time, label time unknown; do not claim that an exact submission window remains.

### 12.6 PerformanceLocation

| Field | Meaning |
| --- | --- |
| id | Stable location ID within the opportunity. |
| label | Human-readable work area. |
| precision | Exact_site, address, road_segment, city, county, region, statewide, remote, or unknown. |
| geometry | Source-grounded GeoJSON geometry, nullable. |
| displayPoint | Optional point used for display; may be a disclosed approximate anchor. |
| displayPointBasis | Exact location, geocoded address, city centroid, county centroid, or other documented basis. |
| countyNames, cityName | Known administrative locations. |
| rawLocationText | Source excerpt. |
| evidenceRef | Source evidence. |
| resolutionMethod | Source geometry, deterministic parsing, geocoder, model-assisted extraction, or manual review. |
| resolutionConfidence | Qualitative confidence separate from spatial precision. |

Never populate `geometry` or `displayPoint` with random offsets to make the map look fuller. If a centroid is used, disclose it. Geometry may be absent while the record remains searchable in the list.

### 12.7 Requirement

| Field | Meaning |
| --- | --- |
| id, category | Stable reference and type, such as license, experience, equipment, insurance, site_visit, or schedule. |
| text | Source-grounded requirement wording. |
| mandatory | True, false, or null if unclear. |
| evidenceRef | Source URL/document excerpt reference. |
| extractionStatus | Verified_excerpt, extracted, or needs_review. |

### 12.8 VendorProfile

Include the fields in Section 10.2, plus `id`, `revision`, `ownerUserId`, `originalDescription`, `confirmedAt`, and field-level provenance. Every profile belongs to a user (12.11); each confirmed revision regenerates the user's `textSummary` and `embedding`. Model-inferred fields remain drafts until confirmed. Store business capability facts without adding financial pricing fields.

Service area must be explicit enough for the matcher: selected counties, statewide, a supported radius around a verified base location, or a supported polygon. Preserve the user's original wording and the normalized representation. Avoid silently turning a travel-time preference into a straight-line radius.

### 12.9 FitAssessment

Include `opportunityId`, `opportunityVersion`, `profileId`, `profileRevision`, `state`, `tier`, `rankingScore`, `reasons`, `mismatches`, `unknowns`, `suggestedClarifications`, `assessedAt`, and `rankingVersion`.

Each reason/mismatch references at least one relevant profile field and opportunity evidence where it makes a factual cross-comparison. A pending/unavailable assessment has no invented tier or score.

### 12.10 Evidence reference

An evidence record should identify the source URL, optional document URL, collection time, short supporting excerpt, and page/section when available. Store only the amount of text needed for extraction review and provenance; do not publish entire restricted documents.

### 12.11 User

| Field | Type / meaning |
| --- | --- |
| id | Stable user ID. |
| username | Unique login name. |
| passwordHash | Salted hash (for example bcrypt or argon2). Plaintext passwords are never stored, logged, or returned. |
| textSummary | Plain-language summary of the confirmed profile, generated by B. |
| embedding | Vector embedding of `textSummary`, with `embeddingModel` and `embeddingVersion`. |
| profileRevision | Confirmed profile revision the summary and embedding were built from. |
| createdAt, updatedAt | Timestamps. |

Opportunities also store an embedding from the same model and version, so matching compares like with like. When the embedding model changes, stored vectors are regenerated.

## 13. Application API contract

These routes are a proposed stable interface. C may implement them as Next.js handlers or another service behind the same frontend adapter. B supplies the profile/matching modules or internal service; C exposes the public facade. A should not directly call provider APIs or depend on database-specific objects.

### 13.1 Routes

| Method and route | Purpose | Owner |
| --- | --- | --- |
| POST /api/v1/auth/signup | Create an account with username and password. | C |
| POST /api/v1/auth/login | Start an authenticated session. | C |
| POST /api/v1/auth/logout | End the session. | C |
| GET /api/v1/coverage | Source health, inventory coverage, freshness, catalog version. | C |
| GET /api/v1/agencies | Agency filter options and coverage status. | C |
| GET /api/v1/opportunities | Filtered opportunities, facets/counts, and display geometry. | C |
| GET /api/v1/opportunities/:id | Full detail, evidence, and available documents. | C |
| POST /api/v1/profile/interpret | Description -> draft profile, inferred fields, and follow-up questions. | B logic, C facade |
| POST /api/v1/matches | Confirmed profile + filters -> ranked IDs and fit assessments. | B logic, C facade |
| GET /api/v1/me/profile | Retrieve authenticated user's saved profile. | C |
| PUT /api/v1/me/profile | Save confirmed profile with revision control. | C |
| GET /api/v1/me/saved-opportunities | Retrieve authenticated user's saved items. | C |
| PUT /api/v1/me/saved-opportunities/:id | Idempotently save an opportunity. | C |
| DELETE /api/v1/me/saved-opportunities/:id | Remove saved item. | C |
| POST /api/v1/search/interpret | P1: convert text into supported filter draft and clarifications. | B logic, C facade |

All routes other than sign-up and login require an authenticated session. Auth may use a provider or a simple username/password implementation, as long as passwords are hashed and sessions are verified server-side.

### 13.2 Shared filter object

Use one representation across discovery and matching: `query`, `workCategories`, `agencyIds`, `agencyTypes`, `countyNames`, `serviceArea`, `publishedAfter`, `publishedBefore`, `deadlineAfter`, `deadlineBefore`, `includeUnknownDates`, `includeStatewide`, `includeUnknownLocations`, `viewportBounds`, `fitTiers`, and `sort` as applicable.

Apply filters consistently before pagination and counts. A fit-tier filter requires assessments for the relevant set; report assessed coverage explicitly if partial. Validate bounds, date ranges, enum values, and filter lengths. Unsupported filters should fail clearly, not be silently ignored.

### 13.3 Response metadata

Catalog responses include:

- `schemaVersion`.
- `catalogVersion`.
- `generatedAt`.
- `sourceSnapshotAt` when applicable.
- `isStale` and partial-source limitations.
- `totalFiltered`, `mappedCount`, and `unmappedCount` as distinct useful counts.
- `page`/`pageSize` or cursor if pagination exists.

Matching responses additionally include `profileRevision`, `rankingVersion`, `assessedCount`, `unassessedCount`, and `assessmentState`.

### 13.4 Minimal envelope example

This is a schema illustration with empty data, not a real catalog result.

```json
{
  "data": [],
  "meta": {
    "schemaVersion": "1.0",
    "catalogVersion": "example-version",
    "generatedAt": "2026-10-25T19:00:00Z",
    "sourceSnapshotAt": null,
    "isStale": false,
    "totalFiltered": 0,
    "mappedCount": 0,
    "unmappedCount": 0,
    "limitations": []
  },
  "error": null
}
```

### 13.5 Error contract

Return a stable error code, readable message, and retryability indicator. Minimum cases: `invalid_input`, `source_unavailable`, `ai_unavailable`, `rate_limited`, `unauthenticated`, `forbidden`, `not_found`, `revision_conflict`, and `internal_error`.

Do not return raw provider prompts, secrets, stack traces, full uploaded documents, or private account identifiers in error messages. The frontend must distinguish a true empty result from a failed fetch.

### 13.6 Authenticated session behavior

Profile interpretation and matching run for the signed-in user and read their stored profile, text summary, and embedding. Never create profile records that are not owned by a user.

Cancel or ignore stale requests when a profile revision changes. A response for revision 2 must not overwrite results for revision 3. Do not place full capability descriptions or personal information in URLs or analytics payloads.

## 14. Accounts, saving, and agency contact handoff

| ID | Priority | Requirement |
| --- | --- | --- |
| ACC-01 | P0 | Require sign-in for the catalog, details, onboarding, and personalized results. Sign-up and login are the only public screens. |
| ACC-02 | P0 | Sign up and sign in with a unique username and password. |
| ACC-03 | P0 | Store passwords only as salted hashes; never log or return them. |
| ACC-04 | P0 | Persist the confirmed profile, its text summary and embedding, and explicit saved items under the user's account. |
| ACC-05 | P0 | Enforce server-side ownership for profile and shortlist reads/writes. |
| ACC-06 | P0 | Support sign-out without exposing the previous user's saved data to another account. |
| CON-01 | P0 | Show the issuing agency's name, website, email, and phone on the opportunity detail and in personalized results. |
| CON-02 | P0 | Use only values from the agency spreadsheet or a verified public source; show Not available for missing values, never a guessed address. |
| CON-03 | P0 | Website, email, and phone are working links (`https:`, `mailto:`, `tel:`); nothing is sent automatically to the agency or to Jon. |
| CON-04 | P0 | Do not imply that contact was made, that the agency endorses the vendor, or that a contract is guaranteed. |

Suggested section label: **Contact agency**. Supporting copy: **Reach out to the agency directly about this opportunity.**

## 15. Nonfunctional requirements

### 15.1 Performance targets

These are demo acceptance targets to measure on the actual deployed application, not performance claims already achieved.

| ID | Target | Measurement |
| --- | --- | --- |
| NFR-01 | Cached catalog/list usable within about 3 seconds on a typical laptop connection. | Fresh navigation to deployment; record observed time. |
| NFR-02 | Normal filter interactions feel responsive; target under 500 ms for local/cached filtering. | Apply category/county changes on demo-sized data. |
| NFR-03 | Profile interpretation and first recommendations complete within about 15 seconds under normal provider conditions, with immediate progress feedback. | Time the full user action; display retry/manual fallback after timeout. |
| NFR-04 | Selecting an already loaded opportunity opens details without a full-page reload. | Marker/list selection. |
| NFR-05 | Map remains responsive with a stress fixture around 1,000 display features. | Separate development fixture; never counted as real catalog coverage. |

### 15.2 Reliability and truthfulness

- External source refresh failure must not destroy the last usable real snapshot.
- Do not run all scraping synchronously when a user opens the page.
- AI outage leaves ordinary browsing and manual profile editing usable.
- An extraction error must not be silently converted into an open opportunity or a qualification claim.
- Stale saved opportunities may remain bookmarked but must show current known status.
- Every limitation shown to judges should reflect real implementation, not hidden simulated functionality.

### 15.3 Security and privacy

- Keep Claude, geocoder, database, auth, and other secret credentials server-side.
- Hash passwords with a salted, slow hash (bcrypt or argon2) and enforce a minimum password length.
- Store text summaries and embeddings server-side; never expose another user's summary or embedding through the API.
- Restrict exposed map tokens by provider-supported origin/scope controls.
- Validate and sanitize model-generated text and externally sourced content before display.
- Do not execute model-produced code or follow document instructions as actions.
- Basic request limits and input-size limits should prevent accidental quota exhaustion.
- If P1 URL/document fetching is added, restrict fetch destinations to approved public sources and prevent local/private network access.
- Keep Jon's confidential material out of prompts, uploads, logs, embeddings, and fixtures.
- Do not log full vendor descriptions or documents by default.
- No automatic emails, messages, or government outreach.

### 15.4 Accessibility and responsive behavior

- A list-based equivalent must expose the same core opportunities as the map.
- Visible labels accompany fit colors; sufficient contrast and readable type sizes.
- Keyboard focus works through filters, onboarding, details, sign-in, and CTA.
- Details and onboarding dialogs can be dismissed and do not trap focus incorrectly.
- Respect reduced-motion preferences.
- At a narrow viewport around 390 px, offer a map/list toggle or stacked layout without clipped controls.
- At a typical demo laptop viewport, map, results, and primary actions remain readable without horizontal scrolling.

## 16. Acceptance scenarios

Use real sourced opportunities for integrated acceptance. Synthetic vendor profiles and deliberately constructed edge cases are appropriate for development tests, but their opportunities must be isolated from the live catalog and labeled as test fixtures.

| ID | Scenario | Expected result | Primary owner |
| --- | --- | --- | --- |
| AT-01 | Open the site in a fresh session, sign up, and sign in. | Sign-up/login gate appears first; after sign-in the real map/list loads with coverage visible. | A/C |
| AT-02 | Filter to a county and paving-related work. | Markers, list, and counts refer to the same filtered unique opportunities. | A/C |
| AT-03 | Select a marker, then a different card. | Detail and selected map state follow the same canonical ID. | A |
| AT-04 | Inspect a county-level work location. | Approximate county location is disclosed; no exact-site claim. | A/C |
| AT-05 | Inspect statewide and unknown-location opportunities. | They remain in an appropriate list/category and are not pinned at arbitrary sites. | A/C |
| AT-06 | Enter an asphalt repair vendor with a limited county service area. | Draft profile reflects the description and asks only useful missing questions. | A/B |
| AT-07 | Correct an inferred service before confirmation. | Confirmed profile and recommendations use the corrected service. | A/B |
| AT-08 | Change service area after receiving results. | New revision recomputes matches and ignores stale responses. | A/B/C |
| AT-09 | Evaluate a clear scope conflict. | Supported Not a fit label and a concrete reason. | B |
| AT-10 | Evaluate unknown mandatory qualification status. | Unknown is preserved; no unsupported Good fit or false failure claim. | B |
| AT-11 | Open an explanation. | Factual claims reference source/profile evidence, not generic sales copy. | B/A |
| AT-12 | Inspect a newly discovered older listing. | It is not labeled newly posted unless publication date supports that. | C/A |
| AT-13 | Ingest the same solicitation from two sources. | One canonical opportunity; provenance retains both references. | C |
| AT-14 | Ingest two distinct lots with similar titles. | Separate opportunity identities remain. | C |
| AT-15 | Source refresh fails after a successful scrape. | Previous snapshot remains; staleness and limitation are visible. | C/A |
| AT-16 | Deadline has passed or source says canceled. | Item leaves default open discovery and saved view shows status. | C/A |
| AT-17 | Claude call fails. | Clear retry/manual fallback; no fabricated profile or match tiers. | A/B/C |
| AT-18 | User gets no results. | Honest empty state, editable filters, no fabricated substitute opportunities. | A/B/C |
| AT-19 | Confirm a profile, then edit and reconfirm it. | The user record's text summary and embedding update to the new revision; matches recompute. | B/C |
| AT-20 | Save, reload, and return to an account. | Saved profile and items persist. | A/C |
| AT-21 | Try to read another user's saved profile/items. | Server denies access. | C |
| AT-22 | Open Contact agency on an opportunity. | Agency name, website, email, and phone show with working links, or Not available when missing; nothing is sent automatically. | A/C |
| AT-23 | Map provider fails. | List remains usable and map-specific error is clear. | A |
| AT-24 | Navigate core flow with keyboard and narrow viewport. | Main actions are reachable/readable. | A |
| AT-25 | Source text contains instructions to ignore rules or leak secrets. | Extraction treats it as data; schema and application behavior remain intact. | B/C |
| AT-26 | Request any catalog or matching route without signing in. | Server returns `unauthenticated`; the UI redirects to login. | A/C |

### 16.1 Matching evaluation set

B should maintain at least six meaningful cases, with expected qualitative behavior:

1. Asphalt patching vendor -> relevant paving/repair scope in service area.
2. Same vendor -> unrelated office software procurement.
3. Excavation vendor -> adjacent mixed-scope site preparation project.
4. Strong capability match -> clearly outside confirmed service area.
5. Published mandatory requirement -> vendor explicitly says they lack it.
6. Published mandatory requirement -> vendor status unknown.

Use known source-grounded opportunities where available. Controlled synthetic opportunities may be used for unit/evaluation tests only. Include the source evidence or fixture assumptions for expected outcomes. Do not evaluate only the easiest positive examples.

### 16.2 Verification approach

Prioritize a few meaningful automated checks for schema compatibility, duplicate handling, date/status behavior, profile revision safety, matching conflicts, and account ownership. Use focused manual verification for visual/interaction behavior. Do not spend the deadline generating tests that merely duplicate implementation or polishing coverage percentages.

## 17. Four-hour implementation plan

The clock starts when the team begins implementation. Parallel work is expected throughout; the final hour is reserved for integration and verification, not postponed until every isolated feature is finished.

| Elapsed time | A: Frontend | B: Embeddings & matching | C: Data collection & storage | Shared checkpoint |
| --- | --- | --- | --- | --- |
| 0:00-0:15 | App shell, layout, map choice, API adapter. | Profile/assessment schema and initial prompts. | Repository, source inventory, storage/API conventions, user table. | Freeze schema v1, ownership, env names, and first demo vendor. |
| 0:15-0:45 | Map/list/detail scaffold with isolated fixtures. | Profile interpretation, manual fallback contract, first ranking cases. | One real source collector, canonical normalization, first snapshot and list endpoint. | Real vertical slice: one sourced record visible in the actual UI. |
| 0:45-1:30 | Filters, location precision, onboarding/review flow. | Text summaries and embeddings for profiles and opportunities; semantic + structured matching and explanations. | Username/password auth; additional high-yield source adapters, deduplication, dates, work locations. | Frontend consumes real data; profile endpoint connected. |
| 1:30-2:15 | Personalized map/results, detail reasons, save/sign-in UI. | Tier rules, unknown handling, profile revisions, evaluation. | Matching facade, embedding storage, persistence, source health and snapshot fallback. | Complete sign in -> explore -> personalize -> inspect -> save -> contact agency path. |
| 2:15-3:00 | Visual polish, responsive behavior, keyboard/error states. | Explanation quality, latency, regression fixes. | Coverage expansion, location corrections, deployment reliability. | P0 acceptance pass and actual coverage inventory. |
| 3:00-3:30 | Integrated demo rehearsal and issue fixes. | Fix observed recommendation defects. | Resolve deploy/source failures; pin a real snapshot. | All P0 gaps named; no new major architecture changes. |
| 3:30-4:00 | Final presentation polish and verified walkthrough. | Verify final profile examples and versions. | Final source/deadline refresh where safe; smoke test deployment. | Release candidate, working URL, evidence, known limitations. |

### 17.1 Safe parallel agent assignments

| Workstream | Independent agent tasks | Keep under one owner |
| --- | --- | --- |
| A | Map interactions; onboarding components; detail/card components; visual QA. | Shared app state, design tokens, routes, final integration. |
| B | Profile extraction; semantic retrieval; structured fit rules; evaluation cases. | Profile schema, tier semantics, ranking version. |
| C | Source-family adapters; spreadsheet mapping; location extraction; auth/persistence. | Canonical IDs, storage writes, public APIs, source reconciliation. |

Each delegated task must name its files/branch, inputs, outputs, acceptance evidence, and integration owner. Avoid multiple agents editing shared schemas, global CSS, package files, or environment configuration simultaneously.

### 17.2 Scope triage if time compresses

First remove P1 comparison, natural-language search, uploads, heatmap, and decorative animation. Then reduce the number of source adapters while retaining a truthful useful real catalog. Keep core map/list/detail, manual-capable onboarding, explained matching, provenance, accounts, and the agency contact handoff intact.

If auth, contact data, or another P0 cannot be completed, explicitly record the failure. Do not present local session saving as account persistence, or placeholder contact details as real ones.

## 18. Demonstration plan

### 18.1 Suggested narrative

1. Sign in and open on the Washington map; state the actual sourced coverage.
2. Zoom into an area with real open public works opportunities.
3. Inspect a project, its location precision, deadline, agency request, and source.
4. Describe a realistic vendor: asphalt patching and small paving work in specified counties.
5. Confirm the extracted capabilities and service area.
6. Show the same map and list reordered with fit labels and reasons.
7. Open a strong/possible match and one supported mismatch.
8. Change one meaningful profile field and show a corresponding change.
9. Save an opportunity to the account.
10. Open Contact agency and show the agency's name, website, email, and phone.

Choose the demo location and profile after inspecting real available work. Do not invent an open pothole contract or alter fit rules to force a favorable result. If only mixed-scope opportunities exist, demonstrate the honest Possible fit explanation.

### 18.2 Demo readiness checklist

- Deployed URL works in a fresh browser session.
- Real opportunity snapshot is available and its as-of time is visible.
- No development fixtures are in the public catalog.
- Featured opportunities are still known open or accurately marked with deadline uncertainty.
- Map provider and API credentials work at the deployed origin.
- One full onboarding and meaningful profile edit work.
- Match explanations are specific and source-grounded.
- Source links and available documents open.
- Sign-up, sign-in, and saving work in a fresh browser session.
- Agency contact details show for featured opportunities, with working links.
- Empty/error states are understandable.
- Actual agency/opportunity counts match the source inventory.

## 19. Risks and operational fallbacks

| Risk | Impact | Required response |
| --- | --- | --- |
| Spreadsheet arrives late or has inconsistent columns. | Source discovery starts with incomplete inventory. | Build configurable import; retain unresolved rows; continue with verified official sources. |
| Many agencies share a portal. | Repeated custom scraping wastes time. | Identify platform families and reuse adapters. |
| Portal requires login or blocks public extraction. | Coverage gap. | Mark limitation and proceed with other sources; no bypass implementation. |
| Work location is absent or only in PDFs. | Map density/precision is limited. | Extract available public documents; use disclosed city/county anchors or unmapped category. |
| Geocoder returns headquarters or wrong place. | Misleading work map. | Require work-location evidence; inspect ambiguous records; keep unknown if unresolved. |
| Publication date is missing. | Recency slider could mislead. | Preserve null and separate first discovered/amended values. |
| AI outputs malformed fields or generic explanations. | Bad profile/match behavior. | Validate schema, retry once if appropriate, then manual/degraded path. |
| Semantic relevance masks mandatory conflict. | Misleading Good fit label. | Apply supported conflict rules and information-completeness logic separately. |
| Sparse real opportunities. | Fewer impressive map points. | Expand accessible approved sources; report actual coverage; improve interaction rather than fabricate density. |
| Auth not configured. | Nothing is usable, since accounts are required. | Build sign-up/login first and include it in the early vertical slice. |
| Agency email/phone missing from the spreadsheet. | Contact handoff is incomplete. | Fill from the agency's official website where published; otherwise show Not available. |
| Shared schema changes mid-build. | Integration breaks. | Version contract and coordinate changes with all consumers. |
| Last-minute deployment failure. | Demo unavailable. | Deploy a vertical slice early and preserve a known good release. |

## 20. Definition of done and handoff artifacts

### 20.1 Per-workstream completion

**A is done when:** the real catalog drives a polished map/list/detail flow; onboarding and profile correction work; fit and uncertainty are understandable; sign-up/login, saving, and contact interactions reflect actual backend behavior; main responsive/accessibility checks pass.

**B is done when:** profile interpretation produces reviewable fields; confirmed profiles produce a stored text summary and embedding; ranking changes meaningfully with capabilities and service area; labels obey evidence/missing-data rules; explanations cite structured evidence; evaluation cases and version metadata are documented.

**C is done when:** real sources populate valid canonical records; coverage and refresh limitations are visible; work locations are traceable; duplicates/status/dates are handled; application APIs, username/password accounts, user and embedding storage, agency contact data, and snapshot fallback work in deployment.

### 20.2 Whole-product completion

The product is complete for the intended demo when the integrated P0 journey passes against the deployed application, source coverage is reported honestly, and any unmet external input or requirement is explicitly named. Reaching a visual mockup or an isolated vector search is not whole-product completion.

### 20.3 Required repository handoff files

Suggested names; use the team's existing conventions if present:

- `README.md`: local run, deployment, and service configuration instructions.
- `.env.example`: names/placeholders only, no secrets.
- `docs/SRS.md`: this specification and agreed amendments.
- `docs/DECISIONS.md`: implementation choices, owners, and schema versions.
- `docs/SOURCES.md`: agencies, portal URLs, adapter health, coverage limitations, and verified source timestamps.
- `docs/DEMO.md`: real demo profile, walkthrough, deployed URL, and known limitations.
- `docs/ACCEPTANCE.md`: requirement/scenario status with evidence.
- Canonical opportunity snapshot and schema examples, excluding secrets and confidential data.
- Development fixtures stored separately from production/demo data.

Do not commit confidential vendor data, provider keys, auth sessions, or Jon's proprietary material.

## 21. Copy-ready workstream prompts

These prompts assume this SRS is available to the teammate or agent. Each owner may delegate further, but should maintain the same public contracts and product semantics.

### 21.1 Prompt for Workstream A

> You own the Frontend workstream for Washington Contract Explorer. Read the SRS, especially Sections 1-6, 8-10, and 12-18. Implement the React/Next.js map-first experience: dark Washington map, clustering, synchronized opportunity list, filters, detail panel, hybrid onboarding with editable profile review, personalized fit presentation, sign-up/login and saving UI, and the agency contact panel (name, website, email, phone). Use the canonical API contract rather than inventing source truth or local fit rules. Keep exact versus approximate work locations clear; statewide and unknown locations must remain discoverable. Every screen except sign-up and login requires an account. Build immediately against isolated contract-valid development fixtures, then connect the real source API as soon as available. Do not put synthetic opportunities into the real catalog. Ignore stale matching responses after profile edits. Deliver a connected deployed journey, focused visual/manual verification, and concise acceptance evidence. Treat comparison, natural-language search, uploads, and heatmap as P1. Coordinate shared schema changes with B and C. Keep the SRS updated with actual decisions and known limitations.

### 21.2 Prompt for Workstream B

> You own Embeddings and Matching for Washington Contract Explorer. Read the SRS, especially Sections 2-6, 10-13, and 16. Implement plain-language profile interpretation into a reviewable structured draft, targeted follow-ups, confirmed profile revisions, a text summary and vector embedding for each confirmed profile (stored on the user record by C), opportunity embeddings, and semantic-plus-structured opportunity matching. Use services, exclusions, work categories/source-native codes, service area, supported capacity/experience, and timing. Never collect vendor pricing or ingest Jon's confidential data. Do not infer licenses, equipment, certifications, or government experience from stereotypes. Implement Good fit, Possible fit, Not a fit, and Needs review according to evidence and missing-data semantics. Unknown is not false; unassessed is not Not a fit. A mandatory supported conflict must not be hidden by high vector similarity. Return structured reasons, gaps, evidence references, profile/opportunity versions, and ranking version. Make the interface consumable by C's public API and A's UI without requiring frontend knowledge of the vector store. Evaluate the six cases in Section 16 and document actual behavior, latency, and limitations. Coordinate schema changes and keep the SRS/decision log updated.

### 21.3 Prompt for Workstream C

> You own Data Collection and Storage for Washington Contract Explorer. Read the SRS, especially Sections 2-7, 12-17, and 19-20. Build agency spreadsheet import, source registry and discovery, reusable source-platform adapters, real opportunity normalization, provenance, deduplication, lifecycle/date handling, work-location extraction, snapshot fallback, and the application API facade. Begin with verified accessible official sources while the spreadsheet is pending. Treat approximately 10 agencies and 30-50 unique open opportunities as planning targets, not facts or permission to pad the catalog. Preserve source-native IDs/codes, unknown dates and qualifications, exact versus approximate locations, and last successful refresh. Do not use agency headquarters as an unlabeled worksite. Exclude closed/awarded/canceled work from default discovery. Expose B's profile/matching functions behind the agreed routes. Implement required username/password accounts with hashed passwords, and a user table storing username, password hash, text summary, and embedding, plus saved opportunities. Collect everything ahead of time; nothing is scraped at page load. Store agency website, email, and phone for the contact handoff. Deploy an early real-data vertical slice for A. Do not bypass access controls or let source text become instructions. Record source health and coverage limitations, keep secrets server-side, and provide run/configuration instructions, a real-source snapshot, and acceptance evidence. Backend/database/vector choices are yours if the agreed interface remains stable.

## 22. Source references and reuse candidates

Planning research was conducted on October 25, 2026. These references support source discovery and implementation research. They do not prove that a scraper works or that any specific agency has been collected.

| Ref | Source | Relevant finding / limitation |
| --- | --- | --- |
| R-01 | [Washington DES: Register for Bid Opportunities](https://des.wa.gov/do-business-state/how-work-state/register-bid-opportunities) | DES describes WEBS and states that not all public agencies in Washington must post there. Avoid exhaustive-coverage claims. |
| R-02 | [Washington WEBS public bid calendar](https://pr-webs-vendor.des.wa.gov/bidcalendar.aspx) | Public listings expose opportunity descriptions, closing/amendment information, and contact names; document availability may differ. Validate actual fields in implementation. |
| R-03 | [MRSC Rosters: Business FAQs](https://mrscrosters.org/businesses/business-faq/) | FAQ distinguishes vendor rosters from project postings; opportunities are not posted on the roster platform itself. |
| R-04 | [Seattle: Construction Contracting](https://seattle.gov/purchasing-and-contracting/construction-contracting) | Seattle identifies OpenGov as an online destination for public works advertisements. |
| R-05 | [morrisonak/Bonfire-App](https://github.com/morrisonak/Bonfire-App) | README describes Bonfire aggregation, API client, agency configurations, filtering, and caching. Repository identifies an MIT license. Candidate implementation reference; not tested against the team's agencies. |
| R-06 | [Echoandelementwebsites/rfp_scraper](https://github.com/Echoandelementwebsites/rfp_scraper) | README describes construction-focused portal discovery, listing/detail extraction, and classification. Runtime suitability and reuse license were not verified during planning. Treat as a reference pending inspection. |

Do not equate public GitHub visibility with an open-source reuse license. Confirm applicable licenses before copying code. Confirm current endpoint behavior before choosing a repository as an implementation dependency.

## 23. Open issues and extension log

### 23.1 Open issues at v1.0

| ID | Issue | Owner | Next action |
| --- | --- | --- | --- |
| O-01 | Agency spreadsheet not yet supplied. | Ashwin/C | Import, classify portals, confirm target universe and actual source yield. |
| O-02 | *Closed in v1.1:* Calendly is no longer used; the handoff is agency contact info. | — | — |
| O-03 | Deployment, map provider, and embedding provider not selected. Auth is username/password (D-20). | A/B/C | Choose once at kickoff and record environment variable names. |
| O-04 | Source coverage target not verified against live inventory. | C | Record actual checked agencies, open records, location precision, and limitations. |
| O-05 | P1 natural-language search and comparison were proposed, not expressly confirmed. | Ashwin | Implement only after core scope; no need to delay P0. |
| O-06 | Exact code taxonomy and ranking thresholds not yet evaluated. | B | Choose source-compatible categories, version rules, and validate representative cases. |
| O-07 | Working name and final brand are provisional. | Ashwin | Use consistent temporary identity; rename without changing scope. |

### 23.2 Required format for amendments

Append an entry containing: date/time, author, affected requirement IDs, decision, reason, compatibility impact, required owner notifications, and acceptance evidence. Keep rejected approaches out of the main requirement text unless they explain a necessary constraint.

### 23.3 Change log

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-25 | Initial detailed SRS and three-workstream handoff based on product discussion. Unanswered implementation choices are marked as defaults; agency coverage and Calendly remain pending. |
| 1.1 | 2026-10-25 | Team decisions after comparison with the client PRD: agency contact handoff replaces Calendly; accounts required; user record with text summary and embedding; Washington only; ahead-of-time collection; four fit labels kept; workstreams renamed. |

#### Amendment 1.1

- **Date/author:** 2026-10-25, Dhruv (team decision).
- **Affected IDs:** D-02, D-10, D-15, D-18 to D-21 (new), A-03 (removed), A-06, Section 2.3, Section 3, J-01 to J-04, Section 6, SRC-16, MAP-01, DET-08, DET-10, ONB-01, ONB-13 (new), Section 11.2, Sections 12.2, 12.8, 12.11 (new), Sections 13.1 and 13.6, ACC-01 to ACC-06 (rewritten), ACC-07 and CTA-01 to CTA-06 (removed), CON-01 to CON-04 (new), Section 15.3, AT-01, AT-19, AT-22, AT-26 (new), Sections 17 to 21, O-02, O-03.
- **Decision:** (1) The handoff is the issuing agency's name, website, email, and phone; no Calendly. (2) An account is required for all use. (3) The user record stores username, password hash, text summary, and vector embedding. (4) Washington only. (5) Opportunities are collected ahead of time. (6) The four fit labels stay. (7) Three one-person workstreams: Frontend, Data collection & storage, Embeddings & matching.
- **Reason:** Team scoping decisions after reviewing the client PRD against this SRS.
- **Compatibility impact:** New auth routes and a User schema. All catalog and matching routes now require auth. The Agency schema gains contact fields. Anonymous session behavior is removed.
- **Owner notifications:** A (auth screens, contact panel), B (summary and embedding generation), C (user table, auth, contact data, embedding storage).
- **Acceptance evidence:** AT-01, AT-19, AT-22, AT-26.

### 23.4 Implementation status template

Each owner should add a short status entry here or in the repository acceptance file:

```text
Workstream:
Owner:
Branch / commit:
Implemented requirement IDs:
Working endpoints / interfaces:
Validation performed:
Actual source coverage or evaluation results:
Known incomplete requirements:
Dependencies needed from another owner:
Contract changes proposed or accepted:
Next integration action:
```

