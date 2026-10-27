"""Assemble report.json from the metrics, and render report.md from it."""
from __future__ import annotations

from typing import Dict, List, Optional

from . import metrics, realism
from .data import Dataset
from .tasks import PRICING_COLUMNS

ARM_LABELS = {
    "vanilla": "Plain Claude, no persona",
    "invented": "Claude invents the person",
    "demographics": "Real demographics, set by code",
    "voice": "Real demographics + own words",
    "gtmagic": "GTMagic customer card",
}

LIMITATIONS = [
    "Answers are stated survey responses, not behavior, and come from a general US sample buying groceries, not a business's niche.",
    "This checks the simulation step only: whether persona-conditioned answers track real people. It doesn't test research, positioning, or which message GTMagic recommends.",
    "Each simulated person answers all their questions in one call, as the real people did in one session.",
    "Pricing truth is wave 4. The ceiling is the same people's waves 1-3 answers, so it already includes two weeks of drift.",
]


def build(ds: Dataset, pids: List[str], arms: Dict[str, Dict[str, dict]], run_info: dict, seed: int) -> dict:
    out = {
        "schemaVersion": 1,
        **({"_note": "FAKE: mock responder, random answers. Not a finding."} if run_info.get("mock") else {}),
        "run": run_info,
        "people": len(pids),
        "references": {
            "pricing": metrics.references(ds, pids, PRICING_COLUMNS, seed),
            "framing": realism.framing_references(ds, pids, seed),
        },
        "arms": {},
        "limitations": LIMITATIONS,
    }
    for arm, recs in arms.items():
        out["arms"][arm] = {
            "label": ARM_LABELS.get(arm, arm),
            "answered": len(recs),
            "skipped": len(pids) - len(recs),
            "pricing": metrics.pricing(ds, pids, recs, seed),
            "framing": metrics.framing(ds, pids, recs),
            "framingIndividual": realism.framing_individual(ds, pids, recs, seed),
            "spread": realism.spread(ds, pids, recs),
            "inventedPersonas": realism.invented_personas(ds, pids, recs) if arm == "invented" else None,
            "usage": run_info.get("usageByArm", {}).get(arm),
        }
    return out


def _pct(v: Optional[float]) -> str:
    return "n/a" if v is None else f"{v:.0%}"


def _num(v: Optional[float]) -> str:
    return "n/a" if v is None else f"{v:.2f}"


def _rate(m: dict) -> str:
    if m["rate"] is None:
        return "n/a"
    ci = f" ({m['ci95'][0]:.0%}–{m['ci95'][1]:.0%})" if m.get("ci95") else ""
    return f"{m['rate']:.0%}{ci}, {m['matches']}/{m['n']}"


def render(rep: dict) -> str:
    run = rep["run"]
    lines = ["# Twin-2K-500 simulation-realism check", ""]
    if run["mock"]:
        lines += ["> **FAKE RUN.** The mock responder picked answers at random. These numbers test the",
                  "> pipeline only. Don't present them as findings.", ""]
    lines += [
        f"Simulated people: **{rep['people']}**, each paired with the real survey taker (\"twin\") whose",
        f"answers they're scored against. Model `{run['model']}`, effort `{run['effort']}`, seed {run['seed']},",
        f"prompt `{run['promptVersion']}`, dataset revision `{run['datasetRevision'][:10]}`, {run['finishedAt']}.",
    ]
    if run.get("costUsd") is not None:
        lines.append(f"API cost: about ${run['costUsd']:.2f}.")
    lines += ["", "All simulated answers are **simulated**. Shares below are simulated choices, not conversion rates.", ""]

    ref_p, ref_f = rep["references"]["pricing"], rep["references"]["framing"]
    lines += ["## Scorecard", "",
              "| | Pricing: same buy/skip as twin | Product buy-rates track humans (r) | Framing direction right | Framing effect size (r) | Answer spread vs humans | Skipped |",
              "|---|---|---|---|---|---|---|"]
    for arm, a in rep["arms"].items():
        p, f, s = a["pricing"], a["framing"], a["spread"]
        lines.append(
            f"| {a['label']} | {_rate(p['individual'])} | {_num(p['productBuyShare']['correlation'])} "
            f"| {f['directionMatches']} of {f['directionCallable']} | {_num(f['effectCorrelation'])} "
            f"| {_num(s['medianRatio'])} | {a['skipped']} |")
    lines += [f"| *Ceiling: twin's own answer 2 weeks earlier* | {_rate(ref_p['retest_ceiling'])} | | | | | |",
              f"| *Floor: most common answer for everyone* | {_rate(ref_p['majority_floor'])} | | | | | |", ""]
    lines += ["How to read it:",
              "- **Same buy/skip as twin**: share of the 40 products where the simulated person made the same call as their real twin. "
              "Brackets are a 95% interval over people. Compare with the ceiling and floor rows.",
              "- **Buy-rates track humans**: correlation across the 40 products between the simulated and real share who would buy, "
              "both counted over the same people. A product no simulated person answered is left out. "
              "This is the population view a message test relies on.",
              "- **Framing direction right**: wording changes where the real effect is big enough to call, and the simulated "
              "people shifted the same way. Random answers get about half of these right by chance, so read it next to **effect size (r)**, "
              "which correlates simulated with real effect sizes.",
              "- **Answer spread**: 1.00 means as varied as real people; near 0 means every simulated person gave the same answer.", ""]

    lines += ["## Framing questions: twin-level match", "",
              "| | Same answer as twin |", "|---|---|"]
    for arm, a in rep["arms"].items():
        lines.append(f"| {a['label']} | {_rate(a['framingIndividual'])} |")
    lines += [f"| *Ceiling: twin 2 weeks earlier* | {_rate(ref_f['retest_ceiling'])} |",
              f"| *Floor: most common answer* | {_rate(ref_f['majority_floor'])} |", ""]

    lines += _framing_table(rep)
    lines += _pricing_detail(rep)
    lines += _invented(rep)
    lines += ["## Limitations", ""] + [f"- {x}" for x in rep["limitations"]] + [""]
    return "\n".join(lines)


def _framing_table(rep: dict) -> List[str]:
    arms = list(rep["arms"])
    if not arms:
        return []
    head = "| Experiment | Contrast | Real effect | " + " | ".join(rep["arms"][a]["label"] for a in arms) + " |"
    lines = ["## Framing experiments", "",
             "Effects are the change between versions as a share of the answer scale (for number answers, in units of the real spread).",
             "", head, "|" + "---|" * (3 + len(arms))]
    # Arms can each omit different contrasts, so join on (experiment, condition), never list position.
    found = {a: {(e["key"], c["condition"]): c for e in rep["arms"][a]["framing"]["experiments"]
                 for c in e["contrasts"]} for a in arms}
    for exp in rep["arms"][arms[0]]["framing"]["experiments"]:   # every arm lists every experiment
        for cond in exp["conditions"][1:]:
            row = [found[a].get((exp["key"], cond["label"])) for a in arms]
            con = next((c for c in row if c), None)
            if con is None:
                continue
            cells = ["n/a" if c is None else f"{c['simulatedEffect']:+.2f} ({c['direction']})" for c in row]
            # The real effect is the same in every arm: it's computed over all twins, not the answered ones.
            lines.append(f"| {exp['title']} | {con['vs']} | {con['humanEffect']:+.2f} | " + " | ".join(cells) + " |")
    return lines + [""]


def _pricing_detail(rep: dict) -> List[str]:
    lines = ["## Pricing detail", "",
             "| | Simulated buy rate | Real buy rate | Avg gap per product | Products bought: r with twin | Spread (sd) simulated / real |",
             "|---|---|---|---|---|---|"]
    for a in rep["arms"].values():
        b, pp = a["pricing"]["productBuyShare"], a["pricing"]["productsBoughtPerPerson"]
        lines.append(f"| {a['label']} | {_pct(b['simulatedOverall'])} | {_pct(b['humanOverall'])} | {_pct(b['meanAbsError'])} "
                     f"| {_num(pp['correlationWithTwin'])} | {_num(pp['simulatedSd'])} / {_num(pp['humanSd'])} |")
    return lines + [""]


def _invented(rep: dict) -> List[str]:
    inv = (rep["arms"].get("invented") or {}).get("inventedPersonas")
    if not inv or not inv["people"]:
        return []
    lines = ["## When Claude invents the people", "",
             f"{inv['people']} invented people, {inv['distinctProfiles']} distinct profiles. Gap = total variation distance from the real",
             "population (0 = same mix). A real random sample of the same size shows the gap expected by chance.", "",
             "| Attribute | Invented gap | Real sample gap | Most common invented | Most common real |", "|---|---|---|---|---|"]
    for r in inv["attributes"]:
        lines.append(f"| {r['question']} | {r['inventedGap']:.2f} | {r['realSampleGap']:.2f} | {r['mostCommonInvented']} | {r['mostCommonReal']} |")
    return lines + [""]
