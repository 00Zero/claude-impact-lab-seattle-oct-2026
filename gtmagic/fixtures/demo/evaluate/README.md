# gtm-evaluate demo inputs (fiction)

Made-up inputs for the `gtm-evaluate` skill, used with the fictional KeepStrong brief in `../intake.json`. Nothing here is a real ad, a real business or a real result.

| File | What it is |
|---|---|
| `images/ad-1.png` … `ad-3.png` | Placeholder art drawn by `make_images.py` (flat shapes, no text, no people). Re-run it to rebuild the same bytes. |
| `headlines.txt` | Two made-up headlines, one per line. |
| `scenario.txt` | Where and when the simulated customer sees the ads. It describes the placement only, never any results. |

Mock run (no API calls, no key):

```bash
python3 .claude/skills/gtm-evaluate/scripts/evaluate.py run --mock --seed 7 \
  --intake fixtures/demo/intake.json --scenario-file fixtures/demo/evaluate/scenario.txt \
  --images fixtures/demo/evaluate/images/ad-1.png fixtures/demo/evaluate/images/ad-2.png fixtures/demo/evaluate/images/ad-3.png \
  --out gtm-workspace/keepstrong-demo/evaluate/mock-images-seed7
```
