#!/usr/bin/env python3
"""Upworthy pairs: "Here are two ads I made, which one would be better?" with real CTR.

Data: Yanjo/headlines-ctr holdout pairs (Upworthy Research Archive, CC BY 4.0): same article, same image, two headlines,
real impressions/clicks. Article opening (lede) joined from the OSF archive by test id.

  python3 pairs.py prep                 # sample 100 significant pairs -> truth.json, tasks + vanilla batches
  python3 pairs.py sample               # after sim/research.json: 30 ICP customers -> per-agent prompts (own A/B order)
  python3 pairs.py score                # combine crowd (majority) + score every arm vs real CTR
"""
from __future__ import annotations

import csv
import glob
import json
import math
import os
import random
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import demographics  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
N_PAIRS, N_AGENTS, BATCH, SEED = 100, 10, 25, 20261025
ATTRS = ["role", "currentSolution", "priceSensitivity", "urgency", "skepticism", "buyingStage"]
LABEL = {"role": "Role", "currentSolution": "Where you get your news and stories today", "priceSensitivity": "Attention budget",
         "urgency": "How much you're scrolling right now", "skepticism": "Skepticism toward clickbait", "buyingStage": "How often you click and share"}


def z(c1: int, n1: int, c2: int, n2: int) -> float:
    p = (c1 + c2) / (n1 + n2)
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    return abs(c1 / n1 - c2 / n2) / se if se else 0.0


def strip(s: str) -> str:
    import re
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).replace("&nbsp;", " ").strip()


def prep() -> None:
    csv.field_size_limit(10**8)
    ledes: dict[str, str] = {}
    for f in glob.glob(os.path.join(DATA, "upworthy", "*.csv")):
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r["clickability_test_id"] not in ledes and r.get("lede"):
                ledes[r["clickability_test_id"]] = strip(r["lede"])[:400]
    rows = [json.loads(l) for l in open(os.path.join(DATA, "upworthy-pairs", "holdout.jsonl"))]
    ok = []
    for r in rows:
        (ca, na), (cb, nb) = r["counts_A"][:2], r["counts_B"][:2]
        if min(na, nb) >= 1000 and r["headline_A"].strip() != r["headline_B"].strip() and r["test_id"] in ledes and z(ca, na, cb, nb) > 1.96:
            ok.append(r)
    ok.sort(key=lambda r: (r["test_id"], r["headline_A"]))
    rng = random.Random(SEED)
    seen, picked = set(), []
    for r in rng.sample(ok, len(ok)):
        if r["test_id"] not in seen:  # one pair per article
            seen.add(r["test_id"])
            picked.append(r)
        if len(picked) == N_PAIRS:
            break
    truth, tasks = {}, []
    for i, r in enumerate(picked, 1):
        pid = f"pair-{i:03d}"
        ads = [("h1", r["headline_A"], r["counts_A"]), ("h2", r["headline_B"], r["counts_B"])]
        if rng.random() < 0.5:
            ads.reverse()
        a, b = ads
        truth[pid] = {"testId": r["test_id"], "eyecatcherId": r["eyecatcher_id"],
                      "A": {"headline": a[1], "clicks": a[2][0], "impressions": a[2][1], "ctr": a[2][0] / a[2][1]},
                      "B": {"headline": b[1], "clicks": b[2][0], "impressions": b[2][1], "ctr": b[2][0] / b[2][1]}}
        truth[pid]["winner"] = "A" if truth[pid]["A"]["ctr"] > truth[pid]["B"]["ctr"] else "B"
        tasks.append({"id": pid, "article": ledes[r["test_id"]], "A": a[1], "B": b[1]})
    json.dump(truth, open(os.path.join(HERE, "truth.json"), "w"), indent=1)
    json.dump(tasks, open(os.path.join(HERE, "tasks.json"), "w"), indent=1)
    for k in range(0, N_PAIRS, BATCH):
        json.dump(tasks[k:k + BATCH], open(os.path.join(HERE, "batches", f"pairs-{k // BATCH + 1}.json"), "w"), indent=1)
    wins = sum(t["winner"] == "A" for t in truth.values())
    print(f"{len(ok)} eligible pairs; sampled {len(picked)} (one per article); A wins {wins}/{len(picked)}")


def pick_pains(seg: dict, rng: random.Random) -> dict:
    """Each person cares about 1-2 of the segment's needs and 1-2 of its barriers (seeded draw), one marked #1."""
    needs, bars = list(seg.get("needs", [])), list(seg.get("barriers", []))
    n = rng.sample(needs, min(len(needs), rng.randint(1, 2))) if needs else []
    b = rng.sample(bars, min(len(bars), rng.randint(1, 2))) if bars else []
    return {"top": (n or b or ["(none)"])[0], "needs": n, "barriers": b}


def card(seg: dict, attrs: dict, quotes: list[str], demo: dict, picks: dict) -> str:
    return "\n".join(["Your profile (from research on real readers):", *demographics.render(demo), f"- Group: {seg['name']}: {seg['description']}",
                      *[f"- {LABEL[a]}: {attrs[a]}" for a in ATTRS if a in attrs],
                      f"- Your #1 concern right now: {picks['top']}",
             f"- What you look for: {'; '.join(picks['needs'])}",
                      f"- What turns you off: {'; '.join(picks['barriers'])}",
                      "- How you talk (real things people like you have said):", *[f'  "{q}"' for q in quotes]])


def sample() -> None:
    research = json.load(open(os.path.join(HERE, "sim", "research.json")))
    segs = {s["segmentId"]: s for s in research["segments"]}
    lex = defaultdict(list)
    for e in research["lexicon"]:
        for sid in e.get("segmentIds", []):
            lex[sid].append(e)
    total = sum(s["sampleShare"] for s in research["segments"])
    raw = [(s["segmentId"], N_AGENTS * s["sampleShare"] / total) for s in research["segments"]]
    counts = {sid: int(x) for sid, x in raw}
    for sid, x in sorted(raw, key=lambda r: -(r[1] - int(r[1])))[: N_AGENTS - sum(counts.values())]:
        counts[sid] += 1
    alloc = [sid for sid, _ in raw for _ in range(counts[sid])]
    tpl = open(os.path.join(HERE, "prompts", "sim-pair-v2.md")).read().split("\n", 2)[2].lstrip("\n")
    tasks = json.load(open(os.path.join(HERE, "tasks.json")))
    rng = random.Random(SEED + 1)
    demos = demographics.assign(alloc, {s["segmentId"]: s.get("demographics", []) for s in research["segments"]}, random.Random(SEED + 7))
    customers = []
    for k, sid in enumerate(alloc, 1):
        seg = segs[sid]
        attrs = {a["name"]: rng.choices([v["value"] for v in a["values"]], [max(0.0, v["weight"]) for v in a["values"]])[0]
                 for a in seg.get("attributes", []) if a["name"] in ATTRS and a.get("values")}
        pool = lex[sid] or research["lexicon"]
        voice = rng.sample(pool, min(len(pool), rng.randint(3, 5)))
        swap = {t["id"]: rng.random() < 0.5 for t in tasks}  # this agent's own A/B order
        shown = [{"id": t["id"], "article": t["article"], "A": t["B"] if swap[t["id"]] else t["A"], "B": t["A"] if swap[t["id"]] else t["B"]} for t in tasks]
        a_dir = os.path.join(HERE, "sim", f"agent-{k:02d}")
        os.makedirs(a_dir, exist_ok=True)
        json.dump(shown, open(os.path.join(a_dir, "pairs.json"), "w"), indent=1)
        json.dump(swap, open(os.path.join(HERE, "sim", f"swap-agent-{k:02d}.json"), "w"))
        open(os.path.join(a_dir, "prompt.md"), "w").write(tpl.replace("{{CARD}}", card(seg, attrs, [e["quote"] for e in voice], demos[k - 1], pick_pains(seg, rng))))
        customers.append({"id": f"cust_r1_{k}", "segmentId": sid, "demographics": demos[k - 1], "attributes": attrs, "voiceLexiconIds": [e["id"] for e in voice]})
    json.dump({"schemaVersion": 1, "config": {"sampleSize": N_AGENTS, "seed": SEED + 1, "strategy": "representative"},
               "customers": customers}, open(os.path.join(HERE, "sim", "audience-sample.json"), "w"), indent=1)
    print({segs[s]["name"]: n for s, n in counts.items()})


def boot(vals: list[float], seed: int = 7, reps: int = 4000) -> tuple[float, float]:
    rng = random.Random(seed)
    ms = sorted(sum(rng.choice(vals) for _ in vals) / len(vals) for _ in range(reps))
    return ms[int(0.025 * reps)], ms[int(0.975 * reps)]


def score() -> None:
    truth = json.load(open(os.path.join(HERE, "truth.json")))
    ids = sorted(truth)
    arms: dict[str, dict[str, str]] = {}
    for arm in ("vanilla-opus", "vanilla-opus-icp", "opus-synthesis", "opus-final-v3"):
        d: dict[str, str] = {}
        for f in glob.glob(os.path.join(HERE, "predictions", arm, "pairs-*.json")):
            d.update({k: str(v).strip().upper()[:1] for k, v in json.load(open(f)).items()})
        if d:
            arms[arm] = d
    votes = defaultdict(lambda: [0, 0])
    used, issues = 0, []
    for k in range(1, N_AGENTS + 1):
        f = os.path.join(HERE, "sim", f"agent-{k:02d}", "out.json")
        if not os.path.exists(f):
            continue
        swap = json.load(open(os.path.join(HERE, "sim", f"swap-agent-{k:02d}.json")))
        out = json.load(open(f))
        used += 1
        for pid in ids:
            c = str(out.get(pid, {}).get("choice", "")).strip().upper()[:1] if isinstance(out.get(pid), dict) else str(out.get(pid, "")).strip().upper()[:1]
            if c not in ("A", "B"):
                issues.append(f"agent-{k:02d}/{pid}")
                continue
            real = ({"A": "B", "B": "A"}[c]) if swap[pid] else c
            votes[pid][real == "B"] += 1
    if used:
        arms["icp-crowd v3 (10 Sonnet, own pain points, majority)"] = {pid: ("A" if v[0] > v[1] else "B" if v[1] > v[0] else "-") for pid, v in votes.items()}
        json.dump({pid: {"A": v[0], "B": v[1]} for pid, v in votes.items()}, open(os.path.join(HERE, "predictions", "crowd-votes.json"), "w"), indent=1)
    lines = [f"## Upworthy pairs: {len(ids)} real A/B pairs (same image, two headlines, significant CTR difference)", "",
             "| Arm | Picked the higher-CTR ad | 95% CI | Avg CTR of picked ad | Missing |", "|---|---|---|---|---|",
             f"| chance | 50.0% | | {sum((t['A']['ctr'] + t['B']['ctr']) / 2 for t in truth.values()) / len(ids):.2%} | |",
             f"| oracle | 100% | | {sum(max(t['A']['ctr'], t['B']['ctr']) for t in truth.values()) / len(ids):.2%} | |"]
    hits = {}
    for arm, p in arms.items():
        h = [1.0 if p.get(pid) == truth[pid]["winner"] else 0.5 if p.get(pid) == "-" else 0.0 for pid in ids]
        hits[arm] = h
        lo, hi = boot(h)
        ctr = sum(truth[pid][p[pid]]["ctr"] if p.get(pid) in ("A", "B") else (truth[pid]["A"]["ctr"] + truth[pid]["B"]["ctr"]) / 2 for pid in ids) / len(ids)
        lines.append(f"| {arm} | {sum(h) / len(h):.1%} | [{lo:.1%}, {hi:.1%}] | {ctr:.2%} | {sum(pid not in p for pid in ids)} |")
    base = hits.get("vanilla-opus")
    if base:
        lines += ["", "**Paired difference vs vanilla-opus** (percentage points, 95% bootstrap CI)", ""]
        for arm, h in hits.items():
            if arm != "vanilla-opus":
                d = [a - b for a, b in zip(h, base)]
                lo, hi = boot(d, 11)
                lines.append(f"- {arm}: {100 * sum(d) / len(d):+.1f} [{100 * lo:+.1f}, {100 * hi:+.1f}]{' (significant)' if lo > 0 or hi < 0 else ''}")
    if used:
        strong = [pid for pid in ids if max(votes[pid]) >= 0.7 * sum(votes[pid])]
        acc = sum(arms["icp-crowd v3 (10 Sonnet, own pain points, majority)"][pid] == truth[pid]["winner"] for pid in strong) / max(1, len(strong))
        lines += ["", f"Crowd: {used}/{N_AGENTS} agents; {len(issues)} invalid answers. When ≥70% of the crowd agreed ({len(strong)} pairs), it was right {acc:.0%}."]
    text = "\n".join(lines)
    print(text)
    open(os.path.join(HERE, "RESULTS.md"), "w").write(text + "\n")


if __name__ == "__main__":
    {"prep": prep, "sample": sample, "score": score}[sys.argv[1]]()
