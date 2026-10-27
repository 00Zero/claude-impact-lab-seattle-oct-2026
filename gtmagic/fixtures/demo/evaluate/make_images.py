#!/usr/bin/env python3
"""Draw the made-up placeholder ad images for the gtm-evaluate demo: make_images.py [out-dir]

Fiction only: flat shapes on flat colors, no text, no people, no real brand. They exist so the
image path (sniffing, sizing, cost estimate, mock run) has real PNG files to read. Standard
library only; re-running rewrites the same bytes.
"""
from __future__ import annotations

import os
import struct
import sys
import zlib

SIZE = 360  # small on purpose: ~169 visual tokens each, cheap for a live smoke test

# Each design: background color plus shapes, drawn in order. ("rect", x0, y0, x1, y1, rgb) or
# ("disc", cx, cy, r, rgb). Coordinates are in pixels of the SIZE x SIZE canvas.
DESIGNS = {
    "ad-1.png": ((236, 228, 214), [("rect", 0, 250, 360, 360, (120, 150, 110)),
                                   ("disc", 180, 110, 34, (70, 60, 55)),
                                   ("rect", 150, 145, 210, 250, (70, 60, 55)),
                                   ("disc", 245, 205, 26, (40, 40, 40))]),
    "ad-2.png": ((30, 60, 90), [("disc", 180, 180, 120, (240, 200, 90)),
                                ("rect", 60, 290, 300, 310, (250, 250, 245))]),
    "ad-3.png": ((250, 250, 245), [("rect", 40, 40, 160, 320, (210, 90, 70)),
                                   ("rect", 200, 120, 320, 320, (90, 140, 200)),
                                   ("rect", 40, 330, 320, 340, (40, 40, 40))]),
}


def pixel(x: int, y: int, background: tuple, shapes: list) -> tuple:
    color = background
    for shape in shapes:
        if shape[0] == "rect" and shape[1] <= x < shape[3] and shape[2] <= y < shape[4]:
            color = shape[5]
        elif shape[0] == "disc" and (x - shape[1]) ** 2 + (y - shape[2]) ** 2 <= shape[3] ** 2:
            color = shape[4]
    return color


def png(background: tuple, shapes: list) -> bytes:
    rows = b"".join(b"\x00" + bytes(c for x in range(SIZE) for c in pixel(x, y, background, shapes))
                    for y in range(SIZE))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)  # 8-bit RGB, no interlace
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows, 9))
            + chunk(b"IEND", b""))


def main() -> int:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")
    os.makedirs(out, exist_ok=True)
    for name, (background, shapes) in DESIGNS.items():
        with open(os.path.join(out, name), "wb") as f:
            f.write(png(background, shapes))
        print(f"wrote {os.path.join(out, name)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
