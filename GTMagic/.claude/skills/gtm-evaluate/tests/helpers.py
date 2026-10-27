"""Shared test setup: put scripts/ on the path and point at the fiction fixtures. Fiction only, no network."""
from __future__ import annotations

import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(os.path.dirname(HERE), "scripts")
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, SCRIPTS)

DEMO_INTAKE = os.path.join(REPO, "fixtures", "demo", "intake.json")
DEMO_DIR = os.path.join(REPO, "fixtures", "demo", "evaluate")
DEMO_IMAGES = [os.path.join(DEMO_DIR, "images", f"ad-{i}.png") for i in (1, 2, 3)]
DEMO_HEADLINES = os.path.join(DEMO_DIR, "headlines.txt")
DEMO_SCENARIO = os.path.join(DEMO_DIR, "scenario.txt")


def demo_brief() -> dict:
    with open(DEMO_INTAKE, encoding="utf-8") as f:
        return copy.deepcopy(json.load(f))


def write_json(path: str, data: dict) -> str:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return path


def common_args(intake: str = DEMO_INTAKE, seed: int = 7, assets: list[str] | None = None) -> list[str]:
    """estimate/run arguments for the fiction fixture (images unless assets says otherwise)."""
    return (["--intake", intake, "--scenario-file", DEMO_SCENARIO, "--seed", str(seed)]
            + (assets if assets is not None else ["--images"] + DEMO_IMAGES))
