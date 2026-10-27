"""End-to-end check of the four-screen flow against a running local server + real Ollama.

Usage:
  COACH_STARTERS=0 COACH_DATA_DIR=/tmp/coach-e2e python3 app/server.py   # fresh data dir, no starter templates
  python3 scripts/e2e_demo_check.py                     # in another

Exits non-zero if any step fails. Prints timings; no note text is printed.
"""

import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"

EXAMPLE = """Client Discussed:
The client reported feeling worn down after a family gathering and described a familiar sense of "not measuring up." The client explored how this story tends to show up most around holidays.

Therapist Contribution:
The therapist used externalization, inviting the client to name the problem. The therapist asked relative influence questions about when the problem has less pull.

Next Actions:
The client chose to notice moments when the problem is quiet before the next session."""


def call(path, body=None, expect=200):
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            code, data = r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        code, data = e.code, json.loads(e.read())
    assert code == expect, "%s -> %s %s" % (path, code, data)
    return data


def wait(job_id, cancel_after=None):
    t0 = time.time()
    while True:
        j = call("/api/jobs/" + job_id)
        if cancel_after is not None and time.time() - t0 > cancel_after and j["status"] == "running":
            call("/api/jobs/%s/cancel" % job_id, {})
            cancel_after = None
        if j["status"] not in ("queued", "running"):
            return j
        time.sleep(0.5)


def summary(checks):
    return "%d/%d pass, failed=%s" % (sum(c["status"] == "pass" for c in checks), len(checks),
                                       [c["id"] for c in checks if c["status"] == "fail"])


def ok(msg):
    print("PASS", msg)


st = call("/api/state")
assert st["runtime"]["available"], st["runtime"]
ok("runtime %s digest %s, Ollama %s, %s" % (st["runtime"]["model"], st["runtime"]["digest"][:12],
                                             st["runtime"]["ollamaVersion"], st["runtime"]["hardware"]))
assert not st["styles"], "use a fresh COACH_DATA_DIR"

# 1. Upload
ex = call("/api/extract", {"text": EXAMPLE, "name": "E2E narrative"})
prefs = ex["preferences"]
assert [s["name"] for s in prefs["sections"]] == ["Client Discussed", "Therapist Contribution", "Next Actions"]
assert prefs["sections"][2]["required"] is False
ok("extracted preferences; uncertain=%d" % len(ex["uncertain"]))

# 2a. Cancel preserves nothing
j = wait(call("/api/prepare", {"preferences": prefs, "noteType": "narrative"})["jobId"], cancel_after=1.0)
assert j["status"] == "cancelled", j["status"]
assert not call("/api/state")["styles"]
ok("cancelled preparation created no template")

# 2b. Prepare on A
j = wait(call("/api/prepare", {"preferences": prefs, "noteType": "narrative"})["jobId"])
assert j["status"] == "completed", j
ok("prepared draft in %.1fs, %d attempt(s)" % (j["elapsed"], j["iteration"]))
style_id, v1 = j["result"]["styleId"], j["result"]["versionId"]
st = call("/api/state")
ver = st["styles"][0]["versions"][0]
assert ver["state"] == "draft" and st["styles"][0]["activeVersionId"] is None
assert ver["validation"]["fixtureId"] == "narrative-a"
ok("v1 is draft (not active); practice checks: " + summary(ver["validation"]["checks"]))

# 4. Simulate on B (different from A), real generation
j = wait(call("/api/simulate", {"versionId": v1})["jobId"])
assert j["status"] == "completed", j
run = call("/api/runs/" + j["result"]["runId"])
assert run["fixtureId"] == "narrative-b" and run["purpose"] == "simulation"
assert run["promptSnapshot"] == ver["prompt"] and run["runtime"]["digest"]
ok("simulation on %s in %.1fs; %s" % (run["fixtureId"], run["durationMs"] / 1000, summary(run["checks"])))

# Accept & activate
call("/api/runs/%s/feedback" % run["id"], {"accepted": True, "scope": "note_only"})
call("/api/versions/%s/activate" % v1, {})
assert call("/api/state")["styles"][0]["activeVersionId"] == v1
ok("v1 accepted and activated explicitly")

# Note-only edit does not create a version
call("/api/runs/%s/feedback" % run["id"], {"accepted": False, "scope": "note_only", "editedNote": "edited"})
assert len(call("/api/state")["styles"][0]["versions"]) == 1
ok("note-only edit left template unchanged")

# Contradictory feedback must not create an empty "new" version
j = wait(call("/api/runs/%s/feedback" % run["id"], {"accepted": False, "scope": "future", "tags": ["too_long", "omitted_content"]})["jobId"])
assert j["status"] == "completed", j
r = j["result"]
assert r["interpretation"]["kind"] == "no_change" and len(call("/api/state")["styles"][0]["versions"]) == 1
ok("contradictory feedback returned no-change; no empty version created")

# Future feedback -> separate patch review -> explicit confirmation -> fresh check on C
j = wait(call("/api/runs/%s/feedback" % run["id"], {"accepted": False, "scope": "future",
                                                       "text": "Please add an optional Objective Data section and keep its content directly grounded in the source.",
                                                       "addSection": {"name": "Objective Data"}})["jobId"])
assert j["status"] == "completed", j
r = j["result"]
patch = r["patchProposal"]
assert len(call("/api/state")["styles"][0]["versions"]) == 1
st = call("/api/state")
assert st["fixtureUse"]["narrative-b"]["role"] == "development"
assert st["styles"][0]["activeVersionId"] == v1
r = call("/api/patch-proposals/%s/confirm" % patch["id"], {"baseVersionId": v1})
prop = r["proposalId"]
j = wait(r["jobId"])
assert j["status"] == "completed", j
pv = [v for v in call("/api/state")["styles"][0]["versions"] if v["id"] == prop][0]
assert pv["state"] == "proposed" and pv["parentId"] == v1 and pv["validation"]["fixtureId"] == "narrative-c"
assert "Objective Data" in pv["prompt"] and pv["changeSummary"]["promptDiff"]
ok("confirmed patch v2 previewed on fresh narrative-c (%.1fs); active still v1; B marked development" % j["elapsed"])

# Approve, then rollback
call("/api/versions/%s/activate" % prop, {})
vs = {v["id"]: v for v in call("/api/state")["styles"][0]["versions"]}
assert vs[prop]["state"] == "active" and vs[v1]["state"] == "archived"
r = call("/api/versions/%s/activate" % v1, {})
assert r["restored"] is True
vs = {v["id"]: v for v in call("/api/state")["styles"][0]["versions"]}
assert vs[v1]["state"] == "active" and vs[prop]["state"] == "archived"
assert call("/api/runs/" + run["id"])["promptSnapshot"] == ver["prompt"]
ok("approved v2, then restored v1; historical run kept its prompt snapshot")

# Grounding block cannot be removed by a prompt edit
call("/api/versions", {"parentId": v1, "prompt": "Write a note."}, expect=400)
ok("prompt edit without grounding rules rejected")

c = call("/api/state")["counts"]
assert c["real"] == 0 and c["development"] >= 1 and c["simulation"] >= 3
ok("run counts %s (fictional runs never counted as real)" % c)
print("ALL E2E CHECKS PASSED")
