#!/usr/bin/env python3
"""Render a run as a one-page status view (HTML) and a JSON feed for a website to embed.

  python3 tools/status_view.py --run data/run.json --out data/status.html [--refresh 3]

Writes <out> (self-contained, no scripts, auto-refreshes) and <out>.json (the same facts, for a front end).
Stdlib only. Reads the run file the controller keeps up to date, so re-run it (or loop it) while a run is live.
"""
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

STAGES = [("request", "Request"), ("quotes", "Quotes"), ("decision", "Decision"),
          ("approval", "Owner approval"), ("order", "Order placed"), ("done", "Done")]


def facts(run: dict) -> dict:
    ev = [e["event"] for e in run.get("log", [])]
    st, rec = run["state"], run.get("recommendation") or {}
    reached = {"request": True, "quotes": "quotes_submitted" in ev, "decision": bool(run.get("order_id")),
               "approval": "approved" in ev, "order": "api_order_requested" in ev or len(run.get("reports", [])) > 3,
               "done": st == "done"}
    current = next((k for k, _ in STAGES if not reached[k]), "done")
    if st == "awaiting_approval":
        current = "approval"
    stopped = st in ("halted", "declined")
    api = run.get("api_order") or {}
    return {"run": run["id"], "skill": run["skill_name"], "state": st, "stopped": stopped, "halt": run.get("halt"),
            "item": run["request"].get("item"), "qty": run["request"].get("qty"), "vendor": rec.get("vendor"),
            "approved_total": run.get("approved_total"), "card_limit": run.get("card_limit"),
            "order_id": run.get("order_id"), "stages": [{"key": k, "label": l, "reached": bool(reached[k]),
                                                         "current": k == current and not reached["done"]} for k, l in STAGES],
            "approval": (run.get("approval") or {}).get("owner_said"), "vendor_order": api,
            "events": [{"ts": e["ts"][11:19], "event": e["event"], "note": e["note"]} for e in run.get("log", [])],
            "why": (run.get("card") or "")}


def render(f: dict, refresh: int = 3) -> str:
    e = html.escape
    tone = "stop" if f["stopped"] else ("ok" if f["state"] == "done" else "live")
    headline = {"stop": "Stopped: " + (f["halt"] or "declined by the owner"),
                "ok": "Order placed and confirmed", "live": "In progress: " + f["state"].replace("_", " ")}[tone]
    stages = "".join(f'<li class="{"on" if s["reached"] else ("now" if s["current"] else "")}"><b></b><span>{e(s["label"])}</span></li>'
                     for s in f["stages"])
    vo = f["vendor_order"]
    rows = [("Item", f'{f["qty"]} x {f["item"]}'), ("Vendor", f["vendor"]), ("Approved total", f'${f["approved_total"]}'),
            ("Price ceiling sent to vendor", f'${f["card_limit"]}'), ("Approved by", f["approval"] or "waiting"),
            ("Vendor order", vo.get("merchant_order_id") or vo.get("order_id")),
            ("Vendor status", vo.get("status")), ("Vendor total", f'${vo["total"]}' if vo.get("total") else None)]
    facts_html = "".join(f"<tr><th>{e(k)}</th><td>{e(str(v))}</td></tr>" for k, v in rows if v not in (None, "", "$None"))
    log = "".join(f"<li><time>{e(x['ts'])}</time> <b>{e(x['event'].replace('_', ' '))}</b> {e(x['note'])}</li>" for x in f["events"])
    card = f'<pre>{e(f["why"])}</pre>' if f["why"] else ""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{'<meta http-equiv="refresh" content="%d">' % refresh if refresh and not f["stopped"] and f["state"] != "done" else ""}
<title>BuyOnce run status</title><style>
:root{{--bg:#fafaf7;--fg:#1c1b19;--mut:#6b6860;--line:#dcd9d0;--card:#fff;--ok:#1a7f4b;--live:#b45309;--stop:#b42318}}
@media(prefers-color-scheme:dark){{:root{{--bg:#161614;--fg:#eeece6;--mut:#a09d94;--line:#34322d;--card:#1e1d1a;--ok:#4cc38a;--live:#f0a35c;--stop:#f97066}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:760px;margin:0 auto;padding:24px 16px 48px}}
h1{{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:0 0 8px}}
h2{{font-size:26px;margin:0 0 20px;color:var(--{tone})}}
ol{{list-style:none;display:flex;padding:0;margin:0 0 28px}}
ol li{{flex:1;text-align:center;font-size:12px;color:var(--mut);position:relative}}
ol li b{{display:block;width:18px;height:18px;border-radius:50%;margin:0 auto 6px;border:2px solid var(--line);background:var(--bg);position:relative;z-index:1}}
ol li::before{{content:"";position:absolute;top:8px;left:-50%;width:100%;height:2px;background:var(--line)}}
ol li:first-child::before{{display:none}}
ol li.on{{color:var(--fg)}} ol li.on b{{background:var(--ok);border-color:var(--ok)}} ol li.on::before{{background:var(--ok)}}
ol li.now b{{border-color:var(--live);box-shadow:0 0 0 4px color-mix(in srgb,var(--live) 25%,transparent)}}
.stop ol li.now b{{border-color:var(--stop)}}
section{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:16px}}
table{{width:100%;border-collapse:collapse}} th{{text-align:left;color:var(--mut);font-weight:500;padding:5px 12px 5px 0;width:44%}} td{{padding:5px 0;word-break:break-word}}
pre{{white-space:pre-wrap;font:13px/1.45 ui-monospace,monospace;margin:0}}
.log{{list-style:none;padding:0;margin:0;font-size:13px}} .log li{{padding:3px 0;border-bottom:1px solid var(--line)}} .log time{{color:var(--mut);margin-right:6px}}
h3{{font-size:13px;color:var(--mut);margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em}}
@media(max-width:520px){{ol li span{{font-size:10px}}}}
</style></head><body class="{tone}"><main>
<h1>BuyOnce &middot; {e(f["run"])} &middot; {e(f["skill"])}</h1><h2>{e(headline)}</h2>
<ol>{stages}</ol>
<section><table>{facts_html}</table></section>
<section><h3>What the owner was shown</h3>{card or "<p>Nothing yet.</p>"}</section>
<section><h3>Audit trail</h3><ul class="log">{log}</ul></section>
</main></body></html>"""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--run", default="data/run.json"); ap.add_argument("--out", default="data/status.html")
    ap.add_argument("--refresh", type=int, default=3)
    a = ap.parse_args(argv)
    f = facts(json.loads(Path(a.run).read_text(encoding="utf-8")))
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(f, a.refresh), encoding="utf-8")
    Path(str(out) + ".json").write_text(json.dumps(f, indent=2), encoding="utf-8")
    print(f"wrote {out} and {out}.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
