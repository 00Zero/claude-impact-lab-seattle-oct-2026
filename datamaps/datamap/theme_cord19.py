"""An optional look modelled on DataMapPlot's CORD-19 example map (`render --style cord19`).

Cinzel serif title with a small-caps subtitle, Marcellus group names tinted in their group's
colour, rainbow colours blended by position, lightly shaded group areas with outlines, and
white-rimmed dots sized by document length. The default look stays in theme.py.
Cinzel and Marcellus (SIL OFL 1.1) are embedded by DataMapPlot's offline mode.
"""

from __future__ import annotations

import numpy as np

from . import theme

DISPLAY = "Cinzel"  # title
LABEL = "Marcellus"  # group names
STACK = 'Georgia, "Times New Roman", serif'
INK, MUTED, LINE = "#111111", "#444444", "#e2e2e2"

PLOT_KWARGS = dict(
    font_family=LABEL,
    font_weight=400,
    tooltip_font_family=DISPLAY,  # DataMapPlot also uses this for the title
    tooltip_font_weight=400,
    background_color="#ffffff",
    noise_color="#bdbdbd",
    color_label_text=True,
    text_outline_width=8,
    text_outline_color="#ffffffdd",
    text_min_pixel_size=14,
    text_max_pixel_size=34,
    min_fontsize=14,
    max_fontsize=30,
    title_font_size=30,
    sub_title_font_size=15,
    cluster_boundary_polygons=True,
    color_cluster_boundaries=True,
    cluster_boundary_line_width=2,
    polygon_alpha=0.6,  # largest gap a group shape bridges, in map units; 0.1 hugs only dense cores
    initial_zoom_fraction=0.9,  # start on the main mass, not far-off outliers
    point_radius_min_pixels=3,
    point_radius_max_pixels=12,
    point_line_width_min_pixels=1,
    tooltip_css=f"""
        font-family: Georgia, "Times New Roman", serif;
        font-size: 13px;
        line-height: 1.4;
        color: {INK};
        background: #ffffff;
        border: 1px solid {LINE};
        border-radius: 12px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.15);
        padding: 12px 14px;
        max-width: 400px;
    """,
)

def marker_sizes(df) -> np.ndarray:
    """Bigger dots for longer documents, as on the CORD-19 map; DataMapPlot rescales to the mean."""
    words = df["text"].fillna("").str.split().str.len().to_numpy(dtype=float)
    return np.sqrt(np.clip(words, 20, 2000))


HISTOGRAM_SETTINGS = {
    **theme.HISTOGRAM_SETTINGS,
    "histogram_bin_fill_color": "#555555",
    "histogram_bin_selected_fill_color": "#555555",
    "histogram_bin_unselected_fill_color": "#dddddd",
}

TOOLTIP_TEMPLATE = (
    f'<div style="font-family:\'{DISPLAY}\',{STACK};font-weight:700;font-size:14px;'
    f'margin-bottom:3px">{{doc_title}}</div>'
    f'<div style="font-size:12px;color:{MUTED};margin-bottom:8px">{{meta}}</div>'
    f'<div style="font-size:13px">{{snippet}}</div>'
)


def custom_css() -> str:
    return f"""
body {{ background: #ffffff; color: {INK}; }}
.container-box {{
  background: rgba(255, 255, 255, 0.9) !important;
  border-radius: 16px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12) !important;
}}
#title-container {{ margin: 8px !important; padding: 6px 14px !important; max-width: 90vw; }}
#title-container span:first-of-type {{ font-family: "{DISPLAY}", {STACK} !important; color: {INK} !important; }}
#title-container span:last-of-type {{
  font-family: "{DISPLAY}", {STACK} !important; color: {MUTED} !important; font-variant: small-caps;
}}
#search-container {{ margin: 0 8px !important; }}
#text-search {{
  font: 14px {STACK}; width: 200px; border: 1px solid #cccccc; border-radius: 8px; padding: 5px 8px;
}}
#loading {{ background: #ffffff !important; }}
"""


def custom_js() -> str:
    """Faster zoom, labels redrawn once the font has loaded (see theme.custom_js), and shaded
    group areas: DataMapPlot draws outlines only, scaled to map units, so on small maps they
    come out thinner than a pixel. Swap in a layer with filled areas and 1.5 px outlines."""
    return f"""
datamap.deckgl.setProps({{controller:
  {{scrollZoom: {{speed: 0.03, smooth: false}}, doubleClickZoom: true, touchZoom: true}}}});
(function () {{
  const search = document.getElementById("text-search");
  if (search) search.placeholder = "Search the map…";
  const swap = (name, props) => {{
    const old = datamap[name];
    const fresh = old.clone(props);
    datamap[name] = fresh;
    datamap.layers = datamap.layers.map((l) => (l === old ? fresh : l));
  }};
  const redrawLabels = () => {{
    if (!datamap.labelLayer) return false;
    swap("labelLayer", {{fontFamily: "{LABEL}", fontWeight: 400,
      fontSettings: {{sdf: true, buffer: 6, radius: 14, fontSize: 72}}}});
    if (datamap.boundaryLayer) swap("boundaryLayer", {{
      filled: true,
      getFillColor: (d) => [d.r, d.g, d.b, 38],
      getLineColor: (d) => [d.r, d.g, d.b, 170],
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      lineWidthScale: 1,
      lineWidthMinPixels: 1,
      updateTriggers: {{getFillColor: "shade", getLineColor: "shade", getLineWidth: "shade"}},
    }});
    datamap.deckgl.setProps({{layers: [...datamap.layers]}});
    return true;
  }};
  Promise.all([
    document.fonts.load('400 24px "{LABEL}"'),
    document.fonts.load('400 24px "{DISPLAY}"'),
  ]).catch(() => {{}}).then(() => {{
    let tries = 0;
    const timer = setInterval(() => {{ if (redrawLabels() || ++tries > 50) clearInterval(timer); }}, 200);
  }});
}})();
"""
