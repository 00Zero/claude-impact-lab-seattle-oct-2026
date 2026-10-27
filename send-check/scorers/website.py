"""Read a recipient's public company website as plain text for the judge.

Business websites only. Personal social profiles are refused (their terms
forbid automated access, and Send Check works from facts, not personal
footprints): the user pastes what they need instead. Requests are limited
to public internet addresses, so a hosted Send Check cannot be pointed at
internal services, and every redirect is checked the same way.
"""
from __future__ import annotations

import ipaddress
import re
import socket
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

MAX_BYTES = 2_000_000
MAX_CHARS = 4000
MAX_REDIRECTS = 3
TIMEOUT = 8.0
SOCIAL = re.compile(
    r"(^|\.)(linkedin|facebook|instagram|twitter|x|tiktok|threads|snapchat|pinterest|reddit)\.com$|"
    r"(^|\.)(fb\.me|t\.co|lnkd\.in)$", re.I)


class WebsiteError(ValueError):
    """A website that cannot or should not be read; the message is user-facing."""


def check_url(url: str) -> str:
    """Normalize and validate a URL; raise WebsiteError if it should not be fetched."""
    url = url.strip()
    if url and "://" not in url:
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise WebsiteError("enter a website address like northsideremodeling.com")
    host = parsed.hostname.lower()
    if SOCIAL.search(host):
        raise WebsiteError("social profiles aren't read; paste what you need from them instead")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise WebsiteError(f"couldn't find {host}")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise WebsiteError("only public websites can be read")
    return url


def fetch_text(url: str) -> dict:
    """Fetch a public page and return {"url", "title", "text"} with readable text only."""
    import httpx

    url = check_url(url)
    with httpx.Client(timeout=TIMEOUT, follow_redirects=False,
                      headers={"User-Agent": "SendCheck/0.1 (+https://github.com/internexio/send-check)"}) as client:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                with client.stream("GET", url) as resp:
                    if resp.is_redirect:
                        url = check_url(urljoin(url, resp.headers.get("location", "")))
                        continue
                    if resp.status_code >= 400:
                        raise WebsiteError(f"the site returned an error ({resp.status_code})")
                    if "html" not in resp.headers.get("content-type", "html"):
                        raise WebsiteError("that address isn't a web page")
                    body = b""
                    for chunk in resp.iter_bytes():
                        body += chunk
                        if len(body) > MAX_BYTES:
                            break
                    html = body.decode(resp.encoding or "utf-8", errors="replace")
                    title, text = extract_text(html)
                    if not text:
                        raise WebsiteError("no readable text on that page")
                    return {"url": url, "title": title, "text": text[:MAX_CHARS]}
            except httpx.HTTPError as e:
                raise WebsiteError(f"couldn't reach the site ({type(e).__name__})")
    raise WebsiteError("too many redirects")


class _TextParser(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "form", "iframe", "template"}

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.in_title = False
        self.title = ""
        self.description = ""
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.depth += 1
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            a = dict(attrs)
            if (a.get("name") or a.get("property", "")).lower() in ("description", "og:description"):
                self.description = self.description or (a.get("content") or "").strip()

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.depth:
            self.depth -= 1
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif not self.depth and data.strip():
            self.parts.append(data.strip())


def extract_text(html: str) -> tuple[str, str]:
    """(title, readable text): page title, meta description, then body text."""
    parser = _TextParser()
    parser.feed(html)
    title = " ".join(parser.title.split())
    text = " ".join(" ".join([parser.description] + parser.parts).split())
    return title, text
