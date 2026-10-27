"""autosegment.py: privacy filtering, profiling, and rule application (no API calls)."""
from datetime import date

from scorers.autosegment import Proposal, ProposedSegment, Rule, apply, prepare, read_csv

CSV = """customer_id,name,email,phone,move_in_date,rate_type,monthly_rate,notes
C1,Ana Ruiz,ana@example.com,(206) 555-0101,2016-01-10,standard,120,likes the corner unit near the gate
C2,Bo Lin,bo@example.com,(206) 555-0102,2026-09-01,standard,99,asked about climate control last spring
C3,Cy Dee,cy@example.com,(206) 555-0103,2024-05-05,negotiated,80,referred by Ana and paid a year ahead
C4,Di Fox,di@example.com,(206) 555-0104,2015-03-03,negotiated,85,wants an invoice every month by email
"""


def test_personal_columns_never_summarized():
    clean, summaries, skipped = prepare(read_csv(CSV), today=date(2026, 10, 25))
    assert {"customer_id", "name", "email", "phone"} <= set(skipped)
    assert "notes" in skipped                     # free text can hide personal details
    assert set(summaries) == {"move_in_date", "rate_type", "monthly_rate"}
    assert summaries["move_in_date"]["type"] == "date (days ago)"
    assert all("name" not in row and "email" not in row for row in clean)


def test_rules_assign_rows_to_first_match_and_describe_them():
    clean, summaries, _ = prepare(read_csv(CSV), today=date(2026, 10, 25))
    proposal = Proposal(segments=[
        ProposedSegment(label="Negotiated rate", why="w",
                        rules=[Rule(column="rate_type", op="==", value="negotiated")]),
        ProposedSegment(label="10+ years", why="w",
                        rules=[Rule(column="move_in_date", op=">=", value="3650")]),
        ProposedSegment(label="Ghost", why="w", rules=[Rule(column="email", op="==", value="x")]),
    ])
    segments, notes = apply(proposal, clean, summaries)
    sizes = {s.label: s.size for s in segments}
    assert sizes == {"Negotiated rate": 2, "10+ years": 1, "Everyone else": 1}
    assert "unknown columns" in notes[0]
    tenured = next(s for s in segments if s.label == "10+ years")
    assert "10.8 years ago" in tenured.facts and "rate_type: standard" in tenured.facts


def test_excel_files_read_like_csv():
    import io
    from datetime import datetime

    from openpyxl import Workbook

    from scorers.autosegment import xlsx_to_csv

    wb = Workbook()
    wb.active.append(["move_in_date", "monthly_rate", "rate_type"])
    wb.active.append([datetime(2016, 1, 10), 120.0, "standard"])
    buf = io.BytesIO()
    wb.save(buf)
    rows = read_csv(xlsx_to_csv(buf.getvalue()))
    assert rows == [{"move_in_date": "2016-01-10", "monthly_rate": "120", "rate_type": "standard"}]
