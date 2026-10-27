# Review notes

## Deliverables

- `scribular-pitch.pptx` — editable 16:9 PowerPoint, exactly five slides; text, charts, bridge art, and illustrations are native shapes and text.
- `scribular-pitch.pdf` — five-page PDF rendered from the matching SVG/HTML preview.
- `slide-1.png` through `slide-5.png` — 1600×900 preview renders, one per slide.
- `slide-1.svg` through `slide-5.svg`, `preview.html` — mirror source for preview artifacts.
- `../src/build_deck.js`, `../src/render_preview.js` — editable deck and preview generators.

## Survey verification

Source: [SBE Council, Small Business Technology Use Survey (March 2026)](https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf).

The report's detailed findings (printed p. 38) say 45% cited reliability/accuracy concerns and 42% cited data security/privacy risks. The chart footnote specifies Q20 base=425 users of AI tools (±5.0 points), within the overall survey of 517 owners. The visible caption now makes both denominators explicit; the lead identifies the subgroup. The notes preserve the original script verbatim and add the exact Q20 base/source text. Methodology: online survey, 517 completed responses, TechnoMetrica panel partners, fielded Feb. 17–23, 2026; qualified small-business owners at firms with 2–99 employees; stated overall credibility interval ±4.4 percentage points.

## Editorial and claim notes

- Slide 4 speaker notes identify the demo transcript as fictional and preserve the exact requested command. They also recommend using only diagnoses explicitly documented in the transcript.
- Slide 5 labels its time and dollar figures as an illustrative goal. The visible footnote calculates 5 hours/week × 4 weeks/month × $150/hour = $3,000/month, describes this as time value rather than cash savings, and says the estimate is unvalidated and not a Scribular result. Notes clarify that the survey's five-hour median is separate from any Scribular outcome.
- The supplied scripts are preserved verbatim in slide notes, each under its slide marker. Editorial notes follow the relevant script.

## Visual QA fixes

- Final independent-review polish: bridge labels use four equal, inset slots within the bridge width, with 12 pt text (11.5 pt for the longer completed-bridge label), centered and without character spacing. Slide 3 names the final segment “BUILT TODAY” and captions it “Today: the final segment, in the clinician’s own words.”
- Coral text now uses darker rust (`B44832`) for contrast on white, while graphic coral bridge accents remain `E57861`.
- Slide 2 bars now show the stated 45% and 42% proportions of their 0–100% tracks; reliability uses sage and privacy uses forest. The source and base captions are 11 pt and 10 pt.
- Slide 4 is a plain demo placeholder with a centered 96 pt “DEMO”, process line, and clinician-control sentence. Removed the transcript illustration and its fictional-content cue; speaker notes begin with “Switch to live Scribular demo.”
- Slide 5 illustrative-value footnote is 10.5 pt. Original five-slide structure, speaker scripts, citations, and metric disclaimers are preserved.

- Slide 5 visible subtitle is now “From a model that runs to a tool a therapist can use.” in a 7.0 × 0.9 in box at 20 pt; the original speaker script remains unchanged in notes.
- Removed slide numbers from the LIGHT master and the HTML/SVG preview footer so they no longer collide with the privacy tagline.
- The notes helper converts any literal `\n` sequence to a real newline before writing notes. Extracted notes contain clean paragraph text across all five slides, with no literal backslash-n sequences.
- Coordinator visually verified the chart footnote on source-survey.pdf, p. 38: “Q20. What are your company's main concerns about using AI? (Please select all that apply). Base=425 Users of AI tools, +/-5.0 PTS”. Slide 2 now identifies Q20 n=425 AI-tool users and overall n=517 owners, and retains the verbatim source wording in speaker notes.

## Evidence correction

- Slide 2 lead: “AI-using small businesses name trust and reliability as real concerns.”
- Slide 2 caption: “Q20: n=425 AI-tool users; overall survey n=517 owners, 2–99 employees; Feb 17–23, 2026.”
- Original speech script remains verbatim in notes; exact Q20 question, base, margin, and report page are recorded there.

## Validation

- `vendor/anthropic-skills/skills/pptx/scripts/office/validate.py output/scribular-pitch.pptx`: **passed** (run with `.venv/bin/python` because the system Python lacks `defusedxml`).
- PPTX package inspection: exactly five slides and five speaker-notes parts.
- PPTX validator passed after this evidence correction.
- Preview mirrors, five PNG renders, and the five-page PDF were not regenerated for this evidence-only correction.
- PDF extraction: exactly five pages; extracted content follows the five-slide order.
- Visual inspection: all five 1600×900 PNGs were inspected. The rendered PDF and PNGs are SVG/HTML mirrors; a direct PowerPoint/LibreOffice render was unavailable on this Mac, so PPTX-native visual fidelity was not independently rendered here.

## Final pass (17:05)

- Type sizes brought into the brief's ranges: slide 2–3 headlines 38 pt; slide 2–3 body 20 pt; slide 4 process line 20 pt; small labels (NOTES, footers, LOCAL AI · CLINICIAN-LED, / week, / month, ILLUSTRATIVE GOAL) 10–12 pt; slide 5 footnote 11 pt.
- Arc shapes now set `angleRange` explicitly. Before, the PPTX arcs had no angle values, so PowerPoint drew its default quarter-circle for the bridge arches and the figures' shoulders. They now render as top-half arches.
- Slide 5: the fourth bridge label is now "SELF-SERVICE STYLE" (the completed slide 3 segment), so "More time with clients." appears only once, as the endpoint.
- Slide 2: the privacy panel is wider and its headline is 22 pt. At 24 pt in a 2.85 in box, it wrapped to four lines and ran into the body text in the PPTX.
- `src/render_preview.js` now builds the previews from `build_deck.js` itself, through a recording stand-in for pptxgenjs. Every slide's positions, sizes, and text come from the deck generator, and text wraps at the PPTX box widths. It is still a browser approximation, not a PowerPoint render.
- Rebuilt PPTX: validator passed; 5 slides, 5 notes parts. PNGs and the 5-page PDF regenerated from the new mirror.
- Not addressed: on slide 1, the papers still don't sit between the therapist and the client.

## Simplification pass (19:10 CDT)

The founder asked for much simpler slides. The deck was rebuilt as five one-idea slides: white background, one accent color, no diagrams or charts, and at most 12 words of text on any slide. The data slide now shows "#1 Privacy & security". The evidence is SBE Council, March 2026, p.40, which asked for the single biggest barrier: data privacy (17%) plus cybersecurity (13%) equals 30%, ahead of limited knowledge (23%). Privacy alone is not #1. The unmeasured savings figures were removed from the slides. The superseded p.38 notes above are kept for history. Validator passed; 5 slides, 5 notes. The preview PDF is a direct LibreOffice render of the PPTX, and all five slides were visually inspected.
