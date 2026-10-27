"""Work categories, counties and places. Mirrors src/lib/taxonomy.ts so labels and ids match the frontend."""

WORK_CATEGORIES = {
    # id: (label, short description used for embedding-based category guessing)
    "paving": ("Paving", "paving, asphalt, overlay, chip seal, crack sealing, road resurfacing"),
    "pothole_repair": ("Pothole repair", "pothole repair and patching of roads and streets"),
    "excavation": ("Excavation", "excavation, trenching, earthwork, hauling dirt"),
    "grading": ("Grading", "grading, leveling, gravel roads, shoulder work"),
    "drainage": ("Drainage", "drainage, culverts, storm water, ditches, catch basins"),
    "landscaping": ("Landscaping", "landscaping, mowing, planting, irrigation, tree trimming, grounds maintenance"),
    "site_prep": ("Site preparation", "site preparation, land clearing, erosion control, demolition"),
    "concrete": ("Concrete", "concrete, sidewalks, curbs, gutters, flatwork, curb ramps"),
    "utilities": ("Water and sewer utilities", "water main, sewer, utility lines"),
    "janitorial": ("Janitorial", "janitorial, custodial and cleaning services"),
    "it_services": ("IT and software", "software, information technology, networks, cybersecurity"),
    "supplies": ("Goods and supplies", "purchase of goods, supplies and materials"),
    "other": ("Other services", "other services"),
}


def category_label(cid: str) -> str:
    return WORK_CATEGORIES[cid][0] if cid in WORK_CATEGORIES else cid.replace("_", " ").capitalize()


# The bid puller tags bids with its own category names; map the ones that differ from the frontend's ids.
CATEGORY_ALIASES = {"it": "it_services"}
# Too broad to count as a scope conflict ("construction" includes paving), so similarity decides instead.
VAGUE_CATEGORIES = {"other", "construction"}


def norm_categories(cats: list[str]) -> list[str]:
    """Alias, lowercase and de-duplicate a bid's categories. Unknown names (consulting, electrical, ...) are kept."""
    out: list[str] = []
    for c in cats:
        c = CATEGORY_ALIASES.get(c.strip().lower(), c.strip().lower())
        if c and c not in out:
            out.append(c)
    return out


def specific_categories(cats: list[str]) -> list[str]:
    return [c for c in norm_categories(cats) if c not in VAGUE_CATEGORIES]


# Categories that are close enough that a vendor in one can reasonably look at the other (flagged, never "good fit").
ADJACENT = {"paving": {"pothole_repair"}, "pothole_repair": {"paving"}}

WA_COUNTIES = [
    "Adams", "Asotin", "Benton", "Chelan", "Clallam", "Clark", "Columbia", "Cowlitz", "Douglas", "Ferry",
    "Franklin", "Garfield", "Grant", "Grays Harbor", "Island", "Jefferson", "King", "Kitsap", "Kittitas",
    "Klickitat", "Lewis", "Lincoln", "Mason", "Okanogan", "Pacific", "Pend Oreille", "Pierce", "San Juan",
    "Skagit", "Skamania", "Snohomish", "Spokane", "Stevens", "Thurston", "Wahkiakum", "Walla Walla",
    "Whatcom", "Whitman", "Yakima",
]

WA_PLACES = [  # (name, county)
    ("Seattle", "King"), ("Spokane", "Spokane"), ("Tacoma", "Pierce"), ("Vancouver", "Clark"),
    ("Bellevue", "King"), ("Kent", "King"), ("Renton", "King"), ("Everett", "Snohomish"),
    ("Bellingham", "Whatcom"), ("Olympia", "Thurston"), ("Yakima", "Yakima"), ("Kennewick", "Benton"),
    ("Pasco", "Franklin"), ("Richland", "Benton"), ("Wenatchee", "Chelan"), ("Walla Walla", "Walla Walla"),
    ("Port Angeles", "Clallam"), ("Aberdeen", "Grays Harbor"), ("Ellensburg", "Kittitas"),
    ("Moses Lake", "Grant"), ("Pullman", "Whitman"), ("Mount Vernon", "Skagit"), ("Longview", "Cowlitz"),
    ("Bremerton", "Kitsap"), ("Omak", "Okanogan"), ("Colville", "Stevens"), ("Centralia", "Lewis"),
]


def normalize_county(name: str) -> str:
    """'King County' / 'king' -> 'king'."""
    import re
    return re.sub(r"\s+county$", "", name.strip().lower())
