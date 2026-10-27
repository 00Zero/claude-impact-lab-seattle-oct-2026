"""Inputs: the sealed/ guard, asset loading and checks, creatives, scenario lint, blind mode, image sizing."""
from __future__ import annotations

import os
import shutil
import struct
import tempfile
import unittest

import helpers
import images
import inputs


class InputTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = os.path.realpath(tempfile.mkdtemp())

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp)

    def path(self, *parts: str) -> str:
        return os.path.join(self.tmp, *parts)

    def test_sealed_guard_names_and_symlinks(self) -> None:
        for folder in ("sealed", "Sealed", "SEALED"):
            os.makedirs(self.path(folder), exist_ok=True)
            with self.assertRaises(inputs.InputError):
                inputs.guard(self.path(folder, "x.png"), "image")
        with self.assertRaises(inputs.InputError):
            inputs.guard(self.path("sealed"), "the output folder")
        os.makedirs(self.path("sealed2"))
        shutil.copy(helpers.DEMO_IMAGES[0], self.path("sealed", "real.png"))
        os.symlink(self.path("sealed", "real.png"), self.path("innocent.png"))
        with self.assertRaises(inputs.InputError):
            inputs.from_images([self.path("innocent.png"), helpers.DEMO_IMAGES[1]])
        self.assertEqual(inputs.guard(self.path("sealed2", "ok.png"), "x"), self.path("sealed2", "ok.png"))

    def test_images(self) -> None:
        assets = inputs.from_images(helpers.DEMO_IMAGES)
        self.assertEqual([a.id for a in assets], ["img_1", "img_2", "img_3"])
        self.assertEqual((assets[0].media_type, assets[0].size, assets[0].tokens), ("image/png", (360, 360), 169))
        with open(self.path("notes.png"), "w") as f:
            f.write("not an image")
        with self.assertRaises(inputs.InputError):
            inputs.from_images([self.path("notes.png"), helpers.DEMO_IMAGES[0]])
        with self.assertRaises(inputs.InputError):  # the same picture twice
            inputs.from_images([helpers.DEMO_IMAGES[0], helpers.DEMO_IMAGES[0]])
        with self.assertRaises(inputs.InputError):  # one ad isn't a comparison
            inputs.from_images(helpers.DEMO_IMAGES[:1])

    def test_oversized_image_is_refused(self) -> None:
        header = b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 9000, 10) + b"\x08\x02\x00\x00\x00"
        with open(self.path("huge.png"), "wb") as f:
            f.write(header + b"\x00" * 64)
        with self.assertRaises(inputs.InputError):
            inputs.from_images([self.path("huge.png"), helpers.DEMO_IMAGES[0]])

    def test_headlines(self) -> None:
        assets = inputs.from_headlines(helpers.DEMO_HEADLINES)
        self.assertEqual([(a.id, a.kind) for a in assets], [("hl_1", "headline"), ("hl_2", "headline")])
        with open(self.path("v.txt"), "w") as f:
            f.write("  Two  spaces  kept \nOther\n")
        self.assertEqual(inputs.from_headlines(self.path("v.txt"))[0].text, "Two  spaces  kept")
        with open(self.path("h.txt"), "w") as f:
            f.write("Same line\n\n  same   line \nSame line\n")
        with self.assertRaises(inputs.InputError):
            inputs.from_headlines(self.path("h.txt"))

    def test_creatives_show_only_the_ad(self) -> None:
        brief = helpers.demo_brief()
        text = inputs.from_creatives(brief, helpers.DEMO_INTAKE, "text", None)
        self.assertEqual([(a.id, a.text) for a in text], [("cr_2", "The fitness app for your GLP-1 journey"),
                                                          ("cr_3", "Strength first, scale second")])
        with self.assertRaises(inputs.InputError):  # cr_1's image has no file in the demo
            inputs.from_creatives(brief, helpers.DEMO_INTAKE, "image", None)
        with self.assertRaises(inputs.InputError):
            inputs.from_creatives(brief, helpers.DEMO_INTAKE, "text", ["cr_9"])
        brief["creatives"].append(dict(brief["creatives"][1]))  # a second cr_2
        with self.assertRaises(inputs.InputError):
            inputs.from_creatives(brief, helpers.DEMO_INTAKE, "text", None)

    def test_image_creatives_resolve_inside_sources(self) -> None:
        brief = helpers.demo_brief()
        os.makedirs(self.path("sources"))
        for i, src in enumerate(helpers.DEMO_IMAGES[:2], 1):
            shutil.copy(src, self.path("sources", f"ad{i}.png"))
        brief["creatives"] = [{"id": "cr_1", "format": "image", "imageFile": "sources/ad1.png"},
                              {"id": "cr_2", "format": "image", "imageFile": "sources/ad2.png"}]
        intake = helpers.write_json(self.path("intake.json"), brief)
        self.assertEqual([a.id for a in inputs.from_creatives(brief, intake, "image", None)], ["cr_1", "cr_2"])
        brief["creatives"][1]["imageFile"] = "../outside.png"
        with self.assertRaises(inputs.InputError):
            inputs.from_creatives(brief, intake, "image", None)

    def test_scenario_lint(self) -> None:
        _, warnings = inputs.load_scenario(helpers.DEMO_SCENARIO, blind=True)
        self.assertEqual(warnings, [])
        with open(self.path("s.txt"), "w") as f:
            f.write("Scrolling Reddit. The kettlebell ad was the winner with a 2% CTR.")
        _, warnings = inputs.load_scenario(self.path("s.txt"), blind=False)
        self.assertTrue(warnings and "ctr" in warnings[0] and "winner" in warnings[0])
        with self.assertRaises(inputs.InputError):  # under --blind, results-like words stop the run
            inputs.load_scenario(self.path("s.txt"), blind=True)

    def test_blind_mode_and_frozen_hash(self) -> None:
        brief, digest, warnings = inputs.load_intake(helpers.DEMO_INTAKE, False, None)
        self.assertTrue(any(w.startswith("not a blind test") for w in warnings))
        with self.assertRaises(inputs.InputError):
            inputs.load_intake(helpers.DEMO_INTAKE, True, None)
        with self.assertRaises(inputs.InputError):
            inputs.load_intake(helpers.DEMO_INTAKE, False, "0" * 64)
        self.assertEqual(inputs.load_intake(helpers.DEMO_INTAKE, False, digest.upper())[1], digest)
        for key in ("priorExperiments", "evidence"):
            brief[key] = []
        for c in brief["creatives"]:
            c["performance"] = None
        clean = helpers.write_json(self.path("clean.json"), brief)
        _, _, warnings = inputs.load_intake(clean, True, None)
        self.assertFalse(any(w.startswith("not a blind test") for w in warnings))


class ImageSizeTest(unittest.TestCase):
    def test_visual_tokens(self) -> None:
        self.assertEqual(images.visual_tokens((360, 360)), 169)
        self.assertEqual(images.visual_tokens((1092, 1092)), 1521)
        self.assertEqual(images.visual_tokens((1920, 1080)), 2691)
        self.assertLessEqual(images.visual_tokens((3840, 2160)), images.MAX_VISUAL_TOKENS)
        self.assertEqual(images.visual_tokens(None), images.MAX_VISUAL_TOKENS)

    def test_jpeg_header(self) -> None:
        sof = b"\xff\xc0" + struct.pack(">HBHH", 17, 8, 600, 800) + b"\x03" + b"\x00" * 9
        data = b"\xff\xd8" + b"\xff\xe0" + struct.pack(">H", 4) + b"JF" + sof
        self.assertEqual(images.media_type(data), "image/jpeg")
        self.assertEqual(images.dimensions(data, "image/jpeg"), (800, 600))
        padded = b"\xff\xd8" + b"\xff\xff\xe0" + struct.pack(">H", 4) + b"JF" + sof  # fill bytes before a marker
        self.assertEqual(images.dimensions(padded, "image/jpeg"), (800, 600))
        self.assertIsNone(images.dimensions(b"\xff\xd8\xff\xd9", "image/jpeg"))
        self.assertIsNone(images.media_type(b"GIF89a....."))  # PNG and JPEG only


if __name__ == "__main__":
    unittest.main()
