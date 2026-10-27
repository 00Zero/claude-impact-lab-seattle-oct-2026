# Corpus

- `generic_openers.txt` — one generic AI-outreach phrase per line (lines starting with `#` are comments); fuel for slop detection. Imported groups are attributed in `ATTRIBUTION.md`
- `fixtures/` — 20 synthetic test emails (one per use case) with expected findings; fictional, safe to commit. See `fixtures/README.md`
- `samples/` — ~20 real cold emails, **anonymized before commit** (no real names, companies, emails, phone numbers). Owner of this directory does the anonymization pass.
- `corpus/raw/` is gitignored — put un-anonymized material there only, never commit it.
