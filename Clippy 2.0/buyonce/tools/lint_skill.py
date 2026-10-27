#!/usr/bin/env python3
"""Lint a skill folder (or every skill under skills/) before you share it.

Checks:
  * SKILL.md has frontmatter with a kebab-case `name` that matches the folder, and a `description`.
  * Purchasing skills (marked with <!-- buyonce:purchasing-skill -->) have the required sections.
  * Nothing that looks like a secret: card numbers, Stripe keys, "password: ..." lines.

    python3 tools/lint_skill.py skills/            # all skills
    python3 tools/lint_skill.py skills/saucedemo-buy
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

MARKER = "<!-- buyonce:purchasing-skill -->"
# The marker only counts when it sits on a line of its own (not when a skill merely mentions it).
MARKER_LINE = re.compile(r"(?m)^" + re.escape(MARKER) + r"\s*$")
REQUIRED_SECTIONS = ["## Goal", "## Parameters", "## Steps", "## Stop points and approval", "## Verification"]
NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SECRET_PATTERNS = {
    "Stripe key": re.compile(r"\b[sr]k_(live|test)_[A-Za-z0-9]{10,}"),
    "password line": re.compile(r"(?im)^\s*[-*]?\s*(password|passwd|pwd)\s*[:=]\s*\S+"),
}


def _luhn(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2:
            n = n * 2 - 9 if n * 2 > 9 else n * 2
        total += n
    return total % 10 == 0


def _card_numbers(text: str):
    for m in re.finditer(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)", text):
        digits = re.sub(r"\D", "", m.group())
        if 13 <= len(digits) <= 19 and _luhn(digits):
            yield digits[:4] + "..." + digits[-4:]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end == -1:
        return {}, text
    meta = {}
    for line in text[4:end].splitlines():
        if ":" in line and not line.startswith(" "):
            key, _, val = line.partition(":")
            meta[key.strip()] = val.strip()
    return meta, text[end + 4:]


def lint_skill(folder: Path) -> list[str]:
    problems = []
    skill = folder / "SKILL.md"
    if not skill.exists():
        return [f"{folder}: missing SKILL.md"]
    text = skill.read_text(encoding="utf-8")
    meta, body = parse_frontmatter(text)
    if not meta:
        problems.append(f"{skill}: missing or malformed frontmatter (--- name/description ---)")
    else:
        name = meta.get("name", "")
        if not NAME_RE.match(name):
            problems.append(f"{skill}: name '{name}' must be kebab-case")
        elif name != folder.name:
            problems.append(f"{skill}: name '{name}' does not match folder '{folder.name}'")
        desc = meta.get("description", "")
        if not desc:
            problems.append(f"{skill}: missing description")
        elif len(desc) > 1024:
            problems.append(f"{skill}: description is {len(desc)} chars (max 1024)")
    if MARKER_LINE.search(body):
        for section in REQUIRED_SECTIONS:
            if section not in body:
                problems.append(f"{skill}: purchasing skill is missing section '{section}'")
    for label, pattern in SECRET_PATTERNS.items():
        if pattern.search(text):
            problems.append(f"{skill}: looks like it contains a {label}; remove it")
    for masked in _card_numbers(text):
        problems.append(f"{skill}: looks like a card number ({masked}); remove it")
    return problems


def collect(target: Path) -> list[Path]:
    if (target / "SKILL.md").exists():
        return [target]
    return sorted(p for p in target.iterdir() if p.is_dir() and (p / "SKILL.md").exists())


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print(__doc__)
        return 2
    folders = collect(Path(argv[0]))
    if not folders:
        print(f"No skills found in {argv[0]}")
        return 2
    problems = [p for folder in folders for p in lint_skill(folder)]
    for p in problems:
        print("FAIL", p)
    if not problems:
        print(f"OK: {len(folders)} skill(s) passed ({', '.join(f.name for f in folders)})")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
