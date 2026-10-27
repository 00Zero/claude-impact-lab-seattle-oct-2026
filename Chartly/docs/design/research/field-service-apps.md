# Field-service & home-services app UX — teardown for OneTrip (2026-10-25)

Legend: **[V]** ⚠️ = vendor claim/marketing · **[R]** = user review (anecdotal) · **[O]** = observed directly (Playwright screenshot of live site, 2026-10-25) · unmarked = vendor help-center documentation (describes the product, not its quality).
Gaps: no first-hand access to the logged-in apps; Lazyweb's screenshot library has no Jobber/Housecall Pro/Thumbtack/Angi/ServiceTitan screens (checked); Yelp/Angi homeowner-flow docs aren't public. Visual notes come from marketing sites, not in-app UI.

---

## 1. Per product

### Jobber (app + Client Hub + request forms)
- **Nav model:** bottom tabs. Older doc lists Home · Schedule · Timesheet · Search · Messages; a May 2024 update added a **More** tab and moved messages into Home, with higher contrast ([help](https://help.getjobber.com/en/articles/jobber-app-basics/), [product update](https://productupdates.getjobber.com/51900-new-and-improved-navigation-on-the-mobile-app), via search snippet; page 403'd).
- **Home = today:** map centered on the first appointment, with pins; **"Up Next"** list sorted by start time ("anytime" items last). Each card shows tracked time, scheduled time, title, client name, **status**. Admins also get a **To Do** list (new requests, completed assessments, approved quotes, overdue invoices; urgent items pinned to the top), plus Business Health (week job value and visit count with trend arrows) ([help](https://help.getjobber.com/en/articles/home-in-the-jobber-app/)).
- **Schedule:** day, week, list, and 3-day views ([help](https://help.getjobber.com/en/articles/jobber-app-basics/)).
- **Requests (closest analog to OneTrip intake):** a client-facing form shared as a link, embedded on a site, or via Google Business Profile. It collects contact info, job details, measurements, yes/no answers, dates, and **up to 10 photos** (JPEG/PNG/HEIC, under 10 MB each). The form is either one section per page **with a progress bar** or a single page. The client reviews answers and gets an email copy. Each submission becomes a **Request** plus a client record marked "lead". Statuses: New, Unscheduled, Overdue, Assessment Completed, Converted, Archived. From the request you convert it to a quote or job, or book an on-site "assessment" visit ([help](https://help.getjobber.com/en/articles/request-basics/), [share link](https://help.getjobber.com/es/articles/requests-and-bookings-settings/)). *No AI analysis of the photos. The contractor reads raw answers.*
- **Client Hub:** a **passwordless** portal reached by a secure email link. Clients approve quotes (with a signature), request changes, pay deposits or invoices, confirm appointments, and submit new requests ([help](https://help.getjobber.com/en/articles/what-do-your-clients-see-in-client-hub/)).
- **Visual [O]:** dark navy/teal background, **lime-green** primary CTA, heavy geometric sans headlines, real tradespeople photos with name and business captions, and App Store 4.8 (13.8K) / Play 4.5 shown under the CTA ([getjobber.com](https://www.getjobber.com/)). In-house design system "Atlantis" (web plus React Native) ([job post](https://job-boards.greenhouse.io/jobber/jobs/7903617002)).
- **Ratings:** iOS 4.8, about 21K ratings ([App Store](https://apps.apple.com/us/app/jobber-field-service-software/id1014146758)).

### Housecall Pro
- **Nav:** the web moved its nav to a **collapsible left sidebar** with "+ Create" at the top: Customers, Jobs, Estimates, Leads, Invoices, Price book, plus grouped Communications/Money/Marketing. On mobile web this sits under a hamburger with a "+" button ([help](https://help.housecallpro.com/en/articles/14742078-navigating-housecall-pro-new-navigation-experience)). Mobile app navigation isn't documented publicly. On iOS, "More" is at the bottom right ([help](https://help.housecallpro.com/en/articles/993380-accessing-the-help-center)).
- **Job page:** a large **On My Way → Start → Finish** button row, with checklists below it ([help](https://help.housecallpro.com/en/articles/3971521-how-do-field-techs-use-checklists-on-mobile)). Tapping OMW starts travel time and **auto-texts the customer**, once per job ([help](https://help.housecallpro.com/en/articles/2795146-time-tracking-overview-guide), [notifications](https://help.housecallpro.com/en/articles/357613-customer-notifications-overview)). A pin icon next to the address opens maps ([help](https://help.housecallpro.com/en/articles/2822808-directions-to-jobs-estimates)).
- **Contacting customers:** tap the customer profile, then choose (a) SMS through HCP's business number, (b) email from the device, or (c) a call or text from your personal cell ([help](https://help.housecallpro.com/en/articles/4793277-what-are-my-options-for-communicating-with-my-customers-from-the-mobile-app)).
- **Lead intake:** a "Job Inbox" pulls Thumbtack/Yelp/Google leads into one list. Tapping "Learn More" shows the work details ([help](https://help.housecallpro.com/en/articles/6499957-job-inbox-integration-with-thumbtack), [Yelp](https://www.phcppros.com/articles/22927-housecall-pro-launches-yelp-integration-to-streamline-lead-management-for-home-service-businesses)).
- **2026:** the app was "rebuilt from the ground up". New job details, estimate, and invoice screens are framed as "whether you're in the office or on a ladder" **[V]** ([May 2026 updates](https://www.housecallpro.com/resources/may-2026-product-updates/)).
- **Visual [O]:** white header, **orange** pill CTA ("Start free trial", with an email field inline), distressed all-caps display headline over a photo of a tech holding a phone, and **floating notification cards** ("Job booked", "Payment received") as product proof. Industry tiles sit under the hero ([housecallpro.com](https://www.housecallpro.com/)).
- **Ratings:** iOS 4.6, about 31K ([App Store](https://apps.apple.com/us/app/housecall-pro-field-service/id692833651)).

### ServiceTitan (Field Mobile App, "FMA")
- **Home:** today's jobs as **cards** ([help](https://help.servicetitan.com/docs/field-mobile-app)). Phone-first native rebuild. ServiceTitan says techs used mobile "nearly twice as often" as desktop. The design goal is "less screen time, more wrench time" **[V]** ([podcast](https://www.servicetitan.com/podcasts/mastering-servicetitan/david-erickson-interview)).
- **Job details (the best-documented single-job screen):** ([help](https://help.servicetitan.com/how-to/overview-of-the-servicetitan-field-mobile-app-job-details-screen))
  - **Header:** job number, status, day/date/arrival window/duration, and 3 quick buttons: **Contact · Directions · Ask Atlas (AI)**. The header **collapses on scroll**.
  - **Top tabs:** Job · Location Info (history) · Equipment · Forms · Estimates · Invoice. On tablets these become a side menu.
  - **Job tab:** summary, special instructions, location (tap for customer/membership detail), pinned notes, tags, job media.
  - **Bottom primary action is a state machine:** **Dispatch → Arrive → Close Out** (pause / reschedule / add appointment / done). Secondary actions sit behind "+ Add" (photos, equipment, estimate, PO, notes).
- **AI roadmap [V]:** nameplate scanning, auto estimates, auto forms ([podcast](https://www.servicetitan.com/podcasts/mastering-servicetitan/david-erickson-interview)). *This is the same model/serial idea as OneTrip, but tech-side and on-site.*
- **Visual [O]:** white page, dark rounded hero card, **coral-red** CTA, blue-collar photo, customer logo strip ([servicetitan.com](https://www.servicetitan.com/)). Design system: Anvil2 ([docs](https://anvil.servicetitan.com/docs/about-anvil2)).
- **Ratings:** Field app 3.5 on about 5.4K ratings ([App Store](https://apps.apple.com/app/id1629928933)).

### Workiz
- **Mobile:** Schedule page, Message Center, Clients tab, hour logging. On a job: **ETA** ("on my way" or "running late" text), clock in, add payment, call client, update status ([help, via search](https://help.workiz.com/en/articles/4812389-managing-jobs-on-mobile); [overview](https://help.workiz.com/hc/en-us/articles/18054399598865-Workiz-mobile-app-overview); pages 403'd to fetch). The "Genius" voice assistant can send OMW/late texts ([help](https://help.workiz.com/hc/en-us/articles/37869982977041)).
- **Visual [O]:** near-black background, **yellow** pill logo and accent word ("AI growth engine"), neon-glow diagram of lead sources (Google, phone, Thumbtack, Yelp) flowing into an AI node ([workiz.com](https://www.workiz.com/)).
- Capterra 4.4 (218) ([Capterra](https://www.capterra.com/p/147525/Workiz/reviews/?page=3)).

### Thumbtack (customer request flow + Pro app)
- **Customer entry [O]:** one large free-text box, **"Describe your project or problem — be as detailed as you'd like!"**, plus ZIP and a "Find a pro" button. Under it: **"No calls or text until you message a pro."** Stats row: 4.9★ / 300K+ pros / 100M+ projects ([thumbtack.com](https://www.thumbtack.com/)).
- **Request:** customers "describe their project in their own words (or by sharing a photo in the app) and answer a few quick questions" ([help](https://help.thumbtack.com/article/how-thumbtack-works/), via search snippet; JS-rendered page). Thumbtack studied request abandonment with Sprig and found many abandoners simply weren't ready to hire yet ([Sprig](https://sprig.com/customers/thumbtack)). Pros say form changes aimed to fix "most clients were not filling in all the information" **[R]** ([community](https://community.thumbtack.com/discussion/comment/5402)).
- **Pro app:** leads under **Jobs** with "For you" and "Opportunities" tabs. Conversations are in **Messages**, and lead details (service, location, "Paid" amount) sit under the customer name in the thread ([help](https://help.thumbtack.com/article/new-pro-guide-1), via snippet). The lead object holds service type, description, location, scheduling preferences, and status ([dev docs](https://developers.thumbtack.com/docs/overview)).
- **Visual [O]:** white nav, full-bleed lifestyle photo, dark navy pill CTA, brand blue `#009FD9`.
- iOS Pro app 4.4 (~65K) ([App Store](https://apps.apple.com/us/app/thumbtack-for-professionals/id908795016)).

### Angi (Angi for Pros)
- Features: leads matched by task and location, pause/resume leads, profile and budget settings **[V]**. iOS 3.9 (~39K). The 26.02 release added an iOS 26 visual refresh ([App Store](https://apps.apple.com/us/app/angi-for-pros/id437003175)). The homeowner request-flow UI isn't publicly documented (not found).
- Trustpilot for Angi Leads: 2.3/5 on ~37K reviews, dominated by billing and lead quality ([Trustpilot](https://ca.trustpilot.com/review/homeadvisorpros.com)).

### Streem (Frontdoor) — closest flow analog
- **streem.com now 301-redirects to frontdoorhome.com** (checked 2026-10-25). Streem now appears only as Frontdoor's contractor tool.
- **Tech side:** enter the customer name, a reference/dispatch ID, and a mobile number, then press **Invite**. The customer receives a **personalized link by SMS**, with "no need to … install an app or create an account" ([Quick Start PDF, 2021](https://2qz9b4rx.media.zestyio.com/QuickStartGuide_Streem_FTDR.pdf)).
- **Customer side, 4 taps before value:** Get Started → Accept terms → Allow camera/mic → Start Streem. Supported browsers: Safari on iOS, Chrome on Android ([Frontdoor contractor guide](https://contractor.frontdoorhome.com/resources/how-to-customer-camera-and-microphone-access/)).
- **Expert tools:** a "Streemshot" full-res photo with depth and scale where "our smart algorithm extracts key details automatically" **[V]**, a marker, a laser pointer, a GPS request, notes, and a call log ([PDF](https://2qz9b4rx.media.zestyio.com/QuickStartGuide_Streem_FTDR.pdf)). The full call is recorded for review ([G2](https://www.g2.com/products/streem/reviews), via search).

### Frontdoor (consumer app)
- Answer "a few easy questions" → matched with an expert (plumbing, electrical, appliance, HVAC, handyman) → **live video chat**. If the issue can't be fixed remotely, you get a list of local pros. Prep advice includes "be at the site of the issue" ([Frontdoor blog](https://www.frontdoor.com/blog/member-benefits/the-frontdoor-app-makes-life-as-a-homeowner-easier), [prep](https://frontdoor.com/blog/ready-set-chat-5-steps-to-prep-for-your-first-video-chat)) **[V]**. The pattern is questions first, then synchronous video. OneTrip reverses this (photos first, then async).

### Yelp Request-a-Quote
- Guided **per-category questionnaires**, expanded to ~100 categories ([Adweek](https://www.adweek.com/digital/yelp-extends-its-request-a-quote-feature-into-an-end-to-end-hiring-experience/)). Pros reply from the Yelp for Business app or web.
- **Oct 2026: "Smart Lead Reply"** ($30/mo) is an AI agent that replies instantly in the thread, asks **owner-chosen questions**, qualifies the lead, sends the pro's booking link, and notifies the owner to take over. Leads flow into Jobber/Workiz "with full job details" **[V]**. Photo handling is undisclosed ([PPC Land](https://ppc.land/yelp-charges-30-a-month-for-ai-agent-that-answers-and-qualifies-leads/)).

---

## 2. Recurring patterns (industry-standard, users expect these)
1. **"Today" is home.** Jobber (map + Up Next), ServiceTitan (job cards), and HCP (schedule) all open on today's work sorted by time, not on a generic list.
2. **Job card = time · customer · title · address · status chip.** Jobber cards show exactly this. HCP reviewers complain when the **address is missing** from calendar cards ([App Store reviews](https://apps.apple.com/us/app/housecall-pro-field-service/id692833651?see-all=reviews)).
3. **One-tap Call / Text / Directions at the top of a job** (ServiceTitan header, HCP pin icon, Workiz quick actions).
4. **A single big status-advancing button** (HCP OMW→Start→Finish; ServiceTitan Dispatch→Arrive→Close Out). Secondary actions hide behind "+ Add" or "More".
5. **The status action auto-texts the customer** ("On my way" in HCP and Workiz). SMS is the channel customers actually read.
6. **Passwordless, link-based customer access** (Jobber Client Hub email link; Streem SMS link). No customer app or account is the norm.
7. **Request pipeline with status chips** (Jobber: New → Assessment → Converted/Archived; Thumbtack: For you / Opportunities).
8. **Bottom tabs on mobile** (Jobber), a **sidebar plus "+ Create"** on web (HCP), and **tabs that turn into a sidebar on tablet** (ServiceTitan).
9. **Every vendor is now AI-forward in hero copy**: HCP "Powered by AI built from 100M+ jobs", Workiz "AI growth engine", ServiceTitan "AI software for … trades", Jobber "AI built for blue collar businesses" ([O] on all four homepages).
10. **Marketing visual language:** dark hero, one loud accent CTA (lime, orange, coral, yellow), real tradespeople photos, app-store ratings and "No credit card required" next to the CTA, industry tiles (Electrical/HVAC/Plumbing).

## 3. What contractors hate (reviews)
- **Too many taps:** "Why do I have to click on ten different things just to accomplish one task?" (Jobber) **[R]** ([App Store](https://apps.apple.com/us/app/jobber-field-service-software/id1014146758)). ServiceTitan: tasks that took one click now take several, and the new layout is "disjointed" **[R]** ([App Store](https://apps.apple.com/app/id1629928933)).
- **Desktop-only gaps:** Jobber lacks some admin functions on mobile **[R]** ([GetApp](https://www.getapp.com/operations-management-software/a/jobber/)). HCP: "not all of us … have the luxury to sit and work from a desktop", and some setup needed a computer **[R]** ([App Store](https://apps.apple.com/us/app/housecall-pro-field-service/id692833651?see-all=reviews)). HCP mobile "feels more limited" than web **[R]** ([Software Finder](https://softwarefinder.com/field-service/housecall-pro/reviews?page=16)).
- **Slow photos:** HCP photo upload is slow enough that techs use the native camera and upload later **[R]** ([Software Finder](https://softwarefinder.com/field-service/housecall-pro/reviews?page=16)). Jobber is slow "loading photos or switching between jobs" **[R]** ([GetApp](https://www.getapp.com/operations-management-software/a/jobber/)). ServiceTitan photos get reordered or replaced **[R]**.
- **Info hidden one level down:** calendar entries without addresses, so you open each job (HCP). You can't open the customer profile from inside a job in Workiz **[R]** ([Software Finder](https://softwarefinder.com/field-service/workiz/reviews)). Job history for multi-location customers is hard to reach (HCP) **[R]**.
- **Small text and moving menus:** ServiceTitan text is too small for older users, menus move between updates, and content can't be copied, so it gets retyped **[R]** ([App Store](https://apps.apple.com/app/id1629928933)).
- **Surprise automations:** an HCP user didn't know automated texts were going out, and customers got wrong info **[R]** ([App Store](https://apps.apple.com/us/app/housecall-pro-field-service/id692833651?see-all=reviews)). Workiz automations fire at the wrong time **[R]** ([Capterra](https://www.capterra.com/p/147525/Workiz/reviews/?page=3)).
- **Learning curve and redesign churn:** "field crew struggled … even after repeated training" (Jobber) **[R]**. ServiceTitan users prefer the old app **[R]**.
- **Marketplaces:** paying for junk or price-shopper leads, and being charged for a lead that "no longer exists" (Thumbtack, Angi) **[R]** ([Thumbtack](https://apps.apple.com/us/app/thumbtack-for-professionals/id908795016), [Angi](https://apps.apple.com/us/app/angi-for-pros/id437003175)).

## 4. Recommendations for OneTrip

### Contractor: job list (home)
- Open on **"Needs your eyes"**: jobs where the brief is ready and unread, pinned on top as Jobber's To Do does with urgent items. Below that: **Waiting on customer** (link sent, not finished) and **Done/Archived**. Use 3 status chips at most: `Link sent` · `Brief ready` · `Reviewed`.
- Card: **customer name · address (always visible) · issue one-liner · status chip · time since update**, plus a thumbnail of the first customer photo once one exists. One card is one tap into the brief.
- If you use any nav, use a bottom bar with 2 items at most (Jobs, Settings) and a big **"+ New job"** FAB. Skip a sidebar on mobile.

### Contractor: new job
- **3 fields:** customer first name, mobile number, trade/issue type (chips: Panel · EV charger · Outlet/Switch · HVAC no-cool · Water heater …). Address and notes are optional. The goal is under 20 seconds, which answers the "ten clicks for one task" complaint directly.
- Use `type=tel` with paste and contact-picker support. Validate the number inline.

### Contractor: share link
- Primary button: **"Text link to Maria"**. On mobile it opens the native SMS composer (`sms:` URI) with a prefilled message, so the text comes **from the contractor's own number** (HCP's cell-network option; higher trust than an unknown short code). Secondary: Copy link, plus a QR code for in-person handoff.
- Show the **exact message preview** before sending, to avoid HCP's surprise-automation complaint. Suggested copy: "Hi Maria, it's Dave from Bright Electric. To bring the right parts on the first trip, can you snap 4 quick photos here? Takes ~1 min, no app: {link}".
- Customer side (lessons from Streem): **zero walls before the camera**. No account, no terms page in front, and ask for the camera permission only at the first photo step. Use file-input capture so it doesn't depend on live camera/mic permission. Brand the page with the contractor's name, logo, and photo, not OneTrip.
- After sending, the card shows `Link sent · 2m ago` with a "Resend / remind" action. Notify the contractor (push or SMS) when the brief is ready.

### Contractor: tech brief (one screen, ServiceTitan job-header pattern)
- **Sticky header:** customer · address · **Call · Text · Directions** buttons, collapsing on scroll.
- **Above the fold, in order:**
  1. **Verdict line:** likely cause plus a **confidence chip** (High/Med/Low as word + icon, never a %; Low = grey, not red, per CLAUDE.md rule 4) and a 1-sentence reason tied to a photo ("Breaker label shows 40A on 6 AWG — photo 3").
  2. **Equipment:** make/model/serial as copyable text (ServiceTitan users hate retyping), with a link to the source nameplate photo.
  3. **Bring list:** checkboxes for parts and tools. Checking them off is the "loading the truck" moment.
  4. **Price range** computed from the contractor's own rates, labeled "estimate from your rates".
- **Below:** a horizontal **photo strip** (tap for full screen, pinch zoom, AI callouts toggle) and **customer answers** as Q→A pairs, collapsed by default.
- **One primary bottom button** that advances state, as HCP and ServiceTitan do: `Mark reviewed` → later `Schedule visit`. Everything else goes behind "⋯". Use body text of 16px or more with high contrast, because older techs complain about small text.
- Show uncertainty honestly. When confidence is low, list a **"Verify on site"** line and the photo the AI couldn't read, with a "Ask for another photo" button that re-texts the customer.

### Visual style
- **Dense but big-touch:** cards 72–88px tall, 44px+ targets, system font or one geometric sans, one accent color. **Safety orange or high-vis yellow on charcoal/white** reads as "trade" and doesn't collide with Jobber lime, HCP orange-on-white, ServiceTitan coral, Workiz yellow-on-black, or Thumbtack blue. (Picking orange collides somewhat with HCP. A high-vis yellow-green or electric blue on charcoal is the clearer lane.)
- Status colors: gray = waiting, accent = brief ready, green = reviewed (keep red for safety/emergency only; never for low AI confidence). Make it light-mode first, since it's used outdoors in sun.

### Marketing landing page
- **Hero:** outcome headline about the trip, not "AI". Everyone else leads with AI, so differentiate: e.g. **"Know what's broken before you roll the truck."** Subhead: "Text your customer a link. They snap 4 photos. You get model/serial, likely cause, and a parts list — before the first visit."
- **Hero visual:** a phone pair (customer photo capture → contractor brief), or a brief card floating over a photo of an open panel. This borrows HCP's floating-notification proof style but shows *the brief*.
- **CTA:** a single "Try it — text yourself a demo link" field (phone number). This beats "Start free trial" because the product *is* a text link. Add a "No app for you or your customer" reassurance line under it (Thumbtack's "No calls or text until…" pattern).
- **3-step strip:** Add job (10 sec) → Customer snaps photos (60 sec) → You get the brief. Follow it with a **real sample brief** (Tesla charger / panel story from ONETRIP.md).
- **Cost of a second trip** as the stat row (cite exactly as vendor estimates ⚠️: "$120 per repeat visit", "$200–300 per callback (plumbing)", "$200–400 (electrical)", "70–72% average first-time fix", per ONETRIP.md sources). Don't fabricate user counts. Industry tiles: Electrical · HVAC · Plumbing.
- Position against suites: "Works alongside Jobber/Housecall Pro — no platform switch."
