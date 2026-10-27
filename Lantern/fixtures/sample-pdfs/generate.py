"""Generate filled sample PDFs for AgenticLantern Milestone 1.

Each PDF uses the blank form image from Context/ as the background and overlays
real (text-layer) entries, so the parser sees extractable text, as the spec requires.
All people, places and contacts are fictional. One decedent is shared across the
documents so the same record flows hospital -> family -> funeral home.
"""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CTX = os.path.join(ROOT, "Context")
OUT = HERE

# Shared decedent record (fictional)
DECEDENT = {
    "first": "Eleanor", "middle": "Marie", "last": "Whitfield",
    "dob": "03/14/1948", "dod": "10/20/2026", "age": "78",
    "sex": "F", "birthplace": "Spokane", "birth_state": "Washington",
    "address": "2418 Harbor View Dr", "city": "Bellevue", "state": "WA", "zip": "98004",
    "county": "King", "hospital": "Lakeshore Regional Medical Center",
    "spouse_dead": "Thomas Whitfield",
    "informant": "Daniel Whitfield", "informant_rel": "Son",
    "email": "family.whitfield@example.com", "phone": "(425) 555-0148",
}

FONT = "Courier-Bold"


def page(c, img_name, text_fn):
    img = ImageReader(f"{CTX}/{img_name}")
    w, h = img.getSize()
    c.setPageSize((w, h))
    c.drawImage(img, 0, 0, width=w, height=h)
    c.setFillColorRGB(0.05, 0.1, 0.45)  # dark blue "typed" ink
    text_fn(c, h)  # text_fn takes image-space coordinates; we flip y here
    c.showPage()


class Ink:
    """Draw in image pixel space (origin top-left)."""

    def __init__(self, c, h, size=9):
        self.c, self.h, self.size = c, h, size

    def text(self, x, y, s, size=None):
        self.c.setFont(FONT, size or self.size)
        self.c.drawString(x, self.h - y, s)

    def mark(self, x, y):
        """Tick a checkbox/option whose box sits at image point (x, y)."""
        self.c.setFont(FONT, self.size + 1)
        self.c.drawString(x, self.h - y, "X")


def medical_cert(path):
    d = DECEDENT
    c = canvas.Canvas(path)

    def fill(c_, h):
        ink = Ink(c_, h, 9)
        ink.text(432, 213, "Lakeshore Regional Medical Center, Bellevue WA")
        ink.text(255, 283, "4 West")
        ink.text(440, 283, "10/20/2026")
        ink.text(640, 283, "06:42 P.M.")
        # Name of deceased (header row)
        ink.text(340, 322, f"{d['first']} {d['middle']} {d['last']}", 10)
        # Sex / age columns
        ink.mark(222, 488)  # 2. Female
        ink.text(300, 488, d["age"], 10)  # age in years
        # Cause of death: (a) immediate, (b) antecedent, (c) other lines
        ink.text(718, 668, "Acute hypoxic respiratory failure", 7.5)
        ink.text(940, 630, "3 days", 8)
        ink.text(725, 812, "Congestive heart failure", 7.5)
        ink.text(940, 855, "2 years", 8)
        ink.text(705, 897, "Ischemic cardiomyopathy", 7.5)
        ink.text(940, 938, "5 years", 8)
        ink.text(683, 1008, "Type 2 diabetes mellitus", 7.5)
        ink.text(940, 993, "10 years", 8)
        # Manner of death: 1. Natural
        ink.mark(74, 1121)
        # Female: pregnancy associated? -> 2. No
        ink.mark(1018, 1176)
        # Certifying attendant
        ink.text(912, 1597, "Dr. Anita Rao, MD", 9)
        ink.text(490, 1300, "10/21/2026", 9)
        # Certificate to relative (bottom block)
        ink.text(490, 1458, f"{d['first']} {d['middle']} {d['last']}", 9)
        ink.text(1040, 1460, d["spouse_dead"], 9)
        ink.text(200, 1490, f"{d['address']}, {d['city']}, {d['state']} {d['zip']}", 8)
        ink.text(1095, 1490, "10/18/2026", 9)
        ink.text(330, 1518, d["dod"], 9)

    page(c, "Medical cert for the cause of death filled by hospital.png", fill)
    c.save()


def death_worksheet(path):
    d = DECEDENT
    c = canvas.Canvas(path)

    def fill(c_, h):
        ink = Ink(c_, h, 9)
        # 1. Legal name
        ink.text(100, 178, d["first"], 10)
        ink.text(440, 178, d["middle"], 10)
        ink.text(655, 178, d["last"].upper(), 10)
        # 2. Death date, 6. County of death
        ink.text(905, 166, d["dod"], 10)
        ink.text(905, 205, d["county"] + " County", 9)
        # 3. Sex, 4a. Age
        ink.text(122, 240, d["sex"], 10)
        ink.text(278, 236, d["age"], 10)
        # 7. Birthdate, 8a/8b. Birthplace
        ink.text(322, 290, d["dob"], 10)
        ink.text(700, 290, d["birthplace"], 10)
        ink.text(918, 290, "United States", 9)
        # 12. Armed forces -> No
        ink.mark(163, 293)
        # 9. Education -> Bachelor's degree
        ink.mark(54, 506)
        # 10. Hispanic origin -> No
        ink.mark(419, 425)
        # 11. Race -> White
        ink.mark(782, 348)
        # 13a-13f residence
        ink.text(60, 678, f"{d['address']}", 10)
        ink.text(830, 678, d["city"], 10)
        ink.text(60, 735, d["county"], 10)
        ink.text(610, 735, d["state"] + " (United States)", 9)
        ink.text(935, 735, d["zip"], 10)
        # 13g inside city limits -> Yes
        ink.mark(79, 789)
        # 14. Length at residence
        ink.text(335, 790, "24 years", 9)
        # 15. Marital status -> Widowed
        ink.mark(964, 781)
        # 16. Surviving spouse (none living: deceased spouse is listed on the hospital form)
        ink.text(60, 835, "N/A - spouse deceased", 9)
        # 17/18. Occupation / business
        ink.text(60, 892, "Accountant", 10)
        ink.text(600, 892, "Credit union", 9)
        # 19/20. Parents
        ink.text(60, 958, "Walter Ellis Whitfield", 10)
        ink.text(600, 958, "Marie Dolores Hale", 10)
        # 21/22. Informant
        ink.text(60, 1008, d["informant"], 10)
        ink.text(740, 1008, d["informant_rel"], 10)
        # 23. Mailing address
        ink.text(265, 1060, d["address"], 9)
        ink.text(607, 1060, d["city"], 9)
        ink.text(878, 1060, d["state"], 9)
        ink.text(1013, 1060, d["zip"], 9)
        # 24. Place of death -> Inpatient
        ink.mark(54, 1119)
        # 25-27. Facility
        ink.text(60, 1200, d["hospital"], 9)
        ink.text(650, 1200, "Bellevue", 10)
        ink.text(900, 1200, "WA", 10)
        ink.text(985, 1200, "98005", 10)
        # 28. Disposition -> Cremation
        ink.mark(152, 1265)
        # 29-30. Place of disposition
        ink.text(440, 1300, "Sunset Hills Crematory", 9)
        ink.text(845, 1300, "Kirkland, WA", 9)
        # 32. Date of disposition
        ink.text(900, 1355, "10/24/2026", 10)
        # Informant contact
        ink.text(60, 1425, d["phone"], 10)
        ink.text(600, 1425, d["email"], 9)
        # 31 is pre-printed by the funeral home; left as-is.

    page(c, "Death Certificate needed by funeral home.png", fill)
    c.save()


def wa_hospital_certification(path):
    """Washington-style medical certification of cause of death (hospital, text PDF).

    Built from the standard WA cause-of-death elements (Part I chain, Part II
    contributing conditions, manner, certifier). Not a reproduction of an official
    DOH form; labelled as a sample.
    """
    from reportlab.lib.pagesizes import letter
    d = DECEDENT
    c = canvas.Canvas(path, pagesize=letter)
    W, H = letter
    y = H - 54

    def line(x, yy, label, value=None, size=10):
        c.setFont("Helvetica", 7.5)
        c.setFillColorRGB(0.35, 0.35, 0.35)
        c.drawString(x, yy + 9, label)
        c.setFillColorRGB(0.05, 0.1, 0.45)
        c.setFont(FONT, size)
        c.drawString(x, yy - 2, value or "")
        c.setStrokeColorRGB(0.6, 0.6, 0.6)
        c.line(x, yy - 5, x + 250, yy - 5)

    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(W / 2, y, "STATE OF WASHINGTON")
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(W / 2, y - 16, "MEDICAL CERTIFICATION OF CAUSE OF DEATH")
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(W / 2, y - 29, "Sample document for testing - not an official Department of Health form")
    y -= 58

    c.setFont("Helvetica-Bold", 9)
    c.drawString(54, y, "SECTION 1 - DECEDENT")
    c.line(54, y - 3, W - 54, y - 3)
    y -= 26
    line(54, y, "Legal name (first, middle, last)", f"{d['first']} {d['middle']} {d['last']}")
    line(330, y, "Sex", "Female")
    y -= 30
    line(54, y, "Date of birth", d["dob"])
    line(330, y, "Age at death (years)", d["age"])
    y -= 30
    line(54, y, "Date of death", d["dod"])
    line(330, y, "Time of death", "06:42 PM")
    y -= 30
    line(54, y, "Place of death", d["hospital"])
    line(330, y, "County of death", d["county"])
    y -= 30
    line(54, y, "Residence (street)", d["address"])
    line(330, y, "City / State / ZIP", f"{d['city']}, {d['state']} {d['zip']}")
    y -= 40

    c.setFont("Helvetica-Bold", 9)
    c.drawString(54, y, "SECTION 2 - CAUSE OF DEATH")
    c.line(54, y - 3, W - 54, y - 3)
    y -= 22
    c.setFont("Helvetica", 7.5)
    c.drawString(54, y, "Part I: Chain of conditions leading directly to death (enter the underlying cause last).")
    y -= 24
    rows = [
        ("(a) Immediate cause", "Acute hypoxic respiratory failure", "3 days"),
        ("(b) Due to / as a consequence of", "Congestive heart failure", "2 years"),
        ("(c) Due to / as a consequence of", "Ischemic cardiomyopathy", "5 years"),
        ("(d) Due to / as a consequence of", "Type 2 diabetes mellitus", "10 years"),
    ]
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(54, y, "Condition")
    c.drawString(360, y, "Approx. interval, onset to death")
    y -= 14
    for label, cond, interval in rows:
        line(54, y, label, cond, size=9)
        line(360, y, "Interval", interval, size=9)
        y -= 32
    c.setFont("Helvetica", 7.5)
    c.drawString(54, y, "Part II: Other significant conditions contributing to death but not part of the chain above.")
    y -= 26
    line(54, y, "Other significant condition", "Hypertension", size=9)
    y -= 36

    c.setFont("Helvetica-Bold", 9)
    c.drawString(54, y, "SECTION 3 - MANNER AND CIRCUMSTANCES")
    c.line(54, y - 3, W - 54, y - 3)
    y -= 24
    c.setFont("Helvetica", 9)
    c.drawString(54, y, "Manner of death:  [X] Natural    [ ] Accident    [ ] Suicide    [ ] Homicide    [ ] Pending investigation")
    y -= 20
    c.drawString(54, y, "Autopsy performed:  [ ] Yes    [X] No          Autopsy findings available:  [ ] Yes    [X] No")
    y -= 20
    c.drawString(54, y, "Pregnancy within past year:  [ ] Yes    [ ] No    [X] Not applicable (decedent not pregnant)")
    y -= 40

    c.setFont("Helvetica-Bold", 9)
    c.drawString(54, y, "SECTION 4 - CERTIFIER")
    c.line(54, y - 3, W - 54, y - 3)
    y -= 26
    line(54, y, "Certifying physician (name, degree)", "Dr. Anita Rao, MD")
    line(330, y, "Washington license number", "MD-SAMPLE-0001")
    y -= 30
    line(54, y, "Certifying facility", d["hospital"])
    line(330, y, "Date certified", "10/21/2026")
    y -= 40
    c.setStrokeColorRGB(0.4, 0.4, 0.4)
    c.line(54, y, 330, y)
    c.setFont("Helvetica", 7.5)
    c.drawString(54, y - 11, "Certifier signature (electronic signature recorded in EDRS)")

    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(54, 48, "Fictional sample for parser testing. Cause of death must not be extracted into the Case record.")
    c.save()


def non_death_record(path):
    """Unrelated hospital document for the 'no usable fields' parser test."""
    c = canvas.Canvas(path, pagesize=(612, 792))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, 720, "Lakeshore Regional Medical Center")
    c.setFont("Helvetica", 11)
    c.drawString(72, 695, "Outpatient Lab Results - Patient Copy")
    c.drawString(72, 670, "Patient: J. Doe    DOB: 01/02/1975    Visit: 09/12/2026")
    c.drawString(72, 645, "Test: Complete Blood Count     Result: Within normal limits")
    c.drawString(72, 620, "Ordering provider: Dr. Priya Shah")
    c.drawString(72, 595, "This is a routine laboratory report. No admission or death.")
    c.save()


if __name__ == "__main__":
    wa_hospital_certification(f"{OUT}/01-hospital-medical-cert-wa.pdf")
    medical_cert(f"{OUT}/01b-hospital-medical-cert-indian-form-no4.pdf")
    death_worksheet(f"{OUT}/02-wa-death-certificate-worksheet.pdf")
    non_death_record(f"{OUT}/03-non-death-lab-report.pdf")
    print("ok", file=sys.stderr)
