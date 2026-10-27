"""python -m twin_eval {download, preview, run, report, export-audience}"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from . import gtmagic, report
from .data import REVISION, download, load, sample_pids
from .personas import ARMS, PROMPT_VERSION, persona_card, system_prompt, user_prompt
from .simulate import PRICES, ClaudeClient, MockClient, answered_by_pid, cost_usd, read_records, run_arm
from .tasks import PRICING_COLUMNS, experiment_questions

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = "claude-haiku-5-5"   # the team's chosen simulation model (GTMagic docs/REQUIREMENTS.md)
# A resume must match these, or it would mix answers from different setups. Arms may differ (adding one is fine).
RESUME_KEYS = ("model", "effort", "seed", "n", "mock", "promptVersion")


def _common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--data", type=Path, default=ROOT / "data")
    p.add_argument("--n", type=int, default=200, help="simulated people (paired with real twins)")
    p.add_argument("--seed", type=int, default=7)


def _card_option(p: argparse.ArgumentParser) -> None:
    p.add_argument("--card-module", type=Path, default=None,
                   help="for the gtmagic arm: a .py file defining render_card(customer, intake) -> str "
                        "(the simulation skill's own card renderer); default follows ARCHITECTURE.md")


def _card_fingerprint(path: Optional[Path]) -> str:
    """By content, not path: an edited --card-module must not reuse answers made with the old card."""
    if path is None:
        return "default"
    if not path.is_file():
        sys.exit(f"--card-module {path} not found")
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def _resume_conflicts(old: dict, new: dict, out: Path) -> List[str]:
    diff = [k for k in RESUME_KEYS if old.get(k) != new[k]]
    # The card only shapes gtmagic answers, so it matters only once that arm has some saved.
    if (out / "responses-gtmagic.jsonl").exists() and old.get("cardFingerprint") != new["cardFingerprint"]:
        diff.append("cardRenderer")
    return diff


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="twin_eval", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("download", help="fetch the 3 dataset files (~26 MB)")
    d.add_argument("--data", type=Path, default=ROOT / "data")
    d.add_argument("--force", action="store_true")

    pv = sub.add_parser("preview", help="print the prompt one simulated person sees")
    _common(pv)
    pv.add_argument("--arm", choices=ARMS, default="voice")
    _card_option(pv)

    r = sub.add_parser("run", help="simulate, then write report.json and report.md")
    _common(r)
    r.add_argument("--arms", default=",".join(ARMS))
    r.add_argument("--model", default=DEFAULT_MODEL)
    r.add_argument("--effort", default="low", choices=["low", "medium", "high", "xhigh", "max"])
    r.add_argument("--concurrency", type=int, default=8)
    r.add_argument("--out", type=Path, default=ROOT / "out" / "run")
    r.add_argument("--mock", action="store_true", help="random answers, no API key needed (FAKE)")
    _card_option(r)

    ex = sub.add_parser("export-audience", help="write the twins as GTMagic audience-sample.json + twin-intake.json")
    _common(ex)
    ex.add_argument("--out", type=Path, default=ROOT / "out" / "gtmagic-audience")

    rp = sub.add_parser("report", help="re-score saved responses without calling the API "
                                       "(same people, n and seed as the saved run)")
    rp.add_argument("--data", type=Path, default=ROOT / "data")
    rp.add_argument("--out", type=Path, default=ROOT / "out" / "run")

    args = ap.parse_args(argv)
    if args.cmd == "download":
        download(args.data, args.force)
        return 0

    if args.cmd == "report":   # score exactly the people the saved run simulated
        if not (args.out / "run.json").exists():
            sys.exit(f"no run in {args.out}")
        saved = json.loads((args.out / "run.json").read_text())
        args.n, args.seed = saved["n"], saved["seed"]

    ds = load(args.data)
    pids = sample_pids(ds, args.n, args.seed, PRICING_COLUMNS)

    if args.cmd == "export-audience":
        for path in gtmagic.export_audience(ds, pids, args.seed, args.out):
            print(f"wrote {path}")
        return 0

    if args.cmd == "preview":
        r0 = ds.respondents[pids[0]]
        invented = {q.column: q.options[0] for q in ds.demographic_questions}   # placeholder for preview
        cards = gtmagic.Cards(ds, pids, gtmagic.load_card_renderer(args.card_module))
        print("=== SYSTEM (cached, same for everyone) ===\n" + system_prompt(ds))
        print("\n=== USER ===\n" + user_prompt(persona_card(args.arm, ds, r0, invented, cards), experiment_questions(ds, r0)))
        return 0

    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    meta_path = out / "run.json"

    if args.cmd == "run":
        arms = [a.strip() for a in args.arms.split(",") if a.strip()]
        bad = [a for a in arms if a not in ARMS]
        if bad:
            ap.error(f"unknown arms {bad}; choose from {ARMS}")
        meta = {"model": "mock" if args.mock else args.model, "effort": args.effort, "seed": args.seed,
                "n": args.n, "arms": arms, "mock": args.mock, "promptVersion": PROMPT_VERSION,
                "cardRenderer": str(args.card_module) if args.card_module else "default",
                "cardFingerprint": _card_fingerprint(args.card_module)}
        if meta_path.exists():
            diff = _resume_conflicts(json.loads(meta_path.read_text()), meta, out)
            if diff:
                sys.exit(f"{out} holds a run with different settings ({', '.join(diff)}); use a new --out.")
        meta_path.write_text(json.dumps(meta, indent=2))
        client = MockClient(ds, args.seed) if args.mock else ClaudeClient(args.model, args.effort)
        cards = gtmagic.Cards(ds, pids, gtmagic.load_card_renderer(args.card_module)) if "gtmagic" in arms else None
        for arm in arms:
            run_arm(ds, client, arm, pids, out, args.concurrency, cards)

    meta = json.loads(meta_path.read_text())
    keep = set(pids)
    arms_recs, usage_by_arm, total_cost = {}, {}, 0.0
    for arm in meta["arms"]:
        saved_recs = read_records(out / f"responses-{arm}.jsonl")
        arms_recs[arm] = {p: rec for p, rec in answered_by_pid(saved_recs).items() if p in keep}
        u = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0, "calls": 0}
        for rec in saved_recs:   # every call, skipped ones too: they were billed
            u["calls"] += 1
            for k in ("input", "output", "cache_read", "cache_write"):
                u[k] += rec.get("usage", {}).get(k, 0)
        usage_by_arm[arm] = u
        c = cost_usd(meta["model"], u)
        total_cost = total_cost + c if c is not None else total_cost

    run_info = {"promptVersion": "unrecorded", **meta, "datasetRevision": REVISION,
                "finishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                "usageByArm": usage_by_arm,
                "costUsd": None if meta["mock"] or meta["model"] not in PRICES else round(total_cost, 2)}
    rep = report.build(ds, pids, arms_recs, run_info, meta["seed"])
    (out / "report.json").write_text(json.dumps(rep, indent=2))
    (out / "report.md").write_text(report.render(rep))
    print(f"wrote {out / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
