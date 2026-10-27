"""Run the eval cases through the real matcher and print the tiers. Run from backend/: python scripts/run_eval.py
Exits 1 if any case lands outside its expected tiers. Tune thresholds in app/config.py, not the rules."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.embeddings import embed  # noqa: E402
from app.matching import assess  # noqa: E402
from app.models import Bid, CountiesArea, ProfileField, VendorProfile  # noqa: E402
from app.semantic import cosine  # noqa: E402
from app.textbuild import bid_text, vendor_text  # noqa: E402


def make_profile(v: dict) -> VendorProfile:
    f = lambda x: ProfileField(value=x, provenance="confirmed" if x is not None else "unknown")  # noqa: E731
    return VendorProfile(
        id="eval", revision=1, owner_user_id="eval", original_description=v.get("description", ""),
        core_services=f(v.get("coreServices")), exclusions=f(v.get("exclusions")),
        service_area=f(CountiesArea(counties=v["counties"]) if v.get("counties") else None),
        contractor_registration=f(v.get("contractorRegistration")), bonding=f(v.get("bonding")),
        insurance=f(v.get("insurance")), role_interest=f(v.get("roleInterest")),
    )


def main() -> int:
    spec = json.loads((Path(__file__).resolve().parent.parent / "eval" / "cases.json").read_text())
    failed = 0
    for i, c in enumerate(spec["cases"]):
        profile = make_profile(spec["vendors"][c["vendor"]])
        bid = Bid(id=f"eval-{i}", agency="Eval Agency", **c["bid"])
        v, b = embed([vendor_text(profile, profile.original_description), bid_text(bid)])
        sim = cosine(v, b)
        a = assess(bid, profile, sim)
        ok = a.tier in c["expect"]
        failed += not ok
        print(f"{'ok  ' if ok else 'FAIL'} {c['name']:<58} -> {a.tier:<13} (expected {'/'.join(c['expect'])}) sim={sim:.2f} score={a.ranking_score}")
        if not ok:
            for s in a.mismatches + a.unknowns + a.reasons:
                print(f"       - {s.text}")
    print(f"\n{len(spec['cases']) - failed}/{len(spec['cases'])} cases passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
