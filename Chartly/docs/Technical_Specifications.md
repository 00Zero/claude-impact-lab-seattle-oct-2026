# Technician Intake App — Features, Pages, and Technical Specification

## 1. Product definition

A mobile-friendly browser app that helps service businesses collect useful information before a technician visits. A contractor sends a private link through an existing customer conversation. The customer photographs the problem and answers AI-generated questions tailored to the photo and previous answers. AI analyzes the full intake and automatically updates the contractor portal with a structured service brief. AI then drafts a service estimate from the contractor's own price book. The contractor approves it before releasing it to the customer.

Customers do not install an app, register, or log in. Contractors sign in to a private business workspace.

This specification builds on Technician_App_Summary.md and recommends the remaining implementation decisions. HVAC is the suggested first trade; plumbing can follow after the first workflow works end to end. Suggested limits and defaults below are implementation choices, not validated customer requirements.

## 2. Scope and priorities

- **Launch required:** everything necessary for a usable, reliable first version of the intake product.
- **Pilot required:** operational features needed before onboarding several real businesses.
- **Later:** extensions that are useful but do not block the core product.

“Complete” means the intake product is finished. It does not require building scheduling, dispatch, invoicing, payments, or an entire field-service platform. A preliminary, contractor-approved estimate is in scope; binding quotes and invoices are not.

## 3. Users and permissions

| Role | Responsibilities and access |
| --- | --- |
| Customer | Open their scoped intake link, upload photos, answer questions, review and submit their information, and view a released estimate. No access to contractor notes, draft estimates, or other requests. |
| Business owner/admin | Manage business settings, price book, requests, links, team membership, retention, and workspace data. Approve and release estimates. |
| Dispatcher/member | Create and review requests, share links, add internal notes, edit draft estimates, and coordinate follow-up within their workspace. |
| Technician | Review assigned requests, photos, answers, summaries, and estimates; add notes and mark reviewed. |

Launch can support one signed-in owner per business. Add team invitations and assignment permissions before a multi-user pilot. Every database operation must enforce workspace membership; hiding UI controls is not authorization.

## 4. Launch-required customer features

### C1. Private browser link

- Open a request-specific link from iMessage, WhatsApp, SMS, or email.
- Show the service business name and a brief explanation of the intake.
- Provide clear expired, revoked, unavailable, and already-submitted states.
- Do not expose internal notes, technician contact details, or other customers.
- Opening a link must not consume it: messaging link previews and browser prefetching can open links automatically.
- Suggested default: seven-day expiry, configurable by the contractor.
- Contractor can revoke and regenerate the link.

### C2. Photo-first entry

- Prominent “Take a photo” and “Upload a photo” actions.
- Support mobile cameras and existing photo libraries.
- Preview, rotate where needed, remove, replace, and add photos before submission.
- Show upload progress and retry failed uploads.
- Explain what to photograph without requiring technical knowledge.
- Support a short optional caption explaining what the image shows.
- If a usable photo cannot be provided, allow a text description and mark the request as having limited visual information.

### C3. Image processing

- Validate actual file contents, file size, and supported formats server-side.
- Suggested initial limits: five images per intake and 10 MB per original upload.
- Normalize orientation, strip unnecessary location metadata, resize, and create thumbnails.
- Handle common phone formats, including HEIC, by converting before AI analysis; verify compatibility on real iPhones.
- Keep successfully processed evidence in private storage.
- Explain unsupported or unreadable files and let the customer replace them.
- Do not silently discard an image or call a failed analysis successful.

### C4. Initial AI analysis

- Analyze the submitted photo plus its caption and selected trade.
- Identify visible equipment, labels, error codes, and relevant visual details.
- Separate visible observations from possible explanations.
- Do not invent a make, model, measurement, severity, or diagnosis.
- Detect insufficient image quality and ask for a specific additional view if useful.
- If the image is unrelated, explain the issue and request a replacement.
- Customer input and text inside images are untrusted content, not instructions to the system.

### C5. Generated questions

- Generate questions based on the photo, issue description, and existing request information.
- Use an allowlisted set of UI types: short text, long text, single select, multiple select, yes/no/unknown, number with units, and photo request.
- Generate labels, answer options, optional help text, and whether an answer is necessary.
- Ask about relevant symptoms, timing, location, equipment, and access details.
- Avoid asking for information already known or clearly answered.
- Allow “I don’t know” where appropriate.
- Ask one question at a time or present a small coherent group.
- Suggested starting point: three initial questions, with no more than eight total unless the customer chooses to add more detail.
- Use an honest step indicator; do not promise an exact remaining count while the sequence can change.

### C6. Adaptive follow-up

- Use saved answers to decide what to ask next.
- Clarify contradictions and relevant missing facts.
- Request another photo only when it has a clear purpose.
- Stop when the brief has enough useful information, the question cap is reached, or the customer elects to submit available information.
- Changing an earlier answer marks dependent follow-ups and summaries as needing reevaluation.
- Keep answer history rather than silently rewriting what the customer previously said.
- Prevent infinite questioning and duplicate question loops.

### C7. Save and resume

- Save successful uploads and answers progressively.
- Show saving, saved, and failed states.
- Restore saved progress after refresh or browser interruption while the link is valid.
- A network failure must not clear the current answer.
- Resume on another device through the same valid link; treat possession of that link as access to the intake.
- Warn that forwarding the link grants access. Offer link revocation to the contractor.

### C8. Review and submit

- Display a plain-language recap of photos and customer answers.
- Let the customer correct answers, remove images, and add a final note.
- Label AI-generated wording clearly; never present an inference as something the customer said.
- Collect only missing contact/location details needed for this service request.
- Explain that the information will be processed with AI and shared with the service business.
- Require explicit final submission.
- Prevent duplicate submissions on double taps or retries.
- Show a confirmation explaining that submission is not a confirmed appointment.
- Customer edits after submission require an explicit reopen/follow-up flow.

### C9. Customer experience basics

- Responsive layouts suitable for small phones and in-app messaging browsers.
- Accessible labels, keyboard navigation, focus states, readable contrast, and clear error messages.
- Loading indicators with useful explanations during image analysis.
- Back navigation without lost progress.
- A non-AI fallback that saves available photos/answers for contractor review when analysis is unavailable.

### C10. Released estimate view

- After submission, the confirmation explains that the business may send a preliminary estimate after review.
- Once the contractor releases an estimate, the same `/i/[token]` link shows an "Estimate ready" state while the link is valid.
- Show the business name, the low–high total, customer-facing line item descriptions with their ranges, assumptions, exclusions, and the release date.
- Always show fixed wording that the estimate is preliminary and the final price is confirmed after an on-site inspection.
- Never show draft or unapproved estimates, AI reasoning, internal notes, or price-book data beyond the released lines.
- If a newer estimate is released, show only the latest one and note that it replaces an earlier version.
- Accepting, declining, or paying for an estimate is out of scope at launch.

## 5. Launch-required contractor features

### B1. Authentication and onboarding

- Sign up, sign in, sign out, email confirmation as needed, and password reset.
- Create a workspace with business name, trade, contact details, and timezone.
- Redirect incomplete accounts into onboarding.
- Protect every portal route and server operation.
- Maintain separate workspace data even if the first version has one user per business.

### B2. Create a service request

- Enter customer name, known contact details, service location, trade, and optional initial issue description.
- Do not require the contractor to re-enter information already present.
- Generate a private intake link associated with this request.
- Copy link and open the device share sheet when supported.
- Manual sharing is sufficient at launch; direct WhatsApp/SMS sending is optional.
- Let the contractor preview the customer experience without altering the live intake.

### B3. Request list

- Search by customer, address, or request reference.
- Filter by intake status and reviewed/unreviewed.
- Sort by creation, recent activity, and submission time.
- Show last updated time, customer, location, and analysis status.
- Clear empty states and a visible “New request” action.
- Paginate results.

### B4. Request detail and service brief

- Customer and service-location information.
- AI-generated problem summary.
- Reported symptoms and timeline.
- Equipment details and their source.
- Photo gallery with full-size viewing.
- Original questions and answers.
- Missing or conflicting details.
- Clearly labeled uncertain possibilities, if included.
- Intake state, AI processing state, and summary freshness.
- Internal contractor notes, kept separate from customer-visible data.
- Copy brief for sharing internally.
- Mark reviewed; archive and reopen where appropriate.
- Link expiry/revocation controls.

### B5. Automatic portal updates

- Persist photos and answers immediately after successful saves.
- Refresh the portal automatically when intake records or briefs change.
- Show “Intake in progress” and “Draft AI summary” before submission.
- Generate draft updates after coherent answer groups; always generate a final version after submission.
- Show when the summary was generated and which intake revision it reflects.
- Never let a slower, older AI response replace a newer brief.
- Keep the last valid summary visible if regeneration fails, marked as out of date.
- Do not overwrite contractor notes or approved corrections during AI regeneration.

### B6. Human review and corrections

- Let contractors record corrections or confirmed details alongside AI output.
- Preserve the original customer response and AI-generated version.
- Mark corrections with author and time.
- Display whether the brief is AI-generated, reviewed, or needs attention.
- Let the contractor request clarification by reopening the intake or generating a follow-up link.

### B7. Workspace settings

- Edit business identity, trade, contact details, timezone, link expiry, and retention preferences.
- Profile and password management.
- Revoke active intake links.
- Archive requests and delete requests with their associated photos according to the chosen policy.
- Provide a clear explanation before permanent deletion.

### B8. Price book

- Create, edit, and archive price-book items: name, customer-facing description, category (service fee, labor, repair, part), unit (each, hour, flat), and unit price low/high.
- Offer a starter template for the workspace's trade (HVAC first) that the contractor must review and price before use.
- Require at least one service-call/diagnostic fee item before estimates can be generated.
- Archiving an item does not change estimates that already use it; line items copy the price at generation time.
- Store amounts as integer minor units with a workspace currency.
- If the price book is empty, skip estimate drafting and prompt the contractor to set it up.

### B9. Estimate review and release

- Generate a draft estimate automatically after the final brief succeeds; allow manual regeneration.
- Show the draft in an Estimate tab on request detail: line items, quantity and price ranges, totals, the AI's reason and evidence references for each line, assumptions, and exclusions.
- Flag lines that need contractor pricing because no price-book item matched.
- Let the contractor add, remove, and edit lines, quantities, prices, assumptions, and exclusions. Mark edited lines and record author and time.
- Block approval while any line lacks a price.
- Approve, then release to the customer as separate explicit actions. Release requires an active intake link.
- Mark a draft "out of date" when a newer brief exists. Never alter an approved or released estimate; changes create a new version.
- Keep the estimate version history, and show which brief version each estimate was based on.

## 6. AI pipeline and application behavior

### Recommended processing stages

1. **Photo understanding:** extract grounded observations and information gaps.
2. **Question generation:** produce a small schema-validated set of relevant questions.
3. **Follow-up decision:** evaluate answers, update known facts, and decide whether another question is useful.
4. **Brief synthesis:** combine the current photos and all responses into a structured draft or final brief.
5. **Estimate drafting:** after a final brief, match it to the workspace's active price-book items and propose line items with quantity ranges. Runs as a durable job, like brief synthesis.

Use the Anthropic TypeScript SDK on the server. Keep prompts and schemas versioned in the repository.

### Structured AI records

Questions should include: stable question ID, prompt, type, allowed options, required flag, reason for asking, and relevant evidence references.

Briefs should include: summary, customer-reported facts, visual observations, equipment details, symptom timeline, unresolved questions, contradictions, source references, intake revision, and draft/final state.

A “source reference” points to an actual uploaded photo or saved answer. Validate those IDs against the request. Avoid invented numeric confidence scores; use explicit uncertainty and missing-information fields.

Estimate drafts should include, for each line: a price-book item ID or "unmatched" with a description, a low/high quantity, the reason, and brief evidence references. The draft also includes assumptions, exclusions, and the source brief version.

The model receives the price-book item IDs, names, descriptions, and units, but **not prices**, and it never outputs monetary amounts. Server code validates that every item ID belongs to the workspace and is active, that quantities are positive and within bounds, and that evidence references exist. It then copies unit prices from the price book and calculates line and total ranges. Unmatched lines are left unpriced for the contractor.

### Reliability requirements

- Validate AI output using a strict schema and server-side business checks.
- Use structured outputs on a supported Claude model; retain semantic validation because valid JSON can still contain incorrect claims.
- Bound retries and show actionable recovery if calls fail.
- Persist processing jobs so a closed browser does not lose final synthesis.
- Enforce per-link, per-workspace, and global upload/AI budgets.
- Record model ID, prompt version, latency, token usage, and success/failure.
- Avoid logging raw photos, complete customer conversations, or private links in general analytics.
- Test model changes against a small representative evaluation set before switching production.
- Never allow the model to choose a workspace, authorize access, or issue arbitrary database updates. Server code maps validated output to the already-authorized request.
- Surface potentially urgent reported conditions for human review without promising reliable emergency detection or giving hazardous repair instructions.
- AI never sets prices or releases an estimate. Only an authorized contractor action can make an estimate visible to a customer.

## 7. Necessary pages and their functions

Customer intake should feel like one continuous wizard. The stages below can share one route; they do not need separate navigation pages.

| Page / route | User | Function | Priority |
| --- | --- | --- | --- |
| / | Visitor | Brief product explanation and contractor sign-in/start action. | Pilot; minimal at launch |
| /login | Contractor | Sign in and navigate to their workspace. | Launch |
| /signup | Owner | Create the contractor account. | Launch unless pilot accounts are provisioned |
| /forgot-password and /reset-password | Contractor | Recover account access when using password auth. | Launch with password auth |
| /onboarding | Owner | Create business workspace and select initial trade. | Launch |
| /app/requests | Contractor | Main portal: request list, filters, counts, search, and new-request action. | Launch |
| /app/requests/new | Contractor | Enter known customer/job information and create the intake link. Can be a modal. | Launch |
| /app/requests/[id] | Contractor | Service brief, live updates, photos, answers, notes, corrections, links, status actions, and an Estimate tab to review, edit, approve, and release. | Launch |
| /app/settings/business | Owner | Business profile, trade, contact information, currency, expiry and retention settings. | Launch |
| /app/settings/price-book | Owner | Create, edit, and archive price-book items; start from a trade template. | Launch |
| /app/settings/profile | Contractor | Personal profile, auth settings, and sign-out. | Launch |
| /app/settings/team | Owner | Invite members, manage roles, remove access. | Pilot |
| /i/[token] | Customer | Validate link and enter the photo-first intake wizard. | Launch |
| Intake stage: photo | Customer | Take/upload images and optional description. | Launch |
| Intake stage: questions | Customer | Answer AI-generated questions and adaptive follow-ups. | Launch |
| Intake stage: review | Customer | Review and correct answers/photos before submitting. | Launch |
| Intake stage: confirmation | Customer | Confirm receipt and explain next steps. | Launch |
| Intake stage: estimate | Customer | View the contractor-released preliminary estimate. | Launch |
| Intake unavailable state | Customer | Explain expired/revoked link and how to contact the business. | Launch |
| /privacy | Anyone | Explain data collection, AI processing, retention, and contact route. | Launch |
| /terms | Anyone | Describe service terms and intake limitations using reviewed business wording. | Pilot |
| /app/usage | Owner | Intake counts, AI usage, limits, and costs. May initially live in settings. | Pilot |
| /app/settings/billing | Owner | Subscription and payment management if self-serve paid plans are introduced. | Later |

The confirmation, estimate, and unavailable states can render inside /i/[token]. Photos and Q&A can be tabs within request detail. A separate dashboard, customer directory, notification inbox, or AI chat page is not necessary to finish the first version.

## 8. Recommended technology stack

| Layer | Recommendation | Reason |
| --- | --- | --- |
| Language | TypeScript throughout | Shared types for forms, AI schemas, and API responses. |
| App | Next.js App Router + React | One codebase for customer intake, contractor portal, and server endpoints. |
| UI | Tailwind CSS + shadcn/ui | Consistent accessible UI primitives with custom styling. |
| Forms and validation | React Hook Form + Zod | Dynamic question rendering and server/client validation. |
| Database | Supabase Postgres | Relational requests, answers, memberships, and versioned briefs. |
| Contractor auth | Supabase Auth + @supabase/ssr | Cookie-based server/client session integration. |
| Photo storage | Private Supabase Storage buckets | Scoped uploads and temporary authorized reads. |
| Portal updates | Supabase Realtime with authenticated, authorized subscriptions | Reflect saved answers and new briefs; refetch on reconnect. |
| AI | Anthropic API through @anthropic-ai/sdk | Image understanding, adaptive questions, and structured synthesis. |
| AI model | Start with a current Claude Sonnet model supporting vision and structured outputs | Evaluate quality, latency, and cost before pinning the exact model ID. |
| Image normalization | Sharp in a Node runtime; verify HEIC support or use a compatible conversion component | Resize, orientation correction, metadata removal, and thumbnails. |
| Background processing | Durable job runner such as Inngest or Trigger.dev, backed by stored job records | Retries and final brief generation independent of browser/request lifetime. |
| Deployment | Vercel for Next.js; hosted Supabase | Straightforward initial deployment, subject to selected plan/runtime limits. |
| Testing | Vitest + Playwright | Test data boundaries, dynamic intake, upload failures, and complete flows. |
| Observability | Structured application logs; Sentry optional | Detect failed jobs and frontend errors without logging unnecessary customer data. |
| Rate limiting | Server-side limiter; add a shared store such as Upstash Redis if needed | Consistent limits across application instances. |
| Email | Supabase Auth email setup; transactional provider if needed for invites/alerts | Account access first; customer intake can launch with manual link sharing. |

Use a supported stable Next.js version and pin dependencies in the lockfile. Do not add a separate Python backend, vector database, LangChain, or agent framework unless a concrete need emerges. The app does not initially need retrieval over manuals.

### Anthropic key handling

- Store ANTHROPIC_API_KEY only in server-side environment variables.
- Never use a NEXT_PUBLIC_ prefix for the Anthropic key or a Supabase secret/service-role key.
- Call Claude only through authenticated or token-authorized server endpoints/jobs.
- Set an ANTHROPIC_MODEL variable to a tested exact model identifier available to the account.
- Customers and contractors do not need to provide their own API keys in the initial product.
- Keep local .env files out of version control; use deployment-managed secrets in production.

## 9. Architecture

Customer browser → Next.js intake endpoints → scoped request/session validation → Supabase database/private storage.

AI work: authorized server endpoint → persisted job → Claude → schema and evidence validation → transactional brief/question update.

Contractor browser → Supabase Auth → authorized portal reads → Realtime notification → refetch the latest request.

Important distinction: Realtime distributes saved changes. Claude produces content. Server code validates and commits that content. The model does not directly “edit the portal.”

Use Node runtime handlers for image processing and SDK calls where required. Do not depend on in-memory queues, an unawaited promise after returning an HTTP response, or a particular hosting provider's execution timeout.

## 10. Recommended data model

| Table | Main responsibility |
| --- | --- |
| organizations | Business profile, trade, settings. |
| organization_members | User-to-workspace membership and role. |
| profiles | Contractor user display information. |
| service_requests | Workspace, customer details, location, assigned member, lifecycle, current intake revision. |
| intake_links | Request, hash of random access token, expiry, revocation, permissions. |
| intake_sessions | Scoped customer session, progress, last activity, submission state. |
| photos | Request, storage path, type, processing state, caption, upload revision. |
| intake_questions | Request/session, prompt, type, choices, order, generation version, dependencies. |
| intake_answers | Question, value, answer revision, timestamps. |
| ai_briefs | Immutable draft/final versions, structured fields, source references, input revision, model/prompt version. |
| price_book_items | Workspace, name, customer-facing description, category, unit, unit price low/high (minor units), active flag. |
| estimates | Request, version, source brief, status, total low/high, assumptions, exclusions, approved/released by and at, model/prompt version. |
| estimate_line_items | Estimate, price-book item (nullable), description, quantity low/high, unit price low/high copied at generation, AI reason, evidence references, contractor-edited flag. |
| contractor_notes | Internal notes and separately stored corrections. |
| processing_jobs | Job type, input revision, status, attempts, error code, idempotency key. |
| request_events | Timeline of link creation, saves, submission, analysis, estimate drafting/approval/release, review, and reopening. |
| ai_usage | Model, tokens, latency, workspace, request, and processing outcome. |

A separate customers table is optional later; request-level contact information is enough initially. Store files in Storage and paths/metadata in Postgres.

Every business record needs an organization boundary. Use foreign keys and constraints to prevent cross-workspace references. Versioned records should keep the source intake revision so stale jobs can be rejected.

## 11. Status model

Keep four independent state categories:

- **Intake:** draft → shared → in progress → submitted. Reopening creates a new editable revision.
- **AI processing:** pending → running → succeeded or failed.
- **Contractor review:** unreviewed → reviewed → archived.
- **Estimate:** draft → approved → released, with superseded for replaced versions; a draft can also be marked out of date.

Do not equate “customer submitted” with “AI summary finished,” “contractor reviewed,” or “appointment scheduled.” Do not equate “estimate released” with a quote, an accepted price, or a scheduled job.

## 12. Access and data requirements

- Generate cryptographically random high-entropy link tokens; store hashes rather than usable tokens.
- Exchange the link for a narrowly scoped, short-lived HttpOnly intake session and redirect to a token-free URL where practical.
- Redact access links from logs, avoid third-party analytics on intake routes, and set a restrictive referrer policy.
- Validate link/session expiry, revocation, request state, and scope on every mutation.
- Anonymous customers should not receive broad database privileges. Mediate access through scoped server endpoints.
- Privileged Supabase clients bypass normal protections: authorize every operation before using them.
- Enable and test RLS for organization-scoped tables and private storage access.
- Authorize the specific object path before issuing upload/read URLs.
- Restrict uploads by file type, content, size, count, and request budget.
- Use short-lived image URLs and avoid persisting signed URLs as permanent identifiers.
- Guard mutations against cross-site requests; apply rate limits and validate payloads.
- Delete database records and associated storage objects consistently; retry partial cleanup.
- Disclose AI processing and select a concrete retention period before a real pilot.
- Customer endpoints return only the latest released estimate, built from a customer-visible projection. Drafts, AI reasons, and price-book records are never exposed.

These controls support the no-login customer experience without making customer photos publicly accessible.

## 13. Suggested server operations

- Create request and intake link.
- Exchange/validate link; fetch only customer-visible intake data.
- Authorize photo upload; finalize and validate upload.
- Save or revise an answer.
- Generate initial questions; evaluate follow-up requirements.
- Fetch intake processing state.
- Submit intake exactly once per revision.
- Generate/retry a service brief.
- Manage price-book items.
- Generate/retry a draft estimate; edit estimate lines; approve; release.
- Fetch the released estimate for a valid intake link.
- Fetch/filter authorized requests.
- Add internal note or contractor correction.
- Mark reviewed, reopen, archive, delete, revoke, or regenerate link.
- Receive authorized background job callbacks.

Treat duplicate calls as normal. Use idempotency keys and transactions for submission and AI job scheduling. Never accept organization_id, ownership, or object paths from a client without server validation.

## 14. Pilot-required additions

- Team invitations, membership management, assignment and access tests.
- Email or in-app indication when an intake is submitted or needs review.
- Usage dashboard, workspace quotas, and administrator recovery for failed jobs.
- Retention cleanup jobs and data export/deletion procedures.
- Monitoring and alerts for failed final briefs, upload errors, and rising AI costs.
- Representative AI evaluation examples: unclear image, wrong image, conflicting answers, limited information, edited answers, and relevant safety symptoms.
- Estimate evaluation examples: well-matched price book, sparse price book, no matching items, and ambiguous briefs. Compare drafts with the contractors' final approved versions.
- Notification to the contractor when a draft estimate is ready for review.
- Cross-browser testing on iOS Safari, Android Chrome, and messaging in-app browsers.
- Reviewed privacy/terms wording and a customer support route.
- Backup/restore procedure and tested database migrations.

## 15. Later features

- Automated SMS/WhatsApp/email delivery and reminders.
- Customer directory and prior service history.
- Scheduling, dispatch, calendar integrations, and technician availability.
- Customer estimate acceptance/decline, binding quotes, invoicing, payments, and subscriptions.
- Automated estimate-ready notifications to customers.
- CRM/field-service software integrations.
- Voice notes and transcription.
- Multilingual intake with language-matched questions.
- Trade-specific templates and equipment manual retrieval.
- PDF brief export, advanced analytics, and technician feedback loops.

These should follow demonstrated demand. None is necessary to prove the core photo-to-brief workflow.

## 16. Suggested build order

1. Establish Next.js, Supabase migrations, auth, organization boundaries, and private storage.
2. Build request creation, scoped links, and the customer photo upload experience.
3. Integrate Claude image analysis and schema-validated question generation.
4. Build dynamic question UI, autosave, follow-ups, revision handling, and submission.
5. Build durable brief generation, request detail, and automatic portal refresh.
6. Build the price book, estimate drafting, the contractor Estimate tab with approve/release, and the customer estimate view.
7. Add human corrections, link management, review states, failure recovery, and deletion.
8. Verify access isolation, mobile behavior, end-to-end scenarios, AI usefulness, estimate accuracy, and operating limits.
9. Add pilot team and monitoring features before onboarding multiple businesses.

## 17. Definition of done

- A contractor can sign in, create a request, and share its link.
- A customer can complete intake on a phone without an account or download.
- The first interaction supports taking/uploading a photo.
- Different photos and answers produce relevant different questions.
- Refreshing or losing connectivity does not discard saved progress.
- The customer can review, correct, and submit.
- AI analyzes the full current intake and produces an evidence-linked brief.
- The correct contractor portal updates automatically.
- Raw evidence stays accessible to the authorized contractor.
- A draft estimate is generated from the price book with server-calculated totals; the AI never outputs prices.
- The contractor can edit, approve, and release the estimate, and the customer sees only the released version.
- An unapproved estimate is never visible to the customer.
- Old jobs cannot overwrite newer information or contractor corrections.
- Failed AI calls preserve intake and expose retry/manual-review paths.
- Expired/revoked links and cross-workspace attempts are rejected.
- Private files and API secrets are not exposed.
- Usage is measured and bounded.
- A complete end-to-end flow passes on desktop and mobile.
- No page claims a diagnosis, appointment, or completed repair merely because intake is submitted, and no estimate is presented as a final price.

## 18. Official implementation references

These sources support the platform capabilities described above; the product scope and architecture are recommendations for this application.

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase private storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase database change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude model overview](https://platform.claude.com/docs/en/models/overview)
