"""Download and flatten the Twin-2K-500 Mega-Study `infotainment` study (data only, no model calls).

Writes evals/data/megastudy/infotainment.json, which `npm run megastudy -- prep` turns into the benchmark.

Sources:
  https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500-Mega-Study (Apache-2.0)
  https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500 (CC-BY-4.0)

Usage (needs pandas + pyarrow):  python3 scripts/prep_megastudy.py
"""

import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

EVALS = Path(__file__).resolve().parent.parent
DATA = EVALS / "data" / "megastudy"
MEGA = "https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500-Mega-Study/resolve/main"
TWIN = "https://huggingface.co/datasets/LLM-Digital-Twin/Twin-2K-500/resolve/main"
FILES = {
    "infotainment.parquet": f"{MEGA}/data/infotainment-00000-of-00001.parquet",
    "results.zip": f"{MEGA}/results.zip",
    "wave1_3_response_label.csv": f"{TWIN}/question_catalog_and_human_response_csv/wave1_3_response_label.csv",
    **{f"full_persona/persona_chunk_{i:03d}.parquet": f"{TWIN}/full_persona/chunks/persona_chunk_{i:03d}.parquet" for i in range(1, 8)},
}

# Wave 1-3 demographics (Twin-2K-500 question catalog, block "Demographics").
DEMOGRAPHICS = {
    "QID11": "region", "QID12": "sex", "QID13": "age", "QID14": "education", "QID15": "race",
    "QID20": "party", "QID21": "income", "QID22": "ideology", "QID24": "employment",
}

# Published digital-twin runs in results.zip, imported as reference rows (twin predictions, not our runs).
PUBLISHED = {
    "ref-gpt41-full-persona": "full_persona_without_reasoning_2025-06-20",
    "ref-gpt41-persona-summary": "persona_summary_2025-08-01",
    "ref-gpt41-demographics-only": "demographics_only_2025-07-31",
    "ref-gpt41-empty-persona": "empty_persona_2025-07-22",
    "ref-gpt5-full-persona": "GPT5_2025-08-11",
    "ref-gemini3pro-full-persona": "gemini_3_pro_2025-12-04",
}

CARD = re.compile(r'Headline: "(.*)"\. Source: (.*)\. Content Type: (.*)\. Political Lean: (.*)\. Number of Likes: (.*)$')


def fetch(name: str) -> Path:
    path = DATA / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name}…", file=sys.stderr)
        part = path.with_suffix(path.suffix + ".part")
        urllib.request.urlretrieve(FILES[name], part)
        part.rename(path)
    return path


def questions(survey: dict):
    for block in survey["Elements"]:
        yield from block.get("Questions") or []


def load_cards_and_ratings() -> tuple[dict, list[dict]]:
    df = pd.read_parquet(fetch("infotainment.parquet"))
    cards: list[dict] | None = None
    intro = instruction = ""
    people = []
    for pid, raw in zip(df.PID, df.survey_json_with_human_response):
        qs = list(questions(json.loads(raw)))
        profiles = [q for q in qs if q.get("QuestionName", "").startswith("Profile")]
        # Everyone saw the same 18 cards in the same order (block "Conjoint questions fixed").
        mine = [{"id": f"c{i + 1:02d}", "profile": q["QuestionName"], "text": q["QuestionText"].strip()} for i, q in enumerate(profiles)]
        if cards is None:
            cards = mine
            intro = next(q["QuestionText"] for q in qs if q.get("QuestionName") == "instructions")
            instruction = next(q["QuestionText"] for q in qs if q.get("QuestionName") == "Conjoint_instruction")
        if [c["text"] for c in mine] != [c["text"] for c in cards] or [c["profile"] for c in mine] != [f"Profile{i}" for i in range(1, 19)]:
            raise SystemExit(f"{pid}: card set differs from the first respondent")
        named = {q.get("QuestionName"): (q.get("Answers") or {}).get("SelectedText") for q in qs}
        people.append({
            "pid": int(str(pid).removeprefix("pid_")),
            "ratings": [int(q["Answers"]["SelectedByPosition"]) for q in profiles],
            "flags": {k: named.get(k) for k in ("SocialMedia_Chk", "Random", "Google")},
        })
    assert cards is not None
    for c in cards:
        m = CARD.match(c["text"])
        if not m:
            raise SystemExit(f"cannot parse card: {c['text']}")
        headline, source, content, lean, likes = m.groups()
        c.update(headline=headline, source=source.replace("News", " News"), content=content, lean=lean,
                 likes=re.sub(r"\D", "", likes))
    return {"intro": intro.strip(), "instruction": instruction.strip(), "cards": cards}, people


def add_demographics(people: list[dict]) -> None:
    labels = pd.read_csv(fetch("wave1_3_response_label.csv"), usecols=["pid", *DEMOGRAPHICS], dtype=str).set_index("pid")
    for p in people:
        row = labels.loc[str(p["pid"])]
        p["demographics"] = {name: row[qid] for qid, name in DEMOGRAPHICS.items()}


def add_personas(people: list[dict]) -> None:
    # persona_summary is built from wave 1-3 scores and answers; it never contains Mega-Study outcomes.
    wanted = {p["pid"] for p in people}
    found: dict[int, str] = {}
    for i in range(1, 8):
        t = pq.read_table(fetch(f"full_persona/persona_chunk_{i:03d}.parquet"), columns=["pid", "persona_summary"]).to_pandas()
        for pid, summary in zip(t.pid, t.persona_summary):
            if int(pid) in wanted:
                found[int(pid)] = summary.strip()
    for p in people:
        p["persona_summary"] = found[p["pid"]]


def load_published() -> dict:
    out = {}
    cols = [f"Profile{i}" for i in range(1, 19)]
    with zipfile.ZipFile(fetch("results.zip")) as z:
        for arm, folder in PUBLISHED.items():
            base = f"results/infotainment/{folder}/"
            config = next(n for n in z.namelist() if n.startswith(base) and n.endswith(".yaml"))
            text = z.read(config).decode()
            model = re.search(r'model_name:\s*"?([^"\n]+)', text)
            temp = re.search(r"\n\s+temperature:\s*([\d.]+)", text)
            frames = {}
            for kind in ("llm", "original_answers"):
                with z.open(f"{base}consolidated_{kind}_values.csv") as f:
                    frames[kind] = pd.read_csv(f, skiprows=[1, 2], low_memory=False)
            llm = frames["llm"].dropna(subset=cols)
            out[arm] = {
                "folder": folder,
                "model": model.group(1).strip() if model else None,
                "temperature": float(temp.group(1)) if temp else None,
                "ratings": {str(int(r["TWIN_ID"])): [int(r[c]) for c in cols] for _, r in llm.iterrows()},
                "humanCheck": {str(int(r["TWIN_ID"])): [int(r[c]) for c in cols] for _, r in frames["original_answers"].iterrows()},
            }
    return out


def main() -> None:
    survey, people = load_cards_and_ratings()
    add_demographics(people)
    add_personas(people)
    published = load_published()
    human = {str(p["pid"]): p["ratings"] for p in people}
    for arm, ref in published.items():
        mismatch = sum(human.get(pid) != r for pid, r in ref.pop("humanCheck").items())
        if mismatch:
            raise SystemExit(f"{arm}: {mismatch} human rows in results.zip do not match the parquet answers")
        print(f"{arm}: {len(ref['ratings'])} twins ({ref['model']}, T={ref['temperature']})", file=sys.stderr)
    out = DATA / "infotainment.json"
    out.write_text(json.dumps({"survey": survey, "people": people, "published": published}, indent=1))
    print(f"wrote {out.relative_to(EVALS)}: {len(people)} people, {len(survey['cards'])} cards", file=sys.stderr)


if __name__ == "__main__":
    main()
