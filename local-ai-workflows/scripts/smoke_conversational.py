"""Run a real local Ollama conversational lifecycle against an isolated temp store.

Uses OLLAMA_URL/COACH_MODEL/COACH_ALLOW_PRIVATE_OLLAMA from the environment as-is.
No endpoint, generated note, or smoke artifact is written into the repository.
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def request(base, path, data=None):
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(base + path, data=body,
        headers={"Content-Type": "application/json"} if body else {})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as e:
        detail = json.loads(e.read())
        raise RuntimeError("API %s failed (%s): %s" % (path, e.code, detail.get("error", "unknown error")))


def wait_job(base, job_id, timeout=240):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = request(base, "/api/jobs/" + job_id)
        if job["status"] not in ("queued", "running"):
            if job["status"] != "completed":
                raise RuntimeError("Job %s ended %s: %s" % (job_id, job["status"], job.get("error")))
            return job["result"]
        time.sleep(0.5)
    raise RuntimeError("Timed out waiting for local inference job")


def main():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix="coach-conversation-smoke-") as data_dir:
        env = os.environ.copy()
        env.update(COACH_DATA_DIR=data_dir, COACH_PORT=str(port))
        proc = subprocess.Popen([sys.executable, str(ROOT / "app" / "server.py")], cwd=str(ROOT),
                                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = "http://127.0.0.1:%d" % port
        try:
            for _ in range(80):
                if proc.poll() is not None:
                    raise RuntimeError("Backend exited before smoke began")
                try:
                    state = request(base, "/api/state")
                    break
                except Exception:
                    time.sleep(0.25)
            else:
                raise RuntimeError("Backend did not start")
            if not state["runtime"].get("available"):
                raise RuntimeError("Configured local model unavailable: " + str(state["runtime"].get("error", "unknown")))
            initial = request(base, "/api/defaults/default-narrative/use", {"noteType": "narrative"})
            original_version = initial["versionId"]
            job = request(base, "/api/simulate", {"versionId": original_version})
            simulated = wait_job(base, job["jobId"])
            run_id = simulated["runId"]
            original = request(base, "/api/runs/" + run_id)
            initial_state = request(base, "/api/state")
            style = next(s for s in initial_state["styles"] if s["id"] == initial["styleId"])
            active_before = style["activeVersionId"]

            vague = request(base, "/api/runs/%s/feedback" % run_id,
                            {"scope": "future", "text": "make it better"})
            vague_result = wait_job(base, vague["jobId"])
            state_after_vague = request(base, "/api/state")
            assert vague_result.get("interpretation", {}).get("kind") == "clarification"
            assert len(next(s for s in state_after_vague["styles"] if s["id"] == initial["styleId"])["versions"]) == 1
            assert not [p for p in state_after_vague["patchProposals"] if p["runId"] == run_id]

            feedback = request(base, "/api/runs/%s/feedback" % run_id, {"scope": "future",
                "text": "Exactly one sentence per section and include one exact client quote when available."})
            proposal_result = wait_job(base, feedback["jobId"])
            proposal = proposal_result.get("patchProposal")
            assert proposal and proposal["status"] == "pending", "Expected a validated pending preference patch"
            paths = {item["path"]: item["after"] for item in proposal["patch"]}
            assert paths.get("sentences.min") == paths.get("sentences.max") == 1, paths
            assert paths.get("quotes.max", 0) >= 1 and paths.get("quotes.requireWhenAvailable") is True, paths
            state_pending = request(base, "/api/state")
            style_pending = next(s for s in state_pending["styles"] if s["id"] == initial["styleId"])
            assert len(style_pending["versions"]) == 1 and style_pending["activeVersionId"] == active_before
            assert "narrative-c" not in state_pending["fixtureUse"], "Pending patch must not consume C"

            confirmed = request(base, "/api/patch-proposals/%s/confirm" % proposal["id"],
                                {"baseVersionId": proposal["baseVersionId"]})
            if confirmed.get("jobId"):
                wait_job(base, confirmed["jobId"])
            after_confirm = request(base, "/api/state")
            style_confirmed = next(s for s in after_confirm["styles"] if s["id"] == initial["styleId"])
            proposed_version = next(v for v in style_confirmed["versions"] if v["id"] == confirmed["proposalId"])
            assert proposed_version["state"] == "proposed"
            assert style_confirmed["activeVersionId"] == active_before

            retry_req = request(base, "/api/runs/%s/retry" % run_id, {"correction": "Keep this note concise."})
            retry_result = wait_job(base, retry_req["jobId"])
            retried = request(base, "/api/runs/" + retry_result["runId"])
            original_after = request(base, "/api/runs/" + run_id)
            final_state = request(base, "/api/state")
            final_style = next(s for s in final_state["styles"] if s["id"] == initial["styleId"])
            assert retried["parentRunId"] == run_id
            assert retried["fixtureRole"] == "retry_reused" and retried.get("evidenceStatus") == "reused"
            assert retried["fixtureId"] == original["fixtureId"] and retried["versionId"] == original_version
            assert retried["promptHash"] != original["promptHash"]
            assert original_after["output"] == original["output"] and original_after.get("noteEdit") == original.get("noteEdit")
            assert final_style["activeVersionId"] == active_before
            print("PASS: real local conversation lifecycle; model=%s runtime=%s; vague clarification, pending/confirmed proposal, and reused-source retry verified." %
                  (state["runtime"].get("model"), state["runtime"].get("ollamaVersion", "unknown")))
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("FAIL: %s: %s" % (exc.__class__.__name__, exc), file=sys.stderr)
        sys.exit(1)
