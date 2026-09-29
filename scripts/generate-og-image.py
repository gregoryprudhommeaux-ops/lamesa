#!/usr/bin/env python3
"""Regenerate public/og-share.png (+ og-image.png alias) from brand wordmark.

Requires: pip install pillow
Usage: python3 scripts/generate-og-image.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND_WHITE = ROOT / "public/brand/wordmark-horizontal-white.png"
OUT_SHARE = ROOT / "public/og-share.png"
OUT_LEGACY = ROOT / "public/og-image.png"

BRAND_GREEN = (157, 196, 26, 255)  # #9DC41A
W, H = 2400, 1260
TAGLINE = "Cenas privadas en Guadalajara"
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/macos/Inter-Medium.ttf",
    "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def tint_alpha(src: Image.Image, rgba: tuple[int, int, int, int]) -> Image.Image:
    src = src.convert("RGBA")
    _r, _g, _b, a = src.split()
    solid = Image.new("RGBA", src.size, rgba)
    solid.putalpha(a)
    return solid


def main() -> None:
    white = Image.open(BRAND_WHITE).convert("RGBA")
    target_w = int(W * 0.68)
    target_h = int(white.height * (target_w / white.width))
    white_hi = white.resize((target_w * 2, target_h * 2), Image.Resampling.LANCZOS)
    white_hi = white_hi.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    white_s = white_hi.resize((target_w, target_h), Image.Resampling.LANCZOS)
    lime_s = tint_alpha(white_s, BRAND_GREEN)

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    circle_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(circle_layer)
    cx, cy, rad = -160, 360, 1560
    cd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(18, 52, 32, 220))
    circle_layer = circle_layer.filter(ImageFilter.GaussianBlur(radius=4))
    canvas = Image.alpha_composite(canvas, circle_layer)

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([96, 0, 112, H], fill=BRAND_GREEN)

    offset = 28
    wm_x = (W - target_w) // 2
    wm_y = (H - target_h) // 2 - 80
    canvas.paste(lime_s, (wm_x - offset, wm_y + offset // 2), lime_s)
    canvas.paste(white_s, (wm_x, wm_y), white_s)

    font_path = next((p for p in FONT_CANDIDATES if Path(p).exists()), None)
    font = ImageFont.truetype(font_path, 96) if font_path else ImageFont.load_default()
    bbox = draw.textbbox((0, 0), TAGLINE, font=font)
    tw = bbox[2] - bbox[0]
    tx = (W - tw) // 2
    ty = wm_y + target_h + 72
    draw.text((tx, ty), TAGLINE, font=font, fill=(245, 245, 245, 255))

    rgb = ImageEnhance.Contrast(canvas.convert("RGB")).enhance(1.05)
    for path in (OUT_SHARE, OUT_LEGACY):
        rgb.save(path, format="PNG", optimize=True, compress_level=5)
        print(f"wrote {path.relative_to(ROOT)} ({rgb.size[0]}x{rgb.size[1]}, {path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
