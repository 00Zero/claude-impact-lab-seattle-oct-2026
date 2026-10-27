"""Default backend. No external services required.

Three layers, cheapest first:
1. mechanical.py  - deterministic checks, no model calls:
                    - you/I ratio
                    - ask count (exactly one small ask is the target)
                    - personalization-token density
                    - em-dash density
                    - uniform-paragraph-length detection
                    - three-parallel-bullets detection
                    - per-message-type length ceilings (words), from the
                      "Length" table in Anthropic's outreach-composer
                      slop_test.md (see corpus/ATTRIBUTION.md):
                        cold first touch  <= 120
                        follow-up         <=  60
                        warm / referral   <= 150
                        post-meeting      <= 100
                      scorers/base.py has no message-type field (channel is
                      email/linkedin/other), so mechanical.py takes the type
                      as an option and defaults to "cold".
2. slop.py        - generic-phrase detection against corpus/generic_openers.txt
                    (n-gram overlap; no embeddings needed for v1). Skip lines
                    starting with "#".
3. judge.py       - Claude-as-judge. Structured JSON output (current models
                    no longer accept a temperature setting; consistency comes
                    from the rubric's bands), scored against the recipient
                    context (not the draft alone).
                    The model comes from the SENDCHECK_JUDGE_MODEL env var, so
                    the judge can run on a DIFFERENT model than the one that
                    drafted the text. Independence by architecture: the
                    instrument does not share a model with the writer.

combine.py merges the three into one Scorecard via verdict_from_score().
Build order at the event: mechanical -> slop -> judge. Each layer ships
independently; the pipeline works with whichever layers exist.
"""
