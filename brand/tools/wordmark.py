"""Outline the Dineri wordmark from Reem Kufi (SIL OFL 1.1) so logo files need no font.

   python3 brand/tools/wordmark.py > brand/tools/wordmark-paths.json

Instances the variable font at the logo's weight and writes each glyph's outline as an SVG path,
laid out with the font's own advance widths plus the logo's tracking. brand/build.mjs turns the
paths into the logo files.
"""
import io, json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

FONT = "node_modules/@fontsource-variable/reem-kufi/files/reem-kufi-latin-wght-normal.woff2"
TEXT = "Dineri"
WEIGHT = 600          # brand/BRAND.md: the wordmark is Reem Kufi SemiBold
TRACKING = 0.02       # em, as on the site

font = TTFont(FONT)
font.flavor = None
buf = io.BytesIO(); font.save(buf); buf.seek(0)
font = instantiateVariableFont(TTFont(buf), {"wght": WEIGHT})
upm = font["head"].unitsPerEm
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
hmtx = font["hmtx"]

x = 0
parts = []
xmin = ymin = float("inf"); xmax = ymax = float("-inf")
for ch in TEXT:
    name = cmap[ord(ch)]
    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)
    b = BoundsPen(glyphs); glyphs[name].draw(b)
    if b.bounds:
        gx0, gy0, gx1, gy1 = b.bounds
        xmin, ymin = min(xmin, x + gx0), min(ymin, gy0)
        xmax, ymax = max(xmax, x + gx1), max(ymax, gy1)
    parts.append({"char": ch, "x": x, "d": pen.getCommands()})
    x += hmtx[name][0] + TRACKING * upm

json.dump({"font": "Reem Kufi", "weight": WEIGHT, "unitsPerEm": upm, "ascender": font["hhea"].ascent,
           "capHeight": getattr(font["OS/2"], "sCapHeight", None), "advance": x - TRACKING * upm,
           "bounds": [xmin, ymin, xmax, ymax], "glyphs": parts}, sys.stdout, indent=1)
