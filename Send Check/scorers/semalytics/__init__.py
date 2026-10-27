"""SEMalytics backend: audience-fit measurement against peer-reviewed
personality frameworks, via the SEMalytics scoring API.

This adapter is intentionally thin (~50 lines when implemented):
request in, Scorecard out. No SEMalytics internals live in this repo.

Config (env):
    SENDCHECK_SEMALYTICS_KEY   - scoped, rate-limited key (revoked after event)
    SENDCHECK_SEMALYTICS_URL   - endpoint base

If the key is absent, the pipeline falls back to the naive backend and
says so in Scorecard.notes. The demo must never hard-fail on this path.
"""
