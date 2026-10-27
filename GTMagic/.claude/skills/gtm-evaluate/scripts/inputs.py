"""Load the brief, one asset set (images, headlines, or the owner's creatives[]) and the scenario.

Every path is checked against the sealed/ rule first: nothing under a folder named "sealed" is ever read
or written, symlinks included. Asset IDs are assigned by code. From a creative, only what the ad shows
is loaded (its image, or its headline); its results, flags and status are never read.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from dataclasses import dataclass

import images
from design import MAX_ASSETS, MIN_ASSETS

SEALED = "sealed"
MAX_HEADLINE_CHARS = 300
MAX_SCENARIO_CHARS = 1500
MAX_REQUEST_IMAGE_B64 = 30 * 1024 * 1024  # all images together; the API caps a whole request at 32 MB
# A scenario says where and when people see the ads. Words like these suggest it's carrying outcomes.
OUTCOME_HINTS = re.compile(r"\b(ctrs?|click[- ]?through|clicks|impressions|conversions?|performed|performance|"
                           r"winners?|won|results?)\b|\d\s?%", re.IGNORECASE)


class InputError(ValueError):
    """Bad or forbidden input; the message is safe to show as-is."""


@dataclass
class Asset:
    id: str
    kind: str                 # "image" | "headline"
    sha256: str
    text: str = ""            # headline text
    path: str = ""            # image file, as given
    media_type: str = ""
    b64: str = ""
    size: tuple | None = None
    tokens: int = 0           # visual tokens (images) for the estimate

    def to_json(self) -> dict:
        out = {"id": self.id, "kind": self.kind, "sha256": self.sha256}
        if self.kind == "image":
            out.update({"file": os.path.basename(self.path), "mediaType": self.media_type,
                        "pixels": list(self.size) if self.size else None, "visualTokens": self.tokens})
        else:
            out["text"] = self.text
        return out


def guard(path: str, what: str) -> str:
    """Refuse any path with a folder or file named "sealed", as given or after resolving symlinks."""
    given = os.path.normpath(os.path.abspath(path)).split(os.sep)
    real = os.path.realpath(path)
    if SEALED in {p.lower() for p in given + real.split(os.sep)}:
        raise InputError(f"refusing to use {what} under a '{SEALED}' folder: {path}")
    return real


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_bytes(path: str, what: str) -> bytes:
    real = guard(path, what)
    if not os.path.isfile(real):
        raise InputError(f"{what} not found: {path}")
    with open(real, "rb") as f:
        return f.read()


def read_text(path: str, what: str) -> str:
    try:
        return read_bytes(path, what).decode("utf-8")
    except UnicodeDecodeError:
        raise InputError(f"{what} is not UTF-8 text: {path}") from None


def image_asset(asset_id: str, path: str) -> Asset:
    data = read_bytes(path, "image")
    kind = images.media_type(data)
    if kind is None:
        raise InputError(f"{path}: not a PNG or JPEG image (convert other formats to PNG first)")
    if len(data) > images.MAX_RAW_BYTES:
        raise InputError(f"{path}: larger than the API's 10 MB (base64) per-image limit")
    size = images.dimensions(data, kind)
    if size is None:
        raise InputError(f"{path}: couldn't read the image's size from its header; re-save it as PNG")
    if max(size) > images.MAX_DIMENSION:
        raise InputError(f"{path}: larger than the API's {images.MAX_DIMENSION} x {images.MAX_DIMENSION} px limit")
    return Asset(id=asset_id, kind="image", sha256=sha256_bytes(data), path=path, media_type=kind,
                 b64=base64.b64encode(data).decode("ascii"), size=size, tokens=images.visual_tokens(size))


def headline_asset(asset_id: str, text: str) -> Asset:
    """Verbatim, apart from leading and trailing whitespace."""
    text = text.strip()
    if not text or len(text) > MAX_HEADLINE_CHARS:
        raise InputError(f"headline {asset_id} is empty or longer than {MAX_HEADLINE_CHARS} characters")
    return Asset(id=asset_id, kind="headline", sha256=sha256_bytes(text.encode("utf-8")), text=text)


def from_images(paths: list[str]) -> list[Asset]:
    return check_set([image_asset(f"img_{i}", p) for i, p in enumerate(paths, 1)])


def from_headlines(path: str) -> list[Asset]:
    lines = [line for line in read_text(path, "headlines file").splitlines() if line.strip()]
    return check_set([headline_asset(f"hl_{i}", line) for i, line in enumerate(lines, 1)])


def from_creatives(brief: dict, intake_path: str, fmt: str, only: list[str] | None) -> list[Asset]:
    """The owner's creatives of one format. Images resolve inside the workspace's sources/ folder."""
    every_id = [c.get("id") for c in dicts(brief.get("creatives"))]
    if len(set(every_id)) < len(every_id):
        raise InputError("the brief has two creatives with the same id")
    chosen = [c for c in dicts(brief.get("creatives")) if c.get("format") == fmt and (not only or c.get("id") in only)]
    missing = sorted(set(only or []) - {c.get("id") for c in chosen})
    if missing:
        raise InputError(f"no {fmt} creative with id {', '.join(missing)} in the brief")
    workspace = os.path.dirname(os.path.realpath(intake_path))
    root = os.path.join(workspace, "sources")
    assets = []
    for c in chosen:
        cid = str(c.get("id"))
        if fmt == "text":
            if not c.get("headline"):
                raise InputError(f"creative {cid} has no headline to show")
            assets.append(headline_asset(cid, str(c["headline"])))
            continue
        rel = str(c.get("imageFile") or "")
        full = os.path.realpath(os.path.join(workspace, rel))
        if not rel or os.path.isabs(rel) or os.path.commonpath([os.path.realpath(root), full]) != os.path.realpath(root):
            raise InputError(f"creative {cid}: imageFile must be a file inside the workspace's sources/ folder")
        if not os.path.isfile(full):
            raise InputError(f"creative {cid}: image file '{rel}' not found, so it can't be shown")
        assets.append(image_asset(cid, full))
    return check_set(assets)


def check_set(assets: list[Asset]) -> list[Asset]:
    if not MIN_ASSETS <= len(assets) <= MAX_ASSETS:
        raise InputError(f"need {MIN_ASSETS} to {MAX_ASSETS} ads of one type (got {len(assets)})")
    if sum(len(a.b64) for a in assets) > MAX_REQUEST_IMAGE_B64:
        raise InputError("these images together are too large for one request (about 30 MB once encoded); "
                         "use smaller files or fewer images")
    seen: dict[str, str] = {}
    for a in assets:
        if a.sha256 in seen:
            raise InputError(f"{a.id} is identical to {seen[a.sha256]}; each ad must be different")
        seen[a.sha256] = a.id
    return assets


def results_in_brief(brief: dict) -> list[str]:
    """Ad results the brief carries. If they existed when the customer groups were written, the groups may
    already lean toward the ad that did well, so a run on this brief isn't blind."""
    held = []
    if brief.get("priorExperiments"):
        held.append(f"{len(brief['priorExperiments'])} prior ad result(s)")
    with_results = [str(c.get("id")) for c in dicts(brief.get("creatives")) if c.get("performance")]
    if with_results:
        held.append(f"results on creative(s) {', '.join(with_results)}")
    if any(e.get("sourceType") == "first-party" and e.get("sampleSize") is not None for e in dicts(brief.get("evidence"))):
        held.append("first-party evidence with ad counts")
    return held


def dicts(value: object) -> list[dict]:
    """The dict entries of a list field (a hand-edited brief can hold anything)."""
    return [v for v in value if isinstance(v, dict)] if isinstance(value, list) else []


def load_intake(path: str, blind: bool, expected_sha256: str | None) -> tuple[dict, str, list[str]]:
    """The brief, its sha256, and warnings. --blind refuses a brief that carries ad results."""
    data = read_bytes(path, "intake.json")
    digest = sha256_bytes(data)
    if expected_sha256 and digest != expected_sha256.strip().lower():
        raise InputError(f"intake.json has sha256 {digest}, not the expected {expected_sha256}; "
                         "the brief changed since it was frozen")
    try:
        brief = json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise InputError(f"{path} is not valid JSON") from None
    if not isinstance(brief, dict) or brief.get("schemaVersion") != 1 or not brief.get("segments"):
        raise InputError(f"{path} is not an intake brief (schema v1) with customer groups")
    warnings = []
    readiness = brief.get("readiness")
    status = readiness.get("status") if isinstance(readiness, dict) else None
    if status != "ready":
        warnings.append(f"the brief's readiness is '{status}', not 'ready'")
    held = results_in_brief(brief)
    if held and blind:
        raise InputError(f"--blind: the brief holds {'; '.join(held)}. Its customer groups may already lean "
                         "toward the ad that did well. Use a brief frozen before any results existed.")
    if held:
        warnings.append(f"not a blind test: the brief holds {'; '.join(held)}, which may have shaped its "
                        "customer groups (prompts never include them)")
    return brief, digest, warnings


def load_scenario(path: str, blind: bool) -> tuple[str, list[str]]:
    """The scenario text. Results-like words warn; under --blind they stop the run."""
    text = re.sub(r"\s+", " ", read_text(path, "scenario file")).strip()
    if not text or len(text) > MAX_SCENARIO_CHARS:
        raise InputError(f"scenario must be 1 to {MAX_SCENARIO_CHARS} characters")
    hints = sorted({m.group(0).lower() for m in OUTCOME_HINTS.finditer(text)})
    if not hints:
        return text, []
    message = (f"the scenario mentions {', '.join(hints)}; it should say only where and when people see the ads, "
               "never how any ad did")
    if blind:
        raise InputError(f"--blind: {message}")
    return text, [message]
