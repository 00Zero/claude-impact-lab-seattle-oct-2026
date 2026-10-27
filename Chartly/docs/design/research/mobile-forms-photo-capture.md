# OneTrip customer flow: mobile forms and photo capture research (2026-10-25)

Scope: homeowner opens an SMS link on a phone browser, takes 1–3 guided photos, answers 3–5 AI questions, submits. No app, no login. Target is about 90 seconds. Users may be stressed, older, non-technical, or outdoors.
Legend: ✅ primary source read · ⚠️ secondary source or community report; verify on a real device

---

## 1. Form structure

**One thing per page wins for this flow.**
- ✅ GOV.UK: "Start by splitting the form across multiple pages with each page containing just one thing." Stated benefits are that users understand the question, can focus, can use the form on mobile, and can recover from errors. Teams get autosave, per-question analytics, and branching. https://www.gov.uk/service-manual/design/form-structure
- ✅ GOV.UK question pages: the question is the `<h1>`, and it is also the `<label>`/`<legend>`, so screen readers announce it once. Put a Back link at the top, never break the browser back button, and label the button "Continue", not "Next". Allow "I do not know" answers where they are valid. Use "(optional)" rather than asterisks. Keep hints to one short sentence. Explain why you are asking. https://design-system.service.gov.uk/patterns/question-pages/
- ✅ GOV.UK question protocol: every question needs a reason, a use, and an owner. This is how you trim 5 questions down to 3. https://www.gov.uk/service-manual/design/form-structure
- ⚠️ GOV.UK research: one question per page beat accordions and other complex structures. Users rarely looked at progress indicators, and removing one from a long form did not change completion. https://userresearch.blog.gov.uk/2015/08/13/no-more-accordions-how-to-choose-a-form-structure/
- Typeform and Tally use one question at a time with auto-advance on single-choice answers. That fits OneTrip's AI-generated questions, because each answer can shape the next question.

**Progress indicators**
- ✅ GOV.UK does not recommend them by default. Test without one first. If you add one, keep it simple ("Question 2 of 4"). Avoid indicators that list every step. https://design-system.service.gov.uk/patterns/question-pages/
- For OneTrip, still show the total effort up front ("3 photos, 4 quick questions, about 2 minutes"). The AI question count varies, so show "Question 2 of 4" only once the count is fixed. Never show a count that later grows.

**Skip and "not sure"**
- ✅ GOV.UK allows "I do not know" where it is a valid answer. A homeowner often cannot answer technical questions like "Is it a heat pump?" Every AI question should offer **"Not sure"** as a real answer. That answer still tells the tech something useful.
- Photos should have a "Can't get this photo" option, such as "Label is behind the unit" or "I'm not home". This is better than a dead end.

**Buttons vs radios**
- Show 2–5 choices as full-width tappable rows or cards: the whole row is the target, the choices are stacked vertically, and the label text is visible. Do not use dropdowns for 5 or fewer options. For a single choice, auto-advance on tap, but keep Back so users can fix a mis-tap. Multi-select needs an explicit Continue.
- ✅ GOV.UK radios have large clickable label areas. Use `<fieldset>`/`<legend>` for each group. https://design-system.service.gov.uk/components/radios/
- ⚠️ Baymard: the touch keyboard covers about 50% of the screen in portrait mode. 54% of mobile sites did not trigger the right keyboard, and autocorrect and autocapitalize were often set wrong. Put labels above fields. Avoid free text. When you need it, use `inputmode`, `autocomplete`, and `autocapitalize="sentences"`. https://baymard.com/blog/mobile-touch-keyboards · https://baymard.com/research-articles/mobile-forms-avoid-inline-labels
- ⚠️ Luke Wroblewski: labels go above fields on mobile because they stay visible when the keyboard opens. Placeholder text is not a label. https://www.lukew.com/mobilefirst/08-chapter-6/index.html

**Thumb zone and target size**
- ⚠️ Hoober (2013, n=1,333): about 49% of people hold the phone in one hand, about 36% cradle it, and about 15% use two hands. The bottom-center of the screen is the easiest area to reach. Put the primary CTA in a sticky bottom bar with `padding-bottom: env(safe-area-inset-bottom)`. https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/
- Note the conflict: GOV.UK left-aligns Continue so it is not missed on wide desktop layouts. On a phone, a full-width bottom button resolves that conflict.
- ✅ WCAG 2.2 SC 2.5.8 (AA) requires targets of at least 24×24 CSS px. SC 2.5.5 (AAA) asks for 44×44. https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- ⚠️ Apple HIG asks for 44×44 pt and Material for 48×48 dp, with 8 px spacing. **Use 48 px minimum; 56 px for the primary CTA.** https://developer.apple.com/design/human-interface-guidelines/accessibility · https://m3.material.io/foundations/designing/structure

---

## 2. Photo capture on the mobile web

**`<input type="file" accept="image/*" capture="environment">`**
- ✅ MDN: `capture` accepts `user` or `environment`. It only takes effect when `accept` lists image, video, or audio types. It is "not Baseline". Desktop browsers show a normal file picker. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
- ⚠️ Support goes back to Chrome Android 25 and iOS Safari 10. With `capture`, both platforms usually open the rear camera directly and **skip the gallery**. Without `capture`, iOS shows a sheet with Photo Library, Take Photo, and Choose File. Android shows its photo picker, sometimes with a camera option. One report says an Android device opened the camera in video mode. https://addpipe.com/docs/mobile-recording-client/forcing-users-record/ · https://skeptric.com/html-mobile-camera
- **Permissions:** a file input hands off to the OS camera UI. There is **no browser camera permission prompt**, because the user's tap is the consent. `getUserMedia` does trigger a prompt and needs HTTPS. Its advantage is a live overlay inside the page. Its costs are a scary "Allow camera?" prompt, a dead end if the user denies it, and iOS quirks. For a hackathon, use the file input.
- Recommended pattern: a primary **"Take photo"** button (`capture="environment"`) and a secondary **"Choose from my photos"** link (no `capture`). Many people already photographed the broken unit before the contractor texted.

**HEIC and formats**
- ✅ WebKit bug 292350 confirms that Safari transcodes HEIC to the **first type in `accept`**. The file chooser path already did this. Drag-and-drop was aligned in a fix committed Feb 2026. Use `accept="image/jpeg,image/png,image/*"` with JPEG first so iOS hands you a JPEG. https://bugs.webkit.org/show_bug.cgi?id=292350
- ⚠️ Including `image/heic` in `accept` on Safari 17+ caused JPEGs to be renamed `.heic`. Do not list it. https://developer.apple.com/forums/thread/743049
- Still sniff the type on the server and convert HEIC there, because files picked from the library can bypass the rule.

**File size and compression**
- Phone photos run 3–12 MB at 12–48 MP. Before upload, downscale on the client to a **2048 px long edge** and JPEG quality about 0.85. That gives roughly 300–600 KB. A model or serial label stays readable at this size. Do not go below about 1600 px for labels.
- ⚠️ iOS Safari canvas cap: about 16.7 M pixels in total area. Larger canvases fail silently. Use `createImageBitmap(file, {resizeWidth})` or a staged downscale. Never draw a full 48 MP image onto a canvas. https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ · https://bugs.webkit.org/show_bug.cgi?id=202458
- Modern browsers apply EXIF orientation by default (`image-orientation: from-image`). If the server re-encodes images, strip GPS EXIF for privacy.

**Bad connections**
- Start the upload **as soon as the user takes the photo**, in the background, while they move on to the next photo. Show progress per thumbnail with these states: uploading, done (✓), and failed ("Tap to retry").
- Retry with backoff. Keep the blob in memory or IndexedDB so a dropped connection never means retaking the photo. Do not block Continue on an upload unless it is the final submit.
- Use a single, small, idempotent upload per photo, with a client-generated ID so retries do not create duplicates. Show "Saved. You can close this and come back" if the link supports resuming.

**Example photo and guidance**
- For each photo step, show a **reference image** of a good shot ("Like this") plus one line telling the user where to find the subject. Example: "The label is usually on the side panel of the outdoor unit." Label locations vary by appliance, so tailor the image to the job type the contractor picked.
- Keep the copy to one sentence per step: what to capture, where to find it, and how close to get ("Fill the screen with the sticker").
- Insurance apps follow the same pattern:
  - ⚠️ Lemonade's in-app claims flow includes a "guided photo collection process" with a fixed shot list (360° view, odometer, scene). https://www.lemonade.com/car/explained/taking-pictures-for-car-insurance/
  - ⚠️ Tractable's policyholder app is sent at first notice of loss and uses "AI guidance" to direct phone photos. https://www.duckcreek.com/?p=3668 · https://tractable.ai/en/resources/kirmac-collision-using-tractable-to-digitally-engage-customers
  - ⚠️ Hover requires photos to be taken in its app, which guides the shot sequence. https://help.hover.to/en/articles/411989-can-i-submit-photos-outside-of-the-app
  - ⚠️ Record360 places shot prompts as overlays on the camera screen. https://intercom.help/record360-usa/en/articles/9742139-photo-overlays
  - Common thread across all four: a fixed, short shot list; one shot per step; a sample image; and validation before the user moves on.

**Instant quality feedback and retakes**
- Run these checks in two tiers:
  - **Client tier, under 100 ms.** Blur: variance of the Laplacian on a grayscale image downscaled to about 512 px. The threshold depends on your images, so calibrate it. ⚠️ https://pyimagesearch.com/2015/09/07/blur-detection-with-opencv/ · ⚠️ a canvas Sobel edge-width variant: https://medium.com/revolut/canvas-based-javascript-blur-detection-b92ab1075acf. Darkness: mean luminance below a threshold. Glare: share of clipped pixels above a threshold.
  - **Server or vision-model tier, 1–4 s.** "Can I read a model/serial number?" If the model returns the string, show it back to the user ("We read: Model 4TTR4036L1000A ✓"). That proves the photo worked and builds trust.
- Failure copy should be specific and kind, and should offer a fix plus a way out. Example: "This one's a bit blurry. Hold steady and tap the label to focus." Buttons: **Retake** (primary) and **Use anyway** (secondary). Never hard-block, because a blurry photo still beats no photo.
- Show a thumbnail confirmation after every capture, with Retake available.

---

## 3. Trust from an SMS link

- ⚠️ FTC smishing red flags: impersonating a known company, inventing urgency or a problem, asking for passwords, account numbers, or SSNs, and links to "update payment". Users are trained to verify through a channel they already know. https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams
- ⚠️ CTIA: identify the brand or program in messages and honor STOP/HELP. https://www.ctia.org/the-wireless-industry/industry-commitments/messaging-interoperability-sms-mms (summary: https://mobile-text-alerts.com/articles/ctia-messaging-principles-that-matter-most-for-promotional-sms)

**The SMS**
- Name the contractor, not OneTrip, and refer to context the homeowner already has. Example: "Hi Dana, it's Mike from Cool Air HVAC about your AC appointment Thu. To help us bring the right parts, snap 2 photos (≈2 min): onetrip.app/j/7Kq2 Reply STOP to opt out."
- Do not use urgency wording, money wording, or public link shorteners like bit.ly, which phishing uses heavily. Use one consistent branded domain.

**First screen, read in about 5 seconds**
1. The contractor's logo or name and the tech's first name and photo, if available. "Mike from Cool Air HVAC sent you this."
2. Why: "So Mike can bring the right parts and fix it in one visit."
3. Effort: "2 photos + 3 quick questions · about 2 minutes."
4. The job, using context only a real contractor would have: "AC not cooling · 123 Oak St · Thu 2–4pm". This is the strongest anti-phishing signal.
5. Privacy in one line: "Photos go only to Cool Air HVAC. No account, no payment." Link to details.
6. A single primary CTA: "Start" or "Take first photo".
7. A fallback: "Questions? Call Cool Air HVAC (555) 123-4567". Use the number the homeowner already knows.

**Never ask for:** passwords, card numbers, SSN, or a login. Do not ask the homeowner to re-enter their address or name if the contractor already has it (✅ WCAG 2.2 SC 3.3.7 Redundant Entry: https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html).

Avoid anything that looks like phishing: no countdown timers, no "Your account will be suspended" tone, no red alert banners, and no generic stock branding. Use a real HTTPS domain and avoid odd TLDs.

---

## 4. Loading and AI-thinking states

- ✅ NN/g:
  - Show feedback immediately on every tap, or users assume nothing happened and tap again.
  - Show an indicator for anything over about 1 s.
  - Use a looped animation for 2–10 s.
  - Use percent-done or explicit progress for 10 s or more, and lower that threshold when timing is variable (LLM calls are variable).
  - Say what the system is doing ("Updating address 3 of 50"), not a static "Loading…".
  - Users with an indicator waited about 3× longer.
  https://www.nngroup.com/articles/progress-indicators/ · https://www.nngroup.com/topic/response-time/
- ⚠️ NN/g skeleton screens fit full-page loads where the layout is known. Content must land where the skeleton showed it. https://www.nngroup.com/articles/skeleton-screens/

**Applied to OneTrip**
- **Hide the latency.** Analyze each photo in the background as soon as it is uploaded, while the user takes the next photo. By the time they tap "Done with photos", question generation is already in progress.
- Use step-wise status text that reflects real progress. Example: "✓ Photos received → Reading the label… → ✓ Found: Trane XR14 (2015) → Preparing a few questions for you…". Showing the model or serial it found builds trust and reads as competence.
- **Stream the questions.** Render Q1 as soon as it exists and generate the rest while the user answers. Hold a fallback set of generic questions for the job type in case the LLM is slow, so the wait never exceeds about 8 s.
- Use a skeleton of the question card, meaning a heading bar plus 3 option rows, while Q1 generates.
- The submit confirmation should be concrete and should close the loop:
  - "Sent to Mike ✓".
  - What happens next: "He'll review before Thursday."
  - A recap of what was sent.
  - No upsell and no account creation.

---

## 5. Accessibility and plain language

- **Reading level.** ⚠️ GOV.UK targets a reading age of 9, roughly US grade 3–4, set by the lowest literacy level in the audience. That means everyday words, not childish ones. https://stormid.com/blog/content-accessibility-part-1-speak-plainly/
  - Target **grade 5 or lower** for OneTrip copy. AI-generated questions need a system prompt that enforces it: under 12 words, no jargon, explain any term. Example: "Is the big fan on the outside unit spinning?" rather than "Is the condenser fan motor operational?"
  - ⚠️ NIH/NIA senior-friendly guidance: "plain text, plain type, plain terms". https://www.nia.nih.gov/health/making-your-website-senior-friendly (via secondary listing)
- **Contrast.** ✅ WCAG 1.4.3 requires 4.5:1 for body text and 3:1 for large text. WCAG 1.4.11 requires 3:1 for UI component boundaries such as option-row borders. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  - **Outdoor glare:** aim for 7:1 (AAA 1.4.6). Use dark text on white, a solid high-saturation CTA, no light-gray hint text, and no thin font weights. Force a light theme, or test dark mode separately.
- **Text size.** Use 18 px body text and 22–28 px questions. Inputs need at least 16 px font, or iOS Safari will auto-zoom on focus. ✅ WCAG 1.4.4 and 1.4.10 require the layout to survive 200% text size and 320 px width without horizontal scroll. Never set `user-scalable=no`.
- **Motion and timing.** Do not use session timeouts on the question flow (WCAG 2.2.1). Respect `prefers-reduced-motion` for the thinking animation.
- **Screen readers.**
  - Each page's `<h1>` is the question.
  - Option groups use `fieldset`/`legend`.
  - Upload and analysis status goes in an `aria-live="polite"` region.
  - Thumbnails need alt text ("Photo 1: appliance label").
  - Move focus to the new `<h1>` on each step change.
- **Errors.** ✅ WCAG 3.3.1 and 3.3.3: say what went wrong and how to fix it, in text and not by color alone.

---

## Do / Don't checklist for the OneTrip customer flow

### Entry (SMS + first screen)
- **DO** send the SMS from the contractor's name and include the job context: appointment day, issue, and first name.
- **DO** use one branded HTTPS domain with a short path.
- **DO** make the first screen show who sent it, why, how long it takes, and a privacy line, then one big "Start" button.
- **DO** show the contractor's known phone number as a way to verify.
- **DON'T** use bit.ly-style shorteners, urgency, "verify your account" wording, or any login or payment request.
- **DON'T** ask for name, address, or phone. Pre-fill them from the contractor's job record (WCAG 3.3.7).

### Photos (1–3)
- **DO** cover one photo per screen with: a sample "like this" image, one sentence on where to find the subject, a big "Take photo" button (`capture="environment"`), and a small "Choose from my photos" link.
- **DO** set `accept="image/jpeg,image/png,image/*"` with JPEG first. **DON'T** list `image/heic`.
- **DO** downscale on the client to about 2048 px at JPEG quality 0.85 with `createImageBitmap`, keep the canvas under 16 MP, and convert stray HEIC on the server.
- **DO** upload in the background immediately, track state per photo, retry automatically, and keep the blob on failure.
- **DO** run instant blur, dark, and glare checks, then show what the server read back ("We read: Model …").
- **DO** offer Retake as the primary action and "Use anyway" as the secondary one. Also offer "I can't get this photo" with reasons.
- **DON'T** use `getUserMedia` for the hackathon. It adds a permission prompt and a denial dead end.
- **DON'T** hard-block on quality. **DON'T** ask for more than 3 photos.

### AI questions (3–5)
- **DO** show one question per screen, with the question as an 18–28 px `<h1>`, and 2–5 full-width option rows at least 48 px tall that auto-advance on a single choice.
- **DO** always include a "Not sure" option. Mark optional questions "(optional)" and never use asterisks.
- **DO** write at grade 5 or lower with no jargon, under 12 words per question, and enforce this in the LLM prompt.
- **DO** stream Q1 while the rest generate, and keep a canned fallback set per job type.
- **DO** keep a Back link at the top and make the browser back button work.
- **DON'T** use dropdowns, free-text boxes unless essential, or a progress count that can grow.
- **DON'T** ask anything the photo already answered. Confirm it instead: "Looks like a Trane XR14 (2015). Is that right?"

### Waiting states
- **DO** respond to every tap within 100 ms.
- **DO** use a spinner with status text for 2–10 s. For more than 10 s, use step-by-step real progress with ✓ marks.
- **DO** process photos while the user is still taking the next one, so the wait overlaps with work the user is already doing.
- **DON'T** use a static "Loading…", a blank screen, or a "don't tap again" warning.

### Layout and accessibility
- **DO** use a sticky full-width primary CTA at the bottom, at least 56 px tall, with safe-area padding.
- **DO** use 16 px or larger input font, 18 px body text, a 7:1 contrast target, and a forced light theme.
- **DO** support 200% zoom and 320 px width, use `aria-live` for status, and move focus to the `<h1>` on each step.
- **DON'T** use `user-scalable=no`, gray-on-white hints, thin fonts, color-only errors, timeouts, or required animations.

### Submit
- **DO** show "Sent to Mike ✓", what happens next, and a recap with thumbnails.
- **DON'T** add account creation, ratings prompts, or an upsell.

### Budget check (about 90 s)
- First screen: 5 s.
- 2 photos: about 20 s each, including finding the label, so 40 s.
- 4 taps on questions at about 5 s each: 20 s.
- Submit: 5 s.
- Total about 70 s, plus slack for one retake. This holds only if the AI wait is hidden behind the photo steps.

---

## Open items to verify on real devices
- On iOS 18/26 Safari and Android Chrome (Pixel + Samsung), with and without `capture`: does the camera open directly, is a gallery option shown, and does Android open in video mode?
- Does the HEIC to JPEG transcode happen when the image comes from the camera through `capture`, or only from the library?
- Calibrate the blur threshold on 20 real label photos.
- Measure end-to-end latency for vision-model label reads on a 3G-throttled connection.
