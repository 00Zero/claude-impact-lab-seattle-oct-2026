# Pitch deck

Five-slide pitch for the Claude Impact Lab hackathon. The spoken script is in the speaker notes.

- [output/scribular-pitch.pptx](output/scribular-pitch.pptx): the editable deck; present from this file.
- [output/scribular-pitch-preview.pdf](output/scribular-pitch-preview.pdf): PDF of the deck, rendered directly from the PPTX with LibreOffice 25.2.
- [speaker-notes.md](speaker-notes.md): the script, slide by slide, extracted from the deck.
- [output/REVIEW.md](output/REVIEW.md): independent review findings and fixes.
- [src/build_deck.js](src/build_deck.js): the generator. To rebuild: \`cd pitch && npm ci && node src/build_deck.js\`. See [BUILD.md](BUILD.md).

Built with Anthropic's PPTX skill: https://skills.sh/anthropics/skills/pptx

## Evidence notes

- Slide 2 source: SBE Council, *Small Business Technology Use Survey*, March 2026, p.40 (single biggest barrier to AI adoption). 30% name data privacy (17%) or cybersecurity (13%), ahead of limited knowledge (23%). The "#1" claim covers the combined privacy & security category only. Privacy alone (17%) is not #1.
- The savings figures (5+ hours/week, $3,000/month) are no longer on the slides; they were never measured. Slide 5's speaker notes still mention them, labeled as illustrative and unvalidated.
- The source survey PDF is not committed; cite it by the reference above.
