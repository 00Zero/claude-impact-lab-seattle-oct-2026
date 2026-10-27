# 3-minute demo script (THE SPEC: changes here change the build)

Three speakers, **3:00 hard cap**. Karen owns the problem, David owns the solution (a live walkthrough of https://sendcheck.semalytics.com), Chirag owns the code. The same script is the shot list for the judges' video. Words are timed at about 150 per minute. The live check takes 15 to 30 seconds, and David's narration is written to run over that wait.

## Run of show

| Time | Who | On screen | Beat |
|---|---|---|---|
| 0:00 to 0:45 | **Karen** | Landing page, no clicks | The problem: Hilton, the survey, the Saltwind story |
| 0:45 to 2:05 | **David** | Live site: **Apology**, Check draft, verdict, groups | The solution |
| 2:05 to 2:45 | **Chirag** | Code: four files on GitHub or in the editor | The code walkthrough |
| 2:45 to 3:00 | **Karen** | Repo README | Close |

## Narration

**[Karen, 0:00 to 0:45: the problem]**
"Everyone in this room used AI to draft something this week, and most of it reads the same. At Hilton, my job was fixing AI copy so it was accurate, on brand, and made people want to travel. Small businesses have the same problem and nobody to fix it. A small business owner in the Washington AI survey told us: 'Preventing AI-slop is critical because it makes you look like an amateur.' Saltwind Kayak and Whale Tours. Their hired shuttle left 31 guests stranded at the ferry in August. Their AI-written apology is about to go to all 520 past guests."

**[David, 0:45 to 2:05: the solution, live]**

1. *(0:45, click **Apology**. The draft, five groups, and "520 customers loaded" appear.)* "One click loads their draft and their guest list. My profile is saved: Maren, co-owner, and the facts only she knows. The owners now drive the van, and a missed tour gets a refund or a free rebook."
2. *(0:55, click **Check draft**. The spinner runs.)* "Send Check scores the draft against each group on the list, using only facts from the list. It never invents a personality. A separate model reads it as each group would, which takes a few seconds."
3. *(1:10, verdict appears.)* "Scrap. Every group needs changes. A style check passes this same draft: sounds human, one hundred. The writing isn't the problem. The list is."
4. *(1:25, open the **Stranded at the ferry** card.)* "The 31 stranded guests paid for a tour that never ran. The draft offers them twenty percent off. They are owed a refund or a free rebook."
5. *(1:40, open the **2027 trip booked** card.)* "The 58 with 2027 deposits get an apology for problems they never had. Here is a suggested version. It ends with Maren's signature and uses only her facts. I approve it, copy it, and now it's mine."
6. *(1:55, leave the verdict on screen.)* "Cursor's unslop skill and Anthropic's slop self-check make the writer its own editor. Send Check is the independent one. It never sends anything."

**[Chirag, 2:05 to 2:45: the code]**

*(2:05, `scorers/base.py`: show the `Scorecard` and `verdict_from_score`.)* "The whole product is one frozen contract. A draft and a recipient go in, a scorecard comes out: send, fix, or scrap. Any scorer plugs in."

*(2:15, `scorers/naive/combine.py`: show the top of the file, the weights and the caps.)* "Cheapest checks run first: generic phrases and style tells. Then a Claude judge on its own model scores personalization and fit against one shared rubric. This file merges them, and disqualifying tells cap the verdict."

*(2:27, `scorers/segments.py`: show the docstring.)* "A list is many emails. This scores each group in parallel, and the worst group decides."

*(2:34, `scorers/autosegment.py`: show the docstring.)* "Auto-segment keeps the CSV on the server. Claude sees column summaries, never names or emails, and Python applies the rules to the real rows. Sixty-eight tests pass."

**[Karen, 2:45 to 3:00: the close]**
"Send Check installs as a Claude plugin in two commands, or runs as a web page. It's MIT-licensed, and the owner approves every word. The repo is live."

*(Optional, only if you have time and a real result: add "We checked this pitch with it: [READ THE SCORE AND VERDICT OFF THE SCREEN]." before the last sentence. Never read a placeholder.)*

## What is stable and what moves

The judge is a model, so numbers and some verdicts change from run to run. Narrate the stable parts and read everything else off the screen.

| Stable across our runs | Moves between runs |
|---|---|
| Overall verdict is **scrap** (45 to 47 in our Saltwind runs) | The exact overall score, by a few points |
| Every group needs changes (5 of 5) | Whether the **stranded** group shows fix or scrap, and the same for the **2027** group |
| Stranded: 20% off for a tour that never ran; they need a refund or free rebook | The exact words of each suggested version |
| 2027 bookers: an apology and a discount for problems they never had | Group scores (44 to 67 seen) |
| Unaffected groups: an apology for something they were not part of | |
| Sounds human: 100 | |

So David says what each group's problem is (stable) and never promises which group gets a suggested version. In step 5, if the 2027 group shows a version, use it. If not, open whichever group on screen does show one. If none does, say "for these groups the answer is don't send, and here is what each needs" and read the "what it needs" line.

## Chirag's code walkthrough: what to have open

Open these four files before recording, in this order, with the editor font large enough to read on a video (about 18 pt) and only the lines named visible:

1. `scorers/base.py`: the `Scorecard` dataclass and `verdict_from_score` (send at 75 and up, fix at 45 and up, otherwise scrap).
2. `scorers/naive/combine.py`: the docstring and the `WEIGHTS` and cap constants at the top.
3. `scorers/segments.py`: the docstring ("one message to many recipients is N messages").
4. `scorers/autosegment.py`: the docstring ("Privacy by construction").

Claims to keep exact: the contract is frozen; deterministic checks run before the judge; the judge runs on its own model, separate from whatever drafted the email; the worst group decides the verdict; Claude sees column summaries only. If the test count has changed, run `uv run pytest -q` and say the real number.

## Before recording or presenting

1. Open https://sendcheck.semalytics.com in a clean window. It has no login. Pick one theme (dark or light) and keep it.
2. Save **Your profile**: Maren Lindqvist, Co-owner, Saltwind Kayak & Whale Tours, saltwindtours.example, (360) 555-0142, hello@saltwindtours.example. "About your business" must include that the owners now drive the pickup van themselves, and that a guest whose tour was missed gets a full refund or a free rebooked trip. Without these, the stranded-guest refund finding and the van fact do not appear. Say "the owners' own policy", never imply Send Check inferred it.
3. **Pre-run the check once** right before going live, then reload. If it fails or is slow, you will know before the audience does.
4. Chirag: have the four files from the section above open and ready.

## If something goes wrong on stage

- **Check is slow (over 40 seconds):** David keeps narrating step 2, then moves to step 6, and returns to the result when it lands.
- **Check errors:** reload, click **Apology**, run once more. If it fails twice, switch to the recorded video and say so.
- **Site is down:** run it locally with `uv run python -m web.app` at http://localhost:8000, same flow.
- **Over time:** cut David's step 6, then Chirag's `segments.py` line. Never cut the verdict beat or the close.

## Language rule

Describe Send Check with measurement verbs: scores, measures, flags, checks, diagnoses. The "suggested version" is a noun and is fine. Do not say it writes, generates, rewrites, or optimizes anything. No dashes in spoken or on-slide copy.

## Source material

- Example: fixture #21, `corpus/fixtures/21-tour-operator-apology-to-whole-guest-list.md`
- Guest list: `corpus/fixtures/data/saltwind-tours-guests.csv` (520 synthetic guests). The **Apology** button loads it automatically.
