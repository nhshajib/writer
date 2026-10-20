"""Writes TypeWit's logo SVGs into public/brand/. Run from web/:

    python3 scripts/wordmark.py /usr/share/fonts/opentype/inter/InterDisplay-Bold.otf > /tmp/wordmark.json
    python3 scripts/brand.py /tmp/wordmark.json
    node scripts/render-brand.mjs        # PNGs, favicon sources, Google logo, Word icons

The mark: a rounded blue tile with a "T" and a text cursor beside it, for text
appearing step by step. Drawn on a 64-unit grid so it stays crisp at 16 px.
"""
import json
import sys
from pathlib import Path

BLUE = "#0b57d0"
BLUE_DARK = "#0842a0"
CURSOR = "#8ab4f8"
INK = "#0a0a0b"
OUT = Path("public/brand")


def glyph(color: str = "#fff", cursor: str = CURSOR) -> str:
    """The T and the cursor, on the 64-unit grid."""
    return (
        f'<path d="M18 19.5h27M31.5 19.5v26" fill="none" stroke="{color}" stroke-width="8" stroke-linecap="round"/>'
        f'<rect x="40.5" y="31.5" width="7" height="16" rx="3.5" fill="{cursor}"/>'
    )


def tile(fill: str = BLUE) -> str:
    return f'<rect width="64" height="64" rx="15" fill="{fill}"/>'


def svg(view_w: float, view_h: float, body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w:g} {view_h:g}" role="img" aria-label="{title}">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def main() -> None:
    wm = json.load(open(sys.argv[1]))
    OUT.mkdir(parents=True, exist_ok=True)

    marks = {
        "mark.svg": tile() + glyph(),
        # One colour, for places that can't print colour (stamps, embossing, fax).
        "mark-black.svg": tile(INK) + glyph("#fff", "#fff"),
        "mark-white.svg": tile("#fff") + glyph(BLUE, BLUE),
        # Full-bleed square for avatars and Google's consent screen, which crop to a circle:
        # the glyph sits well inside the circle.
        "mark-square.svg": f'<rect width="64" height="64" fill="{BLUE}"/>'
        + f'<g transform="translate(-1.6 -1.6) scale(1.05)">{glyph()}</g>',
    }
    for name, body in marks.items():
        (OUT / name).write_text(svg(64, 64, body, "TypeWit"))

    # Horizontal logo: mark + wordmark. The wordmark's cap height matches the T's height (24 of 64 units).
    scale = 30 / wm["cap_height"]
    text_w = wm["width"] * scale
    gap = 16
    baseline = 32 + 15  # optical centre of the caps on the 64-unit tile
    width = 64 + gap + text_w + 2
    for name, type_fill, wit_fill in (
        ("logo.svg", INK, BLUE),
        ("logo-white.svg", "#fff", CURSOR),
        ("logo-black.svg", INK, INK),
    ):
        body = (
            tile() + glyph()
            + f'<g transform="translate({64 + gap:g} {baseline:g}) scale({scale:.6f})">'
            + f'<path d="{wm["type"]}" fill="{type_fill}"/><path d="{wm["wit"]}" fill="{wit_fill}"/></g>'
        )
        (OUT / name).write_text(svg(round(width, 2), 64, body, "TypeWit"))

    # Wordmark alone.
    body = (
        f'<g transform="translate(0 {wm["cap_height"]})">'
        f'<path d="{wm["type"]}" fill="{INK}"/><path d="{wm["wit"]}" fill="{BLUE}"/></g>'
    )
    (OUT / "wordmark.svg").write_text(svg(wm["width"], wm["cap_height"] * 1.35, body, "TypeWit"))
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.svg"))))


main()
