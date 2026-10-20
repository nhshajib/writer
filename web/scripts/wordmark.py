"""Prints the "TypeWit" wordmark as SVG path data (Inter Display Bold outlines), so logos don't depend on fonts.

Usage: python3 scripts/wordmark.py /path/to/InterDisplay-Bold.otf
Output: JSON {"type": d, "wit": d, "width": w, "ascender": a, "descender": d} in font units (y down, baseline 0).
"""
import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

font = TTFont(sys.argv[1])
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]
TRACKING = -0.02 * font["head"].unitsPerEm  # slightly tight, as on the site


def run(text: str, x: float) -> tuple[str, float]:
    pen = SVGPathPen(glyphs)
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        # Flip y so the path draws downward from the baseline like SVG.
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        x += hmtx[name][0] + (TRACKING if i < len(text) - 1 else 0)
    return pen.getCommands(), x


type_d, x = run("Type", 0)
wit_d, width = run("Wit", x + TRACKING)
os2 = font["OS/2"]
print(json.dumps({
    "type": type_d,
    "wit": wit_d,
    "width": round(width),
    "cap_height": os2.sCapHeight,
    "units": font["head"].unitsPerEm,
}))
