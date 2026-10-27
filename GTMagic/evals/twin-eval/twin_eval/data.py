"""Download and load the Twin-2K-500 files this eval needs.

Only three files are used (about 26 MB): the question catalog and the
label-coded human answers for waves 1-3 and wave 4. Waves 1-3 build the
persona; wave 4 is the held-out ground truth. Because wave 4 repeats
questions from waves 1-3, the same people's two answers give a test-retest
ceiling: how often a real person matches their own earlier answer.
"""
from __future__ import annotations

import csv
import json
import random
import sys
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

# Pinned so results are reproducible. Bump deliberately.
DATASET = "LLM-Digital-Twin/Twin-2K-500"
REVISION = "f883165a3026fde855dfd448e0cd16443ab257b6"
FOLDER = "question_catalog_and_human_response_csv"
FILES = {
    "catalog": "question_catalog.json",
    "wave1_3": "wave1_3_response_label.csv",
    "wave4": "wave4_response_label.csv",
}

# Persona inputs from waves 1-3.
DEMOGRAPHIC_BLOCK = "Demographics"
SPENDING_QIDS = ["QID31", "QID32", "QID33"]   # tightwad-spendthrift items
SELF_DESCRIPTION_COL = "QID270_TEXT"           # "describe the person you actually are"
SELF_DESCRIPTION_MAX_CHARS = 1500

csv.field_size_limit(sys.maxsize)


@dataclass
class Question:
    column: str              # CSV column, also the ID shown to the model
    qid: str
    block: str
    text: str
    options: List[str]       # empty for number questions
    kind: str                # "choice" or "number"


@dataclass
class Respondent:
    pid: str
    wave1_3: Dict[str, str]  # column -> label answer
    wave4: Dict[str, str]
    demographics: List[tuple] = field(default_factory=list)   # (question text, answer)


@dataclass
class Dataset:
    questions: Dict[str, Question]           # by CSV column
    respondents: Dict[str, Respondent]       # by pid
    demographic_questions: List[Question]


def download(data_dir: Path, force: bool = False) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for name in FILES.values():
        target = data_dir / name
        if target.exists() and not force:
            print(f"have {target}")
            continue
        url = f"https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/{FOLDER}/{name}"
        print(f"downloading {url}")
        tmp = target.with_suffix(target.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(target)


def _question(entry: dict, column: str) -> Question:
    options = entry.get("Options") or []
    is_number = entry["QuestionType"] in ("TE", "Slider") and not options
    return Question(
        column=column,
        qid=entry["QuestionID"],
        block=(entry.get("BlockName") or "").strip(),
        text=entry["QuestionText"].strip(),
        options=list(options),
        kind="number" if is_number else "choice",
    )


def _read_csv(path: Path) -> Dict[str, Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return {row["pid"]: row for row in csv.DictReader(f)}


def load(data_dir: Path) -> Dataset:
    missing = [n for n in FILES.values() if not (data_dir / n).exists()]
    if missing:
        raise SystemExit(f"Missing {missing} in {data_dir}. Run: python -m twin_eval download")

    catalog = json.loads((data_dir / FILES["catalog"]).read_text(encoding="utf-8"))
    questions: Dict[str, Question] = {}
    demographic: List[Question] = []
    for entry in catalog:
        for column in entry.get("csv_columns") or []:
            q = _question(entry, column)
            questions[column] = q
            if q.block == DEMOGRAPHIC_BLOCK:
                demographic.append(q)

    wave1_3 = _read_csv(data_dir / FILES["wave1_3"])
    wave4 = _read_csv(data_dir / FILES["wave4"])
    respondents: Dict[str, Respondent] = {}
    for pid, row4 in wave4.items():
        row13 = wave1_3.get(pid)
        if row13 is None:
            continue
        r = Respondent(pid=pid, wave1_3=row13, wave4=row4)
        r.demographics = [(q.text, row13[q.column]) for q in demographic if row13.get(q.column)]
        respondents[pid] = r
    return Dataset(questions=questions, respondents=respondents, demographic_questions=demographic)


def self_description(r: Respondent) -> Optional[str]:
    text = (r.wave1_3.get(SELF_DESCRIPTION_COL) or "").strip()
    if not text:
        return None
    if len(text) > SELF_DESCRIPTION_MAX_CHARS:
        text = text[:SELF_DESCRIPTION_MAX_CHARS].rsplit(" ", 1)[0] + " …"
    return text


def sample_pids(ds: Dataset, n: int, seed: int, required_columns: List[str]) -> List[str]:
    """A seeded sample of people who answered every required wave-4 column."""
    eligible = sorted(
        pid for pid, r in ds.respondents.items()
        if all(r.wave4.get(c) for c in required_columns)
    )
    rng = random.Random(seed)
    if n >= len(eligible):
        return eligible
    return sorted(rng.sample(eligible, n))
