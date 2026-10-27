# Infotainment: ICP-conditioned message preference benchmark

Can a model say which version of a message a given audience prefers, and how audiences differ? The ground truth comes from the [Twin-2K-500 Mega-Study](https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500-Mega-Study) (Apache-2.0) `infotainment` study. 300 US adults each rated the same 18 news-post cards from 1 to 7 ("how likely would you be to share"). The cards are a fixed fractional design: 4 headlines × source (Reddit, Quora, BBC News, PBS News) × content type (Entertaining/Informative) × political lean (Liberal/Conservative) × likes (20/200/2,000). Demographics and personas come from waves 1–3 of [Twin-2K-500](https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500) (CC-BY-4.0).

This folder holds data and prompts only. Nothing here calls a model.

## Rebuild

```bash
python3 scripts/prep_megastudy.py      # needs pandas + pyarrow; downloads ~440 MB into data/megastudy/ (gitignored)
npm run megastudy -- prep              # splits, segment table, truth, blind batches, published reference arms
npm run megastudy -- fake              # oracle / random / null-train-mean sanity arms
npm run megastudy -- report            # writes RESULTS.md (val + test)
```

Everything is seeded and deterministic.

## Files

| File | What it is | Who may read it |
|---|---|---|
| `survey.json` | The survey intro, instruction and the 18 cards (`c01`–`c18`, survey order, verbatim text) | Anyone |
| `batches/segments.json` | Segment task: one item per segment, `vars.SEGMENT` (demographics only) + `vars.CARDS` | Predictors |
| `batches/twin-<split>-<n>.json` | Twin task: 20 people per file, `vars.PERSONA` (Twin-2K-500 `persona_summary`) + `vars.CARDS` | Predictors |
| `prompts/vanilla-segment-v1.md`, `prompts/vanilla-twin-v1.md` | Exact prompts. Replace each `{{NAME}}` with the item's `vars.NAME` | Predictors |
| `people.csv` | Segment table: pid, task id, split, wave 1–3 demographics, segment memberships | Scorer and analysts (maps task ids to public PIDs, so keep it out of prompts) |
| `<split>.truth.json`, `TRUTH.md` | Individual ratings, segment means, winners, gaps | **Scorer only** |
| `predictions/<arm>/` | Arm outputs (see below) | Scorer |

**Splits** are by person: 120 train, 60 val and 120 test, stratified by party × age band (seed 20261025). Tune prompts on train/val only.

**Segments** are each defined by one demographic answer: party (Rep/Dem/Ind), ideology (con/mod/lib), age (18–49/50+), sex, college degree, income (<$50k/$50–100k/$100k+), race (White/non-White), plus "all". A segment is scored in a split only if n ≥ 25. Val therefore has only 7 segments.

## Prediction format

- **Segment arm:** `predictions/<arm>/segments.json` = `{"party-rep": {"c01": 2.4, …}, …}` with predicted mean ratings. Segment descriptions don't depend on the split, so the same file is scored against each split's truth. An optional `segments-<split>.json` overrides it.
- **Twin arm:** `predictions/<arm>/<split>.json` (or `<split>-<n>.json`, merged) = `{"test-p001": {"c01": 2, …}, …}`. Twin predictions are also averaged within each segment and scored at segment level.

Missing items or cells are filled with 4 and counted. Values are clamped to 1–7.

## Ground truth and metrics

Every derived quantity is a fixed linear function of the 18 card ratings. **Attribute levels** use regression-adjusted marginal means (OLS on attribute dummies with the other attributes at their design average), because the design is nearly but not exactly balanced. So the same weights apply to one person, to a segment mean, and to a prediction.

- **Choice sets (9):** each attribute (headline, source, content, lean, likes), and the 4–5 concrete posts that share each headline. A winner is *real* when winner minus runner-up (paired within people) has a 95% bootstrap CI that excludes 0 and a Benjamini–Hochberg q < 0.10 across all segment × set tests in the split.
- **Segment gaps:** segment A minus segment B for 7 complementary pairs (Rep−Dem, con−lib, young−old, men−women, degree−no degree, <$50k−$100k+, White−non-White).
  - *Key* (pre-registered) quantities are the overall share level, lean (Liberal − Conservative) and content (Informative − Entertaining).
  - *Exploratory* quantities are every card and every other level contrast.
  - Each family is BH-corrected separately (q < 0.10), and the two-sample bootstrap CI must exclude 0.

| Metric | Meaning |
|---|---|
| Winner acc. (real) | Share of real winners where the arm's top option matches. Chance is printed |
| Overall ρ | Spearman over the 18 cards for "all" (the overall ranking) |
| Card r / ρ | Pearson / Spearman of predicted vs real card means, averaged over scored segments |
| Mean MAE | Mean absolute error of the predicted segment means (calibration) |
| Gap sign (real) | Share of real gaps where the arm's predicted gap has the right sign |
| Gap r (key) | Pearson of predicted vs real gaps over all key gap tests (real or not) |
| Gap scale | Mean predicted gap in the real direction ÷ mean real gap magnitude (1 = right size, >1 = exaggerated) |
| MAE / within-person r / pooled r / SD ratio | Twin task, per person. People with constant ratings drop out of within-person r |

Brackets are 95% bootstrap CIs over the scored units: real winners, segments, real gaps or people.

## Reference and sanity arms

- `ref-*` rows are the published Mega-Study twin predictions from `results.zip` (`consolidated_llm_values.csv`), mapped to our task ids. `meta.json` gives the model and temperature from each run's yaml.
  - The default spec, `ref-gpt41-full-persona`, says `model_name: gpt-4.1`, T = 0.7. It used the full persona text, waves 1–4.
  - The other rows are persona summary, demographics only, empty persona, GPT-5 and Gemini 3 Pro.
  - These are reference rows, not our runs.
- `oracle-*` is the truth itself, which checks the scorer. `random-*` is uniform noise. `null-train-mean` gives the train-split card means to every segment and person (no audience conditioning).

## Caveats

- **Real winners are population-wide.** On test, 0 of the 22 real winners differ from the overall winner, and `null-train-mean` already gets 95% winner accuracy. The audience-specific signal is in the gaps.
- **Only partisan lean gaps are real.** In both train and test, the only real gaps are Republicans vs Democrats and conservatives vs liberals on political lean. For Republicans and conservatives, the Liberal-minus-Conservative lean contrast is about 0.3 points (test) to 0.5 points (train) lower than for Democrats and liberals. Val's one real gap (degree vs no degree on lean) does not replicate elsewhere.
- **Splitting by person does not stop segment memorization.** Segment descriptions and cards are the same in every split, so tuning a segment prompt on train/val truth can memorize segment × card answers. Tune generic instructions, not numbers.
- **Persona summaries may include wave 4.** `persona_summary` is built from wave 1–3 scores and open answers. Twin-2K-500 notes that its full persona uses wave 4 answers for repeated questions, so some scores in the summary may reflect wave 4. None of it touches the Mega-Study outcome.
