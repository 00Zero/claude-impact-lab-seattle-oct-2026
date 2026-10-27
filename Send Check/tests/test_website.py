"""website.py: URL safety and text extraction (no network)."""
import socket

import pytest

from scorers.website import WebsiteError, check_url, extract_text


@pytest.fixture
def resolve_to(monkeypatch):
    def set_ip(ip):
        monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [(None, None, None, "", (ip, 443))])
    return set_ip


def test_bare_domain_gets_https(resolve_to):
    resolve_to("93.184.216.34")
    assert check_url("northside.example.com") == "https://northside.example.com"


@pytest.mark.parametrize("url", ["https://www.linkedin.com/in/dana", "instagram.com/dana", "https://x.com/dana"])
def test_social_profiles_refused(url):
    with pytest.raises(WebsiteError, match="social profiles"):
        check_url(url)


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1"])
def test_private_addresses_refused(resolve_to, ip):
    resolve_to(ip)
    with pytest.raises(WebsiteError, match="only public"):
        check_url("https://intranet.example.com")


def test_non_web_schemes_refused():
    with pytest.raises(WebsiteError):
        check_url("file:///etc/passwd")


def test_extract_text_keeps_content_and_drops_scripts_and_nav():
    html = """<html><head><title>Northside Remodeling | Seattle</title>
      <meta name="description" content="Kitchen and bath remodels since 2009.">
      <script>var tracking = 1;</script></head>
      <body><nav>Home About Contact</nav><h1>We remodel kitchens</h1>
      <p>Crews in Fremont and Ballard.</p><footer>Copyright</footer></body></html>"""
    title, text = extract_text(html)
    assert title == "Northside Remodeling | Seattle"
    assert text == "Kitchen and bath remodels since 2009. We remodel kitchens Crews in Fremont and Ballard."
    assert "tracking" not in text and "Home About" not in text
