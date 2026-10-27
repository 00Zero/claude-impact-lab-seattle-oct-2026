"""Image files: PNG or JPEG by magic bytes, pixel size from the header, and visual tokens for the estimate.

Standard library only. The size is read from the file header (never decoded). Only PNG and JPEG are
accepted (what ad exports use), and the size must be readable, so the API's limits are always checked.
"""
from __future__ import annotations

import math
import struct

MAX_BASE64_BYTES = 10 * 1024 * 1024        # Claude API per-image limit (base64-encoded)
MAX_RAW_BYTES = MAX_BASE64_BYTES * 3 // 4  # the same limit before encoding
# Haiku 5.5 is on the high-resolution tier: long edge up to 2,576 px, at most 4,784 visual tokens.
MAX_LONG_EDGE = 2576
MAX_VISUAL_TOKENS = 4784
PATCH = 28
MAX_DIMENSION = 8000                       # the API rejects images larger than 8000 x 8000 px


def media_type(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def dimensions(data: bytes, kind: str) -> tuple[int, int] | None:
    """(width, height) for PNG and JPEG, read from the header; None when it can't be read."""
    try:
        if kind == "image/png" and data[12:16] == b"IHDR":
            return struct.unpack(">II", data[16:24])
        if kind == "image/jpeg":
            return _jpeg_size(data)
    except struct.error:
        return None
    return None


def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    i = 2
    while i < len(data):
        if data[i] != 0xFF:
            return None
        while i < len(data) and data[i] == 0xFF:  # a marker may be padded with extra 0xFF bytes
            i += 1
        if i >= len(data):
            return None
        marker = data[i]
        i += 1
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # markers without a length
            continue
        if marker == 0xD9 or i + 2 > len(data):  # end of image, or truncated
            return None
        length = struct.unpack(">H", data[i:i + 2])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):  # start of frame
            height, width = struct.unpack(">HH", data[i + 3:i + 7])
            return (width, height)
        i += length
    return None


def visual_tokens(size: tuple[int, int] | None) -> int:
    """⌈w/28⌉ × ⌈h/28⌉ after the API's downscale to the tier limits; the cap when the size is unknown."""
    if not size or size[0] <= 0 or size[1] <= 0:
        return MAX_VISUAL_TOKENS
    width, height = size
    scale = min(1.0, MAX_LONG_EDGE / max(width, height))
    width, height = width * scale, height * scale
    tokens = math.ceil(width / PATCH) * math.ceil(height / PATCH)
    if tokens > MAX_VISUAL_TOKENS:  # the API downsizes further to fit the token cap
        shrink = math.sqrt(MAX_VISUAL_TOKENS / tokens)
        tokens = math.ceil(width * shrink / PATCH) * math.ceil(height * shrink / PATCH)
    return min(tokens, MAX_VISUAL_TOKENS)
