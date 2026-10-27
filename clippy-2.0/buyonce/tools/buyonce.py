#!/usr/bin/env python3
"""BuyOnce: one command for the owner.

  python3 tools/buyonce.py setup                       three questions, writes your rules
  python3 tools/buyonce.py buy "bread flour 50lb" --qty 10 --by 2026-10-30 --skill SKILL.md \\
        --quotes quotes.json --product-url URL --address address.json
  python3 tools/buyonce.py approve "approve"           (a front end calls this after the owner taps Approve)
  python3 tools/buyonce.py status                      plain-English state; also writes data/status.html + .json

`buy` shows the approval card and asks you right there. If it cannot ask (no keyboard: a front end is driving),
it stops with exit code 10 and `approve` or `decline` finishes the job. Exit codes: 0 done, 10 waiting for the
owner, 20 stopped. Every command prints plain English; add --json for the machine-readable form.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import api_order  # noqa: E402
import executor  # noqa: E402
import status_view  # noqa: E402
import zinc  # noqa: E402
from core import load_policy, project_root  # noqa: E402

ROOT = project_root()
RUN = ROOT / "data" / "run.json"
AUDIT = ROOT / "data" / "audit.jsonl"
POLICY = ROOT / "policy" / "policy.toml"
EXIT = {"done": 0, "waiting": 10, "stopped": 20}


def say(msg, js, payload=None):
    print(json.dumps(payload, indent=2, default=str) if js and payload is not None else msg)


def refresh_status():
    run = json.loads(RUN.read_text(encoding="utf-8"))
    out = ROOT / "data" / "status.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(status_view.render(status_view.facts(run)), encoding="utf-8")
    Path(str(out) + ".json").write_text(json.dumps(status_view.facts(run), indent=2), encoding="utf-8")
    return out


def ask(prompt, default):
    try:
        got = input(f"{prompt} [{default}]: ").strip()
    except EOFError:
        got = ""
    return got or str(default)


def cmd_setup(a):
    name = a.name or ask("Business name", "My Shop")
    cap = a.cap or ask("Biggest single order you would ever want it to consider ($)", 2000)
    ask_all = a.auto_under is None and ask("Ask you before EVERY order? (yes/no)", "yes").lower().startswith("y")
    under = 0 if ask_all else float(a.auto_under if a.auto_under is not None else ask("Auto-approve orders under ($)", 50))
    blocked = a.block or ask("Vendors never to use (comma separated, or blank)", "")
    lines = ["# Written by `buyonce.py setup`. Edit in any text editor.", "", "[business]", f'name = "{name}"', 'currency = "USD"', "",
             "[spending]", f"allow_auto_approve = {'false' if ask_all or under <= 0 else 'true'}",
             f"auto_approve_under = {float(under):.2f}", f"hard_cap = {float(cap):.2f}", "card_buffer_pct = 5.0", "",
             "[vendors]", "approved = []", "blocked = [" + ", ".join(f'"{v.strip()}"' for v in blocked.split(",") if v.strip()) + "]",
             "prefer_past_vendors = true", "", "[quality]", "min_rating = 4.0", "", "[delivery]", "max_days = 7", "",
             "[sandbox]", 'hosts = ["www.saucedemo.com"]', "", "[api]", "allow_live = false", ""]
    POLICY.parent.mkdir(parents=True, exist_ok=True)
    POLICY.write_text("\n".join(lines), encoding="utf-8")
    load_policy(POLICY)  # fail loudly if what we wrote does not parse
    print(f"Saved your rules to {POLICY}. Test orders only until you turn on live mode.")
    return 0


def execute(run_ex, a, js):
    """Place the approved order. Returns an exit code."""
    out = None
    if a.product_url and a.address:
        try:
            policy = load_policy(run_ex.run["policy_path"])
            client = zinc.Zinc(zinc.load_key(ROOT), allow_live=bool(policy.get("api", {}).get("allow_live", False)))
            address = json.loads(Path(a.address).read_text())
            qty = int(run_ex.run["request"].get("qty") or 1)

            def place(order_id, limit):
                o = client.create_order(a.product_url, qty, address, api_order.cents(limit), order_id)
                total = ((o.get("job_result") or {}).get("price_components") or {}).get("total")
                return {"order_id": o.get("id"), "status": o.get("status"),
                        "total": f"{total / 100:.2f}" if total is not None else None}
            out = run_ex.execute_via_api(place)
        except zinc.ZincError as e:
            say(f"Could not place the order: {e}", js, {"error": str(e)})
            return EXIT["stopped"]
    else:
        say("Approved. No order method given (--product-url and --address): nothing was sent.", js)
        return EXIT["waiting"]
    refresh_status()
    ok = out["state"] == "done"
    say("Done. Order placed." if ok else f"Stopped: {out.get('reason')}", js, out)
    return EXIT["done"] if ok else EXIT["stopped"]


def cmd_buy(a):
    request = {"item": a.item, "qty": a.qty, "category": a.category, "need_by": a.by}
    ex = executor.Executor.start(RUN, a.skill, a.policy, request, audit_path=AUDIT, vendor=a.vendor,
                                 quotes_path=a.quotes, params={"product_url": a.product_url} if a.product_url else None,
                                 context_path=a.context)
    out = ex.next()
    refresh_status()
    if out["action"] == "stop":
        say(f"Stopped: {out['reason']}", a.json, out)
        return EXIT["stopped"]
    if out["action"] != "wait_for_owner":
        say(f"Unexpected state: {out['state']}", a.json, out)
        return EXIT["stopped"]
    print(out["card"])
    if not sys.stdin.isatty():
        print("Waiting for the owner. Finish with:  buyonce.py approve \"approve\"   or   buyonce.py decline")
        return EXIT["waiting"]
    said = ask("Place this order? (approve / no)", "no")
    return finish_approval(ex, out["order_id"], said, a)


def finish_approval(ex, order_id, said, a):
    try:
        ex.approve(order_id, said)
    except executor.ExecError as e:
        if ex.run["state"] == "awaiting_approval":
            ex.decline(said)
            refresh_status()
            print("Okay, nothing was bought.")
            return EXIT["stopped"]
        raise
    return execute(ex, a, a.json)


def load_run():
    try:
        return executor.Executor(RUN)
    except executor.ExecError as e:
        print(str(e)); raise SystemExit(EXIT["stopped"])


def cmd_approve(a):
    ex = load_run()
    return finish_approval(ex, ex.run["order_id"], a.words, a)


def cmd_decline(a):
    ex = load_run()
    ex.decline(a.words or "")
    refresh_status()
    print("Okay, nothing was bought.")
    return EXIT["stopped"]


def cmd_status(a):
    ex = load_run()
    page = refresh_status()
    s = ex.status()
    plain = {"quote": "getting prices", "needs_quotes": "waiting for prices", "awaiting_approval": "waiting for you to approve",
             "executing": "approved, placing the order", "done": "done", "halted": "stopped", "declined": "you said no"}
    msg = f"{s['skill']}: {plain.get(s['state'], s['state'])}" + (f" ({s['halt']})" if s["halt"] else "")
    say(msg + f"\nStatus page: {page}", a.json, {**s, "status_page": str(page)})
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="buyonce", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--json", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("setup"); s.add_argument("--name"); s.add_argument("--cap"); s.add_argument("--block")
    s.add_argument("--auto-under", type=float, dest="auto_under")
    b = sub.add_parser("buy"); b.add_argument("item"); b.add_argument("--qty", type=int, default=1)
    b.add_argument("--by"); b.add_argument("--category", default="supplies"); b.add_argument("--skill", required=True)
    b.add_argument("--quotes", required=True); b.add_argument("--policy", default=str(POLICY)); b.add_argument("--vendor")
    b.add_argument("--context"); b.add_argument("--product-url"); b.add_argument("--address")
    for name in ("approve", "decline"):
        p = sub.add_parser(name); p.add_argument("words", nargs="?", default="approve" if name == "approve" else "")
        p.add_argument("--product-url"); p.add_argument("--address")
    sub.add_parser("status")
    a = ap.parse_args(argv)
    try:
        return {"setup": cmd_setup, "buy": cmd_buy, "approve": cmd_approve, "decline": cmd_decline,
                "status": cmd_status}[a.cmd](a)
    except (executor.ExecError, zinc.ZincError) as e:
        print(f"Problem: {e}")
        return EXIT["stopped"]


if __name__ == "__main__":
    sys.exit(main())
