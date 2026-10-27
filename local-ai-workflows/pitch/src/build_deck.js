const pptxgen = require('pptxgenjs');
const path = require('path');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Scribular';
pptx.subject = 'Pitch deck';
pptx.title = 'Scribular — Local AI, made usable';
pptx.company = 'Scribular';
pptx.lang = 'en-US';
pptx.theme = { headFontFace: 'Cambria', bodyFontFace: 'Arial', lang: 'en-US' };
pptx.defineSlideMaster({ title: 'PLAIN', background: { color: 'FFFFFF' }, objects: [], masterName: 'PLAIN' });

// One accent (forest), dark ink for headlines, muted gray for sublines and footnotes.
const C = { accent: '1F6B52', ink: '1E2A26', muted: '6B7A74' };
const X = 0.7, W = 11.93; // full-width centered text boxes on a 13.333in slide
const out = path.join(__dirname, '..', 'output');

function t(slide, text, y, h, opt = {}) {
  slide.addText(text, {
    x: X, y, w: W, h, margin: 0, align: 'center', valign: 'mid',
    fontFace: 'Arial', fontSize: 24, color: C.ink, bold: false, italic: false,
    paraSpaceAfterPt: 0, ...opt,
  });
}
const head = (s, text, y, h, opt = {}) => t(s, text, y, h, { fontFace: 'Cambria', fontSize: 54, bold: true, ...opt });
const sub = (s, text, y, h = 0.7, opt = {}) => t(s, text, y, h, { fontSize: 26, color: C.muted, ...opt });
function notes(s, body) { s.addNotes(body); }
const slide = () => pptx.addSlide('PLAIN');

// 1 — Story
{
  const s = slide();
  head(s, 'She became a therapist\nto help people.', 2.0, 2.2);
  sub(s, 'Not to do paperwork.', 4.5);
  notes(s, `[SLIDE 1]\nMy wife became a therapist because she wanted to help people. But the paperwork gets in the way, and it's draining the love she has for her profession.`);
}
// 2 — Data
{
  const s = slide();
  t(s, '#1', 0.4, 2.95, { fontFace: 'Cambria', fontSize: 160, bold: true, color: C.accent });
  head(s, 'Privacy & security', 3.4, 1.0, { fontSize: 48 });
  sub(s, 'the biggest barrier to small-business AI adoption', 4.45, 0.6, { fontSize: 24 });
  t(s, '30% name data privacy (17%) or cybersecurity (13%) as their single biggest barrier, ahead of limited knowledge (23%). SBE Council, Small Business Technology Use Survey, March 2026, p.40.',
    6.35, 0.6, { fontSize: 11, color: C.muted, hyperlink: { url: 'https://sbecouncil.org/wp-content/uploads/2026/03/SBE-Technology-Use-Survey-March-2026-Final-2.pdf' } });
  notes(s, `[SLIDE 2]\nAI could help, but therapy is confidential. And its not just in therapy- In our research, privacy and security is the number one barrier for small businesses adopting AI.\n\nEVIDENCE NOTE: SBE Council, Small Business Technology Use Survey (March 2026), printed p. 40, on the single biggest barrier to AI adoption: 30% of owners name data privacy (17%) or cybersecurity (13%), ahead of limited knowledge (23%). The "#1" claim is for the combined privacy & security category. Privacy alone (17%) is NOT #1, so do not say "privacy is the number one barrier" on its own. Survey method: online survey by TechnoMetrica using panel partners; fielded February 17–23, 2026; 517 owners at firms with 2–99 employees.`);
}
// 3 — The gap
{
  const s = slide();
  head(s, 'Local AI is private.\nIt isn’t easy.', 2.0, 2.2);
  sub(s, 'Too hard for small practices.', 4.5);
  notes(s, `[SLIDE 3]\nLocal models exist, and its no problem for big business IT departments to build and maintain it. But its a huge hurdle for small businesses. Its costly and requires technical expertise.\n\nIntroducing Scribular- it already turns a session transcript into a draft note with local processing. Today, we built self-service customization, so clinicians stop emailing us or engineering prompts by hand.`);
}
// 4 — Demo
{
  const s = slide();
  t(s, 'DEMO', 2.0, 3.0, { fontFace: 'Cambria', fontSize: 160, bold: true, color: C.accent });
  notes(s, `[SLIDE 4]\nSwitch to live Scribular demo.\nToday, we built that missing piece.\nHere is a transcript. Scribular generates a draft. She types: “Add the diagnoses, but keep the client's quotes.” Scribular shows the proposed change. She reviews it, confirms, and previews the result. If it works for her, she saves that style for future notes. If not, she stays with what she had.\nNo prompt engineering. No email thread. She decides what changes.\n\nEXACT COMMAND TO SHOW: “Add the diagnoses, but keep the client's quotes.”\n\nSAFETY RECOMMENDATION: Include only diagnoses explicitly documented in the transcript; do not infer new diagnoses.`);
}
// 5 — Close
{
  const s = slide();
  head(s, 'Private notes,\nin her own words.', 1.9, 2.2);
  t(s, 'Scribular', 4.5, 0.9, { fontFace: 'Cambria', fontSize: 36, bold: true, color: C.accent });
  notes(s, `[SLIDE 5]\nLocal AI gets us most of the way across the bridge. We are closing the gap between a model that runs and a tool a therapist can use.\nNow my wife can go back to doing what she loves- taking care of her clients\n\nMETRIC NOTE: “5+ hours / week” is an illustrative goal, not an achieved or measured Scribular outcome. The $3,000/month figure is an illustrative value of time based on 5 hours/week × 4 weeks/month × $150/hour. It represents time value, not cash cost savings; the estimate is unvalidated. The SBE Council survey separately reports a median five hours saved weekly by small-business owners through AI use, but this deck’s metric is not a Scribular result.`);
}

(async () => {
  await pptx.writeFile({ fileName: path.join(out, 'scribular-pitch.pptx') });
})();
