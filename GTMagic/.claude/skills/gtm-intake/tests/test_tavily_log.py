"""Tests for tavily_log.py, using saved Tavily responses (no API key or network needed).
Run from the repo root:  python3 -m unittest discover -s .claude/skills/gtm-intake/tests"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
from provenance import check_evidence, load_log  # noqa: E402
from validate_intake import Report  # noqa: E402

SEARCH = {
    "query": "strength training while losing weight",
    "results": [
        {"title": "Losing muscle on my diet", "url": "https://example.com/forum/1",
         "content": "My lifts keep going down while the scale drops. Email me at sam@example.com [...] "
                    "I want a plan that keeps my strength.", "published_date": "2026-09-01"},
        {"title": "No content here", "url": "https://example.com/empty", "content": ""},
    ],
    "usage": {"credits": 2},
}
EXTRACT = {"results": [{"url": "https://example.com/keepstrong", "title": "KeepStrong",
                        "raw_content": "Keep your strength while the weight comes off. " * 300}],
           "failed_results": [{"url": "https://example.com/404", "error": "not found"}]}


class TavilyLog(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.ws = Path(self.dir.name)
        self.log = self.ws / "research-log.jsonl"
        for name, data in (("search.json", SEARCH), ("extract.json", EXTRACT)):
            (self.ws / name).write_text(json.dumps(data))

    def tearDown(self):
        self.dir.cleanup()

    def run_script(self, *args: str, key: bool = False) -> subprocess.CompletedProcess:
        env = {k: v for k, v in os.environ.items() if k != "TAVILY_API_KEY"}
        env["TAVILY_NO_KEYCHAIN"] = "1"  # never pick up a real key from this machine's Keychain
        env["TAVILY_LOG_REPLAY"] = "1"   # these tests replay saved responses
        if key:
            env["TAVILY_API_KEY"] = "tvly-test"
        return subprocess.run([sys.executable, "-I", str(SCRIPTS / "tavily_log.py"), *args, "--log", str(self.log)],
                              capture_output=True, text=True, env=env)

    def lines(self) -> list[dict]:
        return [json.loads(x) for x in self.log.read_text().splitlines()]

    def search(self, *extra: str) -> subprocess.CompletedProcess:
        return self.run_script("search", "strength training while losing weight", "--replay", str(self.ws / "search.json"), *extra)

    def test_search_writes_one_search_line_and_scrubbed_sources(self):
        out = self.search("--skeptic")
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
        log = self.lines()
        self.assertEqual([e["kind"] for e in log], ["search", "source"])  # the empty result is skipped
        self.assertEqual(log[0]["query"], "strength training while losing weight")
        self.assertTrue(log[0]["skeptic"])
        self.assertIn("[removed]", log[1]["excerpt"])
        self.assertNotIn("sam@example.com", self.log.read_text())
        self.assertIn("[1] Losing muscle on my diet", out.stdout)
        self.assertIn("1 of 15", out.stdout)

    def test_excerpts_copied_from_the_log_pass_the_intake_validator(self):
        self.search()
        sources, queries = load_log(str(self.log), Report())
        self.assertIn("strength training while losing weight", queries)

        def errors(excerpt: str) -> list[str]:
            r = Report()
            brief = {"evidence": [{"id": "ev_1", "origin": "web", "sourceType": "forum-post", "url": "https://example.com/forum/1",
                                   "excerpt": excerpt, "segmentIds": [], "concernIds": []}]}
            check_evidence(brief, set(), set(), sources, True, r)
            return r.errors

        self.assertEqual(errors("My lifts keep going down while the scale drops."), [])
        self.assertTrue(errors("My lifts keep going up"))           # not what the page said
        self.assertTrue(errors("Email me at sam@example.com"))      # personal detail never reached the log

    def test_cap_stops_research_but_not_the_website_pre_read(self):
        for _ in range(3):
            self.assertEqual(self.search("--cap", "3").returncode, 0)
        refused = self.search("--cap", "3")
        self.assertEqual(refused.returncode, 1)
        self.assertIn("past the research cap", refused.stdout)
        many = self.run_script("extract", "https://a.example/1", "https://a.example/2", "--cap", "3", "--replay", str(self.ws / "extract.json"))
        self.assertEqual(many.returncode, 1)  # a multi-URL read can't slip past the cap either
        before = len(self.lines())
        pre = self.run_script("extract", "https://example.com/keepstrong", "--pre-read", "--cap", "3",
                              "--replay", str(self.ws / "extract.json"))
        self.assertEqual(pre.returncode, 0, pre.stdout)
        self.assertEqual(len(self.lines()), before + 2)  # one fetch line and one source line
        self.assertIn("3 of 15", self.run_script("budget").stdout)

    def test_extract_caps_page_text_and_reports_failures(self):
        out = self.run_script("extract", "https://example.com/keepstrong", "--replay", str(self.ws / "extract.json"))
        source = [e for e in self.lines() if e["kind"] == "source"][0]
        self.assertTrue(source["truncated"])
        self.assertLessEqual(len(source["excerpt"]), 8000)
        self.assertIn("couldn't read https://example.com/404", out.stdout)

    def test_reddit_pages_are_never_extracted(self):
        for url in ("https://www.reddit.com/r/loseit/comments/abc/", "https://WWW.REDDIT.COM/r/x", "https://old.reddit.com:443/r/x",
                    "https://redd.it/abc"):
            out = self.run_script("extract", url, "--replay", str(self.ws / "extract.json"))
            self.assertEqual(out.returncode, 1, url)
        self.assertFalse(self.log.exists())
        ok = self.run_script("extract", "https://notreddit.com/page", "--replay", str(self.ws / "extract.json"))
        self.assertEqual(ok.returncode, 0, ok.stdout)

    def test_reddit_search_results_keep_one_short_snippet(self):
        reddit = {"results": [{"title": "t", "url": "https://www.reddit.com/r/x/comments/1/", "content": "a" * 900 + " [...] second chunk"}]}
        (self.ws / "reddit.json").write_text(json.dumps(reddit))
        self.run_script("search", "q", "--replay", str(self.ws / "reddit.json"))
        source = [e for e in self.lines() if e["kind"] == "source"][0]
        self.assertLessEqual(len(source["excerpt"]), 400)
        self.assertNotIn("second chunk", source["excerpt"])

    def test_reddit_without_https_redirects_and_profiles_are_kept_out(self):
        self.assertEqual(self.run_script("extract", "www.reddit.com/r/x", "--replay", str(self.ws / "extract.json")).returncode, 1)
        redirect = {"results": [{"url": "https://www.reddit.com/r/x/comments/1/", "title": "t", "raw_content": "whole thread " * 50}]}
        (self.ws / "redirect.json").write_text(json.dumps(redirect))
        out = self.run_script("extract", "https://short.example/abc", "--replay", str(self.ws / "redirect.json"))
        self.assertIn("skipped https://www.reddit.com", out.stdout)
        profile = {"results": [{"title": "t", "url": "https://www.reddit.com/user/someone/", "content": "a profile"}]}
        (self.ws / "profile.json").write_text(json.dumps(profile))
        self.run_script("search", "q", "--replay", str(self.ws / "profile.json"))
        self.assertEqual([e for e in self.lines() if e["kind"] == "source"], [])

    def test_pre_read_is_one_site_and_cap_cant_be_raised(self):
        pre = lambda url: self.run_script("extract", url, "--pre-read", "--replay", str(self.ws / "extract.json"))  # noqa: E731
        self.assertEqual(pre("https://example.com/keepstrong").returncode, 0)
        self.assertEqual(pre("https://competitor.example/pricing").returncode, 1)  # another site isn't the owner's website
        for _ in range(15):
            self.search()
        self.assertIn("past the research cap", self.search("--cap", "999").stdout)

    def test_replay_is_marked_and_needs_the_test_switch(self):
        self.search()
        self.assertTrue(all(e.get("replay") for e in self.lines()))
        env = {k: v for k, v in os.environ.items() if k not in ("TAVILY_API_KEY", "TAVILY_LOG_REPLAY")}
        out = subprocess.run([sys.executable, "-I", str(SCRIPTS / "tavily_log.py"), "search", "q", "--replay", str(self.ws / "search.json"),
                              "--log", str(self.ws / "other.jsonl")], capture_output=True, text=True, env=env)
        self.assertNotEqual(out.returncode, 0)
        self.assertFalse((self.ws / "other.jsonl").exists())

    def test_search_has_no_pre_read_bypass(self):
        out = self.search("--pre-read")
        self.assertEqual(out.returncode, 2)  # argparse: --pre-read is only for extract

    def test_missing_key_fails_without_logging(self):
        out = self.run_script("search", "anything")
        self.assertNotEqual(out.returncode, 0)
        self.assertIn("TAVILY_API_KEY", out.stdout + out.stderr)
        self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
