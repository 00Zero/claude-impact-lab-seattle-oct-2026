"""The owner site's look (web/index.html) applied to DataMapPlot maps.

Fonts are embedded in each map.html as base64, so it looks the same offline and when
emailed. Both fonts are SIL OFL 1.1; licenses are in assets/fonts/.
"""

from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

FONTS = Path(__file__).parent / "assets" / "fonts"
DISPLAY = "Bricolage Grotesque"  # headings and map labels, as on the site
BODY = "Atkinson Hyperlegible"  # everything else
STACK = '"Segoe UI", system-ui, -apple-system, sans-serif'

INK, MUTED, LINE, ACCENT, ACCENT_SOFT = "#17231f", "#5b6b65", "#d5ddd9", "#1f6f5c", "#e1efea"
NOISE_COLOR = "#c3ccc8"

# Keyword arguments for datamapplot.create_interactive_plot.
PLOT_KWARGS = dict(
    font_family=DISPLAY,
    font_weight=600,
    tooltip_font_family=BODY,
    tooltip_font_weight=400,
    background_color="#ffffff",
    noise_color=NOISE_COLOR,
    color_label_text=False,  # dark labels read better; the dots carry the colour
    text_outline_width=6,
    text_outline_color="#ffffffee",
    text_min_pixel_size=13,
    text_max_pixel_size=26,
    min_fontsize=13,
    max_fontsize=22,
    title_font_size=15,
    sub_title_font_size=10,
    tooltip_css=f"""
        font-family: "{BODY}", {STACK};
        font-size: 13px;
        line-height: 1.4;
        color: {INK};
        background: #ffffff;
        border: 1px solid {LINE};
        border-radius: 10px;
        box-shadow: 0 6px 24px rgba(23, 35, 31, 0.14);
        padding: 12px 14px;
        max-width: 400px;
    """,
)

HISTOGRAM_SETTINGS = {
    "histogram_title": "Over time",
    "histogram_width": 250,
    "histogram_height": 56,
    "histogram_bin_fill_color": ACCENT,
    "histogram_bin_selected_fill_color": ACCENT,
    "histogram_bin_unselected_fill_color": ACCENT_SOFT,
    "histogram_bin_context_fill_color": LINE,
}

# Hover card for one dot; filled from extra_point_data columns.
TOOLTIP_TEMPLATE = (
    f'<div style="font-family:\'{DISPLAY}\',{STACK};font-weight:700;font-size:14px;'
    f'margin-bottom:3px">{{doc_title}}</div>'
    f'<div style="font-size:12px;color:{MUTED};margin-bottom:8px">{{meta}}</div>'
    f'<div style="font-size:13px">{{snippet}}</div>'
)


@lru_cache(maxsize=1)
def _font_faces() -> str:
    def face(family: str, file: str, weight: str) -> str:
        data = base64.b64encode((FONTS / file).read_bytes()).decode("ascii")
        return (
            f'@font-face {{ font-family: "{family}"; font-style: normal; font-weight: {weight}; '
            f'font-display: block; src: url(data:font/woff2;base64,{data}) format("woff2"); }}'
        )

    return "\n".join([
        face(DISPLAY, "BricolageGrotesque-latin.woff2", "200 800"),
        face(BODY, "AtkinsonHyperlegible-400-latin.woff2", "400"),
        face(BODY, "AtkinsonHyperlegible-700-latin.woff2", "700"),
    ])


def custom_css() -> str:
    return _font_faces() + f"""
body {{ background: #ffffff; font-family: "{BODY}", {STACK}; color: {INK}; }}
.container-box {{
  background: rgba(255, 255, 255, 0.94) !important;
  border: 1px solid {LINE} !important;
  border-radius: 10px !important;
  box-shadow: 0 1px 3px rgba(23, 35, 31, 0.06) !important;
  backdrop-filter: blur(6px);
}}
#title-container {{ margin: 14px 14px 8px !important; padding: 12px 16px !important; max-width: min(520px, 70vw); }}
#title-container span:first-of-type {{
  font-family: "{DISPLAY}", {STACK} !important; font-weight: 700; color: {INK} !important;
  font-size: 20px !important;
  letter-spacing: -0.015em; line-height: 1.15; display: inline-block;
}}
#title-container span:last-of-type {{
  font-family: "{BODY}", {STACK} !important; color: {MUTED} !important; font-size: 13px !important;
  display: inline-block; margin-top: 4px; line-height: 1.4;
}}
#title-container br {{ display: none; }}
#title-container span:first-of-type::after {{ content: ""; display: block; }}
#search-container {{ margin: 0 14px !important; padding: 6px !important; }}
#text-search {{
  font: 14px "{BODY}", {STACK}; color: {INK}; width: 240px;
  border: 1px solid {LINE}; border-radius: 8px; padding: 7px 10px; background: #f3f5f4;
}}
#text-search:focus {{ outline: 2px solid {ACCENT}; outline-offset: 1px; background: #fff; }}
#d3histogram-container {{ margin: 14px !important; }}
#d3histogram-title, #d3histogram-subtitle, .d3histogram-axis {{
  font-family: "{BODY}", {STACK} !important; color: {MUTED}; fill: {MUTED};
}}
#d3histogram-title {{ font-weight: 700; color: {INK}; }}
/* The month axis crowds at this width: drop the count axis, label every other month. */
#d3histogram-container g.d3histogram-axis:not([transform]) {{ display: none; }}
#d3histogram-container g.d3histogram-axis[transform] .tick text {{ font-size: 10px; }}
#d3histogram-container g.d3histogram-axis[transform] .tick:nth-of-type(even) text {{ display: none; }}
#d3histogram-interactioncontainer > .selection {{ fill: {ACCENT_SOFT}; stroke: {ACCENT}; }}
#loading {{ background: #ffffff !important; }}
/* DataMapPlot hides the bottom-left panel (the timeline) below 768px; keep it in narrow frames. */
@media (max-width: 768px) {{ .bottom-left {{ display: flex !important; }} }}
"""


def _rgb(hex_color: str) -> list[int]:
    return [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)] + [255]


def custom_js() -> str:
    """Faster zoom, a friendlier search box, and labels redrawn once the font has loaded.

    DataMapPlot builds its label layer without waiting for the web font, so labels can
    come out in a fallback serif. After the embedded font loads, swap in a copy of the
    layer with slightly different font settings, which forces a fresh glyph atlas.
    """
    ink_rgb = _rgb(INK)
    return f"""
datamap.deckgl.setProps({{controller:
  {{scrollZoom: {{speed: 0.03, smooth: false}}, doubleClickZoom: true, touchZoom: true}}}});
(function () {{
  const search = document.getElementById("text-search");
  if (search) search.placeholder = "Search the map…";
  // Maps rendered elsewhere can have pin-prick dots; make them easy to see and hover.
  const enlargeDots = () => {{
    if (!datamap.pointLayer || (datamap.pointRadiusMinPixels || 0) >= 3) return;
    datamap.pointRadiusMinPixels = 3;
    const points = datamap.pointLayer.clone({{radiusMinPixels: 3}});
    datamap.layers = datamap.layers.map((l) => (l === datamap.pointLayer ? points : l));
    datamap.pointLayer = points;
  }};
  const redrawLabels = () => {{
    const old = datamap.labelLayer;
    if (!old) return false;  // labels arrive once the map's data has loaded
    enlargeDots();
    const fresh = old.clone({{
      fontFamily: "{DISPLAY}",
      fontWeight: 600,
      fontSettings: {{sdf: true, buffer: 6, radius: 14, fontSize: 72}},
      getColor: {ink_rgb},
      updateTriggers: {{getColor: "ink"}},
    }});
    datamap.labelLayer = fresh;
    datamap.layers = datamap.layers.map((l) => (l === old ? fresh : l));
    datamap.deckgl.setProps({{layers: [...datamap.layers]}});
    return true;
  }};
  Promise.all([
    document.fonts.load('700 24px "{DISPLAY}"'),
    document.fonts.load('400 14px "{BODY}"'),
  ]).catch(() => {{}}).then(() => {{
    let tries = 0;
    const timer = setInterval(() => {{ if (redrawLabels() || ++tries > 50) clearInterval(timer); }}, 200);
  }});
}})();
"""


THEME_MARK = "datamap-theme"


def restyle(path: Path) -> bool:
    """Give an already-rendered DataMapPlot map.html this look, e.g. one made by another tool.

    Returns False if the file already has it.
    """
    html = path.read_text(encoding="utf-8")
    if THEME_MARK in html:
        return False
    style = f'<style id="{THEME_MARK}">\n{custom_css()}\n</style>\n'
    # DataMapPlot creates `datamap` in a module script (and sets window.datamap). Modules run
    # in document order after parsing, so a module placed last runs once the map exists.
    script = f'<script type="module" id="{THEME_MARK}-js">\n{custom_js()}\n</script>\n'
    head, end = html.find("</head>"), html.rfind("</html>")
    if head < 0 or "datamap" not in html:
        raise ValueError(f"{path} doesn't look like a DataMapPlot map")
    html = html[:end] + script + html[end:] if end >= 0 else html + script
    html = html[:head] + style + html[head:]
    path.write_text(html, encoding="utf-8")
    return True
