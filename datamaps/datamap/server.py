"""`datamap serve`: the owner site (web/) plus the pipeline behind its Build button.

Answers the handoff contract in web/README.md:
  GET  /jobs        {"ok": true}; the page uses this to leave demo mode
  POST /jobs        multipart: a `manifest` field (JSON) plus one `files` part per file,
                    named {source id}/{path}; returns {"job_id": ...}
  GET  /jobs/{id}   {"stage", "status", "map_url", "report_url", "regions", "error"}
Everything else is served as static files from the repository root, so the page can
load examples/ and each job's output under out/jobs/.

Sources are uploads or GitHub repos (cloned). Websites are read by Claude through the
/datamap skill, not by this server.
Jobs run one at a time: okf (gather sources, tidy notes into an OKF bundle) -> embed ->
cluster -> name (Claude Code, headless) -> render.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import threading
import traceback
import uuid
import webbrowser
from email.parser import BytesParser
from email.policy import default as email_policy
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import quote, urlparse
from urllib.request import url2pathname

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "out" / "jobs"
TABLES = {".csv", ".tsv", ".xlsx", ".xls"}
NOTES = {".md", ".markdown"}
DOCS = NOTES | {".txt", ".pdf"}
GITHUB = re.compile(
    r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?(?:/tree/([^/]+)(?:/(.+?))?)?/?$"
)
NAMING_TIMEOUT = 600

RUN_LOCK = threading.Lock()  # one pipeline at a time; each run loads models into memory
jobs: dict[str, dict] = {}

NAMING_PROMPT = """You are naming the groups on a datamap for a small business owner.
The input is a briefing: groups of documents with their size, average rating (if any),
keywords and most typical examples, then the most unusual documents.

About the business: {business}
What the owner wants to learn: {goal}
Each dot on the map is one {unit}.

Reply with only a JSON object (no prose, no code fences) shaped like:
{{"title": "...", "flags": {{"<document id>": "<2 to 4 word reason>"}},
  "clusters": {{"0": {{"label": "...", "summary": "...", "action": "..."}}}}}}

Rules:
- Every group number in the briefing gets an entry under "clusters".
- label: 2 to 5 plain words the owner would use, e.g. "Mobile orders not ready". All labels distinct.
- summary: one sentence on what these documents say; mention it if a group mixes two topics.
- action: one concrete thing a small team could do this month, or "" if there's nothing to do.
  For notes and documents, say what the owner could do with that knowledge (a service, a guide, a merge).
- flags: only unusual documents that are not genuinely about this business (spam, scams,
  reviews meant for another business). Usually there are none: then use {{}}.
- title: a short map title, using the business name if known.
"""


class Handler(SimpleHTTPRequestHandler):
    # Notes open as readable text when a dot is clicked, instead of downloading.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".md": "text/plain; charset=utf-8",
        ".markdown": "text/plain; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("", "/"):
            self.send_response(302)
            self.send_header("Location", "/web/builder.html")
            self.end_headers()
            return
        if path == "/jobs":
            return self._json({"ok": True})
        m = re.fullmatch(r"/jobs/([0-9a-f]+)", path)
        if m:
            job = jobs.get(m.group(1))
            return self._json(public(job)) if job else self._json({"error": "no such job"}, 404)
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/jobs":
            return self._json({"error": "not found"}, 404)
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        try:
            manifest, files = parse_multipart(self.headers.get("Content-Type", ""), body)
        except ValueError as e:
            return self._json({"error": str(e)}, 400)

        job_id = uuid.uuid4().hex[:10]
        folder = JOBS / job_id
        folder.mkdir(parents=True)
        save_uploads(folder / "uploads", files)
        (folder / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        jobs[job_id] = {"stage": "upload", "status": "running", "folder": folder, "manifest": manifest}
        threading.Thread(target=run_job, args=(job_id,), daemon=True).start()
        print(f"Job {job_id}: {len(files)} files, {len(manifest.get('sources') or [])} sources")
        self._json({"job_id": job_id})

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if args and isinstance(args[0], str) and args[0].startswith("GET /jobs/"):
            return  # the page polls every 2 seconds
        super().log_message(fmt, *args)


def public(job: dict) -> dict:
    return {k: job[k] for k in ("stage", "status", "map_url", "report_url", "regions", "error") if k in job}


def parse_multipart(content_type: str, body: bytes) -> tuple[dict, list[tuple[str, bytes]]]:
    if not content_type.startswith("multipart/form-data"):
        raise ValueError("expected multipart/form-data")
    msg = BytesParser(policy=email_policy).parsebytes(
        b"Content-Type: " + content_type.encode("latin-1") + b"\r\n\r\n" + body
    )
    manifest, files = None, []
    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        payload = part.get_payload(decode=True) or b""
        if name == "manifest":
            manifest = json.loads(payload.decode("utf-8"))
        elif name == "files":
            files.append((part.get_filename() or "file", payload))
    if manifest is None:
        raise ValueError("no manifest field")
    return manifest, files


def save_uploads(dest: Path, files: list[tuple[str, bytes]]) -> None:
    for name, data in files:
        parts = [p for p in PurePosixPath(name.replace("\\", "/")).parts if p not in ("", ".", "..", "/")]
        parts = [re.sub(r'[<>:"|?*]', "_", p) for p in parts]  # keep Windows happy
        if not parts:
            continue
        path = dest.joinpath(*parts)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def run_job(job_id: str) -> None:
    job = jobs[job_id]
    folder: Path = job["folder"]

    def stage(name: str) -> None:
        job["stage"] = name
        print(f"Job {job_id}: {name}")

    try:
        with RUN_LOCK:
            stage("okf")
            input_path = choose_input(gather_sources(job["manifest"], folder), folder)

            from .prepare import prepare

            prepare(input_path, folder, on_stage=stage)

            stage("name")
            named_by = name_groups(folder, job["manifest"])
            print(f"Job {job_id}: groups named by {named_by}")
            link_to_server(folder)

            stage("render")
            from .render import render

            render(folder)

        rel = folder.relative_to(ROOT).as_posix()
        job.update(
            status="done",
            map_url=f"/{rel}/map.html",
            report_url=f"/{rel}/insights.md",
            regions=regions(folder),
        )
        print(f"Job {job_id}: done, /{rel}/map.html")
    except SystemExit as e:  # the pipeline's own plain-language errors
        job.update(status="failed", error=str(e.code if e.code is not None else "the pipeline stopped"))
    except Exception as e:
        traceback.print_exc()
        job.update(status="failed", error=f"{type(e).__name__}: {e}")


def gather_sources(manifest: dict, folder: Path) -> list[tuple[dict, Path]]:
    found = []
    for src in manifest.get("sources") or []:
        sid = re.sub(r"[^\w-]", "", str(src.get("id") or "")) or "s"
        label = src.get("label") or sid
        if src.get("kind") == "github":
            found.append((src, clone(src, folder / "clones" / sid)))
            continue
        if src.get("kind") == "website":
            raise SystemExit(
                f"websites are read by Claude, not this server. In the Claude app, run "
                f"/datamap and give it {src.get('url') or 'the address'}"
            )
        path = folder / "uploads" / sid
        if not path.exists():
            path = bundled_sample(src)  # sample sources on the page send no files
        if path is None:
            raise SystemExit(f"no files arrived for {label}. Add the file again and rebuild")
        found.append((src, path))
    if not found:
        raise SystemExit("no sources were sent")
    return found


def bundled_sample(src: dict) -> Path | None:
    """A sample source's file, if it ships with the repo (e.g. examples/lakeview-cafe/reviews.csv)."""
    for f in src.get("files") or []:
        name = PurePosixPath(str(f.get("path") or "")).name
        if name:
            hit = next((p for p in sorted((ROOT / "examples").rglob(name)) if p.is_file()), None)
            if hit:
                return hit
    return None


def clone(src: dict, dest: Path) -> Path:
    url = str(src.get("url") or "").strip()
    m = GITHUB.match(url)
    if not m:
        raise SystemExit(f"{url or 'the GitHub link'} doesn't look like https://github.com/owner/repo")
    owner, repo, branch, tree_path = m.groups()
    if not dest.exists():
        cmd = ["git", "clone", "--depth", "1", "--quiet"]
        if branch:
            cmd += ["--branch", branch]
        cmd += [f"https://github.com/{owner}/{repo}.git", str(dest)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise SystemExit(f"couldn't download github.com/{owner}/{repo}: {result.stderr.strip()[:200]}")
    sub = str(src.get("subfolder") or tree_path or "").strip("/")
    root = dest / sub if sub else dest
    if not root.exists():
        raise SystemExit(f"github.com/{owner}/{repo} has no folder named {sub}")
    return root


def iter_files(path: Path, base: Path | None = None) -> list[Path]:
    if path.is_file():
        return [path]
    base = base or path
    return [
        f for f in sorted(path.rglob("*"))
        if f.is_file() and not any(p.startswith(".") for p in f.relative_to(base).parts)
    ]


def choose_input(found: list[tuple[dict, Path]], folder: Path) -> Path:
    """Pick the route the skill would: a table goes straight in; notes go through OKF."""
    files = [f for _, p in found for f in iter_files(p)]
    tables = [f for f in files if f.suffix.lower() in TABLES]
    if tables:
        biggest = max(tables, key=lambda f: f.stat().st_size)
        if len(tables) > 1:
            print(f"  {len(tables)} tables sent; mapping the biggest, {biggest.name}")
        return biggest

    docs = [f for f in files if f.suffix.lower() in DOCS]
    if not docs:
        raise SystemExit(
            "none of these files can be mapped yet. Send CSV or Excel exports, markdown "
            "notes, text files or PDFs"
        )
    root = found[0][1] if len(found) == 1 and found[0][1].is_dir() else combine(found, folder / "combined")

    notes = [f for f in docs if f.suffix.lower() in NOTES]
    if len(notes) * 2 < len(docs):
        return root  # mostly PDFs or text files: map the folder as it is

    from .convert_to_okf import convert
    from .okf_to_documents import write_documents

    bundle = folder / "okf_bundle"
    if bundle.exists():
        shutil.rmtree(bundle)
    convert(root, bundle)
    write_documents(bundle, folder)
    return folder / "documents.parquet"


def combine(found: list[tuple[dict, Path]], dest: Path) -> Path:
    """Several sources (or one loose file) become one folder, a subfolder per source."""
    if dest.exists():
        shutil.rmtree(dest)
    for src, path in found:
        target = dest / (re.sub(r"[^\w-]", "", str(src.get("id") or "")) or "s")
        if path.is_file():
            target.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target / path.name)
        else:
            shutil.copytree(path, target, ignore=shutil.ignore_patterns(".*"))
    return dest


def name_groups(folder: Path, manifest: dict) -> str:
    """Ask Claude Code (headless, no tools) to name the groups; keep keyword names if it can't."""
    labels_path = folder / "labels.json"
    placeholder = json.loads(labels_path.read_text(encoding="utf-8"))
    business = manifest.get("business") or {}
    if business.get("name"):
        placeholder["title"] = f"What's in {business['name']}'s data"

    claude = shutil.which("claude")
    if not claude:
        labels_path.write_text(json.dumps(placeholder, indent=2, ensure_ascii=False), encoding="utf-8")
        return "keywords (Claude Code isn't installed)"

    unit_map = manifest.get("map") or {}
    unit = unit_map.get("unit_label") or {
        "customer": "customer", "product": "product or service",
        "conversation": "message or request", "document": "document or note",
    }.get(unit_map.get("unit"), "item")
    about = " ".join(filter(None, [business.get("name"), business.get("description")])) or "not given"
    prompt = NAMING_PROMPT.format(business=about, goal=unit_map.get("goal") or "not given", unit=unit)
    try:
        result = subprocess.run(
            [claude, "-p", "--tools", "", "--strict-mcp-config", "--no-session-persistence",
             "--output-format", "text", prompt],
            input=(folder / "briefing.md").read_text(encoding="utf-8"),
            capture_output=True, text=True, encoding="utf-8", timeout=NAMING_TIMEOUT, cwd=folder,
        )
        named = parse_labels(result.stdout)
    except (subprocess.SubprocessError, OSError, ValueError) as e:
        print(f"  naming with Claude failed ({e}); keeping keyword names")
        labels_path.write_text(json.dumps(placeholder, indent=2, ensure_ascii=False), encoding="utf-8")
        return "keywords (Claude didn't answer)"

    merged = merge_labels(placeholder, named)
    labels_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
    return "Claude"


def parse_labels(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON in Claude's reply")
    return json.loads(text[start:end + 1])


def merge_labels(placeholder: dict, named: dict) -> dict:
    """Claude's names where it gave them; the keyword names everywhere else."""
    out = {"title": placeholder.get("title"), "flags": {}, "clusters": {}}
    if isinstance(named.get("title"), str) and named["title"].strip():
        out["title"] = named["title"].strip()
    if isinstance(named.get("flags"), dict):
        out["flags"] = {str(k): str(v) for k, v in named["flags"].items()}
    given = named.get("clusters") if isinstance(named.get("clusters"), dict) else {}
    for key, fallback in placeholder["clusters"].items():
        entry = given.get(key) if isinstance(given.get(key), dict) else {}
        label = str(entry.get("label") or "").strip()
        out["clusters"][key] = {
            "label": label or fallback["label"],
            "summary": str(entry.get("summary") or "") if label else "",
            "action": str(entry.get("action") or "") if label else "",
        }
    return out


def link_to_server(folder: Path) -> None:
    """Point each dot's file:// link at the same file served by this server."""
    import pandas as pd

    points_path = folder / "points.parquet"
    df = pd.read_parquet(points_path)
    if "url" not in df.columns:
        return

    def served(url):
        if not isinstance(url, str) or not url.startswith("file:"):
            return url
        try:
            rel = Path(url2pathname(urlparse(url).path)).resolve().relative_to(ROOT)
        except ValueError:
            return ""
        return "/" + quote(rel.as_posix())

    df["url"] = df["url"].map(served)
    df.to_parquet(points_path, index=False)


def regions(folder: Path) -> list[dict]:
    import pandas as pd

    labels = json.loads((folder / "labels.json").read_text(encoding="utf-8"))["clusters"]
    counts = pd.read_parquet(folder / "points.parquet", columns=["cluster"])["cluster"].value_counts()
    out = [
        {"name": labels[str(c)]["label"], "count": int(n)}
        for c, n in counts.items() if c != -1 and str(c) in labels
    ]
    out.sort(key=lambda r: -r["count"])
    if -1 in counts.index:
        out.append({"name": "Fits no group", "count": int(counts[-1])})
    return out


def serve(port: int = 8000, open_browser: bool = True) -> None:
    JOBS.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}/web/builder.html"
    print(f"Datamap is running at {url}  (Ctrl+C to stop)")
    if not shutil.which("claude"):
        print("  Claude Code isn't installed, so groups will be named by keywords.")
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
